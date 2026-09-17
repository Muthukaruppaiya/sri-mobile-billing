import { useState, type ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  formatINR,
  paymentModes,
  products,
  serviceJobs,
  staffNames,
  todayDeliveries,
  type ServiceJob,
} from '../data/mock'
import {
  FlowStepper,
  FormActions,
  ModeTabs,
  PageHeader,
  Panel,
  SuccessBanner,
} from '../components/ui'

const STEPS = ['Customer', 'Device', 'Estimate', 'Billing', 'Confirm']
const STATUS_FLOW = ['Received', 'In progress', 'Waiting parts', 'Ready', 'Delivered'] as const

const emptyForm = {
  customer: '',
  phone: '',
  altPhone: '',
  device: '',
  brand: '',
  color: '',
  imei: '',
  password: '',
  accessories: '',
  issue: '',
  condition: 'Working power on',
  priority: 'Normal',
  estimate: '',
  advance: '',
  labour: '',
  promisedDate: '',
  staff: staffNames[0],
  notes: '',
  payment: 'Cash',
  gstPercent: '18',
  discount: '0',
  paidNow: '',
  invoiceType: 'Service invoice',
}

export function ServicePage() {
  const [mode, setMode] = useState<'intake' | 'delivery'>('intake')
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<string | null>(null)
  const [spareId, setSpareId] = useState('')
  const [deliveryJobId, setDeliveryJobId] = useState(todayDeliveries[0]?.id ?? '')
  const [deliveryPay, setDeliveryPay] = useState({
    payment: 'UPI',
    paidNow: '',
    gstPercent: '18',
    discount: '0',
    notes: '',
  })
  const [form, setForm] = useState(emptyForm)

  const set =
    (key: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const spare = products.find((p) => p.id === spareId)
  const estimate = Number(form.estimate) || 0
  const labour = Number(form.labour) || 0
  const spareCost = spare?.price ?? 0
  const advance = Number(form.advance) || 0
  const subtotal = estimate || labour + spareCost
  const discount = Math.min(Number(form.discount) || 0, subtotal)
  const taxable = Math.max(subtotal - discount, 0)
  const gst = Math.round((taxable * (Number(form.gstPercent) || 0)) / 100)
  const grand = taxable + gst
  const paidNow = Number(form.paidNow || advance)
  const balance = Math.max(grand - Math.max(paidNow, advance), 0)

  const deliveryJob = todayDeliveries.find((j) => j.id === deliveryJobId) ?? todayDeliveries[0]
  const deliveryDueAmt = deliveryJob ? Math.max(deliveryJob.estimate - deliveryJob.advance, 0) : 0
  const deliveryDiscount = Math.min(Number(deliveryPay.discount) || 0, deliveryDueAmt)
  const deliveryTaxable = Math.max(deliveryDueAmt - deliveryDiscount, 0)
  const deliveryGst = Math.round((deliveryTaxable * (Number(deliveryPay.gstPercent) || 0)) / 100)
  const deliveryGrand = deliveryTaxable + deliveryGst
  const deliveryPaid = Number(deliveryPay.paidNow || deliveryGrand)

  const resetIntake = () => {
    setStep(0)
    setSpareId('')
    setForm(emptyForm)
  }

  const finishIntake = () => {
    const ticket = `SV-${314 + Math.floor(Math.random() * 50)}`
    const bill = `SB-${900 + Math.floor(Math.random() * 80)}`
    setDone(`Ticket ${ticket} · Service bill ${bill}`)
    resetIntake()
  }

  const finishDelivery = (job: ServiceJob) => {
    const bill = `SB-${900 + Math.floor(Math.random() * 80)}`
    setDone(`Delivered ${job.device} · Final bill ${bill} · ${formatINR(deliveryPaid)}`)
    setDeliveryPay({ payment: 'UPI', paidNow: '', gstPercent: '18', discount: '0', notes: '' })
  }

  return (
    <div className="section-gap">
      <PageHeader
        title="Service & billing"
        subtitle="New intake bill · or final delivery bill for today’s handovers"
      />

      <AnimatePresence>
        {done ? (
          <SuccessBanner title="Service billing saved (wireframe)" detail={done} onClose={() => setDone(null)} />
        ) : null}
      </AnimatePresence>

      <ModeTabs
        value={mode}
        onChange={setMode}
        tabs={[
          { id: 'intake', label: 'New service bill' },
          { id: 'delivery', label: `Today delivery (${todayDeliveries.length})` },
        ]}
      />

      {mode === 'intake' ? (
        <>
          <FlowStepper steps={STEPS} current={step} />

          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            <Panel style={{ padding: 16 }} delay={0.05}>
              {step === 0 && (
                <div>
                  <h2 className="section-title">Customer</h2>
                  <div className="form-grid form-grid--2">
                    <div className="field">
                      <label>Customer name *</label>
                      <input value={form.customer} onChange={set('customer')} placeholder="Name" />
                    </div>
                    <div className="field">
                      <label>Mobile *</label>
                      <input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="10-digit" />
                    </div>
                    <div className="field">
                      <label>Alternate phone</label>
                      <input value={form.altPhone} onChange={set('altPhone')} inputMode="tel" />
                    </div>
                    <div className="field">
                      <label>Priority</label>
                      <select value={form.priority} onChange={set('priority')}>
                        <option>Normal</option>
                        <option>Urgent</option>
                        <option>Warranty</option>
                      </select>
                    </div>
                  </div>
                  <FormActions
                    showBack={false}
                    onNext={() => setStep(1)}
                    nextDisabled={!form.customer.trim() || !form.phone.trim()}
                  />
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="section-title">Device intake</h2>
                  <div className="form-grid form-grid--2">
                    <div className="field">
                      <label>Brand</label>
                      <input value={form.brand} onChange={set('brand')} placeholder="Samsung / Apple…" />
                    </div>
                    <div className="field">
                      <label>Model *</label>
                      <input value={form.device} onChange={set('device')} placeholder="e.g. Redmi Note 10" />
                    </div>
                    <div className="field">
                      <label>Color</label>
                      <input value={form.color} onChange={set('color')} />
                    </div>
                    <div className="field">
                      <label>IMEI / Serial</label>
                      <input value={form.imei} onChange={set('imei')} />
                    </div>
                    <div className="field">
                      <label>Screen lock / pattern</label>
                      <input value={form.password} onChange={set('password')} placeholder="Optional note" />
                    </div>
                    <div className="field">
                      <label>Received condition</label>
                      <select value={form.condition} onChange={set('condition')}>
                        <option>Working power on</option>
                        <option>Dead / no power</option>
                        <option>Water damage</option>
                        <option>Physical damage</option>
                      </select>
                    </div>
                    <div className="field span-2">
                      <label>Accessories received</label>
                      <input
                        value={form.accessories}
                        onChange={set('accessories')}
                        placeholder="SIM tray, back cover, charger…"
                      />
                    </div>
                    <div className="field span-2">
                      <label>Issue description *</label>
                      <textarea value={form.issue} onChange={set('issue')} placeholder="Customer complaint" />
                    </div>
                  </div>
                  <FormActions
                    onBack={() => setStep(0)}
                    onNext={() => setStep(2)}
                    nextDisabled={!form.device.trim() || !form.issue.trim()}
                  />
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="section-title">Estimate & spare</h2>
                  <div className="form-grid form-grid--2">
                    <div className="field">
                      <label>Labour ₹</label>
                      <input value={form.labour} onChange={set('labour')} inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Spare from stock</label>
                      <select value={spareId} onChange={(e) => setSpareId(e.target.value)}>
                        <option value="">No spare yet</option>
                        {products
                          .filter((p) => p.category === 'Spare' || p.category === 'Accessory')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {formatINR(p.price)}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Total estimate ₹</label>
                      <input
                        value={form.estimate}
                        onChange={set('estimate')}
                        placeholder={String(labour + spareCost || '')}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="field">
                      <label>Advance collected ₹</label>
                      <input value={form.advance} onChange={set('advance')} inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Promised delivery date</label>
                      <input type="date" value={form.promisedDate} onChange={set('promisedDate')} />
                    </div>
                    <div className="field">
                      <label>Assigned staff</label>
                      <select value={form.staff} onChange={set('staff')}>
                        {staffNames.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field span-2">
                      <label>Internal notes</label>
                      <textarea value={form.notes} onChange={set('notes')} placeholder="Technician notes" />
                    </div>
                  </div>
                  <div className="totals-box">
                    <div className="totals-row">
                      <span>Estimate</span>
                      <span>{formatINR(subtotal)}</span>
                    </div>
                    <div className="totals-row">
                      <span>Advance</span>
                      <span>{formatINR(advance)}</span>
                    </div>
                    <div className="totals-row totals-row--grand">
                      <span>Balance on delivery</span>
                      <span>{formatINR(Math.max(subtotal - advance, 0))}</span>
                    </div>
                  </div>
                  <FormActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="section-title">Service billing</h2>
                  <p className="muted" style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)' }}>
                    Create advance / opening service invoice for this job.
                  </p>
                  <div className="form-grid form-grid--2">
                    <div className="field">
                      <label>Invoice type</label>
                      <select value={form.invoiceType} onChange={set('invoiceType')}>
                        <option>Service invoice</option>
                        <option>Advance receipt</option>
                        <option>Estimate only</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Payment mode</label>
                      <select value={form.payment} onChange={set('payment')}>
                        {paymentModes.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Discount ₹</label>
                      <input value={form.discount} onChange={set('discount')} inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>GST %</label>
                      <select value={form.gstPercent} onChange={set('gstPercent')}>
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                      </select>
                    </div>
                    <div className="field span-2">
                      <label>Amount paid now ₹</label>
                      <input
                        value={form.paidNow}
                        onChange={set('paidNow')}
                        placeholder={String(advance || grand)}
                        inputMode="numeric"
                      />
                      <p className="field-hint">Usually the advance amount at intake</p>
                    </div>
                  </div>
                  <div className="totals-box">
                    <div className="totals-row">
                      <span>Service subtotal</span>
                      <span>{formatINR(subtotal)}</span>
                    </div>
                    <div className="totals-row">
                      <span>Discount</span>
                      <span>- {formatINR(discount)}</span>
                    </div>
                    <div className="totals-row">
                      <span>GST ({form.gstPercent}%)</span>
                      <span>{formatINR(gst)}</span>
                    </div>
                    <div className="totals-row totals-row--grand">
                      <span>Bill total</span>
                      <span>{formatINR(grand)}</span>
                    </div>
                    <div className="totals-row">
                      <span>Collect now</span>
                      <span>{formatINR(paidNow)}</span>
                    </div>
                    <div className="totals-row">
                      <span>Balance later</span>
                      <span className={balance > 0 ? 'accent' : ''}>{formatINR(balance)}</span>
                    </div>
                  </div>
                  <FormActions onBack={() => setStep(2)} onNext={() => setStep(4)} />
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="section-title">Confirm service bill</h2>
                  <div className="detail-card" style={{ marginBottom: 12 }}>
                    <strong>
                      {form.brand} {form.device}
                    </strong>
                    <p className="muted" style={{ margin: '6px 0', fontSize: 'var(--fs-sm)' }}>
                      {form.customer} · {form.phone}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>{form.issue}</p>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 'var(--fs-xs)' }}>
                      {form.invoiceType} · {form.payment} · Due {form.promisedDate || 'TBD'}
                    </p>
                  </div>
                  <div className="totals-box">
                    <div className="totals-row totals-row--grand">
                      <span>Bill total</span>
                      <span>{formatINR(grand)}</span>
                    </div>
                    <div className="totals-row">
                      <span>Paid now</span>
                      <span>{formatINR(paidNow)}</span>
                    </div>
                  </div>
                  <FormActions onBack={() => setStep(3)} onNext={finishIntake} nextLabel="Save ticket & bill" />
                </div>
              )}
            </Panel>

            <Panel style={{ padding: 16 }} delay={0.1} dashed>
              <h2 className="section-title">Workshop board</h2>
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 'var(--fs-xs)' }}>
                {STATUS_FLOW.join(' → ')}
              </p>
              <div className="section-gap">
                {serviceJobs
                  .filter((j) => j.status !== 'Delivered')
                  .map((j, i) => (
                    <motion.div
                      key={j.id}
                      className="detail-card"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      <div className="row-between">
                        <div>
                          <strong style={{ fontSize: 'var(--fs-sm)' }}>{j.ticket}</strong>
                          <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{j.device}</div>
                        </div>
                        <span className={`chip ${j.status === 'Ready' ? 'chip--live' : 'chip--warn'}`}>
                          {j.status}
                        </span>
                      </div>
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-xs)' }}>
                        {j.customer} · Due {j.deliveryDue}
                      </p>
                      <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                        {formatINR(j.estimate)} · {j.billStatus}
                      </p>
                    </motion.div>
                  ))}
              </div>
            </Panel>
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          <Panel style={{ padding: 16 }} delay={0.05}>
            <h2 className="section-title">Today’s mobiles to deliver</h2>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)' }}>
              {todayDeliveries.length} phone{todayDeliveries.length === 1 ? '' : 's'} due today — bill & handover
            </p>
            <div className="section-gap">
              {todayDeliveries.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className={`detail-card ${deliveryJobId === j.id ? 'is-selected' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                  onClick={() => {
                    setDeliveryJobId(j.id)
                    setDeliveryPay((p) => ({
                      ...p,
                      paidNow: String(Math.max(j.estimate - j.advance, 0)),
                    }))
                  }}
                >
                  <div className="row-between">
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>
                      {j.ticket} · {j.device}
                    </strong>
                    <span className={`chip ${j.status === 'Ready' ? 'chip--live' : 'chip--warn'}`}>
                      {j.status}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-xs)' }}>
                    {j.customer} · {j.phone}
                  </p>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                    Balance {formatINR(Math.max(j.estimate - j.advance, 0))} · {j.billStatus}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel style={{ padding: 16 }} delay={0.1}>
            <h2 className="section-title">Final delivery bill</h2>
            {deliveryJob ? (
              <>
                <div className="detail-card" style={{ marginBottom: 12 }}>
                  <strong>
                    {deliveryJob.brand} {deliveryJob.device}
                  </strong>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                    {deliveryJob.customer} · {deliveryJob.ticket}
                  </p>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                    {deliveryJob.issue} · IMEI {deliveryJob.imei}
                  </p>
                </div>

                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label>Payment mode</label>
                    <select
                      value={deliveryPay.payment}
                      onChange={(e) => setDeliveryPay({ ...deliveryPay, payment: e.target.value })}
                    >
                      {paymentModes.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>GST %</label>
                    <select
                      value={deliveryPay.gstPercent}
                      onChange={(e) => setDeliveryPay({ ...deliveryPay, gstPercent: e.target.value })}
                    >
                      <option value="0">0%</option>
                      <option value="18">18%</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Extra discount ₹</label>
                    <input
                      value={deliveryPay.discount}
                      onChange={(e) => setDeliveryPay({ ...deliveryPay, discount: e.target.value })}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="field">
                    <label>Collect now ₹</label>
                    <input
                      value={deliveryPay.paidNow}
                      onChange={(e) => setDeliveryPay({ ...deliveryPay, paidNow: e.target.value })}
                      placeholder={String(deliveryGrand)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="field span-2">
                    <label>Delivery notes</label>
                    <textarea
                      value={deliveryPay.notes}
                      onChange={(e) => setDeliveryPay({ ...deliveryPay, notes: e.target.value })}
                      placeholder="Warranty days, accessories returned…"
                    />
                  </div>
                </div>

                <div className="totals-box">
                  <div className="totals-row">
                    <span>Job estimate</span>
                    <span>{formatINR(deliveryJob.estimate)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Advance already paid</span>
                    <span>- {formatINR(deliveryJob.advance)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Balance before tax</span>
                    <span>{formatINR(deliveryDueAmt)}</span>
                  </div>
                  <div className="totals-row">
                    <span>GST</span>
                    <span>{formatINR(deliveryGst)}</span>
                  </div>
                  <div className="totals-row totals-row--grand">
                    <span>Final collect</span>
                    <span>{formatINR(deliveryGrand)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--accent btn--block"
                  style={{ marginTop: 14 }}
                  onClick={() => finishDelivery(deliveryJob)}
                >
                  Save final bill & mark delivered
                </button>
              </>
            ) : (
              <p className="muted">No deliveries due today.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
