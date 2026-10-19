import { useRef, useState } from 'react'
import { api } from '../api/client'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { EXTRACTED_FIELDS, FIELD_LABELS, type DocType, type ExtractedData, type VendorDocument } from '../types'

interface Props {
  vendorId: string
  docType: DocType
  label: string
  doc?: VendorDocument
  onChange: () => void
}

/** Fields a reviewer expects each document type to provide (shown as chips on an empty card). */
const EXPECTED: Record<DocType, string[]> = {
  REGISTRATION: ['Company Name', 'Reg. Number', 'Address'],
  GST: ['Company Name', 'GST Number', 'Address'],
  BANK: ['Account No', 'IFSC Code', 'Branch Address'],
}

export function DocumentCard({ vendorId, docType, label, doc, onChange }: Props) {
  const [busy, setBusy] = useState<'' | 'upload' | 'extract' | 'save' | 'delete'>('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<ExtractedData>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

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

  const upload = (file: File) => run('upload', () => api.uploadDocument(vendorId, docType, file))

  function startEdit() {
    setDraft({ ...(doc?.extractedData ?? {}) })
    setEditing(true)
  }

  const data = doc?.extractedData
  const typeMismatch =
    data?.detectedDocumentType && data.detectedDocumentType !== 'OTHER' && data.detectedDocumentType !== docType

  return (
    <div className="card flush doc-card">
      <div className="doc-card-head">
        <h2>{label}</h2>
        <div className="row" style={{ gap: 6 }}>
          <StatusBadge value={doc ? doc.extractionStatus : 'MISSING'} />
          {doc?.editedAt && <span className="badge badge-under_review">Manually corrected</span>}
        </div>
      </div>

      <div className="doc-card-body">
        {/* Empty state: dropzone */}
        {!doc && (
          <>
            <div
              className={`dropzone ${dragOver ? 'over' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) upload(file)
              }}
            >
              <div className="dz-icon">
                <Icon name="cloud_upload" size={24} />
              </div>
              <p className="strong">{busy === 'upload' ? 'Uploading & extracting…' : 'Drop a PDF or image here, or click to upload.'}</p>
              <p className="muted small-text">PDF, PNG, JPG up to 10MB</p>
              <button type="button" className="secondary small" disabled={!!busy}>
                Browse files
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                style={{ display: 'none' }}
                disabled={!!busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) upload(file)
                }}
              />
            </div>
            <div className="expected">
              <span className="muted small-text">Required fields extracted from this document:</span>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                {EXPECTED[docType].map((f) => (
                  <span key={f} className="chip-soft">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Uploaded */}
        {doc && (
          <>
            <a className="doc-file" href={api.documentFileUrl(doc.id)} target="_blank" rel="noreferrer">
              <Icon name="description" size={18} />
              <span className="truncate">{doc.originalName}</span>
              <span className="muted small-text">· {new Date(doc.uploadedAt).toLocaleDateString()}</span>
            </a>

            {!editing && (
              <div className="row doc-tools">
                <label className="file-btn">
                  <Icon name="upload_file" size={14} /> {busy === 'upload' ? 'Uploading…' : 'Replace'}
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    disabled={!!busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) upload(file)
                    }}
                  />
                </label>
                <button className="secondary small" disabled={!!busy} onClick={() => run('extract', () => api.reExtract(doc.id))}>
                  <Icon name="refresh" size={14} /> {busy === 'extract' ? 'Extracting…' : 'Re-run AI'}
                </button>
                {data && (
                  <button className="secondary small" disabled={!!busy} onClick={startEdit}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                )}
                <button
                  className="danger small"
                  disabled={!!busy}
                  onClick={() => confirm('Delete this document?') && run('delete', () => api.deleteDocument(doc.id))}
                >
                  <Icon name="delete" size={14} />
                </button>
              </div>
            )}

            {error && <p className="error small-text">{error}</p>}
            {doc.extractionStatus === 'FAILED' && <p className="error small-text">Extraction failed: {doc.extractionError}</p>}
            {typeMismatch && (
              <p className="error small-text">
                <Icon name="warning" size={14} /> AI thinks this is a {data?.detectedDocumentType} document, not {docType}.
              </p>
            )}

            {editing && (
              <div className="edit-banner">
                <Icon name="edit_note" size={16} /> Editing extracted values
              </div>
            )}

            {data && !editing && (
              <div className="kv-list">
                {EXTRACTED_FIELDS.map((f) => (
                  <div className="kv" key={f}>
                    <span className="muted small-text">{FIELD_LABELS[f]}</span>
                    {data[f] ? <span className="kv-val">{data[f]}</span> : <span className="muted small-text" style={{ fontStyle: 'italic' }}>not found</span>}
                  </div>
                ))}
              </div>
            )}

            {editing && (
              <div className="edit-fields">
                {EXTRACTED_FIELDS.map((f) => (
                  <label key={f} className="edit-field">
                    <span className="muted small-text">{FIELD_LABELS[f]}</span>
                    <input value={draft[f] ?? ''} onChange={(e) => setDraft({ ...draft, [f]: e.target.value })} />
                  </label>
                ))}
              </div>
            )}

            {data?.notes && !editing && <p className="muted small-text">AI note: {data.notes}</p>}
          </>
        )}
      </div>

      {editing && (
        <div className="doc-card-foot">
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
