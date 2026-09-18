import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Cable, Cpu, CreditCard, Minus, Plus, Receipt, ScanLine, Search, ShoppingBag, Smartphone, Trash2, UserRound } from 'lucide-react'
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
const CATEGORIES = [
  { id: 'all' as const, label: 'All', icon: ShoppingBag },
  { id: 'Phone' as const, label: 'Phones', icon: Smartphone },
  { id: 'Accessory' as const, label: 'Accessories', icon: Cable },
  { id: 'Spare' as const, label: 'Spares', icon: Cpu },
]

function categoryIcon(category: Product['category']) {
  if (category === 'Phone') return Smartphone
  if (category === 'Accessory') return Cable
  return Cpu
}

function ProductPreview({ product }: { product: Product }) {
  const Icon = categoryIcon(product.category)
  const brand = product.brand.toLowerCase().replace(/\s+/g, '')
  if (product.category === 'Phone') {
    return (
      <div className="pos-preview pos-preview--phone" data-brand={brand}>
        <div className="pos-handset" aria-hidden>
          <span className="pos-handset__notch" />
          <span className="pos-handset__screen" />
        </div>
      </div>
    )
  }
  return (
    <div className={`pos-preview pos-preview--${product.category.toLowerCase()}`} data-brand={brand}>
      <span className="pos-preview__glyph">
        <Icon size={28} />
      </span>
    </div>
  )
}

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
        subtitle={`${bill.name} · ${cart.length} item${cart.length === 1 ? '' : 's'} · ${formatINR(grand)}`}
        icon={Receipt}
      />

      <AnimatePresence>{done ? <SuccessBanner title="Bill saved" detail={`Invoice ${done}`} onClose={() => setDone(null)} /> : null}</AnimatePresence>

      <FlowStepper steps={STEPS} current={step} />

      <Panel style={{ padding: 16 }} delay={0.05}>
        {step === 0 && (
          <div>
            <h2 className="section-title">
              <UserRound size={18} /> Customer details
            </h2>
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
          <div className="pos">
            <div className="pos__catalog">
              <div className="pos-toolbar">
                <div className="field-input-icon pos-search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products"
                    aria-label="Search name, brand or SKU"
                  />
                </div>
                <div className="pos-scan">
                  <input
                    value={bill.barcode}
                    onChange={(e) => setBill({ ...bill, barcode: e.target.value })}
                    placeholder="Scan SKU"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addByBarcode()
                      }
                    }}
                  />
                  <button type="button" className="btn btn--primary" onClick={addByBarcode} aria-label="Add scanned SKU">
                    <ScanLine size={16} />
                  </button>
                </div>
              </div>

              <div className="pos-cats" role="tablist" aria-label="Category">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={category === c.id}
                      className={`pos-cat${category === c.id ? ' is-active' : ''}`}
                      onClick={() => setCategory(c.id)}
                    >
                      <Icon size={15} />
                      {c.label}
                    </button>
                  )
                })}
              </div>

              <div className="pos-grid">
                {filtered.length === 0 ? (
                  <div className="empty-state pos-grid__empty">No matching products</div>
                ) : (
                  filtered.map((p) => {
                    const qty = cart.find((i) => i.id === p.id)?.qty ?? 0
                    const low = p.stock <= p.lowAt
                    return (
                      <article key={p.id} className={`pos-card${qty ? ' is-in-cart' : ''}`}>
                        <button type="button" className="pos-card__hit" onClick={() => addToCart(p)}>
                          <span className="pos-card__media">
                            <ProductPreview product={p} />
                            <span className={`pos-card__stock ${low ? 'is-low' : ''}`}>
                              {low ? 'Low' : 'In stock'} · {p.stock}
                            </span>
                          </span>
                          <span className="pos-card__name">{p.name}</span>
                          <span className="pos-card__meta">{p.brand}</span>
                          <span className="pos-card__price">
                            {formatINR(p.price)}
                            {p.mrp > p.price ? <s>{formatINR(p.mrp)}</s> : null}
                          </span>
                        </button>
                        {qty ? (
                          <div className="pos-card__qty">
                            <button type="button" aria-label="Decrease" onClick={() => bump(p.id, -1)}>
                              <Minus size={14} />
                            </button>
                            <span>{qty}</span>
                            <button type="button" aria-label="Increase" onClick={() => bump(p.id, 1)}>
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="pos-card__add" onClick={() => addToCart(p)}>
                            <Plus size={15} /> Add
                          </button>
                        )}
                      </article>
                    )
                  })
                )}
              </div>
            </div>

            <aside className="pos-cart">
              <div className="pos-cart__head">
                <ShoppingBag size={18} />
                <strong>Bill cart</strong>
                <span className="chip">{cart.reduce((s, i) => s + i.qty, 0)}</span>
              </div>

              {cart.length === 0 ? (
                <div className="pos-cart__empty">
                  <ShoppingBag size={28} />
                  <p>Tap a product to add it</p>
                </div>
              ) : (
                <div className="pos-cart__lines">
                  {cart.map((item) => (
                    <div key={item.id} className="pos-cart__line">
                      <div>
                        <div className="pos-cart__name">{item.name}</div>
                        <div className="muted">{formatINR(item.price)}</div>
                      </div>
                      <div className="qty-ctrl">
                        <button type="button" onClick={() => bump(item.id, -1)} aria-label="Decrease">
                          <Minus size={14} />
                        </button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => bump(item.id, 1)} aria-label="Increase">
                          <Plus size={14} />
                        </button>
                        <button type="button" onClick={() => bump(item.id, -item.qty)} aria-label="Remove">
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                      <div className="pos-cart__amt">{formatINR(item.price * item.qty)}</div>
                    </div>
                  ))}
                </div>
              )}

              {cart.some((i) => i.category === 'Phone') ? (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>IMEI</label>
                  <input
                    value={bill.imei}
                    onChange={(e) => setBill({ ...bill, imei: e.target.value })}
                    placeholder="Handset IMEI"
                  />
                </div>
              ) : null}

              <div className="totals-box">
                <div className="totals-row totals-row--grand">
                  <span>Subtotal</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
              </div>
              <FormActions onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={cart.length === 0} />
            </aside>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="section-title">
              <CreditCard size={18} /> Payment & charges
            </h2>
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
            <h2 className="section-title">
              <Receipt size={18} /> Confirm bill
            </h2>
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
