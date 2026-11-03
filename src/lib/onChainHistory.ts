import { formatUnits } from 'viem'
import { CHAIN_META, TOKENS, type SupportedChainId } from './chains'
import { fmtAmount } from './format'
import type { TxRecord, TxStatus } from './txHistory'

export type OnChainAddresses = {
  evm?: string | null
  btc?: string | null
  sol?: string | null
}

export type OnChainFetchResult = {
  records: TxRecord[]
  errors: string[]
}

type Json = Record<string, unknown>

const EVM_CHAINS: SupportedChainId[] = [1, 56, 137, 42161, 8453]
const BLOCKSCOUT: Partial<Record<SupportedChainId, string>> = {
  1: 'https://eth.blockscout.com',
  137: 'https://polygon.blockscout.com',
  42161: 'https://arbitrum.blockscout.com',
  8453: 'https://base.blockscout.com',
}
const BTC_APIS = ['https://mempool.space', 'https://blockstream.info']
const SOL_RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com']
const CACHE_TTL = 5 * 60 * 1000
const cache = new Map<string, { at: number; data: unknown }>()

function obj(value: unknown): Json {
  return value && typeof value === 'object' ? (value as Json) : {}
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return ''
}

function rawBig(value: unknown): bigint {
  if (typeof value === 'string' && value.length) {
    try {
      return BigInt(value)
    } catch {
      return 0n
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === 'bigint') return value
  return 0n
}

function timestamp(value: unknown): number {
  const raw = str(value)
  const time = raw ? Date.parse(raw) : NaN
  return Number.isFinite(time) ? time : Date.now()
}

function amountText(value: unknown, decimals: unknown, symbol: string): string {
  const scale = Math.max(0, Math.min(36, Number(decimals) || 0))
  try {
    return `${fmtAmount(Number(formatUnits(rawBig(value), scale)), 8)} ${symbol}`
  } catch {
    return `0 ${symbol}`
  }
}

function cacheGet(url: string): unknown {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data
  return null
}

function cacheSet(url: string, data: unknown) {
  cache.set(url, { at: Date.now(), data })
}

export function clearOnChainCache() {
  cache.clear()
}

async function readJson(url: string, signal: AbortSignal, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const objectStart = body.indexOf('{')
    const arrayStart = body.indexOf('[')
    const start =
      arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart) ? arrayStart : objectStart
    if (start < 0) throw new Error('Unexpected explorer response')
    return JSON.parse(body.slice(start)) as unknown
  } finally {
    window.clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const cached = cacheGet(url)
  if (cached !== null) return cached
  const data = await readJson(url, signal, 8_000)
  cacheSet(url, data)
  return data
}

function itemsFrom(payload: unknown): unknown[] {
  const items = arr(obj(payload).items)
  if (!Object.prototype.hasOwnProperty.call(obj(payload), 'items')) throw new Error('Unexpected explorer response')
  return items
}

function evmRecord(params: {
  chainId: SupportedChainId
  hash: string
  idSuffix: string
  incoming: boolean
  from: string
  to: string
  amount: string
  status: TxStatus
  createdAt: number
  note: string
}): TxRecord {
  const meta = CHAIN_META[params.chainId]
  return {
    id: `onchain:${params.chainId}:${params.hash}:${params.idSuffix}`,
    kind: params.incoming ? 'deposit' : 'withdrawal',
    title: `${params.incoming ? 'Received' : 'Sent'} ${meta.coin}`,
    amount: params.amount,
    from: params.from,
    recipient: params.to,
    hash: params.hash,
    chainId: params.chainId,
    chainName: meta.label,
    explorerUrl: `${meta.explorer}/tx/${params.hash}`,
    status: params.status,
    createdAt: params.createdAt,
    note: params.note,
    source: 'onchain',
  }
}

function parseBlockscoutTx(payload: unknown, chainId: SupportedChainId, userAddress: string): TxRecord[] {
  const user = userAddress.toLowerCase()
  const records: TxRecord[] = []
  for (const item of itemsFrom(payload)) {
    const tx = obj(item)
    const hash = str(tx.hash)
    if (!hash) continue
    const from = str(obj(tx.from).hash)
    const to = str(obj(tx.to).hash)
    const incoming = to.toLowerCase() === user
    const outgoing = from.toLowerCase() === user
    if (!incoming && !outgoing) continue
    if (rawBig(tx.value) <= 0n) continue
    const failed = str(tx.status) === 'error' || str(tx.result) === 'error'
    const meta = CHAIN_META[chainId]
    records.push({
      ...evmRecord({
        chainId,
        hash,
        idSuffix: 'native',
        incoming,
        from: incoming ? from : userAddress,
        to: incoming ? userAddress : to,
        amount: amountText(tx.value, 18, meta.coin),
        status: failed ? 'failed' : 'confirmed',
        createdAt: timestamp(tx.timestamp),
        note: 'On-chain transaction',
      }),
      title: `${incoming ? 'Received' : 'Sent'} ${meta.coin}`,
    })
  }
  return records
}

function parseBlockscoutToken(payload: unknown, chainId: SupportedChainId, userAddress: string): TxRecord[] {
  const user = userAddress.toLowerCase()
  const records: TxRecord[] = []
  for (const item of itemsFrom(payload)) {
    const tx = obj(item)
    const hash = str(tx.transaction_hash)
    if (!hash) continue
    const from = str(obj(tx.from).hash)
    const to = str(obj(tx.to).hash)
    const incoming = to.toLowerCase() === user
    const outgoing = from.toLowerCase() === user
    if (!incoming && !outgoing) continue
    const token = obj(tx.token)
    const total = obj(tx.total)
    const symbol = str(token.symbol) || 'Token'
    const tokenAddress = str(token.address_hash)
    const logIndex = text(tx.log_index)
    records.push({
      id: `onchain:${chainId}:${hash}:token:${tokenAddress.toLowerCase()}:${logIndex}`,
      kind: incoming ? 'deposit' : 'withdrawal',
      title: `${incoming ? 'Received' : 'Sent'} ${symbol}`,
      amount: amountText(total.value, total.decimals ?? token.decimals ?? 18, symbol),
      from: incoming ? from : userAddress,
      recipient: incoming ? userAddress : to,
      hash,
      chainId,
      chainName: CHAIN_META[chainId].label,
      explorerUrl: `${CHAIN_META[chainId].explorer}/tx/${hash}`,
      status: 'confirmed',
      createdAt: timestamp(tx.timestamp),
      note: `On-chain token transfer${str(token.name) ? ` · ${str(token.name)}` : ''}`,
      source: 'onchain',
    })
  }
  return records
}

function parseRoutescanTx(payload: unknown, chainId: SupportedChainId, userAddress: string): TxRecord[] {
  const user = userAddress.toLowerCase()
  const records: TxRecord[] = []
  for (const item of itemsFrom(payload)) {
    const tx = obj(item)
    const hash = str(tx.id)
    if (!hash) continue
    const from = str(tx.from)
    const to = str(tx.to)
    const incoming = to.toLowerCase() === user
    const outgoing = from.toLowerCase() === user
    if (!incoming && !outgoing) continue
    if (rawBig(tx.value) <= 0n) continue
    const meta = CHAIN_META[chainId]
    records.push({
      ...evmRecord({
        chainId,
        hash,
        idSuffix: 'native',
        incoming,
        from: incoming ? from : userAddress,
        to: incoming ? userAddress : to,
        amount: amountText(tx.value, 18, meta.coin),
        status: tx.status === false ? 'failed' : 'confirmed',
        createdAt: timestamp(tx.timestamp),
        note: 'On-chain transaction',
      }),
      title: `${incoming ? 'Received' : 'Sent'} ${meta.coin}`,
    })
  }
  return records
}

function parseRoutescanToken(payload: unknown, chainId: SupportedChainId, userAddress: string): TxRecord[] {
  const user = userAddress.toLowerCase()
  const records: TxRecord[] = []
  for (const item of itemsFrom(payload)) {
    const tx = obj(item)
    const hash = str(tx.txHash)
    if (!hash) continue
    const from = str(tx.from)
    const to = str(tx.to)
    const incoming = to.toLowerCase() === user
    const outgoing = from.toLowerCase() === user
    if (!incoming && !outgoing) continue
    const symbol = str(tx.tokenSymbol) || 'Token'
    const tokenAddress = str(tx.tokenAddress)
    records.push({
      id: `onchain:${chainId}:${hash}:token:${tokenAddress.toLowerCase()}:${text(tx.logIndex)}`,
      kind: incoming ? 'deposit' : 'withdrawal',
      title: `${incoming ? 'Received' : 'Sent'} ${symbol}`,
      amount: amountText(tx.amount, tx.tokenDecimals ?? 18, symbol),
      from: incoming ? from : userAddress,
      recipient: incoming ? userAddress : to,
      hash,
      chainId,
      chainName: CHAIN_META[chainId].label,
      explorerUrl: `${CHAIN_META[chainId].explorer}/tx/${hash}`,
      status: 'confirmed',
      createdAt: timestamp(tx.timestamp),
      note: `On-chain token transfer${str(tx.tokenName) ? ` · ${str(tx.tokenName)}` : ''}`,
      source: 'onchain',
    })
  }
  return records
}

async function fetchBlockscout(
  chainId: SupportedChainId,
  address: string,
  signal: AbortSignal,
): Promise<TxRecord[]> {
  const base = BLOCKSCOUT[chainId]
  if (!base) throw new Error('No Blockscout explorer configured')
  const root = `${base}/api/v2/addresses/${encodeURIComponent(address)}`
  const [native, tokens] = await Promise.allSettled([
    fetchJson(`${root}/transactions`, signal),
    fetchJson(`${root}/token-transfers?type=ERC-20`, signal),
  ])
  if (native.status === 'rejected' && tokens.status === 'rejected') {
    throw native.reason instanceof Error ? native.reason : new Error('Explorer unavailable')
  }
  const records: TxRecord[] = []
  if (native.status === 'fulfilled') records.push(...parseBlockscoutTx(native.value, chainId, address))
  if (tokens.status === 'fulfilled') records.push(...parseBlockscoutToken(tokens.value, chainId, address))
  return records
}

async function fetchRoutescan(
  chainId: SupportedChainId,
  address: string,
  signal: AbortSignal,
): Promise<TxRecord[]> {
  const root = `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/address/${encodeURIComponent(address)}`
  const [native, tokens] = await Promise.allSettled([
    fetchJson(`${root}/transactions?limit=50`, signal),
    fetchJson(`${root}/erc20-transfers?limit=50`, signal),
  ])
  if (native.status === 'rejected' && tokens.status === 'rejected') {
    throw native.reason instanceof Error ? native.reason : new Error('Explorer unavailable')
  }
  const records: TxRecord[] = []
  if (native.status === 'fulfilled') records.push(...parseRoutescanTx(native.value, chainId, address))
  if (tokens.status === 'fulfilled') records.push(...parseRoutescanToken(tokens.value, chainId, address))
  return records
}

async function bscRpc(method: string, params: unknown[], signal: AbortSignal): Promise<string> {
  const res = await fetch('https://bsc-dataseed.bnbchain.org', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { error?: { message?: string }; result?: string }
  if (!res.ok || json.error || typeof json.result !== 'string') {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`)
  }
  return json.result
}

async function hasBscActivity(address: string, signal: AbortSignal): Promise<boolean> {
  try {
    const [nonce, balance] = await Promise.all([
      bscRpc('eth_getTransactionCount', [address, 'latest'], signal),
      bscRpc('eth_getBalance', [address, 'latest'], signal),
    ])
    return BigInt(nonce) > 0n || BigInt(balance) > 0n
  } catch {
    return false
  }
}

function parseBscNative(payload: unknown, address: string): TxRecord[] {
  const user = address.toLowerCase()
  const meta = CHAIN_META[56]
  const records: TxRecord[] = []
  for (const item of arr(obj(payload).transactions)) {
    const tx = obj(item)
    const hash = str(tx.hash)
    if (!hash) continue
    const from = str(tx.fromAddress)
    const to = str(tx.toAddress)
    const incoming = to.toLowerCase() === user
    const outgoing = from.toLowerCase() === user
    if (!incoming && !outgoing) continue
    const raw = rawBig(str(tx.value).split('.')[0])
    if (raw <= 0n) continue
    records.push({
      ...evmRecord({
        chainId: 56,
        hash,
        idSuffix: 'native',
        incoming,
        from: incoming ? from : address,
        to: incoming ? address : to,
        amount: amountText(raw, 18, meta.coin),
        status: tx.status === false ? 'failed' : 'confirmed',
        createdAt: timestamp(tx.timestamp),
        note: 'On-chain transaction · recent BNB Chain index',
      }),
      title: `${incoming ? 'Received' : 'Sent'} ${meta.coin}`,
    })
  }
  return records
}

function parseBscToken(payload: unknown, address: string): TxRecord[] {
  const user = address.toLowerCase()
  const tokens = new Map(TOKENS[56].map((token) => [token.address.toLowerCase(), token]))
  const records: TxRecord[] = []
  for (const item of arr(obj(payload).tokenTransfers)) {
    const tx = obj(item)
    const hash = str(tx.txHash)
    if (!hash) continue
    const from = str(tx.fromAddress)
    const to = str(tx.toAddress)
    const incoming = to.toLowerCase() === user
    const outgoing = from.toLowerCase() === user
    if (!incoming && !outgoing) continue
    const tokenAddress = str(tx.tokenAddress)
    const token = tokens.get(tokenAddress.toLowerCase())
    const symbol = token?.symbol ?? 'Token'
    records.push({
      id: `onchain:56:${hash}:token:${tokenAddress.toLowerCase()}:${text(tx.logIndex)}`,
      kind: incoming ? 'deposit' : 'withdrawal',
      title: `${incoming ? 'Received' : 'Sent'} ${symbol}`,
      amount: amountText(tx.value, token?.decimals ?? 18, symbol),
      from: incoming ? from : address,
      recipient: incoming ? address : to,
      hash,
      chainId: 56,
      chainName: CHAIN_META[56].label,
      explorerUrl: `${CHAIN_META[56].explorer}/tx/${hash}`,
      status: 'confirmed',
      createdAt: timestamp(tx.timestamp),
      note: 'On-chain token transfer · recent BNB Chain index',
      source: 'onchain',
    })
  }
  return records
}

async function fetchBsc(address: string, signal: AbortSignal): Promise<TxRecord[]> {
  const payload = await fetchJson(
    `https://bnbscan.com/api/v1/addresses/${encodeURIComponent(address)}`,
    signal,
  )
  const data = obj(payload)
  const records = [...parseBscNative(data, address), ...parseBscToken(data, address)]
  if (records.length === 0 && (await hasBscActivity(address, signal))) {
    throw new Error('older activity is not in the public index; try a recent transaction or BscScan')
  }
  return records
}

async function fetchEvmChain(
  chainId: SupportedChainId,
  address: string,
  signal: AbortSignal,
): Promise<TxRecord[]> {
  if (chainId === 56) return fetchBsc(address, signal)
  const errors: string[] = []
  if (BLOCKSCOUT[chainId]) {
    try {
      return await fetchBlockscout(chainId, address, signal)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Explorer unavailable')
    }
  }
  if (chainId === 1) {
    try {
      return await fetchRoutescan(chainId, address, signal)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Explorer unavailable')
    }
  }
  throw new Error(errors[0] ?? 'Explorer unavailable')
}

async function fetchBitcoin(address: string, signal: AbortSignal): Promise<TxRecord[]> {
  let lastError: unknown = null
  for (const base of BTC_APIS) {
    try {
      const payload = await readJson(
        `${base}/api/address/${encodeURIComponent(address)}/txs`,
        signal,
        8_000,
      )
      if (!Array.isArray(payload)) throw new Error('Unexpected Bitcoin response')
      return parseBitcoin(payload, address)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Bitcoin explorer unavailable')
}

function parseBitcoin(payload: unknown[], address: string): TxRecord[] {
  const records: TxRecord[] = []
  for (const item of payload) {
    const tx = obj(item)
    const txid = str(tx.txid)
    if (!txid) continue
    let received = 0n
    let spent = 0n
    for (const out of arr(tx.vout)) {
      const output = obj(out)
      if (str(output.scriptpubkey_address) === address) received += rawBig(output.value)
    }
    for (const input of arr(tx.vin)) {
      const prevout = obj(obj(input).prevout)
      if (str(prevout.scriptpubkey_address) === address) spent += rawBig(prevout.value)
    }
    const net = received - spent
    if (net === 0n) continue
    const incoming = net > 0n
    const counterparty = incoming
      ? arr(tx.vin).map((input) => str(obj(obj(input).prevout).scriptpubkey_address)).find((value) => value && value !== address) ?? ''
      : arr(tx.vout).map((out) => str(obj(out).scriptpubkey_address)).find((value) => value && value !== address) ?? ''
    const status = obj(tx.status).confirmed === true ? 'confirmed' : 'pending'
    const blockTime = Number(obj(tx.status).block_time)
    records.push({
      id: `onchain:btc:${txid}`,
      kind: incoming ? 'deposit' : 'withdrawal',
      title: `${incoming ? 'Received' : 'Sent'} BTC`,
      amount: amountText(incoming ? net : -net, 8, 'BTC'),
      from: incoming ? counterparty : address,
      recipient: incoming ? address : counterparty,
      hash: txid,
      chainName: 'Bitcoin',
      explorerUrl: `https://mempool.space/tx/${txid}`,
      status,
      createdAt: Number.isFinite(blockTime) && blockTime > 0 ? blockTime * 1000 : Date.now(),
      note: 'On-chain transaction',
      source: 'onchain',
    })
  }
  return records
}

async function solanaRpc<T>(method: string, params: unknown[], signal: AbortSignal): Promise<T> {
  let lastError: unknown = null
  for (const rpc of SOL_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const json = (await res.json()) as { error?: { message?: string }; result?: T }
      if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
      return json.result as T
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Solana RPC unavailable')
}

async function fetchSolana(address: string, signal: AbortSignal): Promise<TxRecord[]> {
  const signatures = await solanaRpc<
    { signature: string; blockTime: number | null; err: unknown }[]
  >('getSignaturesForAddress', [address, { limit: 12 }], signal)
  if (!Array.isArray(signatures)) throw new Error('Unexpected Solana response')
  const results = await Promise.allSettled(
    signatures.map((item) =>
      solanaRpc<Record<string, unknown>>(
        'getTransaction',
        [item.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        signal,
      ),
    ),
  )
  const records: TxRecord[] = []
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled' || !result.value) return
    const tx = result.value
    const signature = signatures[index].signature
    const meta = obj(tx.meta)
    const message = obj(obj(tx.transaction).message)
    const keys = arr(message.accountKeys)
      .map((key) => (typeof key === 'string' ? key : str(obj(key).pubkey)))
      .filter(Boolean)
    const position = keys.findIndex((key) => key === address)
    if (position < 0) return
    const pre = arr(meta.preBalances).map((value) => Number(value) || 0)
    const post = arr(meta.postBalances).map((value) => Number(value) || 0)
    const delta = (post[position] ?? 0) - (pre[position] ?? 0)
    if (!delta) return
    const incoming = delta > 0
    let counterparty = ''
    let best = 0
    keys.forEach((key, keyIndex) => {
      if (keyIndex === position) return
      const change = (post[keyIndex] ?? 0) - (pre[keyIndex] ?? 0)
      if (Math.sign(change) === -Math.sign(delta) && Math.abs(change) > best) {
        best = Math.abs(change)
        counterparty = key
      }
    })
    records.push({
      id: `onchain:sol:${signature}`,
      kind: incoming ? 'deposit' : 'withdrawal',
      title: `${incoming ? 'Received' : 'Sent'} SOL`,
      amount: amountText(Math.abs(delta), 9, 'SOL'),
      from: incoming ? counterparty : address,
      recipient: incoming ? address : counterparty,
      hash: signature,
      chainName: 'Solana',
      explorerUrl: `https://solscan.io/tx/${signature}`,
      status: meta.err ? 'failed' : 'confirmed',
      createdAt: Number(tx.blockTime ?? signatures[index].blockTime ?? Date.now() / 1000) * 1000,
      note: 'On-chain transaction',
      source: 'onchain',
    })
  })
  return records
}

export async function fetchOnChainHistory(
  addresses: OnChainAddresses,
  onUpdate?: (result: OnChainFetchResult) => void,
): Promise<OnChainFetchResult> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 20_000)
  try {
    const tasks: { label: string; run: Promise<TxRecord[]> }[] = []
    const evm = addresses.evm?.trim()
    const btc = addresses.btc?.trim()
    const sol = addresses.sol?.trim()
    if (evm) {
      for (const chainId of EVM_CHAINS) {
        tasks.push({
          label: CHAIN_META[chainId].label,
          run: fetchEvmChain(chainId, evm, controller.signal),
        })
      }
    }
    if (btc) tasks.push({ label: 'Bitcoin', run: fetchBitcoin(btc, controller.signal) })
    if (sol) tasks.push({ label: 'Solana', run: fetchSolana(sol, controller.signal) })

    const records: TxRecord[] = []
    const errors: string[] = []
    const seen = new Set<string>()
    const publish = () => {
      const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt).slice(0, 150)
      onUpdate?.({ records: sorted, errors: [...errors] })
    }

    await Promise.allSettled(
      tasks.map((task) =>
        task.run.then(
          (value) => {
            for (const record of value) {
              if (seen.has(record.id)) continue
              seen.add(record.id)
              records.push(record)
            }
            publish()
          },
          (reason) => {
            const message = reason instanceof Error ? reason.message : 'could not load'
            errors.push(`${task.label}: ${message}`)
            publish()
          },
        ),
      ),
    )
    records.sort((a, b) => b.createdAt - a.createdAt)
    return { records: records.slice(0, 150), errors }
  } finally {
    window.clearTimeout(timer)
  }
}
