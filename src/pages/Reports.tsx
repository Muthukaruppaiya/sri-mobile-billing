import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Customer, Purchase, Sale, Supplier } from '../lib/types'
import { formatINR, partyName } from '../lib/types'
import { dayRangeIso, localDateInput, monthStartInput, PAYMENT_MODE_LABEL } from '../lib/format'
import { useAuth } from '../lib/auth'
import { MiniStat, PageHeader, Panel } from '../components/ui'

type Overview = {
  from: string
  to: string
  purchases: {
    count: number
    grandTotal: number
    paidTotal: number
    creditTotal: number
    byType: Record<string, { count: number; total: number; credit: number }>
    recent: Purchase[]
  }
  sales: {
    count: number
    grandTotal: number
    cashInHand: number
    financeCount: number
    financeAmount: number
    creditTotal: number
  }
  service: {
    booked: number
    delivered: number
    revenue: number
    margin: number
    open: number
    ready: number
  }
  cashbook: {
    in: Record<string, number>
    out: Record<string, number>
    totalIn: number
    totalOut: number
    net: number
  }
  stock: {
    skuCount: number
    phoneUnits: number
    stockSellValue: number
    phoneCostValue: number
    lowStock: number
  }
  credit: {
    pendingBills: number
    pendingAmount: number
    bills: Purchase[]
    suppliers: Supplier[]
    customers: Customer[]
    customersPayable: Customer[]
    saleBills: Sale[]
    receivableAmount: number
  }
}

const typeLabel: Record<string, string> = {
  NEW_MOBILE: 'New mobile',
  SPARES: 'Spares',
  USED_PHONE: 'Used phone',
}

const MODES = ['CASH', 'UPI', 'CARD', 'BANK']

export function ReportsPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [from, setFrom] = useState(monthStartInput)
  const [to, setTo] = useState(() => localDateInput())

  const range = useMemo(() => dayRangeIso(from, to), [from, to])

  const reportQ = useQuery({
    queryKey: ['reports', 'overview', range.from, range.to],
    queryFn: () =>
      api<Overview>(
        `/reports/overview?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  })

  const data = reportQ.data
  const byTypeRows = useMemo(() => Object.entries(data?.purchases.byType || {}), [data])

  function setPreset(kind: 'today' | 'month' | 'last30') {
    const today = localDateInput()
    if (kind === 'today') {
      setFrom(today)
      setTo(today)
    } else if (kind === 'month') {
      setFrom(monthStartInput())
      setTo(today)
    } else {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      setFrom(localDateInput(d))
      setTo(today)
    }
  }

  return (
    <div className="section-gap">
      <PageHeader
        title="Reports"
        subtitle="Sales, service, purchases, cash collected and who owes what"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>From</label>
              <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>To</label>
              <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
            </div>
            <div className="mode-tabs" style={{ alignSelf: 'end' }}>
              <button type="button" className="mode-tab" onClick={() => setPreset('today')}>
                Today
              </button>
              <button type="button" className="mode-tab" onClick={() => setPreset('month')}>
                This month
              </button>
              <button type="button" className="mode-tab" onClick={() => setPreset('last30')}>
                30 days
              </button>
            </div>
          </div>
        }
      />

      {reportQ.error ? <p className="form-error">{(reportQ.error as Error).message}</p> : null}

      <div className="mini-stat-grid">
        <MiniStat
          label="Sales"
          value={formatINR(data?.sales.grandTotal ?? 0)}
          hint={`${data?.sales.count ?? 0} bills`}
          tone="ok"
          onClick={() => navigate('/app/billing/history')}
        />
        <MiniStat
          label="Service delivered"
          value={formatINR(data?.service.revenue ?? 0)}
          hint={`${data?.service.delivered ?? 0} tickets · ${data?.service.booked ?? 0} booked`}
          tone="ok"
          onClick={() => navigate('/app/service/tickets')}
        />
        <MiniStat
          label="Purchases"
          value={formatINR(data?.purchases.grandTotal ?? 0)}
          hint={`${data?.purchases.count ?? 0} bills`}
          tone="info"
          onClick={() => navigate('/app/history')}
        />
        <MiniStat
          label="Net cash in"
          value={formatINR(data?.cashbook.net ?? 0)}
          hint={`In ${formatINR(data?.cashbook.totalIn ?? 0)} · out ${formatINR(data?.cashbook.totalOut ?? 0)}`}
          tone={(data?.cashbook.net ?? 0) >= 0 ? 'ok' : 'warn'}
        />
        <MiniStat
          label="Customers owe shop"
          value={formatINR(data?.credit.receivableAmount ?? 0)}
          hint={`${data?.credit.customers.length ?? 0} customers`}
          tone="warn"
          onClick={() => navigate('/app/customers')}
        />
        <MiniStat
          label="Shop owes vendors"
          value={formatINR(data?.credit.pendingAmount ?? 0)}
          hint={`${data?.credit.pendingBills ?? 0} bills`}
          tone="warn"
          onClick={() => navigate('/app/history')}
        />
      </div>

      <div className="history-layout">
        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">Cash book (payments in range)</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Received</th>
                  <th>Paid out</th>
                </tr>
              </thead>
              <tbody>
                {MODES.map((m) => (
                  <tr key={m}>
                    <td>{PAYMENT_MODE_LABEL[m]}</td>
                    <td>{formatINR(data?.cashbook.in[m] ?? 0)}</td>
                    <td>{formatINR(data?.cashbook.out[m] ?? 0)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ fontWeight: 700 }}>{formatINR(data?.cashbook.totalIn ?? 0)}</td>
                  <td style={{ fontWeight: 700 }}>{formatINR(data?.cashbook.totalOut ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="form-hint" style={{ marginTop: 8 }}>
            Received = sale + service payments. Paid out = purchase payments and service refunds.
          </p>
        </Panel>

        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">Sales & service</h2>
          <div className="totals-box">
            <div className="totals-row">
              <span>Sales billed</span>
              <span>{formatINR(data?.sales.grandTotal ?? 0)}</span>
            </div>
            <div className="totals-row">
              <span>Paid so far on these bills</span>
              <span>{formatINR(data?.sales.cashInHand ?? 0)}</span>
            </div>
            <div className="totals-row">
              <span>Finance remits shop</span>
              <span>
                {formatINR(data?.sales.financeAmount ?? 0)} ({data?.sales.financeCount ?? 0})
              </span>
            </div>
            <div className="totals-row">
              <span>Sales left on credit</span>
              <span>{formatINR(data?.sales.creditTotal ?? 0)}</span>
            </div>
            <div className="totals-row totals-row--grand">
              <span>Service revenue</span>
              <span>{formatINR(data?.service.revenue ?? 0)}</span>
            </div>
            {isAdmin ? (
              <div className="totals-row">
                <span>Service margin</span>
                <span>{formatINR(data?.service.margin ?? 0)}</span>
              </div>
            ) : null}
            <div className="totals-row">
              <span>Tickets open / ready now</span>
              <span>
                {data?.service.open ?? 0} / {data?.service.ready ?? 0}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="history-layout">
        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">By purchase type</h2>
          {reportQ.isLoading ? (
            <div className="empty-state">Loading…</div>
          ) : byTypeRows.length === 0 ? (
            <div className="empty-state">No purchases in this range.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Bills</th>
                    <th>Total</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {byTypeRows.map(([type, row]) => (
                    <tr key={type}>
                      <td>{typeLabel[type] || type}</td>
                      <td>{row.count}</td>
                      <td>{formatINR(row.total)}</td>
                      <td>{formatINR(row.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">Stock snapshot (now)</h2>
          <div className="totals-box">
            <div className="totals-row">
              <span>SKUs</span>
              <span>{data?.stock.skuCount ?? '—'}</span>
            </div>
            <div className="totals-row">
              <span>Phone units</span>
              <span>{data?.stock.phoneUnits ?? '—'}</span>
            </div>
            <div className="totals-row">
              <span>Stock sell value</span>
              <span>{formatINR(data?.stock.stockSellValue ?? 0)}</span>
            </div>
            {isAdmin ? (
              <div className="totals-row">
                <span>Phone cost value</span>
                <span>{formatINR(data?.stock.phoneCostValue ?? 0)}</span>
              </div>
            ) : null}
            <div className="totals-row totals-row--grand">
              <span>Low stock SKUs</span>
              <span>{data?.stock.lowStock ?? 0}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="history-layout">
        <Panel style={{ padding: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Customers who owe the shop
            </h2>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/app/billing/history')}>
              Collect
            </button>
          </div>
          {!data?.credit.saleBills.length && !data?.credit.customers.length ? (
            <div className="empty-state">Nobody owes the shop.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.credit.customers.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.phone || '—'}</td>
                      <td className="danger">{formatINR(c.creditBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel style={{ padding: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Shop owes
            </h2>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/app/history')}>
              Settle
            </button>
          </div>
          {!data?.credit.bills.length ? (
            <div className="empty-state">No pending purchase credit.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Party</th>
                    <th>Date</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.credit.bills.map((p) => (
                    <tr key={p.id} className="click-row" onClick={() => navigate('/app/history')}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{partyName(p)}</div>
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {p.customer ? 'Customer buy-in' : 'Vendor'} · {typeLabel[p.type] || p.type}
                        </div>
                      </td>
                      <td>{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                      <td>{formatINR(p.creditAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
