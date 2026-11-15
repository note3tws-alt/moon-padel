export default function Loading() {
  return (
    <main className="container-page py-12" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
      <div className="mt-4 h-12 w-72 animate-pulse rounded bg-white/5" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/[0.03]" />)}
      </div>
    </main>
  );
}
