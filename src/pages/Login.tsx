import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export default function Login() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    timer.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [cooldown])

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setNotice('')
    const clean = email.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('request_login_code', { p_email: clean })
      if (rpcError) throw new Error(rpcError.message)
      const result = data as { ok?: boolean; error?: string; retry_after?: number } | null
      if (!result?.ok) {
        if (result?.error === 'rate_limit') {
          const retry = typeof result.retry_after === 'number' ? result.retry_after : 45
          setCooldown(retry)
          setNotice(`Please wait ${retry}s before requesting another code.`)
          return
        }
        if (result?.error === 'invalid_email') {
          setError('Enter a valid email address.')
          return
        }
        if (result?.error === 'not_configured') {
          setError('Email service is not configured. Please contact support.')
          return
        }
        throw new Error('Could not send the code. Try again.')
      }
      setEmail(clean)
      setStep('code')
      setCooldown(45)
      setNotice(`Verification code sent to ${clean}. It may take up to a minute to arrive.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError('')
    const token = code.trim()
    if (token.length < 6) {
      setError('Enter the code from your email.')
      return
    }
    setBusy(true)
    try {
      let lastError: unknown = null
      const types = ['email', 'magiclink', 'signup'] as const
      for (const type of types) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token, type })
        if (!verifyError && data.session) {
          await logAudit('login_success', { method: 'email_otp' })
          navigate('/dashboard', { replace: true })
          return
        }
        lastError = verifyError
      }
      throw lastError instanceof Error ? lastError : new Error('Invalid or expired code.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/5 bg-ink-900 p-12 lg:flex">
        <div className="grid-glow absolute inset-0 opacity-80" />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-black leading-tight tracking-tight text-white">
            Sign in with a code. Keep your keys where they belong.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            No passwords, no seed phrases. We email you a single-use code — your wallet stays entirely in your control.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Passwordless email verification',
              'Single-use codes, short-lived by design',
              'Rate-limited against brute force',
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-500/15 text-accent-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} NovaWallet</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Supabase connect nahi hai.{' '}
              <Link to="/setup" className="font-semibold underline">
                Setup page kholo
              </Link>{' '}
              aur apni public URL + anon key paste karo.
            </div>
          )}

          <h1 className="text-2xl font-black tracking-tight text-white">
            {step === 'email' ? 'Sign in or create account' : 'Check your email'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {step === 'email'
              ? 'Enter your email and we will send a verification code.'
              : 'Enter the verification code we sent to your email.'}
          </p>

          {step === 'email' ? (
            <form onSubmit={sendCode} className="mt-8 space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button className="btn-primary w-full" disabled={busy || cooldown > 0 || !isSupabaseConfigured}>
                {busy ? 'Sending…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send verification code'}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-8 space-y-4">
              <div>
                <label className="label">Verification code</label>
                <input
                  className="input text-center font-mono text-2xl tracking-[0.42em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="00000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button className="btn-primary w-full" disabled={busy || code.trim().length < 6}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-slate-400 hover:text-white"
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setNotice('')
                  }}
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  className="font-semibold text-brand-400 hover:underline disabled:text-slate-600"
                  disabled={cooldown > 0 || busy}
                  onClick={() => sendCode()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {notice && <p className="mt-4 text-xs text-accent-400">{notice}</p>}
          {error && <p className="mt-4 text-xs text-rose-400">{error}</p>}

          <div className="mt-8 rounded-xl border border-white/5 bg-ink-900/60 p-4 text-xs text-slate-500">
            <strong className="text-slate-300">Security note:</strong> NovaWallet will never ask for your recovery
            phrase or private key. Only enter the code if you just requested it.
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            <Link to="/" className="hover:text-slate-300">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
