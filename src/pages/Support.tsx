import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logAudit } from '../lib/audit'

type Ticket = {
  id: string
  subject: string
  message: string
  status: string
  admin_reply: string | null
  created_at: string
}

const statusStyle: Record<string, string> = {
  open: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  answered: 'border-accent-500/30 bg-accent-500/10 text-accent-300',
  closed: 'border-white/10 bg-white/5 text-slate-400',
}

export default function Support() {
  const { profile } = useAuth()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
    setTickets((data as Ticket[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setError('Please add a clear subject and a message of at least 10 characters.')
      return
    }
    setBusy(true)
    try {
      const { error: insError } = await supabase.from('tickets').insert({
        user_id: profile!.id,
        subject: subject.trim(),
        message: message.trim(),
      })
      if (insError) throw insError
      await logAudit('ticket_created', { subject: subject.trim() })
      setSubject('')
      setMessage('')
      setOk('Your request has been submitted. Our support team will reply here.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Support</h1>
        <p className="mt-1 text-sm text-slate-400">
          Account and security help. Support will never ask for your recovery phrase or private key.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-4 p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-white">Open a request</h2>
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              placeholder="e.g. Cannot verify my email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              className="input min-h-[130px] resize-y"
              placeholder="Describe what happened. Never include seed phrases or private keys in a ticket."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {ok && <p className="text-xs text-accent-400">{ok}</p>}
        </form>

        <div className="space-y-3 lg:col-span-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Your requests</h2>
          {loading && <p className="text-xs text-slate-500">Loading…</p>}
          {!loading && tickets.length === 0 && (
            <div className="card p-6 text-center text-xs text-slate-500">No support requests yet.</div>
          )}
          {tickets.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{t.subject}</h3>
                <span className={`badge shrink-0 ${statusStyle[t.status] ?? statusStyle.open}`}>{t.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{t.message}</p>
              <p className="mt-2 text-[11px] text-slate-600">{new Date(t.created_at).toLocaleString()}</p>
              {t.admin_reply && (
                <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Support reply</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{t.admin_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
