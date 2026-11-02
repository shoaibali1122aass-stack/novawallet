import { useEffect } from 'react'
import { formatUnits } from 'viem'
import { useBalance, useReadContracts } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { CHAIN_META, SUPPORTED_CHAINS, TOKENS, erc20Abi, type SupportedChainId } from '../lib/chains'
import { depositAlertsSuppressed, notify } from '../lib/notifications'
import { sendEmailNotification } from '../lib/emailNotifications'
import { useReceiveAddress } from '../hooks/useReceiveAddress'

function seenKey(userId: string, chainId: number, asset: string) {
  return `nova_seen_balance:${userId}:${chainId}:${asset}`
}

function useDepositWatcher(
  userId: string | null,
  storageKey: string,
  value: bigint | undefined,
  symbol: string,
  decimals: number,
  chainLabel: string,
) {
  useEffect(() => {
    if (!userId || value === undefined) return
    try {
      const stored = localStorage.getItem(storageKey)
      localStorage.setItem(storageKey, value.toString())
      if (stored === null) return
      const previous = BigInt(stored)
      if (value > previous && !depositAlertsSuppressed()) {
        const diff = value - previous
        const title = `New ${symbol} deposit`
        const body = `${formatUnits(diff, decimals)} ${symbol} received on ${chainLabel}.`
        notify('deposit', title, body)
        void sendEmailNotification('deposit', title, body, `${storageKey}:${value}`)
      }
    } catch {
      /* storage unavailable */
    }
  }, [userId, storageKey, value, symbol, decimals, chainLabel])
}

function ChainWatch({
  address,
  userId,
  chainId,
}: {
  address: `0x${string}`
  userId: string
  chainId: SupportedChainId
}) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)!
  const meta = CHAIN_META[chainId]
  const tokens = TOKENS[chainId] ?? []
  const label = meta?.label ?? chain.name

  const native = useBalance({
    address,
    chainId,
    query: { enabled: true, refetchInterval: 15_000 },
  })
  useDepositWatcher(
    userId,
    seenKey(userId, chainId, 'native'),
    native.data?.value,
    chain.nativeCurrency.symbol,
    chain.nativeCurrency.decimals,
    label,
  )

  const reads = useReadContracts({
    contracts: tokens.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const,
      chainId,
    })),
    query: { enabled: true, refetchInterval: 20_000 },
  })

  useEffect(() => {
    if (!reads.data) return
    tokens.forEach((token, index) => {
      const value = reads.data?.[index]?.result as bigint | undefined
      if (value === undefined) return
      try {
        const storageKey = seenKey(userId, chainId, token.address)
        const stored = localStorage.getItem(storageKey)
        localStorage.setItem(storageKey, value.toString())
        if (stored === null) return
        const previous = BigInt(stored)
        if (value > previous && !depositAlertsSuppressed()) {
          const title = `New ${token.symbol} deposit`
          const body = `${formatUnits(value - previous, token.decimals)} ${token.symbol} received on ${label}.`
          notify('deposit', title, body)
          void sendEmailNotification('deposit', title, body, `${storageKey}:${value}`)
        }
      } catch {
        /* storage unavailable */
      }
    })
  }, [reads.data, tokens, userId, chainId, label])

  return null
}

export function NotificationWatcher() {
  const { profile } = useAuth()
  const { address } = useReceiveAddress()
  const userId = profile?.id ?? null

  if (!address || !userId) return null

  return (
    <>
      {SUPPORTED_CHAINS.map((chain) => (
        <ChainWatch key={chain.id} address={address} userId={userId} chainId={chain.id as SupportedChainId} />
      ))}
    </>
  )
}
