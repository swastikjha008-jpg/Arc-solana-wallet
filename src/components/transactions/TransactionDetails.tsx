"use client";

import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { lamportsToSol } from "@/lib/crypto/lamports";
import type { TransactionDto } from "@/lib/client/api";
import { StatusBadge } from "./StatusBadge";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (<div><dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="mt-0.5 break-all font-mono text-sm text-slate-100">{children}</dd></div>);
}

export function TransactionDetails({ tx, onClose }: { tx: TransactionDto | null; onClose: () => void }) {
  const explorer = tx?.signature ? `https://explorer.solana.com/tx/${tx.signature}?cluster=${tx.networkOrCluster}` : null;
  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      {tx && (
        <DialogContent title="Transaction details">
          <dl className="space-y-4">
            <Row k="Status"><StatusBadge status={tx.status} /></Row>
            {tx.failureReason && <Row k="Reason">{tx.failureReason}</Row>}
            <Row k="Amount">{lamportsToSol(BigInt(tx.amountLamports))} SOL</Row>
            {tx.feeLamports && <Row k="Estimated fee">{lamportsToSol(BigInt(tx.feeLamports))} SOL</Row>}
            <Row k="From">{tx.sourceWallet.publicAddress}</Row>
            <Row k="Destination">{tx.destinationAddress}</Row>
            <Row k="Signature">{tx.signature ?? "Not submitted"}</Row>
            <Row k="Created">{new Date(tx.createdAt).toLocaleString()}</Row>
            <Row k="Last updated">{new Date(tx.updatedAt).toLocaleString()}</Row>
          </dl>
          {explorer && (
            <a href={explorer} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 font-mono text-sm text-[#3ca6ff] hover:underline">
              View on Solana Explorer ({tx.networkOrCluster}) <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
