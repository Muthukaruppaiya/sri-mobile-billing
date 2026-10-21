import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, UserCheck } from 'lucide-react'
import { api } from '../lib/api'
import type { Customer } from '../lib/types'
import { digitsOnly } from '../lib/search'

export type CustomerDraft = {
  customerId: string | null
  phone: string
  name: string
  /** true when phone not found in DB — will create on save */
  isNew: boolean
}

export const emptyCustomerDraft = (): CustomerDraft => ({
  customerId: null,
  phone: '',
  name: '',
  isNew: true,
})

function last10(s: string | null | undefined) {
  return digitsOnly(s).slice(-10)
}

type Props = {
  value: CustomerDraft
  onChange: (v: CustomerDraft) => void
  showName?: boolean
  disabled?: boolean
}

export function CustomerPhoneField({ value, onChange, showName = true, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280 })
  const rootRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const [debouncedPhone, setDebouncedPhone] = useState(value.phone)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(value.phone.trim()), 180)
    return () => clearTimeout(t)
  }, [value.phone])

  const q = digitsOnly(debouncedPhone).length >= 3 ? digitsOnly(debouncedPhone) : ''

  const searchQ = useQuery({
    queryKey: ['customers', 'phone', q],
    queryFn: () => api<Customer[]>(`/customers?phone=${encodeURIComponent(q)}`),
    enabled: q.length >= 3,
  })

  const matches = useMemo(() => searchQ.data || [], [searchQ.data])

  function pick(c: Customer) {
    onChange({
      customerId: c.id,
      phone: c.phone || value.phone,
      name: c.name,
      isNew: false,
    })
    setOpen(false)
  }

  // Auto-fill when the typed number is an exact last-10 match
  useEffect(() => {
    if (!q || value.customerId || searchQ.isFetching) return
    if (last10(q).length < 10) return
    const exact = matches.find(
      (c) => last10(c.phone) === last10(q) || last10(c.altPhone) === last10(q),
    )
    if (exact) pick(exact)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, q, searchQ.isFetching, value.customerId])

  function place() {
    const el = phoneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 280)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < 220 && r.top > spaceBelow
    setCoords({
      top: openUp ? Math.max(8, r.top - 220) : r.bottom + 4,
      left: Math.max(8, left),
      width,
    })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, matches.length])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (rootRef.current?.contains(t)) return
      if (t?.closest?.('.customer-phone-field__dropdown')) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc, true)
    return () => document.removeEventListener('pointerdown', onDoc, true)
  }, [])

  function onPhoneChange(phone: string) {
    onChange({
      customerId: null,
      phone,
      name: '',
      isNew: true,
    })
    setOpen(digitsOnly(phone).length >= 3)
  }

  const showSuggest = open && q.length >= 3 && !disabled && !value.customerId

  return (
    <div className="customer-phone-field" ref={rootRef}>
      <div className="purchase-fields">
        <label className={showName ? '' : 'span-2'}>
          Phone * (search first)
          <div className="customer-phone-field__input-wrap">
            <Search size={14} className="customer-phone-field__icon" aria-hidden />
            <input
              ref={phoneRef}
              value={value.phone}
              disabled={disabled}
              inputMode="tel"
              autoComplete="tel"
              placeholder="Mobile number…"
              onChange={(e) => onPhoneChange(e.target.value)}
              onFocus={() => {
                if (digitsOnly(value.phone).length >= 3 && !value.customerId) {
                  place()
                  setOpen(true)
                }
              }}
            />
          </div>
        </label>
        {showName ? (
          <label>
            Name *
            <input
              value={value.name}
              disabled={disabled}
              placeholder={value.isNew ? 'New customer name' : 'Customer name'}
              onChange={(e) =>
                onChange({
                  ...value,
                  name: e.target.value,
                })
              }
            />
          </label>
        ) : null}
      </div>

      <div className="customer-phone-field__status">
        {value.customerId && !value.isNew ? (
          <span className="chip chip--live">
            <UserCheck size={12} /> Existing customer
          </span>
        ) : value.phone.trim().length >= 3 ? (
          <span className="chip">
            <UserPlus size={12} /> New — will save on submit
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Type phone to find or create customer
          </span>
        )}
      </div>

      {showSuggest
        ? createPortal(
            <div
              className="customer-phone-field__dropdown"
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 120,
              }}
              role="listbox"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {searchQ.isFetching ? (
                <div className="customer-phone-field__empty">Searching…</div>
              ) : matches.length ? (
                matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="customer-phone-field__option"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      pick(c)
                    }}
                  >
                    <strong>{c.name}</strong>
                    <span>{c.phone || '—'}</span>
                    {c.city ? <span className="muted">{c.city}</span> : null}
                  </button>
                ))
              ) : (
                <div className="customer-phone-field__empty">
                  No match — enter name as new customer
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/** Build API payload fragment for sale/service/purchase */
export function customerPayload(draft: CustomerDraft) {
  if (draft.customerId && !draft.isNew) {
    return { customerId: draft.customerId }
  }
  return {
    createCustomer: {
      name: draft.name.trim(),
      phone: draft.phone.trim() || undefined,
    },
  }
}
