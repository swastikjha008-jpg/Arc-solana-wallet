"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ClientApiError, type TransactionDto, type WalletDto } from "@/lib/client/api";
import { lamportsToSol, solToLamports } from "@/lib/crypto/lamports";
import { BASE58_RE } from "@/lib/utils";

const FEE_LAMPORTS = 5000n; // keep in sync with BASE_FEE_LAMPORTS on the server

export function SendDialog({ wallet, balanceLamports, open, onOpenChange, onSent, onSettled }: {
  wallet: WalletDto; balanceLamports: bigint | null; open: boolean; onOpenChange: (o: boolean) => void; onSent: (tx: TransactionDto) => void;
  /** Called after every submit attempt (success or error) so history reflects any pending transaction. */
  onSettled?: () => void;
}) {
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TransactionDto | null>(null);
  const [key, setKey] = useState<string>("");

  function reset() { setStep("form"); setTo(""); setAmount(""); setErrors({}); setServerError(null); setBusy(false); setResult(null); }
  function close(o: boolean) { onOpenChange(o); if (!o) setTimeout(reset, 200); }

  function review(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const dest = to.trim();
    if (!BASE58_RE.test(dest)) next.to = "Enter a valid Solana address";
    else if (dest === wallet.publicAddress) next.to = "Destination must differ from this wallet";
    const lamports = solToLamports(amount);
    if (lamports === null) next.amount = "Enter a positive amount with at most 9 decimals";
    else if (balanceLamports !== null && lamports + FEE_LAMPORTS > balanceLamports) next.amount = "Insufficient balance (amount plus network fee)";
    setErrors(next);
    if (next.to || next.amount) return;
    setKey(crypto.randomUUID()); // one key per reviewed send: retries of this exact send can never double-spend
    setServerError(null);
    setStep("confirm");
  }

  async function submit() {
    setBusy(true); setServerError(null);
    try {
      const { transaction } = await api<{ transaction: TransactionDto }>("/api/v1/transactions", {
        method: "POST",
        body: { sourceWalletId: wallet.id, destinationAddress: to.trim(), amountSol: amount.trim(), idempotencyKey: key, confirmed: true },
      });
      setResult(transaction); setStep("done"); onSent(transaction);
    } catch (e) {
      setServerError(e instanceof ClientApiError ? e.error.message : "Something went wrong.");
    } finally { setBusy(false); onSettled?.(); }
  }

  const lamports = solToLamports(amount);
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={step === "done" ? "Transaction submitted" : "Send SOL"} description={step === "form" ? "Devnet only. Transfers are signed by the server after you confirm." : undefined}>
        {step === "form" && (
          <form onSubmit={review} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="to">Recipient address</Label>
              <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana public address" autoComplete="off" spellCheck={false} aria-invalid={!!errors.to} />
              {errors.to && <p role="alert" className="text-xs text-red-300">{errors.to}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (SOL)</Label>
              <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.0" autoComplete="off" aria-invalid={!!errors.amount} />
              {errors.amount && <p role="alert" className="text-xs text-red-300">{errors.amount}</p>}
              <p className="font-mono text-[11px] text-slate-500">
                Network fee ≈ {lamportsToSol(FEE_LAMPORTS)} SOL{balanceLamports !== null && <> · Balance {lamportsToSol(balanceLamports)} SOL</>}
              </p>
            </div>
            <Button type="submit" className="w-full">Review</Button>
          </form>
        )}
        {step === "confirm" && lamports !== null && (
          <div className="space-y-4">
            <dl className="space-y-3 rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-sm">
              <div><dt className="text-[11px] uppercase text-slate-500">Send</dt><dd className="text-white">{lamportsToSol(lamports)} SOL</dd></div>
              <div><dt className="text-[11px] uppercase text-slate-500">To</dt><dd className="break-all text-slate-200">{to.trim()}</dd></div>
              <div><dt className="text-[11px] uppercase text-slate-500">Estimated fee</dt><dd className="text-slate-200">{lamportsToSol(FEE_LAMPORTS)} SOL</dd></div>
              <div><dt className="text-[11px] uppercase text-slate-500">Total</dt><dd className="text-white">{lamportsToSol(lamports + FEE_LAMPORTS)} SOL</dd></div>
            </dl>
            {serverError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{serverError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("form")} disabled={busy}>Back</Button>
              <Button className="flex-1" onClick={submit} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Confirm &amp; send
              </Button>
            </div>
          </div>
        )}
        {step === "done" && result && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300" role="status">
              {result.status === "PENDING" ? "Submitted to Devnet. It is still pending — status will update on your dashboard." :
               result.status === "FAILED" ? `The transaction failed. ${result.failureReason ?? ""}` : "Confirmed on Devnet."}
            </p>
            {result.signature && <p className="break-all font-mono text-xs text-slate-400">{result.signature}</p>}
            <Button className="w-full" onClick={() => close(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
