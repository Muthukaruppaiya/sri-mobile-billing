import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, type LucideIcon } from 'lucide-react'

export function AmbientBackground() {
  return (
    <div className="app-bg" aria-hidden>
      <div className="app-bg__grid" />
      <div className="app-bg__orb app-bg__orb--a" />
      <div className="app-bg__orb app-bg__orb--b" />
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="row-between" style={{ marginBottom: 18 }}>
      <div>
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {Icon ? (
            <span className="page-title__icon" aria-hidden>
              <Icon size={26} />
            </span>
          ) : null}
          <span>{title}</span>
        </motion.h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Panel({
  children,
  className = '',
  dashed = false,
  delay = 0,
  style,
}: {
  children: ReactNode
  className?: string
  dashed?: boolean
  delay?: number
  style?: CSSProperties
}) {
  return (
    <motion.div
      className={`panel ${dashed ? 'panel--dashed' : ''} ${className}`.trim()}
      style={style}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {children}
    </motion.div>
  )
}

export function FlowStepper({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <ol className="flow-stepper" aria-label="Process steps">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : ''
        return (
          <li key={label} className={`flow-step ${state}`.trim()}>
            <span className="flow-step__dot">
              {i < current ? <Check size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className="flow-step__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function SuccessBanner({
  title,
  detail,
  onClose,
}: {
  title: string
  detail: string
  onClose: () => void
}) {
  return (
    <motion.div
      className="success-banner"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <div className="success-banner__copy">
        <CheckCircle2 size={22} color="var(--brand-deep)" />
        <div>
          <strong>{title}</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)' }}>
            {detail}
          </p>
        </div>
      </div>
      <button type="button" className="btn btn--ghost" style={{ padding: '8px 12px' }} onClick={onClose} aria-label="Dismiss">
        <Check size={16} />
      </button>
    </motion.div>
  )
}

export function FormActions({
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled = false,
  showBack = true,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  showBack?: boolean
}) {
  return (
    <div className="form-actions">
      {showBack && onBack ? (
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="btn btn--primary" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

export function ModeTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: LucideIcon }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="mode-tabs" role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            className={`mode-tab${value === t.id ? ' is-active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {Icon ? <Icon size={16} /> : null}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function MiniStat({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warn' | 'ok' | 'info'
  onClick?: () => void
  icon?: LucideIcon
}) {
  const body = (
    <>
      <div className="mini-stat__label">
        {Icon ? <Icon size={14} /> : null}
        {label}
      </div>
      <div className="mini-stat__value">{value}</div>
      {hint ? <div className="mini-stat__hint">{hint}</div> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={`mini-stat mini-stat--${tone}`} onClick={onClick} style={{ textAlign: 'left', width: '100%' }}>
        {body}
      </button>
    )
  }
  return <div className={`mini-stat mini-stat--${tone}`}>{body}</div>
}
