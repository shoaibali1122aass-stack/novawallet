import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useConnect } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { getKeystore, localWalletStore } from '../lib/localWallet'
import { shortAddr } from '../lib/format'
import { WalletButton } from './WalletButton'

export function WalletConnectPrompt({
  description,
}: {
  description?: string
}) {
  const { address: connected } = useAccount()
  const { profile } = useAuth()
  const { connectors, connectAsync, isPending, error } = useConnect()
  const wallet = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )
  const keystore = getKeystore()
  const localConnector = connectors.find((connector) => connector.id === 'novaLocal')
  const unlocked = Boolean(wallet.address)
  const linked = profile?.wallet_address ?? null

  if (connected) return null

  return (
    <div className="space-y-3">
      {description && <p className="text-xs leading-relaxed text-slate-400">{description}</p>}

      {unlocked && localConnector ? (
        <div className="rounded-xl border border-accent-500/20 bg-accent-500/5 p-3">
          <p className="text-xs font-semibold text-accent-300">NovaWallet is unlocked on this device</p>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-300">{wallet.address}</p>
          <button
            className="btn-primary mt-3 w-full"
            disabled={isPending}
            onClick={() => connectAsync({ connector: localConnector })}
          >
            {isPending ? 'Connecting…' : 'Connect NovaWallet'}
          </button>
        </div>
      ) : keystore ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-300">NovaWallet is saved but locked</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Unlock it with your password once. It will reconnect automatically and this prompt will disappear.
          </p>
          <Link to="/dashboard#local-wallet" className="btn-primary mt-3 inline-block w-full text-center">
            Unlock NovaWallet
          </Link>
        </div>
      ) : (
        <>
          {linked && (
            <p className="text-xs leading-relaxed text-slate-400">
              Linked wallet: <span className="font-mono text-slate-300">{shortAddr(linked, 6)}</span>. Connect that
              wallet to continue.
            </p>
          )}
          <WalletButton compact />
          <Link
            to="/dashboard#local-wallet"
            className="block text-xs font-semibold text-brand-400 hover:underline"
          >
            Or create / import a NovaWallet local wallet →
          </Link>
        </>
      )}

      {error && <p className="text-xs text-rose-400">{error.message.split('\n')[0]}</p>}
    </div>
  )
}
