"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, LogOut, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetworkBadge } from "@/components/brand/NetworkBadge";
import { TransactionDetails } from "@/components/transactions/TransactionDetails";
import { TransactionList } from "@/components/transactions/TransactionList";
import { api, ClientApiError, type TransactionDto, type WalletDto } from "@/lib/client/api";
import { lamportsToSol } from "@/lib/crypto/lamports";
import { cn, shortAddress } from "@/lib/utils";
import { CopyButton } from "./CopyButton";
import { ReceiveDialog } from "./ReceiveDialog";
import { SendDialog } from "./SendDialog";

export function Dashboard({ username, cluster }: { username: string; cluster: string }) {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Balance is keyed by wallet id, so switching wallets never shows a stale value and needs no reset-in-effect.
  const [balanceEntry, setBalanceEntry] = useState<{ id: string; value: bigint } | null>(null);
  const [balanceErrorId, setBalanceErrorId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [txs, setTxs] = useState<TransactionDto[] | null>(null); // null = still loading
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [detail, setDetail] = useState<TransactionDto | null>(null);
  const txsRef = useRef<TransactionDto[] | null>(null);
  useEffect(() => { txsRef.current = txs; }, [txs]);

  const handleAuth = useCallback((e: unknown) => {
    if (e instanceof ClientApiError && e.status === 401) { router.replace("/login"); return true; }
    return false;
  }, [router]);

  const loadWallets = useCallback(async () => {
    try {
      let { wallets: list } = await api<{ wallets: WalletDto[] }>("/api/v1/wallets");
      if (list.length === 0) list = [(await api<{ wallet: WalletDto }>("/api/v1/wallets", { method: "POST", body: { label: "Main" } })).wallet];
      setWallets(list);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
      setError(null);
    } catch (e) { if (!handleAuth(e)) setError(e instanceof ClientApiError ? e.error.message : "Could not load wallets."); }
  }, [handleAuth]);

  const loadTxs = useCallback(async () => {
    try {
      const { transactions } = await api<{ transactions: TransactionDto[] }>("/api/v1/transactions");
      setTxs(transactions);
    } catch (e) {
      handleAuth(e);
      setTxs((cur) => cur ?? []);
    }
  }, [handleAuth]);

  const loadBalance = useCallback(async (id: string) => {
    try {
      const r = await api<{ lamports: string }>(`/api/v1/wallets/${id}/balance`);
      setBalanceEntry({ id, value: BigInt(r.lamports) });
      setBalanceErrorId(null);
    } catch (e) { if (!handleAuth(e)) setBalanceErrorId(id); }
  }, [handleAuth]);

  async function refreshBalance(id: string) {
    setRefreshing(true);
    await loadBalance(id);
    setRefreshing(false);
  }

  // Fetch-on-mount: every setState in these loaders runs after an `await`, never synchronously in the effect body.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadWallets(); void loadTxs(); }, [loadWallets, loadTxs]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- same fetch-on-change pattern; state is set after the await
  useEffect(() => { if (selectedId) void loadBalance(selectedId); }, [selectedId, loadBalance]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      if (txsRef.current?.some((x) => x.status === "PENDING")) void loadTxs();
    }, 4000);
    return () => clearInterval(t);
  }, [loadTxs]);

  async function createWallet() {
    setCreating(true); setError(null);
    try {
      const { wallet } = await api<{ wallet: WalletDto }>("/api/v1/wallets", { method: "POST", body: { label: `Wallet ${(wallets?.length ?? 0) + 1}` } });
      setWallets((w) => [...(w ?? []), wallet]); setSelectedId(wallet.id);
    } catch (e) { if (!handleAuth(e)) setError(e instanceof ClientApiError ? e.error.message : "Could not create wallet."); }
    finally { setCreating(false); }
  }

  async function logout() {
    try { await api("/api/v1/signout", { method: "POST", body: {} }); } catch { /* cookie may already be gone */ }
    router.replace("/login"); router.refresh();
  }

  const wallet = wallets?.find((w) => w.id === selectedId) ?? null;
  const walletTxs = (txs ?? []).filter((t) => t.sourceWallet.id === selectedId);
  const balance = balanceEntry && balanceEntry.id === selectedId ? balanceEntry.value : null;
  const balanceError = balanceErrorId !== null && balanceErrorId === selectedId;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-xl text-white">Hi, {username}</h1>
          <NetworkBadge cluster={cluster} />
        </div>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" aria-hidden /> Log out</Button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {!wallets ? (
        <div className="surface flex items-center gap-3 p-8 text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Setting up your wallet…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="surface p-4" aria-label="Wallets">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-wider text-slate-400">Wallets</h2>
              <Button size="sm" variant="outline" onClick={createWallet} disabled={creating}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />} New
              </Button>
            </div>
            <ul className="space-y-1">
              {wallets.map((w) => (
                <li key={w.id}>
                  <button type="button" onClick={() => setSelectedId(w.id)} aria-current={w.id === selectedId}
                    className={cn("w-full cursor-pointer rounded-lg border px-3 py-2 text-left font-mono text-sm", w.id === selectedId ? "border-[#3ca6ff]/60 bg-[#3ca6ff]/10 text-white" : "border-transparent text-slate-300 hover:bg-white/5")}>
                    <span className="block">{w.label}</span>
                    <span className="block text-[11px] text-slate-500">{shortAddress(w.publicAddress)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="space-y-6">
            {wallet && (
              <div className="surface p-5 sm:p-6">
                <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Balance</p>
                <div className="mt-1 flex items-center gap-3">
                  <p className="font-mono text-4xl font-semibold text-white" aria-live="polite">
                    {balance !== null ? lamportsToSol(balance) : balanceError ? "—" : "…"} <span className="text-lg text-[#3ca6ff]">SOL</span>
                  </p>
                  <Button variant="ghost" size="sm" aria-label="Refresh balance" onClick={() => refreshBalance(wallet.id)} disabled={refreshing}>
                    <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
                  </Button>
                </div>
                {balanceError && <p role="alert" className="mt-2 text-sm text-red-300">Could not fetch the balance from the Solana RPC. Try refreshing.</p>}
                <p className="mt-4 break-all font-mono text-xs text-slate-300">{wallet.publicAddress}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <CopyButton value={wallet.publicAddress} label="Copy address" />
                  <Button onClick={() => setSendOpen(true)}><ArrowUpRight className="h-4 w-4" aria-hidden /> Send</Button>
                  <Button variant="outline" onClick={() => setReceiveOpen(true)}><ArrowDownLeft className="h-4 w-4" aria-hidden /> Receive</Button>
                </div>
                <p className="mt-4 font-mono text-[11px] text-slate-500">New wallets start at 0 SOL. Get free Devnet SOL from faucet.solana.com using your address.</p>
              </div>
            )}

            <div className="surface p-5 sm:p-6">
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-400">Recent transactions</h2>
              <TransactionList items={walletTxs} loading={txs === null} onSelect={setDetail} />
            </div>
          </section>
        </div>
      )}

      {wallet && (
        <>
          <SendDialog wallet={wallet} balanceLamports={balance} open={sendOpen} onOpenChange={setSendOpen} onSettled={() => void loadTxs()}
            onSent={(tx) => { setTxs((t) => [tx, ...(t ?? []).filter((x) => x.id !== tx.id)]); void loadBalance(wallet.id); void loadTxs(); }} />
          <ReceiveDialog address={wallet.publicAddress} open={receiveOpen} onOpenChange={setReceiveOpen} />
        </>
      )}
      <TransactionDetails tx={detail} onClose={() => setDetail(null)} />
    </main>
  );
}
