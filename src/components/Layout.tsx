import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'
import { NotificationBell } from './NotificationBell'
import { NotificationWatcher } from './NotificationWatcher'
import { Toasts } from './Toasts'
import { shortAddr } from '../lib/format'

const baseLinks = [
  { to: '/dashboard', label: 'Wallet' },
  { to: '/deposit', label: 'Deposit' },
  { to: '/withdraw', label: 'Withdraw' },
  { to: '/swap', label: 'Swap' },
  { to: '/security', label: 'Security' },
  { to: '/support', label: 'Support' },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const links = profile?.role === 'admin' ? [...baseLinks, { to: '/admin', label: 'Admin' }] : baseLinks

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-ink-950">
      <NotificationWatcher />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Logo to="/dashboard" />
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={linkClass}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <NotificationBell />
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-3 pr-1.5">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-[10px] font-black text-ink-950">
                {(profile?.email ?? 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[10rem] truncate text-xs font-medium text-slate-300">{profile?.email}</span>
              {profile?.role === 'admin' && (
                <span className="badge border-brand-500/40 bg-brand-500/10 text-brand-400">ADMIN</span>
              )}
            </div>
            <button onClick={handleSignOut} className="btn-ghost" title="Sign out">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <NotificationBell />
            <button className="btn-ghost" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-white/5 bg-ink-950/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
                  {l.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="truncate text-xs text-slate-400">{profile?.email}</span>
              <button onClick={handleSignOut} className="btn-secondary">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="container-x py-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/5 py-6">
        <div className="container-x flex flex-col items-center justify-between gap-2 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} NovaWallet. Non-custodial — your keys never leave your device.</p>
          <p className="font-mono">{shortAddr(profile?.wallet_address) || 'No wallet linked'}</p>
        </div>
      </footer>
      <Toasts />
    </div>
  )
}
