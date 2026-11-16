"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <section className="mx-auto w-full max-w-md text-center lg:mx-0 lg:max-w-sm lg:text-left">
        <p className="ui-sm text-muted">Back office</p>
        <h1 className="mt-2 text-[22px] font-normal uppercase leading-tight tracking-[0.14em] sm:text-[26px] lg:text-[18px] lg:tracking-[0.12em]">
          Reset password
        </h1>
        <p className="ui-sm mt-5 border border-danger px-3 py-2.5 text-left text-danger" role="alert">
          This reset link is missing or incomplete. Request a new one from the login page.
        </p>
        <a href="/login" className="btn btn--solid mt-8 inline-flex h-12 w-full items-center justify-center sm:h-auto sm:py-[11px]">
          Back to sign in
        </a>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error || "Could not update password.");
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push("/login"), 1600);
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md text-center lg:mx-0 lg:max-w-sm lg:text-left">
      <p className="ui-sm text-muted">Back office</p>
      <h1 className="mt-2 text-[22px] font-normal uppercase leading-tight tracking-[0.14em] sm:text-[26px] lg:text-[18px] lg:tracking-[0.12em]">
        New password
      </h1>
      <p className="prose-raw mt-3 text-muted lg:max-w-sm">
        Choose a new password for your back office account.
      </p>

      {error ? (
        <p
          className="ui-sm mt-5 border border-danger px-3 py-2.5 text-left text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="ui-sm mt-5 border border-line px-3 py-2.5 text-left" role="status">
          Password updated. Redirecting to sign in…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5 text-left">
          <div>
            <label htmlFor="new-password" className="ui-sm text-muted">
              New password
            </label>
            <div className="relative mt-1.5">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field h-11 w-full pr-12 text-[16px] tracking-normal sm:h-10 sm:pr-9 sm:text-[11px] sm:tracking-[0.04em]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted transition hover:text-foreground sm:h-10 sm:w-9"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="block">
            <span className="ui-sm text-muted">Confirm password</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="field mt-1.5 h-11 text-[16px] tracking-normal sm:h-10 sm:text-[11px] sm:tracking-[0.04em]"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="btn btn--solid mt-2 h-12 w-full sm:h-auto sm:py-[11px]"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </section>
  );
}
