"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

type LoginFormPanelProps = {
  hasError: boolean;
};

type Mode = "login" | "forgot" | "forgot-sent";

export function LoginFormPanel({ hasError }: LoginFormPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setForgotBusy(true);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; error?: string; resetUrl?: string }
        | null;
      if (!res.ok) {
        setForgotError(data?.error || "Could not send the reset email.");
        return;
      }
      if (data?.resetUrl) {
        window.location.assign(data.resetUrl);
        return;
      }
      setForgotMessage(data?.message || "Check your inbox for a reset link.");
      setMode("forgot-sent");
    } catch {
      setForgotError("Connection lost. Try again.");
    } finally {
      setForgotBusy(false);
    }
  }

  if (mode === "forgot" || mode === "forgot-sent") {
    return (
      <section className="mx-auto w-full max-w-md text-center lg:mx-0 lg:max-w-sm lg:text-left">
        <p className="ui-sm text-muted">Back office</p>
        <h1 className="mt-2 text-[22px] font-normal uppercase leading-tight tracking-[0.14em] sm:text-[26px] lg:text-[18px] lg:tracking-[0.12em]">
          Forgot password
        </h1>
        <p className="prose-raw mt-3 text-muted lg:max-w-sm">
          Enter your back office email. We will send a link to choose a new password.
        </p>

        {forgotError ? (
          <p
            className="ui-sm mt-5 border border-danger px-3 py-2.5 text-left text-danger"
            role="alert"
          >
            {forgotError}
          </p>
        ) : null}

        {mode === "forgot-sent" && forgotMessage ? (
          <p
            className="ui-sm mt-5 border border-line px-3 py-2.5 text-left text-foreground"
            role="status"
          >
            {forgotMessage}
          </p>
        ) : null}

        {mode === "forgot" ? (
          <form onSubmit={submitForgot} className="mt-8 space-y-5 text-left">
            <label className="block">
              <span className="ui-sm text-muted">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                className="field mt-1.5 h-11 text-[16px] tracking-normal sm:h-10 sm:text-[11px] sm:tracking-[0.04em]"
              />
            </label>

            <button
              type="submit"
              disabled={forgotBusy}
              aria-busy={forgotBusy}
              className="btn btn--solid mt-2 h-12 w-full sm:h-auto sm:py-[11px]"
            >
              {forgotBusy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="btn btn--solid mt-8 h-12 w-full sm:h-auto sm:py-[11px]"
            onClick={() => {
              setMode("forgot");
              setForgotError("");
              setForgotMessage("");
            }}
          >
            Send another link
          </button>
        )}

        <button
          type="button"
          className="ui-sm mt-5 text-muted hover-underline"
          onClick={() => {
            setMode("login");
            setForgotError("");
            setForgotMessage("");
          }}
        >
          Back to sign in
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md text-center lg:mx-0 lg:max-w-sm lg:text-left">
      <p className="ui-sm text-muted">Back office</p>
      <h1 className="mt-2 text-[22px] font-normal uppercase leading-tight tracking-[0.14em] sm:text-[26px] lg:text-[18px] lg:tracking-[0.12em]">
        Login
      </h1>
      <p className="prose-raw mt-3 text-muted lg:max-w-sm">
        Sign in to manage orders.
      </p>

      {hasError ? (
        <p
          className="ui-sm mt-5 border border-danger px-3 py-2.5 text-left text-danger"
          role="alert"
        >
          Invalid email or password.
        </p>
      ) : null}

      <form action="/api/admin/login" method="POST" className="mt-8 space-y-5 text-left">
        <label className="block">
          <span className="ui-sm text-muted">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            className="field mt-1.5 h-11 text-[16px] tracking-normal sm:h-10 sm:text-[11px] sm:tracking-[0.04em]"
          />
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="ui-sm text-muted">
              Password
            </label>
            <button
              type="button"
              className="ui-sm text-muted hover-underline"
              onClick={() => setMode("forgot")}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
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

        <button type="submit" className="btn btn--solid mt-2 h-12 w-full sm:h-auto sm:py-[11px]">
          Sign in
        </button>
      </form>
    </section>
  );
}
