import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Ban,
  FileText,
  HandCoins,
  Package,
  Pencil,
  Printer,
  Truck,
  Undo2,
  Wrench,
  PackageCheck,
} from 'lucide-react'
import { api } from '../lib/api'
import type { ServiceJob } from '../lib/types'
import { formatINR } from '../lib/types'
import {
  formatDate,
  formatDateTime,
  PAYMENT_MODE_LABEL,
  SERVICE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  serviceStatusTone,
} from '../lib/format'
import { openDoc } from '../lib/print'
import { specSummary } from '../lib/productSpecs'
import { useAuth } from '../lib/auth'
import { Panel, SuccessBanner } from '../components/ui'
import { ServiceActionModal, serviceDue, type ServiceAction } from '../components/ServiceActions'

const STEPS = [
  { id: 'BOOKED', label: 'Booked' },
  { id: 'WORK', label: 'Work done' },
  { id: 'READY', label: 'Ready' },
  { id: 'DELIVERED', label: 'Delivered' },
]

function stepIndex(status: string) {
  if (status === 'DELIVERED') return 3
  if (status === 'READY') return 2
  if (status === 'AT_SUBCONTRACT') return 1
  return 0
}

function n(v: number | string | null | undefined) {
  return Number(v || 0)
}

export function ServiceTicketPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [action, setAction] = useState<ServiceAction | null>(null)
  const [done, setDone] = useState<{ job: ServiceJob; message: string } | null>(null)

  const jobQ = useQuery({
    queryKey: ['service', id],
    queryFn: () => api<ServiceJob>(`/services/${id}`),
    enabled: Boolean(id),
  })
  const job = jobQ.data

  if (jobQ.isLoading) return <div className="empty-state">Loading ticket…</div>
  if (!job) {
    return (
      <div className="section-gap">
        <p className="form-error">{(jobQ.error as Error)?.message || 'Ticket not found'}</p>
        <Link to="/app/service/tickets" className="btn btn--ghost" style={{ alignSelf: 'start' }}>
          <ArrowLeft size={14} /> Back to tickets
        </Link>
      </div>
    )
  }

  const status = job.status
  const open = ['BOOKED', 'RECEIVED', 'IN_PROGRESS'].includes(status)
  const due = serviceDue(job)
  const charge = n(job.customerCharge)
  const cancelled = status === 'CANCELLED'
  const current = stepIndex(status)
  const payments = job.payments || []

  const actions: Array<{ id: ServiceAction; label: string; hint: string; icon: typeof Wrench }> = []
  if (open) {
    actions.push(
      { id: 'spares', label: 'With spare', hint: 'Spares + labour → Ready', icon: Package },
      { id: 'labour', label: 'Without spare', hint: 'Labour only → Ready', icon: Wrench },
      { id: 'subcontract', label: 'Subcontract', hint: 'Send to outside technician', icon: Truck },
    )
  }
  if (status === 'AT_SUBCONTRACT') {
    actions.push({ id: 'sub-return', label: 'Returned from subcontract', hint: 'Final cost → Ready', icon: Undo2 })
  }
  if (status === 'READY') {
    actions.push({ id: 'deliver', label: 'Deliver', hint: `Collect ${formatINR(due)} and hand over`, icon: PackageCheck })
  }
  if (status === 'DELIVERED' && due > 0) {
    actions.push({ id: 'collect', label: 'Collect balance', hint: `${formatINR(due)} pending`, icon: HandCoins })
  }

  return (
    <div className="section-gap">
      {done ? (
        <SuccessBanner
          title="Saved"
          detail={done.message}
          onClose={() => setDone(null)}
          actions={
            done.job.status === 'DELIVERED' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => openDoc('service-bill', done.job.id, { autoPrint: true })}
              >
                <Printer size={14} /> Print bill
              </button>
            ) : undefined
          }
        />
      ) : null}

      <div className="ticket-head">
        <div>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            style={{ marginBottom: 8 }}
            onClick={() => navigate('/app/service/tickets')}
          >
            <ArrowLeft size={13} /> Tickets
          </button>
          <p className="ticket-no">{job.ticketNo}</p>
          <p className="page-sub">
            Booked {formatDateTime(job.createdAt)}
            {job.createdBy ? ` by ${job.createdBy.name}` : ''}
          </p>
        </div>
        <div className="table-actions">
          <span className={`chip ${serviceStatusTone(status)}`} style={{ alignSelf: 'center' }}>
            {SERVICE_STATUS_LABEL[status] || status}
          </span>
          <button type="button" className="btn btn--ghost" onClick={() => openDoc('jobcard', job.id)}>
            <FileText size={14} /> Job card
          </button>
          {charge > 0 || status === 'DELIVERED' ? (
            <button type="button" className="btn btn--ghost" onClick={() => openDoc('service-bill', job.id)}>
              <Printer size={14} /> Bill
            </button>
          ) : null}
          {!['DELIVERED', 'CANCELLED'].includes(status) ? (
            <button type="button" className="btn btn--ghost" onClick={() => setAction('edit')}>
              <Pencil size={14} /> Edit
            </button>
          ) : null}
        </div>
      </div>

      <ol className="ticket-steps" aria-label="Ticket progress">
        {cancelled ? (
          <li className="ticket-step is-cancelled">
            <Ban size={12} /> Cancelled {formatDate(job.cancelledAt)}
            {job.cancelReason ? ` — ${job.cancelReason}` : ''}
          </li>
        ) : (
          STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`ticket-step${i < current || status === 'DELIVERED' ? ' is-done' : ''}${
                i === current && status !== 'DELIVERED' ? ' is-current' : ''
              }`}
            >
              {i + 1}. {s.id === 'WORK' && status === 'AT_SUBCONTRACT' ? 'At subcontract' : s.label}
            </li>
          ))
        )}
      </ol>

      <div className="ticket-grid">
        <div className="section-gap">
          {actions.length ? (
            <Panel style={{ padding: 16 }}>
              <h2 className="section-title">Next step</h2>
              <div className="action-grid">
                {actions.map((a) => {
                  const Icon = a.icon
                  return (
                    <button key={a.id} type="button" className="action-tile" onClick={() => setAction(a.id)}>
                      <Icon size={18} color="var(--brand)" />
                      <strong>{a.label}</strong>
                      <span>{a.hint}</span>
                    </button>
                  )
                })}
              </div>
            </Panel>
          ) : null}

          <Panel style={{ padding: 16 }}>
            <h2 className="section-title">Device & problem</h2>
            <dl className="kv">
              <dt>Device</dt>
              <dd>{[job.deviceBrand, job.deviceModel].filter(Boolean).join(' ') || '—'}</dd>
              <dt>IMEI / serial</dt>
              <dd style={{ fontFamily: 'var(--font-mono)' }}>{job.imei || '—'}</dd>
              <dt>Problem</dt>
              <dd>{job.issue || '—'}</dd>
              <dt>Accessories</dt>
              <dd>{job.accessories || 'Device only'}</dd>
              <dt>Condition</dt>
              <dd>{job.conditionNote || '—'}</dd>
              <dt>Promise date</dt>
              <dd>{job.promisedDate ? formatDate(job.promisedDate) : '—'}</dd>
              {job.notes ? (
                <>
                  <dt>Notes</dt>
                  <dd>{job.notes}</dd>
                </>
              ) : null}
              {job.subcontractorName ? (
                <>
                  <dt>Subcontractor</dt>
                  <dd>
                    {job.subcontractorName} · {formatINR(job.subcontractCost)}
                  </dd>
                </>
              ) : null}
            </dl>
          </Panel>

          {job.spares?.length ? (
            <Panel style={{ padding: 16 }}>
              <h2 className="section-title">Spares used</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Spare</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.spares.map((s) => (
                      <tr key={s.id}>
                        <td className="cell-wrap">
                          {s.product.brand} {s.product.name}
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {specSummary(s.product) || s.product.sku}
                          </div>
                        </td>
                        <td>{s.qty}</td>
                        <td>{formatINR(s.unitCost)}</td>
                        <td>{formatINR(s.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="section-gap">
          <Panel style={{ padding: 16 }}>
            <h2 className="section-title">Customer</h2>
            <dl className="kv">
              <dt>Name</dt>
              <dd>{job.customer?.name || '—'}</dd>
              <dt>Phone</dt>
              <dd style={{ fontFamily: 'var(--font-mono)' }}>{job.customer?.phone || '—'}</dd>
            </dl>
          </Panel>

          <Panel style={{ padding: 16 }}>
            <h2 className="section-title">Charges</h2>
            <div className="totals-box">
              <div className="totals-row">
                <span>Estimate</span>
                <span>{formatINR(job.estimateAmount || 0)}</span>
              </div>
              {charge > 0 ? (
                <>
                  {n(job.spareCost) > 0 ? (
                    <div className="totals-row">
                      <span>Spares</span>
                      <span>{formatINR(job.spareCost)}</span>
                    </div>
                  ) : null}
                  {n(job.subcontractCost) > 0 && job.type === 'SUBCONTRACT' ? (
                    <div className="totals-row">
                      <span>Subcontract</span>
                      <span>{formatINR(job.subcontractCost)}</span>
                    </div>
                  ) : null}
                  <div className="totals-row">
                    <span>Labour</span>
                    <span>{formatINR(job.labourCharge)}</span>
                  </div>
                  <div className="totals-row totals-row--grand">
                    <span>Total charge</span>
                    <span>{formatINR(charge)}</span>
                  </div>
                </>
              ) : null}
              <div className="totals-row">
                <span>Paid</span>
                <span>{formatINR(job.paidAmount)}</span>
              </div>
              {charge > 0 ? (
                <div className="totals-row totals-row--grand">
                  <span>{due > 0 ? 'Balance due' : 'Balance'}</span>
                  <span className={due > 0 ? 'danger' : ''}>{formatINR(due)}</span>
                </div>
              ) : null}
              {isAdmin && charge > 0 ? (
                <div className="totals-row">
                  <span className="muted">Margin (admin)</span>
                  <span className="muted">{formatINR(job.margin)}</span>
                </div>
              ) : null}
            </div>
            <p className="form-hint" style={{ marginTop: 8 }}>
              {charge > 0 ? SERVICE_TYPE_LABEL[job.type] : 'Charge is set when the work is recorded.'}
            </p>
          </Panel>

          <Panel style={{ padding: 16 }}>
            <h2 className="section-title">Payments</h2>
            {payments.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mode</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {formatDateTime(p.paidAt)}
                          {p.note ? (
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {p.note}
                            </div>
                          ) : null}
                        </td>
                        <td>{PAYMENT_MODE_LABEL[p.mode] || p.mode}</td>
                        <td className={Number(p.amount) < 0 ? 'danger' : ''}>{formatINR(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                No payments yet.
              </p>
            )}
          </Panel>

          {!['DELIVERED', 'CANCELLED'].includes(status) ? (
            <button
              type="button"
              className="btn btn--danger"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setAction('cancel')}
            >
              <Ban size={14} /> Cancel ticket
            </button>
          ) : null}
        </div>
      </div>

      <ServiceActionModal
        job={job}
        action={action}
        onClose={() => setAction(null)}
        onDone={(j, message) => {
          setAction(null)
          setDone({ job: j, message })
        }}
      />
    </div>
  )
}
