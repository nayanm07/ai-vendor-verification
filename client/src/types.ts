export type VendorStatus = 'DRAFT' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED'

export const VENDOR_FIELDS = [
  { key: 'companyName', label: 'Company Name', required: true, icon: 'domain' },
  { key: 'contactPerson', label: 'Contact Person', required: true, icon: 'person' },
  { key: 'email', label: 'Email', required: true, type: 'email', icon: 'mail' },
  { key: 'phone', label: 'Phone', icon: 'call' },
  { key: 'address', label: 'Address', multiline: true },
  { key: 'regNumber', label: 'Company Registration Number', icon: 'tag', mono: true },
  { key: 'gstNumber', label: 'GST / Tax Number', icon: 'receipt_long', mono: true },
  { key: 'bankAccount', label: 'Bank Account Number', icon: 'account_balance', mono: true },
  { key: 'ifsc', label: 'IFSC Code', icon: 'qr_code_2', mono: true },
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

export interface Verification {
  id: string
  source: string
  searchedBy: 'regNumber' | 'companyName'
  query: string
  result: 'VERIFIED' | 'MISMATCH' | 'UNABLE_TO_VERIFY'
  error: string | null
  createdAt: string
  rawResponse: unknown
  details: {
    company: {
      name: string
      companyNumber: string
      jurisdiction: string
      status: string | null
      incorporationDate: string | null
      companyType: string | null
      address: string | null
      url: string
    }
    checks: { field: string; vendorValue: string | null; registryValue: string | null; match: boolean | null }[]
    isActive: boolean
    mismatches: string[]
  } | null
}

export interface ChecklistItem {
  docType: DocType
  label: string
  status: 'MISSING' | 'AVAILABLE' | 'VERIFIED'
  reason: string
  documentId: string | null
  lastReminderAt: string | null
}

export interface EmailLog {
  id: string
  toEmail: string
  subject: string
  missingDoc: DocType
  status: 'SENT' | 'FAILED'
  providerId: string | null
  error: string | null
  sentAt: string
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TaskStatus = 'PENDING' | 'COMPLETED'

export interface Task {
  id: string
  vendorId: string
  title: string
  description: string | null
  priority: TaskPriority
  dueDate: string
  status: TaskStatus
  sourceKey: string | null
  createdAt: string
  completedAt: string | null
  vendor?: { id: string; companyName: string }
}

export interface Activity {
  id: string
  type: string
  message: string
  actor: string
  createdAt: string
}

export interface Evaluation {
  status: VendorStatus
  issues: { key: string; title: string; priority: TaskPriority }[]
  emailsSent: DocType[]
  emailError: string | null
  tasksCreated: number
  tasksResolved: number
}

export interface VendorVersion {
  id: string
  versionNo: number
  snapshot: VendorDetails
  changedFields: FieldChange[]
  note: string | null
  createdAt: string
}
