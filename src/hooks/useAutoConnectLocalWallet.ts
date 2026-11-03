import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { localWalletStore } from '../lib/localWallet'

/**
 * Reconnects an on-device wallet that is already unlocked so pages never ask
 * the user to connect a wallet that is already saved in this browser.
 */
export function useAutoConnectLocalWallet() {
  const { isConnected } = useAccount()
  const { connectors, connectAsync, isPending, error } = useConnect()
  const wallet = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )
  const localConnector = connectors.find((connector) => connector.id === 'novaLocal')
  const attempted = useRef(false)
  const [retrying, setRetrying] = useState(false)

  const connectNow = useCallback(async () => {
    if (!localConnector) throw new Error('Local wallet connector is unavailable. Reload the page.')
    await connectAsync({ connector: localConnector })
  }, [localConnector, connectAsync])

  useEffect(() => {
    if (!wallet.address || !localConnector || isConnected || isPending || attempted.current) return
    attempted.current = true
    connectNow().catch(() => {
      /* the prompt offers a manual retry */
    })
  }, [wallet.address, localConnector, isConnected, isPending, connectNow])

  const retry = useCallback(async () => {
    setRetrying(true)
    try {
      await connectNow()
    } catch {
      /* the error is surfaced by useConnect */
    } finally {
      setRetrying(false)
    }
  }, [connectNow])

  const unlocked = Boolean(wallet.address)
  const busy = isPending || retrying

  return {
    address: wallet.address,
    unlocked,
    connecting: unlocked && !isConnected,
    busy,
    error,
    retry,
  }
}
