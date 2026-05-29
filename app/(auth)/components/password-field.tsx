"use client";

import { useState } from "react";

type PasswordFieldProps = {
  autoComplete: string;
  minLength?: number;
};

export function PasswordField({ autoComplete, minLength }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium text-slate-200"
        htmlFor="password"
      >
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={isVisible ? "text" : "password"}
          placeholder="Enter password"
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="h-12 w-full rounded-lg border border-white/10 bg-white/10 px-4 pr-12 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:bg-white/[0.14] focus:ring-4 focus:ring-cyan-300/10"
        />
        <button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          onClick={() => setIsVisible((value) => !value)}
          className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
        >
          {isVisible ? (
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="m3 3 18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5.5 0 9 5 9 8a7.4 7.4 0 0 1-1.7 3.6" />
              <path d="M6.5 6.5C4.3 8 3 10.2 3 12c0 3 3.5 8 9 8a9.8 9.8 0 0 0 4.2-.9" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
