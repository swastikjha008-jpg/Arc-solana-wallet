"use client";

import { ArrowUpRight } from "lucide-react";
import { lamportsToSol } from "@/lib/crypto/lamports";
import type { TransactionDto } from "@/lib/client/api";
import { shortAddress } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

export function TransactionList({ items, loading, onSelect }: { items: TransactionDto[]; loading: boolean; onSelect: (t: TransactionDto) => void }) {
  if (loading && items.length === 0) return <p className="py-6 text-center text-sm text-slate-400" role="status">Loading transactions…</p>;
  if (items.length === 0) return <p className="py-6 text-center text-sm text-slate-400">No transactions yet. Fund your wallet from the Devnet faucet, then send some SOL.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {items.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => onSelect(t)} className="flex w-full cursor-pointer items-center justify-between gap-3 py-3 text-left hover:bg-white/5">
            <span className="flex min-w-0 items-center gap-3">
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#3ca6ff]" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm text-white">Sent to {shortAddress(t.destinationAddress)}</span>
                <span className="block font-mono text-[11px] text-slate-500">{new Date(t.createdAt).toLocaleString()}</span>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-sm text-white">−{lamportsToSol(BigInt(t.amountLamports))} SOL</span>
              <StatusBadge status={t.status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
