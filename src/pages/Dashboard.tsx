import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { SUPPORTED_CHAINS } from '../lib/chains'
import { ChainCard } from '../components/ChainCard'
import { BtcCard } from '../components/BtcCard'
import { SolCard } from '../components/SolCard'
import { SendPanel } from '../components/SendPanel'
import { WalletButton } from '../components/WalletButton'
import { WatchWalletCard } from '../components/WatchWalletCard'
import { CopyButton } from '../components/CopyButton'
import { shortAddr } from '../lib/format'

function ReceiveCard({
  address,
  isConnected,
}: {
  address?: `0x${string}` | null
  isConnected: boolean
}) {
  const watchOnly = Boolean(address) && !isConnected
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Deposit / Receive</h3>
        <span className="badge border-white/10 bg-white/5 text-slate-400">EVM</span>
      </div>
      {address ? (
        <>
          <p className="mt-3 break-all rounded-xl border border-white/10 bg-ink-900/70 p-3 font-mono text-xs text-slate-300">
            {address}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {watchOnly ? 'Watch-only address.' : 'Use this address on any EVM network.'}
            </span>
            <CopyButton value={address} label="Copy address" />
          </div>
          {watchOnly && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-400">
              Deposits are safe to this address. To withdraw, connect the wallet that controls it.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Connect a wallet or add a watch-only address above to see your receiving address. For Bitcoin or Solana, use
          the cards below.
        </p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { address: connectedAddress, isConnected } = useAccount()
  const [watchAddress, setWatchAddress] = useState<`0x${string}` | null>(null)
  const handleWatchChange = useCallback((address: `0x${string}` | null) => setWatchAddress(address), [])
  const displayAddress = connectedAddress ?? watchAddress ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Portfolio</h1>
          <p className="mt-1 text-sm text-slate-400">
            {profile?.email ? `Signed in as ${profile.email}` : 'Your multi-chain overview'}
          </p>
        </div>
        <WalletButton />
      </div>

      {!isConnected && (
        <div className="card flex flex-col items-start justify-between gap-4 border-brand-500/20 bg-brand-500/5 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="13" rx="3" />
                <path d="M16 12h.01M2 10h20" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Connect a wallet or track an address</p>
              <p className="text-xs text-slate-400">
                Balances are read directly from public RPCs. No keys or phrases are ever requested. You can also{' '}
                <a href="#add-wallet" className="font-semibold text-brand-400 hover:underline">
                  track any address
                </a>{' '}
                without connecting.
              </p>
            </div>
          </div>
          <WalletButton compact />
        </div>
      )}

      <WatchWalletCard onChange={handleWatchChange} connected={isConnected} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">EVM networks</h2>
            {isConnected && (
              <Link to="/security" className="text-xs font-semibold text-brand-400 hover:underline">
                Security settings →
              </Link>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SUPPORTED_CHAINS.map((chain) => (
              <ChainCard key={chain.id} chain={chain} address={watchAddress} />
            ))}
          </div>

          <h2 className="pt-2 text-sm font-bold uppercase tracking-wider text-slate-400">Other networks</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <BtcCard />
            <SolCard />
          </div>
        </div>

        <div className="space-y-4">
          <ReceiveCard address={displayAddress} isConnected={isConnected} />
          <SendPanel />

          <div className="card p-5">
            <h3 className="text-sm font-bold text-white">Account</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="max-w-[12rem] truncate text-slate-300">{profile?.email ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Verified</dt>
                <dd className="text-accent-400">Yes</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Wallet</dt>
                <dd className="font-mono text-slate-300">{shortAddr(profile?.wallet_address) || 'Not linked'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Withdrawal lock</dt>
                <dd className={profile?.withdrawal_lock ? 'text-amber-400' : 'text-slate-400'}>
                  {profile?.withdrawal_lock ? 'Enabled' : 'Off'}
                </dd>
              </div>
            </dl>
            <Link to="/security" className="btn-secondary mt-4 w-full">Manage security</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
