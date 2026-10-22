import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, Pencil, Power, UserPlus, Wand2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { matchesQuery } from '../lib/search'
import { formatDateTime } from '../lib/format'
import { MiniStat, Modal, PageHeader, Panel, Segmented, SuccessBanner, TitleCount } from '../components/ui'
import { SearchField } from '../components/SearchableSelect'

type Role = 'ADMIN' | 'EMPLOYEE'

type Employee = {
  id: string
  name: string
  phone?: string | null
  username: string
  role: Role
  active: boolean
  lastLoginAt?: string | null
  createdAt: string
  _count?: { sales: number; purchases: number; serviceJobs: number }
}

const ROLE_OPTIONS: { id: Role; label: string }[] = [
  { id: 'EMPLOYEE', label: 'Counter staff' },
  { id: 'ADMIN', label: 'Admin' },
]

const emptyForm = { name: '', phone: '', username: '', password: '', role: 'EMPLOYEE' as Role }

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  )
}

function suggestUsername(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-field">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoComplete="new-password"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="pw-field__toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

export function EmployeesPage() {
  const { isAdmin, user } = useAuth()
  const qc = useQueryClient()
  const [done, setDone] = useState<{ title: string; detail: string } | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [formError, setFormError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'off'>('active')

  const [editing, setEditing] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: 'EMPLOYEE' as Role })
  const [resetFor, setResetFor] = useState<Employee | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [toggleFor, setToggleFor] = useState<Employee | null>(null)
  const [modalError, setModalError] = useState('')

  const listQ = useQuery({
    queryKey: ['employees'],
    queryFn: () => api<Employee[]>('/employees'),
    enabled: isAdmin,
  })

  const all = useMemo(() => listQ.data || [], [listQ.data])
  const stats = useMemo(
    () => ({
      total: all.length,
      active: all.filter((e) => e.active).length,
      admins: all.filter((e) => e.active && e.role === 'ADMIN').length,
      off: all.filter((e) => !e.active).length,
    }),
    [all],
  )

  const list = useMemo(
    () =>
      all.filter((e) => {
        if (filter === 'active' && !e.active) return false
        if (filter === 'off' && e.active) return false
        return matchesQuery(q, e.name, e.username, e.phone, e.role)
      }),
    [all, q, filter],
  )

  function refresh() {
    qc.invalidateQueries({ queryKey: ['employees'] })
  }

  const create = useMutation({
    mutationFn: () =>
      api<Employee>('/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role: form.role,
        }),
      }),
    onSuccess: (e) => {
      setDone({
        title: 'Login created',
        detail: `${e.name} can sign in as "${e.username}" with the password you set (${
          e.role === 'ADMIN' ? 'admin' : 'counter staff'
        }).`,
      })
      setForm(emptyForm)
      setUsernameTouched(false)
      setFormError('')
      refresh()
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setModalError('')
      refresh()
    },
    onError: (e: Error) => setModalError(e.message),
  })

  if (!isAdmin) return <Navigate to="/app" replace />

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Enter the employee name')
    if (form.username.trim().length < 3) return setFormError('Username needs at least 3 characters')
    if (form.password.length < 4) return setFormError('Password needs at least 4 characters')
    create.mutate()
  }

  function openEdit(e: Employee) {
    setModalError('')
    setEditing(e)
    setEditForm({ name: e.name, phone: e.phone || '', role: e.role })
  }

  function saveEdit() {
    if (!editing) return
    if (!editForm.name.trim()) return setModalError('Enter name')
    update.mutate(
      {
        id: editing.id,
        body: { name: editForm.name.trim(), phone: editForm.phone.trim() || null, role: editForm.role },
      },
      {
        onSuccess: (e) => {
          setEditing(null)
          setDone({ title: 'Employee updated', detail: `${e.name}'s details were saved.` })
        },
      },
    )
  }

  function saveReset() {
    if (!resetFor) return
    if (newPassword.length < 4) return setModalError('Password needs at least 4 characters')
    update.mutate(
      { id: resetFor.id, body: { password: newPassword } },
      {
        onSuccess: (e) => {
          setResetFor(null)
          setDone({
            title: 'Password reset',
            detail: `Share the new password with ${e.name}. Their old password no longer works.`,
          })
        },
      },
    )
  }

  function confirmToggle() {
    if (!toggleFor) return
    const next = !toggleFor.active
    update.mutate(
      { id: toggleFor.id, body: { active: next } },
      {
        onSuccess: (e) => {
          setToggleFor(null)
          setDone({
            title: next ? 'Login enabled' : 'Login disabled',
            detail: next
              ? `${e.name} can sign in again.`
              : `${e.name} is signed out everywhere and cannot sign in. Their past bills stay in history.`,
          })
        },
      },
    )
  }

  return (
    <div className="section-gap">
      <PageHeader title="Employees" subtitle="Staff logins, roles and access for the billing desk" />

      {done ? <SuccessBanner title={done.title} detail={done.detail} onClose={() => setDone(null)} /> : null}

      <div className="mini-stat-grid">
        <MiniStat label="Active logins" value={String(stats.active)} tone="ok" onClick={() => setFilter('active')} />
        <MiniStat label="Admins" value={String(stats.admins)} tone="info" />
        <MiniStat label="Disabled" value={String(stats.off)} tone="warn" onClick={() => setFilter('off')} />
        <MiniStat label="Total staff" value={String(stats.total)} onClick={() => setFilter('all')} />
      </div>

      <div className="staff-layout">
        <Panel style={{ padding: 16 }}>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} color="var(--brand)" /> Add employee
          </h2>
          <form className="staff-form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label>Name *</label>
              <input
                value={form.name}
                placeholder="Full name"
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({
                    ...f,
                    name,
                    username: usernameTouched ? f.username : suggestUsername(name),
                  }))
                }}
              />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                value={form.phone}
                inputMode="tel"
                placeholder="Mobile number"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Username *</label>
              <input
                value={form.username}
                autoComplete="off"
                placeholder="e.g. ravi"
                onChange={(e) => {
                  setUsernameTouched(true)
                  setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '') })
                }}
              />
              <p className="form-hint">Lowercase letters, numbers, dot or dash. Used to sign in.</p>
            </div>
            <div className="field">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Password *</span>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setForm({ ...form, password: randomPassword() })}
                >
                  <Wand2 size={12} /> Generate
                </button>
              </label>
              <PasswordInput
                value={form.password}
                placeholder="Min 4 characters"
                onChange={(password) => setForm({ ...form, password })}
              />
            </div>
            <div className="field">
              <label>Role</label>
              <Segmented
                label="Role"
                options={ROLE_OPTIONS}
                value={form.role}
                onChange={(role) => setForm({ ...form, role })}
              />
              <p className="form-hint">
                {form.role === 'ADMIN'
                  ? 'Admin: full access including staff, settings and reports. Can sign in from anywhere.'
                  : 'Counter staff: purchase, sale, service and stock. No staff or settings access.'}
              </p>
            </div>
            {formError ? <p className="form-error">{formError}</p> : null}
            <button className="btn btn--primary btn--block" type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create login'}
            </button>
          </form>
        </Panel>

        <Panel style={{ padding: 16 }}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Team <TitleCount n={list.length} />
            </h2>
            <div className="mode-tabs" role="tablist" aria-label="Status filter">
              {(
                [
                  ['active', 'Active'],
                  ['off', 'Disabled'],
                  ['all', 'All'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`mode-tab${filter === id ? ' is-active' : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="search-toolbar">
            <div style={{ flex: 1, minWidth: 200 }}>
              <SearchField value={q} onChange={setQ} placeholder="Search name, username, phone…" />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Last login</th>
                  <th>Bills</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const isSelf = e.id === user?.id
                  const bills = (e._count?.sales || 0) + (e._count?.purchases || 0) + (e._count?.serviceJobs || 0)
                  return (
                    <tr key={e.id} className={e.active ? '' : 'row-off'}>
                      <td>
                        <div className="staff-person">
                          <span
                            className={`avatar${!e.active ? ' avatar--off' : e.role === 'ADMIN' ? ' avatar--admin' : ''}`}
                          >
                            {initials(e.name)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {e.name}
                              {isSelf ? <span className="tag-you">YOU</span> : null}
                            </div>
                            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                              {e.phone || 'No phone'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{e.username}</td>
                      <td>
                        <span className={`chip${e.role === 'ADMIN' ? ' chip--warn' : ''}`}>
                          {e.role === 'ADMIN' ? 'Admin' : 'Staff'}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                        {e.lastLoginAt ? formatDateTime(e.lastLoginAt) : 'Never'}
                      </td>
                      <td
                        className="muted"
                        style={{ fontSize: 'var(--fs-xs)' }}
                        title={`${e._count?.sales || 0} sales · ${e._count?.purchases || 0} purchases · ${
                          e._count?.serviceJobs || 0
                        } service tickets`}
                      >
                        {bills}
                      </td>
                      <td>
                        <span className={`chip ${e.active ? 'chip--live' : 'chip--danger'}`}>
                          {e.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="table-action">
                        <div className="table-actions">
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => openEdit(e)}>
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => {
                              setModalError('')
                              setNewPassword('')
                              setResetFor(e)
                            }}
                          >
                            <KeyRound size={12} /> Password
                          </button>
                          {!isSelf ? (
                            <button
                              type="button"
                              className={`btn btn--sm ${e.active ? 'btn--danger' : 'btn--ghost'}`}
                              onClick={() => {
                                setModalError('')
                                setToggleFor(e)
                              }}
                            >
                              <Power size={12} /> {e.active ? 'Disable' : 'Enable'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {listQ.isLoading ? <div className="empty-state">Loading…</div> : null}
            {!listQ.isLoading && !list.length ? (
              <div className="empty-state">{q ? 'No staff match.' : 'No employees in this view.'}</div>
            ) : null}
          </div>
        </Panel>
      </div>

      <Modal
        open={Boolean(editing)}
        title={`Edit · ${editing?.name || ''}`}
        subtitle={editing ? `Username ${editing.username} (cannot be changed)` : undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" disabled={update.isPending} onClick={saveEdit}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="staff-form">
          <div className="field">
            <label>Name *</label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input
              value={editForm.phone}
              inputMode="tel"
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Role</label>
            {editing?.id === user?.id ? (
              <p className="form-hint">You cannot change your own role.</p>
            ) : (
              <Segmented
                label="Role"
                options={ROLE_OPTIONS}
                value={editForm.role}
                onChange={(role) => setEditForm({ ...editForm, role })}
              />
            )}
          </div>
          {modalError ? <p className="form-error">{modalError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(resetFor)}
        title={`Reset password · ${resetFor?.name || ''}`}
        subtitle="Set a new password and share it with the employee"
        onClose={() => setResetFor(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setResetFor(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" disabled={update.isPending} onClick={saveReset}>
              {update.isPending ? 'Saving…' : 'Set password'}
            </button>
          </>
        }
      >
        <div className="staff-form">
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>New password *</span>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNewPassword(randomPassword())}>
                <Wand2 size={12} /> Generate
              </button>
            </label>
            <PasswordInput value={newPassword} placeholder="Min 4 characters" onChange={setNewPassword} />
          </div>
          {modalError ? <p className="form-error">{modalError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(toggleFor)}
        title={toggleFor?.active ? `Disable ${toggleFor?.name}?` : `Enable ${toggleFor?.name}?`}
        onClose={() => setToggleFor(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setToggleFor(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${toggleFor?.active ? 'btn--danger' : 'btn--primary'}`}
              disabled={update.isPending}
              onClick={confirmToggle}
            >
              {update.isPending ? 'Saving…' : toggleFor?.active ? 'Disable login' : 'Enable login'}
            </button>
          </>
        }
      >
        <p className="muted" style={{ margin: 0 }}>
          {toggleFor?.active
            ? 'They will be signed out immediately and cannot sign in until enabled again. Bills they created stay in history.'
            : 'They will be able to sign in again with their existing password.'}
        </p>
        {modalError ? (
          <p className="form-error" style={{ marginTop: 10 }}>
            {modalError}
          </p>
        ) : null}
      </Modal>
    </div>
  )
}
