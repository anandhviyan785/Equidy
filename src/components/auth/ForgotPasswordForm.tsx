import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth";
import { validateAuthForm } from "@/lib/authValidation";
import { FormAlert, TextField } from "./AuthFields";

/** Asks for an email and sends a reset link. Shows the same confirmation whether or not the email has an account. */
export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validateAuthForm({ mode: "forgot", name: "", email, password: "" });
    setFieldError(errors.email);
    if (errors.email) return;
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-7">
      <FormAlert message={error} />
      {sent ? (
        <FormAlert tone="info" message={`If an account exists for ${email.trim()}, we've sent a link to reset your password. It expires in 1 hour.`} />
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <TextField id="reset-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={fieldError} />
          <button className="btn-primary h-11 w-full text-[15px]" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Send reset link
          </button>
        </form>
      )}
      <button type="button" onClick={onBack} className="mt-5 text-sm text-blue-500 hover:underline dark:text-blue-400">
        Back to sign in
      </button>
    </div>
  );
}
