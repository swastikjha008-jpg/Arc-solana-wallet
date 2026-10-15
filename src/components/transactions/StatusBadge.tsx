import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { TxStatus } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const MAP: Record<TxStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  PENDING: { label: "Pending", cls: "border-amber-400/40 text-amber-200", Icon: Clock },
  CONFIRMED: { label: "Confirmed", cls: "border-emerald-400/40 text-emerald-200", Icon: CheckCircle2 },
  FINALIZED: { label: "Finalized", cls: "border-emerald-400/60 text-emerald-100", Icon: CheckCircle2 },
  FAILED: { label: "Failed", cls: "border-red-400/40 text-red-200", Icon: XCircle },
};

export function StatusBadge({ status }: { status: TxStatus }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border bg-black/40 px-2 py-0.5 font-mono text-[11px]", cls)}>
      <Icon className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}
