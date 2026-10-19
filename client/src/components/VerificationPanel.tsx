import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { FIELD_LABELS, type Verification } from '../types'

export function VerificationPanel({ vendorId, onVerified }: { vendorId: string; onVerified?: () => void }) {
  const [verification, setVerification] = useState<Verification | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showRaw, setShowRaw] = useState(false)

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
  const checks = v?.details?.checks ?? []
  const matched = checks.filter((c) => c.match === true).length
  const comparable = checks.filter((c) => c.match !== null).length

  const registryRows = company && [
    ['Registered legal name', company.name],
    ['Company number', `${company.companyNumber} (${company.jurisdiction.toUpperCase()})`],
    ['Registry status', company.status ?? '—'],
    ['Incorporation date', company.incorporationDate ?? '—'],
    ['Entity type', company.companyType ?? '—'],
    ['Verification source', 'link'],
  ]

  return (
    <div className="card flush">
      <div className="panel-head">
        <div className="row" style={{ gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Company Verification (OpenCorporates)</h2>
          {v && <StatusBadge value={v.result} />}
          {isMock && <span className="badge">Mock data</span>}
        </div>
        <button className="secondary small" disabled={busy} onClick={runVerification}>
          <Icon name="refresh" size={16} /> {busy ? 'Verifying…' : v ? 'Re-verify' : 'Verify company'}
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Searches the company registry by registration number (falling back to company name) and compares the
          registered record with the vendor details.
        </p>

        {isMock && (
          <div className="info-box">
            <Icon name="info" size={20} />
            <div>
              <div className="strong">Mock sandbox mode active</div>
              <div className="muted small-text">
                No OpenCorporates API token is configured, so results come from an offline mock with the same response
                format. Set <code>OPENCORPORATES_API_TOKEN</code> to use the live API.
              </div>
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}

        {v && (
          <p className="muted small-text row" style={{ gap: 4 }}>
            <Icon name="manage_search" size={14} />
            Searched by {v.searchedBy === 'regNumber' ? 'registration number' : 'company name'}:{' '}
            <code>{v.query}</code> · {new Date(v.createdAt).toLocaleString()}
          </p>
        )}

        {v?.result === 'UNABLE_TO_VERIFY' && (
          <div className="fail-box">
            <Icon name="error" size={24} />
            <div>
              <div className="strong">{v.error ?? 'Unable to verify this company.'}</div>
              <div className="small-text">
                The registry lookup returned no matching record. Verify the registration number with the vendor, or
                request certified registry documentation.
              </div>
            </div>
          </div>
        )}

        {company && v?.details && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <h3 style={{ margin: 0 }}>
                <Icon name="account_balance" size={18} /> Registry record
              </h3>
              <button className="ghost small" onClick={() => setShowRaw(!showRaw)}>
                <Icon name="code" size={14} /> {showRaw ? 'Hide' : 'Raw'} JSON
              </button>
            </div>

            {showRaw ? (
              <pre className="raw-json">{JSON.stringify(v.rawResponse ?? v.details, null, 2)}</pre>
            ) : (
              <div className="registry-grid">
                {registryRows!.map(([label, value]) => (
                  <div key={label} className="rg-cell">
                    <span className="rg-label">{label}</span>
                    {value === 'link' ? (
                      <a href={company.url} target="_blank" rel="noreferrer">
                        {new URL(company.url).hostname} <Icon name="open_in_new" size={14} />
                      </a>
                    ) : label === 'Registry status' ? (
                      <span className="row" style={{ gap: 6 }}>
                        <span className={`dot-status ${v.details!.isActive ? 'ok' : 'bad'}`} /> {value}
                      </span>
                    ) : (
                      <span className="rg-value">{value}</span>
                    )}
                  </div>
                ))}
                <div className="rg-cell span-2">
                  <span className="rg-label">Registered office address</span>
                  <span className="rg-value">{company.address ?? '—'}</span>
                </div>
              </div>
            )}

            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <h3 style={{ margin: 0 }}>
                <Icon name="difference" size={18} /> Comparison with vendor
              </h3>
              <span className={`badge ${matched === comparable ? 'badge-match' : 'badge-mismatch'}`}>
                {matched}/{comparable} matched
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Vendor submitted</th>
                    <th>Registry record</th>
                    <th style={{ textAlign: 'right' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.field} className={c.match === false ? 'row-mismatch' : ''}>
                      <td className="strong">{FIELD_LABELS[c.field] ?? c.field}</td>
                      <td className="muted">{c.vendorValue ?? '—'}</td>
                      <td>{c.registryValue ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge value={c.match === null ? 'MISSING' : c.match ? 'MATCH' : 'MISMATCH'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!v.details.isActive && (
              <p className="error small-text" style={{ marginTop: 8 }}>
                <Icon name="warning" size={14} /> Registry status is not active ({company.status}).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
