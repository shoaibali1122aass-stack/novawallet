import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useAccount, useDisconnect } from 'wagmi'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { setWalletScope } from '../lib/localWallet'

export type Profile = {
  id: string
  email: string | null
  role: 'user' | 'admin'
  is_suspended: boolean
  withdrawal_lock: boolean
  wallet_address: string | null
  created_at: string
}

type AuthCtx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { connector } = useAccount()
  const { disconnect } = useDisconnect()
  const activeUserId = useRef<string | null>(null)

  const loadProfile = useCallback(
    async (s: Session | null) => {
      if (!s) {
        if (activeUserId.current && connector?.id === 'novaLocal') disconnect()
        activeUserId.current = null
        setWalletScope(null)
        setProfile(null)
        return
      }
      const nextId = s.user.id
      const prevId = activeUserId.current
      if (prevId && prevId !== nextId && connector?.id === 'novaLocal') disconnect()
      activeUserId.current = nextId
      setWalletScope(nextId)
      const { data } = await supabase.from('profiles').select('*').eq('id', nextId).maybeSingle()
      setProfile((data as Profile) ?? null)
    },
    [connector?.id, disconnect],
  )

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadProfile(data.session)
  }, [loadProfile])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      setSession(s)
      await loadProfile(s)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    activeUserId.current = null
    setWalletScope(null)
    if (connector?.id === 'novaLocal') disconnect()
  }, [connector?.id, disconnect])

  return <Ctx.Provider value={{ session, profile, loading, refresh, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
