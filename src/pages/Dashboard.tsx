import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, PackagePlus, ShoppingBag, Wrench } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatINR } from '../lib/types'
import { MiniStat, PageHeader, Panel } from '../components/ui'

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const valueQ = useQuery({
    queryKey: ['reports', 'stock-value'],
    queryFn: () =>
      api<{
        skuCount: number
        phoneUnits: number
        stockSellValue: number
        phoneCostValue: number
      }>('/reports/stock-value'),
  })

  const purchaseQ = useQuery({
    queryKey: ['reports', 'purchases-summary'],
    queryFn: () =>
      api<{
        count: number
        grandTotal: number
        creditTotal: number
      }>('/reports/purchases-summary'),
  })

  const overviewQ = useQuery({
    queryKey: ['reports', 'overview-today'],
    queryFn: () =>
      api<{
        sales: { count: number; grandTotal: number; financeAmount: number }
      }>('/reports/overview'),
  })

  return (
    <div className="section-gap">
      <PageHeader
        title={`Hi, ${user?.name?.split(' ')[0] || 'team'}`}
        subtitle="Purchase, sale, stock and service on your live shop database"
        action={
          <button className="btn btn--primary" onClick={() => navigate('/app/purchase/new')}>
            <PackagePlus size={18} /> New purchase
          </button>
        }
      />

      <div className="mini-stat-grid">
        <MiniStat
          label="Today purchases"
          value={String(purchaseQ.data?.count ?? '—')}
          hint={formatINR(purchaseQ.data?.grandTotal ?? 0)}
          tone="ok"
          onClick={() => navigate('/app/purchase/new')}
        />
        <MiniStat
          label="Today sales"
          value={String(overviewQ.data?.sales.count ?? '—')}
          hint={formatINR(overviewQ.data?.sales.grandTotal ?? 0)}
          tone="ok"
          onClick={() => navigate('/app/billing/new')}
        />
        <MiniStat
          label="Purchase credit"
          value={formatINR(purchaseQ.data?.creditTotal ?? 0)}
          tone="warn"
        />
        <MiniStat
          label="Stock sell value"
          value={formatINR(valueQ.data?.stockSellValue ?? 0)}
          onClick={() => navigate('/app/stock/products')}
        />
        <MiniStat
          label="Phone units"
          value={String(valueQ.data?.phoneUnits ?? '—')}
          tone="info"
          onClick={() => navigate('/app/stock/phones')}
        />
      </div>

      <Panel style={{ padding: 16 }}>
        <h2 className="section-title">Modules</h2>
        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          <button type="button" className="detail-card" style={{ textAlign: 'left' }} onClick={() => navigate('/app/purchase/new')}>
            <PackagePlus size={20} color="var(--brand)" />
            <div style={{ marginTop: 10, fontWeight: 600 }}>Purchase</div>
            <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
              New / spare / used <ArrowUpRight size={12} />
            </div>
          </button>
          <button type="button" className="detail-card" style={{ textAlign: 'left' }} onClick={() => navigate('/app/billing/new')}>
            <ShoppingBag size={20} color="var(--info)" />
            <div style={{ marginTop: 10, fontWeight: 600 }}>Sale</div>
            <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
              New / used · exchange <ArrowUpRight size={12} />
            </div>
          </button>
          <button type="button" className="detail-card" style={{ textAlign: 'left' }} onClick={() => navigate('/app/service/booking')}>
            <Wrench size={20} color="var(--accent)" />
            <div style={{ marginTop: 10, fontWeight: 600 }}>Service</div>
            <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
              Spares · labour · subcontract <ArrowUpRight size={12} />
            </div>
          </button>
        </div>
      </Panel>
    </div>
  )
}
