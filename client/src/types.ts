export type VendorStatus = 'DRAFT' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED'

export const VENDOR_FIELDS = [
  { key: 'companyName', label: 'Company Name', required: true },
  { key: 'contactPerson', label: 'Contact Person', required: true },
  { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', multiline: true },
  { key: 'regNumber', label: 'Company Registration Number' },
  { key: 'gstNumber', label: 'GST / Tax Number' },
  { key: 'bankAccount', label: 'Bank Account Number' },
  { key: 'ifsc', label: 'IFSC Code' },
] as const

export type VendorFieldKey = (typeof VENDOR_FIELDS)[number]['key']
export type VendorDetails = Record<VendorFieldKey, string>

export const FIELD_LABELS = Object.fromEntries(VENDOR_FIELDS.map((f) => [f.key, f.label])) as Record<string, string>

export interface Vendor extends VendorDetails {
  id: string
  status: VendorStatus
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface FieldChange {
  field: string
  previous: string | null
  next: string
}

export type DocType = 'REGISTRATION' | 'GST' | 'BANK'

export const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: 'REGISTRATION', label: 'Company Registration Certificate' },
  { key: 'GST', label: 'GST / Tax Certificate' },
  { key: 'BANK', label: 'Bank Document' },
]

export const EXTRACTED_FIELDS = ['companyName', 'regNumber', 'gstNumber', 'address', 'bankAccount', 'ifsc'] as const
export type ExtractedField = (typeof EXTRACTED_FIELDS)[number]

export type ExtractedData = Record<ExtractedField, string | null> & {
  detectedDocumentType?: string
  notes?: string
}

export interface VendorDocument {
  id: string
  docType: DocType
  originalName: string
  mimeType: string
  extractionStatus: 'PENDING' | 'EXTRACTED' | 'FAILED'
  extractedData: ExtractedData | null
  extractionError: string | null
  editedAt: string | null
  uploadedAt: string
}

export interface ComparisonField {
  field: ExtractedField
  status: 'MATCH' | 'MISMATCH' | 'MISSING'
  note: string
  values: Record<string, string | null>
}

export interface Comparison {
  id: string
  hasMismatch: boolean
  createdAt: string
  result: {
    fields: ComparisonField[]
    summary: string
    missingDocuments: DocType[]
    sources: string[]
  }
}

export interface VendorVersion {
  id: string
  versionNo: number
  snapshot: VendorDetails
  changedFields: FieldChange[]
  note: string | null
  createdAt: string
}
