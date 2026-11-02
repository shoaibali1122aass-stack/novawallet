# NovaWallet

A professional, **non-custodial** multi-chain wallet dashboard with an email-OTP login and a **support/security-only admin panel**.

> **Security model:** External wallet keys stay inside the user's own wallet (MetaMask, Trust Wallet, Coinbase Wallet). NovaWallet also offers an **optional local EVM wallet**: its recovery phrase or private key is encrypted on-device with AES-GCM + PBKDF2 (210k iterations) and is never sent to our servers, logs or database. The admin can manage accounts, tickets and security review — but can never see keys, balances, or move funds.

## Features

- Email OTP sign-in (passwordless, single-use codes)
- Multi-chain EVM balances via public RPC: Ethereum, BNB Chain, Polygon, Arbitrum, Base
- Native + USDT / USDC / DAI balances
- Watch-only BTC (mempool.space, Blockstream fallback) and SOL (public RPC fallback) lookups
- Watch-only EVM address tracking for any `0x` address
- Create or import a local EVM wallet, encrypted on-device; unlock, connect, sign and send
- Mobile wallet deep links (MetaMask, Trust Wallet, Coinbase Wallet)
- Dedicated **Deposit** page (per-network receive address, token contracts, BTC/SOL watch-only cards)
- Dedicated **Withdraw** page with the send flow signed inside the user's wallet (native + ERC-20) and an in-app network switcher
- **Swap** page using the LI.FI aggregator, signed in the user's wallet (with token approval handling)
- Wallet, watch addresses and withdrawal authorization are stored **per signed-in account** on the device
- In-app notification bell + toasts for detected deposits and submitted/confirmed withdrawals and swaps
- Dashboard quick actions for Deposit, Withdraw and Swap
- Optional **withdrawal lock**: wallet signature + fresh email code before sending
- Wallet ownership verification (sign a message)
- Support tickets with admin replies
- Security audit log
- Admin console: users, suspend/unsuspend, tickets, audit trail (no custody)
- Row Level Security (RLS) enforced in Postgres

> **Sending scope:** EVM networks only (Ethereum, BNB Chain, Polygon, Arbitrum, Base). BTC and SOL are watch-only; withdraw from the wallet that controls those addresses.

> **Local wallet safety:** The recovery phrase is shown once at creation. Back it up offline. The encryption password cannot be recovered by NovaWallet. Removing the local wallet without a backup permanently loses access. Never share the phrase with anyone, including support.

## Stack

Vite · React · TypeScript · Tailwind CSS · wagmi/viem · Supabase (Auth + Postgres) · Vercel

## 1. Supabase setup

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql), then [`supabase/otp_rpc.sql`](supabase/otp_rpc.sql).
3. **Authentication → Providers → Email**: keep Email enabled.
4. **Email OTP delivery** (the app does not rely on Supabase email templates):
   - Store the service-role key and a GitHub token in Vault:
     ```sql
     select vault.create_secret('<service_role_key>', 'nova_service_role_key');
     select vault.create_secret('<github_token_with_repo_scope>', 'nova_github_token');
     ```
   - Add repository secrets `MAIL_USER` and `MAIL_PASS` (Gmail app password) in GitHub → Settings → Secrets and variables → Actions.
   - The workflow [`.github/workflows/send-otp.yml`](.github/workflows/send-otp.yml) emails the 8-digit code on the `send-otp` repository-dispatch event.
5. **Authentication → URL Configuration**: add your deployed URL (e.g. `https://your-app.vercel.app`) to **Site URL** and **Redirect URLs**.
6. Copy **Project URL** and **anon public key** from **Settings → API**.
7. Make yourself admin (replace the email):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

## 2. WalletConnect (optional)

Create a project at <https://cloud.reown.com>, copy the Project ID and set `VITE_WALLETCONNECT_PROJECT_ID`.
Without it, the app works with injected wallets and mobile deep links (MetaMask, Trust Wallet, Coinbase Wallet).
Watch-only address tracking works with no wallet extension at all.

## 2b. Configure without redeploying (runtime setup)

If you deploy without `VITE_SUPABASE_*` env vars, the site stays up but auth is disabled.
Open **`/setup`** on the deployed site and paste:

- **Project URL** — `https://xxxx.supabase.co`
- **Anon public key** — Project Settings → API → `anon public` (or the new `publishable` key)

It is stored only in that browser's `localStorage` (the anon key is public by design).
The app never accepts a `service_role` / secret key. This is the fastest way to unblock
sign-in when you cannot edit Vercel env vars immediately.

## 3. Local development

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_WALLETCONNECT_PROJECT_ID
npm install
npm run dev
```

Open <http://localhost:5173>.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "NovaWallet: non-custodial wallet + support admin panel"
git branch -M main
git remote add origin https://github.com/<your-username>/novawallet.git
git push -u origin main
```

Create the empty repository first on GitHub (no README, no .gitignore).

## 5. Deploy to Vercel

1. Go to <https://vercel.com/new> and import the GitHub repository.
2. Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WALLETCONNECT_PROJECT_ID`
4. Deploy. Then add the Vercel domain to Supabase → Authentication → URL Configuration.
5. Sign in with your email, then run the admin SQL from step 1.7.

`vercel.json` already contains the SPA rewrite so client-side routes work.

## What the admin can and cannot do

| Can | Cannot |
| --- | --- |
| View users, roles, join dates | View seed phrases or private keys |
| Suspend / unsuspend accounts | Access wallet funds |
| Read and reply to tickets | Approve or move user funds |
| Review the security audit log | Sign transactions on behalf of users |

This is enforced by Postgres RLS and by keeping all key material client-side: external keys stay in the user's wallet and a local wallet secret is encrypted in the browser before storage. The database and admin panel never receive it.

## Project structure

```
src/
  components/   Layout, WalletButton, LocalWalletCard, ChainCard, WatchWalletCard, BtcCard, SolCard, SendPanel, guards
  context/      AuthContext (Supabase session + profile)
  lib/          supabase client, wagmi config, local wallet keystore/connector, chain/token map, audit, format
  pages/        Landing, Login, Dashboard, Deposit, Withdraw, Security, Support, Admin
supabase/
  schema.sql    tables, RLS, admin guards, triggers
  otp_rpc.sql   rate-limited request_login_code() + otp_requests table
.github/
  workflows/send-otp.yml   Gmail SMTP delivery of the 8-digit code
```

## License

MIT — use it, fork it, ship it.
