import { useEffect, useState } from 'react'
import { fmtAmount, shortAddr } from '../lib/format'
import { CopyButton } from './CopyButton'

type AddrStats = {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number }
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number }
}

const KEY = 'nova_btc_address'

export function BtcCard() {
  const [addr, setAddr] = useState('')
  const [data, setData] = useState<AddrStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(a: string) {
    const clean = a.trim()
    if (!clean) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`https://mempool.space/api/address/${encodeURIComponent(clean)}`)
      if (!res.ok) throw new Error('Bitcoin address not found')
      setData(await res.json())
      localStorage.setItem(KEY, clean)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Could not load balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(KEY)
    if (saved) {
      setAddr(saved)
      load(saved)
    }
  }, [])

  const confirmed = data
    ? (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 1e8
    : 0
  const pending = data
    ? (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum) / 1e8
    : 0

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-xs font-black text-white"
            style={{ backgroundColor: '#f7931a22', border: '1px solid #f7931a55' }}
          >
            ₿
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Bitcoin</p>
            <p className="text-xs text-slate-500">Native BTC · watch-only</p>
          </div>
        </div>
        <span className="badge border-white/10 bg-white/5 text-slate-400">UTXO</span>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">Confirmed balance</p>
        <p className="mt-1 font-mono text-2xl font-bold text-white">
          {data ? `${fmtAmount(confirmed, 8)} ` : '— '}
          <span className="text-sm font-semibold text-slate-400">BTC</span>
        </p>
        {data && pending !== 0 && (
          <p className="mt-1 text-xs text-amber-400">Pending: {fmtAmount(pending, 8)} BTC</p>
        )}
      </div>

      <form
        className="mt-4 space-y-2 border-t border-white/5 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          load(addr)
        }}
      >
        <label className="label">Bitcoin address</label>
        <div className="flex gap-2">
          <input
            className="input font-mono text-xs"
            placeholder="bc1… or 1… or 3…"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            spellCheck={false}
          />
          <button className="btn-secondary shrink-0" disabled={loading}>
            {loading ? '…' : 'Load'}
          </button>
        </div>
      </form>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      {data && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs text-slate-500">{shortAddr(addr, 8)}</span>
          <CopyButton value={addr} />
        </div>
      )}
    </div>
  )
}
