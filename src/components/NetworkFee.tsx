import { useMemo } from 'react'
import { encodeFunctionData, formatUnits, isAddress, parseUnits } from 'viem'
import { useEstimateGas, useGasPrice } from 'wagmi'
import { erc20Abi, type SupportedChainId } from '../lib/chains'
import { fmtAmount } from '../lib/format'

type FeeAsset = {
  symbol: string
  decimals: number
  kind: 'native' | 'token'
  address?: `0x${string}`
}

type Props = {
  address: `0x${string}`
  chainId: SupportedChainId
  nativeSymbol: string
  nativeDecimals: number
  asset: FeeAsset
  to: string
  amount: string
}

export function NetworkFee({ address, chainId, nativeSymbol, nativeDecimals, asset, to, amount }: Props) {
  const parsed = useMemo(() => {
    if (!amount.trim()) return undefined
    try {
      return parseUnits(amount.trim(), asset.decimals)
    } catch {
      return undefined
    }
  }, [amount, asset.decimals])

  const recipient = isAddress(to) ? (to as `0x${string}`) : undefined
  const enabled = Boolean(recipient && parsed !== undefined && parsed > BigInt(0))

  const gas = useEstimateGas({
    account: address,
    chainId,
    to: asset.kind === 'native' ? recipient : asset.address,
    value: asset.kind === 'native' ? parsed : undefined,
    data:
      asset.kind === 'token' && recipient && parsed !== undefined
        ? encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient, parsed],
          })
        : undefined,
    query: { enabled, retry: false, staleTime: 15_000 },
  })

  const gasPrice = useGasPrice({
    chainId,
    query: { enabled, retry: false, staleTime: 15_000 },
  })

  const feeWei =
    gas.data !== undefined && gasPrice.data !== undefined ? gas.data * gasPrice.data : undefined
  const fee = feeWei !== undefined ? Number(formatUnits(feeWei, nativeDecimals)) : undefined
  const total =
    asset.kind === 'native' && feeWei !== undefined && parsed !== undefined
      ? Number(formatUnits(parsed + feeWei, nativeDecimals))
      : undefined

  const loading = gas.isLoading || gasPrice.isLoading
  const unavailable = gas.isError || gasPrice.isError

  return (
    <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400">Network fee (estimated)</span>
        <span className="font-mono font-semibold text-slate-200">
          {!enabled
            ? '—'
            : loading
              ? 'Estimating…'
              : fee !== undefined
                ? `${fmtAmount(fee, 8)} ${nativeSymbol}`
                : 'Unavailable'}
        </span>
      </div>
      {total !== undefined && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Total (amount + fee)</span>
          <span className="font-mono font-semibold text-slate-200">
            {fmtAmount(total, 8)} {nativeSymbol}
          </span>
        </div>
      )}
      {unavailable && enabled && (
        <p className="text-[11px] leading-relaxed text-amber-400">
          Could not estimate the network fee. Your wallet will show the final fee before you confirm.
        </p>
      )}
      {enabled && !unavailable && !loading && (
        <p className="text-[10px] leading-relaxed text-slate-500">
          Fee estimate changes with network congestion. It is paid in {nativeSymbol}.
        </p>
      )}
    </div>
  )
}
