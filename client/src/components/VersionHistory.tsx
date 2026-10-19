import { useEffect, useState } from 'react'
import { api } from '../api/client'
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
    if (!confirm(`Restore vendor details to version ${versionNo}? A new version will be created.`)) return
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

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {versions.map((v) => (
        <div key={v.id} className="card version">
          <div className="version-head">
            <strong>Version {v.versionNo}</strong>
            {v.versionNo === currentVersion && <span className="badge badge-verified">Current</span>}
            <span className="muted">{new Date(v.createdAt).toLocaleString()}</span>
            {v.note && <span className="muted">· {v.note}</span>}
            {v.versionNo !== currentVersion && (
              <button className="secondary" disabled={busy !== null} onClick={() => restore(v.versionNo)}>
                {busy === v.versionNo ? 'Restoring…' : 'Restore'}
              </button>
            )}
          </div>
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
                  <td>{FIELD_LABELS[c.field] ?? c.field}</td>
                  <td className="old">{c.previous === null ? <em className="muted">—</em> : c.previous || <em className="muted">(empty)</em>}</td>
                  <td className="new">{c.next || <em className="muted">(empty)</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
