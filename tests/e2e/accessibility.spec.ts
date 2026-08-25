import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import type { E2eFixture } from "../../scripts/seed-e2e";
import { assertNoBlockingAccessibilityViolations } from "./accessibility";

const fixturePath = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);
const ADMIN_URL_PATTERN = /\/admin$/;
const APP_URL_PATTERN = /\/app$/;

const readFixture = async (): Promise<E2eFixture> =>
  JSON.parse(await readFile(fixturePath, "utf8")) as E2eFixture;

const signIn = async (
  page: Page,
  credentials: { email: string; password: string },
  expectedPath: RegExp
): Promise<void> => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(expectedPath, { timeout: 15_000 });
};

test("public surfaces have no moderate or higher accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  const surfaces = [
    { path: "/", ready: page.locator("main"), title: "home" },
    {
      path: "/entrar",
      ready: page.getByRole("heading", { name: "Bem-vinda de volta" }),
      title: "login",
    },
    {
      path: "/cadastro",
      ready: page.getByRole("heading", { name: "Crie sua conta" }),
      title: "signup",
    },
    {
      path: "/recuperar-senha",
      ready: page.getByRole("heading", { name: "Recuperar senha" }),
      title: "password recovery",
    },
    {
      path: "/redefinir-senha?token=e2e-invalid",
      ready: page.getByRole("heading", { name: "Definir nova senha" }),
      title: "password reset",
    },
    {
      path: `/certificados/${fixture.certificate.validCode}`,
      ready: page.getByText("Certificado válido"),
      title: "public certificate",
    },
  ] as const;

  for (const surface of surfaces) {
    await page.goto(surface.path);
    await expect(surface.ready).toBeVisible();
    await assertNoBlockingAccessibilityViolations(page, surface.title);
  }

  await page.route("**/api/checkouts/course**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        orderId: "00000000-0000-4000-8000-000000000001",
        retryAllowed: false,
        status: "processing",
      }),
      contentType: "application/json",
      status: 202,
    });
  });
  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(
    page.getByText("O checkout esta sendo preparado.", { exact: false })
  ).toBeVisible();
  await assertNoBlockingAccessibilityViolations(
    page,
    "public purchase processing"
  );
  await page.unroute("**/api/checkouts/course**");

  await page.route("**/api/checkouts/course", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: "checkout_unavailable",
        retryAllowed: false,
        status: "unavailable",
      }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(page.getByText("Checkout indisponivel")).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "public purchase");
});

test("student surfaces have no moderate or higher accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await assertNoBlockingAccessibilityViolations(page, "student dashboard");

  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page.getByRole("heading", { name: "Primeira aula" })
  ).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "student lesson");

  await page.goto("/app/certificados");
  await expect(
    page.getByRole("heading", { name: "Certificados" })
  ).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "student certificates");
});

test("support surfaces have no moderate or higher accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.support, ADMIN_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Operação de suporte" })
  ).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "support dashboard");

  await page.goto("/admin/operacao/cursos");
  await expect(
    page.getByRole("heading", { name: "Operação de suporte" })
  ).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "support courses");

  await page.goto(`/admin/operacao/cursos/${fixture.course.id}/alunas`);
  await expect(page.getByRole("heading", { name: "Curso E2E" })).toBeVisible();
  await assertNoBlockingAccessibilityViolations(
    page,
    "support course students"
  );

  await page.goto("/admin/financeiro");
  await expect(
    page.getByRole("heading", { name: "Receita e liberação de acesso" })
  ).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "support financials");
});

test("admin surfaces have no moderate or higher accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await assertNoBlockingAccessibilityViolations(page, "admin dashboard");

  await page.goto(`/admin/cursos/${fixture.course.id}`);
  await expect(page.getByRole("tab", { name: "Certificado" })).toBeVisible();
  await assertNoBlockingAccessibilityViolations(page, "admin course editor");

  await page.getByRole("tab", { name: "Certificado" }).click();
  await assertNoBlockingAccessibilityViolations(
    page,
    "admin certificate editor"
  );
});
