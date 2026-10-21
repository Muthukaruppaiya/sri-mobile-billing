import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { matchesQuery } from '../lib/search'

export type SearchOption = {
  id: string
  label: string
  hint?: string
  /** Extra fields joined for search: brand, model, imei, sku… */
  terms: Array<string | number | null | undefined>
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search brand, model, IMEI…',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`search-field ${className}`.trim()}>
      <Search size={16} className="search-field__icon" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" className="search-field__clear" onClick={() => onChange('')} aria-label="Clear">
          <X size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  emptyLabel = 'No matches',
  disabled,
  allowCreate = false,
}: {
  options: SearchOption[]
  value: string
  onChange: (id: string, option?: SearchOption) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  allowCreate?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280 })
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)
  const selectedLabel = selected?.label || (value && !options.length ? value : '') || ''

  useEffect(() => {
    if (!open) setQ(selectedLabel)
  }, [selectedLabel, open])

  const createText = q.trim()
  const canCreate =
    allowCreate &&
    Boolean(createText) &&
    !options.some((o) => o.label.toLowerCase() === createText.toLowerCase())

  const filtered = useMemo(() => {
    const list = options.filter((o) => matchesQuery(q, o.label, o.hint, ...o.terms))
    return list.slice(0, 80)
  }, [options, q])

  const rows = useMemo(() => {
    const list: Array<{ kind: 'create' | 'option'; option?: SearchOption }> = []
    if (canCreate) list.push({ kind: 'create' })
    for (const o of filtered) list.push({ kind: 'option', option: o })
    return list
  }, [canCreate, filtered])

  function place() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 220)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < 260 && r.top > spaceBelow
    setCoords({
      top: openUp ? Math.max(8, r.top - 8) : r.bottom + 6,
      left: Math.max(8, left),
      width,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, filtered.length])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      if ((e.target as HTMLElement)?.closest?.('.search-select__dropdown')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    setHi(0)
  }, [q])

  function pick(id: string, option?: SearchOption) {
    onChange(id, option)
    setQ(option?.label || id)
    setOpen(false)
  }

  function commitTyped() {
    const text = q.trim()
    if (!text) {
      if (value) onChange('')
      return
    }
    const exact = options.find((o) => o.label.toLowerCase() === text.toLowerCase())
    if (exact) {
      pick(exact.id, exact)
      return
    }
    if (allowCreate) {
      pick(text, { id: text, label: text, terms: [text] })
    } else {
      setQ(selectedLabel)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHi((n) => Math.min(n + 1, Math.max(rows.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((n) => Math.max(n - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[hi]
      if (row?.kind === 'create') pick(createText, { id: createText, label: createText, terms: [createText] })
      else if (row?.option) pick(row.option.id, row.option)
      else commitTyped()
    } else if (e.key === 'Escape') {
      setQ(selectedLabel)
      setOpen(false)
    }
  }

  const dropdown = open
    ? createPortal(
        <div
          className="search-select__dropdown search-select__dropdown--portal"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex: 90,
          }}
        >
          <div className="search-select__list" role="listbox">
            {rows.length === 0 ? (
              <div className="search-select__empty">{emptyLabel}</div>
            ) : (
              rows.map((row, i) =>
                row.kind === 'create' ? (
                  <button
                    key="__create"
                    type="button"
                    role="option"
                    className={`search-select__option${i === hi ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHi(i)}
                    onClick={() =>
                      pick(createText, { id: createText, label: createText, terms: [createText] })
                    }
                  >
                    <span className="search-select__option-label">Use “{createText}”</span>
                    <span className="search-select__option-hint">Add to catalog</span>
                  </button>
                ) : (
                  <button
                    key={row.option!.id}
                    type="button"
                    role="option"
                    className={`search-select__option${row.option!.id === value || i === hi ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pick(row.option!.id, row.option)}
                  >
                    <span className="search-select__option-label">{row.option!.label}</span>
                    {row.option!.hint ? (
                      <span className="search-select__option-hint">{row.option!.hint}</span>
                    ) : null}
                  </button>
                ),
              )
            )}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className={`search-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <div className="search-select__field">
        <Search size={15} className="search-select__icon" aria-hidden />
        <input
          ref={inputRef}
          className="search-select__input"
          disabled={disabled}
          placeholder={placeholder}
          value={open ? q : selectedLabel}
          autoComplete="off"
          onFocus={() => {
            setQ(selectedLabel)
            setOpen(true)
          }}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                if (allowCreate) commitTyped()
                else setQ(selectedLabel)
                setOpen(false)
              }
            }, 120)
          }}
          onKeyDown={onKeyDown}
        />
        {(open ? q : selectedLabel) ? (
          <button
            type="button"
            className="search-select__clear"
            disabled={disabled}
            aria-label="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ('')
              onChange('')
              setOpen(true)
              inputRef.current?.focus()
            }}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      {dropdown}
    </div>
  )
}

export const PAYMENT_MODES = [
  { id: 'CASH', label: 'Cash' },
  { id: 'UPI', label: 'UPI' },
  { id: 'CARD', label: 'Card' },
  { id: 'BANK', label: 'Bank' },
  { id: 'CREDIT', label: 'Credit' },
]

export function ComboSelect({
  value,
  onChange,
  options,
  placeholder = 'Type to select…',
  allowCreate = false,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  options: Array<{ id: string; label: string; hint?: string }>
  placeholder?: string
  allowCreate?: boolean
  disabled?: boolean
}) {
  return (
    <SearchableSelect
      options={options.map((o) => ({
        id: o.id,
        label: o.label,
        hint: o.hint,
        terms: [o.id, o.label, o.hint],
      }))}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowCreate={allowCreate}
      disabled={disabled}
    />
  )
}
