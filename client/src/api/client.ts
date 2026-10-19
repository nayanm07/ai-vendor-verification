import type {
  Comparison,
  DocType,
  ExtractedData,
  FieldChange,
  Vendor,
  VendorDetails,
  VendorDocument,
  VendorVersion,
  Verification,
} from '../types'

export class ApiError extends Error {
  status: number
  details?: { field: string; message: string }[]

  constructor(message: string, status: number, details?: { field: string; message: string }[]) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 0)
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.details)
  return body as T
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
})

type UpdateResult = { vendor: Vendor; changes: FieldChange[] }

export const api = {
  listVendors: () => request<Vendor[]>('/vendors'),
  getVendor: (id: string) => request<Vendor>(`/vendors/${id}`),
  createVendor: (data: VendorDetails) => request<Vendor>('/vendors', json('POST', data)),
  updateVendor: (id: string, data: VendorDetails) => request<UpdateResult>(`/vendors/${id}`, json('PUT', data)),
  listVersions: (id: string) => request<VendorVersion[]>(`/vendors/${id}/versions`),
  restoreVersion: (id: string, versionNo: number) =>
    request<UpdateResult>(`/vendors/${id}/versions/${versionNo}/restore`, json('POST')),

  listDocuments: (vendorId: string) => request<VendorDocument[]>(`/vendors/${vendorId}/documents`),
  uploadDocument: (vendorId: string, docType: DocType, file: File) => {
    const form = new FormData()
    form.append('docType', docType)
    form.append('file', file)
    return request<VendorDocument>(`/vendors/${vendorId}/documents`, { method: 'POST', body: form })
  },
  reExtract: (docId: string) => request<VendorDocument>(`/documents/${docId}/extract`, json('POST')),
  updateExtracted: (docId: string, extractedData: Partial<ExtractedData>) =>
    request<VendorDocument>(`/documents/${docId}`, json('PUT', { extractedData })),
  deleteDocument: (docId: string) => request<null>(`/documents/${docId}`, json('DELETE')),
  documentFileUrl: (docId: string) => `/api/documents/${docId}/file`,

  compare: (vendorId: string) => request<Comparison>(`/vendors/${vendorId}/compare`, json('POST')),
  latestComparison: (vendorId: string) => request<Comparison | null>(`/vendors/${vendorId}/comparisons/latest`),

  verify: (vendorId: string) => request<Verification>(`/vendors/${vendorId}/verify`, json('POST')),
  latestVerification: (vendorId: string) => request<Verification | null>(`/vendors/${vendorId}/verifications/latest`),
}
