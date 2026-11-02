import { useSyncExternalStore } from 'react'
import { useAccount } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { getKeystore, localWalletStore } from '../lib/localWallet'
import { scopedGet } from '../lib/scopedStorage'

const WATCH_BASE = 'nova_evm_watch_address'
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export type ReceiveSource = 'connected' | 'watch' | 'local' | 'linked' | null

/**
 * Resolves the best EVM receive address for the signed-in account.
 * A real saved wallet always wins over a legacy tracked/watch-only address so
 * deposit, dashboard and withdraw surfaces all show the same address.
 */
export function useReceiveAddress(): { address: `0x${string}` | null; source: ReceiveSource } {
  const { address: connected } = useAccount()
  const { profile } = useAuth()
  const localWallet = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )

  if (connected) return { address: connected, source: 'connected' }

  const keystore = getKeystore()
  if (keystore?.address) return { address: keystore.address, source: 'local' }
  if (localWallet.address) return { address: localWallet.address, source: 'local' }

  const linked = profile?.wallet_address
  if (linked && EVM_ADDRESS_RE.test(linked)) {
    return { address: linked as `0x${string}`, source: 'linked' }
  }

  const watch = scopedGet(WATCH_BASE, profile?.id)
  if (watch && EVM_ADDRESS_RE.test(watch)) {
    return { address: watch as `0x${string}`, source: 'watch' }
  }

  return { address: null, source: null }
}
