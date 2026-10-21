import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Product, Purchase, PurchaseType, Supplier } from '../lib/types'
import { formatINR } from '../lib/types'
import { Modal, SuccessBanner, TitleCount } from '../components/ui'
import { splitInclusive } from '../lib/money'
import { ComboSelect, PAYMENT_MODES, SearchableSelect } from '../components/SearchableSelect'
import {
  CustomerPhoneField,
  customerPayload,
  emptyCustomerDraft,
  type CustomerDraft,
} from '../components/CustomerPhoneField'
import { productSearchBlob } from '../lib/search'
import { ProductSpecFields } from '../components/ProductSpecFields'
import { BrandModelFields } from '../components/BrandModelFields'
import {
  NETWORK_OPTIONS,
  RAM_OPTIONS,
  ROM_OPTIONS,
  emptySpecs,
  specPayload,
  specSummary,
  type SpecDraft,
} from '../lib/productSpecs'

const modeFromSlug: Record<string, PurchaseType> = {
  new: 'NEW_MOBILE',
  spares: 'SPARES',
  used: 'USED_PHONE',
}

const modeTitle: Record<PurchaseType, string> = {
  NEW_MOBILE: 'New mobile purchase',
  SPARES: 'Spares purchase',
  USED_PHONE: 'Used phone purchase',
}

type PartySource = 'SUPPLIER' | 'CUSTOMER'

type LineDraft = {
  key: string
  productId: string
  brand: string
  model: string
  qty: number
  unitCost: number
  discount: number
  taxPercent: number
  suggestedSell: number
  imeiText: string
  color: string
  conditionNote: string
  ram: string
  rom: string
  network: string
}

type ProductDraft = {
  brand: string
  model: string
  name: string
  sku: string
  sellPrice: number
  taxPercent: number
  category: Product['category']
} & SpecDraft

function emptyLine(taxPercent = 18): LineDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    brand: '',
    model: '',
    qty: 1,
    unitCost: 0,
    discount: 0,
    taxPercent,
    suggestedSell: 0,
    imeiText: '',
    color: '',
    conditionNote: '',
    ram: '',
    rom: '',
    network: '',
  }
}

function emptyProductDraft(category: Product['category']): ProductDraft {
  return {
    brand: '',
    model: '',
    name: '',
    sku: '',
    sellPrice: 0,
    taxPercent: category === 'USED_PHONE' ? 0 : 18,
    category,
    ...emptySpecs(),
  }
}

function parseImeis(text: string) {
  return text
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function usedSku(imei: string, brand: string) {
  const tip = (imei || '').replace(/\W/g, '').slice(-8) || Date.now().toString(36).slice(-6)
  const prefix = (brand || 'USED').replace(/\s+/g, '').slice(0, 6).toUpperCase()
  return `UP-${prefix}-${tip}`
}

export function PurchasePage() {
  const { mode: modeSlug } = useParams()
  const resolved = modeFromSlug[modeSlug || '']
  const mode: PurchaseType = resolved || 'NEW_MOBILE'
  const isUsed = mode === 'USED_PHONE'
  const qc = useQueryClient()
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [partySource, setPartySource] = useState<PartySource>('SUPPLIER')
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [billDiscount, setBillDiscount] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '' })
  const [walkIn, setWalkIn] = useState<CustomerDraft>(emptyCustomerDraft)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [addProductForLine, setAddProductForLine] = useState<string | null>(null)
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft('NEW_PHONE'))
  const [productError, setProductError] = useState('')

  useEffect(() => {
    setLines([emptyLine(isUsed ? 0 : 18)])
    setError('')
    setDone(null)
    setPartySource('SUPPLIER')
    setSupplierId('')
    setWalkIn(emptyCustomerDraft())
    setPaidAmount(0)
  }, [mode, isUsed])

  const category =
    mode === 'NEW_MOBILE' ? 'NEW_PHONE' : mode === 'USED_PHONE' ? 'USED_PHONE' : undefined

  const fromCustomer = isUsed && partySource === 'CUSTOMER'

  const suppliersQ = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<Supplier[]>('/suppliers'),
  })

  const productsQ = useQuery({
    queryKey: ['products', category, mode],
    queryFn: () => {
      const qs =
        mode === 'SPARES'
          ? '?category=SPARE'
          : category
            ? `?category=${category}`
            : ''
      return api<Product[]>(`/products${qs}`)
    },
    enabled: Boolean(resolved) && !isUsed,
  })

  const accessoryQ = useQuery({
    queryKey: ['products', 'ACCESSORY'],
    queryFn: () => api<Product[]>('/products?category=ACCESSORY'),
    enabled: Boolean(resolved) && mode === 'SPARES',
  })

  const products = useMemo(() => {
    const base = productsQ.data || []
    if (mode === 'SPARES') return [...base, ...(accessoryQ.data || [])]
    return base
  }, [productsQ.data, accessoryQ.data, mode])

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: `${p.brand} ${p.name}`,
        hint: [p.sku, p.model, specSummary(p)].filter(Boolean).join(' · '),
        terms: productSearchBlob(p),
      })),
    [products],
  )

  const createSupplier = useMutation({
    mutationFn: () =>
      api<Supplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(newSupplier),
      }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setSupplierId(s.id)
      setNewSupplier({ name: '', phone: '' })
    },
  })

  const defaultProductCategory =
    mode === 'NEW_MOBILE' ? 'NEW_PHONE' : mode === 'SPARES' ? 'SPARE' : 'USED_PHONE'

  const createProduct = useMutation({
    mutationFn: () => {
      const brand = productDraft.brand.trim()
      const model = productDraft.model.trim()
      const name = productDraft.name.trim() || model || brand
      const cat = productDraft.category || defaultProductCategory
      const prefix =
        cat === 'SPARE' ? 'SP' : cat === 'ACCESSORY' ? 'AC' : cat === 'USED_PHONE' ? 'UP' : 'NP'
      const sku =
        productDraft.sku.trim() ||
        `${prefix}-${brand.replace(/\W/g, '').slice(0, 4).toUpperCase()}-${(model || 'ITEM')
          .replace(/\W/g, '')
          .slice(0, 6)
          .toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`
      return api<Product>('/products', {
        method: 'POST',
        body: JSON.stringify({
          sku,
          brand,
          name,
          model: model || undefined,
          category: productDraft.category || defaultProductCategory,
          sellPrice: Number(productDraft.sellPrice) || 0,
          taxPercent: Number(productDraft.taxPercent) || 0,
          ...specPayload(productDraft),
        }),
      })
    },
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['stock'] })
      if (addProductForLine) {
        setLines((prev) =>
          prev.map((l) =>
            l.key === addProductForLine
              ? {
                  ...l,
                  productId: p.id,
                  taxPercent: Number(p.taxPercent ?? 18),
                  unitCost: Number(p.sellPrice || 0),
                }
              : l,
          ),
        )
      }
      setAddProductOpen(false)
      setAddProductForLine(null)
      setProductDraft(emptyProductDraft(defaultProductCategory))
      setProductError('')
    },
    onError: (e: Error) => setProductError(e.message),
  })

  function openAddProduct(lineKey?: string) {
    setAddProductForLine(lineKey || null)
    setProductDraft(emptyProductDraft(defaultProductCategory))
    setProductError('')
    setAddProductOpen(true)
  }

  function saveNewProduct() {
    setProductError('')
    if (!productDraft.brand.trim()) {
      setProductError('Enter brand')
      return
    }
    if (!productDraft.model.trim() && !productDraft.name.trim()) {
      setProductError('Enter model or name')
      return
    }
    createProduct.mutate()
  }

  const createPurchase = useMutation({
    mutationFn: async () => {
      const items = lines.map((l) => {
        const imeis = parseImeis(l.imeiText)
        const isPhone = mode === 'NEW_MOBILE' || mode === 'USED_PHONE'
        const qty = isPhone ? Math.max(imeis.length, l.qty) : l.qty

        if (mode === 'USED_PHONE') {
          const brand = l.brand.trim()
          const model = l.model.trim()
          return {
            qty,
            unitCost: l.unitCost,
            discount: l.discount,
            taxPercent: l.taxPercent,
            suggestedSellPrice: l.suggestedSell,
            imeis,
            color: l.color || undefined,
            conditionNote: l.conditionNote || undefined,
            createProduct: {
              sku: usedSku(imeis[0] || '', brand),
              name: model || `${brand} used`,
              brand,
              model: model || undefined,
              category: 'USED_PHONE' as const,
              sellPrice: l.suggestedSell || l.unitCost,
              ram: l.ram || undefined,
              rom: l.rom || undefined,
              color: l.color || undefined,
              network: l.network || undefined,
            },
          }
        }

        return {
          productId: l.productId,
          qty,
          unitCost: l.unitCost,
          discount: l.discount,
          taxPercent: l.taxPercent,
          imeis: isPhone ? imeis : undefined,
          color: l.color || undefined,
          conditionNote: l.conditionNote || undefined,
        }
      })

      return api<Purchase>('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          type: mode,
          ...(fromCustomer ? customerPayload(walkIn) : { supplierId }),
          invoiceNo: invoiceNo || undefined,
          discount: billDiscount,
          paidAmount,
          paymentMode,
          notes: notes || undefined,
          items,
        }),
      })
    },
    onSuccess: (p) => {
      setDone(`Purchase saved · ${formatINR(p.grandTotal)} · ${p.paymentStatus}`)
      setLines([emptyLine(isUsed ? 0 : 18)])
      setInvoiceNo('')
      setNotes('')
      setBillDiscount(0)
      setPaidAmount(0)
      setWalkIn(emptyCustomerDraft())
      setError('')
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const totals = useMemo(() => {
    let sub = 0
    let tax = 0
    for (const l of lines) {
      const imeis = parseImeis(l.imeiText)
      const qty = mode === 'SPARES' ? l.qty : Math.max(imeis.length || l.qty, 1)
      const charged = Math.max(l.unitCost * qty - l.discount, 0)
      sub += charged
      tax += splitInclusive(charged, l.taxPercent).tax
    }
    const grand = Math.max(sub - billDiscount, 0)
    const credit = Math.max(grand - paidAmount, 0)
    return { sub, tax, grand, credit }
  }, [lines, billDiscount, paidAmount, mode])

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function save() {
    setError('')
    if (fromCustomer) {
      if (!walkIn.phone.trim()) {
        setError('Enter customer phone')
        return
      }
      if (!walkIn.name.trim()) {
        setError('Enter customer name')
        return
      }
    } else if (!supplierId) {
      setError('Select supplier')
      return
    }

    if (isUsed) {
      const ok = lines.every((l) => {
        const imeis = parseImeis(l.imeiText)
        return l.brand.trim() && l.model.trim() && imeis.length > 0 && l.unitCost >= 0 && l.suggestedSell > 0
      })
      if (!ok) {
        setError('Fill brand, model, IMEI, pay amount and suggested sale price on every used phone line')
        return
      }
    } else {
      const ok = lines.every((l) => {
        if (!l.productId || l.unitCost < 0) return false
        if (mode === 'SPARES') return l.qty > 0
        return parseImeis(l.imeiText).length > 0
      })
      if (!ok) {
        setError('Fill product, cost, and IMEI/qty on every line')
        return
      }
    }

    createPurchase.mutate()
  }

  if (!resolved) return <Navigate to="/app/purchase/new" replace />

  return (
    <div className="purchase-desk">
      <header className="purchase-desk__top">
        <div className="purchase-desk__title-row">
          <div>
            <h1>{modeTitle[mode]}</h1>
            <p className="purchase-desk__sub">
              {isUsed
                ? fromCustomer
                  ? 'Buy used phone from customer — pay them an amount (not exchange)'
                  : 'Buy used phone from vendor — create stock on entry'
                : 'Record stock in · syncs live to inventory'}
            </p>
          </div>
        </div>
        <AnimatePresence>
          {done ? (
            <SuccessBanner title="Purchase created successfully" detail={done} onClose={() => setDone(null)} />
          ) : null}
        </AnimatePresence>
        {error ? <p className="purchase-desk__error">{error}</p> : null}
      </header>

      <div className="purchase-desk__grid purchase-desk__grid--solo">
        <section className="purchase-card">
          <div className="purchase-card__head">
            <h2>{isUsed ? 'Party & bill' : 'Supplier & bill'}</h2>
          </div>

          {isUsed ? (
            <div className="party-toggle" role="tablist" aria-label="Buy from">
              <button
                type="button"
                className={`party-toggle__btn${partySource === 'SUPPLIER' ? ' is-active' : ''}`}
                onClick={() => {
                  setPartySource('SUPPLIER')
                  setWalkIn(emptyCustomerDraft())
                }}
              >
                Vendor
              </button>
              <button
                type="button"
                className={`party-toggle__btn${partySource === 'CUSTOMER' ? ' is-active' : ''}`}
                onClick={() => {
                  setPartySource('CUSTOMER')
                  setSupplierId('')
                }}
              >
                Customer
              </button>
            </div>
          ) : null}

          {fromCustomer ? (
            <>
              <CustomerPhoneField value={walkIn} onChange={setWalkIn} />
              <div className="purchase-fields" style={{ marginTop: 10 }}>
                <label>
                  Invoice / ref
                  <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </label>
                <label className="span-2">
                  Notes
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="purchase-fields">
                <label>
                  Supplier *
                  <ComboSelect
                    value={supplierId}
                    placeholder="Type supplier…"
                    options={(suppliersQ.data || []).map((s) => ({
                      id: s.id,
                      label: s.name,
                      hint: s.phone || undefined,
                    }))}
                    onChange={setSupplierId}
                  />
                </label>
                <label>
                  Invoice / ref
                  <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </label>
                <label className="span-2">
                  Notes
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="purchase-quick">
                <input
                  placeholder="New supplier name"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
                <input
                  placeholder="Phone"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!newSupplier.name || createSupplier.isPending}
                  onClick={() => createSupplier.mutate()}
                >
                  Add
                </button>
              </div>
            </>
          )}
        </section>

        <section className="purchase-card purchase-card--pay">
          <div className="purchase-card__head">
            <h2>{fromCustomer ? 'Payout to customer' : 'Payment'}</h2>
          </div>
          <div className="purchase-fields">
            <label>
              Discount ₹
              <input
                type="number"
                min={0}
                value={billDiscount || ''}
                onChange={(e) => setBillDiscount(Number(e.target.value))}
              />
            </label>
            <label>
              Mode
              <ComboSelect
                value={paymentMode}
                placeholder="Type mode…"
                options={[...PAYMENT_MODES]}
                onChange={setPaymentMode}
              />
            </label>
            <label>
              {fromCustomer ? 'Pay now ₹' : 'Paid now ₹'}
              <input
                type="number"
                min={0}
                value={paidAmount || ''}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                onFocus={() => {
                  if (!paidAmount) setPaidAmount(Math.round(totals.grand))
                }}
              />
            </label>
            <label>
              {fromCustomer ? 'Still due to customer' : 'Credit due'}
              <input readOnly value={formatINR(totals.credit)} />
            </label>
          </div>
          <div className="purchase-total-bar">
            <div>
              <span className="muted">Lines · GST</span>
              <strong>
                {formatINR(totals.sub)}
                {!isUsed ? <span className="muted"> · {formatINR(totals.tax)}</span> : null}
              </strong>
            </div>
            <div>
              <span className="muted">{fromCustomer ? 'Payout' : 'Grand'}</span>
              <strong className="purchase-grand">{formatINR(totals.grand)}</strong>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={createPurchase.isPending}
              onClick={save}
            >
              {createPurchase.isPending ? 'Saving…' : 'Save purchase'}
            </button>
          </div>
        </section>

        <section className="purchase-card purchase-card--lines purchase-card--lines-wide">
          <div className="purchase-lines-head">
            <h2>
              {mode === 'SPARES'
                ? 'Spare lines'
                : isUsed
                  ? fromCustomer
                    ? 'Used phones · pay customer'
                    : 'Used phones · create on entry'
                  : 'Phone lines · bulk IMEI'}{' '}
              <TitleCount n={lines.length} />
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!isUsed ? (
                <button type="button" className="btn btn--ghost" onClick={() => openAddProduct()}>
                  <Plus size={14} /> Add product
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setLines((p) => [...p, emptyLine(isUsed ? 0 : 18)])}
              >
                <Plus size={14} /> Add line
              </button>
            </div>
          </div>

          {isUsed ? (
            <>
              <div className="purchase-line purchase-line--head purchase-line--used" aria-hidden>
                <span />
                <span>Brand</span>
                <span>Model</span>
                <span>IMEI</span>
                <span>{fromCustomer ? 'Pay ₹' : 'Cost'}</span>
                <span>Color</span>
                <span>Condition</span>
                <span />
              </div>
              <div className="purchase-lines-scroll">
                {lines.map((l, idx) => (
                  <div key={l.key} className="purchase-line-stack">
                    <div className="purchase-line purchase-line--used">
                      <div className="purchase-line__idx">{idx + 1}</div>
                      <BrandModelFields
                        compact
                        brand={l.brand}
                        model={l.model}
                        onChange={({ brand, model }) => updateLine(l.key, { brand, model })}
                      />
                      <input
                        placeholder="IMEI *"
                        value={l.imeiText}
                        onChange={(e) => {
                          const imeis = parseImeis(e.target.value)
                          updateLine(l.key, { imeiText: e.target.value, qty: Math.max(imeis.length, 1) })
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder={fromCustomer ? 'Pay amt' : 'Cost'}
                        value={l.unitCost || ''}
                        onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                      />
                      <input
                        placeholder="Color"
                        value={l.color}
                        onChange={(e) => updateLine(l.key, { color: e.target.value })}
                      />
                      <input
                        placeholder="Condition note"
                        value={l.conditionNote}
                        onChange={(e) => updateLine(l.key, { conditionNote: e.target.value })}
                      />
                      <button
                        type="button"
                        className="purchase-line__del"
                        disabled={lines.length === 1}
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                        aria-label="Remove line"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="purchase-line-specs">
                      <ComboSelect
                        value={l.ram}
                        allowCreate
                        placeholder="Type RAM…"
                        options={RAM_OPTIONS.map((o) => ({ id: o, label: o }))}
                        onChange={(v) => updateLine(l.key, { ram: v })}
                      />
                      <ComboSelect
                        value={l.rom}
                        allowCreate
                        placeholder="Type ROM…"
                        options={ROM_OPTIONS.map((o) => ({ id: o, label: o }))}
                        onChange={(v) => updateLine(l.key, { rom: v })}
                      />
                      <ComboSelect
                        value={l.network}
                        allowCreate
                        placeholder="Type network…"
                        options={NETWORK_OPTIONS.map((o) => ({ id: o, label: o }))}
                        onChange={(v) => updateLine(l.key, { network: v })}
                      />
                      <input
                        type="number"
                        min={0}
                        title="Suggested sale ₹"
                        placeholder="Suggest sale ₹ *"
                        value={l.suggestedSell || ''}
                        onChange={(e) => updateLine(l.key, { suggestedSell: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="purchase-line purchase-line--head" aria-hidden>
                <span />
                <span>Product</span>
                <span>{mode === 'SPARES' ? 'Qty' : 'IMEI / serial'}</span>
                <span>Cost incl.</span>
                <span>Disc</span>
                <span>GST %</span>
                <span>{mode === 'SPARES' ? '' : 'Color'}</span>
                <span />
              </div>

              <div className="purchase-lines-scroll">
                {lines.map((l, idx) => (
                  <div key={l.key} className="purchase-line">
                    <div className="purchase-line__idx">{idx + 1}</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <SearchableSelect
                        options={productOptions}
                        value={l.productId}
                        placeholder="Search brand, model, SKU…"
                        emptyLabel="No products match — use Add product"
                        onChange={(id) => {
                          const p = products.find((x) => x.id === id)
                          updateLine(l.key, {
                            productId: id,
                            taxPercent: Number(p?.taxPercent ?? 18),
                            unitCost: Number(p?.sellPrice || p?.mrp || 0),
                          })
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ justifySelf: 'start', padding: '4px 8px', fontSize: 'var(--fs-xs)' }}
                        onClick={() => openAddProduct(l.key)}
                      >
                        + New product
                      </button>
                    </div>

                    {mode === 'SPARES' ? (
                      <input
                        type="number"
                        min={1}
                        title="Qty"
                        value={l.qty || ''}
                        onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                      />
                    ) : (
                      <input
                        title="IMEIs"
                        placeholder="IMEI, IMEI…"
                        value={l.imeiText}
                        onChange={(e) => {
                          const imeis = parseImeis(e.target.value)
                          updateLine(l.key, { imeiText: e.target.value, qty: Math.max(imeis.length, 1) })
                        }}
                      />
                    )}

                    <input
                      type="number"
                      min={0}
                      title="Cost incl. tax"
                      placeholder=""
                      value={l.unitCost || ''}
                      onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      min={0}
                      title="Disc"
                      placeholder=""
                      value={l.discount || ''}
                      onChange={(e) => updateLine(l.key, { discount: Number(e.target.value) })}
                    />
                    <label className="tax-auto">
                      <input
                        type="number"
                        min={0}
                        title="GST % included"
                        placeholder="18"
                        value={l.taxPercent || ''}
                        onChange={(e) => updateLine(l.key, { taxPercent: Number(e.target.value) })}
                      />
                      <small>
                        Tax{' '}
                        {formatINR(
                          splitInclusive(
                            Math.max(
                              l.unitCost * (mode === 'SPARES' ? l.qty : Math.max(parseImeis(l.imeiText).length, l.qty, 1)) -
                                l.discount,
                              0,
                            ),
                            l.taxPercent,
                          ).tax,
                        )}
                      </small>
                    </label>
                    {mode !== 'SPARES' ? (
                      <input
                        title="Color"
                        placeholder="Color"
                        value={l.color}
                        onChange={(e) => updateLine(l.key, { color: e.target.value })}
                      />
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="purchase-line__del"
                      disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      aria-label="Remove line"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        open={addProductOpen}
        title="Add product"
        subtitle={
          mode === 'SPARES'
            ? 'Spare type + grade (D / D+ for tempered glass)'
            : 'Brand, model and specs (RAM / ROM)'
        }
        onClose={() => setAddProductOpen(false)}
        wide
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setAddProductOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={createProduct.isPending}
              onClick={saveNewProduct}
            >
              {createProduct.isPending ? 'Saving…' : 'Save product'}
            </button>
          </>
        }
      >
        {productError ? (
          <p className="purchase-desk__error" style={{ marginTop: 0 }}>
            {productError}
          </p>
        ) : null}
        <div className="purchase-fields">
          {mode === 'SPARES' ? (
            <label className="span-2">
              Type
              <ComboSelect
                value={productDraft.category}
                placeholder="Type type…"
                options={[
                  { id: 'SPARE', label: 'Spare' },
                  { id: 'ACCESSORY', label: 'Accessory' },
                ]}
                onChange={(v) =>
                  setProductDraft({ ...productDraft, category: v as Product['category'] })
                }
              />
            </label>
          ) : null}
          <BrandModelFields
            required
            brand={productDraft.brand}
            model={productDraft.model}
            onChange={({ brand, model }) =>
              setProductDraft({ ...productDraft, brand, model, name: productDraft.name || model })
            }
          />
          <label>
            Display name
            <input
              value={productDraft.name}
              onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })}
              placeholder="Defaults to model"
            />
          </label>
          <label>
            SKU
            <input
              value={productDraft.sku}
              onChange={(e) => setProductDraft({ ...productDraft, sku: e.target.value })}
              placeholder="Auto if blank"
            />
          </label>
          <label>
            Sell ₹ (incl. tax)
            <input
              type="number"
              min={0}
              value={productDraft.sellPrice || ''}
              onChange={(e) =>
                setProductDraft({ ...productDraft, sellPrice: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            GST % (included)
            <input
              type="number"
              min={0}
              value={productDraft.taxPercent || ''}
              onChange={(e) =>
                setProductDraft({ ...productDraft, taxPercent: Number(e.target.value) || 0 })
              }
            />
          </label>
          <ProductSpecFields
            category={productDraft.category}
            value={productDraft}
            onChange={(specs) => setProductDraft({ ...productDraft, ...specs })}
          />
        </div>
      </Modal>
    </div>
  )
}
