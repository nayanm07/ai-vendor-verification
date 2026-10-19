import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { DOC_TYPES, FIELD_LABELS, type Comparison } from '../types'

export function ComparisonPanel({
  vendorId,
  refreshKey,
  onCompared,
}: {
  vendorId: string
  refreshKey: number
  onCompared?: () => void
}) {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.latestComparison(vendorId).then(setComparison).catch(() => {})
  }, [vendorId])

  async function runComparison() {
    setBusy(true)
    setError('')
    try {
      setComparison(await api.compare(vendorId))
      onCompared?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setBusy(false)
    }
  }

  const result = comparison?.result
  const stale = comparison && refreshKey > 0
  const counts = result && {
    match: result.fields.filter((f) => f.status === 'MATCH').length,
    mismatch: result.fields.filter((f) => f.status === 'MISMATCH').length,
    missing: result.fields.filter((f) => f.status === 'MISSING').length,
  }

  return (
    <div className="card flush">
      <div className="panel-head">
        <div className="row" style={{ gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>AI Comparison</h2>
          {comparison && <StatusBadge value={comparison.hasMismatch ? 'MISMATCH' : 'MATCH'} />}
        </div>
        <button className="secondary small" disabled={busy} onClick={runComparison}>
          <Icon name="sync" size={16} /> {busy ? 'Comparing…' : comparison ? 'Re-run comparison' : 'Run AI comparison'}
        </button>
      </div>

      {!result && !error && (
        <p className="muted" style={{ padding: 16 }}>
          Compares the vendor form against every extracted document and flags mismatches or missing information. Run it to
          see results.
        </p>
      )}
      {error && <p className="error" style={{ padding: 16 }}>{error}</p>}

      {result && (
        <>
          <div className={`panel-alert ${comparison.hasMismatch ? 'bad' : 'good'}`}>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Icon name={comparison.hasMismatch ? 'warning' : 'check_circle'} size={20} />
              <div>
                <div className="strong">{comparison.hasMismatch ? 'Mismatch found. ' : 'No mismatches found. '}{result.summary}</div>
                {stale && <div className="muted small-text">Documents changed since this run — re-run to refresh.</div>}
              </div>
            </div>
            {result.missingDocuments.length > 0 && (
              <span className="badge badge-missing">
                <Icon name="error" size={14} /> Missing: {result.missingDocuments.map((d) => DOC_TYPES.find((t) => t.key === d)?.label ?? d).join(', ')}
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  {result.sources.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.fields.map((f) => (
                  <tr key={f.field} className={f.status === 'MISMATCH' ? 'row-mismatch' : ''}>
                    <td className="strong">{FIELD_LABELS[f.field]}</td>
                    {result.sources.map((s) => (
                      <td key={s}>
                        {f.values[s] ? (
                          f.status === 'MISMATCH' ? <mark>{f.values[s]}</mark> : f.values[s]
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right' }}>
                      <StatusBadge value={f.status} />
                      {f.status !== 'MATCH' && <div className="muted small-text">{f.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {counts && (
            <div className="panel-foot">
              <div className="row" style={{ gap: 18 }}>
                <span>Total checked: <strong>{result.fields.length} fields</strong></span>
                <span>Matched: <strong>{counts.match}</strong></span>
                <span>Mismatched: <strong className={counts.mismatch ? 'error' : ''}>{counts.mismatch}</strong></span>
                <span>Missing: <strong>{counts.missing}</strong></span>
              </div>
              <span className="row" style={{ gap: 4 }}>
                <Icon name="schedule" size={14} /> Last evaluated {new Date(comparison.createdAt).toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
