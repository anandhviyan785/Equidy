export type AuthFormMode = "signin" | "signup" | "forgot" | "reset";

export interface AuthFormInput {
  mode: AuthFormMode;
  name: string;
  email: string;
  password: string;
}

export type AuthFieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export const MIN_PASSWORD_LENGTH = 8;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(value) || value.length > MAX_EMAIL_LENGTH) return "Enter a valid email address.";
  return undefined;
}

function passwordError(password: string, isNew: boolean): string | undefined {
  if (!password) return isNew ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : "Enter your password.";
  if (isNew && password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return undefined;
}

/** Mirrors the server's checks so mistakes show beside the field before anything is sent. */
export function validateAuthForm({ mode, name, email, password }: AuthFormInput): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (mode === "signup" && !name.trim()) errors.name = "Enter your name.";
  if (mode !== "reset") {
    const e = emailError(email);
    if (e) errors.email = e;
  }
  if (mode !== "forgot") {
    const p = passwordError(password, mode === "signup" || mode === "reset");
    if (p) errors.password = p;
  }
  return errors;
}
