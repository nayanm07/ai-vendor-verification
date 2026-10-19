import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { TaskList } from '../components/TaskList'
import type { Task, TaskStatus } from '../types'

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [filter, setFilter] = useState<TaskStatus | ''>('PENDING')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.allTasks(filter || undefined).then(setTasks).catch((e) => setError(e.message))
  }, [filter])

  useEffect(load, [load])

  return (
    <div>
      <div className="page-head">
        <h1>Tasks</h1>
        <select style={{ marginLeft: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as TaskStatus | '')}>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="">All</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">{tasks ? <TaskList tasks={tasks} onChange={load} showVendor /> : <p className="muted">Loading…</p>}</div>
    </div>
  )
}
