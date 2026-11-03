import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
import { CopyButton } from './CopyButton'
import { fmtAmount, shortAddr } from '../lib/format'
import { useReceiveAddress } from '../hooks/useReceiveAddress'
import { addTxHistory, updateTxHistory, type TxRecord } from '../lib/txHistory'
import { getKeystore, localWalletStore } from '../lib/localWallet'

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

function ReceiptRow({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/5 py-2 first:border-0 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="flex min-w-0 items-start justify-end gap-2 text-right">
        <span className="break-all font-mono text-xs text-slate-200">{value}</span>
        {children}
      </span>
    </div>
  )
}

export function SendPanel() {
  const { address, chain, isConnected } = useAccount()
  const { profile } = useAuth()
  const { address: receiveAddress, source: receiveSource } = useReceiveAddress()
  const localWallet = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )
  const keystore = getKeystore()
  const localUnlocked = Boolean(localWallet.address)
  const hasLocalWallet = localUnlocked || Boolean(keystore)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [assetKey, setAssetKey] = useState('native')
  const [hash, setHash] = useState<`0x${string}` | undefined>()
  const [receipt, setReceipt] = useState<TxRecord | null>(null)
  const [error, setError] = useState('')
  const [authorized, setAuthorized] = useState(false)

  const { sendTransactionAsync, isPending: sending } = useSendTransaction()
  const { writeContractAsync, isPending: writing } = useWriteContract()
  const { isLoading: confirming, isSuccess, isError: confirmError } = useWaitForTransactionReceipt({ hash })
  const { chains, switchChain, isPending: switching, error: switchError } = useSwitchChain()

  useEffect(() => {
    setAssetKey('native')
  }, [chain?.id])

  useEffect(() => {
    setAuthorized(isWithdrawalAuthorized(profile?.id))
  }, [profile?.id])

  useEffect(() => {
    if (!hash || !isSuccess) return
    updateTxHistory(profile?.id, hash, { status: 'confirmed' })
    setReceipt((prev) => (prev && prev.hash === hash ? { ...prev, status: 'confirmed' } : prev))
    const title = 'Withdrawal confirmed'
    const body = `Transaction ${shortAddr(hash, 8)} is confirmed on-chain.`
    notify('withdrawal', title, body)
    void sendEmailNotification('withdrawal', title, body, `confirmed:${hash}`)
  }, [hash, isSuccess, profile?.id])

  useEffect(() => {
    if (!hash || !confirmError) return
    updateTxHistory(profile?.id, hash, { status: 'failed' })
    setReceipt((prev) => (prev && prev.hash === hash ? { ...prev, status: 'failed' } : prev))
  }, [hash, confirmError, profile?.id])

  if (!isConnected || !chain || !address) {
    return (
      <div className="card space-y-3 p-6">
        <div>
          <p className="text-sm font-semibold text-white">
            {localUnlocked
              ? 'Opening your saved NovaWallet…'
              : hasLocalWallet
                ? 'Unlock your NovaWallet to send'
                : 'Add a wallet to send'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {localUnlocked
              ? 'Your wallet is already saved on this device, so it reconnects automatically.'
              : hasLocalWallet
                ? 'Unlock the wallet saved on this device. No reconnection is needed after that.'
                : "Transactions are always signed inside your connected wallet. NovaWallet's servers never hold your keys."}
          </p>
        </div>
        {receiveAddress && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              {receiveSource === 'watch' ? 'Tracked address (read-only)' : 'Wallet address'}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-slate-200">{receiveAddress}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {receiveSource === 'local'
                ? 'Unlock this wallet to send from it.'
                : 'Open the wallet that controls this address to send from it.'}
            </p>
          </div>
        )}
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
    setReceipt(null)
    if (!isAddress(to)) {
      setError('Enter a valid recipient address.')
      return
    }
    const numeric = Number(amount)
    if (!numeric || numeric <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (!address || !chain) {
      setError('Open a wallet first.')
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
      const chainName = meta?.label ?? chain?.name ?? 'Unknown network'
      const record: TxRecord = {
        id: txHash,
        kind: 'withdrawal',
        title: `Withdrawal ${asset.symbol}`,
        amount: `${amount} ${asset.symbol}`,
        from: address,
        recipient: to,
        hash: txHash,
        chainName,
        explorerUrl: meta ? `${meta.explorer}/tx/${txHash}` : undefined,
        status: 'pending',
        createdAt: Date.now(),
        note: `Sent from your connected wallet on ${chainName}.`,
      }
      addTxHistory(profile?.id, record)
      setReceipt(record)
      const title = 'Withdrawal submitted'
      const body = `${amount} ${asset.symbol} sent on ${chain?.name ?? 'the network'}. Waiting for confirmation.`
      notify('withdrawal', title, body)
      void sendEmailNotification('withdrawal', title, body, `submitted:${txHash}`)
      await logAudit('send_submitted', {
        chain: chain?.name ?? 'unknown',
        asset: asset.symbol,
        to,
        amount,
        hash: txHash,
      })
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

      {receipt && (
        <div className="rounded-xl border border-white/10 bg-ink-900/70 p-4 text-xs">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-white">
              {receipt.status === 'confirmed'
                ? 'Withdrawal confirmed'
                : receipt.status === 'failed'
                  ? 'Withdrawal failed'
                  : 'Withdrawal submitted'}
            </p>
            <span
              className={`badge ${
                receipt.status === 'confirmed'
                  ? 'border-accent-500/30 bg-accent-500/10 text-accent-400'
                  : receipt.status === 'failed'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {receipt.status === 'confirmed' ? 'Confirmed' : receipt.status === 'failed' ? 'Failed' : 'Pending'}
            </span>
          </div>

          <div className="mt-3">
            <ReceiptRow label="Transaction ID" value={receipt.hash}>
              <CopyButton value={receipt.hash} label="Copy" />
            </ReceiptRow>
            <ReceiptRow label="From address" value={receipt.from}>
              <CopyButton value={receipt.from} label="Copy" />
            </ReceiptRow>
            <ReceiptRow label="Recipient address" value={receipt.recipient ?? '—'}>
              {receipt.recipient && <CopyButton value={receipt.recipient} label="Copy" />}
            </ReceiptRow>
            <ReceiptRow label="Amount" value={receipt.amount} />
            <ReceiptRow label="Network" value={receipt.chainName} />
            <ReceiptRow label="Time" value={new Date(receipt.createdAt).toLocaleString()} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {receipt.explorerUrl && (
              <a
                href={receipt.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary !px-3 !py-1.5 text-xs"
              >
                View on explorer →
              </a>
            )}
            <Link to="/history" className="btn-secondary !px-3 !py-1.5 text-xs">
              View history
            </Link>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        You sign every transaction in your connected wallet. External secrets stay in your wallet; a local wallet
        secret is encrypted in your browser and never sent to our servers.
      </p>
    </form>
  )
}
