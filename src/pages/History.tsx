import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackagePlus, Printer } from 'lucide-react'
import { openDoc } from '../lib/print'
import { api } from '../lib/api'
import type { Purchase, PurchaseType } from '../lib/types'
import { formatINR, partyName } from '../lib/types'
import { MiniStat, Modal, PageHeader, Panel } from '../components/ui'
import { ComboSelect, PAYMENT_MODES, SearchField } from '../components/SearchableSelect'
import { matchesQuery } from '../lib/search'

type Filter = 'ALL' | PurchaseType | 'PENDING'

const typeLabel: Record<PurchaseType, string> = {
  NEW_MOBILE: 'New mobile',
  SPARES: 'Spares',
  USED_PHONE: 'Used phone',
}

function itemsLabel(p: Purchase) {
  const items = p.items || []
  if (!items.length) return '—'
  return items
    .map((it) => {
      const name = it.product?.name || [it.product?.brand, it.product?.model].filter(Boolean).join(' ')
      const spec = [it.product?.ram, it.product?.rom, it.product?.spareGrade].filter(Boolean).join('/')
      const imeis = (it.phoneUnits || []).map((u) => u.imei).filter(Boolean)
      const qty = it.qty > 1 ? ` ×${it.qty}` : ''
      const bits = [name, spec].filter(Boolean).join(' ')
      return `${bits}${qty}${imeis.length ? ` · ${imeis.join(', ')}` : ''}`
    })
    .join(', ')
}

export function HistoryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [settleAmt, setSettleAmt] = useState('')
  const [settleMode, setSettleMode] = useState('CASH')
  const [settleError, setSettleError] = useState('')

  const purchasesQ = useQuery({
    queryKey: ['purchases', 'history'],
    queryFn: () => api<Purchase[]>('/purchases'),
  })

  const settle = useMutation({
    mutationFn: (id: string) =>
      api<Purchase>(`/purchases/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(settleAmt),
          mode: settleMode,
          note: 'Credit settlement',
        }),
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setSelectedId(p.id)
      setSettleAmt(Number(p.creditAmount) > 0 ? String(Number(p.creditAmount)) : '')
      setSettleError('')
    },
    onError: (e: Error) => setSettleError(e.message),
  })

  const list = useMemo(() => {
    const rows = purchasesQ.data || []
    return rows.filter((p) => {
      const pending = Number(p.creditAmount) > 0
      const fOk =
        filter === 'ALL' || (filter === 'PENDING' ? pending : p.type === filter)
      const itemTerms =
        p.items?.flatMap((it) => [
          it.product?.name,
          it.product?.brand,
          it.product?.model,
          it.product?.sku,
          it.product?.ram,
          it.product?.rom,
          it.product?.spareGrade,
          ...(it.phoneUnits?.map((u) => u.imei) || []),
        ]) || []
      const qOk = matchesQuery(
        q,
        partyName(p),
        p.invoiceNo,
        p.id,
        p.notes,
        typeLabel[p.type],
        ...itemTerms,
      )
      return fOk && qOk
    })
  }, [purchasesQ.data, filter, q])

  const selected =
    list.find((p) => p.id === selectedId) ||
    (purchasesQ.data || []).find((p) => p.id === selectedId) ||
    null

  const pending = (purchasesQ.data || []).filter((p) => Number(p.creditAmount) > 0)
  const creditTotal = pending.reduce((s, p) => s + Number(p.creditAmount || 0), 0)
  const grandTotal = (purchasesQ.data || []).reduce((s, p) => s + Number(p.grandTotal || 0), 0)

  function openPurchase(p: Purchase) {
    setSelectedId(p.id)
    setSettleAmt(Number(p.creditAmount) > 0 ? String(Math.max(Number(p.creditAmount) || 0, 0)) : '')
    setSettleError('')
  }

  function closePurchase() {
    setSelectedId(null)
    setSettleError('')
  }

  return (
    <div className="section-gap">
      <PageHeader
        title="Purchase history"
        subtitle="Review bills · settle purchase credit"
        action={
          <button type="button" className="btn btn--primary" onClick={() => navigate('/app/purchase/new')}>
            <PackagePlus size={18} /> New purchase
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat
          label="Purchases"
          value={String(purchasesQ.data?.length ?? '—')}
          hint={formatINR(grandTotal)}
          tone="ok"
        />
        <MiniStat
          label="Pending credit"
          value={formatINR(creditTotal)}
          hint={`${pending.length} bills`}
          tone="warn"
          onClick={() => setFilter('PENDING')}
        />
        <MiniStat
          label="New mobile"
          value={String((purchasesQ.data || []).filter((p) => p.type === 'NEW_MOBILE').length)}
          onClick={() => setFilter('NEW_MOBILE')}
        />
        <MiniStat
          label="Spares / used"
          value={String(
            (purchasesQ.data || []).filter((p) => p.type === 'SPARES' || p.type === 'USED_PHONE')
              .length,
          )}
          tone="info"
        />
      </div>

      <Panel style={{ padding: 16 }}>
        <div className="search-toolbar">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Search party, invoice, brand, model, IMEI…"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {(
            [
              ['ALL', 'All'],
              ['NEW_MOBILE', 'New'],
              ['SPARES', 'Spares'],
              ['USED_PHONE', 'Used'],
              ['PENDING', 'Pending'],
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

        {purchasesQ.isLoading ? (
          <div className="empty-state">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">No purchases yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Party</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const due = Number(p.creditAmount) || 0
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(p.purchaseDate).toLocaleDateString('en-IN')}
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {new Date(p.purchaseDate).toLocaleTimeString('en-IN', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td>{p.invoiceNo || p.id.slice(-6).toUpperCase()}</td>
                      <td>
                        <div>{partyName(p)}</div>
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {p.customer ? 'Customer' : 'Vendor'}
                        </div>
                      </td>
                      <td>{typeLabel[p.type]}</td>
                      <td className="cell-wrap">{itemsLabel(p)}</td>
                      <td>{formatINR(p.paidAmount)}</td>
                      <td>{due > 0 ? formatINR(due) : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatINR(p.grandTotal)}</td>
                      <td>
                        <span
                          className={`chip ${p.paymentStatus === 'PAID' ? 'chip--live' : 'chip--warn'}`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="table-action">
                        <div className="table-actions">
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => openDoc('purchase', p.id)}>
                            <Printer size={12} /> {p.customer ? 'Voucher' : 'GRN'}
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm ${due > 0 ? 'btn--primary' : 'btn--ghost'}`}
                            onClick={() => openPurchase(p)}
                          >
                            {due > 0 ? 'Pay' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={Boolean(selected)}
        title={selected ? partyName(selected) : 'Purchase'}
        subtitle={
          selected
            ? `${typeLabel[selected.type]}${selected.customer ? ' · from customer' : ' · from vendor'}${
                selected.invoiceNo ? ` · Inv ${selected.invoiceNo}` : ''
              }`
            : undefined
        }
        onClose={closePurchase}
        wide
        footer={
          selected && Number(selected.creditAmount) > 0 ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={closePurchase}>
                Close
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={settle.isPending || !(Number(settleAmt) > 0)}
                onClick={() => settle.mutate(selected.id)}
              >
                {settle.isPending ? 'Settling…' : `Pay ${formatINR(Number(settleAmt) || 0)}`}
              </button>
            </>
          ) : selected ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => openDoc('purchase', selected.id)}>
                <Printer size={14} /> {selected.customer ? 'Voucher' : 'GRN'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={closePurchase}>
                Close
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="section-gap">
            <div className="detail-card is-selected">
              <div className="row-between">
                <strong>{partyName(selected)}</strong>
                <span
                  className={`chip ${selected.paymentStatus === 'PAID' ? 'chip--live' : 'chip--warn'}`}
                >
                  {selected.paymentStatus}
                </span>
              </div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                {new Date(selected.purchaseDate).toLocaleString('en-IN')}
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
                <span>Discount</span>
                <span>{formatINR(selected.discount)}</span>
              </div>
              <div className="totals-row">
                <span>Paid</span>
                <span>{formatINR(selected.paidAmount)}</span>
              </div>
              <div className="totals-row totals-row--grand">
                <span>Grand / credit</span>
                <span>
                  {formatINR(selected.grandTotal)}
                  {Number(selected.creditAmount) > 0
                    ? ` · ${formatINR(selected.creditAmount)} due`
                    : ''}
                </span>
              </div>
            </div>

            {Number(selected.creditAmount) > 0 ? (
              <div className="settle-box">
                <h3 className="section-title" style={{ fontSize: '0.95rem' }}>
                  Pay / settle credit
                </h3>
                <div className="purchase-fields">
                  <label>
                    Amount ₹
                    <input
                      type="number"
                      min={1}
                      value={settleAmt}
                      onChange={(e) => setSettleAmt(e.target.value)}
                    />
                  </label>
                  <label>
                    Mode
                    <ComboSelect
                      value={settleMode}
                      placeholder="Type mode…"
                      options={PAYMENT_MODES.filter((m) => m.id !== 'CREDIT')}
                      onChange={setSettleMode}
                    />
                  </label>
                </div>
                {settleError ? (
                  <p className="danger" style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)' }}>
                    {settleError}
                  </p>
                ) : null}
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
                    {selected.items.map((it) => (
                      <tr key={it.id}>
                        <td className="cell-wrap">
                          {it.product.name}
                          {it.product.ram || it.product.rom || it.product.spareGrade ? (
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {[it.product.ram, it.product.rom, it.product.spareGrade]
                                .filter(Boolean)
                                .join(' / ')}
                            </div>
                          ) : null}
                          {(it.phoneUnits || []).length ? (
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {(it.phoneUnits || []).map((u) => u.imei).join(', ')}
                            </div>
                          ) : null}
                        </td>
                        <td>{it.qty}</td>
                        <td>{formatINR(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {selected.payments?.length ? (
              <div>
                <h3 className="section-title" style={{ fontSize: '0.95rem' }}>
                  Payments
                </h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Mode</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.payments.map((pay) => (
                        <tr key={pay.id}>
                          <td>{new Date(pay.paidAt).toLocaleDateString('en-IN')}</td>
                          <td>{pay.mode}</td>
                          <td>{formatINR(pay.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
