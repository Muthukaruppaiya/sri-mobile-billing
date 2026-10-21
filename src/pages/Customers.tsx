import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import type { Customer } from '../lib/types'
import { formatINR } from '../lib/types'
import { MiniStat, Modal, PageHeader, Panel, SuccessBanner } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'
import { matchesQuery } from '../lib/search'

const emptyForm = {
  name: '',
  phone: '',
  altPhone: '',
  city: '',
  address: '',
  notes: '',
}

export function CustomersPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [creditFilter, setCreditFilter] = useState<'all' | 'due' | 'clear'>('all')
  const [done, setDone] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [edit, setEdit] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const listQ = useQuery({
    queryKey: ['customers', q],
    queryFn: () =>
      api<Customer[]>(`/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),
  })

  const list = useMemo(() => {
    const raw = listQ.data || []
    return raw.filter((c) => {
      if (!matchesQuery(q, c.name, c.phone, c.altPhone, c.city, c.notes, c.address)) return false
      const due = Number(c.creditBalance) || 0
      if (creditFilter === 'due') return due > 0
      if (creditFilter === 'clear') return due <= 0
      return true
    })
  }, [listQ.data, q, creditFilter])
  const withCredit = useMemo(
    () => list.filter((c) => Number(c.creditBalance) > 0).length,
    [list],
  )

  const save = useMutation({
    mutationFn: async () => {
      if (edit) {
        return api<Customer>(`/customers/${edit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            altPhone: form.altPhone.trim() || null,
            city: form.city.trim() || null,
            address: form.address.trim() || null,
            notes: form.notes.trim() || null,
          }),
        })
      }
      return api<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          altPhone: form.altPhone.trim() || undefined,
          city: form.city.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
    },
    onSuccess: () => {
      setDone(edit ? `${form.name.trim()} updated` : `${form.name.trim()} added`)
      setAddOpen(false)
      setEdit(null)
      setForm(emptyForm)
      setError('')
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  function openAdd() {
    setEdit(null)
    setForm(emptyForm)
    setError('')
    setAddOpen(true)
  }

  function openEdit(c: Customer) {
    setEdit(c)
    setForm({
      name: c.name,
      phone: c.phone || '',
      altPhone: c.altPhone || '',
      city: c.city || '',
      address: c.address || '',
      notes: c.notes || '',
    })
    setError('')
    setAddOpen(true)
  }

  function submit() {
    setError('')
    if (!form.phone.trim()) {
      setError('Enter phone number')
      return
    }
    if (!form.name.trim()) {
      setError('Enter customer name')
      return
    }
    save.mutate()
  }

  return (
    <div className="section-gap">
      {done ? (
        <SuccessBanner
          title={done.includes('updated') ? 'Customer updated successfully' : 'Customer created successfully'}
          detail={done}
          onClose={() => setDone(null)}
        />
      ) : null}
      <PageHeader
        title="Customers"
        subtitle="Master list — used in Sale, Service & used-phone buy-in"
        action={
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            <Plus size={14} /> Add customer
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat label="Customers" value={String(list.length)} tone="ok" />
        <MiniStat label="With credit" value={String(withCredit)} tone="warn" />
      </div>

      <Panel style={{ padding: 12 }}>
        <div className="filter-bar">
          <div style={{ flex: 1, minWidth: 200 }}>
            <SearchField
              value={q}
              onChange={setQ}
              placeholder="Search phone, name, city…"
            />
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Credit filter">
            {(
              [
                ['all', 'All'],
                ['due', 'Credit due'],
                ['clear', 'Settled'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`mode-tab${creditFilter === id ? ' is-active' : ''}`}
                onClick={() => setCreditFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Name</th>
                <th>City</th>
                <th>Credit</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {c.phone || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.city || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatINR(c.creditBalance || 0)}
                  </td>
                  <td className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.notes || '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      onClick={() => openEdit(c)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length ? (
            <div className="empty-state">
              {q ? 'No customers match.' : 'No customers yet. Add one or book a sale/service.'}
            </div>
          ) : null}
        </div>
      </Panel>

      <Modal
        open={addOpen}
        title={edit ? 'Edit customer' : 'Add customer'}
        subtitle="Phone is the primary key for quick lookup in billing"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={save.isPending}
              onClick={submit}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {error ? <p className="purchase-desk__error">{error}</p> : null}
        <div className="purchase-fields">
          <label>
            Phone *
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Mobile number"
              inputMode="tel"
            />
          </label>
          <label>
            Name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
            />
          </label>
          <label>
            Alt phone
            <input
              value={form.altPhone}
              onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
            />
          </label>
          <label>
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label className="span-2">
            Address
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="span-2">
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
