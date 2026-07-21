import { z } from "zod";

const requiredString = (message: string) => z.string().trim().min(1, message);

const privacyRequestSchema = z.object({
  reason: requiredString("Informe o motivo da solicitacao de privacidade."),
  userId: requiredString("Informe a aluna."),
});

const privacyRequestIdentifierSchema = z.object({
  requestId: requiredString("Informe a solicitacao de privacidade."),
});

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "");

export const parseRegisterPrivacyRequestInput = (formData: FormData) =>
  privacyRequestSchema.parse({
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  });

export const parsePrivacyRequestIdentifierInput = (formData: FormData) =>
  privacyRequestIdentifierSchema.parse({
    requestId: readString(formData, "requestId"),
  });
