import { useEffect, useId, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  History,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Smartphone,
  Users,
  Wrench,
  X,
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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark${compact ? ' brand-mark--compact' : ''}`}>
      <div className="brand-mark__icon">
        <Smartphone size={compact ? 16 : 18} color="var(--brand)" />
      </div>
      <div className="brand-mark__text">
        <div className="brand-mark__name">SRI MOBILES</div>
        {!compact ? (
          <div className="brand-mark__tag">Billing · Stock · Service</div>
        ) : null}
      </div>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const navId = useId()

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 900px)')
    const onChange = () => {
      if (desktop.matches) setNavOpen(false)
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!navOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [navOpen])

  return (
    <>
      <AmbientBackground />
      <div className={`shell${navOpen ? ' is-nav-open' : ''}`}>
        <header className="top-bar">
          <button
            type="button"
            className="nav-toggle"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            aria-controls={navId}
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <BrandMark compact />
          <NavLink to="/app/customers" className="nav-toggle" aria-label="Customers">
            <Users size={18} />
          </NavLink>
        </header>

        <button
          type="button"
          className="side-nav-backdrop"
          aria-label="Close menu"
          tabIndex={navOpen ? 0 : -1}
          onClick={() => setNavOpen(false)}
        />

        <aside id={navId} className={`side-nav${navOpen ? ' is-open' : ''}`} aria-label="Main">
          <div className="side-nav__head">
            <div className="side-nav__brand">
              <BrandMark />
            </div>
            <button
              type="button"
              className="nav-toggle nav-toggle--drawer"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="side-nav__links">
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
          </nav>
        </aside>

        <div className="shell__main">
          <div className="page">
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
