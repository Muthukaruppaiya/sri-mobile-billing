import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { PageHeader, Panel, SuccessBanner, TitleCount } from '../components/ui'
import { ComboSelect } from '../components/SearchableSelect'

type Employee = {
  id: string
  name: string
  phone?: string | null
  username: string
  role: 'ADMIN' | 'EMPLOYEE'
  active: boolean
}

export function EmployeesPage() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [done, setDone] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    username: '',
    password: '',
    role: 'EMPLOYEE' as 'ADMIN' | 'EMPLOYEE',
  })

  const listQ = useQuery({
    queryKey: ['employees'],
    queryFn: () => api<Employee[]>('/employees'),
    enabled: isAdmin,
  })

  const create = useMutation({
    mutationFn: () =>
      api('/employees', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setDone(`${form.name.trim()} can sign in as ${form.role.toLowerCase()}`)
      setForm({ name: '', phone: '', username: '', password: '', role: 'EMPLOYEE' })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })

  if (!isAdmin) return <Navigate to="/app" replace />

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  return (
    <div className="section-gap">
      <PageHeader title="Employees" subtitle="Login credentials for counter staff" />
      {done ? (
        <SuccessBanner title="Employee created successfully" detail={done} onClose={() => setDone(null)} />
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">Add employee</h2>
          <form className="form-grid form-grid--2" onSubmit={onSubmit}>
            <div className="field">
              <label>Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Username *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Role</label>
              <ComboSelect
                value={form.role}
                placeholder="Type role…"
                options={[
                  { id: 'EMPLOYEE', label: 'Employee' },
                  { id: 'ADMIN', label: 'Admin' },
                ]}
                onChange={(v) => setForm({ ...form, role: v as 'ADMIN' | 'EMPLOYEE' })}
              />
            </div>
            <button className="btn btn--primary" type="submit" disabled={create.isPending}>
              Create login
            </button>
          </form>
        </Panel>

        <Panel style={{ padding: 16 }}>
          <h2 className="section-title">
            Team <TitleCount n={(listQ.data || []).length} />
          </h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(listQ.data || []).map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td>{e.username}</td>
                    <td>{e.role}</td>
                    <td>
                      <span className={`chip ${e.active ? 'chip--live' : 'chip--warn'}`}>
                        {e.active ? 'Active' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
