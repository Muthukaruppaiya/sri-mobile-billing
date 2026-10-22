import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth'

export type AppSettings = {
  id: string
  shopName: string
  shopPhone?: string | null
  shopAddress?: string | null
  shopCity?: string | null
  shopGstin?: string | null
  invoicePrefix: string
  invoiceSeq?: number
  serviceSeq?: number
  invoiceTerms?: string | null
  serviceTerms?: string | null
  defaultTaxPercent: number
  geoLoginEnabled: boolean
  geoLatitude?: number | null
  geoLongitude?: number | null
  geoRadiusMeters: number
  modulePurchase: boolean
  moduleSale: boolean
  moduleService: boolean
  moduleStock: boolean
  moduleReports: boolean
  moduleCustomers: boolean
  moduleSuppliers: boolean
  moduleHistory: boolean
  moduleEmployees: boolean
}

type SettingsCtx = {
  settings: AppSettings | null
  loading: boolean
  refresh: () => void
}

const Ctx = createContext<SettingsCtx | null>(null)

const defaults: AppSettings = {
  id: 'default',
  shopName: 'SRI MOBILES',
  invoicePrefix: 'INV',
  defaultTaxPercent: 18,
  geoLoginEnabled: false,
  geoRadiusMeters: 200,
  modulePurchase: true,
  moduleSale: true,
  moduleService: true,
  moduleStock: true,
  moduleReports: true,
  moduleCustomers: true,
  moduleSuppliers: true,
  moduleHistory: true,
  moduleEmployees: true,
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/settings'),
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  const value = useMemo<SettingsCtx>(
    () => ({
      settings: q.data || (user ? defaults : null),
      loading: Boolean(user) && q.isLoading,
      refresh: () => {
        qc.invalidateQueries({ queryKey: ['settings'] })
      },
    }),
    [q.data, q.isLoading, user, qc],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSettings outside provider')
  return ctx
}
