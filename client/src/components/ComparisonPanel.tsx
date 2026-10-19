import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { StatusBadge } from './StatusBadge'
import { DOC_TYPES, FIELD_LABELS, type Comparison } from '../types'

export function ComparisonPanel({ vendorId, refreshKey }: { vendorId: string; refreshKey: number }) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setBusy(false)
    }
  }

  const result = comparison?.result
  const stale = comparison && refreshKey > 0

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>AI Comparison</h2>
        {comparison && (
          <StatusBadge value={comparison.hasMismatch ? 'MISMATCH' : 'MATCH'} />
        )}
        <button style={{ marginLeft: 'auto' }} disabled={busy} onClick={runComparison}>
          {busy ? 'Comparing…' : comparison ? 'Re-run comparison' : 'Run AI comparison'}
        </button>
      </div>
      <p className="muted">
        Compares the vendor form against every extracted document and flags mismatches or missing information.
      </p>
      {error && <p className="error">{error}</p>}
      {stale && <p className="muted">Documents changed since the last run. Re-run to refresh.</p>}

      {result && (
        <>
          <p>
            <strong>{comparison.hasMismatch ? 'Mismatch found. ' : 'No mismatches. '}</strong>
            {result.summary}
          </p>
          {result.missingDocuments.length > 0 && (
            <p className="error">
              Missing documents:{' '}
              {result.missingDocuments.map((d) => DOC_TYPES.find((t) => t.key === d)?.label ?? d).join(', ')}
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  {result.sources.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.fields.map((f) => (
                  <tr key={f.field} className={f.status === 'MISMATCH' ? 'row-mismatch' : ''}>
                    <td>{FIELD_LABELS[f.field]}</td>
                    {result.sources.map((s) => (
                      <td key={s}>{f.values[s] ?? <em className="muted">—</em>}</td>
                    ))}
                    <td>
                      <StatusBadge value={f.status} />
                      <div className="muted small-text">{f.note}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small-text">Last run {new Date(comparison.createdAt).toLocaleString()}</p>
        </>
      )}
    </div>
  )
}
