import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { Printer } from 'lucide-react'
import { api } from '../lib/api'
import type { ServiceJob } from '../lib/types'
import { formatINR } from '../lib/types'
import { formatDate, SERVICE_TYPE_LABEL } from '../lib/format'
import { matchesQuery } from '../lib/search'
import { openDoc } from '../lib/print'
import { SuccessBanner, TitleCount } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'
import { ServiceActionModal, serviceDue } from '../components/ServiceActions'

export function ServiceDeliveryPage() {
  const navigate = useNavigate()
  const [done, setDone] = useState<{ job: ServiceJob; message: string } | null>(null)
  const [job, setJob] = useState<ServiceJob | null>(null)
  const [q, setQ] = useState('')

  const readyQ = useQuery({
    queryKey: ['services', 'ready'],
    queryFn: () => api<ServiceJob[]>('/services?status=READY'),
  })

  const list = useMemo(
    () =>
      (readyQ.data || []).filter((j) =>
        matchesQuery(q, j.ticketNo, j.customer?.name, j.customer?.phone, j.deviceBrand, j.deviceModel, j.imei),
      ),
    [readyQ.data, q],
  )

  return (
    <div className="purchase-desk">
      <header className="purchase-desk__top">
        <div className="purchase-desk__title-row">
          <div>
            <h1>Service · Delivery</h1>
            <p className="purchase-desk__sub">
              Ready tickets — collect balance (charge − advance), hand over and print the bill
            </p>
          </div>
        </div>
        <AnimatePresence>
          {done ? (
            <SuccessBanner
              title="Delivered"
              detail={done.message}
              onClose={() => setDone(null)}
              actions={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openDoc('service-bill', done.job.id, { autoPrint: true })}
                >
                  <Printer size={14} /> Print bill
                </button>
              }
            />
          ) : null}
        </AnimatePresence>
      </header>

      <section className="purchase-card purchase-card--lines-wide">
        <div className="purchase-lines-head">
          <h2>
            Ready for delivery <TitleCount n={list.length} />
          </h2>
          <div style={{ minWidth: 240 }}>
            <SearchField value={q} onChange={setQ} placeholder="Ticket, phone, name…" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Type</th>
                <th>Ready since</th>
                <th>Charge</th>
                <th>Paid</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((j) => {
                const due = serviceDue(j)
                return (
                  <tr key={j.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => navigate(`/app/service/tickets/${j.id}`)}
                      >
                        {j.ticketNo}
                      </button>
                    </td>
                    <td>
                      {j.customer?.name || '—'}
                      {j.customer?.phone ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {j.customer.phone}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {[j.deviceBrand, j.deviceModel].filter(Boolean).join(' ') || '—'}
                      {j.imei ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {j.imei}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className="chip">{SERVICE_TYPE_LABEL[j.type] || j.type}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                      {formatDate(j.readyAt || j.createdAt)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(j.customerCharge)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(j.paidAmount)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatINR(due)}</td>
                    <td className="table-action">
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => setJob(j)}>
                        Deliver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {readyQ.isLoading ? <div className="empty-state">Loading…</div> : null}
          {!readyQ.isLoading && !list.length ? (
            <div className="empty-state">No tickets ready. Record the work on a ticket first.</div>
          ) : null}
        </div>
      </section>

      <ServiceActionModal
        job={job}
        action={job ? 'deliver' : null}
        onClose={() => setJob(null)}
        onDone={(j, message) => {
          setJob(null)
          setDone({ job: j, message })
        }}
      />
    </div>
  )
}
