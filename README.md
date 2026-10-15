# arc

A **Devnet Solana cloud wallet** with the **Electric Gaze** animated ASCII background.
Sign up, get a wallet, see live SOL balances, receive via QR, and send SOL — signed server-side.

> ⚠️ **Not audited. Devnet only. Do not use real funds.**
> arc is a *custodial* wallet: the server holds (encrypted) keys and can sign transactions.
> Before supporting real funds you need a security review and production-grade key custody (KMS/HSM). See [Production key management](#production-key-management).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Radix/shadcn-style UI · Zod 4 ·
Prisma 7 + PostgreSQL · `@solana/kit` · Argon2id (`@node-rs/argon2`) · Vitest · pnpm

## Prerequisites

- **Node.js 20.18+** (22 recommended — see `.nvmrc`)
- **pnpm 10** (`corepack enable` or `npm i -g pnpm`)
- A **PostgreSQL** database (local, Neon, Supabase, Railway, Vercel Postgres, …)
- A **Solana Devnet RPC URL** (the public `https://api.devnet.solana.com` works but is rate-limited; Helius/QuickNode/Alchemy free tiers are better)

## Quick start

```bash
pnpm install                 # also runs `prisma generate`
cp .env.example .env.local   # then fill in the values (see below)
pnpm db:deploy               # apply migrations to your database
pnpm dev                     # http://localhost:3000
```

### Environment variables

`.env.example` contains **placeholders only**. Never commit real values; `.env`, `.env.local` and `.env.*.local` are git-ignored.

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public origin of the app (used for CSRF/Origin checks). `http://localhost:3000` locally. |
| `AUTH_SECRET` | ≥ 32 chars. HMAC key for session-token hashes. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `SOLANA_CLUSTER` | `devnet` (default). Mainnet is **refused** unless you also set `ALLOW_MAINNET=true` — don't. |
| `SOLANA_RPC_URL` | Devnet RPC endpoint. May contain an API key; it is server-only and never logged or sent to the browser. |
| `WALLET_ENCRYPTION_KEY` | 32 random bytes as 64 hex chars. **Development-only** master key (see below). |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional. Shared rate limiting for multi-instance deployments. Set both or neither. |

The app validates all variables on first server use (`src/lib/env.ts`) and fails with a clear message naming the offending variable (never its value).

### Generate secrets locally

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32      # WALLET_ENCRYPTION_KEY
```

If you lose `WALLET_ENCRYPTION_KEY`, existing wallets can no longer sign. Back it up (Devnet wallets are disposable, but treat the habit seriously).

## Electric Gaze source image

The background is a faithful Canvas 2D re-implementation of the Electric Gaze effect with the exact configuration from the build prompt
(`src/components/ascii/config.ts` → `ELECTRIC_GAZE_CONFIG`, rendered by `engine.ts`; one fixed canvas mounted once in the root layout).

**The original source image was not accessible when this project was generated**, and inventing a substitute was explicitly ruled out.
So the canvas is transparent until you add the original image:

```
public/images/electric-gaze-source.webp
```

Reference: <https://21st.dev/community/ascii> (source path `/ascii-editor/demos/generated/ref-002.webp`). No code change is needed — reload and the effect appears.
Until then the app is fully usable on a plain dark background (the browser console logs one warning).

Behaviour: `requestAnimationFrame` loop capped at ~30 fps and paused when the tab is hidden · `ResizeObserver` + capped device-pixel-ratio ·
`prefers-reduced-motion` renders a single static frame · pointer events disabled on the canvas · loop cancelled on unmount.

## Database

```bash
pnpm db:deploy      # prisma migrate deploy — applies committed migrations (safe for production)
pnpm db:migrate     # prisma migrate dev — create/apply new migrations in development
pnpm db:validate    # validate the schema
```

Models: `User`, `Session`, `Wallet`, `Transaction` (see `prisma/schema.prisma`). Private keys are stored only as AES-256-GCM ciphertext
plus metadata; sessions store only an HMAC of the token. **Never run `prisma migrate reset` or `db push --force-reset` against a production database.**

Provisioning tip (Neon/Supabase/etc.): create a database, copy its connection string into `DATABASE_URL`, then run `pnpm db:deploy`.

## Solana Devnet

New wallets start at 0 SOL. Copy your address from the dashboard and request test SOL at <https://faucet.solana.com> (choose **Devnet**).

Transfers: amounts are parsed to integer lamports (no floats), checked against balance + fee (5000 lamports), against the rent-exempt minimum, and
sent only after an explicit confirm step. Each send carries an idempotency key, so retries never double-spend. A transaction shows **Pending** until
the RPC reports `confirmed`/`finalized`; failed or expired transactions are marked **Failed** — success is never assumed from "request sent".

## Testing and building

```bash
pnpm lint
pnpm typecheck
pnpm test        # Vitest, RPC mocked — no network or database needed
pnpm build       # prisma generate && next build
```

Test coverage: signup validation, Argon2id hashing, login/session/logout behaviour, unauthorized API access, cross-user wallet isolation,
envelope encryption (tamper/wrong-key/context binding), wallet creation, address validation, lamport conversion, amount validation, RPC-failure handling,
transaction status handling, real keypair generation + transaction signing (RPC faked), CSRF/origin checks, rate limiting, env validation,
and the ASCII renderer (config defaults, lifecycle cleanup, resize, reduced motion).

## Deployment (Vercel or any Node.js host)

1. Provision managed PostgreSQL and a Devnet RPC.
2. Import the repo into Vercel (framework: Next.js; `vercel.json` sets `pnpm install --frozen-lockfile` and `pnpm build`).
3. Add **Production** environment variables (Project → Settings → Environment Variables): `APP_URL` (your https URL), `AUTH_SECRET`, `DATABASE_URL`,
   `SOLANA_CLUSTER=devnet`, `SOLANA_RPC_URL`, `WALLET_ENCRYPTION_KEY`, and — for multiple instances — `UPSTASH_REDIS_REST_URL`/`_TOKEN`.
   Use **fresh** secrets, not your local ones. Don't prefix any of these with `NEXT_PUBLIC_`.
4. Apply migrations once from a trusted machine: `DATABASE_URL=<prod url> pnpm db:deploy` (or run it in CI before deploy).
5. Deploy. Check `GET /api/health` → `{"ok":true,...}`.

Other Node hosts: `pnpm install --frozen-lockfile && pnpm build && pnpm start` behind HTTPS. Session cookies are `Secure` when `NODE_ENV=production`.
No durable state is kept on the local filesystem or in memory except the (optional-to-replace) single-instance rate-limit fallback — set Upstash for multi-instance.

## Logs and troubleshooting

- **Vercel:** Project → Logs, or `vercel logs <deployment-url>`. **Self-hosted:** stdout/stderr of `pnpm start`.
- The app logs only error *names* — never request bodies, keys, tokens, or the RPC URL.
- `Invalid environment configuration: …` → a variable is missing, malformed, or still a `REPLACE_WITH_…` placeholder.
- Balance shows "Could not fetch…" / API `rpc_error` (502) → check `SOLANA_RPC_URL`, rate limits, or try another provider.
- `Cross-site request rejected` (403) → `APP_URL` doesn't match the origin you're browsing (scheme, host, port must match exactly).
- `prisma generate` fails offline → it downloads engine binaries from `binaries.prisma.sh`; run it on a machine with network access.
- Blank background → add the source image (see above).

## Security model

- **Passwords:** Argon2id (19 MiB, t=2, p=1); login does a dummy hash for unknown users and returns one generic error.
- **Sessions:** random 256-bit token in an `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie; only an HMAC of it is stored; 7-day expiry; sign-out deletes it server-side.
- **CSRF:** SameSite cookie + required matching `Origin`/`Referer` + JSON-only bodies on every mutation.
- **Authorization:** every wallet/transaction query is scoped by the authenticated user's id in the data layer; others get an identical 404.
- **Rate limiting:** sign-up, sign-in (per IP and per account), wallet creation, and transaction submission.
- **Keys:** generated server-side, envelope-encrypted (per-wallet AES-256-GCM data key, wrapped by a master key, wallet address bound as AAD), never sent to the client, never logged, decrypted only to sign, and zeroed afterwards.
- **Headers:** `nosniff`, `X-Frame-Options: DENY`, strict referrer policy.

### Production key management

`WALLET_ENCRYPTION_KEY` in an environment variable is a **development-only** master key: anyone who can read your environment and database can steal every wallet.
The `KeyWrapper` interface in `src/lib/crypto/wallet-crypto.ts` is the seam for a KMS/HSM (AWS KMS, GCP KMS, HashiCorp Vault): implement `wrap`/`unwrap` for the 32-byte
data key and change `getKeyWrapper()` in `src/lib/solana/wallet.ts`. For real funds, additionally obtain an independent security review and consider specialist custody or a non-custodial design.
**This Devnet starter has not undergone a security audit and must not be described as safe for real funds.** Mainnet is disabled by default and requires deliberate configuration.

## API

All responses: `{ "ok": true, "data": … }` or `{ "ok": false, "error": { "code", "message", "details?" } }`. Lamports are strings.

| Method & path | Auth | Description |
| --- | --- | --- |
| `POST /api/v1/signup` · `signin` · `signout` | – / – / ✓ | Account + session |
| `GET /api/v1/me` | ✓ | Current user |
| `GET/POST /api/v1/wallets` | ✓ | List / create wallet |
| `GET /api/v1/wallets/[id]` | ✓ | One wallet (public data only) |
| `GET /api/v1/wallets/[id]/balance` | ✓ | Live balance via RPC |
| `GET/POST /api/v1/transactions` | ✓ | History / send SOL (`confirmed: true` + `idempotencyKey` required) |
| `GET /api/v1/transactions/[signature]` | ✓ | Details; refreshes pending status from RPC |
| `GET /api/health` | – | Liveness (reveals no configuration) |

## Project layout

```
src/app/                 pages + route handlers (api/v1/*, api/health)
src/components/ascii/    Electric Gaze: config.ts · helpers.ts · engine.ts · AsciiBackground.tsx
src/components/{auth,wallet,transactions,brand,ui}/
src/lib/{auth,crypto,db,solana}/ · env.ts · api.ts · rate-limit.ts · validation*.ts
src/server/{services,repositories}/   business logic / data access (server-only)
prisma/                  schema + migrations
tests/                   Vitest suites
```

## License

MIT — see `LICENSE`.
