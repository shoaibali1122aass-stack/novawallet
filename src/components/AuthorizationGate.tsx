import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logAudit } from '../lib/audit'

const AUTH_KEY = 'nova_withdraw_auth_until'

export function isWithdrawalAuthorized(): boolean {
  try {
    return Number(sessionStorage.getItem(AUTH_KEY) || 0) > Date.now()
  } catch {
    return false
  }
}

export function AuthorizationGate({ onAuthorized }: { onAuthorized: () => void }) {
  const { profile } = useAuth()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [step, setStep] = useState<'idle' | 'otp'>('idle')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const email = profile?.email ?? ''

  async function start() {
    setError('')
    setBusy(true)
    try {
      if (!address) throw new Error('Connect your wallet first.')
      if (!email) throw new Error('No verified email on this account.')
      const message =
        `NovaWallet withdrawal authorization\n\n` +
        `Wallet: ${address}\n` +
        `Email: ${email}\n` +
        `Nonce: ${Date.now()}\n\n` +
        `Signing proves you control this wallet. This is not a transaction and costs no gas.`
      await signMessageAsync({ message })
      const { data, error: rpcError } = await supabase.rpc('request_login_code', { p_email: email })
      if (rpcError) throw new Error(rpcError.message)
      const result = (data ?? null) as { ok?: boolean; error?: string; retry_after?: number } | null
      if (!result?.ok) {
        if (result?.error === 'rate_limit' || result?.error === 'cooldown') {
          throw new Error(`Please wait ${result.retry_after ?? 45}s before requesting another code.`)
        }
        throw new Error('Could not send the email code. Try again in a moment.')
      }
      await logAudit('withdrawal_authorization_requested', { wallet: address })
      setStep('otp')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setError('')
    setBusy(true)
    try {
      let lastError: unknown = null
      for (const type of ['email', 'magiclink', 'signup'] as const) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type,
        })
        if (!verifyError && data.session) {
          sessionStorage.setItem(AUTH_KEY, String(Date.now() + 10 * 60 * 1000))
          await logAudit('withdrawal_authorized', { wallet: address })
          onAuthorized()
          return
        }
        lastError = verifyError
      }
      throw lastError instanceof Error ? lastError : new Error('Invalid or expired code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-300">Withdrawal lock is enabled</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Sign a message with your wallet and confirm the email code before sending. This proves both the wallet owner
            and the account owner are present.
          </p>
        </div>
      </div>

      {step === 'idle' ? (
        <button className="btn-primary w-full" onClick={start} disabled={busy}>
          {busy ? 'Waiting for wallet…' : 'Authorize withdrawal'}
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Email verification code</label>
            <input
              className="input text-center font-mono text-lg tracking-[0.4em]"
              placeholder="00000000"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Enter the 8-digit code sent to {email}. It can take a few seconds to arrive.
            </p>
          </div>
          <button className="btn-primary w-full" onClick={confirm} disabled={busy || code.trim().length < 6}>
            {busy ? 'Verifying…' : 'Confirm authorization'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
