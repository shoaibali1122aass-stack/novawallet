import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { SUPPORTED_CHAINS } from '../lib/chains'
import { ChainCard } from '../components/ChainCard'
import { BtcCard } from '../components/BtcCard'
import { SolCard } from '../components/SolCard'
import { SendPanel } from '../components/SendPanel'
import { LocalWalletCard } from '../components/LocalWalletCard'
import { WatchWalletCard } from '../components/WatchWalletCard'
import { CopyButton } from '../components/CopyButton'
import { shortAddr } from '../lib/format'
import { useReceiveAddress, type ReceiveSource } from '../hooks/useReceiveAddress'

function ReceiveCard({
  address,
  source,
}: {
  address?: `0x${string}` | null
  source: ReceiveSource
}) {
  const watchOnly = Boolean(address) && source !== 'connected'
  const label =
    source === 'connected'
      ? 'Connected wallet address.'
      : source === 'local'
        ? 'Saved on-device wallet address.'
        : source === 'watch'
          ? 'Tracked watch-only address.'
          : source === 'linked'
            ? 'Linked wallet address.'
            : 'Use this address on any EVM network.'
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
            <span className="text-[11px] text-slate-500">{label}</span>
            <CopyButton value={address} label="Copy address" />
          </div>
          <Link to="/deposit" className="mt-3 inline-block text-xs font-semibold text-brand-400 hover:underline">
            Open deposit page →
          </Link>
          {watchOnly && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-400">
              Deposits are safe to this address. To withdraw, connect the wallet that controls it.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          No wallet connection is needed to receive. Create or import an on-device wallet, or track an EVM address
          above, and its deposit address will appear here. For Bitcoin or Solana, use the cards below.
        </p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { address: connectedAddress, isConnected } = useAccount()
  const { address: savedAddress, source } = useReceiveAddress()
  const [watchAddress, setWatchAddress] = useState<`0x${string}` | null>(null)
  const handleWatchChange = useCallback((address: `0x${string}` | null) => setWatchAddress(address), [])
  const displayAddress = connectedAddress ?? watchAddress ?? savedAddress ?? null
  const displaySource: ReceiveSource = connectedAddress ? 'connected' : watchAddress ? 'watch' : source

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Portfolio</h1>
          <p className="mt-1 text-sm text-slate-400">
            {profile?.email ? `Signed in as ${profile.email}` : 'Your multi-chain overview'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/deposit" className="btn-primary">
            Deposit
          </Link>
          <Link to="/withdraw" className="btn-secondary">
            Withdraw
          </Link>
          <Link to="/swap" className="btn-secondary">
            Swap
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/deposit"
          className="card card-hover flex items-start gap-3 border-accent-500/20 bg-accent-500/5 p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-400">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v14M6 11l6 6 6-6M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-bold text-white">Deposit</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              Get your receive address and network details.
            </span>
          </span>
        </Link>

        <Link
          to="/withdraw"
          className="card card-hover flex items-start gap-3 border-amber-500/20 bg-amber-500/5 p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21V7M6 13l6-6 6 6M4 3h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-bold text-white">Withdraw</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              Send crypto from your own wallet with a signature.
            </span>
          </span>
        </Link>

        <Link
          to="/swap"
          className="card card-hover flex items-start gap-3 border-brand-500/20 bg-brand-500/5 p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h13l-3-3M20 17H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-bold text-white">Swap</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              Exchange tokens at the best available route.
            </span>
          </span>
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LocalWalletCard />
        <WatchWalletCard onChange={handleWatchChange} connected={isConnected} />
      </div>

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
              <ChainCard key={chain.id} chain={chain} address={displayAddress} />
            ))}
          </div>

          <h2 className="pt-2 text-sm font-bold uppercase tracking-wider text-slate-400">Other networks</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <BtcCard />
            <SolCard />
          </div>
        </div>

        <div className="space-y-4">
          <ReceiveCard address={displayAddress} source={displaySource} />
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
