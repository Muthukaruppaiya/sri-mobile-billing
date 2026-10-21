import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Customer, Purchase, Supplier } from '../lib/types'
import { formatINR, partyName } from '../lib/types'
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
  sales?: {
    count: number
    grandTotal: number
    cashInHand: number
    financeCount: number
    financeAmount: number
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
  }
}

const typeLabel: Record<string, string> = {
  NEW_MOBILE: 'New mobile',
  SPARES: 'Spares',
  USED_PHONE: 'Used phone',
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInput() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function ReportsPage() {
  const navigate = useNavigate()
  const [from, setFrom] = useState(monthStartInput)
  const [to, setTo] = useState(todayInput)

  const reportQ = useQuery({
    queryKey: ['reports', 'overview', from, to],
    queryFn: () =>
      api<Overview>(`/reports/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to + 'T23:59:59')}`),
  })

  const data = reportQ.data
  const byTypeRows = useMemo(() => Object.entries(data?.purchases.byType || {}), [data])

  return (
    <div className="section-gap">
      <PageHeader
        title="Reports"
        subtitle="Purchases, sales, finance logs & stock value"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat
          label="Purchase total"
          value={formatINR(data?.purchases.grandTotal ?? 0)}
          hint={`${data?.purchases.count ?? 0} bills`}
          tone="ok"
        />
        <MiniStat
          label="Paid out"
          value={formatINR(data?.purchases.paidTotal ?? 0)}
          tone="info"
        />
        <MiniStat
          label="Credit pending"
          value={formatINR(data?.credit.pendingAmount ?? 0)}
          hint={`${data?.credit.pendingBills ?? 0} open`}
          tone="warn"
          onClick={() => navigate('/app/history')}
        />
        <MiniStat
          label="Sales"
          value={formatINR(data?.sales?.grandTotal ?? 0)}
          hint={`${data?.sales?.count ?? 0} bills`}
          tone="ok"
          onClick={() => navigate('/app/billing/history')}
        />
        <MiniStat
          label="Finance remits shop"
          value={formatINR(data?.sales?.financeAmount ?? 0)}
          hint={`${data?.sales?.financeCount ?? 0} logs`}
          tone="info"
          onClick={() => navigate('/app/billing/history')}
        />
        <MiniStat
          label="Stock sell value"
          value={formatINR(data?.stock.stockSellValue ?? 0)}
          hint={`${data?.stock.phoneUnits ?? 0} phones`}
          onClick={() => navigate('/app/stock/products')}
        />
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
          <h2 className="section-title">Stock snapshot</h2>
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
              <span>Phone cost value</span>
              <span>{formatINR(data?.stock.phoneCostValue ?? 0)}</span>
            </div>
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
              Open purchase credit
            </h2>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/app/history')}>
              Settle
            </button>
          </div>
          {!data?.credit.bills.length ? (
            <div className="empty-state">No pending credit.</div>
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
                          {typeLabel[p.type] || p.type}
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

        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">Party balances</h2>
          <div className="section-gap">
            <div>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginBottom: 6 }}>
                Vendors
              </div>
              {!data?.credit.suppliers.length ? (
                <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                  No vendor credit
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <tbody>
                      {data.credit.suppliers.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{formatINR(s.creditBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginBottom: 6 }}>
                Customers (used buy-in due)
              </div>
              {!data?.credit.customers.length ? (
                <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                  No customer credit
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <tbody>
                      {data.credit.customers.map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{formatINR(c.creditBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
