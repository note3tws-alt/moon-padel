"use client";
import { useActionState, useTransition } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, actionPending] = useActionState(login, null);
  const [transitionPending, start] = useTransition();
  const pending = actionPending || transitionPending;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => action(fd)); }}
    >
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <div><label className="field-label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="input" /></div>
      <div><label className="field-label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      {state?.error && <p className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-[#f2a08c]" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
