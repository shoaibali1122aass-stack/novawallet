import { useAccount, useBalance, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { CHAIN_META, TOKENS, erc20Abi, SUPPORTED_CHAINS } from '../lib/chains'
import { fmtAmount, shortAddr } from '../lib/format'
import { CopyButton } from './CopyButton'
import { ChainIcon, TokenIcon } from './AssetIcon'

export function ChainCard({
  chain,
  address: addressOverride,
}: {
  chain: (typeof SUPPORTED_CHAINS)[number]
  address?: `0x${string}` | null
}) {
  const { address: connected } = useAccount()
  const address = connected ?? addressOverride ?? undefined
  const meta = CHAIN_META[chain.id]
  const tokens = TOKENS[chain.id] ?? []

  const native = useBalance({
    address,
    chainId: chain.id,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  })

  const reads = useReadContracts({
    contracts: address
      ? tokens.map((t) => ({
          address: t.address,
          abi: erc20Abi,
          functionName: 'balanceOf' as const,
          args: [address] as const,
          chainId: chain.id,
        }))
      : [],
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  })

  const nativeValue = native.data ? Number(formatUnits(native.data.value, native.data.decimals)) : 0

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChainIcon chainId={chain.id} size={36} />
          <div>
            <p className="text-sm font-semibold text-white">{meta.label}</p>
            <p className="text-xs text-slate-500">{chain.name}</p>
          </div>
        </div>
        <span className="badge border-white/10 bg-white/5 text-slate-400">EVM</span>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">Native balance</p>
        <p className="mt-1 font-mono text-2xl font-bold text-white">
          {address ? `${fmtAmount(nativeValue, 5)} ` : '— '}
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400">
            <TokenIcon symbol={native.data?.symbol ?? meta.coin} size={16} />
            {native.data?.symbol ?? meta.coin}
          </span>
        </p>
      </div>

      <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
        {tokens.map((t, i) => {
          const res = reads.data?.[i]?.result as bigint | undefined
          const value = res !== undefined ? Number(formatUnits(res, t.decimals)) : 0
          return (
            <div key={t.address} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <TokenIcon symbol={t.symbol} size={20} />
                {t.symbol}
              </span>
              <span className="font-mono text-slate-200">{address ? fmtAmount(value, 4) : '—'}</span>
            </div>
          )
        })}
        {tokens.length === 0 && <p className="text-xs text-slate-500">No tracked tokens on this network.</p>}
      </div>

      {address && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-4">
          <span className="truncate font-mono text-xs text-slate-500">{shortAddr(address, 6)}</span>
          <CopyButton value={address} />
        </div>
      )}
    </div>
  )
}
