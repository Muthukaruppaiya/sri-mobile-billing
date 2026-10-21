import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import type { PhoneUnit, Product } from '../lib/types'
import { formatINR } from '../lib/types'
import { matchesQuery, phoneSearchBlob, productSearchBlob } from '../lib/search'
import { MiniStat, Modal, PageHeader, Panel } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'
import { ProductSpecFields } from '../components/ProductSpecFields'
import { BrandModelFields } from '../components/BrandModelFields'
import {
  emptySpecs,
  specPayload,
  specSummary,
  specsFromProduct,
} from '../lib/productSpecs'

type ProductCategory = Product['category']
type StockFilter = 'ALL' | 'NEW_PHONE' | 'USED_PHONE' | 'SPARE' | 'ACCESSORY'

const FILTERS: { id: StockFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW_PHONE', label: 'New mobiles' },
  { id: 'USED_PHONE', label: 'Used mobiles' },
  { id: 'SPARE', label: 'Spares' },
  { id: 'ACCESSORY', label: 'Accessories' },
]

const categoryLabel: Record<ProductCategory, string> = {
  NEW_PHONE: 'New mobile',
  USED_PHONE: 'Used mobile',
  SPARE: 'Spare',
  ACCESSORY: 'Accessory',
}

const emptyProduct = {
  sku: '',
  brand: '',
  name: '',
  model: '',
  category: 'NEW_PHONE' as ProductCategory,
  sellPrice: 0,
  taxPercent: 18,
  reorderLevel: 2,
  ...emptySpecs(),
}

function suggestSku(brand: string, model: string, category: ProductCategory) {
  const prefix =
    category === 'NEW_PHONE'
      ? 'NP'
      : category === 'USED_PHONE'
        ? 'UP'
        : category === 'SPARE'
          ? 'SP'
          : 'AC'
  const b = (brand || 'X').replace(/\W/g, '').slice(0, 4).toUpperCase()
  const m = (model || 'ITEM').replace(/\W/g, '').slice(0, 6).toUpperCase()
  const tip = Date.now().toString(36).slice(-4).toUpperCase()
  return `${prefix}-${b}-${m}-${tip}`
}

export function StockPage() {
  const { tab } = useParams()
  const view = tab === 'phones' ? 'phones' : tab === 'products' ? 'products' : null
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<StockFilter>('ALL')
  const [phoneFilter, setPhoneFilter] = useState<'ALL' | 'NEW_PHONE' | 'USED_PHONE'>('ALL')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyProduct)
  const [formError, setFormError] = useState('')
  const qc = useQueryClient()

  const stockQ = useQuery({
    queryKey: ['stock'],
    queryFn: () => api<{ products: Product[]; phones: PhoneUnit[] }>('/stock'),
  })
  const valueQ = useQuery({
    queryKey: ['reports', 'stock-value'],
    queryFn: () =>
      api<{
        skuCount: number
        unitsInStock: number
        phoneUnits: number
        stockSellValue: number
        phoneCostValue: number
      }>('/reports/stock-value'),
  })

  const products = stockQ.data?.products || []
  const phones = stockQ.data?.phones || []
  const low = products.filter((p) => p.stockQty <= p.reorderLevel)

  const counts = useMemo(() => {
    const c: Record<StockFilter, number> = {
      ALL: products.length,
      NEW_PHONE: 0,
      USED_PHONE: 0,
      SPARE: 0,
      ACCESSORY: 0,
    }
    for (const p of products) c[p.category] = (c[p.category] || 0) + 1
    return c
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filter !== 'ALL' && p.category !== filter) return false
      return matchesQuery(q, ...productSearchBlob(p))
    })
  }, [products, q, filter])

  const filteredPhones = useMemo(() => {
    return phones.filter((p) => {
      if (phoneFilter !== 'ALL' && p.product.category !== phoneFilter) return false
      return matchesQuery(q, ...phoneSearchBlob(p))
    })
  }, [phones, q, phoneFilter])

  const saveProductMut = useMutation({
    mutationFn: () => {
      const brand = draft.brand.trim()
      const model = draft.model.trim()
      const name = draft.name.trim() || model || brand
      const sku = draft.sku.trim() || suggestSku(brand, model || name, draft.category)
      const specs = specPayload(draft)
      const body = {
        sku,
        brand,
        name,
        model: model || undefined,
        category: draft.category,
        sellPrice: Number(draft.sellPrice) || 0,
        taxPercent: Number(draft.taxPercent) || 0,
        reorderLevel: Math.max(0, Math.round(Number(draft.reorderLevel) || 0)),
        ...specs,
      }
      if (editId) {
        return api<Product>(`/products/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: body.name,
            brand: body.brand,
            model: body.model,
            sellPrice: body.sellPrice,
            taxPercent: body.taxPercent,
            reorderLevel: body.reorderLevel,
            ram: specs.ram || null,
            rom: specs.rom || null,
            color: specs.color || null,
            network: specs.network || null,
            processor: specs.processor || null,
            spareType: specs.spareType || null,
            spareGrade: specs.spareGrade || null,
            specNote: specs.specNote || null,
          }),
        })
      }
      return api<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      setAddOpen(false)
      setEditId(null)
      setDraft(emptyProduct)
      setFormError('')
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (e: Error) => setFormError(e.message),
  })

  function openAdd(category?: ProductCategory) {
    const cat =
      category ||
      (filter !== 'ALL' ? (filter as ProductCategory) : 'NEW_PHONE')
    setEditId(null)
    setDraft({
      ...emptyProduct,
      ...emptySpecs(),
      category: cat,
      taxPercent: cat === 'USED_PHONE' ? 0 : 18,
    })
    setFormError('')
    setAddOpen(true)
  }

  function openEdit(p: Product) {
    setEditId(p.id)
    setDraft({
      sku: p.sku,
      brand: p.brand,
      name: p.name,
      model: p.model || '',
      category: p.category,
      sellPrice: Number(p.sellPrice || 0),
      taxPercent: Number(p.taxPercent ?? 18),
      reorderLevel: p.reorderLevel,
      ...specsFromProduct(p),
    })
    setFormError('')
    setAddOpen(true)
  }

  function saveProduct() {
    setFormError('')
    if (!draft.brand.trim()) {
      setFormError('Enter brand')
      return
    }
    if (!draft.name.trim() && !draft.model.trim()) {
      setFormError('Enter product name or model')
      return
    }
    saveProductMut.mutate()
  }

  if (!view) return <Navigate to="/app/stock/products" replace />

  return (
    <div className="section-gap">
      <PageHeader
        title={view === 'products' ? 'Stock · Products' : 'Stock · Phone units'}
        subtitle={
          view === 'products'
            ? 'Mobiles with RAM/ROM · spares with type & grade (D / D+)'
            : 'IMEI units in hand — filter new or used'
        }
        action={
          view === 'products' ? (
            <button type="button" className="btn btn--primary" onClick={() => openAdd()}>
              <Plus size={14} /> Add product
            </button>
          ) : undefined
        }
      />

      <div className="mini-stat-grid">
        <MiniStat label="SKUs" value={String(valueQ.data?.skuCount ?? '—')} tone="ok" />
        <MiniStat label="Phone units" value={String(valueQ.data?.phoneUnits ?? '—')} tone="info" />
        <MiniStat label="Sell value" value={formatINR(valueQ.data?.stockSellValue ?? 0)} />
        <MiniStat label="Low stock" value={String(low.length)} tone="warn" />
      </div>

      <Panel style={{ padding: 12 }}>
        <div className="filter-bar">
          {view === 'products' ? (
            <div className="filter-tabs" role="tablist" aria-label="Product type">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`filter-tab${filter === f.id ? ' is-active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="filter-count">({counts[f.id]})</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="filter-tabs" role="tablist" aria-label="Phone type">
              {(
                [
                  { id: 'ALL' as const, label: 'All phones' },
                  { id: 'NEW_PHONE' as const, label: 'New' },
                  { id: 'USED_PHONE' as const, label: 'Used' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={phoneFilter === f.id}
                  className={`filter-tab${phoneFilter === f.id ? ' is-active' : ''}`}
                  onClick={() => setPhoneFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 180 }}>
            <SearchField
              value={q}
              onChange={setQ}
              placeholder={
                view === 'products'
                  ? 'Search brand, model, RAM, ROM, grade, SKU…'
                  : 'Search IMEI, brand, model, RAM…'
              }
            />
          </div>
        </div>

        {view === 'products' ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Brand</th>
                  <th>Product / model</th>
                  <th>Specs</th>
                  <th>Qty</th>
                  <th>Sell ₹</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isLow = p.stockQty <= p.reorderLevel
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.sku}</td>
                      <td>
                        <span className="chip">{categoryLabel[p.category]}</span>
                      </td>
                      <td>{p.brand}</td>
                      <td style={{ fontWeight: 600 }}>
                        {p.name}
                        {p.model && p.model !== p.name ? (
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {p.model}
                          </div>
                        ) : null}
                      </td>
                      <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                        {specSummary(p) || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.stockQty}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatINR(p.sellPrice || 0)}
                      </td>
                      <td>
                        <span className={`chip ${isLow ? 'chip--warn' : 'chip--live'}`}>
                          {isLow ? 'Low' : 'OK'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => openEdit(p)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!filteredProducts.length ? (
              <div className="empty-state">
                {q || filter !== 'ALL' ? (
                  'No products match this filter.'
                ) : (
                  <>
                    No products yet.{' '}
                    <button type="button" className="btn btn--ghost" onClick={() => openAdd()}>
                      Add product
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>IMEI</th>
                  <th>Type</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Specs</th>
                  <th>Cost</th>
                  <th>Purchased</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhones.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{p.imei}</td>
                    <td>
                      <span className="chip">
                        {p.product.category === 'USED_PHONE' ? 'Used' : 'New'}
                      </span>
                    </td>
                    <td>{p.product.brand}</td>
                    <td>
                      {p.product.name}
                      {p.product.model ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {p.product.model}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                      {specSummary(p.product) || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(p.cost)}</td>
                    <td>{new Date(p.purchasedAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <span className="chip chip--live">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredPhones.length ? (
              <div className="empty-state">
                {q || phoneFilter !== 'ALL'
                  ? 'No phone units match this filter.'
                  : 'No phone units in stock yet.'}
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      <Modal
        open={addOpen}
        title={editId ? 'Edit product' : 'Add product'}
        subtitle="Mobiles: RAM / ROM / color. Spares: type + grade (D, D+ for glass)."
        onClose={() => setAddOpen(false)}
        wide
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saveProductMut.isPending}
              onClick={saveProduct}
            >
              {saveProductMut.isPending ? 'Saving…' : 'Save product'}
            </button>
          </>
        }
      >
        {formError ? (
          <p className="purchase-desk__error" style={{ marginTop: 0 }}>
            {formError}
          </p>
        ) : null}
        <div className="purchase-fields">
          <label className="span-2">
            Type *
            <div className="filter-tabs" style={{ width: '100%' }}>
              {(
                [
                  ['NEW_PHONE', 'New mobile'],
                  ['USED_PHONE', 'Used mobile'],
                  ['SPARE', 'Spare'],
                  ['ACCESSORY', 'Accessory'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-tab${draft.category === id ? ' is-active' : ''}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      category: id,
                      taxPercent: id === 'USED_PHONE' ? 0 : draft.taxPercent || 18,
                      spareType: id === 'SPARE' || id === 'ACCESSORY' ? draft.spareType : '',
                      spareGrade: id === 'SPARE' || id === 'ACCESSORY' ? draft.spareGrade : '',
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
          <label>
            SKU
            <input
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              placeholder="Auto if blank"
            />
          </label>
          <BrandModelFields
            required
            brand={draft.brand}
            model={draft.model}
            onChange={({ brand, model }) =>
              setDraft({ ...draft, brand, model, name: draft.name || model })
            }
          />
          <label>
            Display name
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Defaults to model"
            />
          </label>
          <label>
            Sell ₹ (incl. tax)
            <input
              type="number"
              min={0}
              value={draft.sellPrice || ''}
              onChange={(e) => setDraft({ ...draft, sellPrice: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            GST % (included)
            <input
              type="number"
              min={0}
              value={draft.taxPercent || ''}
              onChange={(e) => setDraft({ ...draft, taxPercent: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            Reorder level
            <input
              type="number"
              min={0}
              value={draft.reorderLevel || ''}
              onChange={(e) => setDraft({ ...draft, reorderLevel: Number(e.target.value) || 0 })}
            />
          </label>
          <ProductSpecFields
            category={draft.category}
            value={draft}
            onChange={(specs) => setDraft({ ...draft, ...specs })}
          />
        </div>
      </Modal>
    </div>
  )
}
