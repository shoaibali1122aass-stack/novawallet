import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { shortAddr } from '../lib/format'
import { CHAIN_META } from '../lib/chains'
import { localWalletStore } from '../lib/localWallet'

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function friendlyError(error: Error | null | undefined): string {
  if (!error) return ''
  if (error.name === 'ProviderNotFoundError') {
    return 'No browser wallet was found. Open this page inside your wallet app using the links below.'
  }
  return error.message.split('\n')[0]
}

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, chain } = useAccount()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const wallet = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isConnected) setOpen(false)
  }, [isConnected])

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

  const hasInjectedProvider =
    typeof window !== 'undefined' && Boolean((window as unknown as { ethereum?: unknown }).ethereum)
  const walletConnect = connectors.find((c) => c.id === 'walletConnect')
  const localWallet = connectors.find((c) => c.id === 'novaLocal')
  const discovered = connectors.filter(
    (c) => c.id !== 'injected' && c.id !== 'walletConnect' && c.id !== 'novaLocal',
  )
  const genericInjected = connectors.find((c) => c.id === 'injected')
  const list = [
    ...discovered,
    ...(localWallet && wallet.address ? [localWallet] : []),
    ...(hasInjectedProvider && genericInjected ? [genericInjected] : []),
    ...(walletConnect ? [walletConnect] : []),
  ]

  const href = typeof window !== 'undefined' ? window.location.href : ''
  const dappUrl =
    typeof window !== 'undefined' ? `${window.location.host}${window.location.pathname}${window.location.search}` : ''
  const deepLinks = [
    { label: 'MetaMask', href: `https://metamask.app.link/dapp/${dappUrl}` },
    {
      label: 'Trust Wallet',
      href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(href)}`,
    },
    { label: 'Coinbase Wallet', href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(href)}` },
  ]
  const showMobileLinks = isMobileBrowser() || list.length === 0
  const errorText = friendlyError(error)

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={isPending}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.2-8.6M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isPending ? 'Connecting…' : compact ? 'Connect' : 'Connect Wallet'}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Connect a wallet"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Connect a wallet</h3>
                <p className="mt-1 text-xs text-slate-400">
                  External wallets keep their keys. The optional local wallet encrypts its secret in your browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {list.length > 0 ? (
              <div className="mt-5 space-y-2">
                {list.map((connector) => (
                  <button
                    key={connector.id}
                    type="button"
                    className="btn-secondary w-full !justify-between"
                    disabled={isPending}
                    onClick={() => connect({ connector })}
                  >
                    <span className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-[10px] font-black">
                        {connector.name.slice(0, 2).toUpperCase()}
                      </span>
                      {connector.id === 'injected'
                        ? 'Browser wallet'
                        : connector.id === 'novaLocal'
                          ? 'NovaWallet (on-device)'
                          : connector.name}
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {connector.id === 'walletConnect' ? 'QR / mobile' : connector.id === 'novaLocal' ? 'Local' : 'Browser'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">No browser wallet detected</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  This browser does not expose an EVM wallet. Open NovaWallet inside MetaMask, Trust Wallet or Coinbase
                  Wallet, or track any address in watch-only mode.
                </p>
              </div>
            )}

            {showMobileLinks && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-slate-300">Open in a wallet app</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {deepLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary !px-2 text-center text-xs"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  The wallet browser has separate storage, so you may need to sign in with an email code again.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-1.5">
              <Link
                to="/dashboard#local-wallet"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-brand-400 hover:underline"
              >
                Create or import a NovaWallet local wallet →
              </Link>
              <Link
                to="/dashboard#add-wallet"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-slate-400 hover:text-white hover:underline"
              >
                Track a watch-only address instead →
              </Link>
            </div>

            {errorText && <p className="mt-4 text-xs text-rose-400">{errorText}</p>}
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
