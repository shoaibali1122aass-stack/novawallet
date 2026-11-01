import { useEffect, useState } from 'react'
import { fmtAmount, shortAddr } from '../lib/format'
import { CopyButton } from './CopyButton'

const KEY = 'nova_sol_address'
const RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com']

async function fetchBalance(rpc: string, address: string): Promise<number> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { error?: { message?: string }; result?: { value?: number } }
    if (json.error) throw new Error(json.error.message ?? 'Invalid Solana address')
    return json.result?.value ?? 0
  } finally {
    window.clearTimeout(timer)
  }
}

export function SolCard() {
  const [addr, setAddr] = useState('')
  const [loadedAddr, setLoadedAddr] = useState('')
  const [lamports, setLamports] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(a: string) {
    const clean = a.trim()
    if (!clean) return
    setLoading(true)
    setError('')
    try {
      let value: number | null = null
      let lastError: unknown = null
      for (const rpc of RPCS) {
        try {
          value = await fetchBalance(rpc, clean)
          break
        } catch (e) {
          lastError = e
        }
      }
      if (value === null) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Could not load Solana balance. Check the address and try again.')
      }
      setLamports(value)
      setLoadedAddr(clean)
      localStorage.setItem(KEY, clean)
    } catch (e) {
      setLamports(null)
      setLoadedAddr('')
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

  const sol = lamports !== null ? lamports / 1e9 : 0

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-xs font-black text-white"
            style={{ background: 'linear-gradient(135deg,#9945ff33,#14f19533)', border: '1px solid #9945ff55' }}
          >
            ◎
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Solana</p>
            <p className="text-xs text-slate-500">Native SOL · watch-only</p>
          </div>
        </div>
        <span className="badge border-white/10 bg-white/5 text-slate-400">SPL</span>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">Balance</p>
        <p className="mt-1 font-mono text-2xl font-bold text-white">
          {lamports !== null ? `${fmtAmount(sol, 6)} ` : '— '}
          <span className="text-sm font-semibold text-slate-400">SOL</span>
        </p>
        {lamports !== null && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Deposit SOL to this address. Withdrawals happen inside your Solana wallet.
          </p>
        )}
      </div>

      <form
        className="mt-4 space-y-2 border-t border-white/5 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          load(addr)
        }}
      >
        <label className="label">Solana address (watch-only)</label>
        <div className="flex gap-2">
          <input
            className="input font-mono text-xs"
            placeholder="Base58 public key"
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
      {lamports !== null && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs text-slate-500">{shortAddr(loadedAddr, 8)}</span>
          <CopyButton value={loadedAddr} />
        </div>
      )}
    </div>
  )
}
