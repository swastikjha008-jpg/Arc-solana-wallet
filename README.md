<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:050810,50:0969DA,100:38BDF8&height=240&section=header&text=arc&fontSize=90&fontColor=FFFFFF&fontAlignY=38&desc=SOLANA%20CLOUD%20WALLET&descSize=18&descColor=93C5FD&descAlignY=60" alt="arc banner" width="100%"/>

<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=3200&pause=900&color=38BDF8&center=true&vCenter=true&width=640&lines=Create+a+Solana+wallet+in+seconds;Check+live+SOL+balances;Send+SOL+on+Devnet;Blue+by+design.+Built+for+Devnet." alt="Typing animation" />
</a>

<br/>

A modern, dark-themed **custodial cloud wallet** for creating wallets, checking live SOL balances, and sending transactions on **Solana Devnet**, wrapped in a minimal interface with an electric-blue identity and a distinctive ASCII-art background.

<br/>

![Solana](https://img.shields.io/badge/Solana-Devnet-0B1220?style=for-the-badge&logo=solana&logoColor=38BDF8&labelColor=050810&color=0969DA)
![Next.js](https://img.shields.io/badge/Next.js-16-0B1220?style=for-the-badge&logo=nextdotjs&logoColor=38BDF8&labelColor=050810&color=0969DA)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-0B1220?style=for-the-badge&logo=typescript&logoColor=38BDF8&labelColor=050810&color=0969DA)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-0B1220?style=for-the-badge&logo=postgresql&logoColor=38BDF8&labelColor=050810&color=0969DA)

<br/>

**[Features](#-features)** &nbsp;·&nbsp; **[Use Cases](#-what-can-you-use-arc-for)** &nbsp;·&nbsp; **[Tech Stack](#-tech-stack)** &nbsp;·&nbsp; **[How It Works](#%EF%B8%8F-how-it-works)** &nbsp;·&nbsp; **[Getting Started](#-getting-started)** &nbsp;·&nbsp; **[Security](#-security)**

</div>

<br/>

> [!WARNING]
> **Devnet only.** Arc is an experimental, unaudited, custodial wallet intended for development and testing. Never use it to store real SOL, mainnet assets, or valuable funds.

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## ✦ About Arc

**Arc** is a Solana cloud wallet project built to explore the fundamentals of blockchain wallets through a clean, accessible web interface.

Instead of requiring a browser wallet extension, Arc offers a browser-based experience for creating and accessing a custodial wallet, checking balances, and sending SOL on Devnet. It combines modern web development with Solana integration, database persistence, and server-side wallet functionality.

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## ⚡ Features

| | Feature | Description |
|:-:|---|---|
| 🔑 | **Create Wallet** | Start a custodial wallet flow directly from the browser. |
| 🚪 | **Sign In** | Access your wallet through the application's sign-in flow. |
| 💎 | **SOL Balance** | Check live balances via the configured Solana RPC endpoint. |
| 📤 | **Send SOL** | Test SOL transfers on Solana Devnet. |
| ☁️ | **Cloud Database** | Persist application data with PostgreSQL and Prisma. |
| 🛡️ | **Wallet Encryption** | Protect wallet data with a dedicated encryption key. |
| 🧪 | **Devnet Integration** | Experiment with test SOL instead of real funds. |
| 🌌 | **Electric Gaze Background** | A distinctive ASCII-art visual effect on the landing page. |
| 🎨 | **Modern Interface** | Dark surfaces, electric-blue accents, minimal wallet UX. |

<sub>Availability of individual flows depends on the current implementation and configuration.</sub>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🎯 What Can You Use Arc For?

Arc is a learning and experimentation project. Here are practical ways to use it:

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>01 · Learn Solana Development</h3>
      See how a web app talks to Solana, requests account balances, and submits transactions through an RPC endpoint.
    </td>
    <td width="50%" valign="top">
      <h3>02 · Explore Wallet Architecture</h3>
      Understand custodial wallets, wallet creation, encrypted key handling, and how a frontend relates to a backend.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>03 · Practice Web3 Full-Stack</h3>
      Use Arc as a reference for combining React, TypeScript, PostgreSQL, and blockchain functionality.
    </td>
    <td width="50%" valign="top">
      <h3>04 · Test Transactions Safely</h3>
      Experiment with Devnet SOL, inspect transaction signatures, and verify activity on a blockchain explorer.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>05 · Build Your Own Wallet</h3>
      Fork the repo and extend it with transaction history, address management, token balances, or richer dashboards.
    </td>
    <td width="50%" valign="top">
      <h3>06 · Demos & Hackathons</h3>
      Run it locally, showcase your Web3 skills, or adapt it for a learning exercise or hackathon prototype.
    </td>
  </tr>
</table>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🧰 Tech Stack

<div align="center">

| Layer | Technologies |
|:-:|:-:|
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js-0B1220?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=0B1220&color=0969DA) ![React](https://img.shields.io/badge/React-0B1220?style=for-the-badge&logo=react&logoColor=38BDF8&labelColor=0B1220&color=0969DA) ![TypeScript](https://img.shields.io/badge/TypeScript-0B1220?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0B1220&color=0969DA) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0B1220?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8&labelColor=0B1220&color=0969DA) |
| **Database** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-0B1220?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=0B1220&color=0969DA) ![Prisma](https://img.shields.io/badge/Prisma-0B1220?style=for-the-badge&logo=prisma&logoColor=white&labelColor=0B1220&color=0969DA) ![Neon](https://img.shields.io/badge/Neon-0B1220?style=for-the-badge&logo=neon&logoColor=38BDF8&labelColor=0B1220&color=0969DA) |
| **Blockchain** | ![Solana](https://img.shields.io/badge/Solana_Devnet-0B1220?style=for-the-badge&logo=solana&logoColor=38BDF8&labelColor=0B1220&color=0969DA) ![Web3](https://img.shields.io/badge/Web3-0B1220?style=for-the-badge&logoColor=white&labelColor=0B1220&color=0969DA) |
| **Tooling** | ![pnpm](https://img.shields.io/badge/pnpm-0B1220?style=for-the-badge&logo=pnpm&logoColor=white&labelColor=0B1220&color=0969DA) ![ESLint](https://img.shields.io/badge/ESLint-0B1220?style=for-the-badge&logo=eslint&logoColor=38BDF8&labelColor=0B1220&color=0969DA) ![Docker](https://img.shields.io/badge/Docker-0B1220?style=for-the-badge&logo=docker&logoColor=38BDF8&labelColor=0B1220&color=0969DA) |

</div>

**Runtime:** Node.js 20.18+ &nbsp;·&nbsp; **Package manager:** pnpm

<sub>Refer to `package.json` for exact versions. Docker is optional and not required for the local setup below.</sub>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🏗️ How It Works

```text
┌────────────────────────────────────┐
│            Arc Frontend            │
│   Next.js + React + TypeScript     │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│        Application Backend         │
│    Wallet logic and data access    │
└────────┬──────────────────┬────────┘
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │  Solana Devnet  │
│   via Prisma    │  │     RPC API     │
└─────────────────┘  └─────────────────┘
```

| Component | Role |
|---|---|
| **Frontend** | Displays the wallet experience and accepts user interactions. |
| **Backend** | Handles application operations and wallet-related logic. |
| **PostgreSQL** | Stores application data according to the Prisma schema. |
| **Solana RPC** | Provides blockchain data and transaction submission. |
| **Wallet encryption** | Uses a dedicated environment variable for the configured encryption mechanism. |

<sub>This diagram is conceptual and does not represent every request or internal module.</sub>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.18 or newer
- [pnpm](https://pnpm.io/installation)
- A PostgreSQL database, such as [Neon](https://neon.tech/)
- A Solana Devnet RPC endpoint
- Git and a code editor such as VS Code

### 1 · Clone the repository

Replace the URL with your actual GitHub repository URL.

```bash
git clone https://github.com/YOUR_USERNAME/arc-solana-wallet.git
cd arc-solana-wallet
```

### 2 · Install dependencies

```bash
pnpm install
```

### 3 · Create your environment files

Copy the example file to `.env.local` for the application.

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**

```bash
cp .env.example .env.local
```

The database migration command also reads variables from `.env`. After filling in `.env.local`, create a matching `.env`:

```powershell
Copy-Item .env.local .env
```

> [!NOTE]
> If `.env` already exists, update it with the correct values instead of overwriting other settings.

### 4 · Configure environment variables

Set these values in `.env.local`, and make sure the same values are available in `.env` for Prisma.

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000

AUTH_SECRET=replace_with_a_generated_secret

DATABASE_URL="your_postgresql_connection_string"

SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

WALLET_ENCRYPTION_KEY=replace_with_64_hex_characters

# Optional: Upstash Redis REST credentials
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

**Generate `AUTH_SECRET`**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**Generate `WALLET_ENCRYPTION_KEY`**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This produces a 32-byte key as 64 hexadecimal characters.

> [!CAUTION]
> Use the same encryption key consistently. Changing it may make previously encrypted wallet data inaccessible. Never commit real secrets or connection strings.

### 5 · Configure PostgreSQL

Create a database through Neon or use an existing PostgreSQL instance, then paste the connection string into `DATABASE_URL` in both `.env` and `.env.local`. Verify that the database and branch exist, the credentials are correct, and the connection works with Prisma.

### 6 · Apply database migrations

```bash
pnpm db:deploy
```

A successful run reports that all migrations have been applied.

### 7 · Start the development server

```bash
pnpm dev
```

Open **http://localhost:3000**. If the port is taken, Next.js may use another one (such as `3001`), so use the URL printed in your terminal.

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🌌 Electric Gaze Background

Arc renders an ASCII-art effect as its landing page background. Place the source image at:

```text
public/
└── images/
    └── electric-gaze-source.webp
```

- The filename must match **exactly**.
- The image must genuinely be encoded as **WebP**. Renaming another format's extension is not enough.
- If the background stays blank, confirm the file exists at this path, make sure you're using the original source image, and refresh the app.

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🧪 Development Commands

Run these from the repository root.

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm db:deploy` | Apply database migrations |
| `pnpm test` | Run the project's tests |
| `pnpm lint` | Check code quality and lint rules |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm build` | Build the application for production |

<sub>Optional checks depend on the scripts defined in `package.json`.</sub>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🔐 Security

Wallet software demands care. Arc is a learning and testing project, and the app itself identifies as a custodial, unaudited Devnet starter.

- 🧪 **Use Devnet only.** No real funds or mainnet assets.
- 🙈 **Never commit secrets.** Make sure `.env`, `.env.local`, and any credential files are in `.gitignore`.
- 🔑 **Protect the encryption key.** Back it up securely and don't rotate it without a plan for existing encrypted data.
- 🗄️ **Protect your database.** Keep PostgreSQL credentials private and use scoped access.
- 🔍 **A working demo is not an audit.** Authentication, sessions, wallet creation, encryption, and transaction authorization need review before any production use.
- ♻️ **Rotate exposed credentials.** If secrets are ever published by accident, replace them immediately.

Arc should not be considered production-ready just because the app starts or a Devnet transaction succeeds.

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:050810,50:0969DA,100:38BDF8&height=2" width="100%"/>

## 🤝 Contributing

Contributions, suggestions, bug reports, and ideas are welcome.

1. **Fork** the repository
2. **Create** a feature branch
3. **Make and test** your changes
4. **Commit** with a clear message
5. **Open** a pull request describing the change

Please don't include secrets, credentials, private keys, or real user data in issues or pull requests.

## 📄 License

See the repository's `LICENSE` file for the applicable license and terms.

<br/>

<div align="center">

### Built to explore the Solana ecosystem.

[![Explore Solana Devnet](https://img.shields.io/badge/Explore-Solana_Devnet-0B1220?style=for-the-badge&logo=solana&logoColor=38BDF8&labelColor=050810&color=0969DA)](https://explorer.solana.com/?cluster=devnet)

<sub>**arc** · Blue by design. Built for Devnet.<br/>An experimental Web3 project for learning, testing, and building.</sub>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:38BDF8,50:0969DA,100:050810&height=120&section=footer" alt="footer" width="100%"/>

</div>
