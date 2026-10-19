import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { VENDOR_FIELDS, type VendorDetails } from '../types'

export const EMPTY_VENDOR: VendorDetails = Object.fromEntries(VENDOR_FIELDS.map((f) => [f.key, ''])) as VendorDetails

interface Props {
  initial?: VendorDetails
  submitLabel: string
  onSubmit: (data: VendorDetails) => Promise<void>
}

export function VendorForm({ initial = EMPTY_VENDOR, submitLabel, onSubmit }: Props) {
  const [values, setValues] = useState<VendorDetails>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})
    try {
      await onSubmit(values)
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])))
      }
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="vendor-form" onSubmit={handleSubmit}>
      {VENDOR_FIELDS.map((f) => (
        <label key={f.key} className={'multiline' in f ? 'span-2' : ''}>
          <span>
            {f.label}
            {'required' in f && f.required && <em> *</em>}
          </span>
          {'multiline' in f ? (
            <textarea
              rows={2}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          ) : (
            <input
              type={'type' in f ? f.type : 'text'}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
          {fieldErrors[f.key] && <small className="error">{fieldErrors[f.key]}</small>}
        </label>
      ))}
      <div className="span-2 form-actions">
        {error && <span className="error">{error}</span>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
