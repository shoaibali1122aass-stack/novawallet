import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { shortAddr } from '../lib/format'
import { WalletConnectPrompt } from '../components/WalletConnectPrompt'

type EventRow = { id: number; action: string; created_at: string }

export default function Security() {
  const { profile, refresh } = useAuth()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])

  async function loadEvents() {
    const { data } = await supabase
      .from('audit_log')
      .select('id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(12)
    setEvents((data as EventRow[]) ?? [])
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function linkWallet() {
    setError('')
    setOk('')
    if (!isConnected || !address) {
      setError('Connect a wallet first.')
      return
    }
    setBusy(true)
    try {
      const message =
        `Link this wallet to NovaWallet\n\n` +
        `Account: ${profile?.email}\n` +
        `Wallet: ${address}\n` +
        `Nonce: ${Date.now()}\n\n` +
        `This signature proves ownership. It is not a transaction.`
      await signMessageAsync({ message })
      const { error: updError } = await supabase
        .from('profiles')
        .update({ wallet_address: address })
        .eq('id', profile!.id)
      if (updError) throw updError
      await logAudit('wallet_linked', { wallet: address })
      await refresh()
      await loadEvents()
      setOk('Wallet ownership verified and linked to your account.')
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0] : 'Could not verify wallet.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleLock() {
    if (!profile) return
    setError('')
    setOk('')
    setBusy(true)
    try {
      const next = !profile.withdrawal_lock
      const { error: updError } = await supabase
        .from('profiles')
        .update({ withdrawal_lock: next })
        .eq('id', profile.id)
      if (updError) throw updError
      await logAudit(next ? 'withdrawal_lock_enabled' : 'withdrawal_lock_disabled')
      await refresh()
      await loadEvents()
      setOk(next ? 'Withdrawal lock enabled.' : 'Withdrawal lock disabled.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update setting.')
    } finally {
      setBusy(false)
    }
  }

  async function signOutEverywhere() {
    setBusy(true)
    try {
      await logAudit('global_signout')
      await supabase.auth.signOut({ scope: 'global' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Security</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your account protection. NovaWallet's servers cannot access your funds or keys at any point.
        </p>
      </div>

      {(error || ok) && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            error
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-accent-500/30 bg-accent-500/10 text-accent-300'
          }`}
        >
          {error || ok}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Email verification</h2>
            <span className="badge border-accent-500/30 bg-accent-500/10 text-accent-400">Verified</span>
          </div>
          <p className="mt-3 break-all rounded-xl border border-white/10 bg-ink-900/70 p-3 font-mono text-xs text-slate-300">
            {profile?.email ?? '—'}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Sign-in uses single-use email codes. If you ever receive a code you did not request, someone may be trying
            to access your account — do not share it.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Linked wallet</h2>
            <span className={`badge border-white/10 bg-white/5 ${profile?.wallet_address ? 'text-accent-400' : 'text-slate-400'}`}>
              {profile?.wallet_address ? 'Verified' : 'Not linked'}
            </span>
          </div>
          <p className="mt-3 break-all rounded-xl border border-white/10 bg-ink-900/70 p-3 font-mono text-xs text-slate-300">
            {profile?.wallet_address ?? 'No wallet linked yet'}
          </p>
          {profile?.wallet_address ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-slate-500">
                This wallet is already linked to your account. You do not need to connect it again unless you want to
                replace it.
              </p>
              {isConnected && address && address.toLowerCase() !== profile.wallet_address.toLowerCase() && (
                <button className="btn-secondary" onClick={linkWallet} disabled={busy}>
                  {busy ? 'Waiting…' : 'Replace with connected wallet'}
                </button>
              )}
              {!isConnected && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-brand-400 hover:underline">
                    Change or re-verify linked wallet
                  </summary>
                  <div className="mt-3">
                    <WalletConnectPrompt />
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {isConnected ? (
                <button className="btn-secondary" onClick={linkWallet} disabled={busy}>
                  {busy ? 'Waiting…' : 'Verify wallet ownership'}
                </button>
              ) : (
                <WalletConnectPrompt description="Connect your saved NovaWallet or an external wallet to verify ownership." />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-white">Withdrawal lock</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
              When enabled, every outgoing transfer requires a wallet signature plus a fresh email code. This makes
              remote account takeover far harder.
            </p>
          </div>
          <button
            onClick={toggleLock}
            disabled={busy}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              profile?.withdrawal_lock ? 'bg-accent-500' : 'bg-white/15'
            }`}
            aria-label="Toggle withdrawal lock"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                profile?.withdrawal_lock ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-sm font-bold text-white">Recent security activity</h2>
          <ul className="mt-3 space-y-2">
            {events.length === 0 && <li className="text-xs text-slate-500">No events recorded yet.</li>}
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs font-medium text-slate-300">{ev.action.replaceAll('_', ' ')}</span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {new Date(ev.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-bold text-white">Sessions</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Signing out everywhere revokes all active sessions on every device. You will need to verify your email again
            to sign back in.
          </p>
          <button className="btn-secondary mt-4" onClick={signOutEverywhere} disabled={busy}>
            Sign out of all devices
          </button>
          <p className="mt-4 text-[11px] text-slate-500">
            Linked wallet: <span className="font-mono">{shortAddr(profile?.wallet_address) || '—'}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
