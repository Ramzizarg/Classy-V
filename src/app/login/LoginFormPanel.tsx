"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type LoginFormPanelProps = {
  hasError: boolean;
};

export function LoginFormPanel({ hasError }: LoginFormPanelProps) {
  const [showPassword, setShowPassword] = useState(false);

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
          <label htmlFor="password" className="ui-sm text-muted">
            Password
          </label>
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

        <button
          type="submit"
          className="btn mt-2 h-12 w-full !border-black !bg-black !text-white hover:!bg-zinc-800 hover:!text-white sm:h-auto sm:py-[11px]"
        >
          Sign in
        </button>
      </form>
    </section>
  );
}
