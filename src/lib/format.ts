export function shortAddr(addr?: string | null, size = 5): string {
  if (!addr) return ''
  return `${addr.slice(0, size + 2)}…${addr.slice(-size)}`
}

export function fmtAmount(value: number, maxFrac = 6): string {
  if (!Number.isFinite(value)) return '0'
  if (value === 0) return '0'
  if (value < 0.000001) return '<0.000001'
  return value.toLocaleString(undefined, { maximumFractionDigits: maxFrac })
}

export function fmtUsd(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
