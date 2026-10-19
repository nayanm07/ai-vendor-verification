import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Icon } from '../components/Icon'
import { TaskList } from '../components/TaskList'
import type { Task, TaskStatus } from '../types'

const isOverdue = (t: Task) => t.status === 'PENDING' && new Date(t.dueDate) < new Date()

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('PENDING')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.allTasks().then(setTasks).catch((e) => setError(e.message))
  }, [])

  useEffect(load, [load])

  const all = tasks ?? []
  const pending = all.filter((t) => t.status === 'PENDING')
  const stats = [
    { label: 'Open tasks', value: pending.length, hint: 'actionable', icon: 'assignment', tone: 'tone-blue' },
    { label: 'High priority', value: pending.filter((t) => t.priority === 'HIGH').length, hint: 'require fast-track', icon: 'priority_high', tone: 'tone-amber' },
    { label: 'Overdue', value: all.filter(isOverdue).length, hint: 'past due date', icon: 'alarm', tone: 'tone-amber' },
    { label: 'Completed', value: all.filter((t) => t.status === 'COMPLETED').length, hint: 'resolved', icon: 'check_circle', tone: 'tone-green' },
  ]

  const counts = { PENDING: pending.length, COMPLETED: all.length - pending.length, ALL: all.length }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (t) =>
        (filter === 'ALL' || t.status === filter) &&
        (!q || t.title.toLowerCase().includes(q) || (t.vendor?.companyName ?? '').toLowerCase().includes(q)),
    )
  }, [all, filter, query])

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row">
            <h1>Tasks</h1>
            {tasks && <span className="chip">{all.length} Total</span>}
          </div>
          <p className="subtitle">Track and resolve verification action items across all vendors.</p>
        </div>
        <div className="actions">
          <div className="segmented">
            {(['PENDING', 'COMPLETED', 'ALL'] as const).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'PENDING' ? 'Pending' : f === 'COMPLETED' ? 'Completed' : 'All'}
                <span className="seg-count">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={`stat ${s.tone}`}>
            <div className="stat-head">
              <span className="stat-label">{s.label}</span>
              <span className="stat-icon">
                <Icon name={s.icon} />
              </span>
            </div>
            <div className="stat-body">
              <span className="stat-value">{tasks ? s.value : '–'}</span>
              <span className="muted small-text">{s.hint}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Search action items or vendors…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="card flush">
        {tasks ? (
          filtered.length ? (
            <TaskList tasks={filtered} onChange={load} showVendor />
          ) : (
            <p className="muted" style={{ padding: 16 }}>No tasks match this filter.</p>
          )
        ) : (
          <p className="muted" style={{ padding: 16 }}>Loading…</p>
        )}
      </div>
    </div>
  )
}
