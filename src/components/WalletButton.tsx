import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { shortAddr } from '../lib/format'
import { CHAIN_META } from '../lib/chains'

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, chain } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="badge border-accent-500/30 bg-accent-500/10 text-accent-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
          {CHAIN_META[chain?.id ?? 1]?.label ?? chain?.name ?? 'Network'}
        </span>
        <button
          onClick={() => disconnect()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-slate-200 hover:bg-white/10"
          title="Disconnect"
        >
          <span className="h-2 w-2 rounded-full bg-accent-400" />
          {shortAddr(address, compact ? 4 : 6)}
        </button>
      </div>
    )
  }

  const injected = connectors.find((c) => c.id === 'injected')
  const wc = connectors.find((c) => c.id === 'walletConnect')

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-primary"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.2-8.6M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isPending ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {wc && (
        <button
          className="btn-secondary"
          disabled={isPending}
          onClick={() => connect({ connector: wc })}
          title="WalletConnect (mobile wallets)"
        >
          WalletConnect
        </button>
      )}
    </div>
  )
}
