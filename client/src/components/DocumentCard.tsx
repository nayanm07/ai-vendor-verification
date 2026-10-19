import { useState } from 'react'
import { api } from '../api/client'
import { StatusBadge } from './StatusBadge'
import { EXTRACTED_FIELDS, FIELD_LABELS, type DocType, type ExtractedData, type VendorDocument } from '../types'

interface Props {
  vendorId: string
  docType: DocType
  label: string
  doc?: VendorDocument
  onChange: () => void
}

export function DocumentCard({ vendorId, docType, label, doc, onChange }: Props) {
  const [busy, setBusy] = useState<'' | 'upload' | 'extract' | 'save' | 'delete'>('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<ExtractedData>>({})

  async function run(kind: typeof busy, fn: () => Promise<unknown>) {
    setBusy(kind)
    setError('')
    try {
      await fn()
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy('')
    }
  }

  function startEdit() {
    setDraft({ ...(doc?.extractedData ?? {}) })
    setEditing(true)
  }

  const data = doc?.extractedData
  const typeMismatch =
    data?.detectedDocumentType && data.detectedDocumentType !== 'OTHER' && data.detectedDocumentType !== docType

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>{label}</h2>
        {doc ? <StatusBadge value={doc.extractionStatus} /> : <StatusBadge value="MISSING" />}
        {doc?.editedAt && <span className="badge">Manually corrected</span>}
      </div>

      {doc && (
        <p className="muted">
          <a href={api.documentFileUrl(doc.id)} target="_blank" rel="noreferrer">
            {doc.originalName}
          </a>{' '}
          · uploaded {new Date(doc.uploadedAt).toLocaleString()}
        </p>
      )}

      <div className="row">
        <label className="file-btn">
          {busy === 'upload' ? 'Uploading & extracting…' : doc ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            disabled={!!busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) run('upload', () => api.uploadDocument(vendorId, docType, file))
            }}
          />
        </label>
        {doc && (
          <>
            <button className="secondary small" disabled={!!busy} onClick={() => run('extract', () => api.reExtract(doc.id))}>
              {busy === 'extract' ? 'Extracting…' : 'Re-run AI extraction'}
            </button>
            {data && !editing && (
              <button className="secondary small" disabled={!!busy} onClick={startEdit}>
                Edit values
              </button>
            )}
            <button
              className="danger small"
              disabled={!!busy}
              onClick={() => confirm('Delete this document?') && run('delete', () => api.deleteDocument(doc.id))}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {doc?.extractionStatus === 'FAILED' && <p className="error">Extraction failed: {doc.extractionError}</p>}
      {typeMismatch && (
        <p className="error">⚠ AI thinks this looks like a {data?.detectedDocumentType} document, not {docType}.</p>
      )}

      {data && (
        <table>
          <tbody>
            {EXTRACTED_FIELDS.map((f) => (
              <tr key={f}>
                <td style={{ width: '40%' }}>{FIELD_LABELS[f]}</td>
                <td>
                  {editing ? (
                    <input value={draft[f] ?? ''} onChange={(e) => setDraft({ ...draft, [f]: e.target.value })} />
                  ) : (
                    data[f] ?? <em className="muted">not found</em>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.notes && !editing && <p className="muted">AI note: {data.notes}</p>}

      {editing && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="secondary small" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            className="small"
            disabled={!!busy}
            onClick={() =>
              run('save', async () => {
                await api.updateExtracted(doc!.id, draft)
                setEditing(false)
              })
            }
          >
            {busy === 'save' ? 'Saving…' : 'Save corrections'}
          </button>
        </div>
      )}
    </div>
  )
}
