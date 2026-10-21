import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import { formatINR } from '../lib/types'
import { Modal, SuccessBanner, TitleCount } from '../components/ui'
import { ComboSelect, PAYMENT_MODES } from '../components/SearchableSelect'
import type { ServiceJob } from './Service'

function n(v: number | string | null | undefined) {
  return Number(v || 0)
}

export function ServiceDeliveryPage() {
  const qc = useQueryClient()
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [job, setJob] = useState<ServiceJob | null>(null)
  const [collect, setCollect] = useState(0)
  const [mode, setMode] = useState('CASH')

  const readyQ = useQuery({
    queryKey: ['services', 'ready'],
    queryFn: () => api<ServiceJob[]>('/services?status=READY'),
  })

  const deliver = useMutation({
    mutationFn: () =>
      api(`/services/${job!.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ collectAmount: collect, paymentMode: mode }),
      }),
    onSuccess: (j: ServiceJob) => {
      setDone(`Delivered ${j.ticketNo} · collected ${formatINR(collect)}`)
      setJob(null)
      setError('')
      qc.invalidateQueries({ queryKey: ['services'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  function openDeliver(j: ServiceJob) {
    const due = Math.max(n(j.customerCharge) - n(j.paidAmount), 0)
    setJob(j)
    setCollect(due)
    setMode('CASH')
    setError('')
  }

  const list = readyQ.data || []

  return (
    <div className="purchase-desk">
      <header className="purchase-desk__top">
        <div className="purchase-desk__title-row">
          <div>
            <h1>Service · Delivery</h1>
            <p className="purchase-desk__sub">
              Ready tickets — collect balance (charge − advance) and hand over
            </p>
          </div>
        </div>
        <AnimatePresence>
          {done ? (
            <SuccessBanner title="Delivered successfully" detail={done} onClose={() => setDone(null)} />
          ) : null}
        </AnimatePresence>
        {error && !job ? <p className="purchase-desk__error">{error}</p> : null}
      </header>

      <section className="purchase-card purchase-card--lines-wide">
        <div className="purchase-lines-head">
          <h2>
            Ready for delivery <TitleCount n={list.length} />
          </h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Type</th>
                <th>Charge</th>
                <th>Advance / paid</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((j) => {
                const due = Math.max(n(j.customerCharge) - n(j.paidAmount), 0)
                const typeLabel =
                  j.type === 'SELF_WITH_SPARES'
                    ? 'With spare'
                    : j.type === 'SUBCONTRACT'
                      ? 'Subcontract'
                      : 'No spare'
                return (
                  <tr key={j.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {j.ticketNo}
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
                      <span className="chip">{typeLabel}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatINR(j.customerCharge)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(j.paidAmount)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {formatINR(due)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--primary"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        onClick={() => openDeliver(j)}
                      >
                        Deliver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length ? (
            <div className="empty-state">No tickets ready. Finish a job from Booking first.</div>
          ) : null}
        </div>
      </section>

      <Modal
        open={!!job}
        title={`Deliver · ${job?.ticketNo || ''}`}
        subtitle="Collect remaining balance and close ticket"
        onClose={() => setJob(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setJob(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={deliver.isPending}
              onClick={() => deliver.mutate()}
            >
              {deliver.isPending ? 'Saving…' : 'Confirm delivery'}
            </button>
          </>
        }
      >
        {error ? <p className="purchase-desk__error">{error}</p> : null}
        <div className="purchase-fields">
          <label>
            Customer
            <input readOnly value={job?.customer?.name || '—'} />
          </label>
          <label>
            Device
            <input
              readOnly
              value={[job?.deviceBrand, job?.deviceModel].filter(Boolean).join(' ') || '—'}
            />
          </label>
          <label>
            Total charge
            <input readOnly value={formatINR(job?.customerCharge || 0)} />
          </label>
          <label>
            Already paid (advance)
            <input readOnly value={formatINR(job?.paidAmount || 0)} />
          </label>
          <label>
            Collect now ₹
            <input
              type="number"
              min={0}
              value={collect === 0 ? '' : collect}
              onChange={(e) =>
                setCollect(e.target.value.trim() === '' ? 0 : Number(e.target.value) || 0)
              }
              placeholder=""
            />
          </label>
          <label>
            Mode
            <ComboSelect
              value={mode}
              placeholder="Type mode…"
              options={PAYMENT_MODES.filter((m) => m.id !== 'CREDIT')}
              onChange={setMode}
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
