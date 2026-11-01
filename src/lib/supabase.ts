import { createClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'nova_runtime_config'

export type RuntimeConfig = { url: string; key: string }

function readRuntime(): RuntimeConfig | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.url === 'string' && typeof parsed.key === 'string') {
      return { url: parsed.url, key: parsed.key }
    }
  } catch {
    /* ignore */
  }
  return null
}

const runtime = readRuntime()
const url = import.meta.env.VITE_SUPABASE_URL || runtime?.url || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtime?.key || ''

export const isSupabaseConfigured = Boolean(url && anonKey)
export const configSource: 'build' | 'runtime' | 'none' = import.meta.env.VITE_SUPABASE_URL
  ? 'build'
  : runtime
    ? 'runtime'
    : 'none'

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export function saveRuntimeConfig(cfg: RuntimeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export function clearRuntimeConfig() {
  localStorage.removeItem(STORAGE_KEY)
}

export function currentRuntimeConfig(): RuntimeConfig | null {
  return readRuntime()
}
