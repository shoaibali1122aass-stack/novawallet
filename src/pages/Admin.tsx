import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logAudit } from '../lib/audit'
import { shortAddr, timeAgo } from '../lib/format'

type AdminProfile = {
  id: string
  email: string | null
  role: string
  is_suspended: boolean
  withdrawal_lock: boolean
  wallet_address: string | null
  created_at: string
}

type AuditRow = {
  id: number
  user_id: string | null
  action: string
  detail: unknown
  user_agent: string | null
  created_at: string
}

type Ticket = {
  id: string
  user_id: string
  subject: string
  message: string
  status: string
  admin_reply: string | null
  created_at: string
}

type Tab = 'overview' | 'users' | 'audit' | 'tickets'

function StatCard({ label, value, tone = 'text-white' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  )
}

function TicketRow({ ticket, onDone }: { ticket: Ticket; onDone: () => void }) {
  const [reply, setReply] = useState(ticket.admin_reply ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(status: string) {
    setError('')
    setBusy(true)
    try {
      const { error: updError } = await supabase
        .from('tickets')
        .update({ admin_reply: reply.trim() || null, status })
        .eq('id', ticket.id)
      if (updError) throw updError
      await logAudit('ticket_replied', { ticket: ticket.id, status })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{ticket.subject}</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {shortAddr(ticket.user_id, 6)} · {timeAgo(ticket.created_at)}
          </p>
        </div>
        <span className="badge border-white/10 bg-white/5 text-slate-400">{ticket.status}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{ticket.message}</p>
      <textarea
        className="input mt-3 min-h-[80px] resize-y text-xs"
        placeholder="Reply to this user (never ask for seed phrases or private keys)…"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-primary !py-2 text-xs" disabled={busy || !reply.trim()} onClick={() => save('answered')}>
          Send reply
        </button>
        <button className="btn-secondary !py-2 text-xs" disabled={busy} onClick={() => save('closed')}>
          Close ticket
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  )
}

export default function Admin() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [p, a, t] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      ])
      if (p.error) throw p.error
      if (a.error) throw a.error
      if (t.error) throw t.error
      setProfiles((p.data as AdminProfile[]) ?? [])
      setAudit((a.data as AuditRow[]) ?? [])
      setTickets((t.data as Ticket[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const stats = useMemo(() => {
    return {
      users: profiles.length,
      admins: profiles.filter((p) => p.role === 'admin').length,
      suspended: profiles.filter((p) => p.is_suspended).length,
      openTickets: tickets.filter((t) => t.status === 'open').length,
    }
  }, [profiles, tickets])

  async function toggleSuspend(p: AdminProfile) {
    setNote('')
    setError('')
    if (p.id === profile?.id) {
      setError('You cannot suspend your own account.')
      return
    }
    try {
      const { error: updError } = await supabase
        .from('profiles')
        .update({ is_suspended: !p.is_suspended })
        .eq('id', p.id)
      if (updError) throw updError
      await logAudit(p.is_suspended ? 'admin_unsuspended_user' : 'admin_suspended_user', { user: p.id })
      setNote(`${p.email ?? p.id} ${p.is_suspended ? 'unsuspended' : 'suspended'}.`)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: `Users (${profiles.length})` },
    { id: 'tickets', label: `Tickets (${stats.openTickets})` },
    { id: 'audit', label: 'Audit log' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Admin console</h1>
          <p className="mt-1 text-sm text-slate-400">
            Support and security only. Administrators cannot view keys or move funds.
          </p>
        </div>
        <button className="btn-secondary" onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-ink-900/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(note || error) && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            error ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-accent-500/30 bg-accent-500/10 text-accent-300'
          }`}
        >
          {error || note}
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats.users} />
            <StatCard label="Administrators" value={stats.admins} tone="text-brand-400" />
            <StatCard label="Suspended" value={stats.suspended} tone="text-rose-400" />
            <StatCard label="Open tickets" value={stats.openTickets} tone="text-amber-400" />
          </div>
          <div className="card p-6">
            <h2 className="text-sm font-bold text-white">Recent security events</h2>
            <div className="mt-3 space-y-2">
              {audit.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-slate-300">{a.action.replaceAll('_', ' ')}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(a.created_at)}</span>
                </div>
              ))}
              {audit.length === 0 && <p className="text-xs text-slate-500">No events yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/5 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{p.email ?? '—'}</p>
                      <p className="font-mono text-[11px] text-slate-600">{shortAddr(p.id, 6)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          p.role === 'admin'
                            ? 'border-brand-500/40 bg-brand-500/10 text-brand-400'
                            : 'border-white/10 bg-white/5 text-slate-400'
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {shortAddr(p.wallet_address) || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {p.is_suspended ? (
                        <span className="badge border-rose-500/30 bg-rose-500/10 text-rose-300">Suspended</span>
                      ) : (
                        <span className="badge border-accent-500/30 bg-accent-500/10 text-accent-300">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className={`btn !px-3 !py-1.5 text-xs ${
                          p.is_suspended
                            ? 'border border-accent-500/30 bg-accent-500/10 text-accent-300'
                            : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                        }`}
                        onClick={() => toggleSuspend(p)}
                        disabled={p.id === profile?.id}
                      >
                        {p.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-3">
          {tickets.length === 0 && <div className="card p-6 text-center text-xs text-slate-500">No tickets.</div>}
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} onDone={loadAll} />
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/5 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {audit.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{shortAddr(a.user_id, 6)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-300">{a.action}</td>
                    <td className="max-w-[22rem] truncate px-4 py-3 font-mono text-[11px] text-slate-600">
                      {a.detail ? JSON.stringify(a.detail) : '—'}
                    </td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">
                      No audit entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
