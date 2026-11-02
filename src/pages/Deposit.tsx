import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { CHAIN_META, SUPPORTED_CHAINS, TOKENS } from '../lib/chains'
import { getKeystore } from '../lib/localWallet'
import { scopedGet } from '../lib/scopedStorage'
import { CopyButton } from '../components/CopyButton'
import { BtcCard } from '../components/BtcCard'
import { SolCard } from '../components/SolCard'
import { shortAddr } from '../lib/format'

const WATCH_BASE = 'nova_evm_watch_address'

export default function Deposit() {
  const { address: connected, isConnected } = useAccount()
  const { profile } = useAuth()
  const fallback = useMemo(() => {
    try {
      const watch = scopedGet(WATCH_BASE, profile?.id)
      if (watch && /^0x[0-9a-fA-F]{40}$/.test(watch)) return watch as `0x${string}`
    } catch {
      /* ignore */
    }
    return getKeystore()?.address ?? null
  }, [profile?.id])
  const linked = (profile?.wallet_address ?? null) as `0x${string}` | null
  const address = connected ?? fallback ?? linked ?? null

  const [chainId, setChainId] = useState<number>(SUPPORTED_CHAINS[0].id)
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId) ?? SUPPORTED_CHAINS[0]
  const meta = CHAIN_META[chain.id]
  const tokens = TOKENS[chain.id] ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Deposit / Receive</h1>
          <p className="mt-1 text-sm text-slate-400">
            Send crypto to your wallet address. Deposits arrive directly on-chain — NovaWallet never holds your funds.
          </p>
        </div>
        <Link to="/withdraw" className="btn-secondary w-fit">
          Go to withdraw →
        </Link>
      </div>

      {!address ? (
        <div className="card space-y-3 p-6">
          <h2 className="text-sm font-bold text-white">No receiving address yet</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Connect an external wallet, unlock or create the on-device NovaWallet, or track an address on the dashboard
            to get your deposit address.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard#local-wallet" className="btn-primary">
              Create or unlock a wallet
            </Link>
            <Link to="/dashboard#add-wallet" className="btn-secondary">
              Track an address
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Your EVM deposit address</h2>
                <p className="mt-1 text-xs text-slate-500">
                  One address works on every supported EVM network. Always check the network before sending.
                </p>
              </div>
              <span className="badge w-fit border-accent-500/30 bg-accent-500/10 text-accent-400">
                {isConnected ? 'Connected wallet' : 'Watch-only / saved wallet'}
              </span>
            </div>

            <p className="mt-4 break-all rounded-xl border border-white/10 bg-ink-900/70 p-3 font-mono text-xs text-slate-200">
              {address}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-500">{shortAddr(address, 8)}</span>
              <CopyButton value={address} label="Copy address" />
            </div>

            <div className="mt-5">
              <p className="label">Network</p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_CHAINS.map((c) => {
                  const active = c.id === chain.id
                  const color = CHAIN_META[c.id]?.color
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChainId(c.id)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? 'border-brand-500/50 bg-brand-500/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: color }}
                      />
                      {CHAIN_META[c.id]?.label ?? c.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-300">
              Send only {meta.coin} or the listed tokens on {meta.label} to this address. Assets sent on the wrong
              network can be lost permanently.
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-500/20 bg-accent-500/5 p-3 text-[11px] leading-relaxed text-accent-300">
              <span className="mt-0.5 font-bold">🔔</span>
              <span>
                We watch this address while you are signed in and notify you here as soon as a new deposit is detected.
              </span>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-bold text-white">Supported tokens on {meta.label}</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs font-semibold text-slate-200">{chain.nativeCurrency.symbol} (native)</span>
                <span className="text-[11px] text-slate-500">No contract address</span>
              </div>
              {tokens.map((t) => (
                <div
                  key={t.address}
                  className="flex flex-col gap-2 rounded-lg bg-white/[0.03] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xs font-semibold text-slate-200">
                    {t.symbol} <span className="font-normal text-slate-500">· {t.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="break-all font-mono text-[11px] text-slate-500">{shortAddr(t.address, 6)}</span>
                    <CopyButton value={t.address} label="Copy" />
                  </span>
                </div>
              ))}
            </div>
            <a
              href={meta.explorer}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs font-semibold text-brand-400 hover:underline"
            >
              Open {meta.label} explorer →
            </a>
          </div>
        </>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Bitcoin &amp; Solana deposits</h2>
        <p className="mt-1 text-xs text-slate-500">
          These networks are watch-only. Paste the address from your own BTC or SOL wallet to display it and track the
          balance.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <BtcCard />
          <SolCard />
        </div>
      </div>
    </div>
  )
}
