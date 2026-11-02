import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { CHAIN_META, TOKENS, erc20Abi } from '../lib/chains'
import { WalletButton } from '../components/WalletButton'
import { fmtAmount, shortAddr } from '../lib/format'

const ZERO = '0x0000000000000000000000000000000000000000' as const

type Asset = {
  key: string
  symbol: string
  decimals: number
  kind: 'native' | 'token'
  address?: `0x${string}`
}

type LiFiQuote = {
  estimate?: {
    fromAmount?: string
    toAmount?: string
    toAmountMin?: string
    approvalAddress?: string
    executionDuration?: number
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

export default function Swap() {
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

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

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
  }, [chain?.id])

  const from = assets.find((a) => a.key === fromKey) ?? assets[0]
  const to = assets.find((a) => a.key === toKey) ?? assets[assets.length - 1]
  const busyTx = sending || approving || busy || switching

  const toAmountRaw = quote?.estimate?.toAmount
  const toAmount = to && toAmountRaw ? Number(formatUnits(BigInt(toAmountRaw), to.decimals)) : 0
  const rate = Number(amount) > 0 ? toAmount / Number(amount) : 0

  async function fetchQuote(e?: FormEvent) {
    e?.preventDefault()
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
      const url = new URL('https://li.fi/v1/quote')
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

  async function execute() {
    if (!quote || !address || !chain || !publicClient || !from) return
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
            onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
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
          <button type="button" className="btn-primary w-full" onClick={execute} disabled={busyTx}>
            {switching
              ? 'Switching network…'
              : approving
                ? 'Approve in your wallet…'
                : sending
                  ? 'Confirm in your wallet…'
                  : busy
                    ? 'Preparing…'
                    : `Swap ${from?.symbol} → ${to?.symbol}`}
          </button>
        )}

        {hash && (
          <div className="rounded-xl border border-white/10 bg-ink-900/70 p-3 text-xs">
            <p className="text-slate-400">
              {isSuccess || confirming ? 'Swap confirmed' : 'Swap submitted'} ·{' '}
              <span className="font-mono text-slate-300">{shortAddr(hash, 8)}</span>
            </p>
            {meta && (
              <a
                href={`${meta.explorer}/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-semibold text-brand-400 hover:underline"
              >
                View on explorer →
              </a>
            )}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Quotes come from the LI.FI aggregator. A small network fee and slippage may apply. Always check the amount in
          your wallet before confirming.
        </p>
      </form>
    </div>
  )
}
