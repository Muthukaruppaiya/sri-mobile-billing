import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  customers,
  formatINR,
  paymentModes,
  products,
  staffNames,
  type Product,
} from '../data/mock'
import { FlowStepper, FormActions, PageHeader, Panel, SuccessBanner } from '../components/ui'

type CartItem = Product & { qty: number }

const STEPS = ['Customer', 'Items', 'Payment', 'Confirm']

export function BillingPage() {
  const [step, setStep] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | Product['category']>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [done, setDone] = useState<string | null>(null)
  const [bill, setBill] = useState({
    customerId: 'c5',
    name: 'Walk-in',
    phone: '',
    address: '',
    gstin: '',
    invoiceType: 'Cash memo',
    staff: staffNames[0],
    payment: 'Cash',
    paidNow: '',
    discount: '0',
    gstPercent: '18',
    notes: '',
    billDate: new Date().toISOString().slice(0, 10),
    barcode: '',
    imei: '',
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      const catOk = category === 'all' || p.category === category
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      return catOk && qOk
    })
  }, [query, category])

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = Math.min(Number(bill.discount) || 0, subtotal)
  const taxable = Math.max(subtotal - discount, 0)
  const gst = Math.round((taxable * (Number(bill.gstPercent) || 0)) / 100)
  const grand = taxable + gst
  const paidNow = Number(bill.paidNow || grand)
  const balance = Math.max(grand - paidNow, 0)

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id)
    if (!c) return
    setBill((b) => ({
      ...b,
      customerId: c.id,
      name: c.name,
      phone: c.phone === '—' ? '' : c.phone,
    }))
  }

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const hit = prev.find((i) => i.id === p.id)
      if (hit) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { ...p, qty: 1 }]
    })
  }

  const bump = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    )
  }

  const addByBarcode = () => {
    const code = bill.barcode.trim().toLowerCase()
    if (!code) return
    const hit = products.find(
      (p) => p.sku.toLowerCase() === code || p.name.toLowerCase().includes(code),
    )
    if (hit) {
      addToCart(hit)
      setBill((b) => ({ ...b, barcode: '' }))
    }
  }

  const finish = () => {
    const no = `SM-${1046 + Math.floor(Math.random() * 40)}`
    setDone(no)
    setCart([])
    setStep(0)
    setBill((b) => ({ ...b, paidNow: '', discount: '0', notes: '', barcode: '', imei: '' }))
  }

  return (
    <div className="section-gap">
      <PageHeader
        title="New sale bill"
        subtitle="Customer → scan/add items → payment → confirm"
      />

      <div className="page-hero-note">
        <div>
          <strong>Counter sale</strong>
          <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
            Stock deducts after save in Phase 2 · Cart {cart.length} item{cart.length === 1 ? '' : 's'}
          </div>
        </div>
        <span className="chip chip--live">{formatINR(grand)}</span>
      </div>

      <AnimatePresence>{done ? <SuccessBanner title="Bill saved (wireframe)" detail={`Invoice ${done} · stock will deduct in Phase 2`} onClose={() => setDone(null)} /> : null}</AnimatePresence>

      <FlowStepper steps={STEPS} current={step} />

      <Panel style={{ padding: 16 }} delay={0.05}>
        {step === 0 && (
          <div>
            <h2 className="section-title">Customer details</h2>
            <div className="form-grid form-grid--2">
              <div className="field span-2">
                <label>Quick pick saved customer</label>
                <select value={bill.customerId} onChange={(e) => pickCustomer(e.target.value)}>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone !== '—' ? `· ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Customer name *</label>
                <input
                  value={bill.name}
                  onChange={(e) => setBill({ ...bill, name: e.target.value })}
                  placeholder="Name"
                />
              </div>
              <div className="field">
                <label>Mobile number</label>
                <input
                  value={bill.phone}
                  onChange={(e) => setBill({ ...bill, phone: e.target.value })}
                  placeholder="10-digit"
                  inputMode="tel"
                />
              </div>
              <div className="field span-2">
                <label>Address</label>
                <input
                  value={bill.address}
                  onChange={(e) => setBill({ ...bill, address: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="field">
                <label>GSTIN (optional)</label>
                <input
                  value={bill.gstin}
                  onChange={(e) => setBill({ ...bill, gstin: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div className="field">
                <label>Bill date</label>
                <input
                  type="date"
                  value={bill.billDate}
                  onChange={(e) => setBill({ ...bill, billDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Invoice type</label>
                <select
                  value={bill.invoiceType}
                  onChange={(e) => setBill({ ...bill, invoiceType: e.target.value })}
                >
                  <option>Cash memo</option>
                  <option>Tax invoice</option>
                  <option>Estimate</option>
                </select>
              </div>
              <div className="field">
                <label>Staff / counter</label>
                <select value={bill.staff} onChange={(e) => setBill({ ...bill, staff: e.target.value })}>
                  {staffNames.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <FormActions showBack={false} onNext={() => setStep(1)} nextDisabled={!bill.name.trim()} />
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="section-title">Add items from stock</h2>
            <div className="form-grid form-grid--2" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Scan / type SKU</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={bill.barcode}
                    onChange={(e) => setBill({ ...bill, barcode: e.target.value })}
                    placeholder="PH-XN13"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addByBarcode()
                      }
                    }}
                  />
                  <button type="button" className="btn btn--ghost" onClick={addByBarcode}>
                    Add
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Phone IMEI (optional)</label>
                <input
                  value={bill.imei}
                  onChange={(e) => setBill({ ...bill, imei: e.target.value })}
                  placeholder="For handset sales"
                />
              </div>
              <div className="field">
                <label>Search name / brand</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Phone, accessory…"
                />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                  <option value="all">All</option>
                  <option value="Phone">Phone</option>
                  <option value="Accessory">Accessory</option>
                  <option value="Spare">Spare</option>
                </select>
              </div>
            </div>

            <div className="product-grid" style={{ marginBottom: 14 }}>
              {filtered.map((p, i) => (
                <motion.button
                  key={p.id}
                  type="button"
                  className="product-tile"
                  onClick={() => addToCart(p)}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <p className="product-tile__name">{p.name}</p>
                  <p className="product-tile__meta">
                    {p.sku} · Qty {p.stock}
                  </p>
                  <p className="product-tile__price">{formatINR(p.price)}</p>
                </motion.button>
              ))}
            </div>

            <h3 className="section-title" style={{ fontSize: 'var(--fs-base)' }}>
              Cart ({cart.length})
            </h3>
            {cart.length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Tap products above to add lines.
              </p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="cart-line">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{item.name}</div>
                    <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                      {formatINR(item.price)} × {item.qty} = {formatINR(item.price * item.qty)}
                    </div>
                  </div>
                  <div className="qty-ctrl">
                    <button type="button" onClick={() => bump(item.id, -1)}>
                      <Minus size={14} />
                    </button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => bump(item.id, 1)}>
                      <Plus size={14} />
                    </button>
                    <button type="button" onClick={() => bump(item.id, -item.qty)}>
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="totals-box">
              <div className="totals-row">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
            </div>
            <FormActions onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={cart.length === 0} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="section-title">Payment & charges</h2>
            <div className="form-grid form-grid--2">
              <div className="field">
                <label>Discount ₹</label>
                <input
                  value={bill.discount}
                  onChange={(e) => setBill({ ...bill, discount: e.target.value })}
                  inputMode="numeric"
                />
              </div>
              <div className="field">
                <label>GST %</label>
                <select
                  value={bill.gstPercent}
                  onChange={(e) => setBill({ ...bill, gstPercent: e.target.value })}
                >
                  <option value="0">0% (no GST)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
              </div>
              <div className="field">
                <label>Payment mode</label>
                <select value={bill.payment} onChange={(e) => setBill({ ...bill, payment: e.target.value })}>
                  {paymentModes.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount paid now ₹</label>
                <input
                  value={bill.paidNow}
                  onChange={(e) => setBill({ ...bill, paidNow: e.target.value })}
                  placeholder={String(grand)}
                  inputMode="numeric"
                />
                <p className="field-hint">Leave blank to mark fully paid</p>
              </div>
              <div className="field span-2">
                <label>Bill notes</label>
                <textarea
                  value={bill.notes}
                  onChange={(e) => setBill({ ...bill, notes: e.target.value })}
                  placeholder="Warranty / IMEI / delivery note"
                />
              </div>
            </div>

            <div className="totals-box">
              <div className="totals-row">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="totals-row">
                <span>Discount</span>
                <span>- {formatINR(discount)}</span>
              </div>
              <div className="totals-row">
                <span>GST ({bill.gstPercent}%)</span>
                <span>{formatINR(gst)}</span>
              </div>
              <div className="totals-row totals-row--grand">
                <span>Grand total</span>
                <span>{formatINR(grand)}</span>
              </div>
              <div className="totals-row">
                <span>Balance due</span>
                <span className={balance > 0 ? 'accent' : ''}>{formatINR(balance)}</span>
              </div>
            </div>
            <FormActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="section-title">Confirm bill</h2>
            <div className="detail-card" style={{ marginBottom: 12 }}>
              <div className="form-grid form-grid--2">
                <div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    Customer
                  </div>
                  <strong>{bill.name}</strong>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    {bill.phone || 'No phone'} · {bill.invoiceType}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    Payment
                  </div>
                  <strong>{bill.payment}</strong>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    Staff: {bill.staff}
                  </div>
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.qty}</td>
                      <td>{formatINR(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals-box">
              <div className="totals-row totals-row--grand">
                <span>Collect now</span>
                <span>{formatINR(paidNow > grand ? grand : paidNow)}</span>
              </div>
            </div>

            <FormActions
              onBack={() => setStep(2)}
              onNext={finish}
              nextLabel="Save & print"
            />
          </div>
        )}
      </Panel>
    </div>
  )
}
