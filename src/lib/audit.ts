import { supabase, isSupabaseConfigured } from './supabase'

// Best-effort security event logging. Never throws, never blocks UI.
export async function logAudit(action: string, detail?: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      detail: detail ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    /* ignore */
  }
}
