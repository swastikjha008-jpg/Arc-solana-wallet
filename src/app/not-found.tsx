import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="surface max-w-sm space-y-4 p-6 text-center">
        <h1 className="font-mono text-lg text-white">404 — not found</h1>
        <Button asChild><Link href="/">Back home</Link></Button>
      </div>
    </main>
  );
}
