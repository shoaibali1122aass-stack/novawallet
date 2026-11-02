import { useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { notificationIcon, notificationStore } from '../lib/notifications'

export function Toasts() {
  const items = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getSnapshot,
  )
  const latest = items[0]
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    if (!latest) return
    setDismissed(null)
    const timer = window.setTimeout(() => setDismissed(latest.id), 5500)
    return () => window.clearTimeout(timer)
  }, [latest?.id])

  if (!latest || dismissed === latest.id) return null

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] w-[min(22rem,calc(100vw-2.5rem))]">
      <div className="pointer-events-auto animate-float rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold ${
              latest.kind === 'deposit'
                ? 'bg-accent-500/15 text-accent-400'
                : latest.kind === 'withdrawal'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-brand-500/15 text-brand-400'
            }`}
          >
            {notificationIcon(latest.kind)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{latest.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{latest.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(latest.id)}
            className="text-slate-500 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
