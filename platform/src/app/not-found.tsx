import Link from "next/link";
import { MoonMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center">
      <MoonMark size={96} phase="crescent" glow />
      <h1 className="h-display mt-8 text-4xl">Off the court</h1>
      <p className="mt-3 text-muted">We could not find that page, player or tournament.</p>
      <Link href="/" className="btn-primary mt-8">Back home</Link>
    </main>
  );
}
