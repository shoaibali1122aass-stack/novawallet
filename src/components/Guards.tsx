import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

export function FullPageLoader({ label = 'Securing your session…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950">
      <div className="flex flex-col items-center gap-4">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-400" />
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_suspended) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="card max-w-md p-8 text-center">
          <Logo />
          <h1 className="mt-6 text-xl font-bold text-white">Account suspended</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your account has been temporarily restricted for a security review. Please contact support from the email
            linked to this account.
          </p>
          <a href="mailto:support@novawallet.app" className="btn-secondary mt-6">
            Contact support
          </a>
        </div>
      </div>
    )
  }
  return <Outlet />
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile) return <FullPageLoader label="Checking permissions…" />
  if (profile.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
