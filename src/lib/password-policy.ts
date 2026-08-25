export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_LENGTH_MESSAGE =
  "Use uma senha com pelo menos 8 caracteres.";
export const PASSWORD_CONFIRMATION_MESSAGE = "As senhas precisam ser iguais.";
export const AUTH_PASSWORD_POLICY = {
  minPasswordLength: PASSWORD_MIN_LENGTH,
  resetPasswordTokenExpiresIn: 3600,
  revokeSessionsOnPasswordReset: true,
} as const;

export const getNewPasswordValidationError = ({
  confirmation,
  password,
}: {
  confirmation: string;
  password: string;
}): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_MIN_LENGTH_MESSAGE;
  }
  if (password !== confirmation) {
    return PASSWORD_CONFIRMATION_MESSAGE;
  }
  return null;
};
