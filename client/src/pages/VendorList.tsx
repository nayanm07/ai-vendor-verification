import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { VendorForm } from '../components/VendorForm'
import type { Vendor } from '../types'

export function VendorList() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.listVendors().then(setVendors).catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <div className="page-head">
        <h1>Vendors</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Vendor'}</button>
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

      {error && <p className="error">{error}</p>}
      {!vendors && !error && <p className="muted">Loading…</p>}
      {vendors?.length === 0 && <p className="muted">No vendors yet. Create one to get started.</p>}
      {vendors && vendors.length > 0 && (
        <table className="card">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Status</th>
              <th>Version</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link to={`/vendors/${v.id}`}>{v.companyName}</Link>
                </td>
                <td>{v.contactPerson}</td>
                <td>{v.email}</td>
                <td>
                  <StatusBadge value={v.status} />
                </td>
                <td>v{v.currentVersion}</td>
                <td>{new Date(v.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
