"use client";
import { useActionState } from "react";
import { sendEmailLink, verifyEmailCode, type EmailState } from "./actions";

export function EmailLoginForm({ next }: { next: string }) {
  const [sendState, send, sending] = useActionState<EmailState, FormData>(sendEmailLink, null);
  const [codeState, verify, verifying] = useActionState<EmailState, FormData>(verifyEmailCode, null);
  const sent = sendState?.sent;
  const email = sendState?.email ?? "";

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-electric/30 bg-court/20 p-4 text-sm">
          <p className="font-bold text-white">Check your inbox</p>
          <p className="mt-1 text-muted">We sent a sign-in link to <span className="text-silver">{email}</span>. Open it on this device to sign in. It can take a minute, so check spam too.</p>
        </div>
        <form action={verify} className="space-y-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="field-label">Got a code instead?</span>
            <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" placeholder="6-digit code" className="input tracking-[0.3em]" />
          </label>
          {codeState?.error && <p className="text-sm text-[#f2a08c]" role="alert">{codeState.error}</p>}
          <button className="btn-ghost w-full" disabled={verifying}>{verifying ? "Checking…" : "Sign in with code"}</button>
        </form>
        <form action={send}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <button className="w-full text-center text-xs font-semibold uppercase tracking-wider text-muted hover:text-silver" disabled={sending}>{sending ? "Sending…" : "Send the email again"}</button>
        </form>
      </div>
    );
  }

  return (
    <form action={send} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="field-label">Email</span>
        <input name="email" type="email" autoComplete="email" required defaultValue={email} placeholder="you@example.com" className="input" />
      </label>
      {sendState?.error && <p className="text-sm text-[#f2a08c]" role="alert">{sendState.error}</p>}
      <button className="btn-primary w-full" disabled={sending}>{sending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
