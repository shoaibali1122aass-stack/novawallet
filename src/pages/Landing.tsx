import { Link, Navigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { APP_VERSION } from '../lib/version'

const coins = [
  { sym: 'BTC', name: 'Bitcoin', color: '#f7931a', amount: '0.8421 BTC' },
  { sym: 'ETH', name: 'Ethereum', color: '#627eea', amount: '12.405 ETH' },
  { sym: 'USDT', name: 'Tether', color: '#26a17b', amount: '8,240.00 USDT' },
  { sym: 'BNB', name: 'BNB Chain', color: '#f3ba2f', amount: '32.10 BNB' },
  { sym: 'SOL', name: 'Solana', color: '#9945ff', amount: '410.55 SOL' },
  { sym: 'USDC', name: 'USD Coin', color: '#2775ca', amount: '3,120.00 USDC' },
]

const features = [
  {
    title: 'Truly self-custody',
    body: 'Connect MetaMask, Trust Wallet or Coinbase Wallet, create an encrypted local wallet, or track any address in watch-only mode. Keys never leave your control or reach our servers.',
    icon: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    ),
  },
  {
    title: 'Multi-chain balances',
    body: 'One dashboard for Bitcoin, Ethereum, BNB Chain, Polygon, Arbitrum, Base, Solana and major stablecoins.',
    icon: <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />,
  },
  {
    title: 'Email OTP sign-in',
    body: 'Passwordless verification codes with strict rate limits, short expiry and single-use tokens. No passwords to leak.',
    icon: <path d="M4 4h16v16H4zM22 6l-10 7L2 6" />,
  },
  {
    title: 'Withdrawal lock',
    body: 'Optionally require a wallet signature plus a fresh email code before any outgoing transfer is prepared.',
    icon: <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  },
  {
    title: 'Support-only admin',
    body: 'Administrators manage accounts, security reviews and support tickets. They can never touch funds or keys.',
    icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  },
  {
    title: 'Audit trail',
    body: 'Every sign-in, wallet link and withdrawal authorization is logged so suspicious activity is easy to review.',
    icon: <path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />,
  },
]

const steps = [
  { n: '01', t: 'Create your account', d: 'Sign in with an email code. No password, and no wallet keys are stored on our side.' },
  {
    n: '02',
    t: 'Connect or track a wallet',
    d: 'Use MetaMask, Trust Wallet or Coinbase Wallet, create a local encrypted wallet, or add any address in watch-only mode.',
  },
  {
    n: '03',
    t: 'Track & transact',
    d: 'See every balance in one view and send EVM assets only after you approve in your own wallet.',
  },
]

export default function Landing() {
  const { session, loading } = useAuth()

  if (!loading && session) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="grid-glow">
        <header className="container-x flex h-20 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-400 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#networks" className="hover:text-white">Networks</a>
            <a href="#security" className="hover:text-white">Security</a>
            <a href="#how" className="hover:text-white">How it works</a>
          </nav>
          <div className="flex items-center gap-3">
            {session ? (
              <Link to="/dashboard" className="btn-primary">Open wallet</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
                <Link to="/login" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
        </header>

        <section className="container-x grid items-center gap-12 pb-24 pt-10 lg:grid-cols-2 lg:pt-16">
          <div>
            <span className="badge border-accent-500/30 bg-accent-500/10 text-accent-400">
              <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-accent-400" />
              Non-custodial · Secrets encrypted on-device
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Every coin.
              <br />
              One secure <span className="text-gradient">wallet.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
              NovaWallet is a modern multi-chain portfolio for Bitcoin, Ethereum, USDT, BNB, Solana and more. Connect
              your own wallet, watch your balances, and approve every transfer yourself.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={session ? '/dashboard' : '/login'} className="btn-primary px-6 py-3 text-base">
                {session ? 'Open my wallet' : 'Start free'}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#security" className="btn-secondary px-6 py-3 text-base">How we stay safe</a>
            </div>
            <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
              {[
                { to: '/deposit', t: 'Deposit', d: 'Get your address' },
                { to: '/withdraw', t: 'Withdraw', d: 'Send from your wallet' },
                { to: '/swap', t: 'Swap', d: 'Exchange tokens' },
              ].map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-brand-500/40 hover:bg-brand-500/10"
                >
                  <span className="block text-sm font-bold text-white">{a.t}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{a.d}</span>
                </Link>
              ))}
            </div>

            <div className="mt-6 grid max-w-lg grid-cols-3 gap-4">
              {[
                ['6+', 'Networks'],
                ['0', 'Keys stored'],
                ['2FA', 'Email + wallet'],
              ].map(([k, v]) => (
                <div key={v} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-xl font-black text-white">{k}</p>
                  <p className="text-xs text-slate-500">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-brand-500/20 via-transparent to-accent-500/20 blur-2xl" />
            <div className="card relative animate-float p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Total portfolio</p>
                  <p className="mt-1 text-3xl font-black text-white">$48,392.18</p>
                  <p className="mt-1 text-xs font-semibold text-accent-400">+3.42% this week</p>
                </div>
                <span className="badge border-accent-500/30 bg-accent-500/10 text-accent-400">Live</span>
              </div>

              <div className="mt-4 flex h-24 items-end gap-1.5">
                {[38, 52, 44, 66, 58, 74, 62, 80, 70, 88, 76, 94, 84, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-brand-500/30 to-accent-500/70"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="mt-5 space-y-1">
                {coins.slice(0, 4).map((c) => (
                  <div key={c.sym} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-white/5">
                    <span className="flex items-center gap-3">
                      <span
                        className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: c.color + '26', border: `1px solid ${c.color}66` }}
                      >
                        {c.sym}
                      </span>
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-300">{c.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="networks" className="border-y border-white/5 bg-ink-900/40 py-8">
        <div className="container-x flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Supported networks</span>
          {coins.map((c) => (
            <span key={c.sym} className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="container-x py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Built for real security</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Everything you need. Nothing you have to trust us with.
          </h2>
          <p className="mt-4 text-slate-400">
            NovaWallet is a viewing and signing layer. Your wallet does the signing, and a local wallet secret is encrypted in your browser before it is stored.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card card-hover p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-base font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="container-x pb-24">
        <div className="card overflow-hidden">
          <div className="grid gap-8 p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-400">Security model</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
                We will never ask for your recovery phrase.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                If any site asks for your 12 or 24 words, it is trying to steal your funds. Connect a wallet you
                already control, or create/import a local wallet whose secret is encrypted on this device. Never
                share your recovery phrase with anyone, including support.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Optional encrypted local wallet', 'Secrets never sent to servers', 'No custodial balances', 'Open audit log'].map((t) => (
                  <span key={t} className="badge border-accent-500/30 bg-accent-500/10 text-accent-400">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Wallet signature', 'Every outbound transfer is signed on your device.'],
                ['Email OTP', 'Single-use codes with short expiry and strict rate limits.'],
                ['Withdrawal lock', 'Optional second factor before preparing a transfer.'],
                ['Support-only admin', 'Admins manage accounts, not money.'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-white/5 bg-ink-900/60 p-4">
                  <p className="text-sm font-semibold text-white">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-white/5 bg-ink-900/30 py-24">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Up and running in minutes</h2>
            <p className="mt-4 text-slate-400">No downloads, no custody risk.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="card card-hover relative p-6">
                <span className="text-4xl font-black text-white/10">{s.n}</span>
                <h3 className="mt-2 text-base font-bold text-white">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-24">
        <div className="card relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-accent-500/10" />
          <div className="relative">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Your keys. Your coins. Your call.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Start tracking your portfolio across six networks in under a minute.
            </p>
            <Link to={session ? '/dashboard' : '/login'} className="btn-primary mx-auto mt-8 w-fit px-8 py-3 text-base">
              {session ? 'Open dashboard' : 'Create free account'}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="container-x flex flex-col items-center justify-between gap-4 text-xs text-slate-500 sm:flex-row">
          <div className="flex items-center gap-3">
            <Logo compact />
            <span>© {new Date().getFullYear()} NovaWallet. Non-custodial by design. · v{APP_VERSION}</span>
          </div>
          <div className="flex gap-5">
            <a href="#security" className="hover:text-slate-300">Security</a>
            <Link to="/login" className="hover:text-slate-300">Sign in</Link>
            <a href="#features" className="hover:text-slate-300">Features</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
