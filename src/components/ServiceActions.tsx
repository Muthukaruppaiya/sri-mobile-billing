import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Product, ServiceJob } from '../lib/types'
import { formatINR } from '../lib/types'
import { localDateInput } from '../lib/format'
import { uid } from '../lib/uid'
import { productSearchBlob } from '../lib/search'
import { specSummary } from '../lib/productSpecs'
import { Modal, Segmented, TitleCount } from './ui'
import { ComboSelect, PAYMENT_MODES, SearchableSelect } from './SearchableSelect'
import { BrandModelFields } from './BrandModelFields'

export type ServiceAction =
  | 'spares'
  | 'labour'
  | 'subcontract'
  | 'sub-return'
  | 'deliver'
  | 'collect'
  | 'cancel'
  | 'edit'

type SpareLine = { key: string; productId: string; qty: number; unitPrice: number }

const PAY_MODES = PAYMENT_MODES.filter((m) => m.id !== 'CREDIT')

function emptySpare(): SpareLine {
  return { key: uid(), productId: '', qty: 1, unitPrice: 0 }
}

function n(v: number | string | null | undefined) {
  return Number(v || 0)
}

function emptyNum(v: number) {
  return !v ? '' : v
}

function parseNum(raw: string) {
  if (raw.trim() === '') return 0
  const x = Number(raw)
  return Number.isFinite(x) ? x : 0
}

export function serviceDue(job: Pick<ServiceJob, 'customerCharge' | 'paidAmount'>) {
  return Math.max(n(job.customerCharge) - n(job.paidAmount), 0)
}

const TITLES: Record<ServiceAction, string> = {
  spares: 'With spare',
  labour: 'Without spare',
  subcontract: 'Send to subcontract',
  'sub-return': 'Subcontract return',
  deliver: 'Deliver',
  collect: 'Collect balance',
  cancel: 'Cancel ticket',
  edit: 'Edit ticket',
}

const SUBTITLES: Record<ServiceAction, string> = {
  spares: 'Spares used are taken from stock — ticket moves to Ready for delivery',
  labour: 'Labour / diagnosis only — ticket moves to Ready for delivery',
  subcontract: 'Send the device out — record who has it and the amount given now',
  'sub-return': 'Device is back — enter final subcontract cost and our labour',
  deliver: 'Collect the balance and hand over the device',
  collect: 'Receive money still pending after delivery',
  cancel: 'Close the ticket without completing the work',
  edit: 'Correct device and intake details',
}

export function ServiceActionModal({
  job,
  action,
  onClose,
  onDone,
}: {
  job: ServiceJob | null
  action: ServiceAction | null
  onClose: () => void
  onDone: (job: ServiceJob, message: string) => void
}) {
  const qc = useQueryClient()
  const open = Boolean(job && action)
  const [error, setError] = useState('')
  const [labour, setLabour] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [spares, setSpares] = useState<SpareLine[]>([emptySpare()])
  const [subName, setSubName] = useState('')
  const [amountGiven, setAmountGiven] = useState(0)
  const [subFinal, setSubFinal] = useState(0)
  const [collect, setCollect] = useState(0)
  const [mode, setMode] = useState('CASH')
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState<'yes' | 'no'>('yes')
  const [edit, setEdit] = useState({
    deviceBrand: '',
    deviceModel: '',
    imei: '',
    issue: '',
    accessories: '',
    conditionNote: '',
    notes: '',
    estimateAmount: 0,
    promisedDate: '',
  })

  useEffect(() => {
    if (!job || !action) return
    setError('')
    setLabour(action === 'sub-return' ? n(job.labourCharge) : 0)
    setMinutes(0)
    setSpares([emptySpare()])
    setSubName(job.subcontractorName || '')
    setAmountGiven(0)
    setSubFinal(n(job.subcontractCost))
    setCollect(serviceDue(job))
    setMode('CASH')
    setReason('')
    setRefund(n(job.paidAmount) > 0 ? 'yes' : 'no')
    setEdit({
      deviceBrand: job.deviceBrand || '',
      deviceModel: job.deviceModel || '',
      imei: job.imei || '',
      issue: job.issue || '',
      accessories: job.accessories || '',
      conditionNote: job.conditionNote || '',
      notes: job.notes || '',
      estimateAmount: n(job.estimateAmount),
      promisedDate: job.promisedDate ? localDateInput(new Date(job.promisedDate)) : '',
    })
  }, [job, action])

  const productsQ = useQuery({
    queryKey: ['products', 'service-spares'],
    queryFn: async () => {
      const [sp, ac] = await Promise.all([
        api<Product[]>('/products?category=SPARE'),
        api<Product[]>('/products?category=ACCESSORY'),
      ])
      return [...sp, ...ac]
    },
    enabled: open && action === 'spares',
  })
  const products = useMemo(() => productsQ.data || [], [productsQ.data])
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
  const spareTotal = spares.reduce((s, l) => s + (l.productId ? l.qty * l.unitPrice : 0), 0)
  const advance = n(job?.paidAmount)

  const mutation = useMutation({
    mutationFn: async (): Promise<{ job: ServiceJob; message: string }> => {
      if (!job || !action) throw new Error('No ticket')
      const post = (path: string, body: unknown, method = 'POST') =>
        api<ServiceJob>(`/services/${job.id}${path}`, { method, body: JSON.stringify(body) })

      switch (action) {
        case 'spares': {
          const lines = spares.filter((s) => s.productId)
          if (!lines.length) throw new Error('Add at least one spare')
          for (const l of lines) {
            const p = products.find((x) => x.id === l.productId)
            if (p && l.qty > p.stockQty) throw new Error(`Only ${p.stockQty} of ${p.name} in stock`)
          }
          if (labour + spareTotal <= 0) throw new Error('Enter labour and/or spare amounts')
          const j = await post('/with-spares', {
            labourCharge: labour,
            timeMinutes: minutes || undefined,
            spares: lines.map((s) => ({ productId: s.productId, qty: s.qty, unitPrice: s.unitPrice })),
          })
          return { job: j, message: `${j.ticketNo} ready for delivery · charge ${formatINR(j.customerCharge)}` }
        }
        case 'labour': {
          if (labour <= 0) throw new Error('Enter labour charge to collect')
          const j = await post('/without-spares', { labourCharge: labour, timeMinutes: minutes || undefined })
          return { job: j, message: `${j.ticketNo} ready for delivery · charge ${formatINR(j.customerCharge)}` }
        }
        case 'subcontract': {
          if (!subName.trim()) throw new Error('Enter subcontractor name')
          const j = await post('/subcontract', { subcontractorName: subName.trim(), amountGiven })
          return { job: j, message: `${j.ticketNo} sent to ${j.subcontractorName}` }
        }
        case 'sub-return': {
          if (labour + subFinal <= 0) throw new Error('Enter labour and/or subcontract amount')
          const j = await post('/subcontract-return', { subcontractCost: subFinal, labourCharge: labour })
          return { job: j, message: `${j.ticketNo} back from subcontract · ready for delivery` }
        }
        case 'deliver': {
          const j = await post('/deliver', { collectAmount: collect, paymentMode: mode })
          const left = serviceDue(j)
          return {
            job: j,
            message: `${j.ticketNo} delivered · collected ${formatINR(collect)}${
              left > 0 ? ` · ${formatINR(left)} on customer credit` : ''
            }`,
          }
        }
        case 'collect': {
          if (collect <= 0) throw new Error('Enter amount received')
          const j = await post('/payments', { amount: collect, mode })
          return { job: j, message: `Received ${formatINR(collect)} on ${j.ticketNo}` }
        }
        case 'cancel': {
          if (!reason.trim()) throw new Error('Enter a reason')
          const j = await post('/cancel', { reason: reason.trim(), refundAdvance: refund === 'yes', paymentMode: mode })
          return {
            job: j,
            message: `${j.ticketNo} cancelled${refund === 'yes' && advance > 0 ? ` · refund ${formatINR(advance)}` : ''}`,
          }
        }
        case 'edit': {
          const j = await post(
            '',
            {
              deviceBrand: edit.deviceBrand.trim() || null,
              deviceModel: edit.deviceModel.trim() || null,
              imei: edit.imei.trim() || null,
              issue: edit.issue.trim() || null,
              accessories: edit.accessories.trim() || null,
              conditionNote: edit.conditionNote.trim() || null,
              notes: edit.notes.trim() || null,
              estimateAmount: edit.estimateAmount,
              promisedDate: edit.promisedDate || null,
            },
            'PATCH',
          )
          return { job: j, message: `${j.ticketNo} updated` }
        }
      }
    },
    onSuccess: ({ job: j, message }) => {
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['service', j.id] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      if (action === 'spares' || action === 'cancel') {
        qc.invalidateQueries({ queryKey: ['stock'] })
        qc.invalidateQueries({ queryKey: ['products'] })
      }
      onDone(j, message)
    },
    onError: (e: Error) => setError(e.message),
  })

  if (!job || !action) return null

  const due = serviceDue(job)
  const refundDue = Math.max(n(job.paidAmount) - n(job.customerCharge), 0)
  const primaryLabel: Record<ServiceAction, string> = {
    spares: 'Save → Ready',
    labour: 'Save → Ready',
    subcontract: 'Send to subcontract',
    'sub-return': 'Save → Ready',
    deliver: 'Confirm delivery',
    collect: 'Receive payment',
    cancel: 'Cancel ticket',
    edit: 'Save changes',
  }

  return (
    <Modal
      open={open}
      title={`${TITLES[action]} · ${job.ticketNo}`}
      subtitle={SUBTITLES[action]}
      onClose={onClose}
      wide={action === 'spares' || action === 'edit'}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Back
          </button>
          <button
            type="button"
            className={`btn ${action === 'cancel' ? 'btn--danger' : 'btn--primary'}`}
            disabled={mutation.isPending}
            onClick={() => {
              setError('')
              mutation.mutate()
            }}
          >
            {mutation.isPending ? 'Saving…' : primaryLabel[action]}
          </button>
        </>
      }
    >
      {error ? (
        <p className="form-error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      {action === 'spares' ? (
        <>
          <div className="purchase-fields" style={{ marginBottom: 12 }}>
            <label>
              Labour ₹
              <input
                type="number"
                min={0}
                value={emptyNum(labour)}
                onChange={(e) => setLabour(parseNum(e.target.value))}
              />
            </label>
            <label>
              Time (min)
              <input
                type="number"
                min={0}
                value={emptyNum(minutes)}
                onChange={(e) => setMinutes(parseNum(e.target.value))}
              />
            </label>
            <label>
              Spares total
              <input readOnly value={formatINR(spareTotal)} />
            </label>
            <label>
              Total from customer
              <input readOnly value={formatINR(labour + spareTotal)} />
            </label>
            <label>
              Advance already
              <input readOnly value={formatINR(advance)} />
            </label>
            <label>
              Balance on delivery
              <input readOnly value={formatINR(Math.max(labour + spareTotal - advance, 0))} />
            </label>
          </div>
          <div className="purchase-lines-head" style={{ margin: '0 0 8px', padding: '6px 0' }}>
            <h2>
              Spares used <TitleCount n={spares.filter((s) => s.productId).length} />
            </h2>
            <button type="button" className="btn btn--ghost" onClick={() => setSpares((p) => [...p, emptySpare()])}>
              <Plus size={14} /> Add spare
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {spares.map((l, idx) => {
              const p = products.find((x) => x.id === l.productId)
              return (
                <div key={l.key} className="spare-row">
                  <SearchableSelect
                    options={productOptions}
                    value={l.productId}
                    placeholder={productsQ.isLoading ? 'Loading spares…' : 'Search spare…'}
                    emptyLabel="No spares — add them via Purchase › Spares"
                    onChange={(id) => {
                      const prod = products.find((x) => x.id === id)
                      setSpares((prev) =>
                        prev.map((x) =>
                          x.key === l.key
                            ? { ...x, productId: id, unitPrice: Number(prod?.sellPrice || prod?.mrp || 0) }
                            : x,
                        ),
                      )
                    }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={p?.stockQty}
                    value={l.qty || ''}
                    placeholder="Qty"
                    title={p ? `${p.stockQty} in stock` : 'Qty'}
                    onChange={(e) =>
                      setSpares((prev) =>
                        prev.map((x) => (x.key === l.key ? { ...x, qty: Math.max(1, parseNum(e.target.value) || 1) } : x)),
                      )
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    value={emptyNum(l.unitPrice)}
                    placeholder="Price ₹"
                    title="Price charged per piece"
                    onChange={(e) =>
                      setSpares((prev) =>
                        prev.map((x) => (x.key === l.key ? { ...x, unitPrice: parseNum(e.target.value) } : x)),
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
              )
            })}
          </div>
        </>
      ) : null}

      {action === 'labour' ? (
        <div className="purchase-fields">
          <label>
            Labour charge ₹ *
            <input
              type="number"
              min={0}
              autoFocus
              value={emptyNum(labour)}
              onChange={(e) => setLabour(parseNum(e.target.value))}
              placeholder="Amount from customer"
            />
          </label>
          <label>
            Time (min)
            <input type="number" min={0} value={emptyNum(minutes)} onChange={(e) => setMinutes(parseNum(e.target.value))} />
          </label>
          <label>
            Advance already
            <input readOnly value={formatINR(advance)} />
          </label>
          <label>
            Balance on delivery
            <input readOnly value={formatINR(Math.max(labour - advance, 0))} />
          </label>
        </div>
      ) : null}

      {action === 'subcontract' ? (
        <div className="purchase-fields">
          <label className="span-2">
            Subcontractor name *
            <input value={subName} autoFocus onChange={(e) => setSubName(e.target.value)} placeholder="Shop / technician" />
          </label>
          <label>
            Amount given now ₹
            <input type="number" min={0} value={emptyNum(amountGiven)} onChange={(e) => setAmountGiven(parseNum(e.target.value))} />
          </label>
          <label>
            Advance from customer
            <input readOnly value={formatINR(advance)} />
          </label>
        </div>
      ) : null}

      {action === 'sub-return' ? (
        <div className="purchase-fields">
          <label>
            Final amount to subcontractor ₹
            <input type="number" min={0} value={emptyNum(subFinal)} onChange={(e) => setSubFinal(parseNum(e.target.value))} />
          </label>
          <label>
            Our labour ₹
            <input type="number" min={0} value={emptyNum(labour)} onChange={(e) => setLabour(parseNum(e.target.value))} />
          </label>
          <label>
            Total from customer
            <input readOnly value={formatINR(labour + subFinal)} />
          </label>
          <label>
            Balance on delivery
            <input readOnly value={formatINR(Math.max(labour + subFinal - advance, 0))} />
          </label>
        </div>
      ) : null}

      {action === 'deliver' ? (
        <>
          <div className="purchase-fields">
            <label>
              Total charge
              <input readOnly value={formatINR(job.customerCharge)} />
            </label>
            <label>
              Already paid
              <input readOnly value={formatINR(job.paidAmount)} />
            </label>
            <label>
              Collect now ₹ (due {formatINR(due)})
              <input
                type="number"
                min={0}
                max={due}
                value={emptyNum(collect)}
                disabled={due <= 0}
                onChange={(e) => setCollect(Math.min(parseNum(e.target.value), due))}
              />
            </label>
            <label>
              Mode
              <ComboSelect value={mode} placeholder="Payment mode" options={PAY_MODES} onChange={(v) => setMode(v || 'CASH')} />
            </label>
          </div>
          {refundDue > 0 ? (
            <p className="settle-box" style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)' }}>
              Advance is more than the charge — refund <strong>{formatINR(refundDue)}</strong> to the customer.
            </p>
          ) : null}
          {due > 0 && collect < due ? (
            <p className="settle-box" style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)' }}>
              {formatINR(due - collect)} will be kept as credit on {job.customer?.name || 'the customer'} and can be
              collected later from the ticket.
            </p>
          ) : null}
        </>
      ) : null}

      {action === 'collect' ? (
        <div className="purchase-fields">
          <label>
            Pending
            <input readOnly value={formatINR(due)} />
          </label>
          <label>
            Amount received ₹
            <input
              type="number"
              min={0}
              max={due}
              autoFocus
              value={emptyNum(collect)}
              onChange={(e) => setCollect(Math.min(parseNum(e.target.value), due))}
            />
          </label>
          <label>
            Mode
            <ComboSelect value={mode} placeholder="Payment mode" options={PAY_MODES} onChange={(v) => setMode(v || 'CASH')} />
          </label>
        </div>
      ) : null}

      {action === 'cancel' ? (
        <div className="purchase-fields">
          <label className="span-2">
            Reason *
            <input
              value={reason}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer declined estimate / part not available…"
            />
          </label>
          {advance > 0 ? (
            <>
              <label>
                Refund advance {formatINR(advance)}?
                <Segmented
                  options={[
                    { id: 'yes', label: 'Refund' },
                    { id: 'no', label: 'Keep' },
                  ]}
                  value={refund}
                  onChange={setRefund}
                />
              </label>
              {refund === 'yes' ? (
                <label>
                  Refund mode
                  <ComboSelect value={mode} placeholder="Mode" options={PAY_MODES} onChange={(v) => setMode(v || 'CASH')} />
                </label>
              ) : null}
            </>
          ) : null}
          {job.spares?.length ? (
            <p className="form-hint span-2" style={{ gridColumn: '1 / -1' }}>
              Spares used on this ticket go back to stock.
            </p>
          ) : null}
        </div>
      ) : null}

      {action === 'edit' ? (
        <div className="purchase-fields">
          <BrandModelFields
            brand={edit.deviceBrand}
            model={edit.deviceModel}
            onChange={({ brand, model }) => setEdit({ ...edit, deviceBrand: brand, deviceModel: model })}
          />
          <label>
            IMEI / serial
            <input value={edit.imei} onChange={(e) => setEdit({ ...edit, imei: e.target.value })} />
          </label>
          <label>
            Promise date
            <input type="date" value={edit.promisedDate} onChange={(e) => setEdit({ ...edit, promisedDate: e.target.value })} />
          </label>
          <label className="span-2">
            Problem reported
            <input value={edit.issue} onChange={(e) => setEdit({ ...edit, issue: e.target.value })} />
          </label>
          <label>
            Accessories received
            <input value={edit.accessories} onChange={(e) => setEdit({ ...edit, accessories: e.target.value })} />
          </label>
          <label>
            Condition at intake
            <input value={edit.conditionNote} onChange={(e) => setEdit({ ...edit, conditionNote: e.target.value })} />
          </label>
          <label>
            Estimate ₹
            <input
              type="number"
              min={0}
              value={emptyNum(edit.estimateAmount)}
              onChange={(e) => setEdit({ ...edit, estimateAmount: parseNum(e.target.value) })}
            />
          </label>
          <label>
            Notes
            <input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          </label>
        </div>
      ) : null}
    </Modal>
  )
}
