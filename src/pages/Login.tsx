import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ClipboardList, MapPin } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AmbientBackground } from '../components/ui'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available on this device'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

export function LoginPage() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [locHint, setLocHint] = useState('')

  const publicQ = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () =>
      api<{ shopName: string; geoLoginEnabled: boolean }>('/settings/public'),
    staleTime: 60_000,
  })

  const geoOn = Boolean(publicQ.data?.geoLoginEnabled)
  const shopName = publicQ.data?.shopName || 'SRI MOBILES'

  useEffect(() => {
    if (geoOn) {
      setLocHint('Staff login needs GPS at the shop. Admin can sign in from anywhere.')
    } else {
      setLocHint('')
    }
  }, [geoOn])

  if (!loading && user) return <Navigate to="/app" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      let coords: { latitude: number; longitude: number } | null = null
      if (geoOn) {
        try {
          const pos = await getPosition()
          coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }
        } catch {
          // Admin login still works without coords; employees will be rejected by API
          coords = null
        }
      }
      await login(username.trim(), password, coords)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AmbientBackground />
      <div className="splash">
        <form onSubmit={onSubmit} className="panel login-card">
          <div className="login-card__brand">
            <div className="side-nav__mark">
              <ClipboardList size={20} color="var(--brand)" />
            </div>
            <div>
              <div className="side-nav__name">{shopName}</div>
              <p className="page-sub" style={{ margin: 0 }}>
                Billing desk
              </p>
            </div>
          </div>

          <h1 className="page-title" style={{ marginTop: 20, fontSize: '1.35rem' }}>
            Sign in
          </h1>

          {geoOn ? (
            <p className="login-geo-banner">
              <MapPin size={14} /> {locHint}
            </p>
          ) : null}

          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="admin"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error ? (
            <p className="danger" style={{ marginTop: 12, fontSize: 'var(--fs-sm)' }}>
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary btn--block" style={{ marginTop: 18 }} disabled={busy}>
            {busy ? (geoOn ? 'Checking location…' : 'Signing in…') : 'Enter desk'}
          </button>
        </form>
      </div>
    </>
  )
}
