import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'
import { AmbientBackground } from './ui'

const mobileLinks = [
  { to: '/app', end: true, label: 'Home', icon: LayoutDashboard },
  { to: '/app/billing', label: 'Bill', icon: Receipt },
  { to: '/app/service', label: 'Service', icon: Wrench },
  { to: '/app/stock', label: 'Stock', icon: Package },
  { to: '/app/history', label: 'Bills', icon: History },
]

const sideLinks = [
  ...mobileLinks,
  { to: '/app/customers', label: 'Customers', icon: Users, end: undefined as boolean | undefined },
]

function BrandMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          border: '2px solid var(--brand)',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(14,168,122,0.08)',
          boxShadow: '0 0 24px rgba(14,168,122,0.15)',
        }}
      >
        <ClipboardList size={18} color="var(--brand)" />
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            fontSize: 'var(--fs-lg)',
          }}
        >
          SRI MOBILES
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
          Billing · Stock · Service
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()

  return (
    <>
      <AmbientBackground />
      <div className="shell">
        <aside className="side-nav">
          <div className="side-nav__brand">
            <BrandMark />
            <p style={{ marginTop: 14 }}>Phase 1 · UI Wireframe</p>
          </div>
          {sideLinks.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </aside>

        <div className="shell__main">
          <div className="page">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="chip chip--live">● Live preview</span>
                <span className="chip">Mock data only</span>
                <NavLink to="/app/customers" className="chip" style={{ textDecoration: 'none' }}>
                  Customers
                </NavLink>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <nav className="bottom-nav" aria-label="Primary">
          <div className="bottom-nav__inner">
            {mobileLinks.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
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
