import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from './StatusBadge'
import type { Task, TaskPriority } from '../types'

interface Props {
  tasks: Task[]
  onChange: () => void
  showVendor?: boolean
  /** When set, shows an "add task" form for this vendor. */
  vendorId?: string
}

const isOverdue = (t: Task) => t.status === 'PENDING' && new Date(t.dueDate) < new Date()
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

export function TaskList({ tasks, onChange, showVendor, vendorId }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', priority: 'MEDIUM' as TaskPriority, dueDate: inDays(3) })

  async function toggle(t: Task) {
    setBusy(t.id)
    setError('')
    try {
      await api.updateTask(t.id, t.status === 'PENDING' ? 'COMPLETED' : 'PENDING')
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault()
    if (!vendorId) return
    setError('')
    try {
      await api.createTask(vendorId, form)
      setForm({ title: '', priority: 'MEDIUM', dueDate: inDays(3) })
      setAdding(false)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create task')
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {tasks.length === 0 ? (
        <p className="muted">No tasks.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Task</th>
              {showVendor && <th>Vendor</th>}
              <th>Priority</th>
              <th>Due date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={t.status === 'COMPLETED' ? 'row-done' : ''}>
                <td>
                  {t.title}
                  {t.sourceKey && <span className="badge" style={{ marginLeft: 6 }}>auto</span>}
                  {t.description && <div className="muted small-text">{t.description}</div>}
                </td>
                {showVendor && (
                  <td>{t.vendor && <Link to={`/vendors/${t.vendor.id}`}>{t.vendor.companyName}</Link>}</td>
                )}
                <td><StatusBadge value={t.priority} /></td>
                <td className={isOverdue(t) ? 'error' : ''}>
                  {new Date(t.dueDate).toLocaleDateString()}
                  {isOverdue(t) && ' (overdue)'}
                </td>
                <td><StatusBadge value={t.status} /></td>
                <td>
                  <button className="secondary small" disabled={busy === t.id} onClick={() => toggle(t)}>
                    {t.status === 'PENDING' ? 'Complete' : 'Reopen'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {vendorId && !adding && (
        <button className="secondary small" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>
          + Add task
        </button>
      )}
      {vendorId && adding && (
        <form className="row" style={{ marginTop: 8 }} onSubmit={addTask}>
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <input
            type="date"
            style={{ width: 'auto' }}
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <button className="small" type="submit">Add</button>
          <button className="secondary small" type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      )}
    </div>
  )
}
