import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import type { Customer, Purchase, Sale, ServiceJob } from '../lib/types'
import { formatINR } from '../lib/types'
import { formatDate, SERVICE_STATUS_LABEL } from '../lib/format'
import { openDoc } from '../lib/print'
import { MiniStat, Modal, PageHeader, Panel, SuccessBanner, TitleCount } from '../components/ui'
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
  const [creditFilter, setCreditFilter] = useState<'all' | 'due' | 'owed' | 'clear'>('all')
  const [historyFor, setHistoryFor] = useState<Customer | null>(null)
  const navigate = useNavigate()
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
      const owed = Number(c.payableBalance) || 0
      if (creditFilter === 'due') return due > 0
      if (creditFilter === 'owed') return owed > 0
      if (creditFilter === 'clear') return due <= 0 && owed <= 0
      return true
    })
  }, [listQ.data, q, creditFilter])
  const receivable = useMemo(
    () => (listQ.data || []).reduce((s, c) => s + Math.max(Number(c.creditBalance) || 0, 0), 0),
    [listQ.data],
  )
  const payable = useMemo(
    () => (listQ.data || []).reduce((s, c) => s + Math.max(Number(c.payableBalance) || 0, 0), 0),
    [listQ.data],
  )

  const historyQ = useQuery({
    queryKey: ['customers', 'history', historyFor?.id],
    queryFn: () => api<CustomerHistory>(`/customers/${historyFor!.id}/history`),
    enabled: Boolean(historyFor),
  })

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
        <MiniStat label="Customers" value={String((listQ.data || []).length)} tone="ok" onClick={() => setCreditFilter('all')} />
        <MiniStat
          label="Owe the shop"
          value={formatINR(receivable)}
          hint="Sale / service credit"
          tone="warn"
          onClick={() => setCreditFilter('due')}
        />
        <MiniStat
          label="Shop owes"
          value={formatINR(payable)}
          hint="Used phone buy-in"
          tone="info"
          onClick={() => setCreditFilter('owed')}
        />
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
                ['due', 'Owes shop'],
                ['owed', 'Shop owes'],
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
                <th>Owes shop</th>
                <th>Shop owes</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const due = Number(c.creditBalance) || 0
                const owed = Number(c.payableBalance) || 0
                return (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.phone || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.city || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }} className={due > 0 ? 'danger' : 'muted'}>
                      {due > 0 ? formatINR(due) : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }} className={owed > 0 ? 'accent' : 'muted'}>
                      {owed > 0 ? formatINR(owed) : '—'}
                    </td>
                    <td className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.notes || '—'}
                    </td>
                    <td className="table-action">
                      <div className="table-actions">
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setHistoryFor(c)}>
                          History
                        </button>
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => openEdit(c)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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

      <Modal
        open={Boolean(historyFor)}
        title={historyFor?.name || 'Customer'}
        subtitle={historyFor?.phone || undefined}
        onClose={() => setHistoryFor(null)}
        wide
        footer={
          <button type="button" className="btn btn--ghost" onClick={() => setHistoryFor(null)}>
            Close
          </button>
        }
      >
        {historyQ.isLoading ? (
          <p className="muted">Loading…</p>
        ) : historyQ.data ? (
          <div className="section-gap">
            <div className="totals-box">
              <div className="totals-row">
                <span>Owes the shop</span>
                <span>{formatINR(historyQ.data.customer.creditBalance)}</span>
              </div>
              <div className="totals-row">
                <span>Shop owes (buy-in)</span>
                <span>{formatINR(historyQ.data.customer.payableBalance || 0)}</span>
              </div>
            </div>

            <HistoryTable
              title="Sales"
              empty="No sales"
              rows={historyQ.data.sales.map((s) => ({
                id: s.id,
                date: s.saleDate,
                ref: s.invoiceNo || s.id.slice(-6).toUpperCase(),
                label:
                  (s.items || [])
                    .map((it) => [it.product?.brand, it.product?.name].filter(Boolean).join(' '))
                    .join(', ') || 'Sale',
                amount: s.grandTotal,
                due: s.creditAmount,
                onOpen: () => openDoc('sale', s.id),
              }))}
            />
            <HistoryTable
              title="Service tickets"
              empty="No service tickets"
              rows={historyQ.data.services.map((j) => ({
                id: j.id,
                date: j.createdAt,
                ref: j.ticketNo,
                label: `${[j.deviceBrand, j.deviceModel].filter(Boolean).join(' ') || 'Device'} · ${
                  SERVICE_STATUS_LABEL[j.status] || j.status
                }`,
                amount: j.customerCharge,
                due: Math.max(Number(j.customerCharge) - Number(j.paidAmount), 0),
                onOpen: () => navigate(`/app/service/tickets/${j.id}`),
              }))}
            />
            <HistoryTable
              title="Bought from customer"
              empty="No buy-ins"
              rows={historyQ.data.purchases.map((p) => ({
                id: p.id,
                date: p.purchaseDate,
                ref: p.invoiceNo || `PV-${p.id.slice(-6).toUpperCase()}`,
                label:
                  (p.items || []).map((it) => [it.product.brand, it.product.name].filter(Boolean).join(' ')).join(', ') ||
                  'Purchase',
                amount: p.grandTotal,
                due: p.creditAmount,
                onOpen: () => openDoc('purchase', p.id),
              }))}
            />
          </div>
        ) : (
          <p className="danger">{(historyQ.error as Error)?.message || 'Could not load history'}</p>
        )}
      </Modal>
    </div>
  )
}

type CustomerHistory = {
  customer: Customer
  sales: Sale[]
  services: ServiceJob[]
  purchases: Purchase[]
}

function HistoryTable({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: Array<{
    id: string
    date: string
    ref: string
    label: string
    amount: number | string
    due: number | string
    onOpen: () => void
  }>
}) {
  return (
    <div>
      <h3 className="section-title" style={{ fontSize: '0.9rem', marginBottom: 6 }}>
        {title} <TitleCount n={rows.length} />
      </h3>
      {rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref</th>
                <th>Details</th>
                <th>Amount</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="click-row" onClick={r.onOpen}>
                  <td>{formatDate(r.date)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.ref}</td>
                  <td className="cell-wrap">{r.label}</td>
                  <td>{formatINR(r.amount)}</td>
                  <td className={Number(r.due) > 0 ? 'danger' : 'muted'}>
                    {Number(r.due) > 0 ? formatINR(r.due) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
          {empty}
        </p>
      )}
    </div>
  )
}
