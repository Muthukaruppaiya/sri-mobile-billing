import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { ClipboardList, Printer } from 'lucide-react'
import { api } from '../lib/api'
import type { ServiceJob } from '../lib/types'
import { formatINR } from '../lib/types'
import { formatDateTime, SERVICE_STATUS_LABEL, serviceStatusTone } from '../lib/format'
import { openDoc } from '../lib/print'
import { SuccessBanner, TitleCount } from '../components/ui'
import { ComboSelect, PAYMENT_MODES } from '../components/SearchableSelect'
import {
  CustomerPhoneField,
  customerPayload,
  emptyCustomerDraft,
  type CustomerDraft,
} from '../components/CustomerPhoneField'
import { BrandModelFields } from '../components/BrandModelFields'

const ACCESSORY_CHIPS = ['SIM tray', 'Back cover', 'Charger', 'Cable', 'Memory card', 'Box']
const PAY_MODES = PAYMENT_MODES.filter((m) => m.id !== 'CREDIT')

function emptyNum(v: number) {
  return !v ? '' : v
}

function parseNum(raw: string) {
  if (raw.trim() === '') return 0
  const x = Number(raw)
  return Number.isFinite(x) ? x : 0
}

export function ServicePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [booked, setBooked] = useState<ServiceJob | null>(null)
  const [error, setError] = useState('')

  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomerDraft)
  const [deviceBrand, setDeviceBrand] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [imei, setImei] = useState('')
  const [issue, setIssue] = useState('')
  const [accessories, setAccessories] = useState<string[]>([])
  const [accessoryNote, setAccessoryNote] = useState('')
  const [conditionNote, setConditionNote] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [advance, setAdvance] = useState(0)
  const [advanceMode, setAdvanceMode] = useState('CASH')
  const [estimate, setEstimate] = useState(0)

  const recentQ = useQuery({
    queryKey: ['services', 'recent'],
    queryFn: () => api<ServiceJob[]>('/services?status=BOOKED,RECEIVED,IN_PROGRESS,AT_SUBCONTRACT,READY'),
  })
  const recent = (recentQ.data || []).slice(0, 8)

  function reset() {
    setCustomer(emptyCustomerDraft())
    setDeviceBrand('')
    setDeviceModel('')
    setImei('')
    setIssue('')
    setAccessories([])
    setAccessoryNote('')
    setConditionNote('')
    setPromisedDate('')
    setAdvance(0)
    setAdvanceMode('CASH')
    setEstimate(0)
    setError('')
  }

  const book = useMutation({
    mutationFn: () =>
      api<ServiceJob>('/services', {
        method: 'POST',
        body: JSON.stringify({
          ...customerPayload(customer),
          deviceBrand: deviceBrand || undefined,
          deviceModel: deviceModel || undefined,
          imei: imei.trim() || undefined,
          issue: issue.trim() || undefined,
          accessories: [...accessories, accessoryNote.trim()].filter(Boolean).join(', ') || undefined,
          conditionNote: conditionNote.trim() || undefined,
          estimateAmount: estimate,
          advanceAmount: advance,
          paymentMode: advanceMode,
          promisedDate: promisedDate || undefined,
        }),
      }),
    onSuccess: (job) => {
      setBooked(job)
      reset()
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  function saveBooking() {
    setError('')
    if (!customer.phone.trim()) return setError('Enter customer phone')
    if (!customer.name.trim()) return setError('Enter customer name')
    if (!deviceBrand.trim() && !deviceModel.trim()) return setError('Enter the device brand / model')
    if (!issue.trim()) return setError('Describe the problem')
    book.mutate()
  }

  function toggleAccessory(a: string) {
    setAccessories((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
  }

  return (
    <div className="purchase-desk">
      <header className="purchase-desk__top">
        <div className="purchase-desk__title-row">
          <div>
            <h1>Service · New booking</h1>
            <p className="purchase-desk__sub">
              Take customer + device details and advance → print the job card → work continues in Tickets
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/app/service/tickets')}>
            <ClipboardList size={15} /> All tickets
          </button>
        </div>
        <AnimatePresence>
          {booked ? (
            <SuccessBanner
              title={`Ticket ${booked.ticketNo} booked`}
              detail={`${booked.customer?.name || 'Customer'} · estimate ${formatINR(
                booked.estimateAmount || 0,
              )} · advance ${formatINR(booked.advanceAmount)}`}
              onClose={() => setBooked(null)}
              actions={
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => navigate(`/app/service/tickets/${booked.id}`)}
                  >
                    Open ticket
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => openDoc('jobcard', booked.id, { autoPrint: true })}
                  >
                    <Printer size={14} /> Print job card
                  </button>
                </>
              }
            />
          ) : null}
        </AnimatePresence>
        {error ? <p className="purchase-desk__error">{error}</p> : null}
      </header>

      <div className="purchase-desk__grid purchase-desk__grid--solo">
        <section className="purchase-card">
          <div className="purchase-card__head">
            <h2>Customer & device</h2>
          </div>
          <CustomerPhoneField value={customer} onChange={setCustomer} />
          <div className="purchase-fields" style={{ marginTop: 10 }}>
            <BrandModelFields
              required
              brand={deviceBrand}
              model={deviceModel}
              onChange={({ brand, model }) => {
                setDeviceBrand(brand)
                setDeviceModel(model)
              }}
            />
            <label>
              IMEI / serial
              <input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Promise date
              <input type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} />
            </label>
            <label className="span-2">
              Problem reported *
              <input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Not charging / display broken / speaker low…"
              />
            </label>
            <label className="span-2">
              Accessories received
              <div className="option-chip-row">
                {ACCESSORY_CHIPS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`option-chip${accessories.includes(a) ? ' is-on' : ''}`}
                    style={{ padding: '6px 12px' }}
                    onClick={() => toggleAccessory(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <input
                value={accessoryNote}
                onChange={(e) => setAccessoryNote(e.target.value)}
                placeholder="Other items (optional)"
              />
            </label>
            <label className="span-2">
              Condition at intake
              <input
                value={conditionNote}
                onChange={(e) => setConditionNote(e.target.value)}
                placeholder="Scratches, cracked back, dead on arrival, passcode given…"
              />
            </label>
          </div>
        </section>

        <section className="purchase-card purchase-card--pay">
          <div className="purchase-card__head">
            <h2>Estimate & advance</h2>
          </div>
          <div className="purchase-fields">
            <label>
              Estimate ₹
              <input
                type="number"
                min={0}
                value={emptyNum(estimate)}
                onChange={(e) => setEstimate(parseNum(e.target.value))}
                placeholder="Quoted amount"
              />
            </label>
            <label>
              Advance ₹
              <input
                type="number"
                min={0}
                value={emptyNum(advance)}
                onChange={(e) => setAdvance(parseNum(e.target.value))}
              />
            </label>
            {advance > 0 ? (
              <label>
                Advance mode
                <ComboSelect
                  value={advanceMode}
                  placeholder="Mode"
                  options={PAY_MODES}
                  onChange={(v) => setAdvanceMode(v || 'CASH')}
                />
              </label>
            ) : null}
          </div>
          <div className="purchase-total-bar">
            <div>
              <span className="muted">Estimate</span>
              <strong>{formatINR(estimate)}</strong>
            </div>
            <div>
              <span className="muted">Advance</span>
              <strong className="purchase-grand">{formatINR(advance)}</strong>
            </div>
            <button type="button" className="btn btn--primary" disabled={book.isPending} onClick={saveBooking}>
              {book.isPending ? 'Booking…' : 'Book ticket'}
            </button>
          </div>
        </section>
      </div>

      <section className="purchase-card">
        <div className="purchase-lines-head">
          <h2>
            Latest open tickets <TitleCount n={(recentQ.data || []).length} />
          </h2>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/app/service/tickets')}>
            View all
          </button>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Booked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((job) => (
                <tr key={job.id} className="click-row" onClick={() => navigate(`/app/service/tickets/${job.id}`)}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{job.ticketNo}</td>
                  <td>
                    {job.customer?.name || '—'}
                    <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                      {job.customer?.phone || ''}
                    </div>
                  </td>
                  <td>{[job.deviceBrand, job.deviceModel].filter(Boolean).join(' ') || '—'}</td>
                  <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    {formatDateTime(job.createdAt)}
                  </td>
                  <td>
                    <span className={`chip ${serviceStatusTone(job.status)}`}>
                      {SERVICE_STATUS_LABEL[job.status] || job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent.length ? <div className="empty-state">No open tickets.</div> : null}
        </div>
      </section>
    </div>
  )
}
