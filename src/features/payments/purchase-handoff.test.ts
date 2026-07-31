import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  query: vi.fn(),
}));

const SQL_EFFECT_PATTERN = /\b(insert|update|delete)\b/;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ query: dependencies.query }),
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));

import type { AppSession } from "@/lib/session";
import { getPurchaseHandoffView } from "./purchase-handoff";

const ACTIVE_COURSE = {
  course_id: "11111111-1111-4111-8111-111111111111",
  course_slug: "curso-publico",
  course_title: "Curso publico",
  enrollment_status: null,
  has_effective_access: false,
  has_published_publication: true,
  price_in_cents: 10_000,
  status: "active",
};

const createSession = (overrides: Partial<AppSession> = {}): AppSession => ({
  platformBlockedAt: null,
  platformBlockedReason: null,
  role: "student",
  user: {
    email: "aluna@example.com",
    id: "student-1",
    name: "Aluna",
  },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-30T12:00:00.000Z"));
  dependencies.getServerEnv.mockReturnValue({
    PAYMENTS_CHECKOUT_MODE: "public",
  });
  dependencies.query.mockResolvedValue({ rows: [ACTIVE_COURSE] });
});

describe("getPurchaseHandoffView", () => {
  it.each([
    ["curso inexistente", null],
    ["Curso draft", { status: "draft" }],
    ["Curso archived", { status: "archived" }],
    ["Curso gratuito", { price_in_cents: 0 }],
    ["Curso sem publicacao", { has_published_publication: false }],
  ])("torna %s indisponivel", async (_label, rowOverride) => {
    dependencies.query.mockResolvedValue({
      rows: rowOverride ? [{ ...ACTIVE_COURSE, ...rowOverride }] : [],
    });

    await expect(
      getPurchaseHandoffView({ session: null, slug: "curso-publico" })
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "course_unavailable",
    });
  });

  it.each([
    "authenticated",
    "disabled",
  ])("bloqueia a compra publica quando o modo e %s", async (mode) => {
    dependencies.getServerEnv.mockReturnValue({
      PAYMENTS_CHECKOUT_MODE: mode,
    });

    await expect(
      getPurchaseHandoffView({ session: null, slug: "curso-publico" })
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "checkout_disabled",
    });
  });

  it("trata falha ao ler a disponibilidade do checkout como indisponibilidade", async () => {
    dependencies.getServerEnv.mockImplementation(() => {
      throw new Error("invalid environment");
    });

    await expect(
      getPurchaseHandoffView({ session: null, slug: "curso-publico" })
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "checkout_disabled",
    });
  });

  it("oferece checkout ao visitante elegivel", async () => {
    await expect(
      getPurchaseHandoffView({ session: null, slug: "curso-publico" })
    ).resolves.toEqual({
      courseId: ACTIVE_COURSE.course_id,
      courseSlug: ACTIVE_COURSE.course_slug,
      courseTitle: ACTIVE_COURSE.course_title,
      kind: "checkout",
    });

    expect(dependencies.query).toHaveBeenCalledTimes(1);
    expect(dependencies.query).toHaveBeenCalledWith(expect.any(String), [
      "curso-publico",
      null,
    ]);
  });

  it("leva uma Student com Matricula efetivamente ativa ao Curso", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          ...ACTIVE_COURSE,
          enrollment_status: "active",
          has_effective_access: true,
        },
      ],
    });

    await expect(
      getPurchaseHandoffView({
        session: createSession(),
        slug: "curso-publico",
      })
    ).resolves.toEqual({
      courseId: ACTIVE_COURSE.course_id,
      courseTitle: ACTIVE_COURSE.course_title,
      href: `/app/cursos/${ACTIVE_COURSE.course_id}`,
      kind: "access",
    });
  });

  it("oferece checkout a Student sem acesso efetivo", async () => {
    await expect(
      getPurchaseHandoffView({
        session: createSession(),
        slug: "curso-publico",
      })
    ).resolves.toMatchObject({ kind: "checkout" });
  });

  it("bloqueia Student com Matricula revogada", async () => {
    dependencies.query.mockResolvedValue({
      rows: [{ ...ACTIVE_COURSE, enrollment_status: "revoked" }],
    });

    await expect(
      getPurchaseHandoffView({
        session: createSession(),
        slug: "curso-publico",
      })
    ).resolves.toEqual({ kind: "blocked", reason: "course_revoked" });
  });

  it("bloqueia Student com bloqueio de plataforma", async () => {
    await expect(
      getPurchaseHandoffView({
        session: createSession({
          platformBlockedAt: new Date("2026-07-29T12:00:00.000Z"),
        }),
        slug: "curso-publico",
      })
    ).resolves.toEqual({ kind: "blocked", reason: "account_blocked" });
  });

  it.each([
    "admin",
    "support",
  ] as const)("bloqueia Conta de equipe com papel %s", async (role) => {
    await expect(
      getPurchaseHandoffView({
        session: createSession({ role }),
        slug: "curso-publico",
      })
    ).resolves.toEqual({ kind: "blocked", reason: "team_account" });
  });

  it("usa uma unica projecao SQL sem efeitos", async () => {
    await getPurchaseHandoffView({
      session: createSession(),
      slug: "curso-publico",
    });

    expect(dependencies.query).toHaveBeenCalledTimes(1);
    const sql = String(dependencies.query.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain("select c.id");
    expect(sql).toContain("from courses c");
    expect(sql).toContain("exists");
    expect(sql).toContain("left join enrollments e");
    expect(sql).toContain("e.starts_at <= now()");
    expect(sql).toContain("e.expires_at is null or e.expires_at >= now()");
    expect(sql).toContain("as has_effective_access");
    expect(sql).not.toMatch(SQL_EFFECT_PATTERN);
  });
});
