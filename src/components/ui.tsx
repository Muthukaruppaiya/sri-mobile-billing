import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { Check, X } from 'lucide-react'

export function AmbientBackground() {
  return <div className="app-bg" aria-hidden />
}

export function WireTag({ children = 'SRI MOBILES' }: { children?: ReactNode }) {
  return <span className="wire-tag">{children}</span>
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="row-between" style={{ marginBottom: 10 }}>
      <div>
        <h1 className="page-title">{title}</h1>
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
    <div
      className={`panel ${dashed ? 'panel--dashed' : ''} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
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
    <Modal
      open
      title={title}
      subtitle={detail || undefined}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          OK
        </button>
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        {detail || 'Saved successfully.'}
      </p>
    </Modal>
  )
}

export function TitleCount({ n }: { n: number }) {
  return <span className="title-count">{n}</span>
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
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="btn btn--primary" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  )
}

export function ModeTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="mode-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={`mode-tab${value === t.id ? ' is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function MiniStat({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warn' | 'ok' | 'info'
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="mini-stat__label">{label}</div>
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

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
          <motion.div
            className={`modal-panel${wide ? ' modal-panel--wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            <div className="modal-panel__head">
              <div>
                <h2 id="modal-title" className="modal-panel__title">
                  {title}
                </h2>
                {subtitle ? <p className="modal-panel__sub">{subtitle}</p> : null}
              </div>
              <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-panel__body">{children}</div>
            {footer ? <div className="modal-panel__footer">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
