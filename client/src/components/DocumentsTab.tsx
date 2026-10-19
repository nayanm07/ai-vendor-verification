import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Icon } from './Icon'
import { DocumentCard } from './DocumentCard'
import { ComparisonPanel } from './ComparisonPanel'
import { DOC_TYPES, FIELD_LABELS, type VendorDocument } from '../types'

export function DocumentsTab({ vendorId, onChange }: { vendorId: string; onChange?: () => void }) {
  const [docs, setDocs] = useState<VendorDocument[]>([])
  const [error, setError] = useState('')
  const [changes, setChanges] = useState(0)
  const [filling, setFilling] = useState(false)
  const [fillMsg, setFillMsg] = useState('')

  const load = useCallback(() => {
    api.listDocuments(vendorId).then(setDocs).catch((e) => setError(e.message))
  }, [vendorId])

  useEffect(load, [load])

  const extractedCount = docs.filter((d) => d.extractionStatus === 'EXTRACTED').length

  async function fillForm() {
    setFilling(true)
    setFillMsg('')
    setError('')
    try {
      const { filled } = await api.fillFromDocuments(vendorId)
      setFillMsg(
        filled.length
          ? `Filled ${filled.length} empty field(s): ${filled.map((f) => FIELD_LABELS[f] ?? f).join(', ')}. Check the Details tab.`
          : 'Nothing to fill — all form fields already have values.',
      )
      onChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fill the form')
    } finally {
      setFilling(false)
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {extractedCount > 0 && (
        <div className="info-box" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 10 }}>
            <Icon name="auto_fix_high" size={20} />
            <div>
              <span className="strong">Fill the vendor form from these documents</span>
              <div className="muted small-text">
                Copies extracted values into <em>empty</em> form fields only — it never overwrites what you typed, so the
                AI comparison still works.
              </div>
            </div>
          </div>
          <button className="secondary small" disabled={filling} onClick={fillForm} style={{ flexShrink: 0 }}>
            {filling ? 'Filling…' : 'Fill form from documents'}
          </button>
        </div>
      )}
      {fillMsg && <p className="notice banner-row"><Icon name="check_circle" size={16} /> {fillMsg}</p>}

      <div className="doc-grid">
        {DOC_TYPES.map((t) => (
          <DocumentCard
            key={t.key}
            vendorId={vendorId}
            docType={t.key}
            label={t.label}
            doc={docs.find((d) => d.docType === t.key)}
            onChange={() => {
              load()
              setChanges((c) => c + 1)
              onChange?.()
            }}
          />
        ))}
      </div>
      <ComparisonPanel vendorId={vendorId} refreshKey={changes} onCompared={onChange} />
    </div>
  )
}
