import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { StatusBadge } from './StatusBadge'
import { TaskList } from './TaskList'
import type { Activity, ChecklistItem, EmailLog, Task, Vendor, VendorStatus } from '../types'

const TRANSITION_LABELS: Record<VendorStatus, string> = {
  DRAFT: 'Back to Draft',
  UNDER_REVIEW: 'Submit for Review',
  ACTION_REQUIRED: 'Mark Action Required',
  APPROVED: 'Approve',
  REJECTED: 'Reject',
}

const STEPS: VendorStatus[] = ['DRAFT', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED']

interface Props {
  vendor: Vendor
  onVendorChange: () => void
}

export function ReviewTab({ vendor, onVendorChange }: Props) {
  const [allowed, setAllowed] = useState<VendorStatus[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [emails, setEmails] = useState<EmailLog[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    Promise.all([
      api.workflow(vendor.id),
      api.checklist(vendor.id),
      api.emails(vendor.id),
      api.vendorTasks(vendor.id),
      api.activity(vendor.id),
    ])
      .then(([wf, cl, em, tk, ac]) => {
        setAllowed(wf.allowedTransitions)
        setChecklist(cl)
        setEmails(em)
        setTasks(tk)
        setActivity(ac)
      })
      .catch((e) => setError(e.message))
  }, [vendor.id])

  useEffect(load, [load, vendor.status])

  async function run(kind: string, fn: () => Promise<string | void>) {
    setBusy(kind)
    setError('')
    setMessage('')
    try {
      const msg = await fn()
      if (msg) setMessage(msg)
      onVendorChange()
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  const changeStatus = (to: VendorStatus) => {
    if ((to === 'APPROVED' || to === 'REJECTED') && !confirm(`${TRANSITION_LABELS[to]} this vendor?`)) return
    run(to, async () => {
      const { evaluation } = await api.changeStatus(vendor.id, to)
      if (!evaluation) return
      const parts = [`${evaluation.issues.length} issue(s) found`]
      if (evaluation.emailsSent.length) parts.push(`email sent to ${vendor.email}`)
      if (evaluation.tasksCreated) parts.push(`${evaluation.tasksCreated} task(s) created`)
      return parts.join(' · ')
    })
  }

  const missingCount = checklist.filter((c) => c.status === 'MISSING').length
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING')

  return (
    <div>
      <div className="card">
        <h2>Verification Workflow</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <span key={s} className={`step ${vendor.status === s ? 'current' : ''}`}>
              {i > 0 && <span className="arrow">→</span>}
              <StatusBadge value={s} />
            </span>
          ))}
          <span className="step">
            <span className="arrow">/</span>
            <StatusBadge value="REJECTED" />
          </span>
        </div>
        <p>
          Current status: <StatusBadge value={vendor.status} />
          {vendor.status === 'ACTION_REQUIRED' && (
            <span className="muted"> · resolve the pending tasks below; the status returns to Under Review automatically</span>
          )}
        </p>
        <div className="row">
          {allowed.map((to) => (
            <button
              key={to}
              className={to === 'REJECTED' ? 'danger' : to === 'DRAFT' ? 'secondary' : ''}
              disabled={!!busy}
              onClick={() => changeStatus(to)}
            >
              {busy === to ? 'Working…' : TRANSITION_LABELS[to]}
            </button>
          ))}
          <button
            className="secondary"
            style={{ marginLeft: 'auto' }}
            disabled={!!busy}
            onClick={() =>
              run('checks', async () => {
                const r = await api.runChecks(vendor.id)
                return r.steps.map((s) => `${s.step}: ${s.message}`).join(' · ')
              })
            }
          >
            {busy === 'checks' ? 'Running checks…' : 'Run all checks'}
          </button>
        </div>
        {vendor.status === 'DRAFT' && (
          <p className="muted small-text">
            Submitting for review runs the automation: missing documents are emailed to the vendor, mismatches open tasks,
            and the status moves to Action Required if anything needs attention.
          </p>
        )}
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Document Checklist</h2>
          {missingCount > 0 && (
            <button
              className="secondary small"
              style={{ marginLeft: 'auto' }}
              disabled={!!busy}
              onClick={() =>
                run('remind', async () => {
                  const r = await api.notifyMissing(vendor.id)
                  return `Reminder sent to ${vendor.email} for ${r.sent.length} document(s)`
                })
              }
            >
              {busy === 'remind' ? 'Sending…' : 'Send reminder email now'}
            </button>
          )}
        </div>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr><th>Document</th><th>Status</th><th>Details</th><th>Last reminder</th></tr>
          </thead>
          <tbody>
            {checklist.map((c) => (
              <tr key={c.docType}>
                <td>{c.label}</td>
                <td><StatusBadge value={c.status} /></td>
                <td className="muted">{c.reason}</td>
                <td>{c.lastReminderAt ? new Date(c.lastReminderAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Tasks {pendingTasks.length > 0 && <StatusBadge value="PENDING" />}</h2>
        <TaskList tasks={tasks} onChange={load} vendorId={vendor.id} />
      </div>

      <div className="card">
        <h2>Emails to Vendor</h2>
        {emails.length === 0 ? (
          <p className="muted">No emails sent yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Sent</th><th>To</th><th>Subject</th><th>Document</th><th>Status</th></tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.sentAt).toLocaleString()}</td>
                  <td>{e.toEmail}</td>
                  <td>{e.subject}</td>
                  <td>{e.missingDoc}</td>
                  <td>
                    <StatusBadge value={e.status} />
                    {e.error && <div className="error small-text">{e.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Activity</h2>
        {activity.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <ul className="timeline">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="muted small-text">{new Date(a.createdAt).toLocaleString()}</span>{' '}
                <span className={`badge ${a.actor === 'system' ? '' : 'badge-under_review'}`}>{a.actor}</span>{' '}
                {a.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
