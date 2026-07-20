import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { E2eFixture } from "../../scripts/seed-e2e";

const fixturePath = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);
const ADMIN_URL_PATTERN = /\/admin$/;
const APP_URL_PATTERN = /\/app$/;
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

test("student without a grant cannot access lesson material", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithoutGrant, APP_URL_PATTERN);
  const response = await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  expect(response?.status()).toBe(404);
});

test("sequencing keeps a future lesson locked", async ({ page }) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page.getByText("Libere concluindo a aula anterior")
  ).toBeVisible();
  const response = await page.goto(`/app/aulas/${fixture.course.lessonTwoId}`);
  expect(response?.status()).toBe(404);
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
