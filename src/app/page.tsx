import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { NetworkBadge } from "@/components/brand/NetworkBadge";

export default function Landing() {
  return (
    <>
      <SiteHeader><NetworkBadge /></SiteHeader>
      <main className="flex min-h-screen flex-col items-start justify-center px-6 sm:px-16">
        <div className="surface max-w-xl p-6 sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#3ca6ff]">Solana cloud wallet</p>
          <h1 className="mt-3 font-mono text-5xl font-semibold tracking-tight text-white sm:text-6xl">arc</h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Create a Solana wallet in seconds, check live balances, and send SOL — all from your browser.
            Running on Devnet with test funds only.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/signup">Create wallet</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
          </div>
          <p className="mt-6 font-mono text-[11px] leading-relaxed text-slate-500">
            Custodial Devnet starter · not audited · do not use real funds
          </p>
        </div>
      </main>
    </>
  );
}
