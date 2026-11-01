# NovaWallet

A professional, **non-custodial** multi-chain wallet dashboard with an email-OTP login and a **support/security-only admin panel**.

> **Security model:** NovaWallet never has a seed-phrase or private-key field. Keys stay inside the user's own wallet (MetaMask, Trust Wallet, WalletConnect). The admin can manage accounts, tickets and security review — but can never see keys, balances, or move funds.

## Features

- Email OTP sign-in (passwordless, single-use codes)
- Multi-chain EVM balances via public RPC: Ethereum, BNB Chain, Polygon, Arbitrum, Base
- Native + USDT / USDC / DAI balances
- Watch-only BTC (mempool.space) and SOL (public RPC) lookups
- Send flow signed inside the user's wallet (native + ERC-20)
- Optional **withdrawal lock**: wallet signature + fresh email code before sending
- Wallet ownership verification (sign a message)
- Support tickets with admin replies
- Security audit log
- Admin console: users, suspend/unsuspend, tickets, audit trail (no custody)
- Row Level Security (RLS) enforced in Postgres

## Stack

Vite · React · TypeScript · Tailwind CSS · wagmi/viem · Supabase (Auth + Postgres) · Vercel

## 1. Supabase setup

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Providers → Email**: keep Email enabled.
4. **Authentication → Email Templates → Magic Link**: make sure the body contains the 6-digit token:
   ```html
   <p>Your NovaWallet code is: <strong>{{ .Token }}</strong></p>
   ```
   (Without `{{ .Token }}` the email only contains a magic link.)
5. **Authentication → URL Configuration**: add your deployed URL (e.g. `https://your-app.vercel.app`) to **Site URL** and **Redirect URLs**.
6. Copy **Project URL** and **anon public key** from **Settings → API**.
7. Make yourself admin (replace the email):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

## 2. WalletConnect (optional but recommended for mobile)

Create a project at <https://cloud.reown.com> and copy the Project ID.
Without it, the app still works with injected wallets (MetaMask etc.).

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

This is enforced by Postgres RLS and by the fact that the app has no key material at all.

## Project structure

```
src/
  components/   Layout, WalletButton, ChainCard, BtcCard, SolCard, SendPanel, guards
  context/      AuthContext (Supabase session + profile)
  lib/          supabase client, wagmi config, chain/token map, audit, format
  pages/        Landing, Login, Dashboard, Security, Support, Admin
supabase/
  schema.sql    tables, RLS, admin guards, triggers
```

## License

MIT — use it, fork it, ship it.
