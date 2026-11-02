import { useEffect, useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useBalance, useReadContracts } from 'wagmi'
import { useAuth } from '../context/AuthContext'
import { CHAIN_META, SUPPORTED_CHAINS, TOKENS, erc20Abi, type SupportedChainId } from '../lib/chains'
import { getKeystore } from '../lib/localWallet'
import { notify } from '../lib/notifications'

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
      if (value > previous) {
        const diff = value - previous
        notify(
          'deposit',
          `New ${symbol} deposit`,
          `${formatUnits(diff, decimals)} ${symbol} received on ${chainLabel}.`,
        )
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

  const native = useBalance({ address, chainId, query: { enabled: true } })
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
    query: { enabled: true },
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
        if (value > previous) {
          notify(
            'deposit',
            `New ${token.symbol} deposit`,
            `${formatUnits(value - previous, token.decimals)} ${token.symbol} received on ${label}.`,
          )
        }
      } catch {
        /* storage unavailable */
      }
    })
  }, [reads.data, tokens, userId, chainId, label])

  return null
}

export function NotificationWatcher() {
  const { address: connected } = useAccount()
  const { profile } = useAuth()
  const fallback = useMemo(() => {
    if (!profile?.id) return null
    try {
      const watch = localStorage.getItem(`nova_evm_watch_address:${profile.id}`)
      if (watch && /^0x[0-9a-fA-F]{40}$/.test(watch)) return watch as `0x${string}`
    } catch {
      /* ignore */
    }
    return getKeystore()?.address ?? null
  }, [profile?.id])

  const address = connected ?? ((profile?.wallet_address ?? null) as `0x${string}` | null) ?? fallback
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
