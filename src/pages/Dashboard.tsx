import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ClipboardList, PackagePlus, ShoppingBag, Wrench } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatINR } from '../lib/types'
import { dayRangeIso, localDateInput } from '../lib/format'
import { MiniStat, PageHeader, Panel } from '../components/ui'

type TodayOverview = {
  purchases: { count: number; grandTotal: number }
  sales: { count: number; grandTotal: number; financeAmount: number }
  service: { booked: number; delivered: number; revenue: number; open: number; ready: number }
  cashbook: { totalIn: number; totalOut: number; net: number }
  stock: { phoneUnits: number; stockSellValue: number; lowStock: number }
  credit: { pendingAmount: number; receivableAmount: number }
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = localDateInput()
  const range = useMemo(() => dayRangeIso(today, today), [today])

  const overviewQ = useQuery({
    queryKey: ['reports', 'overview', range.from, range.to],
    queryFn: () =>
      api<TodayOverview>(
        `/reports/overview?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  })
  const d = overviewQ.data

  const modules = [
    { to: '/app/billing/new', icon: ShoppingBag, color: 'var(--info)', title: 'Sale', hint: 'New / used · exchange · finance' },
    { to: '/app/service/booking', icon: Wrench, color: 'var(--accent)', title: 'Service booking', hint: 'Job card + advance' },
    { to: '/app/service/tickets', icon: ClipboardList, color: 'var(--brand)', title: 'Service tickets', hint: 'Work · deliver · balance' },
    { to: '/app/purchase/new', icon: PackagePlus, color: 'var(--brand)', title: 'Purchase', hint: 'New / spare / used' },
  ]

  return (
    <div className="section-gap">
      <PageHeader
        title={`Hi, ${user?.name?.split(' ')[0] || 'team'}`}
        subtitle={`Today · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        action={
          <button className="btn btn--primary" onClick={() => navigate('/app/billing/new')}>
            <ShoppingBag size={18} /> New sale
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat
          label="Today sales"
          value={formatINR(d?.sales.grandTotal ?? 0)}
          hint={`${d?.sales.count ?? 0} bills`}
          tone="ok"
          onClick={() => navigate('/app/billing/history')}
        />
        <MiniStat
          label="Today cash in"
          value={formatINR(d?.cashbook.totalIn ?? 0)}
          hint={`Paid out ${formatINR(d?.cashbook.totalOut ?? 0)}`}
          tone="info"
          onClick={() => navigate('/app/reports')}
        />
        <MiniStat
          label="Service in shop"
          value={String(d?.service.open ?? '—')}
          hint={`${d?.service.booked ?? 0} booked today`}
          tone="info"
          onClick={() => navigate('/app/service/tickets')}
        />
        <MiniStat
          label="Ready to deliver"
          value={String(d?.service.ready ?? '—')}
          tone="ok"
          onClick={() => navigate('/app/service/delivery')}
        />
        <MiniStat
          label="Customers owe"
          value={formatINR(d?.credit.receivableAmount ?? 0)}
          tone="warn"
          onClick={() => navigate('/app/customers')}
        />
        <MiniStat
          label="Phones in stock"
          value={String(d?.stock.phoneUnits ?? '—')}
          hint={d?.stock.lowStock ? `${d.stock.lowStock} SKUs low` : undefined}
          onClick={() => navigate('/app/stock/phones')}
        />
      </div>

      <Panel style={{ padding: 16 }}>
        <h2 className="section-title">Quick start</h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {modules.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.to}
                type="button"
                className="detail-card"
                style={{ textAlign: 'left' }}
                onClick={() => navigate(m.to)}
              >
                <Icon size={20} color={m.color} />
                <div style={{ marginTop: 10, fontWeight: 600 }}>{m.title}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                  {m.hint} <ArrowUpRight size={12} />
                </div>
              </button>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
