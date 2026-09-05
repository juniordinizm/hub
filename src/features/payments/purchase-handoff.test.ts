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

import { buildContentReleaseScheduleSnapshot } from "@/features/courses/module-content-release";
import { getContentReleaseScheduleDigest } from "@/features/courses/module-content-release-digest";
import type { AppSession } from "@/lib/session";
import { getPurchaseHandoffView } from "./purchase-handoff";

const ACTIVE_COURSE = {
  access_duration_months: 12,
  catalog_visibility: "listed",
  course_id: "11111111-1111-4111-8111-111111111111",
  course_slug: "curso-publico",
  course_title: "Curso publico",
  enrollment_status: null,
  has_effective_access: false,
  has_published_publication: true,
  is_interested: false,
  launch_date: null,
  launch_landing_url: null,
  price_in_cents: 10_000,
  release_modules: [],
  sales_status: "open",
  status: "active",
};
const EMPTY_RELEASE_SCHEDULE = buildContentReleaseScheduleSnapshot([]);

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
    [
      "Curso draft",
      { catalog_visibility: "hidden", sales_status: "closed", status: "draft" },
    ],
    [
      "Curso archived",
      {
        catalog_visibility: "hidden",
        sales_status: "closed",
        status: "archived",
      },
    ],
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
      releaseSchedule: EMPTY_RELEASE_SCHEDULE,
      releaseScheduleDigest: getContentReleaseScheduleDigest(
        EMPTY_RELEASE_SCHEDULE
      ),
    });

    expect(dependencies.query).toHaveBeenCalledTimes(1);
    expect(dependencies.query).toHaveBeenCalledWith(expect.any(String), [
      "curso-publico",
      null,
    ]);
  });

  it("exposes the server-built release schedule and digest", async () => {
    const releaseModules = [
      { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
      { releaseDelayDays: 8, sortOrder: 2, title: "Aplicacao" },
    ];
    dependencies.query.mockResolvedValue({
      rows: [{ ...ACTIVE_COURSE, release_modules: releaseModules }],
    });

    const view = await getPurchaseHandoffView({
      session: null,
      slug: "curso-publico",
    });
    expect(view).toMatchObject({
      kind: "checkout",
      releaseSchedule: {
        clock: "elapsed_24h",
        modules: releaseModules,
        version: 1,
      },
    });
    if (view.kind === "checkout") {
      expect(view.releaseScheduleDigest).toBe(
        getContentReleaseScheduleDigest(view.releaseSchedule)
      );
    }
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

  it("prioritizes effective access while sales are paused", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          ...ACTIVE_COURSE,
          enrollment_status: "active",
          has_effective_access: true,
          sales_status: "closed",
        },
      ],
    });

    await expect(
      getPurchaseHandoffView({
        session: createSession(),
        slug: "curso-publico",
      })
    ).resolves.toMatchObject({ kind: "access" });
  });

  it("shows closed enrollment with interest outside an effective enrollment", async () => {
    dependencies.query.mockResolvedValue({
      rows: [{ ...ACTIVE_COURSE, is_interested: true, sales_status: "closed" }],
    });

    await expect(
      getPurchaseHandoffView({
        session: createSession(),
        slug: "curso-publico",
      })
    ).resolves.toEqual({
      acceptsInterest: true,
      courseId: ACTIVE_COURSE.course_id,
      courseTitle: ACTIVE_COURSE.course_title,
      isInterested: true,
      kind: "sales_closed",
    });
  });

  it("redirects a non-enrolled visitor to the paused course landing", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          ...ACTIVE_COURSE,
          launch_landing_url: "https://landing.example/curso-pausado",
          sales_status: "closed",
        },
      ],
    });

    await expect(
      getPurchaseHandoffView({
        session: createSession(),
        slug: "curso-publico",
      })
    ).resolves.toEqual({
      href: "https://landing.example/curso-pausado",
      kind: "external_redirect",
    });
  });

  it("shows the standard coming-soon page when no external landing is configured", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          ...ACTIVE_COURSE,
          launch_date: "2026-10-01",
          sales_status: "closed",
          status: "draft",
        },
      ],
    });

    await expect(
      getPurchaseHandoffView({ session: null, slug: "curso-publico" })
    ).resolves.toEqual({
      acceptsInterest: true,
      courseId: ACTIVE_COURSE.course_id,
      courseTitle: ACTIVE_COURSE.course_title,
      isInterested: false,
      kind: "coming_soon",
      launchDate: "2026-10-01",
    });
  });

  it("redirects coming soon to its configured external landing", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          ...ACTIVE_COURSE,
          launch_landing_url: "https://landing.example/curso",
          sales_status: "closed",
          status: "draft",
        },
      ],
    });

    await expect(
      getPurchaseHandoffView({ session: null, slug: "curso-publico" })
    ).resolves.toEqual({
      href: "https://landing.example/curso",
      kind: "external_redirect",
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
