import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { Icon } from './Icon'
import { VENDOR_FIELDS, type VendorDetails } from '../types'

export const EMPTY_VENDOR: VendorDetails = Object.fromEntries(VENDOR_FIELDS.map((f) => [f.key, ''])) as VendorDetails

interface Props {
  initial?: VendorDetails
  submitLabel: string
  /** Shows the form section header + description (used on the Details tab, not the compact "New vendor" card). */
  withHeader?: boolean
  onSubmit: (data: VendorDetails) => Promise<void>
}

export function VendorForm({ initial = EMPTY_VENDOR, submitLabel, withHeader, onSubmit }: Props) {
  const [values, setValues] = useState<VendorDetails>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const dirty = VENDOR_FIELDS.some((f) => values[f.key] !== initial[f.key])

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
    <form className={withHeader ? 'card flush' : ''} onSubmit={handleSubmit}>
      {withHeader && (
        <div className="form-header">
          <div>
            <h2>Entity &amp; Banking Information</h2>
            <p className="subtitle">Legal identity details, tax IDs, and settlement bank credentials.</p>
          </div>
        </div>
      )}

      <div className={withHeader ? 'vendor-form padded' : 'vendor-form'}>
        {VENDOR_FIELDS.map((f) => {
          const hasError = !!fieldErrors[f.key]
          const multiline = 'multiline' in f
          const icon = 'icon' in f ? f.icon : undefined
          return (
            <label key={f.key} className={multiline ? 'span-2' : ''}>
              <span className={hasError ? 'error' : ''}>
                {f.label}
                {'required' in f && f.required && <em> *</em>}
              </span>
              {multiline ? (
                <textarea
                  rows={2}
                  value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : (
                <div className="field-wrap">
                  <input
                    type={'type' in f ? f.type : 'text'}
                    className={`${hasError ? 'input-error' : ''} ${'mono' in f && f.mono ? 'mono' : ''}`}
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                  {icon && <Icon name={hasError ? 'error' : icon} />}
                </div>
              )}
              {hasError && (
                <small className="error field-msg">
                  <Icon name="info" size={14} /> {fieldErrors[f.key]}
                </small>
              )}
            </label>
          )
        })}
      </div>

      <div className={withHeader ? 'form-footer' : 'span-2 form-actions'}>
        {error && !Object.keys(fieldErrors).length && <span className="error">{error}</span>}
        {withHeader && dirty && (
          <span className="muted small-text dirty-note">
            <Icon name="edit" size={14} /> Unsaved changes
          </span>
        )}
        <div className="row" style={{ marginLeft: 'auto' }}>
          {withHeader && (
            <button type="button" className="secondary" disabled={!dirty || saving} onClick={() => setValues(initial)}>
              Discard
            </button>
          )}
          <button type="submit" disabled={saving || (withHeader && !dirty)}>
            {saving ? 'Saving…' : (
              <>
                {withHeader && <Icon name="save" />} {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
