import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import {
  clearRuntimeConfig,
  configSource,
  currentRuntimeConfig,
  isSupabaseConfigured,
  saveRuntimeConfig,
} from '../lib/supabase'

function jwtRole(key: string): string | null {
  try {
    const part = key.split('.')[1]
    if (!part) return null
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

function validateKey(key: string): string | null {
  if (key.startsWith('sbp_')) return 'Ye Personal Access Token hai, browser ke liye nahi. Anon/publishable key use karo.'
  if (key.startsWith('sb_secret_')) return 'Ye secret key hai — kabhi browser mein mat daalo. Anon public key chahiye.'
  if (key.startsWith('eyJ') && jwtRole(key) === 'service_role') {
    return 'Ye service_role key hai — browser mein mat daalo. Anon public key chahiye.'
  }
  if (key.length < 20) return 'Key bahut chhoti lag rahi hai.'
  return null
}

const URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i

export default function Setup() {
  const existing = currentRuntimeConfig()
  const [url, setUrl] = useState(existing?.url ?? '')
  const [key, setKey] = useState(existing?.key ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const cleanUrl = url.trim().replace(/\/+$/, '')
    const cleanKey = key.trim()
    if (!URL_RE.test(cleanUrl)) {
      setError('URL aisa hona chahiye: https://xxxx.supabase.co')
      return
    }
    const keyError = validateKey(cleanKey)
    if (keyError) {
      setError(keyError)
      return
    }
    saveRuntimeConfig({ url: cleanUrl, key: cleanKey })
    setSaved(true)
    setTimeout(() => window.location.assign('/'), 700)
  }

  function reset() {
    clearRuntimeConfig()
    setUrl('')
    setKey('')
    setSaved(false)
    setError('')
  }

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Link to="/" className="text-xs text-slate-400 hover:text-white">
            ← Home
          </Link>
        </div>

        <div className="card p-7">
          <h1 className="text-2xl font-black tracking-tight text-white">Connect Supabase</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Site ko database se jodne ke liye apni Supabase project ki public settings yahan paste karo. Ye values
            sirf is browser mein save hoti hain — server par nahi jaati.
          </p>

          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
            <strong>Sirf public key.</strong> Dashboard → Project Settings → API → <code>anon public</code> (ya{' '}
            <code>publishable</code>) key. <code>service_role</code> / secret key kabhi mat daalo.
          </div>

          {configSource === 'build' ? (
            <div className="mt-5 rounded-xl border border-accent-500/30 bg-accent-500/10 p-4 text-sm text-accent-300">
              Ye app build-time environment par already configured hai. Yahan ki setting use nahi hogi.
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/10 bg-ink-900/60 p-3 text-xs text-slate-400">
              Current status:{' '}
              {isSupabaseConfigured ? (
                <span className="font-semibold text-accent-400">Configured ({configSource})</span>
              ) : (
                <span className="font-semibold text-rose-400">Not configured</span>
              )}
            </div>
          )}

          {saved ? (
            <div className="mt-5 rounded-xl border border-accent-500/30 bg-accent-500/10 p-4 text-sm text-accent-300">
              Saved. App reload ho raha hai…
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="label">Project URL</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="https://xxxx.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label">Anon public key</label>
                <div className="relative">
                  <input
                    className="input pr-16 font-mono text-xs"
                    placeholder="eyJ… or sb_publishable_…"
                    type={showKey ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-white"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <button className="btn-primary flex-1" disabled={configSource === 'build'}>
                  Save & open app
                </button>
                {existing && configSource !== 'build' && (
                  <button type="button" className="btn-secondary" onClick={reset}>
                    Clear
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Email OTP ke liye Supabase → Authentication → SMTP settings + Magic Link template mein{' '}
          <code>{'{{ .Token }}'}</code> chahiye.
        </p>
      </div>
    </div>
  )
}
