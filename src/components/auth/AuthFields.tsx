import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/format";

/** Inline message under a field, announced to screen readers. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1.5 text-xs text-down">{message}</p>;
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "email";
  autoComplete?: string;
}

export function TextField({ id, label, value, onChange, error, type = "text", autoComplete }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">{label}</label>
      <input
        id={id}
        type={type}
        className={cn("input h-11", error && "border-down/60")}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface PasswordFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  labelAction?: ReactNode;
}

export function PasswordField({ id = "password", label = "Password", value, onChange, error, autoComplete, hint, labelAction }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="label block">{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          className={cn("input h-11 pr-11", error && "border-down/60")}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function FormAlert({ message, tone = "error" }: { message: string | null; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mt-6 rounded-xl border px-3.5 py-2.5 text-sm",
        tone === "error" ? "border-down/40 bg-down/10 text-down" : "border-line bg-elevated/60 text-fg",
      )}
    >
      {message}
    </div>
  );
}
