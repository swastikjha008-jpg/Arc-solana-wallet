"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CopyButton } from "./CopyButton";

export function ReceiveDialog({ address, open, onOpenChange }: { address: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    import("qrcode")
      .then((m) => m.toDataURL(address, { margin: 1, width: 224, color: { dark: "#05060a", light: "#ffffff" } }))
      .then((url) => { if (!cancelled) { setQr(url); setQrFailed(false); } })
      .catch(() => { if (!cancelled) setQrFailed(true); });
    return () => { cancelled = true; };
  }, [open, address]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Receive SOL" description="Send Devnet SOL to this address. Do not send real funds.">
        <div className="flex flex-col items-center gap-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for your wallet address" width={224} height={224} className="rounded-lg" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-white/10 text-xs text-slate-400" role="status">
              {qrFailed ? "QR unavailable — copy the address below" : "Generating QR…"}
            </div>
          )}
          <p className="break-all text-center font-mono text-xs text-slate-200">{address}</p>
          <CopyButton value={address} label="Copy address" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
