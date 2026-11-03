import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CopyButton } from '../components/CopyButton'
import { timeAgo } from '../lib/format'
import {
  clearTxHistory,
  listTxHistory,
  removeTxHistory,
  subscribeTxHistory,
  TX_STATUS_LABEL,
  type TxKind,
  type TxRecord,
  type TxStatus,
} from '../lib/txHistory'

type Filter = 'all' | TxKind

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'swap', label: 'Swaps' },
]

function statusClass(status: TxStatus) {
  if (status === 'confirmed') return 'border-accent-500/30 bg-accent-500/10 text-accent-400'
  if (status === 'failed') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
}

function kindIcon(kind: TxKind) {
  return kind === 'withdrawal' ? '↑' : '⇄'
}

function kindClass(kind: TxKind) {
  return kind === 'withdrawal' ? 'bg-amber-500/15 text-amber-300' : 'bg-brand-500/15 text-brand-400'
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/5 py-2 first:border-0 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="break-all text-right font-mono text-xs text-slate-300">{value}</span>
    </div>
  )
}

function TxCard({ record, onRemove }: { record: TxRecord; onRemove: () => void }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${kindClass(record.kind)}`}>
            {kindIcon(record.kind)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{record.title}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{record.amount}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {new Date(record.createdAt).toLocaleString()} · {timeAgo(new Date(record.createdAt).toISOString())}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`badge ${statusClass(record.status)}`}>{TX_STATUS_LABEL[record.status]}</span>
          <button type="button" onClick={onRemove} className="text-[11px] font-semibold text-slate-500 hover:text-rose-300">
            Remove
          </button>
        </div>
      </div>

      {record.note && <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{record.note}</p>}

      <div className="mt-3 rounded-xl border border-white/10 bg-ink-950/60 p-3">
        <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Transaction ID</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-200">{record.hash}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <CopyButton value={record.hash} label="Copy" />
            {record.explorerUrl && (
              <a
                href={record.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-brand-400 hover:underline"
              >
                Explorer →
              </a>
            )}
          </div>
        </div>

        <div className="mt-2">
          <DetailRow label="From address" value={record.from} />
          {record.recipient && <DetailRow label="Recipient address" value={record.recipient} />}
          <DetailRow label="Network" value={record.chainName} />
          <DetailRow label="Amount" value={record.amount} />
        </div>
      </div>
    </div>
  )
}

export default function History() {
  const { profile } = useAuth()
  const [items, setItems] = useState<TxRecord[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const refresh = () => setItems(listTxHistory(profile?.id))
    refresh()
    return subscribeTxHistory(refresh)
  }, [profile?.id])

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  )

  const counts = useMemo(
    () => ({
      all: items.length,
      withdrawal: items.filter((item) => item.kind === 'withdrawal').length,
      swap: items.filter((item) => item.kind === 'swap').length,
    }),
    [items],
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Transaction history</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every withdrawal and swap sent from this account, with its transaction ID, address and amount.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/withdraw" className="btn-secondary">
            New withdrawal
          </Link>
          <Link to="/swap" className="btn-secondary">
            New swap
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label} ({counts[item.key]})
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true)
                return
              }
              clearTxHistory(profile?.id)
              setConfirmClear(false)
            }}
            onBlur={() => setConfirmClear(false)}
            className="btn-ghost text-xs"
          >
            {confirmClear ? 'Tap again to clear history' : 'Clear history'}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-semibold text-white">No transactions yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            Withdrawals and swaps you send from NovaWallet will appear here with the transaction ID, recipient address
            and amount.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/withdraw" className="btn-primary">
              Withdraw
            </Link>
            <Link to="/deposit" className="btn-secondary">
              Deposit
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((record) => (
            <TxCard
              key={record.id}
              record={record}
              onRemove={() => {
                removeTxHistory(profile?.id, record.hash)
                setItems(listTxHistory(profile?.id))
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
