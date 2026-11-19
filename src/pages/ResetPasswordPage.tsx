import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, validateAuthForm } from "@/lib/authValidation";
import { useThemeSync } from "@/hooks";
import { Logo } from "@/components/ui";
import { FormAlert, PasswordField } from "@/components/auth/AuthFields";

/** Opened from the emailed reset link: choose a new password, then go straight into the app. */
export function ResetPasswordPage() {
  useThemeSync();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get("token") ?? "", [location.search]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(token ? null : "This reset link is incomplete. Request a new one from the sign-in page.");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const next = {
      password: validateAuthForm({ mode: "reset", name: "", email: "", password }).password,
      confirm: confirm !== password ? "The passwords don't match." : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    try {
      await resetPassword(token, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-bg px-6 py-8 sm:px-10">
      <Logo className="self-start" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 animate-fade-up">
        <h1 className="text-balance text-3xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-[15px] text-muted">You'll be signed in once it's saved, and signed out on your other devices.</p>
        <FormAlert message={error} />
        {token && (
          <form onSubmit={submit} className="mt-7 space-y-3" noValidate>
            <PasswordField id="new-password" label="New password" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
            <PasswordField id="confirm-password" label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
            <button className="btn-primary h-11 w-full text-[15px]" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save new password
            </button>
          </form>
        )}
        <Link to="/login" className="mt-6 text-sm text-blue-500 hover:underline dark:text-blue-400">Back to sign in</Link>
      </div>
    </div>
  );
}
