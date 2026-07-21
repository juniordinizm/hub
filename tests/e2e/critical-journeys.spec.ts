import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { E2eFixture } from "../../scripts/seed-e2e";

const fixturePath = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);
const ADMIN_URL_PATTERN = /\/admin$/;
const APP_URL_PATTERN = /\/app$/;
const CORRELATION_ID_PATTERN = /Identificador de correlação/;
const SENSITIVE_ERROR_PATTERN = /key|token|secret|postgres|database/i;

const readFixture = async (): Promise<E2eFixture> =>
  JSON.parse(await readFile(fixturePath, "utf8")) as E2eFixture;

const signIn = async (
  page: Parameters<typeof test>[0] extends never
    ? never
    : import("@playwright/test").Page,
  credentials: { email: string; password: string },
  expectedUrl: RegExp
): Promise<void> => {
  const browserErrors: string[] = [];
  const captureConsoleError = (
    message: import("@playwright/test").ConsoleMessage
  ): void => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  };
  const capturePageError = (error: Error): void => {
    browserErrors.push(error.message);
  };

  page.on("console", captureConsoleError);
  page.on("pageerror", capturePageError);
  try {
    await page.goto("/entrar", { waitUntil: "networkidle" });
    await page.getByLabel("E-mail").fill(credentials.email);
    await page.getByLabel("Senha").fill(credentials.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(expectedUrl);
  } catch {
    const visibleError = await page
      .getByRole("alert")
      .textContent()
      .catch(() => null);
    throw new Error(
      `Authentication did not redirect to ${expectedUrl}. Current URL: ${page.url()}. Visible error: ${visibleError ?? "none"}. Browser errors: ${browserErrors.join(" | ") || "none"}.`
    );
  } finally {
    page.off("console", captureConsoleError);
    page.off("pageerror", capturePageError);
  }
};

test.describe.configure({ mode: "serial" });

test("login and password recovery do not enumerate accounts", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);

  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail").fill(fixture.studentWithGrant.email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  const resetConfirmation = page
    .locator("form [role='alert']")
    .filter({ hasText: "Se o e-mail estiver cadastrado" });
  const knownMessage = await resetConfirmation.textContent();

  await page.getByLabel("E-mail").fill("missing@example.test");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(resetConfirmation).toHaveText(knownMessage ?? "");
});

test("student with a grant opens the first lesson", async ({ page }) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page.getByRole("heading", { name: "Primeira aula" })
  ).toBeVisible();
});

test("student dashboard has no critical or serious accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);

  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious"
  );

  expect(blockingViolations).toEqual([]);
});

test("student lesson has no critical or serious accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);

  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious"
  );

  expect(blockingViolations).toEqual([]);
});

test("student area shows a safe recovery boundary after a server fault", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}?e2eFault=true`);

  await expect(
    page.getByRole("heading", { name: "Não foi possível carregar esta área" })
  ).toBeFocused();
  await expect(page.getByText(CORRELATION_ID_PATTERN)).toBeVisible();
  await expect(page.getByText(SENSITIVE_ERROR_PATTERN)).toHaveCount(0);
});

test("student without a grant sees the unavailable lesson state", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithoutGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page.getByRole("heading", { name: "Página indisponível" })
  ).toBeVisible();
});

test("expired and revoked access explain the next action", async ({ page }) => {
  const fixture = await readFixture();
  expect(fixture).toHaveProperty("studentWithExpiredAccess");
  expect(fixture).toHaveProperty("studentWithRevokedAccess");
  const accessFixture = fixture as E2eFixture & {
    studentWithExpiredAccess: { email: string; password: string };
    studentWithRevokedAccess: { email: string; password: string };
  };

  await signIn(page, accessFixture.studentWithExpiredAccess, APP_URL_PATTERN);
  await expect(
    page.getByText("Acesso expirado", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Renovar acesso" })
  ).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, accessFixture.studentWithRevokedAccess, APP_URL_PATTERN);
  await expect(
    page.getByText("Acesso em analise", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Falar com suporte" })
  ).toBeVisible();
});

test("sequencing keeps a future lesson locked", async ({ page }) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page
      .getByRole("complementary")
      .getByText("Libere concluindo a aula anterior")
  ).toBeVisible();
  await page.goto(`/app/aulas/${fixture.course.lessonTwoId}`);
  await expect(
    page.getByRole("heading", { name: "Página indisponível" })
  ).toBeVisible();
});

test("mobile lesson navigation exposes the course outline and locked lessons", async ({
  page,
}) => {
  const fixture = await readFixture();
  await page.setViewportSize({ height: 844, width: 390 });
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);

  const mobileNavigation = page
    .locator("details")
    .filter({ hasText: "Conteúdo do curso" });
  await mobileNavigation
    .getByText("Conteúdo do curso", { exact: true })
    .click();
  await expect(mobileNavigation.getByText("Segunda aula")).toBeVisible();
  await expect(
    mobileNavigation.getByText("Libere concluindo a aula anterior")
  ).toBeVisible();
});

test("completion persists and advances to the next lesson", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await page.getByRole("button", { name: "Concluir aula e avançar" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/app/aulas/${fixture.course.lessonTwoId}$`)
  );
  await expect(
    page.getByRole("heading", { name: "Segunda aula" })
  ).toBeVisible();
});

test("admin is authorized and a student is redirected away from admin", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto("/admin");
  await expect(page).toHaveURL(APP_URL_PATTERN);

  await page.context().clearCookies();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
});

test("public checkout exposes a safe configuration error", async ({
  request,
}) => {
  const fixture = await readFixture();
  const response = await request.post("/api/checkouts/course", {
    data: { courseId: fixture.course.id },
  });
  expect(response.status()).toBe(400);
  const payload = (await response.json()) as { error: string };
  expect(payload.error).not.toMatch(SENSITIVE_ERROR_PATTERN);
});

test("public certificates distinguish valid and revoked records", async ({
  page,
}) => {
  const fixture = await readFixture();
  await page.goto(`/certificados/${fixture.certificate.validCode}`);
  await expect(page.getByText("Certificado valido")).toBeVisible();
  await page.goto(`/certificados/${fixture.certificate.revokedCode}`);
  await expect(page.getByText("Certificado revogado")).toBeVisible();
});

test("admin sees certificate lifecycle controls with mandatory confirmation", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto(`/admin/alunos/${fixture.studentWithGrant.id}`);
  await expect(
    page.getByRole("heading", { name: "Certificados" })
  ).toBeVisible();
  await page.getByText("Emitir certificado manual").click();
  const manualIssuance = page
    .locator("details")
    .filter({ hasText: "Emitir certificado manual" });
  await expect(
    manualIssuance.getByText("Confirmo que revisei os dados")
  ).toBeVisible();
});

test("keyboard reaches the login form and student sidebar", async ({
  page,
}) => {
  const fixture = await readFixture();
  await page.goto("/entrar");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Senha")).toBeFocused();

  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
});
