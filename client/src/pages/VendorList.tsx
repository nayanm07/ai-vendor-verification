import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { VendorForm } from '../components/VendorForm'
import type { Vendor, VendorStatus } from '../types'

const STATUS_OPTIONS: { value: VendorStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'ACTION_REQUIRED', label: 'Action Required' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

function formatUpdated(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function exportCsv(vendors: Vendor[]) {
  const cols: (keyof Vendor)[] = ['companyName', 'contactPerson', 'email', 'phone', 'regNumber', 'gstNumber', 'status', 'currentVersion', 'updatedAt']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...vendors.map((v) => cols.map((c) => esc(v[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'vendors.csv' })
  a.click()
  URL.revokeObjectURL(url)
}

export function VendorList() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<VendorStatus | ''>('')
  const navigate = useNavigate()

  useEffect(() => {
    api.listVendors().then(setVendors).catch((e) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (vendors ?? []).filter(
      (v) =>
        (!status || v.status === status) &&
        (!q || [v.companyName, v.contactPerson, v.email].some((s) => s.toLowerCase().includes(q))),
    )
  }, [vendors, query, status])

  const count = (s: VendorStatus) => vendors?.filter((v) => v.status === s).length ?? 0
  const stats = [
    { label: 'Total vendors', value: vendors?.length ?? 0, icon: 'domain', tone: '', badge: null },
    { label: 'Under review', value: count('UNDER_REVIEW'), icon: 'pending_actions', tone: 'tone-blue', badge: 'UNDER_REVIEW' },
    { label: 'Action required', value: count('ACTION_REQUIRED'), icon: 'warning', tone: 'tone-amber', badge: 'ACTION_REQUIRED' },
    { label: 'Approved', value: count('APPROVED'), icon: 'verified', tone: 'tone-green', badge: 'APPROVED' },
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row">
            <h1>Vendors</h1>
            <span className="chip">Directory</span>
          </div>
          <p className="subtitle">Onboard vendors, verify their documents and registry records, and track review status.</p>
        </div>
        <div className="actions">
          <button className="secondary" disabled={!vendors?.length} onClick={() => exportCsv(filtered)}>
            <Icon name="file_download" /> Export
          </button>
          <button onClick={() => setShowForm(!showForm)}>
            <Icon name={showForm ? 'close' : 'add'} /> {showForm ? 'Cancel' : 'New Vendor'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h2>New Vendor</h2>
          <VendorForm
            submitLabel="Create Vendor"
            onSubmit={async (data) => {
              const v = await api.createVendor(data)
              navigate(`/vendors/${v.id}`)
            }}
          />
        </div>
      )}

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
              <span className="stat-value">{vendors ? s.value : '–'}</span>
              {s.badge && <StatusBadge value={s.badge} />}
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Filter by company, contact, or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as VendorStatus | '')}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!vendors && !error && <p className="muted">Loading…</p>}

      {vendors?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon">
            <Icon name="inventory_2" />
          </div>
          <h2>No vendors yet</h2>
          <p>Create your first vendor to start the verification workflow.</p>
          <button onClick={() => setShowForm(true)}>
            <Icon name="add" /> New Vendor
          </button>
        </div>
      )}

      {vendors && vendors.length > 0 && (
        <div className="card flush">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Last updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link className="table-link" to={`/vendors/${v.id}`}>
                        {v.companyName}
                      </Link>
                    </td>
                    <td className="strong">{v.contactPerson}</td>
                    <td className="cell-muted">{v.email}</td>
                    <td>
                      <StatusBadge value={v.status} />
                    </td>
                    <td>
                      <span className="mono-chip">v{v.currentVersion}</span>
                    </td>
                    <td className="cell-muted">{formatUpdated(v.updatedAt)}</td>
                    <td className="actions-cell">
                      <Link to={`/vendors/${v.id}`} title="Open vendor" className="muted">
                        <Icon name="chevron_right" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      No vendors match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            Showing {filtered.length} of {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  )
}
