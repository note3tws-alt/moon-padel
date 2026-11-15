"use client";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type State = { ok?: boolean; message?: string; error?: string } | null;

/** Small form wrapper for the player area: shows the action's message inline. */
export function StateForm({ action, children, className, encType }: { action: (prev: State, fd: FormData) => Promise<State>; children: ReactNode; className?: string; encType?: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className} encType={encType}>
      {children}
      {state?.error && <p className="mt-3 rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-[#f2a08c]" role="alert">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-3 rounded-xl border border-electric/30 bg-court/20 px-3 py-2 text-sm text-ice" role="status">{state.message}</p>}
    </form>
  );
}

export function Submit({ children, pendingText = "Saving…", className = "btn-primary" }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? pendingText : children}</button>;
}
