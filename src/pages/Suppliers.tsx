import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Supplier } from '../lib/types'
import { formatINR } from '../lib/types'
import { matchesQuery } from '../lib/search'
import { PageHeader, Panel, SuccessBanner, TitleCount } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'

export function SuppliersPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [creditFilter, setCreditFilter] = useState<'all' | 'due' | 'clear'>('all')
  const [done, setDone] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', gstin: '', address: '' })
  const listQ = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<Supplier[]>('/suppliers'),
  })

  const create = useMutation({
    mutationFn: () =>
      api('/suppliers', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setDone(`${form.name.trim()} added to directory`)
      setForm({ name: '', phone: '', gstin: '', address: '' })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })

  const filtered = useMemo(
    () =>
      (listQ.data || []).filter((s) => {
        if (!matchesQuery(q, s.name, s.phone, s.gstin, s.address)) return false
        const due = Number(s.creditBalance) || 0
        if (creditFilter === 'due') return due > 0
        if (creditFilter === 'clear') return due <= 0
        return true
      }),
    [listQ.data, q, creditFilter],
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    create.mutate()
  }

  return (
    <div className="section-gap">
      <PageHeader title="Suppliers" subtitle="Purchase parties & credit balance" />
      {done ? (
        <SuccessBanner title="Supplier created successfully" detail={done} onClose={() => setDone(null)} />
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">Add supplier</h2>
          <form className="form-grid form-grid--2" onSubmit={onSubmit}>
            <div className="field">
              <label>Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>GSTIN</label>
              <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </div>
            <div className="field">
              <label>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <button className="btn btn--primary" type="submit" disabled={create.isPending}>
              Save
            </button>
          </form>
        </Panel>

        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">
            Directory <TitleCount n={filtered.length} />
          </h2>
          <div className="search-toolbar">
            <SearchField
              value={q}
              onChange={setQ}
              placeholder="Search name, phone, GSTIN…"
            />
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
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Credit due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{formatINR(s.creditBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? (
              <div className="empty-state">{q ? 'No suppliers match.' : 'No suppliers yet.'}</div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  )
}
