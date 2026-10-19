import type { Vendor, VendorDetails, VendorVersion, FieldChange } from '../types'

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
}
