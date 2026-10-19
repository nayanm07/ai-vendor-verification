import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { VendorForm } from '../components/VendorForm'
import { VersionHistory } from '../components/VersionHistory'
import { DocumentsTab } from '../components/DocumentsTab'
import { VerificationPanel } from '../components/VerificationPanel'
import { ReviewTab } from '../components/ReviewTab'
import { VENDOR_FIELDS, type Vendor, type VendorDetails } from '../types'

const TABS = [
  { key: 'Details', icon: 'badge' },
  { key: 'Documents', icon: 'description' },
  { key: 'Verification', icon: 'fact_check' },
  { key: 'Review', icon: 'rate_review' },
  { key: 'History', icon: 'schedule' },
] as const
type Tab = (typeof TABS)[number]['key']

const pickDetails = (v: Vendor) => Object.fromEntries(VENDOR_FIELDS.map((f) => [f.key, v[f.key]])) as VendorDetails

export function VendorDetail() {
  const { id } = useParams<{ id: string }>()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'Details'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })
  const [notice, setNotice] = useState('')
  const [docCount, setDocCount] = useState<number | null>(null)
  const [needsVerify, setNeedsVerify] = useState(false)

  const reload = useCallback(() => {
    if (!id) return
    api.getVendor(id).then(setVendor).catch((e) => setError(e.message))
    api.listDocuments(id).then((d) => setDocCount(d.length)).catch(() => {})
    api
      .latestVerification(id)
      .then((v) => setNeedsVerify(!v || v.result !== 'VERIFIED'))
      .catch(() => {})
  }, [id])

  useEffect(reload, [reload])

  if (error) return <p className="error">{error}</p>
  if (!vendor) return <p className="muted">Loading…</p>

  return (
    <div>
      <Link to="/" className="back-link">
        <Icon name="arrow_back" size={16} /> All vendors
      </Link>
      <div className="page-head">
        <h1>{vendor.companyName}</h1>
        <StatusBadge value={vendor.status} />
        <span className="mono-chip">v{vendor.currentVersion}</span>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'active' : ''} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={18} />
            {t.key}
            {t.key === 'Documents' && docCount !== null && <span className="tab-count">{docCount}</span>}
            {t.key === 'Verification' && needsVerify && <span className="tab-dot" title="Verification pending" />}
          </button>
        ))}
      </nav>

      {notice && (
        <p className="notice banner-row">
          <Icon name="check_circle" size={18} /> {notice}
        </p>
      )}

      {tab === 'Details' && (
        <VendorForm
          key={vendor.currentVersion}
          initial={pickDetails(vendor)}
          submitLabel="Save Changes"
          withHeader
          onSubmit={async (data) => {
            const { vendor: updated, changes } = await api.updateVendor(vendor.id, data)
            setVendor(updated)
            setNotice(changes.length ? `Saved as version ${updated.currentVersion}` : 'No changes to save')
          }}
        />
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
