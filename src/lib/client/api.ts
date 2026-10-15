export interface ApiFailure { code: string; message: string; details?: Record<string, string> }
export class ClientApiError extends Error {
  constructor(public status: number, public error: ApiFailure) { super(error.message); }
}

/** Typed fetch for the arc API. Cookies are HttpOnly, so no credentials are ever handled in JS. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ClientApiError(0, { code: "network", message: "Network error. Check your connection and try again." });
  }
  let json: { ok: boolean; data?: T; error?: ApiFailure } | null = null;
  try { json = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok || !json?.ok) throw new ClientApiError(res.status, json?.error ?? { code: "unknown", message: "Unexpected server response" });
  return json.data as T;
}

export interface WalletDto { id: string; label: string; publicAddress: string; networkOrCluster: string; createdAt: string }
export type TxStatus = "PENDING" | "CONFIRMED" | "FINALIZED" | "FAILED";
export interface TransactionDto {
  id: string; signature: string | null; destinationAddress: string; amountLamports: string; feeLamports: string | null;
  networkOrCluster: string; status: TxStatus; failureReason: string | null; createdAt: string; updatedAt: string;
  sourceWallet: { id: string; label: string; publicAddress: string };
}
