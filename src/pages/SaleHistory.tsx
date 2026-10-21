import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
import { api } from '../lib/api'
import type { Sale } from '../lib/types'
import { formatINR } from '../lib/types'
import { MiniStat, Modal, PageHeader, Panel } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'
import { matchesQuery } from '../lib/search'
import { specSummary } from '../lib/productSpecs'

type Filter = 'ALL' | 'NEW_MOBILE' | 'USED_PHONE' | 'FINANCE'

const typeLabel: Record<Sale['type'], string> = {
  NEW_MOBILE: 'New mobile',
  USED_PHONE: 'Used phone',
}

function itemsLabel(s: Sale) {
  const items = s.items || []
  if (!items.length) return '—'
  return items
    .map((it) => {
      const product = it.product || it.phoneUnit?.product
      const name = [product?.brand, product?.name].filter(Boolean).join(' ')
      const extra = it.phoneUnit?.imei || (product ? specSummary(product) : '')
      const qty = it.qty > 1 ? ` ×${it.qty}` : ''
      return extra ? `${name}${qty} · ${extra}` : `${name}${qty}`
    })
    .join(', ')
}

export function SaleHistoryPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const salesQ = useQuery({
    queryKey: ['sales', 'history'],
    queryFn: () => api<Sale[]>('/sales'),
  })

  const list = useMemo(() => {
    const rows = salesQ.data || []
    return rows.filter((s) => {
      const fOk =
        filter === 'ALL' || (filter === 'FINANCE' ? s.hasFinance : s.type === filter)
      const itemTerms =
        s.items?.flatMap((it) => [
          it.product?.name,
          it.product?.brand,
          it.product?.model,
          it.product?.sku,
          it.product?.ram,
          it.product?.rom,
          it.phoneUnit?.imei,
        ]) || []
      const qOk = matchesQuery(
        q,
        s.customer?.name,
        s.customer?.phone,
        s.invoiceNo,
        s.id,
        s.notes,
        typeLabel[s.type],
        s.financePlan?.financierName,
        s.financePlan?.approvalRef,
        ...itemTerms,
      )
      return fOk && qOk
    })
  }, [salesQ.data, filter, q])

  const selected =
    list.find((s) => s.id === selectedId) ||
    (salesQ.data || []).find((s) => s.id === selectedId) ||
    null

  const financed = (salesQ.data || []).filter((s) => s.hasFinance)
  const financeTotal = financed.reduce(
    (sum, s) => sum + Number(s.financePlan?.financedAmount || 0),
    0,
  )
  const grandTotal = (salesQ.data || []).reduce((sum, s) => sum + Number(s.grandTotal || 0), 0)

  return (
    <div className="section-gap">
      <PageHeader
        title="Sale history"
        subtitle="Bills · finance logs (company remits remaining to shop)"
        action={
          <button type="button" className="btn btn--primary" onClick={() => navigate('/app/billing/new')}>
            <ShoppingBag size={18} /> New sale
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat
          label="Sales"
          value={String(salesQ.data?.length ?? '—')}
          hint={formatINR(grandTotal)}
          tone="ok"
        />
        <MiniStat
          label="Finance logs"
          value={String(financed.length)}
          hint={formatINR(financeTotal)}
          tone="info"
          onClick={() => setFilter('FINANCE')}
        />
        <MiniStat
          label="New mobile"
          value={String((salesQ.data || []).filter((s) => s.type === 'NEW_MOBILE').length)}
          onClick={() => setFilter('NEW_MOBILE')}
        />
        <MiniStat
          label="Used phone"
          value={String((salesQ.data || []).filter((s) => s.type === 'USED_PHONE').length)}
          onClick={() => setFilter('USED_PHONE')}
        />
      </div>

      <Panel style={{ padding: 16 }} delay={0.05}>
        <div className="search-toolbar">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Search customer, IMEI, brand, financier…"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {(
            [
              ['ALL', 'All'],
              ['NEW_MOBILE', 'New'],
              ['USED_PHONE', 'Used'],
              ['FINANCE', 'Finance log'],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip ${filter === id ? 'chip--live' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {salesQ.isLoading ? (
          <div className="empty-state">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">No sales yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>In-hand</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>
                      {new Date(s.saleDate).toLocaleDateString('en-IN')}
                      <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                        {new Date(s.saleDate).toLocaleTimeString('en-IN', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td>{s.invoiceNo || s.id.slice(-6).toUpperCase()}</td>
                    <td>
                      <div>{s.customer?.name || 'Walk-in'}</div>
                      <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                        {s.customer?.phone || ''}
                      </div>
                    </td>
                    <td>
                      {typeLabel[s.type]}
                      {s.hasFinance ? (
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          Finance
                        </div>
                      ) : null}
                    </td>
                    <td className="cell-wrap">{itemsLabel(s)}</td>
                    <td>{formatINR(s.paidAmount)}</td>
                    <td style={{ fontWeight: 600 }}>{formatINR(s.grandTotal)}</td>
                    <td>
                      <span
                        className={`chip ${s.hasFinance ? 'chip--info' : s.paymentStatus === 'PAID' ? 'chip--live' : 'chip--warn'}`}
                      >
                        {s.hasFinance ? 'Finance log' : s.paymentStatus}
                      </span>
                    </td>
                    <td className="table-action">
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => setSelectedId(s.id)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={Boolean(selected)}
        title={selected?.customer?.name || 'Sale'}
        subtitle={
          selected
            ? `${typeLabel[selected.type]}${selected.invoiceNo ? ` · Inv ${selected.invoiceNo}` : ''}${
                selected.customer?.phone ? ` · ${selected.customer.phone}` : ''
              }`
            : undefined
        }
        onClose={() => setSelectedId(null)}
        wide
        footer={
          <button type="button" className="btn btn--ghost" onClick={() => setSelectedId(null)}>
            Close
          </button>
        }
      >
        {selected ? (
          <div className="section-gap">
            <div className="detail-card is-selected">
              <div className="row-between">
                <strong>{selected.customer?.name || 'Walk-in'}</strong>
                <span
                  className={`chip ${selected.hasFinance ? 'chip--info' : selected.paymentStatus === 'PAID' ? 'chip--live' : 'chip--warn'}`}
                >
                  {selected.hasFinance ? 'Finance log' : selected.paymentStatus}
                </span>
              </div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                {new Date(selected.saleDate).toLocaleString('en-IN')}
                {selected.createdBy ? ` · ${selected.createdBy.name}` : ''}
              </p>
            </div>

            <div className="totals-box">
              <div className="totals-row">
                <span>Taxable</span>
                <span>{formatINR(selected.subtotal)}</span>
              </div>
              <div className="totals-row">
                <span>GST (included)</span>
                <span>{formatINR(selected.tax)}</span>
              </div>
              <div className="totals-row">
                <span>Amount charged</span>
                <span>{formatINR(Number(selected.subtotal) + Number(selected.tax))}</span>
              </div>
              <div className="totals-row">
                <span>Discount / exchange</span>
                <span>{formatINR(selected.discount)}</span>
              </div>
              <div className="totals-row">
                <span>In-hand cash</span>
                <span>{formatINR(selected.paidAmount)}</span>
              </div>
              {selected.financePlan ? (
                <div className="totals-row totals-row--grand">
                  <span>Finance pays shop</span>
                  <span>{formatINR(selected.financePlan.financedAmount)}</span>
                </div>
              ) : (
                <div className="totals-row totals-row--grand">
                  <span>Grand / due</span>
                  <span>
                    {formatINR(selected.grandTotal)}
                    {Number(selected.creditAmount) > 0
                      ? ` · ${formatINR(selected.creditAmount)} due`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {selected.financePlan ? (
              <div className="settle-box">
                <h3 className="section-title" style={{ fontSize: '0.95rem' }}>
                  Finance log
                </h3>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                  {selected.financePlan.financierName} remits{' '}
                  {formatINR(selected.financePlan.financedAmount)} to the shop.
                  {selected.financePlan.approvalRef
                    ? ` Ref ${selected.financePlan.approvalRef}.`
                    : ''}
                </p>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-xs)' }}>
                  Not EMI. Customer due is ₹0. Shop only records that finance will pay the rest.
                </p>
              </div>
            ) : null}

            {selected.exchanges?.length ? (
              <div>
                <h3 className="section-title" style={{ fontSize: '0.95rem' }}>
                  Exchange in
                </h3>
                {selected.exchanges.map((ex) => (
                  <p key={ex.id} style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                    {ex.brand} {ex.model} · IMEI {ex.imei} · {formatINR(ex.agreedValue)}
                  </p>
                ))}
              </div>
            ) : null}

            {selected.items?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it) => {
                      const product = it.product || it.phoneUnit?.product
                      const specs = product ? specSummary(product) : ''
                      return (
                        <tr key={it.id}>
                          <td className="cell-wrap">
                            {product?.brand} {product?.name}
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {it.phoneUnit?.imei || specs || product?.sku}
                            </div>
                          </td>
                          <td>{it.qty}</td>
                          <td>{formatINR(it.lineTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {selected.notes ? (
              <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
                Notes: {selected.notes}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
