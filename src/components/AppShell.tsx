import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  Settings,
  ShoppingBag,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AmbientBackground } from './ui'
import { useAuth } from '../lib/auth'
import { useSettings, type AppSettings } from '../lib/settings'

type NavChild = { to: string; label: string; flag?: keyof AppSettings }
type NavModule = {
  id: string
  label: string
  icon: LucideIcon
  to?: string
  end?: boolean
  children?: NavChild[]
  adminOnly?: boolean
  flag?: keyof AppSettings
}

const navModules: NavModule[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard, to: '/app', end: true },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: PackagePlus,
    flag: 'modulePurchase',
    children: [
      { to: '/app/purchase/new', label: 'New mobile' },
      { to: '/app/purchase/spares', label: 'Spares' },
      { to: '/app/purchase/used', label: 'Used phone' },
      { to: '/app/history', label: 'History', flag: 'moduleHistory' },
      { to: '/app/suppliers', label: 'Vendors', flag: 'moduleSuppliers' },
    ],
  },
  {
    id: 'parties',
    label: 'Customers',
    icon: Users,
    to: '/app/customers',
    flag: 'moduleCustomers',
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: Package,
    flag: 'moduleStock',
    children: [
      { to: '/app/stock/products', label: 'Products (mobiles / spares)' },
      { to: '/app/stock/phones', label: 'Phone units (IMEI)' },
    ],
  },
  { id: 'reports', label: 'Reports', icon: BarChart3, to: '/app/reports', flag: 'moduleReports' },
  {
    id: 'sale',
    label: 'Sale',
    icon: ShoppingBag,
    flag: 'moduleSale',
    children: [
      { to: '/app/billing/new', label: 'New mobile' },
      { to: '/app/billing/used', label: 'Used phone' },
      { to: '/app/billing/history', label: 'History' },
    ],
  },
  {
    id: 'service',
    label: 'Service',
    icon: Wrench,
    flag: 'moduleService',
    children: [
      { to: '/app/service/booking', label: 'Booking / jobs' },
      { to: '/app/service/delivery', label: 'Delivery' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: Users,
    to: '/app/employees',
    adminOnly: true,
    flag: 'moduleEmployees',
  },
  { id: 'settings', label: 'Settings', icon: Settings, to: '/app/settings', adminOnly: true },
]

const mobileLinks = [
  { to: '/app', end: true, label: 'Home', icon: LayoutDashboard, flag: undefined as keyof AppSettings | undefined },
  { to: '/app/purchase/new', label: 'Purchase', icon: PackagePlus, flag: 'modulePurchase' as const },
  { to: '/app/stock/products', label: 'Stock', icon: Package, flag: 'moduleStock' as const },
  { to: '/app/billing/new', label: 'Sale', icon: ShoppingBag, flag: 'moduleSale' as const },
  { to: '/app/service/booking', label: 'Service', icon: Wrench, flag: 'moduleService' as const },
]

function moduleMatches(mod: NavModule, pathname: string) {
  if (mod.to) {
    if (mod.end) return pathname === mod.to || pathname === `${mod.to}/`
    return pathname === mod.to || pathname.startsWith(`${mod.to}/`)
  }
  return (mod.children || []).some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))
}

function activeModuleId(pathname: string, modules: NavModule[]) {
  return modules.find((m) => moduleMatches(m, pathname))?.id ?? 'home'
}

function flagOn(settings: AppSettings | null, flag?: keyof AppSettings) {
  if (!flag || !settings) return true
  return Boolean(settings[flag])
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout, isAdmin } = useAuth()
  const { settings } = useSettings()
  const [openId, setOpenId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  const modules = navModules
    .filter((m) => (!m.adminOnly || isAdmin) && flagOn(settings, m.flag))
    .map((m) => ({
      ...m,
      children: m.children?.filter((c) => flagOn(settings, c.flag)),
    }))
    .filter((m) => !m.children || m.children.length > 0 || m.to)

  const bottom = mobileLinks.filter((l) => flagOn(settings, l.flag))

  useEffect(() => {
    setOpenId(activeModuleId(location.pathname, modules))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync open group to route
  }, [location.pathname, isAdmin, settings])

  if (loading) {
    return (
      <>
        <AmbientBackground />
        <div className="splash">
          <p className="muted">Loading…</p>
        </div>
      </>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const isDesk =
    location.pathname.includes('/purchase/') ||
    location.pathname.includes('/billing/') ||
    location.pathname.includes('/service/')
  const showSubs = navOpen
  const brandName = settings?.shopName || 'SRI MOBILES'

  return (
    <>
      <AmbientBackground />
      <div className={`shell${navOpen ? ' shell--nav-open' : ''}`}>
        <div
          className="side-nav-hotzone"
          aria-hidden
          onMouseEnter={() => setNavOpen(true)}
        />

        <aside
          className={`side-nav${navOpen ? ' is-open' : ''}`}
          onMouseEnter={() => setNavOpen(true)}
          onMouseLeave={() => setNavOpen(false)}
        >
          <div className="side-nav__brand">
            <div className="side-nav__brand-row">
              <div className="side-nav__mark">
                <ClipboardList size={18} color="var(--brand)" />
              </div>
              <div className="side-nav__brand-text">
                <div className="side-nav__name">{brandName}</div>
                <div className="side-nav__user">
                  {user.name} · {user.role}
                </div>
              </div>
            </div>
          </div>

          <nav className="side-nav__menu" aria-label="Main">
            {modules.map((mod) => {
              const Icon = mod.icon
              const hasChildren = Boolean(mod.children?.length)
              const open = showSubs && openId === mod.id
              const parentActive = moduleMatches(mod, location.pathname)

              if (!hasChildren && mod.to) {
                return (
                  <NavLink
                    key={mod.id}
                    to={mod.to}
                    end={mod.end}
                    title={mod.label}
                    className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                  >
                    <Icon size={18} />
                    <span className="nav-item__label">{mod.label}</span>
                  </NavLink>
                )
              }

              const firstChild = mod.children?.[0]?.to

              return (
                <div key={mod.id} className={`nav-group${parentActive ? ' is-active-group' : ''}`}>
                  <button
                    type="button"
                    title={mod.label}
                    className={`nav-item nav-item--parent${parentActive ? ' is-active' : ''}`}
                    aria-expanded={open}
                    onClick={() => {
                      setNavOpen(true)
                      setOpenId((prev) => (prev === mod.id ? null : mod.id))
                      if (!parentActive && firstChild) navigate(firstChild)
                    }}
                  >
                    <Icon size={18} />
                    <span className="nav-item__label">{mod.label}</span>
                    <ChevronDown
                      size={16}
                      className={`nav-item__chevron${open ? ' is-open' : ''}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        className="nav-group__children"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        {mod.children!.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              `nav-subitem${isActive ? ' is-active' : ''}`
                            }
                          >
                            <span className="nav-subitem__dot" aria-hidden />
                            {child.label}
                          </NavLink>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              )
            })}
          </nav>

          <button
            type="button"
            className="nav-item"
            title="Logout"
            style={{ marginTop: 'auto' }}
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut size={18} />
            <span className="nav-item__label">Logout</span>
          </button>
        </aside>

        <div className={`shell__main${isDesk ? ' shell__main--desk' : ''}`}>
          <div className={`page${isDesk ? ' page--desk' : ''}`}>
            <div style={isDesk ? { height: '100%' } : undefined}>
              <Outlet />
            </div>
          </div>
        </div>

        <nav className="bottom-nav" aria-label="Primary">
          <div className="bottom-nav__inner">
            {bottom.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => {
                  const purchaseActive =
                    label === 'Purchase' && location.pathname.includes('/purchase')
                  const stockActive = label === 'Stock' && location.pathname.includes('/stock')
                  const saleActive = label === 'Sale' && location.pathname.includes('/billing')
                  const serviceActive =
                    label === 'Service' && location.pathname.includes('/service')
                  const active =
                    isActive || purchaseActive || stockActive || saleActive || serviceActive
                  return `nav-item${active ? ' is-active' : ''}`
                }}
              >
                <motion.span whileTap={{ scale: 0.88 }} style={{ display: 'grid', placeItems: 'center' }}>
                  <Icon size={20} />
                </motion.span>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </>
  )
}
