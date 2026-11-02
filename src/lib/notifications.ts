export type NotificationKind = 'deposit' | 'withdrawal' | 'swap' | 'system'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: number
  read: boolean
}

let items: AppNotification[] = []
const listeners = new Set<() => void>()

function publish() {
  items = [...items]
  listeners.forEach((listener) => listener())
}

export const notificationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot() {
    return items
  },
}

export function notify(kind: NotificationKind, title: string, body: string) {
  const item: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title,
    body,
    createdAt: Date.now(),
    read: false,
  }
  items = [item, ...items].slice(0, 40)
  publish()
  return item
}

export function markAllRead() {
  if (items.every((item) => item.read)) return
  items = items.map((item) => ({ ...item, read: true }))
  publish()
}

export function clearNotifications() {
  items = []
  publish()
}

export function notificationIcon(kind: NotificationKind) {
  if (kind === 'deposit') return '↓'
  if (kind === 'withdrawal') return '↑'
  if (kind === 'swap') return '⇄'
  return '•'
}
