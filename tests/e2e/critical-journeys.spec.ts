import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import type { E2eFixture } from "../../scripts/seed-e2e";
import { assertNoBlockingAccessibilityViolations } from "./accessibility";
import {
  readAuthenticatedOrderIdentity,
  readBuyerIdentityReviewOutcome,
  readCheckoutDeduplicationOutcome,
  readCheckoutMutationOutcome,
  readOrderOutcome,
  readPaymentEventCount,
  runAsaasWorker,
  sendPaidWebhook,
  setE2ePlatformBlock,
} from "./payment-helpers";

const fixturePath = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);
const ADMIN_URL_PATTERN = /\/admin$/;
const APP_URL_PATTERN = /\/app$/;
const STUDENT_SEARCH_PLACEHOLDER_PATTERN = /Buscar/;
const CORRELATION_ID_PATTERN = /Identificador de correlação/;
const DOWNLOAD_PDF_PATTERN = /Baixar PDF/;
const SENSITIVE_ERROR_PATTERN = /key|token|secret|postgres|database/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_ID_PREFIX_PATTERN = /^chk_/;
const CERTIFICATE_EMAIL_IDEMPOTENCY_PATTERN =
  /^email\.certificate-issued\/([0-9a-f-]{36})\/v1$/;
const CERTIFICATE_CODE_LABEL_PATTERN = /Código do certificado:/;
const CERTIFICATE_CODE_PATTERN = /^PRT-[0-9A-F]{32}$/;

const createCertificateBackground = async (): Promise<Buffer> =>
  await sharp({
    create: {
      background: { alpha: 1, b: 244, g: 241, r: 236 },
      channels: 4,
      height: 849,
      width: 1200,
    },
  })
    .png()
    .toBuffer();

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
    await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 });
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

test("landing CTA handoff creates one checkout and activation @mobile", async ({
  page,
  request,
}) => {
  const fixture = await readFixture();
  let checkoutRequestCount = 0;
  page.on("request", (browserRequest) => {
    if (
      browserRequest.method() === "POST" &&
      new URL(browserRequest.url()).pathname === "/api/checkouts/course"
    ) {
      checkoutRequestCount += 1;
    }
  });

  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(page.getByText("Iniciando checkout seguro...")).toBeVisible();
  await page.waitForURL("http://127.0.0.1:4570/checkout/**");
  expect(checkoutRequestCount).toBe(1);

  const checkoutId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const attemptId = checkoutId.replace(CHECKOUT_ID_PREFIX_PATTERN, "");
  expect(attemptId).toMatch(UUID_PATTERN);

  const customerId = `cus_e2e_${attemptId}`;
  await sendPaidWebhook({ attemptId, customerId, request });
  await sendPaidWebhook({ attemptId, customerId, request });
  await runAsaasWorker(request);
  await runAsaasWorker(request);

  await expect
    .poll(() => readOrderOutcome(attemptId))
    .toEqual({
      activationCount: 1,
      activeEnrollmentCount: 1,
      accountLinked: true,
      buyerIdentityStatus: "resolved",
      enrollmentCount: 1,
      grantCount: 1,
      studentProfileCount: 1,
      status: "paid",
      unverifiedAccount: true,
    });
  expect(await readPaymentEventCount(attemptId)).toBe(1);

  for (const state of ["cancelado", "expirado"]) {
    await page.goto(`/checkout/${state}?attemptId=${attemptId}`);
    const retryLink = page.getByRole("link", { name: "Tentar novamente" });
    await expect(retryLink).toHaveAttribute(
      "href",
      `/comprar/${fixture.course.slug}`
    );
  }
});

test("authenticated Student purchase keeps the session identity", async ({
  page,
  request,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentForAuthenticatedPurchase, APP_URL_PATTERN);

  await page.goto(`/comprar/${fixture.course.slug}`);
  await page.waitForURL("http://127.0.0.1:4570/checkout/**");
  const checkoutId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const attemptId = checkoutId.replace(CHECKOUT_ID_PREFIX_PATTERN, "");

  await sendPaidWebhook({ attemptId, request });
  await runAsaasWorker(request);

  await expect
    .poll(() =>
      readAuthenticatedOrderIdentity({
        attemptId,
        expectedUserId: fixture.studentForAuthenticatedPurchase.id,
      })
    )
    .toEqual({
      buyerIdentityResolved: true,
      grantCount: 1,
      providerIdentityIgnored: true,
      sessionEmailPreserved: true,
      sessionNamePreserved: true,
      sessionUserPreserved: true,
      status: "paid",
    });
});

test("checkout remount reuses the stored UUID and one provider mutation", async ({
  page,
}) => {
  const fixture = await readFixture();
  const observedAttemptIds: string[] = [];
  let applicationPostCount = 0;

  await page.route("**/api/checkouts/course", async (route) => {
    const payload = route.request().postDataJSON() as {
      checkoutAttemptId?: string;
    };
    observedAttemptIds.push(payload.checkoutAttemptId ?? "");
    applicationPostCount += 1;
    const response = await route.fetch();
    if (applicationPostCount === 1) {
      const body = (await response.json()) as { orderId: string };
      await route.fulfill({
        json: {
          orderId: body.orderId,
          retryAllowed: false,
          status: "processing",
        },
        response,
      });
      return;
    }
    await route.fulfill({ response });
  });

  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(
    page.getByText("O checkout esta sendo preparado.")
  ).toBeVisible();
  await page.reload();
  await page.waitForURL("http://127.0.0.1:4570/checkout/**");

  expect(applicationPostCount).toBe(2);
  expect(observedAttemptIds).toHaveLength(2);
  expect(observedAttemptIds[0]).toMatch(UUID_PATTERN);
  expect(observedAttemptIds[1]).toBe(observedAttemptIds[0]);
  await expect
    .poll(() => readCheckoutDeduplicationOutcome(observedAttemptIds[0] ?? ""))
    .toEqual({
      checkoutAttemptCount: 1,
      orderCount: 1,
      providerCheckoutMatchesAttempt: true,
    });
});

test("authenticated purchase blocks active, revoked, blocked, and team accounts before charge", async ({
  page,
}) => {
  const fixture = await readFixture();

  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(page.getByText("Sua Matricula ja esta ativa.")).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, fixture.studentWithRevokedAccess, APP_URL_PATTERN);
  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(
    page.getByRole("heading", { name: "Acesso encerrado" })
  ).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, fixture.studentForBlockedPurchase, APP_URL_PATTERN);
  await setE2ePlatformBlock({
    blocked: true,
    userId: fixture.studentForBlockedPurchase.id,
  });
  let checkoutMutationRequestCount = 0;
  page.on("request", (browserRequest) => {
    if (
      browserRequest.method() === "POST" &&
      new URL(browserRequest.url()).pathname === "/api/checkouts/course"
    ) {
      checkoutMutationRequestCount += 1;
    }
  });
  try {
    await page.goto(`/comprar/${fixture.course.slug}`);
    await expect(
      page.getByRole("heading", { name: "Conta bloqueada" })
    ).toBeVisible();
    expect(checkoutMutationRequestCount).toBe(0);
    expect(
      await readCheckoutMutationOutcome({
        courseId: fixture.course.id,
        userId: fixture.studentForBlockedPurchase.id,
      })
    ).toEqual({ orderCount: 0, providerCheckoutCount: 0 });
  } finally {
    await setE2ePlatformBlock({
      blocked: false,
      userId: fixture.studentForBlockedPurchase.id,
    });
  }

  await page.context().clearCookies();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(
    page.getByRole("heading", { name: "Conta de equipe" })
  ).toBeVisible();
});

test("anonymous paid collisions open identity review without access", async ({
  request,
}) => {
  const fixture = await readFixture();

  for (const customerId of [
    fixture.paymentCustomers.blockedId,
    fixture.paymentCustomers.teamId,
  ]) {
    const attemptId = crypto.randomUUID();
    const checkout = await request.post("/api/checkouts/course", {
      data: { checkoutAttemptId: attemptId, courseSlug: fixture.course.slug },
    });
    expect(checkout.ok()).toBe(true);

    await sendPaidWebhook({ attemptId, customerId, request });
    await runAsaasWorker(request);

    await expect
      .poll(() => readBuyerIdentityReviewOutcome(attemptId))
      .toEqual({
        accessOutboxCount: 0,
        buyerIdentityStatus: "review_required",
        enrollmentCount: 0,
        grantCount: 0,
        pendingReviewCount: 1,
        status: "paid",
      });
  }
});

test("login and password recovery do not enumerate accounts @mobile", async ({
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

test("public signup creates a student account without granting a course", async ({
  page,
}) => {
  const fixture = await readFixture();
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const email = `cadastro-${suffix}@example.test`;
  const name = "Aluna de cadastro publico";

  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("E2E-password-123!");
  await page.getByLabel("Confirmar senha").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(APP_URL_PATTERN);
  await expect(page.getByText("Acesso expirado", { exact: true })).toHaveCount(
    0
  );
  await expect(
    page.getByRole("button", { name: "Adquirir acesso" }).first()
  ).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto("/admin/alunos");
  await page.getByPlaceholder(STUDENT_SEARCH_PLACEHOLDER_PATTERN).fill(email);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(
    new RegExp(`\\?page=1&q=${encodeURIComponent(email)}`)
  );
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

test("student with a grant opens the first lesson @mobile", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page.getByRole("heading", { name: "Primeira aula" })
  ).toBeVisible();
});

test("student dashboard has no moderate or higher accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);

  await assertNoBlockingAccessibilityViolations(page, "student dashboard");
});

test("TOTP challenge preserves tab order and returns focus after error @mobile", async ({
  page,
}) => {
  await page.goto("/verificar-segundo-fator");
  const codeInput = page.getByLabel("Código do autenticador");
  const confirmButton = page.getByRole("button", { name: "Confirmar" });
  const backupButton = page.getByRole("button", {
    name: "Usar código de recuperação",
  });

  await page.keyboard.press("Tab");
  await expect(codeInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(backupButton).toBeFocused();

  await codeInput.fill("000000");
  await confirmButton.click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Não foi possível validar o código" })
  ).toBeVisible();
  await expect(codeInput).toBeFocused();
});

test("student lesson has no moderate or higher accessibility violations", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);

  await assertNoBlockingAccessibilityViolations(page, "student lesson");
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

test("mobile lesson navigation exposes the course outline and locked lessons @mobile-only", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);

  const mobileNavigation = page
    .locator("#main-content")
    .locator("details")
    .filter({ hasText: "Conteúdo do curso" });
  await mobileNavigation.locator("summary").click();
  await expect(mobileNavigation.getByText("Segunda aula")).toBeVisible();
  await expect(
    mobileNavigation.getByText("Libere concluindo a aula anterior")
  ).toBeVisible();
});

test("completion persists and advances to the next lesson", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentForCompletion, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);
  await expect(
    page.getByRole("heading", { name: "Primeira aula" })
  ).toBeVisible();
  const completionButton = page.getByRole("button", {
    name: "Concluir aula e avançar",
  });
  if (await completionButton.isVisible()) {
    await completionButton.click();
  } else {
    await page
      .getByRole("button", { name: "Concluir aula no cabeçalho" })
      .click();
  }
  await expect(page).toHaveURL(
    new RegExp(`/app/aulas/${fixture.course.lessonTwoId}$`)
  );
  await expect(page.getByRole("heading", { name: "Segunda aula" })).toBeVisible(
    { timeout: 15_000 }
  );
});

test("final lesson issues, renders, delivers, and validates a certificate", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const fixture = await readFixture();
  await signIn(page, fixture.studentForCompletion, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.certifiableCourse.lessonId}`);
  await expect(
    page.getByRole("heading", { name: fixture.certifiableCourse.title })
  ).toBeVisible();

  const completionButton = page.getByRole("button", {
    name: "Concluir aula e avançar",
  });
  if (await completionButton.isVisible()) {
    await completionButton.click();
  } else {
    await page
      .getByRole("button", { name: "Concluir aula no cabeçalho" })
      .click();
  }
  await expect(page).toHaveURL(
    new RegExp(
      `/app/cursos/${fixture.certifiableCourse.id}\\?certificate=issued$`
    )
  );
  const completionAlert = page
    .getByRole("alert")
    .filter({ hasText: "Curso concluído" });
  await expect(completionAlert).toContainText("Curso concluído");
  await expect(completionAlert).toContainText(
    "A preparação do PDF pode levar alguns instantes."
  );
  const certificateLink = page.getByRole("link", {
    name: "Ver certificado",
  });
  await expect(certificateLink).toBeVisible();
  const certificateHref = await certificateLink.getAttribute("href");
  const certificateCode = certificateHref?.split("/").at(-1);
  expect(certificateCode).toMatch(CERTIFICATE_CODE_PATTERN);
  if (!certificateCode) {
    throw new Error("Issued certificate link did not expose its public code.");
  }
  await expect(certificateLink).toHaveAttribute(
    "href",
    `/certificados/${certificateCode}`
  );

  await page.goto("/app/certificados");
  const issuedCard = page
    .getByRole("article")
    .filter({ hasText: fixture.certifiableCourse.title });
  await expect(
    issuedCard.getByLabel("Status: Preparando", { exact: true })
  ).toBeVisible();
  await expect(
    issuedCard.getByLabel(CERTIFICATE_CODE_LABEL_PATTERN)
  ).toHaveText(certificateCode);
  const expectedRecipientKey = `sha256:${createHash("sha256")
    .update(fixture.studentForCompletion.email.toLowerCase())
    .digest("hex")}`;
  const isJourneyDelivery = (delivery: Record<string, unknown>): boolean =>
    delivery.recipientKey === expectedRecipientKey &&
    delivery.topic === "email.certificate-issued" &&
    typeof delivery.idempotencyKey === "string" &&
    CERTIFICATE_EMAIL_IDEMPOTENCY_PATTERN.test(delivery.idempotencyKey);

  const readyStatus = issuedCard.getByLabel("Status: Disponível", {
    exact: true,
  });
  await expect
    .poll(
      async () => {
        const cronResponse = await request.get("/api/cron/outbox", {
          headers: { Authorization: "Bearer e2e-cron-secret" },
        });
        expect(cronResponse.status()).toBe(200);
        const sinkResponse = await request.get("/api/e2e/email-deliveries");
        expect(sinkResponse.status()).toBe(200);
        const sinkState = (await sinkResponse.json()) as {
          deliveries: Record<string, unknown>[];
        };
        return (
          (await readyStatus.isVisible()) &&
          sinkState.deliveries.filter(isJourneyDelivery).length === 1
        );
      },
      {
        intervals: [250, 500, 1000, 2000],
        message: "certificate render and email delivery should complete",
        timeout: 25_000,
      }
    )
    .toBe(true);
  await expect(readyStatus).toBeVisible();

  await page.context().clearCookies();
  await page.goto(`/certificados/${certificateCode}`);
  await expect(page.getByText("Certificado válido")).toBeVisible();
  await expect(page.getByText(fixture.certifiableCourse.title)).toBeVisible();
  await expect(page.getByText("Aluna para conclusao")).toBeVisible();
  await expect(page.getByText(certificateCode)).toBeVisible();
  const publicPdfPath = `/certificados/${certificateCode}/pdf`;
  const publicPreviewPath = `/certificados/${certificateCode}/preview`;
  await expect(page.getByAltText("Prévia do certificado")).toHaveAttribute(
    "src",
    publicPreviewPath
  );
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
    "href",
    publicPdfPath
  );

  const downloadResponse = await request.get(publicPdfPath, {
    maxRedirects: 0,
  });
  expect(downloadResponse.status()).toBe(307);
  expect(downloadResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const signedLocation = downloadResponse.headers().location;
  expect(signedLocation).toContain("X-Amz-Signature");
  const pdfResponse = await request.get(signedLocation ?? "");
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

  const previewResponse = await request.get(publicPreviewPath, {
    maxRedirects: 0,
  });
  expect(previewResponse.status()).toBe(307);
  expect(previewResponse.headers()["content-type"]).toContain("image/png");
  const previewLocation = previewResponse.headers().location;
  expect(previewLocation).toContain("X-Amz-Signature");
  const previewArtifactResponse = await request.get(previewLocation ?? "");
  expect(previewArtifactResponse.status()).toBe(200);
  expect(previewArtifactResponse.headers()["content-type"]).toContain(
    "image/png"
  );
  expect(
    (await previewArtifactResponse.body()).subarray(0, 8).toString("hex")
  ).toBe("89504e470d0a1a0a");

  const sinkResponse = await request.get("/api/e2e/email-deliveries");
  expect(sinkResponse.status()).toBe(200);
  const sinkPayload = (await sinkResponse.json()) as {
    deliveries: Record<string, unknown>[];
  };
  const matchingDeliveries = sinkPayload.deliveries.filter(isJourneyDelivery);
  expect(matchingDeliveries).toHaveLength(1);
  const [delivery] = matchingDeliveries;
  expect(delivery).toEqual({
    idempotencyKey: expect.stringMatching(
      CERTIFICATE_EMAIL_IDEMPOTENCY_PATTERN
    ),
    recipientKey: expectedRecipientKey,
    topic: "email.certificate-issued",
  });
  expect(Object.keys(delivery ?? {}).sort()).toEqual([
    "idempotencyKey",
    "recipientKey",
    "topic",
  ]);
  expect(JSON.stringify(delivery)).not.toContain(
    fixture.studentForCompletion.email
  );
  expect(JSON.stringify(delivery)).not.toContain("Aluna para conclusao");
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

test("support navigation and student Sheet preserve the role boundary @mobile", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.support, ADMIN_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Operação de suporte" })
  ).toBeVisible();

  if ((page.viewportSize()?.width ?? 1280) < 768) {
    const menuTrigger = page.getByRole("button", {
      name: "Abrir menu principal",
    });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (
        await menuTrigger.evaluate(
          (element) => element === document.activeElement
        )
      ) {
        break;
      }
      await page.keyboard.press("Tab");
    }
    await expect(menuTrigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Cursos" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menuTrigger).toBeFocused();
    await page.keyboard.press("Enter");
  }

  await expect(page.getByRole("link", { name: "Cursos" })).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Financeiro" })
  ).toBeVisible();
  for (const forbiddenLink of [
    "Aprendizagem",
    "Alunos",
    "Auditoria",
    "Configurações",
  ]) {
    await expect(page.getByRole("link", { name: forbiddenLink })).toHaveCount(
      0
    );
  }

  await page.goto("/admin/cursos");
  await expect(page).toHaveURL(ADMIN_URL_PATTERN);
  await expect(page.getByRole("heading", { name: "Cursos" })).toHaveCount(0);

  await page.goto(`/admin/operacao/cursos/${fixture.course.id}/alunas`);
  const enrollmentRow = page
    .locator("tbody tr")
    .filter({ hasText: fixture.studentWithGrant.email });
  const manageButton = enrollmentRow.getByRole("button", {
    name: "Consultar",
  });
  await manageButton.click();
  const studentSheet = page.getByRole("dialog");
  await expect(studentSheet.getByText("Curso em contexto")).toBeVisible();
  await expect(studentSheet.getByText("Acesso na plataforma")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(studentSheet).toBeHidden();
  await expect(manageButton).toBeFocused();
});

test("refund requires password and explicit destructive confirmation @mobile", async ({
  page,
  request,
}) => {
  const fixture = await readFixture();
  await page.goto(`/comprar/${fixture.course.slug}`);
  await page.waitForURL("http://127.0.0.1:4570/checkout/**");
  const checkoutId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const attemptId = checkoutId.replace(CHECKOUT_ID_PREFIX_PATTERN, "");
  expect(attemptId).toMatch(UUID_PATTERN);
  await sendPaidWebhook({
    attemptId,
    customerId: `cus_e2e_${attemptId}`,
    request,
  });
  await runAsaasWorker(request);

  await page.context().clearCookies();
  await signIn(page, fixture.support, ADMIN_URL_PATTERN);
  await page.goto(`/admin/financeiro?q=${attemptId}`);
  await expect(
    page.getByText(`checkout chk_${attemptId}`, { exact: true }).first()
  ).toBeVisible();
  const refundDisclosure = page
    .getByText("Solicitar estorno integral", { exact: true })
    .first();
  const refundOperation = refundDisclosure.locator("..");
  await expect(refundDisclosure).toBeVisible();
  await refundDisclosure.click();
  await refundOperation
    .getByLabel("Sua senha atual")
    .fill(fixture.support.password);
  await refundOperation
    .getByRole("button", { name: "Confirmar senha" })
    .click();

  await expect(refundOperation.getByLabel("Confirme o pedido")).toBeVisible();
  await expect(refundOperation.getByLabel("Motivo")).toBeVisible();
  const destructiveButton = refundOperation.getByRole("button", {
    name: "Confirmar estorno integral",
  });
  await expect(destructiveButton).toBeVisible();

  let postCount = 0;
  const countPost = (
    browserRequest: import("@playwright/test").Request
  ): void => {
    if (browserRequest.method() === "POST") {
      postCount += 1;
    }
  };
  page.on("request", countPost);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  page.off("request", countPost);
  expect(postCount).toBe(0);
  await expect(destructiveButton).toBeVisible();
});

test("admin crops, saves, and publishes the first certificate template", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto(`/admin/cursos/${fixture.course.id}`);
  await page.getByRole("tab", { name: "Certificado" }).click();

  await expect(page.getByText("Desligado", { exact: true })).toBeVisible();
  const publishButton = page.getByRole("button", {
    name: "Salvar e publicar",
  });
  await expect(publishButton).toBeDisabled();

  await page.locator("#certificate-background").setInputFiles({
    buffer: await createCertificateBackground(),
    mimeType: "image/png",
    name: `certificate-background-${fixture.runId}.png`,
  });
  await expect(
    page.getByRole("dialog", { name: "Ajustar arte do certificado" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Ajustar arte do certificado" })
  ).toBeHidden();
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  await page.locator("#certificate-background").setInputFiles({
    buffer: await createCertificateBackground(),
    mimeType: "image/png",
    name: `certificate-background-${fixture.runId}-retry.png`,
  });
  await expect(
    page.getByRole("dialog", { name: "Ajustar arte do certificado" })
  ).toBeVisible();
  const useCropButton = page.getByRole("button", { name: "Usar recorte" });
  await expect(useCropButton).toBeEnabled();
  await useCropButton.click();

  await expect(
    page.getByRole("dialog", { name: "Ajustar arte do certificado" })
  ).toBeHidden();
  await expect(publishButton).toBeEnabled();
  await publishButton.click();
  await expect(
    page.getByText("Alteracoes salvas e certificado publicado.")
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Ativo", { exact: true })).toBeVisible();

  await assertNoBlockingAccessibilityViolations(
    page,
    "admin certificate editor"
  );
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
  await expect(page.getByText("Certificado válido")).toBeVisible();
  await expect(
    page.getByText(fixture.certificate.ready.courseTitle)
  ).toBeVisible();
  await expect(page.getByText(fixture.studentWithGrant.name)).toBeVisible();
  await expect(page.getByText(fixture.certificate.validCode)).toBeVisible();
  await expect(page.getByText("CPF", { exact: false })).toHaveCount(0);
  await expect(page.getByAltText("Prévia do certificado")).toHaveAttribute(
    "src",
    `/certificados/${fixture.certificate.validCode}/preview`
  );
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
    "href",
    `/certificados/${fixture.certificate.validCode}/pdf`
  );
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();

  for (const certificateState of [
    {
      certificate: fixture.certificate.pending,
      statusLabel: "Certificado em preparação",
    },
    {
      certificate: fixture.certificate.failed,
      statusLabel: "Certificado indisponível",
    },
  ]) {
    await page.goto(`/certificados/${certificateState.certificate.code}`);
    await expect(page.getByText(certificateState.statusLabel)).toBeVisible();
    await expect(
      page.getByText(certificateState.certificate.courseTitle)
    ).toBeVisible();
    await expect(
      page.getByText(certificateState.certificate.code)
    ).toBeVisible();
    await expect(page.getByAltText("Prévia do certificado")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveCount(0);
  }

  await page.goto(`/certificados/${fixture.certificate.revokedCode}`);
  await expect(page.getByText("Certificado revogado")).toBeVisible();
  await expect(
    page.getByText(fixture.certificate.revoked.courseTitle)
  ).toBeVisible();
  await expect(page.getByText(fixture.studentWithGrant.name)).toBeVisible();
  await expect(page.getByText(fixture.certificate.revokedCode)).toBeVisible();
  await expect(
    page.getByText(fixture.certificate.sensitiveSentinel, { exact: false })
  ).toHaveCount(0);
  await expect(page.getByAltText("Prévia do certificado")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveCount(0);
});

test("student certificates expose canonical links and lifecycle states safely @mobile", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto("/app/certificados");

  const pendingCard = page
    .getByRole("article")
    .filter({ hasText: fixture.certificate.pending.code });
  await expect(
    pendingCard.getByLabel("Status: Preparando", { exact: true })
  ).toBeVisible();
  await expect(
    pendingCard.getByRole("link", { name: DOWNLOAD_PDF_PATTERN })
  ).toHaveCount(0);
  await expect(
    pendingCard.getByRole("link", {
      name: fixture.certificate.pending.courseTitle,
    })
  ).toHaveAttribute(
    "href",
    `/certificados/${fixture.certificate.pending.code}`
  );
  await expect(
    pendingCard.getByRole("button", { name: "Copiar link" })
  ).toBeVisible();

  const readyCard = page
    .getByRole("article")
    .filter({ hasText: fixture.certificate.ready.code });
  await expect(
    readyCard.getByLabel("Status: Disponível", { exact: true })
  ).toBeVisible();
  await expect(
    readyCard.getByRole("link", {
      name: `Baixar PDF de ${fixture.certificate.ready.courseTitle}`,
    })
  ).toHaveAttribute(
    "href",
    `/certificados/${fixture.certificate.ready.code}/pdf`
  );
  await expect(
    readyCard.getByRole("link", {
      exact: true,
      name: fixture.certificate.ready.courseTitle,
    })
  ).toHaveAttribute("href", `/certificados/${fixture.certificate.ready.code}`);
  await expect(
    readyCard.getByRole("button", { name: "Copiar link" })
  ).toBeVisible();

  const failedCard = page
    .getByRole("article")
    .filter({ hasText: fixture.certificate.failed.code });
  await expect(
    failedCard.getByLabel("Status: Falha no preparo", { exact: true })
  ).toBeVisible();
  await expect(
    failedCard.getByRole("link", { name: DOWNLOAD_PDF_PATTERN })
  ).toHaveCount(0);
  await expect(
    failedCard.getByRole("link", {
      name: fixture.certificate.failed.courseTitle,
    })
  ).toHaveAttribute("href", `/certificados/${fixture.certificate.failed.code}`);
  await expect(
    failedCard.getByRole("button", { name: "Copiar link" })
  ).toBeVisible();

  const revokedCard = page
    .getByRole("article")
    .filter({ hasText: fixture.certificate.revoked.code });
  await expect(
    revokedCard.getByLabel("Status: Revogado", { exact: true })
  ).toBeVisible();
  await expect(
    revokedCard.getByRole("link", { name: DOWNLOAD_PDF_PATTERN })
  ).toHaveCount(0);
  await expect(
    revokedCard.getByRole("link", {
      name: fixture.certificate.revoked.courseTitle,
    })
  ).toHaveAttribute(
    "href",
    `/certificados/${fixture.certificate.revoked.code}`
  );
  await expect(
    revokedCard.getByRole("button", { name: "Copiar link" })
  ).toBeVisible();

  await assertNoBlockingAccessibilityViolations(page, "student certificates");
});

test("certificate PDF is public only for valid ready records", async ({
  request,
}) => {
  const fixture = await readFixture();
  const downloadPath = `/certificados/${fixture.certificate.ready.code}/pdf`;

  const publicResponse = await request.get(downloadPath, {
    maxRedirects: 0,
  });
  expect(publicResponse.status()).toBe(307);
  expect(publicResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const signedLocation = publicResponse.headers().location;
  expect(signedLocation).toContain("X-Amz-Signature");
  const pdfResponse = await request.get(signedLocation ?? "");
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

  for (const certificate of [
    fixture.certificate.pending,
    fixture.certificate.failed,
    fixture.certificate.revoked,
  ]) {
    const blockedResponse = await request.get(
      `/certificados/${certificate.code}/pdf`,
      { maxRedirects: 0 }
    );
    expect(blockedResponse.status()).toBe(404);
    expect(blockedResponse.headers().location ?? "").not.toContain(
      "X-Amz-Signature"
    );
    expect(blockedResponse.headers()["x-robots-tag"]).toBeUndefined();
  }
});

test("admin sees certificate lifecycle controls in the student Sheet", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto("/admin/alunos");

  const studentRow = page
    .locator("tbody tr")
    .filter({ hasText: fixture.studentWithGrant.email });
  await studentRow.getByRole("button", { name: "Gerenciar" }).click();

  const studentSheet = page.getByRole("dialog");
  await expect(
    studentSheet.getByRole("heading", { name: "Gerenciar aluna" })
  ).toBeVisible();
  await studentSheet.getByRole("tab", { name: "Certificados" }).click();
  await expect(
    studentSheet.getByRole("heading", { name: "Certificados" })
  ).toBeVisible();
  await studentSheet.getByText("Emitir certificado manual").click();
  await expect(
    studentSheet.getByText("Confirmo que revisei os dados")
  ).toBeVisible();
});

test("the removed student detail route is not available", async ({ page }) => {
  const fixture = await readFixture();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);

  const response = await page.request.get(
    `/admin/alunos/${fixture.studentWithGrant.id}`
  );

  expect(response.status()).toBe(404);
});

test("admin manages a student from the course context Sheet", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto(`/admin/cursos/${fixture.course.id}?tab=students`);

  const enrollmentRow = page
    .locator("tbody tr")
    .filter({ hasText: fixture.studentWithGrant.email });
  await enrollmentRow.getByRole("button", { name: "Gerenciar" }).click();

  const studentSheet = page.getByRole("dialog");
  await expect(studentSheet.getByText("Curso em contexto")).toBeVisible();
  await expect(
    studentSheet
      .getByText("Curso em contexto")
      .locator("..")
      .getByText("Curso E2E", { exact: true })
  ).toBeVisible();
  await expect(studentSheet.getByText("Acesso ao Curso")).toBeVisible();
  await expect(studentSheet.getByText("Acesso na plataforma")).toHaveCount(0);
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
  const skipLink = page.getByRole("link", {
    name: "Pular para o conteúdo principal",
  });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
