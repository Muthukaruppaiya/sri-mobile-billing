import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Wrench } from 'lucide-react'
import { api } from '../lib/api'
import type { ServiceJob } from '../lib/types'
import { formatINR } from '../lib/types'
import { formatDate, SERVICE_STATUS_LABEL, SERVICE_TYPE_LABEL, serviceStatusTone } from '../lib/format'
import { matchesQuery } from '../lib/search'
import { MiniStat, PageHeader, Panel, TitleCount } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'
import { serviceDue } from '../components/ServiceActions'

type Tab = 'open' | 'sub' | 'ready' | 'delivered' | 'due' | 'cancelled' | 'all'

const OPEN = ['BOOKED', 'RECEIVED', 'IN_PROGRESS']

function inTab(job: ServiceJob, tab: Tab) {
  switch (tab) {
    case 'open':
      return OPEN.includes(job.status)
    case 'sub':
      return job.status === 'AT_SUBCONTRACT'
    case 'ready':
      return job.status === 'READY'
    case 'delivered':
      return job.status === 'DELIVERED'
    case 'due':
      return job.status === 'DELIVERED' && serviceDue(job) > 0
    case 'cancelled':
      return job.status === 'CANCELLED'
    default:
      return true
  }
}

function isOverdue(job: ServiceJob) {
  if (!job.promisedDate || !OPEN.concat('AT_SUBCONTRACT').includes(job.status)) return false
  const end = new Date(job.promisedDate)
  end.setHours(23, 59, 59, 999)
  return end.getTime() < Date.now()
}

export function ServiceTicketsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('open')
  const [q, setQ] = useState('')

  const jobsQ = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => api<ServiceJob[]>('/services'),
  })
  const all = useMemo(() => jobsQ.data || [], [jobsQ.data])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, sub: 0, ready: 0, delivered: 0, due: 0, cancelled: 0, all: all.length }
    for (const j of all) {
      for (const t of ['open', 'sub', 'ready', 'delivered', 'due', 'cancelled'] as Tab[]) {
        if (inTab(j, t)) c[t] += 1
      }
    }
    return c
  }, [all])

  const overdue = all.filter(isOverdue).length
  const pendingDue = all.filter((j) => j.status === 'DELIVERED').reduce((s, j) => s + serviceDue(j), 0)

  const list = useMemo(
    () =>
      all.filter(
        (job) =>
          inTab(job, tab) &&
          matchesQuery(
            q,
            job.ticketNo,
            job.customer?.name,
            job.customer?.phone,
            job.deviceBrand,
            job.deviceModel,
            job.imei,
            job.issue,
            job.subcontractorName,
          ),
      ),
    [all, tab, q],
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'open', label: 'In shop' },
    { id: 'sub', label: 'At subcontract' },
    { id: 'ready', label: 'Ready' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'due', label: 'Balance due' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="section-gap">
      <PageHeader
        title="Service tickets"
        subtitle="Every repair job — open a ticket to record work, deliver, print or collect balance"
        action={
          <button type="button" className="btn btn--primary" onClick={() => navigate('/app/service/booking')}>
            <Wrench size={16} /> New booking
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat label="In shop" value={String(counts.open)} tone="info" onClick={() => setTab('open')} />
        <MiniStat label="At subcontract" value={String(counts.sub)} tone="warn" onClick={() => setTab('sub')} />
        <MiniStat label="Ready to deliver" value={String(counts.ready)} tone="ok" onClick={() => setTab('ready')} />
        <MiniStat
          label="Balance due"
          value={formatINR(pendingDue)}
          hint={`${counts.due} tickets`}
          tone="warn"
          onClick={() => setTab('due')}
        />
        {overdue ? <MiniStat label="Past promise date" value={String(overdue)} tone="warn" /> : null}
      </div>

      <Panel style={{ padding: 16 }}>
        <div className="search-toolbar">
          <div style={{ flex: 1, minWidth: 220 }}>
            <SearchField value={q} onChange={setQ} placeholder="Search ticket, phone, name, device, IMEI…" />
          </div>
        </div>
        <div className="filter-tabs" style={{ marginBottom: 12 }} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`filter-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="filter-count">({counts[t.id]})</span>
            </button>
          ))}
        </div>

        <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
          {tabs.find((t) => t.id === tab)?.label} <TitleCount n={list.length} />
        </h2>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Device / problem</th>
                <th>Booked</th>
                <th>Promise</th>
                <th>Charge</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((job) => {
                const due = serviceDue(job)
                const late = isOverdue(job)
                return (
                  <tr key={job.id} className="click-row" onClick={() => navigate(`/app/service/tickets/${job.id}`)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{job.ticketNo}</td>
                    <td>
                      {job.customer?.name || '—'}
                      <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                        {job.customer?.phone || ''}
                      </div>
                    </td>
                    <td className="cell-wrap">
                      {[job.deviceBrand, job.deviceModel].filter(Boolean).join(' ') || '—'}
                      {job.issue ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {job.issue}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                      {formatDate(job.createdAt)}
                    </td>
                    <td className={late ? 'danger' : 'muted'} style={{ fontSize: 'var(--fs-xs)', fontWeight: late ? 700 : 400 }}>
                      {job.promisedDate ? formatDate(job.promisedDate) : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {Number(job.customerCharge) ? formatINR(job.customerCharge) : formatINR(job.estimateAmount || 0)}
                      {!Number(job.customerCharge) && Number(job.estimateAmount) ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          estimate
                        </div>
                      ) : null}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(job.paidAmount)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {Number(job.customerCharge) ? formatINR(due) : '—'}
                    </td>
                    <td>
                      <span className={`chip ${serviceStatusTone(job.status)}`}>
                        {SERVICE_STATUS_LABEL[job.status] || job.status}
                      </span>
                      {job.status !== 'BOOKED' && job.status !== 'CANCELLED' ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {job.status === 'AT_SUBCONTRACT' ? job.subcontractorName : SERVICE_TYPE_LABEL[job.type]}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {jobsQ.isLoading ? <div className="empty-state">Loading…</div> : null}
          {!jobsQ.isLoading && !list.length ? (
            <div className="empty-state">{q ? 'No tickets match.' : 'No tickets in this view.'}</div>
          ) : null}
        </div>
      </Panel>
    </div>
  )
}
