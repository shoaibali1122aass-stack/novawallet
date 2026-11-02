import { useEffect, useState, type FormEvent } from 'react'
import { isAddress } from 'viem'
import { useAuth } from '../context/AuthContext'
import { scopedGet, scopedRemove, scopedSet } from '../lib/scopedStorage'
import { CopyButton } from './CopyButton'

const WATCH_BASE = 'nova_evm_watch_address'

export function WatchWalletCard({
  onChange,
}: {
  onChange: (address: `0x${string}` | null) => void
}) {
  const { profile } = useAuth()
  const userId = profile?.id
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState<`0x${string}` | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setSaved(null)
    setInput('')
    setError('')
    onChange(null)
    const stored = scopedGet(WATCH_BASE, userId)
    if (stored && isAddress(stored)) {
      const address = stored as `0x${string}`
      setSaved(address)
      setInput(address)
      onChange(address)
    }
  }, [userId, onChange])

  function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    const clean = input.trim()
    if (!isAddress(clean)) {
      setError('Enter a valid EVM address (0x followed by 40 hex characters).')
      return
    }
    const address = clean as `0x${string}`
    scopedSet(WATCH_BASE, userId, address)
    setSaved(address)
    setInput(address)
    onChange(address)
  }

  function remove() {
    scopedRemove(WATCH_BASE, userId)
    setSaved(null)
    setInput('')
    setError('')
    onChange(null)
  }

  return (
    <div id="add-wallet" className="card scroll-mt-24 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Add a wallet</h3>
          <p className="mt-1 text-xs text-slate-400">
            Track any EVM address across Ethereum, BNB Chain, Polygon, Arbitrum and Base.
          </p>
        </div>
        <span className="badge shrink-0 border-white/10 bg-white/5 text-slate-400">Watch-only</span>
      </div>

      {saved && (
        <div className="mt-4 rounded-xl border border-accent-500/20 bg-accent-500/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Tracking</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-200">{saved}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <CopyButton value={saved} label="Copy address" />
            <button type="button" onClick={remove} className="text-xs font-semibold text-rose-400 hover:underline">
              Remove
            </button>
          </div>
        </div>
      )}

      <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="input font-mono text-xs"
          placeholder="0x…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          aria-label="EVM address to track"
        />
        <button className="btn-primary shrink-0" type="submit">
          {saved ? 'Update' : 'Track address'}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  )
}
