import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { StatusBadge } from './StatusBadge'
import { FIELD_LABELS, type Verification } from '../types'

export function VerificationPanel({ vendorId, onVerified }: { vendorId: string; onVerified?: () => void }) {
  const [verification, setVerification] = useState<Verification | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.latestVerification(vendorId).then(setVerification).catch(() => {})
  }, [vendorId])

  async function runVerification() {
    setBusy(true)
    setError('')
    try {
      setVerification(await api.verify(vendorId))
      onVerified?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  const v = verification
  const company = v?.details?.company
  const isMock = v?.source.endsWith('-mock')

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Company Verification (OpenCorporates)</h2>
        {v && <StatusBadge value={v.result} />}
        {isMock && <span className="badge">Mock data</span>}
        <button style={{ marginLeft: 'auto' }} disabled={busy} onClick={runVerification}>
          {busy ? 'Verifying…' : v ? 'Re-verify' : 'Verify company'}
        </button>
      </div>
      <p className="muted">
        Searches the company registry by registration number (falling back to company name) and compares the
        registered record with the vendor details.
      </p>
      {isMock && (
        <p className="notice">
          No OpenCorporates API token is configured, so results come from an offline mock with the same response
          format. Set <code>OPENCORPORATES_API_TOKEN</code> to switch to the live API.
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {v && (
        <>
          <p className="muted small-text">
            Searched by {v.searchedBy === 'regNumber' ? 'registration number' : 'company name'}: <code>{v.query}</code> ·{' '}
            {new Date(v.createdAt).toLocaleString()}
          </p>

          {v.result === 'UNABLE_TO_VERIFY' && <p className="error">Unable to verify: {v.error}</p>}

          {company && v.details && (
            <>
              <h3>Registry record</h3>
              <table>
                <tbody>
                  <tr><td style={{ width: '30%' }}>Registered name</td><td>{company.name}</td></tr>
                  <tr><td>Company number</td><td>{company.companyNumber} ({company.jurisdiction.toUpperCase()})</td></tr>
                  <tr>
                    <td>Status</td>
                    <td>
                      {company.status ?? '—'}{' '}
                      {!v.details.isActive && <StatusBadge value="MISMATCH" />}
                    </td>
                  </tr>
                  <tr><td>Incorporated</td><td>{company.incorporationDate ?? '—'}</td></tr>
                  <tr><td>Type</td><td>{company.companyType ?? '—'}</td></tr>
                  <tr><td>Registered address</td><td>{company.address ?? '—'}</td></tr>
                  <tr>
                    <td>Source</td>
                    <td>
                      <a href={company.url} target="_blank" rel="noreferrer">{company.url}</a>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>Comparison with vendor</h3>
              <table>
                <thead>
                  <tr><th>Field</th><th>Vendor</th><th>Registry</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {v.details.checks.map((c) => (
                    <tr key={c.field} className={c.match === false ? 'row-mismatch' : ''}>
                      <td>{FIELD_LABELS[c.field] ?? c.field}</td>
                      <td>{c.vendorValue ?? <em className="muted">—</em>}</td>
                      <td>{c.registryValue ?? <em className="muted">—</em>}</td>
                      <td>
                        <StatusBadge value={c.match === null ? 'MISSING' : c.match ? 'MATCH' : 'MISMATCH'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}
