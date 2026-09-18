import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRightLeft,
  IndianRupee,
  List,
  Package,
  PackageMinus,
  PackagePlus,
  Plus,
  Search,
} from 'lucide-react'
import {
  formatINR,
  products,
  staffNames,
  stockLedger,
  stockLocations,
  suppliers,
} from '../data/mock'
import {
  FlowStepper,
  FormActions,
  MiniStat,
  ModeTabs,
  PageHeader,
  Panel,
  SuccessBanner,
} from '../components/ui'

const STEPS = ['Action', 'Details', 'Confirm']

export function StockPage() {
  const [tab, setTab] = useState<'all' | 'Phone' | 'Accessory' | 'Spare'>('all')
  const [status, setStatus] = useState<'all' | 'low' | 'ok'>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name' | 'qty' | 'value'>('name')
  const [view, setView] = useState<'list' | 'adjust' | 'add' | 'transfer'>('list')
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? '')
  const [form, setForm] = useState({
    mode: 'in' as 'in' | 'out',
    productId: '',
    qty: '',
    unitCost: '',
    supplier: suppliers[0],
    invoiceNo: '',
    reason: 'Purchase',
    staff: staffNames[0],
    notes: '',
    location: stockLocations[0],
    fromLoc: stockLocations[0],
    toLoc: stockLocations[1],
    newName: '',
    newBrand: '',
    newCategory: 'Accessory' as 'Phone' | 'Accessory' | 'Spare',
    newSku: '',
    newPrice: '',
    newMrp: '',
    newStock: '',
    newLowAt: '5',
    newLocation: stockLocations[0],
  })

  const lowCount = products.filter((p) => p.stock <= p.lowAt).length
  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0)
  const phoneCount = products.filter((p) => p.category === 'Phone').length

  const list = useMemo(() => {
    let rows = products.filter((p) => {
      const catOk = tab === 'all' || p.category === tab
      const stOk =
        status === 'all' ||
        (status === 'low' ? p.stock <= p.lowAt : p.stock > p.lowAt)
      const q = query.trim().toLowerCase()
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      return catOk && stOk && qOk
    })
    rows = [...rows].sort((a, b) => {
      if (sort === 'qty') return a.stock - b.stock
      if (sort === 'value') return b.price * b.stock - a.price * a.stock
      return a.name.localeCompare(b.name)
    })
    return rows
  }, [tab, status, query, sort])

  const selected = products.find((p) => p.id === selectedId) ?? list[0]
  const formProduct = products.find((p) => p.id === form.productId)

  const openAdjust = (productId?: string, mode: 'in' | 'out' = 'in') => {
    setView('adjust')
    setStep(0)
    setForm((f) => ({
      ...f,
      mode,
      productId: productId || f.productId || selected?.id || '',
      reason: mode === 'in' ? 'Purchase' : 'Damage',
    }))
  }

  const finish = () => {
    const label =
      view === 'add'
        ? `Product “${form.newName}” added at ${form.newLocation}`
        : view === 'transfer'
          ? `Moved ${form.qty} × ${formProduct?.name ?? 'item'} → ${form.toLoc}`
          : `Stock ${form.mode.toUpperCase()} · ${formProduct?.name ?? 'item'} × ${form.qty}`
    setDone(label)
    setStep(0)
    setView('list')
    setForm((f) => ({
      ...f,
      productId: '',
      qty: '',
      unitCost: '',
      invoiceNo: '',
      notes: '',
      newName: '',
      newBrand: '',
      newSku: '',
      newPrice: '',
      newMrp: '',
      newStock: '',
    }))
  }

  return (
    <div className="section-gap">
      <PageHeader
        title="Stock maintenance"
        subtitle="Search inventory · adjust · transfer · add products"
        icon={Package}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--ghost" style={{ padding: '8px 12px' }} onClick={() => openAdjust(undefined, 'in')}>
              <PackagePlus size={16} /> Stock in
            </button>
            <button type="button" className="btn btn--primary" style={{ padding: '8px 12px' }} onClick={() => { setView('add'); setStep(0) }}>
              <Plus size={16} /> Add product
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {done ? (
          <SuccessBanner title="Stock updated" detail={done} onClose={() => setDone(null)} />
        ) : null}
      </AnimatePresence>

      <div className="mini-stat-grid">
        <MiniStat label="Total SKUs" value={String(products.length)} hint={`${phoneCount} phones`} tone="ok" onClick={() => setView('list')} icon={Package} />
        <MiniStat label="Low stock" value={String(lowCount).padStart(2, '0')} hint="Needs reorder" tone="warn" onClick={() => { setView('list'); setStatus('low') }} icon={AlertTriangle} />
        <MiniStat label="Stock value" value={formatINR(stockValue)} hint="At selling price" tone="info" icon={IndianRupee} />
        <MiniStat label="Ledger today" value={String(stockLedger.length)} hint="Movements" icon={List} />
      </div>

      <ModeTabs
        value={view}
        onChange={(v) => {
          setView(v)
          setStep(0)
        }}
        tabs={[
          { id: 'list', label: 'Inventory', icon: Package },
          { id: 'adjust', label: 'Stock in / out', icon: PackagePlus },
          { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
          { id: 'add', label: 'Add product', icon: Plus },
        ]}
      />

      {view === 'list' && (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          <Panel style={{ padding: 16 }} delay={0.05}>
            <div className="toolbar">
              <div className="field">
                <label>Search</label>
                <div className="field-input-icon">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SKU / name / brand / rack"
                  />
                </div>
              </div>
              <div className="field" style={{ maxWidth: 140 }}>
                <label>Sort</label>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="name">Name</option>
                  <option value="qty">Qty low→high</option>
                  <option value="value">Stock value</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {(['all', 'Phone', 'Accessory', 'Spare'] as const).map((t) => (
                <button key={t} type="button" className={`chip ${tab === t ? 'chip--live' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab(t)}>
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
              {(['all', 'low', 'ok'] as const).map((s) => (
                <button key={s} type="button" className={`chip ${status === s ? 'chip--warn' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setStatus(s)}>
                  {s === 'all' ? 'Any status' : s === 'low' ? 'Low only' : 'OK only'}
                </button>
              ))}
            </div>

            {list.length === 0 ? (
              <div className="empty-state">No products match your filters.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p, i) => {
                      const low = p.stock <= p.lowAt
                      const fill = Math.min(100, Math.round((p.stock / Math.max(p.lowAt * 3, 1)) * 100))
                      return (
                        <motion.tr
                          key={p.id}
                          className="click-row"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => setSelectedId(p.id)}
                          style={{
                            background: selected?.id === p.id ? 'rgba(14,168,122,0.06)' : undefined,
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {p.sku} · {p.location}
                            </div>
                            <div className={`stock-progress ${low ? 'is-low' : ''}`}>
                              <span style={{ width: `${fill}%` }} />
                            </div>
                          </td>
                          <td>{p.stock}</td>
                          <td>{formatINR(p.price * p.stock)}</td>
                          <td>
                            <span className={`chip ${low ? 'chip--warn' : 'chip--live'}`}>
                              {low ? <AlertTriangle size={12} /> : <Package size={12} />}
                              {low ? 'Low' : 'OK'}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel style={{ padding: 16 }} delay={0.1}>
            <h2 className="section-title">Product detail</h2>
            {selected ? (
              <div className="section-gap">
                <div className="detail-card is-selected">
                  <strong>{selected.name}</strong>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                    {selected.brand} · {selected.category} · {selected.sku}
                  </p>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                    {selected.location} · Last in {selected.lastIn}
                  </p>
                </div>
                <div className="totals-box">
                  <div className="totals-row">
                    <span>Selling price</span>
                    <span>{formatINR(selected.price)}</span>
                  </div>
                  <div className="totals-row">
                    <span>MRP</span>
                    <span>{formatINR(selected.mrp)}</span>
                  </div>
                  <div className="totals-row">
                    <span>On hand</span>
                    <span>{selected.stock}</span>
                  </div>
                  <div className="totals-row">
                    <span>Reorder at</span>
                    <span>{selected.lowAt}</span>
                  </div>
                  <div className="totals-row totals-row--grand">
                    <span>Line value</span>
                    <span>{formatINR(selected.price * selected.stock)}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button type="button" className="btn btn--primary btn--block" onClick={() => openAdjust(selected.id, 'in')}>
                    <PackagePlus size={16} /> Stock in
                  </button>
                  <button type="button" className="btn btn--ghost btn--block" onClick={() => openAdjust(selected.id, 'out')}>
                    <PackageMinus size={16} /> Stock out
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--block"
                    onClick={() => {
                      setView('transfer')
                      setStep(0)
                      setForm((f) => ({ ...f, productId: selected.id, fromLoc: selected.location }))
                    }}
                  >
                    <ArrowRightLeft size={16} /> Transfer rack
                  </button>
                </div>
                {selected.stock <= selected.lowAt ? (
                  <div className="page-hero-note">
                    <div>
                      <strong>Reorder suggested</strong>
                      <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                        Order at least {selected.lowAt * 2} units
                      </div>
                    </div>
                    <span className="chip chip--warn">
                      <AlertTriangle size={12} /> Low
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">Select a product</div>
            )}
          </Panel>
        </div>
      )}

      {(view === 'adjust' || view === 'add' || view === 'transfer') && (
        <>
          <FlowStepper steps={STEPS} current={step} />
          <Panel style={{ padding: 16 }} delay={0.05}>
            {step === 0 && view === 'adjust' && (
              <div>
                <h2 className="section-title">Choose movement</h2>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label>Type</label>
                    <select
                      value={form.mode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mode: e.target.value as 'in' | 'out',
                          reason: e.target.value === 'in' ? 'Purchase' : 'Damage',
                        })
                      }
                    >
                      <option value="in">Stock IN</option>
                      <option value="out">Stock OUT</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Reason</label>
                    <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                      {form.mode === 'in' ? (
                        <>
                          <option>Purchase</option>
                          <option>Customer return</option>
                          <option>Opening stock</option>
                          <option>Service unused return</option>
                        </>
                      ) : (
                        <>
                          <option>Damage</option>
                          <option>Lost / theft</option>
                          <option>Demo use</option>
                          <option>Correction</option>
                          <option>Used in service</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <FormActions showBack={false} onNext={() => setStep(1)} backLabel="Back" />
                <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => setView('list')}>
                  Back to inventory
                </button>
              </div>
            )}

            {step === 0 && view === 'transfer' && (
              <div>
                <h2 className="section-title">Transfer between racks</h2>
                <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 0 }}>
                  Move quantity from one shop location to another without changing total stock.
                </p>
                <FormActions showBack={false} onNext={() => setStep(1)} />
              </div>
            )}

            {step === 0 && view === 'add' && (
              <div>
                <h2 className="section-title">New product type</h2>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label>Category</label>
                    <select
                      value={form.newCategory}
                      onChange={(e) =>
                        setForm({ ...form, newCategory: e.target.value as typeof form.newCategory })
                      }
                    >
                      <option value="Phone">Phone</option>
                      <option value="Accessory">Accessory</option>
                      <option value="Spare">Spare</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Staff</label>
                    <select value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
                      {staffNames.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <FormActions showBack={false} onNext={() => setStep(1)} />
              </div>
            )}

            {step === 1 && view === 'adjust' && (
              <div>
                <h2 className="section-title">Movement details</h2>
                <div className="form-grid form-grid--2">
                  <div className="field span-2">
                    <label>Product *</label>
                    <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · qty {p.stock}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Quantity *</label>
                    <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="field">
                    <label>Unit cost ₹</label>
                    <input value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="field">
                    <label>Putaway location</label>
                    <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                      {stockLocations.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Staff</label>
                    <select value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
                      {staffNames.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {form.mode === 'in' && (
                    <>
                      <div className="field">
                        <label>Supplier</label>
                        <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}>
                          {suppliers.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Purchase invoice</label>
                        <input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} />
                      </div>
                    </>
                  )}
                  <div className="field span-2">
                    <label>Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <FormActions onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!form.productId || !form.qty} />
              </div>
            )}

            {step === 1 && view === 'transfer' && (
              <div>
                <h2 className="section-title">Transfer details</h2>
                <div className="form-grid form-grid--2">
                  <div className="field span-2">
                    <label>Product *</label>
                    <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                      <option value="">Select</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.location}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>From</label>
                    <select value={form.fromLoc} onChange={(e) => setForm({ ...form, fromLoc: e.target.value })}>
                      {stockLocations.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>To</label>
                    <select value={form.toLoc} onChange={(e) => setForm({ ...form, toLoc: e.target.value })}>
                      {stockLocations.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Qty *</label>
                    <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="field">
                    <label>Staff</label>
                    <select value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
                      {staffNames.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <FormActions
                  onBack={() => setStep(0)}
                  onNext={() => setStep(2)}
                  nextDisabled={!form.productId || !form.qty || form.fromLoc === form.toLoc}
                />
              </div>
            )}

            {step === 1 && view === 'add' && (
              <div>
                <h2 className="section-title">Product details</h2>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label>Name *</label>
                    <input value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Brand *</label>
                    <input value={form.newBrand} onChange={(e) => setForm({ ...form, newBrand: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>SKU *</label>
                    <input value={form.newSku} onChange={(e) => setForm({ ...form, newSku: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Location</label>
                    <select value={form.newLocation} onChange={(e) => setForm({ ...form, newLocation: e.target.value })}>
                      {stockLocations.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Price ₹ *</label>
                    <input value={form.newPrice} onChange={(e) => setForm({ ...form, newPrice: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="field">
                    <label>MRP ₹</label>
                    <input value={form.newMrp} onChange={(e) => setForm({ ...form, newMrp: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="field">
                    <label>Opening qty *</label>
                    <input value={form.newStock} onChange={(e) => setForm({ ...form, newStock: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="field">
                    <label>Low alert at</label>
                    <input value={form.newLowAt} onChange={(e) => setForm({ ...form, newLowAt: e.target.value })} inputMode="numeric" />
                  </div>
                </div>
                <FormActions
                  onBack={() => setStep(0)}
                  onNext={() => setStep(2)}
                  nextDisabled={!form.newName || !form.newBrand || !form.newSku || !form.newPrice || !form.newStock}
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="section-title">Confirm</h2>
                <div className="detail-card">
                  {view === 'add' ? (
                    <>
                      <strong>{form.newName}</strong>
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                        {form.newBrand} · {form.newCategory} · {form.newSku}
                      </p>
                      <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                        {formatINR(Number(form.newPrice) || 0)} · Qty {form.newStock} · {form.newLocation}
                      </p>
                    </>
                  ) : view === 'transfer' ? (
                    <>
                      <strong>Transfer · {formProduct?.name}</strong>
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                        {form.fromLoc} → {form.toLoc} · Qty {form.qty}
                      </p>
                    </>
                  ) : (
                    <>
                      <strong>
                        Stock {form.mode.toUpperCase()} · {formProduct?.name}
                      </strong>
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                        Qty {form.qty} · {form.reason} · {form.location}
                      </p>
                      {form.mode === 'in' ? (
                        <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                          {form.supplier} · Inv {form.invoiceNo || '—'}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <FormActions onBack={() => setStep(1)} onNext={finish} nextLabel="Apply to stock" />
              </div>
            )}
          </Panel>
        </>
      )}

      <Panel style={{ padding: 16 }} delay={0.12} dashed>
        <h2 className="section-title">Today’s stock ledger</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Time</th>
                <th>Item</th>
                <th>Type</th>
                <th>Qty</th>
                <th>By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {stockLedger.map((l) => (
                <tr key={l.id}>
                  <td>{l.time}</td>
                  <td>{l.item}</td>
                  <td>
                    <span className={`chip ${l.type === 'IN' ? 'chip--live' : 'chip--warn'}`}>{l.type}</span>
                  </td>
                  <td>{l.qty}</td>
                  <td>{l.by}</td>
                  <td>{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
