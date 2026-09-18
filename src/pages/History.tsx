import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, CheckCircle2, Clock, History, MessageCircle, Printer, Receipt, Search, Wrench } from 'lucide-react'
import { formatINR, recentBills } from '../data/mock'
import { MiniStat, PageHeader, Panel } from '../components/ui'

type Filter = 'All' | 'Sale' | 'Service' | 'Pending'

export function HistoryPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('All')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(recentBills[0]?.id ?? null)
  const [collectAmt, setCollectAmt] = useState('')

  const list = useMemo(() => {
    return recentBills.filter((b) => {
      const fOk =
        filter === 'All' ||
        (filter === 'Pending' ? b.status !== 'Paid' : b.type === filter)
      const qq = q.trim().toLowerCase()
      const qOk =
        !qq ||
        b.no.toLowerCase().includes(qq) ||
        b.customer.toLowerCase().includes(qq) ||
        b.phone.includes(qq)
      return fOk && qOk
    })
  }, [filter, q])

  const selected = recentBills.find((b) => b.id === selectedId) ?? list[0]
  const pendingCount = recentBills.filter((b) => b.status !== 'Paid').length
  const pendingAmt = recentBills
    .filter((b) => b.status !== 'Paid')
    .reduce((s, b) => s + (b.amount - b.paid), 0)
  const saleCount = recentBills.filter((b) => b.type === 'Sale').length
  const serviceCount = recentBills.filter((b) => b.type === 'Service').length

  return (
    <div className="section-gap">
      <PageHeader
        title="Bills history"
        subtitle="Search · filter · collect balance · print"
        icon={History}
        action={
          <button type="button" className="btn btn--primary" onClick={() => navigate('/app/billing')}>
            <Receipt size={16} /> New sale
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat label="Today bills" value={String(recentBills.length)} hint="Sale + service" tone="ok" icon={Receipt} />
        <MiniStat label="Sale bills" value={String(saleCount)} onClick={() => setFilter('Sale')} icon={Receipt} />
        <MiniStat label="Service bills" value={String(serviceCount)} tone="info" onClick={() => setFilter('Service')} icon={Wrench} />
        <MiniStat
          label="Pending collect"
          value={formatINR(pendingAmt)}
          hint={`${pendingCount} invoices`}
          tone="warn"
          onClick={() => setFilter('Pending')}
          icon={Banknote}
        />
      </div>

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
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Bill no / customer / phone"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['All', 'Sale', 'Service', 'Pending'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`chip ${filter === f ? 'chip--live' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="empty-state">No bills match this filter.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => (
                    <tr
                      key={b.id}
                      className="click-row"
                      onClick={() => {
                        setSelectedId(b.id)
                        setCollectAmt(String(Math.max(b.amount - b.paid, 0)))
                      }}
                      style={{
                        background: selected?.id === b.id ? 'rgba(14,168,122,0.06)' : undefined,
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.no}</div>
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {b.type} · {b.time}
                        </div>
                      </td>
                      <td>{b.customer}</td>
                      <td>{formatINR(b.amount)}</td>
                      <td>
                        <span className={`chip ${b.status === 'Paid' ? 'chip--live' : 'chip--warn'}`}>
                          {b.status === 'Paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel style={{ padding: 16 }} delay={0.1}>
          <h2 className="section-title">
            <Receipt size={18} /> Bill detail
          </h2>
          {selected ? (
            <div className="section-gap">
              <div className="detail-card is-selected">
                <div className="row-between">
                  <strong>{selected.no}</strong>
                  <span className={`chip ${selected.status === 'Paid' ? 'chip--live' : 'chip--warn'}`}>
                    {selected.status === 'Paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {selected.status}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)' }}>
                  {selected.customer} · {selected.phone}
                </p>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                  {selected.date} · {selected.time} · {selected.type} · {selected.payment}
                </p>
              </div>

              <div className="totals-box">
                <div className="totals-row">
                  <span>Bill amount</span>
                  <span>{formatINR(selected.amount)}</span>
                </div>
                <div className="totals-row">
                  <span>Paid</span>
                  <span>{formatINR(selected.paid)}</span>
                </div>
                <div className="totals-row totals-row--grand">
                  <span>Balance</span>
                  <span>{formatINR(selected.amount - selected.paid)}</span>
                </div>
              </div>

              {selected.amount - selected.paid > 0 ? (
                <div className="field">
                  <label>Collect balance ₹</label>
                  <input
                    value={collectAmt}
                    onChange={(e) => setCollectAmt(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: 8 }}>
                <button type="button" className="btn btn--primary btn--block">
                  <Printer size={16} /> Print / PDF
                </button>
                <button type="button" className="btn btn--ghost btn--block">
                  <MessageCircle size={16} /> Share WhatsApp
                </button>
                {selected.amount - selected.paid > 0 ? (
                  <button type="button" className="btn btn--accent btn--block">
                    <Banknote size={16} /> Collect {formatINR(Number(collectAmt) || 0)}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-state">No bill selected</div>
          )}
        </Panel>
      </div>
    </div>
  )
}
