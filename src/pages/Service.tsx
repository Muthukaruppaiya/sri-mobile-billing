import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { Package, Wrench, Truck, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Product } from '../lib/types'
import { formatINR } from '../lib/types'
import { Modal, SuccessBanner, TitleCount } from '../components/ui'
import { matchesQuery } from '../lib/search'
import { SearchableSelect, SearchField } from '../components/SearchableSelect'
import {
  CustomerPhoneField,
  customerPayload,
  emptyCustomerDraft,
  type CustomerDraft,
} from '../components/CustomerPhoneField'
import { productSearchBlob } from '../lib/search'
import { specSummary } from '../lib/productSpecs'
import { BrandModelFields } from '../components/BrandModelFields'

export type ServiceJob = {
  id: string
  ticketNo: string
  type: string
  status: string
  deviceBrand?: string | null
  deviceModel?: string | null
  imei?: string | null
  issue?: string | null
  labourCharge: number | string
  spareCost: number | string
  subcontractCost: number | string
  customerCharge: number | string
  estimateAmount?: number | string
  advanceAmount: number | string
  paidAmount: number | string
  margin: number | string
  subcontractorName?: string | null
  promisedDate?: string | null
  createdAt: string
  customer?: { id: string; name: string; phone?: string | null } | null
  spares?: Array<{
    id: string
    qty: number
    unitCost: number | string
    product: Product
  }>
}

type SpareLine = { key: string; productId: string; qty: number; unitCost: number }

function emptySpare(): SpareLine {
  return { key: crypto.randomUUID(), productId: '', qty: 1, unitCost: 0 }
}

function n(v: number | string | null | undefined) {
  return Number(v || 0)
}

/** Show blank instead of 0 in amount fields */
function emptyNum(v: number) {
  return !v ? '' : v
}

function parseNum(raw: string) {
  if (raw.trim() === '') return 0
  const x = Number(raw)
  return Number.isFinite(x) ? x : 0
}

type ActionMode = 'spares' | 'labour' | 'subcontract' | 'sub-return' | null

export function ServicePage() {
  const qc = useQueryClient()
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomerDraft)
  const [deviceBrand, setDeviceBrand] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [imei, setImei] = useState('')
  const [issue, setIssue] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [advance, setAdvance] = useState(0)
  const [estimate, setEstimate] = useState(0)
  const [jobFilter, setJobFilter] = useState('')
  const [jobStatus, setJobStatus] = useState<'all' | 'booked' | 'sub'>('all')

  const [actionJob, setActionJob] = useState<ServiceJob | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [labourCharge, setLabourCharge] = useState(0)
  const [timeMinutes, setTimeMinutes] = useState(0)
  const [spares, setSpares] = useState<SpareLine[]>([emptySpare()])
  const [subName, setSubName] = useState('')
  const [amountGiven, setAmountGiven] = useState(0)
  const [subFinalCost, setSubFinalCost] = useState(0)

  const openQ = useQuery({
    queryKey: ['services', 'open'],
    queryFn: () =>
      api<ServiceJob[]>('/services?status=BOOKED,RECEIVED,IN_PROGRESS,AT_SUBCONTRACT'),
  })

  const productsQ = useQuery({
    queryKey: ['products', 'SPARE'],
    queryFn: () => api<Product[]>('/products?category=SPARE'),
    enabled: actionMode === 'spares',
  })
  const accessoryQ = useQuery({
    queryKey: ['products', 'ACCESSORY'],
    queryFn: () => api<Product[]>('/products?category=ACCESSORY'),
    enabled: actionMode === 'spares',
  })

  const products = useMemo(
    () => [...(productsQ.data || []), ...(accessoryQ.data || [])],
    [productsQ.data, accessoryQ.data],
  )

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: `${p.brand} ${p.name}`,
        hint: [`Stock ${p.stockQty}`, p.sku, specSummary(p)].filter(Boolean).join(' · '),
        terms: productSearchBlob(p),
      })),
    [products],
  )

  const spareCost = useMemo(
    () => spares.reduce((s, l) => s + l.qty * l.unitCost, 0),
    [spares],
  )

  const book = useMutation({
    mutationFn: () =>
      api<ServiceJob>('/services', {
        method: 'POST',
        body: JSON.stringify({
          ...customerPayload(customer),
          deviceBrand: deviceBrand || undefined,
          deviceModel: deviceModel || undefined,
          imei: imei || undefined,
          issue: issue || undefined,
          estimateAmount: estimate,
          advanceAmount: advance,
          promisedDate: promisedDate || undefined,
        }),
      }),
    onSuccess: (job) => {
      setDone(`Ticket ${job.ticketNo} booked · estimate ${formatINR(job.estimateAmount || estimate)} · advance ${formatINR(job.advanceAmount)}`)
      setCustomer(emptyCustomerDraft())
      setDeviceBrand('')
      setDeviceModel('')
      setImei('')
      setIssue('')
      setPromisedDate('')
      setAdvance(0)
      setEstimate(0)
      setError('')
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const withSpares = useMutation({
    mutationFn: () =>
      api(`/services/${actionJob!.id}/with-spares`, {
        method: 'POST',
        body: JSON.stringify({
          labourCharge,
          timeMinutes,
          spares: spares
            .filter((s) => s.productId)
            .map((s) => ({ productId: s.productId, qty: s.qty, unitCost: s.unitCost })),
        }),
      }),
    onSuccess: (job: ServiceJob) => {
      setDone(`Spare work saved on ${job.ticketNo} · sent to delivery`)
      closeAction()
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const withoutSpares = useMutation({
    mutationFn: () =>
      api(`/services/${actionJob!.id}/without-spares`, {
        method: 'POST',
        body: JSON.stringify({ labourCharge, timeMinutes }),
      }),
    onSuccess: (job: ServiceJob) => {
      setDone(`Labour saved on ${job.ticketNo} · sent to delivery`)
      closeAction()
      qc.invalidateQueries({ queryKey: ['services'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const sendSub = useMutation({
    mutationFn: () =>
      api(`/services/${actionJob!.id}/subcontract`, {
        method: 'POST',
        body: JSON.stringify({
          subcontractorName: subName.trim(),
          amountGiven,
        }),
      }),
    onSuccess: (job: ServiceJob) => {
      setDone(`${job.ticketNo} subcontracted to ${job.subcontractorName}`)
      closeAction()
      qc.invalidateQueries({ queryKey: ['services'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const returnSub = useMutation({
    mutationFn: () =>
      api(`/services/${actionJob!.id}/subcontract-return`, {
        method: 'POST',
        body: JSON.stringify({
          subcontractCost: subFinalCost,
          labourCharge,
        }),
      }),
    onSuccess: (job: ServiceJob) => {
      setDone(`${job.ticketNo} returned from subcontract · sent to delivery`)
      closeAction()
      qc.invalidateQueries({ queryKey: ['services'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  function closeAction() {
    setActionJob(null)
    setActionMode(null)
    setError('')
  }

  function openAction(job: ServiceJob, mode: ActionMode) {
    setError('')
    setActionJob(job)
    setActionMode(mode)
    setLabourCharge(0)
    setTimeMinutes(0)
    setSpares([emptySpare()])
    setSubName('')
    setAmountGiven(0)
    setSubFinalCost(n(job.subcontractCost))
  }

  function saveBooking() {
    setError('')
    if (!customer.phone.trim()) {
      setError('Enter customer phone')
      return
    }
    if (!customer.name.trim()) {
      setError('Enter customer name')
      return
    }
    book.mutate()
  }

  const openJobs = useMemo(() => {
    const list = openQ.data || []
    return list.filter((job) => {
      if (jobStatus === 'booked' && job.status === 'AT_SUBCONTRACT') return false
      if (jobStatus === 'sub' && job.status !== 'AT_SUBCONTRACT') return false
      return matchesQuery(
        jobFilter,
        job.ticketNo,
        job.customer?.name,
        job.customer?.phone,
        job.deviceBrand,
        job.deviceModel,
        job.imei,
        job.issue,
        job.subcontractorName,
      )
    })
  }, [openQ.data, jobFilter, jobStatus])

  return (
    <div className="purchase-desk">
      <header className="purchase-desk__top">
        <div className="purchase-desk__title-row">
          <div>
            <h1>Service · Booking</h1>
            <p className="purchase-desk__sub">
              First visit: take details + advance → then With spare / Without spare / Subcontract →
              Delivery
            </p>
          </div>
        </div>
        <AnimatePresence>
          {done ? (
            <SuccessBanner
              title={
                /subcontracted/i.test(done)
                  ? 'Subcontracted successfully'
                  : /booked/i.test(done)
                    ? 'Service created successfully'
                    : 'Saved successfully'
              }
              detail={done}
              onClose={() => setDone(null)}
            />
          ) : null}
        </AnimatePresence>
        {error && !actionMode ? <p className="purchase-desk__error">{error}</p> : null}
      </header>

      <div className="purchase-desk__grid purchase-desk__grid--solo">
        <section className="purchase-card">
          <div className="purchase-card__head">
            <h2>1 · Book (first visit)</h2>
          </div>
          <CustomerPhoneField value={customer} onChange={setCustomer} />
          <div className="purchase-fields" style={{ marginTop: 10 }}>
            <BrandModelFields
              brand={deviceBrand}
              model={deviceModel}
              onChange={({ brand, model }) => {
                setDeviceBrand(brand)
                setDeviceModel(model)
              }}
            />
            <label>
              IMEI
              <input value={imei} onChange={(e) => setImei(e.target.value)} />
            </label>
            <label>
              Promise date
              <input
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
              />
            </label>
            <label className="span-2">
              Issue
              <input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Not charging / screen…"
              />
            </label>
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
                placeholder=""
              />
            </label>
          </div>
          <div className="purchase-total-bar">
            <div>
              <span className="muted">Estimate · Advance</span>
              <strong>
                {formatINR(estimate)} · {formatINR(advance)}
              </strong>
            </div>
            <div />
            <button
              type="button"
              className="btn btn--primary"
              disabled={book.isPending}
              onClick={saveBooking}
            >
              {book.isPending ? 'Booking…' : 'Book ticket'}
            </button>
          </div>
        </section>

        <section className="purchase-card purchase-card--lines purchase-card--lines-wide">
          <div className="purchase-lines-head">
            <h2>
              2 · Open jobs — choose action <TitleCount n={openJobs.length} />
            </h2>
          </div>
          <div className="search-toolbar" style={{ marginBottom: 10 }}>
            <SearchField
              value={jobFilter}
              onChange={setJobFilter}
              placeholder="Search ticket, phone, name…"
            />
            <div className="mode-tabs" role="tablist" aria-label="Job filter">
              {(
                [
                  ['all', 'All'],
                  ['booked', 'In shop'],
                  ['sub', 'At subcontract'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`mode-tab${jobStatus === id ? ' is-active' : ''}`}
                  onClick={() => setJobStatus(id)}
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
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Device</th>
                  <th>Estimate</th>
                  <th>Advance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {openJobs.map((job) => {
                  const atSub = job.status === 'AT_SUBCONTRACT'
                  return (
                    <tr key={job.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {job.ticketNo}
                      </td>
                      <td>
                        {job.customer?.name || '—'}
                        {job.customer?.phone ? (
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {job.customer.phone}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {[job.deviceBrand, job.deviceModel].filter(Boolean).join(' ') || '—'}
                        {job.imei ? (
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {job.imei}
                          </div>
                        ) : null}
                        {job.issue ? (
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {job.issue}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatINR(job.estimateAmount || 0)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatINR(job.advanceAmount)}
                      </td>
                      <td>
                        <span className={`chip${atSub ? ' chip--warn' : ' chip--live'}`}>
                          {atSub ? 'At subcontract' : 'Booked'}
                        </span>
                        {atSub && job.subcontractorName ? (
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {job.subcontractorName} · given {formatINR(job.subcontractCost)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {atSub ? (
                          <button
                            type="button"
                            className="btn btn--primary"
                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                            onClick={() => openAction(job, 'sub-return')}
                          >
                            Return → Delivery
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                              onClick={() => openAction(job, 'spares')}
                            >
                              <Package size={12} /> With spare
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                              onClick={() => openAction(job, 'labour')}
                            >
                              <Wrench size={12} /> Without spare
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                              onClick={() => openAction(job, 'subcontract')}
                            >
                              <Truck size={12} /> Subcontract
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!openJobs.length ? (
              <div className="empty-state">No open tickets. Book a customer first.</div>
            ) : null}
          </div>
        </section>
      </div>

      {/* With spares */}
      <Modal
        open={actionMode === 'spares' && !!actionJob}
        title={`With spare · ${actionJob?.ticketNo || ''}`}
        subtitle="Add spares used — then ticket goes to Delivery"
        onClose={closeAction}
        wide
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeAction}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={withSpares.isPending}
              onClick={() => {
                if (!spares.some((s) => s.productId)) {
                  setError('Add at least one spare')
                  return
                }
                if (labourCharge + spareCost <= 0) {
                  setError('Enter labour and/or spare amounts')
                  return
                }
                withSpares.mutate()
              }}
            >
              {withSpares.isPending ? 'Saving…' : 'Save → Delivery'}
            </button>
          </>
        }
      >
        {error ? <p className="purchase-desk__error">{error}</p> : null}
        <div className="purchase-fields" style={{ marginBottom: 12 }}>
          <label>
            Labour ₹
            <input
              type="number"
              min={0}
              value={emptyNum(labourCharge)}
              onChange={(e) => setLabourCharge(parseNum(e.target.value))}
              placeholder=""
            />
          </label>
          <label>
            Spares total
            <input readOnly value={formatINR(spareCost)} />
          </label>
          <label>
            Total from customer
            <input readOnly value={formatINR(labourCharge + spareCost)} />
          </label>
          <label>
            Advance already
            <input readOnly value={formatINR(actionJob?.advanceAmount || 0)} />
          </label>
          <label>
            Balance on delivery
            <input
              readOnly
              value={formatINR(
                Math.max(labourCharge + spareCost - n(actionJob?.advanceAmount), 0),
              )}
            />
          </label>
        </div>
        <div className="purchase-lines-head" style={{ margin: '0 0 8px', padding: '6px 0' }}>
          <h2>
            Spares used <TitleCount n={spares.length} />
          </h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setSpares((p) => [...p, emptySpare()])}
          >
            <Plus size={14} /> Add spare
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {spares.map((l, idx) => (
            <div
              key={l.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 100px 32px',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <SearchableSelect
                options={productOptions}
                value={l.productId}
                placeholder="Search spare…"
                emptyLabel="No spares"
                onChange={(id) => {
                  const p = products.find((x) => x.id === id)
                  setSpares((prev) =>
                    prev.map((x) =>
                      x.key === l.key
                        ? {
                            ...x,
                            productId: id,
                            unitCost: Number(p?.sellPrice || p?.mrp || 0),
                          }
                        : x,
                    ),
                  )
                }}
              />
              <input
                type="number"
                min={1}
                value={l.qty || ''}
                placeholder="Qty"
                onChange={(e) =>
                  setSpares((prev) =>
                    prev.map((x) =>
                      x.key === l.key
                        ? { ...x, qty: Math.max(1, parseNum(e.target.value) || 1) }
                        : x,
                    ),
                  )
                }
              />
              <input
                type="number"
                min={0}
                value={emptyNum(l.unitCost)}
                placeholder="Price"
                onChange={(e) =>
                  setSpares((prev) =>
                    prev.map((x) =>
                      x.key === l.key ? { ...x, unitCost: parseNum(e.target.value) } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="purchase-line__del"
                disabled={spares.length === 1}
                onClick={() => setSpares((prev) => prev.filter((x) => x.key !== l.key))}
                aria-label={`Remove spare ${idx + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Without spares */}
      <Modal
        open={actionMode === 'labour' && !!actionJob}
        title={`Without spare · ${actionJob?.ticketNo || ''}`}
        subtitle="Labour / diagnosis only — then Delivery"
        onClose={closeAction}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeAction}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={withoutSpares.isPending}
              onClick={() => {
                if (labourCharge <= 0) {
                  setError('Enter labour charge to collect')
                  return
                }
                withoutSpares.mutate()
              }}
            >
              {withoutSpares.isPending ? 'Saving…' : 'Save → Delivery'}
            </button>
          </>
        }
      >
        {error ? <p className="purchase-desk__error">{error}</p> : null}
        <div className="purchase-fields">
          <label>
            Labour charge (collect) ₹ *
            <input
              type="number"
              min={0}
              value={emptyNum(labourCharge)}
              onChange={(e) => setLabourCharge(parseNum(e.target.value))}
              placeholder="Amount from customer"
            />
          </label>
          <label>
            Time (min)
            <input
              type="number"
              min={0}
              value={emptyNum(timeMinutes)}
              onChange={(e) => setTimeMinutes(parseNum(e.target.value))}
              placeholder="60"
            />
          </label>
          <label>
            Advance already
            <input readOnly value={formatINR(actionJob?.advanceAmount || 0)} />
          </label>
          <label>
            Balance on delivery
            <input
              readOnly
              value={formatINR(Math.max(labourCharge - n(actionJob?.advanceAmount), 0))}
            />
          </label>
        </div>
      </Modal>

      {/* Send subcontract */}
      <Modal
        open={actionMode === 'subcontract' && !!actionJob}
        title={`Subcontract · ${actionJob?.ticketNo || ''}`}
        subtitle="Send out — enter subcontractor and amount given now"
        onClose={closeAction}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeAction}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={sendSub.isPending}
              onClick={() => {
                if (!subName.trim()) {
                  setError('Enter subcontractor name')
                  return
                }
                sendSub.mutate()
              }}
            >
              {sendSub.isPending ? 'Saving…' : 'Send to subcontract'}
            </button>
          </>
        }
      >
        {error ? <p className="purchase-desk__error">{error}</p> : null}
        <div className="purchase-fields">
          <label className="span-2">
            Subcontractor name *
            <input
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Shop / technician name"
            />
          </label>
          <label>
            Amt given to subcontractor ₹ *
            <input
              type="number"
              min={0}
              value={emptyNum(amountGiven)}
              onChange={(e) => setAmountGiven(parseNum(e.target.value))}
              placeholder=""
            />
          </label>
          <label>
            Advance from customer
            <input readOnly value={formatINR(actionJob?.advanceAmount || 0)} />
          </label>
        </div>
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 'var(--fs-xs)' }}>
          When the phone returns, use Return → Delivery to enter final cost and customer charge.
        </p>
      </Modal>

      {/* Subcontract return */}
      <Modal
        open={actionMode === 'sub-return' && !!actionJob}
        title={`Subcontract return · ${actionJob?.ticketNo || ''}`}
        subtitle={`${actionJob?.subcontractorName || 'Sub'} — enter final amt, then Delivery`}
        onClose={closeAction}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeAction}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={returnSub.isPending}
              onClick={() => {
                if (labourCharge + subFinalCost <= 0) {
                  setError('Enter labour and/or subcontract amount')
                  return
                }
                returnSub.mutate()
              }}
            >
              {returnSub.isPending ? 'Saving…' : 'Save → Delivery'}
            </button>
          </>
        }
      >
        {error ? <p className="purchase-desk__error">{error}</p> : null}
        <div className="purchase-fields">
          <label>
            Final amt to subcontractor ₹ *
            <input
              type="number"
              min={0}
              value={emptyNum(subFinalCost)}
              onChange={(e) => setSubFinalCost(parseNum(e.target.value))}
              placeholder=""
            />
          </label>
          <label>
            Our labour ₹
            <input
              type="number"
              min={0}
              value={emptyNum(labourCharge)}
              onChange={(e) => setLabourCharge(parseNum(e.target.value))}
              placeholder=""
            />
          </label>
          <label>
            Total from customer
            <input readOnly value={formatINR(labourCharge + subFinalCost)} />
          </label>
          <label>
            Advance already
            <input readOnly value={formatINR(actionJob?.advanceAmount || 0)} />
          </label>
          <label>
            Balance on delivery
            <input
              readOnly
              value={formatINR(
                Math.max(labourCharge + subFinalCost - n(actionJob?.advanceAmount), 0),
              )}
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
