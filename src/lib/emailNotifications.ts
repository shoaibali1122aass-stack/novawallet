import { supabase, isSupabaseConfigured } from './supabase'
import type { NotificationKind } from './notifications'

const DEDUPE_PREFIX = 'nova_email_notify:'
const DEDUPE_MS = 10 * 60 * 1000

function recentlySent(key: string): boolean {
  try {
    const at = Number(localStorage.getItem(DEDUPE_PREFIX + key) || 0)
    return Number.isFinite(at) && Date.now() - at < DEDUPE_MS
  } catch {
    return false
  }
}

function markSent(key: string) {
  try {
    localStorage.setItem(DEDUPE_PREFIX + key, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

/**
 * Best-effort email mirror of an in-app notification.
 * The Supabase RPC resolves the signed-in user's address and dispatches the
 * `send-notification` GitHub workflow; it never accepts a recipient from the client.
 */
export async function sendEmailNotification(
  kind: NotificationKind,
  title: string,
  body: string,
  dedupeKey?: string,
) {
  if (!isSupabaseConfigured) return
  if (kind !== 'deposit' && kind !== 'withdrawal' && kind !== 'swap') return

  const dedupe = dedupeKey ? `${kind}:${dedupeKey}` : undefined
  if (dedupe && recentlySent(dedupe)) return

  try {
    const { data, error } = await supabase.rpc('request_wallet_notification', {
      p_kind: kind,
      p_title: title,
      p_body: body,
      p_dedupe: dedupe ?? null,
    })
    if (error) return
    const result = (data ?? null) as { ok?: boolean; duplicate?: boolean } | null
    if (dedupe && result?.ok) markSent(dedupe)
  } catch {
    /* best effort */
  }
}
