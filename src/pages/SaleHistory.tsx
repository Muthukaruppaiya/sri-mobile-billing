import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, ShoppingBag } from 'lucide-react'
import { api } from '../lib/api'
import type { Sale } from '../lib/types'
import { formatINR } from '../lib/types'
import { formatDateTime, PAYMENT_MODE_LABEL } from '../lib/format'
import { openDoc } from '../lib/print'
import { MiniStat, Modal, PageHeader, Panel } from '../components/ui'
import { ComboSelect, PAYMENT_MODES, SearchField } from '../components/SearchableSelect'
import { matchesQuery } from '../lib/search'
import { specSummary } from '../lib/productSpecs'

type Filter = 'ALL' | 'NEW_MOBILE' | 'USED_PHONE' | 'FINANCE' | 'DUE'

const typeLabel: Record<Sale['type'], string> = {
  NEW_MOBILE: 'New mobile',
  USED_PHONE: 'Used phone',
}

const PAY_MODES = PAYMENT_MODES.filter((m) => m.id !== 'CREDIT')

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

function statusChip(s: Sale) {
  if (s.hasFinance) return { cls: 'chip--info', label: 'Finance' }
  if (s.paymentStatus === 'PAID') return { cls: 'chip--live', label: 'Paid' }
  return { cls: 'chip--warn', label: s.paymentStatus === 'PARTIAL' ? 'Partly paid' : 'Credit' }
}

export function SaleHistoryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [payAmt, setPayAmt] = useState('')
  const [payMode, setPayMode] = useState('CASH')
  const [payError, setPayError] = useState('')
  const [payMsg, setPayMsg] = useState('')

  const salesQ = useQuery({
    queryKey: ['sales', 'history'],
    queryFn: () => api<Sale[]>('/sales'),
  })

  const all = useMemo(() => salesQ.data || [], [salesQ.data])

  const list = useMemo(() => {
    return all.filter((s) => {
      const fOk =
        filter === 'ALL' ||
        (filter === 'FINANCE'
          ? s.hasFinance
          : filter === 'DUE'
            ? Number(s.creditAmount) > 0
            : s.type === filter)
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
        s.notes,
        typeLabel[s.type],
        s.financePlan?.financierName,
        s.financePlan?.approvalRef,
        ...itemTerms,
      )
      return fOk && qOk
    })
  }, [all, filter, q])

  const selected = all.find((s) => s.id === selectedId) || null

  const receive = useMutation({
    mutationFn: (id: string) =>
      api<Sale>(`/sales/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(payAmt), mode: payMode }),
      }),
    onSuccess: (s) => {
      qc.setQueryData<Sale[]>(['sales', 'history'], (prev) => prev?.map((x) => (x.id === s.id ? s : x)))
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setPayMsg(`Received ${formatINR(Number(payAmt))}`)
      setPayAmt(Number(s.creditAmount) > 0 ? String(Number(s.creditAmount)) : '')
      setPayError('')
    },
    onError: (e: Error) => setPayError(e.message),
  })

  function openSale(s: Sale) {
    setSelectedId(s.id)
    setPayAmt(Number(s.creditAmount) > 0 ? String(Number(s.creditAmount)) : '')
    setPayMode('CASH')
    setPayError('')
    setPayMsg('')
  }

  const financed = all.filter((s) => s.hasFinance)
  const financeTotal = financed.reduce((sum, s) => sum + Number(s.financePlan?.financedAmount || 0), 0)
  const grandTotal = all.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0)
  const dueBills = all.filter((s) => Number(s.creditAmount) > 0)
  const dueTotal = dueBills.reduce((sum, s) => sum + Number(s.creditAmount), 0)

  const exchangeTotal = (selected?.exchanges || []).reduce((sum, ex) => sum + Number(ex.agreedValue || 0), 0)
  const itemsTotal = (selected?.items || []).reduce((sum, it) => sum + Number(it.lineTotal || 0), 0)
  const otherDiscount = selected ? Math.max(Number(selected.discount) - exchangeTotal, 0) : 0

  return (
    <div className="section-gap">
      <PageHeader
        title="Sale history"
        subtitle="Invoices · finance logs · collect pending credit"
        action={
          <button type="button" className="btn btn--primary" onClick={() => navigate('/app/billing/new')}>
            <ShoppingBag size={18} /> New sale
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat label="Sales" value={String(salesQ.data?.length ?? '—')} hint={formatINR(grandTotal)} tone="ok" onClick={() => setFilter('ALL')} />
        <MiniStat
          label="Credit due"
          value={formatINR(dueTotal)}
          hint={`${dueBills.length} bills`}
          tone="warn"
          onClick={() => setFilter('DUE')}
        />
        <MiniStat
          label="Finance logs"
          value={String(financed.length)}
          hint={formatINR(financeTotal)}
          tone="info"
          onClick={() => setFilter('FINANCE')}
        />
        <MiniStat
          label="New / used"
          value={`${all.filter((s) => s.type === 'NEW_MOBILE').length} / ${all.filter((s) => s.type === 'USED_PHONE').length}`}
        />
      </div>

      <Panel style={{ padding: 16 }}>
        <div className="search-toolbar">
          <SearchField value={q} onChange={setQ} placeholder="Search invoice, customer, IMEI, brand, financier…" />
        </div>

        <div className="filter-tabs" style={{ marginBottom: 12 }}>
          {(
            [
              ['ALL', 'All'],
              ['NEW_MOBILE', 'New'],
              ['USED_PHONE', 'Used'],
              ['DUE', 'Credit due'],
              ['FINANCE', 'Finance log'],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`filter-tab${filter === id ? ' is-active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {salesQ.isLoading ? (
          <div className="empty-state">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">{q || filter !== 'ALL' ? 'No sales match.' : 'No sales yet.'}</div>
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
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const chip = statusChip(s)
                  const due = Number(s.creditAmount) || 0
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(s.saleDate).toLocaleDateString('en-IN')}
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {new Date(s.saleDate).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {s.invoiceNo || s.id.slice(-6).toUpperCase()}
                      </td>
                      <td>
                        <div>{s.customer?.name || 'Walk-in'}</div>
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {s.customer?.phone || ''}
                        </div>
                      </td>
                      <td>
                        {typeLabel[s.type]}
                        {s.hasExchange ? (
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            + exchange
                          </div>
                        ) : null}
                      </td>
                      <td className="cell-wrap">{itemsLabel(s)}</td>
                      <td style={{ fontWeight: 600 }}>{formatINR(s.grandTotal)}</td>
                      <td>{formatINR(s.paidAmount)}</td>
                      <td>{due > 0 ? <strong className="danger">{formatINR(due)}</strong> : '—'}</td>
                      <td>
                        <span className={`chip ${chip.cls}`}>{chip.label}</span>
                      </td>
                      <td className="table-action">
                        <div className="table-actions">
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => openDoc('sale', s.id)}>
                            <Printer size={12} /> Invoice
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm ${due > 0 ? 'btn--primary' : 'btn--ghost'}`}
                            onClick={() => openSale(s)}
                          >
                            {due > 0 ? 'Receive' : 'Details'}
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
        title={selected ? `Invoice ${selected.invoiceNo || selected.id.slice(-6).toUpperCase()}` : 'Sale'}
        subtitle={
          selected
            ? `${selected.customer?.name || 'Walk-in'}${selected.customer?.phone ? ` · ${selected.customer.phone}` : ''} · ${
                typeLabel[selected.type]
              }`
            : undefined
        }
        onClose={() => setSelectedId(null)}
        wide
        footer={
          selected ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedId(null)}>
                Close
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => openDoc('sale', selected.id)}>
                <Printer size={14} /> Invoice
              </button>
              {Number(selected.creditAmount) > 0 ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={receive.isPending || !(Number(payAmt) > 0)}
                  onClick={() => receive.mutate(selected.id)}
                >
                  {receive.isPending ? 'Saving…' : `Receive ${formatINR(Number(payAmt) || 0)}`}
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="section-gap">
            <div className="detail-card is-selected">
              <div className="row-between">
                <strong>{selected.customer?.name || 'Walk-in'}</strong>
                <span className={`chip ${statusChip(selected).cls}`}>{statusChip(selected).label}</span>
              </div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                {formatDateTime(selected.saleDate)}
                {selected.createdBy ? ` · billed by ${selected.createdBy.name}` : ''}
              </p>
            </div>

            {payMsg ? <p className="settings-toast settings-toast--ok">{payMsg}</p> : null}

            {Number(selected.creditAmount) > 0 ? (
              <div className="settle-box">
                <h3 className="section-title" style={{ fontSize: '0.95rem' }}>
                  Receive pending {formatINR(selected.creditAmount)}
                </h3>
                <div className="purchase-fields">
                  <label>
                    Amount ₹
                    <input
                      type="number"
                      min={1}
                      max={Number(selected.creditAmount)}
                      value={payAmt}
                      onChange={(e) => setPayAmt(e.target.value)}
                    />
                  </label>
                  <label>
                    Mode
                    <ComboSelect value={payMode} placeholder="Mode" options={PAY_MODES} onChange={(v) => setPayMode(v || 'CASH')} />
                  </label>
                </div>
                {payError ? (
                  <p className="danger" style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)' }}>
                    {payError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="totals-box">
              <div className="totals-row">
                <span>Items total</span>
                <span>{formatINR(itemsTotal)}</span>
              </div>
              {exchangeTotal > 0 ? (
                <div className="totals-row">
                  <span>Less exchange</span>
                  <span>− {formatINR(exchangeTotal)}</span>
                </div>
              ) : null}
              {otherDiscount > 0 ? (
                <div className="totals-row">
                  <span>Less discount</span>
                  <span>− {formatINR(otherDiscount)}</span>
                </div>
              ) : null}
              <div className="totals-row totals-row--grand">
                <span>Net amount</span>
                <span>{formatINR(selected.grandTotal)}</span>
              </div>
              <div className="totals-row">
                <span className="muted">Taxable · GST included</span>
                <span className="muted">
                  {formatINR(selected.subtotal)} · {formatINR(selected.tax)}
                </span>
              </div>
              <div className="totals-row">
                <span>Paid</span>
                <span>{formatINR(selected.paidAmount)}</span>
              </div>
              {selected.financePlan ? (
                <div className="totals-row">
                  <span>Finance pays shop</span>
                  <span>{formatINR(selected.financePlan.financedAmount)}</span>
                </div>
              ) : null}
              <div className="totals-row totals-row--grand">
                <span>Balance due</span>
                <span className={Number(selected.creditAmount) > 0 ? 'danger' : ''}>
                  {formatINR(selected.creditAmount)}
                </span>
              </div>
            </div>

            {selected.financePlan ? (
              <div className="settle-box">
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                  <strong>{selected.financePlan.financierName}</strong> remits{' '}
                  {formatINR(selected.financePlan.financedAmount)} to the shop.
                  {selected.financePlan.approvalRef ? ` Ref ${selected.financePlan.approvalRef}.` : ''}
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
                      <th>Amount</th>
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
                              {[it.phoneUnit?.imei ? `IMEI ${it.phoneUnit.imei}` : '', specs].filter(Boolean).join(' · ') ||
                                product?.sku}
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

            {selected.payments?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Payment date</th>
                      <th>Mode</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {formatDateTime(p.paidAt)}
                          {p.note ? (
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {p.note}
                            </div>
                          ) : null}
                        </td>
                        <td>{PAYMENT_MODE_LABEL[p.mode] || p.mode}</td>
                        <td>{formatINR(p.amount)}</td>
                      </tr>
                    ))}
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
