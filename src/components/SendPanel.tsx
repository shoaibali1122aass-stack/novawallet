import { useEffect, useState, type FormEvent } from 'react'
import {
  useAccount,
  useBalance,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { CHAIN_META, TOKENS, erc20Abi, type SupportedChainId } from '../lib/chains'
import { useAuth } from '../context/AuthContext'
import { logAudit } from '../lib/audit'
import { notify } from '../lib/notifications'
import { sendEmailNotification } from '../lib/emailNotifications'
import { AuthorizationGate, isWithdrawalAuthorized } from './AuthorizationGate'
import { NetworkFee } from './NetworkFee'
import { WalletConnectPrompt } from './WalletConnectPrompt'
import { fmtAmount, shortAddr } from '../lib/format'

type Asset = {
  key: string
  symbol: string
  decimals: number
  kind: 'native' | 'token'
  address?: `0x${string}`
}

function AvailableBalance({
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

export function SendPanel() {
  const { address, chain, isConnected } = useAccount()
  const { profile } = useAuth()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [assetKey, setAssetKey] = useState('native')
  const [hash, setHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState('')
  const [authorized, setAuthorized] = useState(false)

  const { sendTransactionAsync, isPending: sending } = useSendTransaction()
  const { writeContractAsync, isPending: writing } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { chains, switchChain, isPending: switching, error: switchError } = useSwitchChain()

  useEffect(() => {
    setAssetKey('native')
  }, [chain?.id])

  useEffect(() => {
    setAuthorized(isWithdrawalAuthorized(profile?.id))
  }, [profile?.id])

  useEffect(() => {
    if (!hash || !isSuccess) return
    const title = 'Withdrawal confirmed'
    const body = `Transaction ${shortAddr(hash, 8)} is confirmed on-chain.`
    notify('withdrawal', title, body)
    void sendEmailNotification('withdrawal', title, body, `confirmed:${hash}`)
  }, [hash, isSuccess])

  if (!isConnected || !chain || !address) {
    return (
      <div className="card space-y-3 p-6">
        <div>
          <p className="text-sm font-semibold text-white">Connect a wallet to send</p>
          <p className="mt-1 text-xs text-slate-400">
            Transactions are always signed inside your connected wallet. NovaWallet's servers never hold your keys.
          </p>
        </div>
        <WalletConnectPrompt />
      </div>
    )
  }

  const meta = CHAIN_META[chain.id]
  const supported = Boolean(meta)
  const tokens = TOKENS[chain.id] ?? []
  const assets: Asset[] = [
    { key: 'native', symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals, kind: 'native' },
    ...tokens.map((t) => ({
      key: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
      kind: 'token' as const,
      address: t.address,
    })),
  ]
  const asset = assets.find((a) => a.key === assetKey) ?? assets[0]

  if (profile?.withdrawal_lock && !authorized) {
    return (
      <div className="card p-6">
        <AuthorizationGate
          onAuthorized={() => {
            setAuthorized(true)
            setError('')
          }}
        />
      </div>
    )
  }

  const busy = sending || writing || confirming || switching

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setHash(undefined)
    if (!isAddress(to)) {
      setError('Enter a valid recipient address.')
      return
    }
    const numeric = Number(amount)
    if (!numeric || numeric <= 0) {
      setError('Enter a valid amount.')
      return
    }
    try {
      const parsed = parseUnits(amount, asset.decimals)
      let txHash: `0x${string}`
      if (asset.kind === 'native') {
        txHash = await sendTransactionAsync({ to: to as `0x${string}`, value: parsed })
      } else {
        txHash = await writeContractAsync({
          address: asset.address!,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to as `0x${string}`, parsed],
        })
      }
      setHash(txHash)
      const title = 'Withdrawal submitted'
      const body = `${amount} ${asset.symbol} sent on ${chain?.name ?? 'the network'}. Waiting for confirmation.`
      notify('withdrawal', title, body)
      void sendEmailNotification('withdrawal', title, body, `submitted:${txHash}`)
      await logAudit('send_submitted', { chain: chain?.name ?? 'unknown', asset: asset.symbol, to, amount })
    } catch (err) {
      setError(err instanceof Error ? err.message.split('\n')[0] : 'Transaction was rejected.')
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Send on {meta?.label ?? chain.name}</h3>
        <span className="badge border-white/10 bg-white/5 font-mono text-slate-400">{shortAddr(address)}</span>
      </div>

      <div>
        <label className="label">Network</label>
        <select
          className="input"
          value={chain.id}
          onChange={(e) => switchChain({ chainId: Number(e.target.value) as SupportedChainId })}
          disabled={switching}
        >
          {!supported && (
            <option value={chain.id} className="bg-ink-900">
              {chain.name} (unsupported)
            </option>
          )}
          {chains.map((c) => (
            <option key={c.id} value={c.id} className="bg-ink-900">
              {CHAIN_META[c.id]?.label ?? c.name}
            </option>
          ))}
        </select>
        {switchError && <p className="mt-1.5 text-xs text-rose-400">{switchError.message.split('\n')[0]}</p>}
        {!supported && (
          <p className="mt-1.5 text-xs leading-relaxed text-amber-400">
            This network is not supported for in-app sending. Switch to Ethereum, BNB Chain, Polygon, Arbitrum or Base.
          </p>
        )}
      </div>

      <div>
        <label className="label">Asset</label>
        <select className="input" value={assetKey} onChange={(e) => setAssetKey(e.target.value)}>
          {assets.map((a) => (
            <option key={a.key} value={a.key} className="bg-ink-900">
              {a.symbol} {a.kind === 'native' ? '(native)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Recipient address</label>
        <input
          className="input font-mono text-xs"
          placeholder="0x…"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div>
        <label className="label">Amount ({asset.symbol})</label>
        <input
          className="input font-mono"
          placeholder="0.00"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <NetworkFee
        address={address}
        chainId={chain.id as SupportedChainId}
        nativeSymbol={chain.nativeCurrency.symbol}
        nativeDecimals={chain.nativeCurrency.decimals}
        asset={asset}
        to={to}
        amount={amount}
      />

      <AvailableBalance address={address} chainId={chain.id} asset={asset} />

      <button className="btn-primary w-full" disabled={busy || !supported}>
        {switching
          ? 'Switching network…'
          : sending || writing
            ? 'Confirm in your wallet…'
            : confirming
              ? 'Waiting for confirmation…'
              : 'Review & send'}
      </button>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {hash && (
        <div className="rounded-xl border border-white/10 bg-ink-900/70 p-3 text-xs">
          <p className="text-slate-400">
            {isSuccess ? 'Transaction confirmed' : 'Transaction submitted'} ·{' '}
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
        You sign every transaction in your connected wallet. External secrets stay in your wallet; a local wallet
        secret is encrypted in your browser and never sent to our servers.
      </p>
    </form>
  )
}
