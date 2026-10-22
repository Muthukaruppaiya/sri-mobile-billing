import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Store, LayoutGrid, Receipt, Crosshair } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useSettings, type AppSettings } from '../lib/settings'
import { PageHeader, Panel } from '../components/ui'
import { Navigate } from 'react-router-dom'

type Tab = 'shop' | 'geo' | 'modules' | 'billing'

function emptyNum(v: number | null | undefined) {
  return v == null || Number.isNaN(v) ? '' : v
}

export function SettingsPage() {
  const { isAdmin } = useAuth()
  const { settings, refresh } = useSettings()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('shop')
  const [form, setForm] = useState<AppSettings | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [locBusy, setLocBusy] = useState(false)

  useEffect(() => {
    if (settings) setForm({ ...settings })
  }, [settings])

  const save = useMutation({
    mutationFn: () =>
      api<AppSettings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          shopName: form!.shopName,
          shopPhone: form!.shopPhone || null,
          shopAddress: form!.shopAddress || null,
          shopCity: form!.shopCity || null,
          shopGstin: form!.shopGstin || null,
          invoicePrefix: form!.invoicePrefix.trim(),
          invoiceTerms: form!.invoiceTerms?.trim() || null,
          serviceTerms: form!.serviceTerms?.trim() || null,
          defaultTaxPercent: Number(form!.defaultTaxPercent) || 0,
          geoLoginEnabled: form!.geoLoginEnabled,
          geoLatitude: form!.geoLatitude ?? null,
          geoLongitude: form!.geoLongitude ?? null,
          geoRadiusMeters: Number(form!.geoRadiusMeters) || 200,
          modulePurchase: form!.modulePurchase,
          moduleSale: form!.moduleSale,
          moduleService: form!.moduleService,
          moduleStock: form!.moduleStock,
          moduleReports: form!.moduleReports,
          moduleCustomers: form!.moduleCustomers,
          moduleSuppliers: form!.moduleSuppliers,
          moduleHistory: form!.moduleHistory,
          moduleEmployees: form!.moduleEmployees,
        }),
      }),
    onSuccess: (s) => {
      setForm(s)
      setMsg('Settings saved')
      setError('')
      qc.setQueryData(['settings'], s)
      refresh()
    },
    onError: (e: Error) => {
      setError(e.message)
      setMsg('')
    },
  })

  const syncCatalog = useMutation({
    mutationFn: () =>
      api<{ brands: number; models: number }>('/catalog/sync', { method: 'POST' }),
    onSuccess: (r) => {
      setMsg(`Catalog updated · ${r.brands} brands · ${r.models} models`)
      setError('')
      qc.invalidateQueries({ queryKey: ['catalog'] })
    },
    onError: (e: Error) => {
      setError(e.message)
      setMsg('')
    },
  })

  if (!isAdmin) return <Navigate to="/app" replace />
  if (!form) {
    return (
      <div className="section-gap">
        <PageHeader title="Settings" subtitle="Loading…" />
      </div>
    )
  }

  function captureLocation() {
    setLocBusy(true)
    setError('')
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device')
      setLocBusy(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) =>
          f
            ? {
                ...f,
                geoLatitude: Number(pos.coords.latitude.toFixed(6)),
                geoLongitude: Number(pos.coords.longitude.toFixed(6)),
              }
            : f,
        )
        setLocBusy(false)
        setMsg('Current location captured — save to apply')
      },
      (err) => {
        setError(err.message || 'Could not get location')
        setLocBusy(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof Store }[] = [
    { id: 'shop', label: 'Shop', icon: Store },
    { id: 'geo', label: 'Location login', icon: MapPin },
    { id: 'modules', label: 'Modules', icon: LayoutGrid },
    { id: 'billing', label: 'Billing', icon: Receipt },
  ]

  return (
    <div className="section-gap settings-page">
      <PageHeader
        title="Settings"
        subtitle="Shop profile, employee location lock, modules & billing defaults"
        action={
          <button
            type="button"
            className="btn btn--primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save settings'}
          </button>
        }
      />

      {msg ? <p className="settings-toast settings-toast--ok">{msg}</p> : null}
      {error ? <p className="settings-toast settings-toast--err">{error}</p> : null}

      <div className="settings-layout">
        <aside className="settings-tabs" role="tablist">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={`settings-tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </aside>

        <Panel style={{ padding: 14 }} className="settings-panel">
          {tab === 'shop' ? (
            <div className="purchase-fields">
              <label className="span-2">
                Shop name *
                <input
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.shopPhone || ''}
                  onChange={(e) => setForm({ ...form, shopPhone: e.target.value })}
                />
              </label>
              <label>
                GSTIN
                <input
                  value={form.shopGstin || ''}
                  onChange={(e) => setForm({ ...form, shopGstin: e.target.value })}
                />
              </label>
              <label>
                City
                <input
                  value={form.shopCity || ''}
                  onChange={(e) => setForm({ ...form, shopCity: e.target.value })}
                />
              </label>
              <label className="span-2">
                Address
                <input
                  value={form.shopAddress || ''}
                  onChange={(e) => setForm({ ...form, shopAddress: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {tab === 'geo' ? (
            <div>
              <p className="page-sub" style={{ marginBottom: 12 }}>
                Employees must be inside the shop radius to login. <strong>Admin is never
                restricted.</strong>
              </p>
              {!window.isSecureContext ? (
                <p className="settings-toast settings-toast--err" style={{ marginBottom: 12 }}>
                  This site is opened over plain http, so browsers block GPS. Keep location login OFF until the
                  app runs on https — otherwise staff cannot sign in.
                </p>
              ) : null}
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={form.geoLoginEnabled}
                  onChange={(e) => setForm({ ...form, geoLoginEnabled: e.target.checked })}
                />
                <span>Enable location-based login for staff</span>
              </label>
              <div className="purchase-fields" style={{ marginTop: 14 }}>
                <label>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={emptyNum(form.geoLatitude)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        geoLatitude:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="e.g. 11.0168"
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={emptyNum(form.geoLongitude)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        geoLongitude:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="e.g. 76.9558"
                  />
                </label>
                <label>
                  Radius (meters)
                  <input
                    type="number"
                    min={20}
                    value={form.geoRadiusMeters || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        geoRadiusMeters: Number(e.target.value) || 200,
                      })
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ marginTop: 12 }}
                disabled={locBusy}
                onClick={captureLocation}
              >
                <Crosshair size={14} />
                {locBusy ? 'Getting GPS…' : 'Use my current location as shop'}
              </button>
            </div>
          ) : null}

          {tab === 'modules' ? (
            <div>
              <p className="page-sub" style={{ marginBottom: 12 }}>
                Turn modules on/off — menu updates for everyone after save.
              </p>
              <div className="settings-modules">
                {(
                  [
                    ['modulePurchase', 'Purchase'],
                    ['moduleSale', 'Sale'],
                    ['moduleService', 'Service'],
                    ['moduleStock', 'Stock'],
                    ['moduleCustomers', 'Customers'],
                    ['moduleSuppliers', 'Vendors (suppliers)'],
                    ['moduleHistory', 'History'],
                    ['moduleReports', 'Reports'],
                    ['moduleEmployees', 'Staff / employees'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="settings-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(form[key])}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'billing' ? (
            <div className="purchase-fields">
              <label>
                Invoice prefix
                <input
                  value={form.invoicePrefix}
                  maxLength={10}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                />
                <span className="form-hint">
                  Next invoice: {(form.invoicePrefix || 'INV').trim()}-
                  {String((form.invoiceSeq || 0) + 1).padStart(4, '0')} · next service ticket: SV-
                  {String((form.serviceSeq || 0) + 1).padStart(4, '0')}
                </span>
              </label>
              <label className="span-2">
                Invoice terms (printed on sale invoices)
                <textarea
                  rows={4}
                  value={form.invoiceTerms || ''}
                  placeholder="Goods once sold will not be taken back… (leave blank for default)"
                  onChange={(e) => setForm({ ...form, invoiceTerms: e.target.value })}
                />
              </label>
              <label className="span-2">
                Service terms (printed on job cards and service bills)
                <textarea
                  rows={4}
                  value={form.serviceTerms || ''}
                  placeholder="Not responsible for data loss… (leave blank for default)"
                  onChange={(e) => setForm({ ...form, serviceTerms: e.target.value })}
                />
              </label>
              <label className="span-2">
                Phone catalog
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={syncCatalog.isPending}
                  onClick={() => syncCatalog.mutate()}
                  style={{ marginTop: 6 }}
                >
                  {syncCatalog.isPending ? 'Downloading brands & models…' : 'Refresh brands / models from internet'}
                </button>
              </label>
              <label>
                Default GST % (included in prices)
                <input
                  type="number"
                  min={0}
                  value={emptyNum(form.defaultTaxPercent)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defaultTaxPercent:
                        e.target.value === '' ? 0 : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}
