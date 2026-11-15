"use client";
import { createContext, useActionState, useContext, useEffect, useRef, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "./toast";

type State = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; data?: unknown } | null;
type Action = (prev: State, fd: FormData) => Promise<State>;

const PendingContext = createContext(false);

export function ActionForm({ action, children, className, resetOnSuccess, redirectTo, confirm, onSuccessRefresh = true }: {
  action: Action; children: ReactNode; className?: string; resetOnSuccess?: boolean; redirectTo?: string; confirm?: string; onSuccessRefresh?: boolean;
}) {
  const [state, formAction, actionPending] = useActionState(action, null);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved", "success");
      if (resetOnSuccess) ref.current?.reset();
      if (redirectTo) router.push(redirectTo);
      else if (onSuccessRefresh) router.refresh();
    } else if (state.error) toast(state.error, "error");
  }, [state, resetOnSuccess, redirectTo, router, onSuccessRefresh]);
  return (
    <form
      ref={ref}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        // Submit manually so React does not reset the fields: on an error the admin keeps what they typed.
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter ?? undefined);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state?.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-loss/30 bg-loss/10 p-3 text-xs text-[#f2a08c]">
          {Object.entries(state.fieldErrors).map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}
        </ul>
      )}
    </form>
  );
}

export function SubmitButton({ children, className, pendingText = "Saving…", variant = "primary" }: { children: ReactNode; className?: string; pendingText?: string; variant?: "primary" | "ghost" | "danger" }) {
  const ctxPending = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctxPending || formPending;
  return (
    <button type="submit" disabled={pending} className={cn(variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-ghost", className)}>
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}
