import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Icon } from './Icon'
import { FIELD_LABELS, type VendorVersion } from '../types'

interface Props {
  vendorId: string
  currentVersion: number
  onRestored: () => void
}

export function VersionHistory({ vendorId, currentVersion, onRestored }: Props) {
  const [versions, setVersions] = useState<VendorVersion[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    api.listVersions(vendorId).then(setVersions).catch((e) => setError(e.message))
  }, [vendorId, currentVersion])

  async function restore(versionNo: number) {
    if (!confirm(`Restore vendor details to version ${versionNo}? A new version will be created so history is preserved.`)) return
    setBusy(versionNo)
    setError('')
    try {
      await api.restoreVersion(vendorId, versionNo)
      onRestored()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setBusy(null)
    }
  }

  const diffSets = versions.filter((v) => v.changedFields.length > 0).length

  return (
    <div>
      <div className="info-box" style={{ marginBottom: 16 }}>
        <Icon name="history_edu" size={20} />
        <div>
          <span className="strong">Version history</span>
          <div className="muted small-text">
            Every edit snapshots the vendor profile with a field-level diff. Showing {versions.length} version
            {versions.length === 1 ? '' : 's'} · {diffSets} change set{diffSets === 1 ? '' : 's'}.
          </div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {versions.map((v) => {
        const isCurrent = v.versionNo === currentVersion
        return (
          <div key={v.id} className="card flush">
            <div className="version-head-row">
              <div className="row" style={{ gap: 10 }}>
                <strong style={{ fontSize: 15 }}>Version {v.versionNo}</strong>
                {isCurrent ? (
                  <span className="badge badge-under_review">Current</span>
                ) : v.versionNo === 1 ? (
                  <span className="badge">Created</span>
                ) : null}
                <span className="muted small-text row" style={{ gap: 4 }}>
                  <Icon name="schedule" size={14} /> {new Date(v.createdAt).toLocaleString()}
                </span>
                {v.note && <span className="muted small-text">· {v.note}</span>}
              </div>
              {isCurrent ? (
                <span className="badge badge-verified">
                  <Icon name="check_circle" size={14} /> Active revision
                </span>
              ) : (
                <button className="secondary small" disabled={busy !== null} onClick={() => restore(v.versionNo)}>
                  <Icon name="restore" size={14} /> {busy === v.versionNo ? 'Restoring…' : 'Restore'}
                </button>
              )}
            </div>

            {v.changedFields.length > 0 && (
              <div className="version-tags">
                <span className="muted small-text">Modifications:</span>
                {v.changedFields.map((c) => (
                  <span key={c.field} className="chip-soft">
                    {FIELD_LABELS[c.field] ?? c.field}
                  </span>
                ))}
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Previous value</th>
                  <th>New value</th>
                </tr>
              </thead>
              <tbody>
                {v.changedFields.map((c) => (
                  <tr key={c.field}>
                    <td className="strong">{FIELD_LABELS[c.field] ?? c.field}</td>
                    <td>
                      {c.previous === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className="diff-old">{c.previous || '(empty)'}</span>
                      )}
                    </td>
                    <td>
                      <span className="diff-new">{c.next || '(empty)'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
