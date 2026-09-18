import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MapPin, Phone, Receipt, Search, UserPlus, Users, Wrench } from 'lucide-react'
import { customers } from '../data/mock'
import {
  FlowStepper,
  FormActions,
  MiniStat,
  PageHeader,
  Panel,
  SuccessBanner,
} from '../components/ui'

const STEPS = ['Details', 'Confirm']

export function CustomersPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [step, setStep] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? '')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    altPhone: '',
    city: '',
    address: '',
    email: '',
    notes: '',
  })

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(qq) ||
        c.phone.includes(qq) ||
        c.city.toLowerCase().includes(qq),
    )
  }, [q])

  const selected = customers.find((c) => c.id === selectedId) ?? list[0]
  const activeCustomers = customers.filter((c) => c.id !== 'c5').length

  const finish = () => {
    setDone(form.name)
    setStep(null)
    setForm({ name: '', phone: '', altPhone: '', city: '', address: '', email: '', notes: '' })
  }

  return (
    <div className="section-gap">
      <PageHeader
        title="Customers"
        subtitle="Directory for sale & service billing"
        icon={Users}
        action={
          step === null ? (
            <button type="button" className="btn btn--primary" onClick={() => setStep(0)}>
              <UserPlus size={16} /> Add customer
            </button>
          ) : undefined
        }
      />

      <AnimatePresence>
        {done ? (
          <SuccessBanner
            title="Customer saved"
            detail={`${done} is ready to pick in billing`}
            onClose={() => setDone(null)}
          />
        ) : null}
      </AnimatePresence>

      {step !== null ? (
        <Panel style={{ padding: 16 }} delay={0.05}>
          <FlowStepper steps={STEPS} current={step} />
          {step === 0 && (
            <div>
              <h2 className="section-title">Customer details</h2>
              <div className="form-grid form-grid--2">
                <div className="field">
                  <label>Full name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Mobile *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    inputMode="tel"
                  />
                </div>
                <div className="field">
                  <label>Alternate phone</label>
                  <input
                    value={form.altPhone}
                    onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
                    inputMode="tel"
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="optional"
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="field span-2">
                  <label>Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="field span-2">
                  <label>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Preferred model, warranty reminders…"
                  />
                </div>
              </div>
              <FormActions
                onBack={() => setStep(null)}
                backLabel="Cancel"
                onNext={() => setStep(1)}
                nextDisabled={!form.name.trim() || !form.phone.trim()}
              />
            </div>
          )}
          {step === 1 && (
            <div>
              <h2 className="section-title">Confirm</h2>
              <div className="detail-card">
                <strong>{form.name}</strong>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                  {form.phone}
                  {form.altPhone ? ` · ${form.altPhone}` : ''}
                </p>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                  {form.city || 'City not set'}
                  {form.address ? ` · ${form.address}` : ''}
                </p>
              </div>
              <FormActions onBack={() => setStep(0)} onNext={finish} nextLabel="Save customer" />
            </div>
          )}
        </Panel>
      ) : (
        <>
          <div className="mini-stat-grid">
            <MiniStat label="Customers" value={String(activeCustomers)} tone="ok" icon={Users} />
            <MiniStat
              label="Visited today"
              value={String(customers.filter((c) => c.lastVisit === 'Today').length)}
              tone="info"
              icon={Phone}
            />
            <MiniStat
              label="Top visits"
              value={String(Math.max(...customers.map((c) => c.visits)))}
              hint="Most loyal"
              icon={UserPlus}
            />
            <MiniStat label="Cities" value={String(new Set(customers.map((c) => c.city).filter((c) => c !== '—')).size)} icon={MapPin} />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            <Panel style={{ padding: 16 }} delay={0.05}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Search customers</label>
                <div className="field-input-icon">
                  <Search size={16} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / phone / city" />
                </div>
              </div>
              {list.length === 0 ? (
                <div className="empty-state">No customers found.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((c) => (
                        <tr
                          key={c.id}
                          className="click-row"
                          onClick={() => setSelectedId(c.id)}
                          style={{
                            background: selected?.id === c.id ? 'rgba(14,168,122,0.06)' : undefined,
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td>{c.phone}</td>
                          <td>{c.visits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel style={{ padding: 16 }} delay={0.1}>
              <h2 className="section-title">
                <Users size={18} /> Customer card
              </h2>
              {selected ? (
                <div className="section-gap">
                  <div className="detail-card is-selected">
                    <strong>{selected.name}</strong>
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)' }}>
                      {selected.phone}
                    </p>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)' }}>
                      {selected.city} · Last visit {selected.lastVisit}
                    </p>
                  </div>
                  <div className="totals-box">
                    <div className="totals-row">
                      <span>Total visits</span>
                      <span>{selected.visits}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/app/billing')}>
                      <Receipt size={16} /> New sale bill
                    </button>
                    <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate('/app/service')}>
                      <Wrench size={16} /> New service bill
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Select a customer</div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
