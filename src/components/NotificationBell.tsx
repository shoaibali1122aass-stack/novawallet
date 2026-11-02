import { useSyncExternalStore, useState } from 'react'
import { clearNotifications, markAllRead, notificationIcon, notificationStore } from '../lib/notifications'

function timeLabel(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export function NotificationBell() {
  const items = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getSnapshot,
  )
  const [open, setOpen] = useState(false)
  const unread = items.filter((item) => !item.read).length

  function toggle() {
    setOpen((value) => {
      if (!value) markAllRead()
      return !value
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="btn-ghost relative"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[61] mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="text-sm font-bold text-white">Notifications</p>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-slate-500">
                  No notifications yet. Deposit and withdrawal updates will appear here.
                </p>
              )}
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 border-b border-white/5 px-4 py-3 last:border-0">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                      item.kind === 'deposit'
                        ? 'bg-accent-500/15 text-accent-400'
                        : item.kind === 'withdrawal'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-brand-500/15 text-brand-400'
                    }`}
                  >
                    {notificationIcon(item.kind)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.body}</p>
                    <p className="mt-1 text-[10px] text-slate-600">{timeLabel(item.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
