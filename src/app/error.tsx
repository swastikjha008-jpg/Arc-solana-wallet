"use client";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="surface max-w-sm space-y-4 p-6 text-center">
        <h1 className="font-mono text-lg text-white">Something went wrong</h1>
        <p className="text-sm text-slate-400">The page failed to load. If this persists, check the server configuration (see README).</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
