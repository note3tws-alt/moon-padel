"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="h-display text-3xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-muted">{error.message.includes("DATABASE_URL") ? error.message : "We could not load this page. Please try again."}</p>
      <button onClick={reset} className="btn-primary mt-6">Try again</button>
    </main>
  );
}
