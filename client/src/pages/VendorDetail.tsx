import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { VendorForm } from '../components/VendorForm'
import { VersionHistory } from '../components/VersionHistory'
import { DocumentsTab } from '../components/DocumentsTab'
import { VerificationPanel } from '../components/VerificationPanel'
import { ReviewTab } from '../components/ReviewTab'
import { VENDOR_FIELDS, type Vendor, type VendorDetails } from '../types'

const TABS = ['Details', 'Documents', 'Verification', 'Review', 'History'] as const
type Tab = (typeof TABS)[number]

const pickDetails = (v: Vendor) => Object.fromEntries(VENDOR_FIELDS.map((f) => [f.key, v[f.key]])) as VendorDetails

export function VendorDetail() {
  const { id } = useParams<{ id: string }>()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('Details')
  const [notice, setNotice] = useState('')

  const reload = useCallback(() => {
    if (!id) return
    api.getVendor(id).then(setVendor).catch((e) => setError(e.message))
  }, [id])

  useEffect(reload, [reload])

  if (error) return <p className="error">{error}</p>
  if (!vendor) return <p className="muted">Loading…</p>

  return (
    <div>
      <Link to="/">← All vendors</Link>
      <div className="page-head">
        <h1>{vendor.companyName}</h1>
        <StatusBadge value={vendor.status} />
        <span className="muted">v{vendor.currentVersion}</span>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {notice && <p className="notice">{notice}</p>}

      {tab === 'Details' && (
        <div className="card">
          <VendorForm
            key={vendor.currentVersion}
            initial={pickDetails(vendor)}
            submitLabel="Save Changes"
            onSubmit={async (data) => {
              const { vendor: updated, changes } = await api.updateVendor(vendor.id, data)
              setVendor(updated)
              setNotice(changes.length ? `Saved as version ${updated.currentVersion}` : 'No changes to save')
            }}
          />
        </div>
      )}

      {tab === 'Documents' && <DocumentsTab vendorId={vendor.id} onChange={reload} />}

      {tab === 'Verification' && <VerificationPanel vendorId={vendor.id} onVerified={reload} />}

      {tab === 'Review' && <ReviewTab vendor={vendor} onVendorChange={reload} />}

      {tab === 'History' && (
        <VersionHistory
          vendorId={vendor.id}
          currentVersion={vendor.currentVersion}
          onRestored={() => {
            setNotice('Version restored')
            reload()
          }}
        />
      )}
    </div>
  )
}
