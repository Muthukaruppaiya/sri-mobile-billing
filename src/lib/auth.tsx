import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, setToken } from './api'

export type AuthUser = {
  id: string
  name: string
  username: string
  role: 'ADMIN' | 'EMPLOYEE'
  phone?: string | null
  active?: boolean
}

export type LoginCoords = { latitude: number; longitude: number }

type AuthCtx = {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string, coords?: LoginCoords | null) => Promise<void>
  logout: () => void
  isAdmin: boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api<{ user: AuthUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // A 401 anywhere (disabled account, expired token) sends the user back to login.
  useEffect(() => {
    const onLoggedOut = () => {
      setUser(null)
      qc.clear()
    }
    window.addEventListener('sri:logged-out', onLoggedOut)
    return () => window.removeEventListener('sri:logged-out', onLoggedOut)
  }, [qc])

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'ADMIN',
      async login(username, password, coords) {
        const res = await api<{ token: string; user: AuthUser }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username,
            password,
            ...(coords
              ? { latitude: coords.latitude, longitude: coords.longitude }
              : {}),
          }),
        })
        qc.clear()
        setToken(res.token)
        setUser(res.user)
      },
      logout() {
        setToken(null)
        setUser(null)
        qc.clear()
      },
    }),
    [user, loading, qc],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
