import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { DocumentCard } from './DocumentCard'
import { ComparisonPanel } from './ComparisonPanel'
import { DOC_TYPES, type VendorDocument } from '../types'

export function DocumentsTab({ vendorId }: { vendorId: string }) {
  const [docs, setDocs] = useState<VendorDocument[]>([])
  const [error, setError] = useState('')
  const [changes, setChanges] = useState(0)

  const load = useCallback(() => {
    api.listDocuments(vendorId).then(setDocs).catch((e) => setError(e.message))
  }, [vendorId])

  useEffect(load, [load])

  return (
    <div>
      {error && <p className="error">{error}</p>}
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
            }}
          />
        ))}
      </div>
      <ComparisonPanel vendorId={vendorId} refreshKey={changes} />
    </div>
  )
}
