import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CopyButton } from '../components/CopyButton'
import { useReceiveAddress } from '../hooks/useReceiveAddress'
import { getKeystore } from '../lib/localWallet'
import { clearOnChainCache, fetchOnChainHistory } from '../lib/onChainHistory'
import { scopedGet } from '../lib/scopedStorage'
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
  { key: 'deposit', label: 'Deposits' },
  { key: 'swap', label: 'Swaps' },
]

function statusClass(status: TxStatus) {
  if (status === 'confirmed') return 'border-accent-500/30 bg-accent-500/10 text-accent-400'
  if (status === 'failed') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
}

function kindIcon(kind: TxKind) {
  if (kind === 'withdrawal') return '↑'
  if (kind === 'deposit') return '↓'
  return '⇄'
}

function kindClass(kind: TxKind) {
  if (kind === 'withdrawal') return 'bg-amber-500/15 text-amber-300'
  if (kind === 'deposit') return 'bg-emerald-500/15 text-emerald-300'
  return 'bg-brand-500/15 text-brand-400'
}

function mergeRecords(local: TxRecord[], onChain: TxRecord[]): TxRecord[] {
  const localHashes = new Set(local.map((record) => record.hash.toLowerCase()))
  const seen = new Set<string>()
  const merged = [...local]
  for (const record of onChain) {
    if (localHashes.has(record.hash.toLowerCase())) continue
    if (seen.has(record.id)) continue
    seen.add(record.id)
    merged.push(record)
  }
  return merged.sort((a, b) => b.createdAt - a.createdAt)
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
          {record.source === 'onchain' ? (
            <span className="badge border-white/10 bg-white/5 text-[10px] text-slate-400">On-chain</span>
          ) : (
            <button type="button" onClick={onRemove} className="text-[11px] font-semibold text-slate-500 hover:text-rose-300">
              Remove
            </button>
          )}
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
  const { address: evmAddress } = useReceiveAddress()
  const [localItems, setLocalItems] = useState<TxRecord[]>([])
  const [onChainItems, setOnChainItems] = useState<TxRecord[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmClear, setConfirmClear] = useState(false)

  const extraAddresses = useMemo(() => {
    const keystore = getKeystore()
    return {
      btc: scopedGet('nova_btc_address', profile?.id) || keystore?.btcAddress || '',
      sol: scopedGet('nova_sol_address', profile?.id) || keystore?.solAddress || '',
    }
  }, [profile?.id])

  useEffect(() => {
    const refresh = () => setLocalItems(listTxHistory(profile?.id))
    refresh()
    return subscribeTxHistory(refresh)
  }, [profile?.id])

  useEffect(() => {
    if (!evmAddress && !extraAddresses.btc && !extraAddresses.sol) {
      setOnChainItems([])
      setErrors([])
      setLoading(false)
      setRefreshedAt(null)
      return
    }
    let alive = true
    setLoading(true)
    setErrors([])
    setRefreshedAt(null)
    fetchOnChainHistory({ evm: evmAddress, btc: extraAddresses.btc, sol: extraAddresses.sol }, (partial) => {
      if (!alive) return
      setOnChainItems(partial.records)
      setErrors(partial.errors)
      setRefreshedAt(Date.now())
    })
      .then((result) => {
        if (!alive) return
        setOnChainItems(result.records)
        setErrors(result.errors)
        setRefreshedAt(Date.now())
      })
      .catch((error) => {
        if (!alive) return
        setErrors([error instanceof Error ? error.message : 'Could not load on-chain history'])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [evmAddress, extraAddresses.btc, extraAddresses.sol, refreshKey])

  const items = useMemo(() => mergeRecords(localItems, onChainItems), [localItems, onChainItems])

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  )

  const counts = useMemo(
    () => ({
      all: items.length,
      withdrawal: items.filter((item) => item.kind === 'withdrawal').length,
      deposit: items.filter((item) => item.kind === 'deposit').length,
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
            Withdrawals, deposits and swaps with their transaction ID, address and amount.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearOnChainCache()
              setRefreshKey((value) => value + 1)
            }}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? 'Scanning…' : 'Refresh'}
          </button>
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

        {localItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true)
                return
              }
              clearTxHistory(profile?.id)
              setLocalItems([])
              setConfirmClear(false)
            }}
            onBlur={() => setConfirmClear(false)}
            className="btn-ghost text-xs"
          >
            {confirmClear ? 'Tap again to clear local records' : 'Clear local records'}
          </button>
        )}
      </div>

      {!loading && refreshedAt && (
        <p className="text-[11px] text-slate-500">
          On-chain history updated {timeAgo(new Date(refreshedAt).toISOString())}
          {onChainItems.length > 0 ? ` · ${onChainItems.length} on-chain transactions found` : ''}
        </p>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-200/80">
          <p className="font-semibold text-amber-200">Some networks could not be scanned</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && items.length === 0 && !refreshedAt ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-semibold text-white">Scanning on-chain activity…</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            Looking up withdrawals and deposits for your wallet on every supported network.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-semibold text-white">No transactions yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            Withdrawals, deposits and swaps for this wallet will appear here with the transaction ID, address and amount.
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
                setLocalItems(listTxHistory(profile?.id))
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
