import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getKeystore, localWalletStore } from '../lib/localWallet'
import { scopedGet, scopedSet } from '../lib/scopedStorage'
import { fmtAmount, shortAddr } from '../lib/format'
import { CopyButton } from './CopyButton'
import { TokenIcon } from './AssetIcon'

type AddrStats = {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number }
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number }
}

const API_BASES = ['https://mempool.space', 'https://blockstream.info']
const BTC_BASE = 'nova_btc_address'

async function fetchStats(base: string, address: string): Promise<AddrStats> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${base}/api/address/${encodeURIComponent(address)}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as AddrStats
  } finally {
    window.clearTimeout(timer)
  }
}

export function BtcCard() {
  const { profile } = useAuth()
  const userId = profile?.id
  const wallet = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )
  const [addr, setAddr] = useState('')
  const [loadedAddr, setLoadedAddr] = useState('')
  const [data, setData] = useState<AddrStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const keystore = getKeystore()
  const derivedAddress = keystore?.btcAddress ?? ''

  async function load(a: string, persist = false) {
    const clean = a.trim()
    if (!clean) return
    setLoading(true)
    setError('')
    setLoadedAddr(clean)
    try {
      let stats: AddrStats | null = null
      for (const base of API_BASES) {
        try {
          stats = await fetchStats(base, clean)
          break
        } catch {
          /* try the next API */
        }
      }
      if (!stats) throw new Error('Could not load Bitcoin balance. Check the address and try again.')
      setData(stats)
      if (persist) scopedSet(BTC_BASE, userId, clean)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Could not load balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setData(null)
    setError('')
    const saved = scopedGet(BTC_BASE, userId)
    const initial = derivedAddress || (keystore ? '' : saved) || ''
    setAddr(initial)
    setLoadedAddr(initial)
    if (initial) load(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, wallet.address])

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
          <TokenIcon symbol="BTC" size={36} />
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
          {data ? `${fmtAmount(confirmed, 8)} ` : loading ? 'Loading… ' : '— '}
          <span className="text-sm font-semibold text-slate-400">BTC</span>
        </p>
        {data && pending !== 0 && (
          <p className="mt-1 text-xs text-amber-400">Pending: {fmtAmount(pending, 8)} BTC</p>
        )}
        {data && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Deposit BTC to this address. Withdrawals happen inside your Bitcoin wallet.
          </p>
        )}
      </div>

      <form
        className="mt-4 space-y-2 border-t border-white/5 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          load(addr, true)
        }}
      >
        <label className="label">
          Bitcoin address{' '}
          {derivedAddress
            ? '(your NovaWallet address)'
            : keystore
              ? '(unlock to load your wallet address)'
              : '(watch-only)'}
        </label>
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

      {!loadedAddr && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {getKeystore() ? (
            <>
              Unlock your on-device NovaWallet to auto-fill your BTC address.{' '}
              <Link to="/dashboard#local-wallet" className="font-semibold text-brand-400 hover:underline">
                Unlock now →
              </Link>
            </>
          ) : (
            <>
              Create an on-device NovaWallet to auto-generate a BTC address, or paste a watch-only address above.{' '}
              <Link to="/dashboard#local-wallet" className="font-semibold text-brand-400 hover:underline">
                Create wallet →
              </Link>
            </>
          )}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      {loadedAddr && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs text-slate-500">{shortAddr(loadedAddr, 8)}</span>
          <CopyButton value={loadedAddr} />
        </div>
      )}
    </div>
  )
}
