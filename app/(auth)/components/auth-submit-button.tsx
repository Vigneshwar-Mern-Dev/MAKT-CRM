"use client";

import { useFormStatus } from "react-dom";

type AuthSubmitButtonProps = {
  idleText: string;
  pendingText: string;
};

export function AuthSubmitButton({
  idleText,
  pendingText,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-200 px-4 font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus:ring-4 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-75"
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950"
          />
        ) : null}
        {pending ? pendingText : idleText}
      </button>

      {pending ? (
        <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-center text-sm text-cyan-100">
          Processing securely. Do not refresh this page.
        </p>
      ) : null}
    </div>
  );
}
