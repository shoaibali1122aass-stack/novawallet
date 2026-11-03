import { scopedGet, scopedSet } from './scopedStorage'

export type TxKind = 'withdrawal' | 'swap'
export type TxStatus = 'pending' | 'confirmed' | 'failed'

export type TxRecord = {
  id: string
  kind: TxKind
  title: string
  amount: string
  from: string
  recipient?: string
  hash: string
  chainName: string
  explorerUrl?: string
  status: TxStatus
  createdAt: number
  note?: string
}

const BASE = 'nova_tx_history'
const LIMIT = 100
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function parse(raw: string | null): TxRecord[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter((item): item is TxRecord => Boolean(item) && typeof item.hash === 'string')
  } catch {
    return []
  }
}

function write(userId: string | null | undefined, items: TxRecord[]) {
  scopedSet(BASE, userId, JSON.stringify(items.slice(0, LIMIT)))
  emit()
}

export function listTxHistory(userId?: string | null): TxRecord[] {
  return parse(scopedGet(BASE, userId))
}

export function addTxHistory(userId: string | null | undefined, record: TxRecord): TxRecord[] {
  const items = listTxHistory(userId).filter((item) => item.hash !== record.hash)
  const next = [record, ...items].slice(0, LIMIT)
  write(userId, next)
  return next
}

export function updateTxHistory(
  userId: string | null | undefined,
  hash: string,
  patch: Partial<Omit<TxRecord, 'id' | 'hash'>>,
): TxRecord[] {
  const next = listTxHistory(userId).map((item) => (item.hash === hash ? { ...item, ...patch } : item))
  write(userId, next)
  return next
}

export function removeTxHistory(userId: string | null | undefined, hash: string): TxRecord[] {
  const next = listTxHistory(userId).filter((item) => item.hash !== hash)
  write(userId, next)
  return next
}

export function clearTxHistory(userId: string | null | undefined): TxRecord[] {
  write(userId, [])
  return []
}

export function subscribeTxHistory(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
}
