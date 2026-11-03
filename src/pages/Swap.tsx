import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { CHAIN_META, TOKENS, erc20Abi, type SupportedChainId } from '../lib/chains'
import { WalletButton } from '../components/WalletButton'
import { notify, suppressDepositAlerts } from '../lib/notifications'
import { sendEmailNotification } from '../lib/emailNotifications'
import { fmtAmount, fmtUsd, shortAddr } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { addTxHistory, updateTxHistory, type TxRecord } from '../lib/txHistory'

const ZERO = '0x0000000000000000000000000000000000000000' as const

type Asset = {
  key: string
  symbol: string
  decimals: number
  kind: 'native' | 'token'
  address?: `0x${string}`
}

function sumUsd(costs?: LiFiCost[]) {
  return (costs ?? []).reduce((total, cost) => {
    const value = Number(cost.amountUSD)
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
}

function costAmounts(costs?: LiFiCost[]) {
  const groups = new Map<string, number>()
  for (const cost of costs ?? []) {
    if (!cost.amount || cost.token?.decimals === undefined) continue
    try {
      const amount = Number(formatUnits(BigInt(cost.amount), cost.token.decimals))
      const symbol = cost.token.symbol ?? ''
      groups.set(symbol, (groups.get(symbol) ?? 0) + amount)
    } catch {
      /* ignore malformed cost */
    }
  }
  return Array.from(groups.entries())
    .map(([symbol, amount]) => `${fmtAmount(amount, 6)} ${symbol}`.trim())
    .join(' + ')
}

function SwapBalance({
  address,
  chainId,
  asset,
}: {
  address: `0x${string}`
  chainId: SupportedChainId
  asset: Asset
}) {
  const native = useBalance({
    address,
    chainId,
    query: { enabled: asset.kind === 'native', refetchInterval: 20_000 },
  })
  const token = useReadContract({
    address: asset.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
    chainId,
    query: { enabled: asset.kind === 'token', refetchInterval: 20_000 },
  })

  const raw = asset.kind === 'native' ? native.data?.value : (token.data as bigint | undefined)
  const decimals = asset.kind === 'native' ? (native.data?.decimals ?? asset.decimals) : asset.decimals
  const value = raw !== undefined ? Number(formatUnits(raw, decimals)) : null
  const loading = asset.kind === 'native' ? native.isLoading : token.isLoading

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-xs text-slate-400">Available balance</span>
      <span className="font-mono text-sm font-semibold text-slate-200">
        {loading ? 'Loading…' : value === null ? '—' : `${fmtAmount(value, 6)} ${asset.symbol}`}
      </span>
    </div>
  )
}

type LiFiCost = {
  amount?: string
  amountUSD?: string
  included?: boolean
  name?: string
  percentage?: string
  token?: { symbol?: string; decimals?: number }
}

type LiFiQuote = {
  estimate?: {
    fromAmount?: string
    toAmount?: string
    toAmountMin?: string
    fromAmountUSD?: string
    toAmountUSD?: string
    approvalAddress?: string
    executionDuration?: number
    gasCosts?: LiFiCost[]
    feeCosts?: LiFiCost[]
  }
  action?: {
    fromToken?: { symbol?: string; decimals?: number }
    toToken?: { symbol?: string; decimals?: number }
  }
  transactionRequest?: {
    to?: `0x${string}`
    data?: `0x${string}`
    value?: string
    gasLimit?: string
    chainId?: number
  }
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-mono ${strong ? 'font-semibold text-white' : 'text-slate-300'}`}>
        {value}
      </span>
    </div>
  )
}

export default function Swap() {
  const { profile } = useAuth()
  const { address, chain, isConnected } = useAccount()
  const { chains, switchChain, isPending: switching } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: chain?.id })
  const { sendTransactionAsync, isPending: sending } = useSendTransaction()
  const { writeContractAsync, isPending: approving } = useWriteContract()

  const [fromKey, setFromKey] = useState('native')
  const [toKey, setToKey] = useState('native')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<LiFiQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hash, setHash] = useState<`0x${string}`>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)

  const { isLoading: confirming, isSuccess, isError: confirmError } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!hash || !isSuccess) return
    updateTxHistory(profile?.id, hash, { status: 'confirmed' })
    const title = 'Swap confirmed'
    const body = `Transaction ${shortAddr(hash, 8)} is confirmed on-chain.`
    notify('swap', title, body)
    void sendEmailNotification('swap', title, body, `confirmed:${hash}`)
  }, [hash, isSuccess, profile?.id])

  useEffect(() => {
    if (!hash || !confirmError) return
    updateTxHistory(profile?.id, hash, { status: 'failed' })
  }, [hash, confirmError, profile?.id])

  const meta = chain ? CHAIN_META[chain.id] : undefined
  const tokens = chain ? TOKENS[chain.id] ?? [] : []
  const assets: Asset[] = chain
    ? [
        {
          key: 'native',
          symbol: chain.nativeCurrency.symbol,
          decimals: chain.nativeCurrency.decimals,
          kind: 'native',
        },
        ...tokens.map((t) => ({
          key: t.address,
          symbol: t.symbol,
          decimals: t.decimals,
          kind: 'token' as const,
          address: t.address,
        })),
      ]
    : []

  useEffect(() => {
    setFromKey('native')
    setToKey(tokens[0]?.address ?? 'native')
    setAmount('')
    setQuote(null)
    setError('')
    setStatus('')
    setReviewOpen(false)
  }, [chain?.id])

  useEffect(() => {
    setQuote(null)
    setStatus('')
    setReviewOpen(false)
  }, [amount, fromKey, toKey])

  const from = assets.find((a) => a.key === fromKey) ?? assets[0]
  const to = assets.find((a) => a.key === toKey) ?? assets[assets.length - 1]
  const busyTx = sending || approving || busy || switching

  const toAmountRaw = quote?.estimate?.toAmount
  const toAmount = to && toAmountRaw ? Number(formatUnits(BigInt(toAmountRaw), to.decimals)) : 0
  const rate = Number(amount) > 0 ? toAmount / Number(amount) : 0
  const gasUsd = sumUsd(quote?.estimate?.gasCosts)
  const feeUsd = sumUsd(quote?.estimate?.feeCosts)
  const totalFeeUsd = gasUsd + feeUsd
  const gasTokens = costAmounts(quote?.estimate?.gasCosts)
  const feeTokens = costAmounts(quote?.estimate?.feeCosts)
  const feeIncluded = (quote?.estimate?.feeCosts ?? []).some((fee) => fee.included)
  const toAmountMinRaw = quote?.estimate?.toAmountMin
  const toAmountMin = to && toAmountMinRaw ? Number(formatUnits(BigInt(toAmountMinRaw), to.decimals)) : 0
  const fromAmountUsd = Number(quote?.estimate?.fromAmountUSD ?? 0)
  const toAmountUsd = Number(quote?.estimate?.toAmountUSD ?? 0)
  const gasFeeValue = [gasTokens, gasUsd > 0 ? fmtUsd(gasUsd) : ''].filter(Boolean).join(' · ') || '—'
  const swapFeeValue = [feeTokens, feeUsd > 0 ? fmtUsd(feeUsd) : ''].filter(Boolean).join(' · ') || '—'
  const totalFeeTokens = costAmounts([...(quote?.estimate?.gasCosts ?? []), ...(quote?.estimate?.feeCosts ?? [])])
  const totalFeeValue = [totalFeeTokens, totalFeeUsd > 0 ? fmtUsd(totalFeeUsd) : ''].filter(Boolean).join(' · ') || '—'
  const feePercent = (quote?.estimate?.feeCosts ?? []).reduce((sum, fee) => sum + (Number(fee.percentage) || 0), 0)
  const feePercentLabel = feePercent > 0 ? ` (${fmtAmount(feePercent * 100, 3)}%)` : ''

  async function fetchQuote(e?: FormEvent) {
    e?.preventDefault()
    if (reviewOpen) return
    setError('')
    setStatus('')
    setQuote(null)
    if (!address || !chain || !from || !to) return
    if (from.key === to.key) {
      setError('Choose two different assets to swap.')
      return
    }
    const numeric = Number(amount)
    if (!numeric || numeric <= 0) {
      setError('Enter a valid amount.')
      return
    }
    setQuoteLoading(true)
    try {
      const fromAmount = parseUnits(amount, from.decimals).toString()
      const url = new URL('https://li.quest/v1/quote')
      url.searchParams.set('fromChain', String(chain.id))
      url.searchParams.set('toChain', String(chain.id))
      url.searchParams.set('fromToken', from.kind === 'native' ? ZERO : from.address!)
      url.searchParams.set('toToken', to.kind === 'native' ? ZERO : to.address!)
      url.searchParams.set('fromAddress', address)
      url.searchParams.set('fromAmount', fromAmount)
      url.searchParams.set('integrator', 'novawallet')
      url.searchParams.set('slippage', '0.005')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`No swap route found (HTTP ${res.status}). Try a different amount.`)
      const data = (await res.json()) as LiFiQuote
      if (!data.transactionRequest?.to || !data.transactionRequest?.data) {
        throw new Error('No swap route found for this pair.')
      }
      setQuote(data)
    } catch (err) {
      setError(err instanceof Error ? err.message.split('\n')[0] : 'Could not fetch a quote.')
    } finally {
      setQuoteLoading(false)
    }
  }

  function openReview() {
    if (!quote) return
    if (!quote.estimate?.toAmount || (!quote.estimate.gasCosts?.length && !quote.estimate.feeCosts?.length)) {
      setError('Quote is missing amount or fee details. Please get a fresh quote.')
      return
    }
    setError('')
    setReviewOpen(true)
  }

  async function execute() {
    if (!quote || !address || !chain || !publicClient || !from) return
    if (!quote.estimate?.toAmount || (!quote.estimate.gasCosts?.length && !quote.estimate.feeCosts?.length)) {
      setError('Quote is missing amount or fee details. Please get a fresh quote.')
      return
    }
    setBusy(true)
    setError('')
    setStatus('')
    try {
      if (from.kind === 'token' && quote.estimate?.approvalAddress && quote.estimate.fromAmount) {
        const allowance = await publicClient.readContract({
          address: from.address!,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, quote.estimate.approvalAddress as `0x${string}`],
        })
        if (allowance < BigInt(quote.estimate.fromAmount)) {
          setStatus(`Approve ${from.symbol} in your wallet…`)
          const approveHash = await writeContractAsync({
            address: from.address!,
            abi: erc20Abi,
            functionName: 'approve',
            args: [quote.estimate.approvalAddress as `0x${string}`, BigInt(quote.estimate.fromAmount)],
          })
          setStatus('Waiting for the approval transaction…')
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }
      }
      const tx = quote.transactionRequest!
      setStatus('Confirm the swap in your wallet…')
      const txHash = await sendTransactionAsync({
        to: tx.to!,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : undefined,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      })
      setHash(txHash)
      suppressDepositAlerts()
      const chainName = meta?.label ?? chain.name ?? 'Unknown network'
      const received = to ? `${fmtAmount(toAmount, 6)} ${to.symbol}` : 'token'
      const record: TxRecord = {
        id: txHash,
        kind: 'swap',
        title: `Swap ${from.symbol} → ${to?.symbol ?? 'token'}`,
        amount: `${amount} ${from.symbol} → ${received}`,
        from: address,
        hash: txHash,
        chainName,
        explorerUrl: meta ? `${meta.explorer}/tx/${txHash}` : undefined,
        status: 'pending',
        createdAt: Date.now(),
        note: `Swap routed through LI.FI on ${chainName}.`,
      }
      addTxHistory(profile?.id, record)
      const title = 'Swap submitted'
      const body = `${amount} ${from.symbol} → ${to?.symbol ?? 'token'} submitted. Waiting for confirmation.`
      notify('swap', title, body)
      void sendEmailNotification('swap', title, body, `submitted:${txHash}`)
      setStatus('Swap submitted. Waiting for confirmation…')
    } catch (err) {
      setError(err instanceof Error ? err.message.split('\n')[0] : 'The swap was rejected.')
    } finally {
      setBusy(false)
    }
  }

  if (!isConnected || !chain || !address) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Swap</h1>
          <p className="mt-1 text-sm text-slate-400">Exchange tokens on the same network in one signed transaction.</p>
        </div>
        <div className="card space-y-3 p-6 text-center">
          <p className="text-sm font-semibold text-white">Connect a wallet to swap</p>
          <p className="text-xs leading-relaxed text-slate-400">
            Swaps are executed by your wallet through the LI.FI aggregator. NovaWallet never holds your funds.
          </p>
          <div className="flex justify-center">
            <WalletButton compact />
          </div>
          <Link to="/dashboard#local-wallet" className="text-xs font-semibold text-brand-400 hover:underline">
            Or create / unlock the on-device NovaWallet →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Swap</h1>
        <p className="mt-1 text-sm text-slate-400">
          Same-network token swaps via LI.FI. You sign and confirm every transaction in your own wallet.
        </p>
      </div>

      <form onSubmit={fetchQuote} className="card space-y-4 p-6">
        <div>
          <label className="label">Network</label>
          <select
            className="input"
            value={chain.id}
            onChange={(e) => switchChain({ chainId: Number(e.target.value) as SupportedChainId })}
            disabled={switching}
          >
            {chains.map((c) => (
              <option key={c.id} value={c.id} className="bg-ink-900">
                {CHAIN_META[c.id]?.label ?? c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">From</label>
            <select className="input" value={fromKey} onChange={(e) => setFromKey(e.target.value)}>
              {assets.map((a) => (
                <option key={a.key} value={a.key} className="bg-ink-900">
                  {a.symbol}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">To</label>
            <select className="input" value={toKey} onChange={(e) => setToKey(e.target.value)}>
              {assets.map((a) => (
                <option key={a.key} value={a.key} className="bg-ink-900">
                  {a.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Amount ({from?.symbol ?? '—'})</label>
          <input
            className="input font-mono"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setQuote(null)
            }}
          />
        </div>

        {from && <SwapBalance address={address} chainId={chain.id as SupportedChainId} asset={from} />}

        {quote && (
          <div className="rounded-xl border border-white/10 bg-ink-900/70 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">You receive (estimated)</span>
              <span className="font-mono font-semibold text-white">
                {fmtAmount(toAmount, 6)} {to?.symbol}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Rate</span>
              <span className="font-mono text-slate-300">
                1 {from?.symbol} ≈ {fmtAmount(rate, 6)} {to?.symbol}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Network fee (estimated)</span>
              <span className="font-mono text-slate-300">
                {gasTokens}
                {gasTokens && gasUsd > 0 ? ' · ' : ''}
                {gasUsd > 0 ? fmtUsd(gasUsd) : gasTokens ? '' : '—'}
              </span>
            </div>
            {(feeUsd > 0 || feeTokens) && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Swap fee{feePercentLabel}{feeIncluded ? ' (included)' : ''}</span>
                <span className="font-mono text-slate-300">
                  {feeTokens}
                  {feeTokens && feeUsd > 0 ? ' · ' : ''}
                  {feeUsd > 0 ? fmtUsd(feeUsd) : ''}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-1.5">
              <span className="text-slate-400">Total fees (estimated)</span>
              <span className="font-mono font-semibold text-white">{totalFeeValue}</span>
            </div>
            {quote.estimate?.executionDuration !== undefined && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Estimated time</span>
                <span className="text-slate-300">{quote.estimate.executionDuration}s</span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {status && <p className="text-xs text-accent-400">{status}</p>}

        {!quote ? (
          <button className="btn-primary w-full" disabled={quoteLoading || !amount || from?.key === to?.key}>
            {quoteLoading ? 'Finding best route…' : 'Get swap quote'}
          </button>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={openReview} disabled={busyTx}>
            {switching
              ? 'Switching network…'
              : approving
                ? 'Approve in your wallet…'
                : sending
                  ? 'Confirm in your wallet…'
                  : busy
                    ? 'Preparing…'
                    : 'Review & confirm swap'}
          </button>
        )}

        {hash && (
          <div className="rounded-xl border border-white/10 bg-ink-900/70 p-3 text-xs">
            <p className="text-slate-400">
              {isSuccess || confirming ? 'Swap confirmed' : 'Swap submitted'} ·{' '}
              <span className="font-mono text-slate-300">{shortAddr(hash, 8)}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {meta && (
                <a
                  href={`${meta.explorer}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-400 hover:underline"
                >
                  View on explorer →
                </a>
              )}
              <Link to="/history" className="font-semibold text-brand-400 hover:underline">
                View history →
              </Link>
            </div>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Quotes come from the LI.FI aggregator. The swap fee is LI.FI's provider fee and is taken from the amount you
          swap; the network fee is paid in gas. Always check the amount in your wallet before confirming.
        </p>
      </form>

      {reviewOpen && quote && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReviewOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">Confirm swap</h2>
                <p className="mt-1 text-xs text-slate-400">Check the amount and fees before your wallet opens.</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-white/5 hover:text-white"
                onClick={() => setReviewOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-ink-950/60 p-3 text-xs">
              <SummaryRow
                label="You pay"
                value={`${amount} ${from?.symbol ?? ''}${fromAmountUsd > 0 ? ` (${fmtUsd(fromAmountUsd)})` : ''}`}
              />
              <SummaryRow
                label="You receive (estimated)"
                value={`${fmtAmount(toAmount, 6)} ${to?.symbol ?? ''}${toAmountUsd > 0 ? ` (${fmtUsd(toAmountUsd)})` : ''}`}
              />
              {toAmountMin > 0 && (
                <SummaryRow
                  label="Minimum received"
                  value={`${fmtAmount(toAmountMin, 6)} ${to?.symbol ?? ''}`}
                />
              )}
              <SummaryRow label="Network fee (estimated)" value={gasFeeValue} />
              {(feeUsd > 0 || feeTokens) && (
                <SummaryRow label={`Swap fee${feePercentLabel}${feeIncluded ? ' (included)' : ''}`} value={swapFeeValue} />
              )}
              <div className="border-t border-white/10 pt-2">
                <SummaryRow label="Total fees (estimated)" value={totalFeeValue} strong />
              </div>
              <SummaryRow
                label="Rate"
                value={`1 ${from?.symbol ?? ''} ≈ ${fmtAmount(rate, 6)} ${to?.symbol ?? ''}`}
              />
              {quote.estimate?.executionDuration !== undefined && (
                <SummaryRow label="Estimated time" value={`${quote.estimate.executionDuration}s`} />
              )}
            </div>

            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setReviewOpen(false)}
                disabled={busyTx}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => {
                  setReviewOpen(false)
                  void execute()
                }}
                disabled={busyTx}
              >
                Confirm & swap
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Nothing is sent until you confirm. Your wallet will open for the final signature.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
