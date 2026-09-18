import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, History, IndianRupee, LayoutDashboard, PackageMinus, Receipt, Smartphone, Truck, Users, Wrench } from 'lucide-react'
import {
  formatINR,
  products,
  recentBills,
  serviceJobs,
  todayDeliveries,
  todayDeliveryCount,
} from '../data/mock'
import { MiniStat, PageHeader, Panel } from '../components/ui'

const stats = [
  {
    label: 'Deliver today',
    value: String(todayDeliveryCount).padStart(2, '0'),
    hint: `${todayDeliveries.filter((j) => j.status === 'Ready').length} ready · ${todayDeliveries.filter((j) => j.status !== 'Ready').length} in workshop`,
    accent: 'var(--accent)',
    path: '/app/service',
  },
  {
    label: "Today's sales",
    value: '₹48,240',
    hint: '12 sale bills',
    accent: 'var(--brand-deep)',
    path: '/app/history',
  },
  {
    label: 'Service open',
    value: String(serviceJobs.filter((j) => j.status !== 'Delivered').length).padStart(2, '0'),
    hint: 'Active tickets',
    accent: 'var(--info)',
    path: '/app/service',
  },
  {
    label: 'Pending pay',
    value: '₹6,420',
    hint: '2 invoices',
    accent: 'var(--danger)',
    path: '/app/history',
  },
]

const actions = [
  { label: 'Sale bill', hint: 'Customer → items → pay', icon: Receipt, path: '/app/billing', color: 'var(--brand)' },
  {
    label: 'Service bill',
    hint: 'Intake bill + delivery bill',
    icon: Wrench,
    path: '/app/service',
    color: 'var(--info)',
  },
  {
    label: 'Stock update',
    hint: 'In / out / add product',
    icon: PackageMinus,
    path: '/app/stock',
    color: 'var(--accent)',
  },
  { label: 'Customers', hint: 'Save & reuse contacts', icon: Users, path: '/app/customers', color: 'var(--brand-deep)' },
  { label: 'Bills history', hint: 'Search & collect due', icon: History, path: '/app/history', color: 'var(--text-muted)' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const lowStock = products.filter((p) => p.stock <= p.lowAt)
  const readyToday = todayDeliveries.filter((j) => j.status === 'Ready')
  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0)

  return (
    <div className="section-gap">
      <PageHeader
        title="Good evening"
        subtitle={`${todayDeliveryCount} mobile${todayDeliveryCount === 1 ? '' : 's'} to deliver today`}
        icon={LayoutDashboard}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn--accent" onClick={() => navigate('/app/service')}>
              <Smartphone size={18} /> Deliveries
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/app/billing')}>
              <Receipt size={18} /> New bill
            </button>
          </div>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat
          label="Deliver today"
          value={String(todayDeliveryCount).padStart(2, '0')}
          hint={`${readyToday.length} ready`}
          tone="warn"
          icon={Truck}
          onClick={() => navigate('/app/service')}
        />
        <MiniStat
          label="Low stock"
          value={String(lowStock.length).padStart(2, '0')}
          hint="Reorder soon"
          tone="warn"
          icon={PackageMinus}
          onClick={() => navigate('/app/stock')}
        />
        <MiniStat
          label="Stock value"
          value={formatINR(stockValue)}
          tone="ok"
          icon={IndianRupee}
          onClick={() => navigate('/app/stock')}
        />
        <MiniStat
          label="Open jobs"
          value={String(serviceJobs.filter((j) => j.status !== 'Delivered').length).padStart(2, '0')}
          tone="info"
          icon={Wrench}
          onClick={() => navigate('/app/service')}
        />
      </div>

      <Panel style={{ padding: 16 }} delay={0.02}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              <Smartphone size={18} /> Today — mobiles to deliver
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
              {todayDeliveryCount} phones due · {readyToday.length} ready for billing & handover
            </p>
          </div>
            <button
            type="button"
            className="btn btn--accent"
            style={{ padding: '8px 12px' }}
            onClick={() => navigate('/app/service')}
          >
            <Truck size={16} /> Delivery
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          {todayDeliveries.map((j, i) => (
            <motion.button
              key={j.id}
              type="button"
              className="detail-card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              onClick={() => navigate('/app/service')}
            >
              <div className="row-between">
                <strong style={{ fontSize: 'var(--fs-sm)' }}>{j.device}</strong>
                <span className={`chip ${j.status === 'Ready' ? 'chip--live' : 'chip--warn'}`}>
                  {j.status === 'Ready' ? <Smartphone size={12} /> : <Wrench size={12} />}
                  {j.status}
                </span>
              </div>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-xs)' }}>
                {j.ticket} · {j.customer}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                Collect {formatINR(Math.max(j.estimate - j.advance, 0))}
              </p>
            </motion.button>
          ))}
        </div>
      </Panel>

      <div className="grid-stats">
        {stats.map((s, i) => (
          <Panel key={s.label} className="stat-card" delay={0.08 + i * 0.05} style={{ cursor: 'pointer', padding: 0 }}>
            <button
              type="button"
              onClick={() => navigate(s.path)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'block',
                width: '100%',
                padding: 16,
                boxSizing: 'border-box',
              }}
            >
              <p className="stat-card__label">{s.label}</p>
              <p className="stat-card__value" style={{ color: s.accent }}>
                {s.value}
              </p>
              <p className="stat-card__hint">{s.hint}</p>
            </button>
          </Panel>
        ))}
      </div>

      <Panel style={{ padding: 16 }} delay={0.2}>
            <h2 className="section-title">
              <Receipt size={18} /> Start a flow
            </h2>
        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          }}
        >
          {actions.map((a, i) => (
            <motion.button
              key={a.label}
              type="button"
              className="detail-card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.04 }}
              onClick={() => navigate(a.path)}
            >
              <a.icon size={20} color={a.color} />
              <div style={{ marginTop: 10, fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{a.label}</div>
              <div
                className="muted"
                style={{ fontSize: 'var(--fs-xs)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {a.hint} <ArrowUpRight size={12} />
              </div>
            </motion.button>
          ))}
        </div>
      </Panel>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <Panel style={{ padding: 16 }} delay={0.25}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              <History size={18} /> Recent bills
            </h2>
            <button className="btn btn--ghost" style={{ padding: '6px 10px' }} onClick={() => navigate('/app/history')} aria-label="All bills">
              <History size={14} />
            </button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBills.slice(0, 4).map((b) => (
                  <tr key={b.id} className="click-row" onClick={() => navigate('/app/history')}>
                    <td>{b.no}</td>
                    <td>{b.customer}</td>
                    <td>{formatINR(b.amount)}</td>
                    <td>
                      <span className={`chip ${b.status === 'Paid' ? 'chip--live' : 'chip--warn'}`}>
                        {b.status === 'Paid' ? <Receipt size={12} /> : null}
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel style={{ padding: 16 }} delay={0.3} dashed>
          <div className="row-between">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              <PackageMinus size={18} /> Low stock
            </h2>
            <button className="btn btn--ghost" style={{ padding: '6px 10px' }} onClick={() => navigate('/app/stock')} aria-label="Restock">
              <PackageMinus size={14} />
            </button>
          </div>
          <div className="product-grid" style={{ marginTop: 12 }}>
            {lowStock.slice(0, 4).map((p) => (
              <button key={p.id} type="button" className="product-tile" onClick={() => navigate('/app/stock')}>
                <p className="product-tile__name">{p.name}</p>
                <p className="product-tile__meta">{p.sku}</p>
                <p className="product-tile__price" style={{ color: 'var(--accent)' }}>
                  Qty {p.stock}
                </p>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
