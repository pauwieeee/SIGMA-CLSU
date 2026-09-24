import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ScholarshipCategoryName, ScholarshipStatus } from '@/types/database'
import { logActivity } from '@/utils/logActivity'

interface Agency {
  id: string
  name: string
}

const levelChoices = ['Undergraduate', 'Graduate'] as const

interface ScholarshipFormValues {
  id?: string
  name: string
  code: string
  description: string
  agency_name: string
  status: ScholarshipStatus
  start_date: string
  end_date: string
  notes: string
  level: string
  qualifications: string
  application_requirements: string
  benefits_amount: string
  coverage_deadline: string
  contact_person: string
  contact_email: string
  min_gwa: string
  min_units: string
}

const emptyForm: ScholarshipFormValues = {
  name: '',
  code: '',
  description: '',
  agency_name: '',
  status: 'Active',
  start_date: '',
  end_date: '',
  notes: '',
  level: 'Undergraduate',
  qualifications: '',
  application_requirements: '',
  benefits_amount: '',
  coverage_deadline: '',
  contact_person: '',
  contact_email: '',
  min_gwa: '',
  min_units: '',
}

interface Props {
  open: boolean
  category: ScholarshipCategoryName
  initial?: ScholarshipFormValues
  onClose: () => void
  onSaved: () => void
}

export function ScholarshipFormModal({ open, category, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ScholarshipFormValues>(initial ?? emptyForm)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(initial ?? emptyForm)
    setError(null)
  }, [initial, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  useEffect(() => {
    if (!open) return
    supabase
      .from('scholarship_categories')
      .select('id, scholarship_agencies ( id, name )')
      .eq('name', category)
      .single()
      .then(({ data }) => {
        setAgencies((data as any)?.scholarship_agencies ?? [])
      })
  }, [open, category])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Scholarship name is required.')
      return
    }
    const minGwaValue = form.min_gwa.trim() ? Number(form.min_gwa) : null
    const minUnitsValue = form.min_units.trim() ? Number(form.min_units) : null
    if (form.min_gwa.trim() && (Number.isNaN(minGwaValue) || minGwaValue! < 1 || minGwaValue! > 5)) {
      setError('Minimum GWA must be a number between 1.00 and 5.00.')
      return
    }
    if (form.min_units.trim() && (Number.isNaN(minUnitsValue) || minUnitsValue! < 0)) {
      setError('Minimum units must be a positive number.')
      return
    }
    if (form.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      setError('Enter a valid contact email address.')
      return
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date cannot be earlier than the start date.')
      return
    }

    setSaving(true)
    setError(null)

    const { data: categoryRow, error: categoryError } = await supabase
      .from('scholarship_categories')
      .select('id')
      .eq('name', category)
      .single()

    if (categoryError || !categoryRow) {
      console.error('Scholarship category lookup failed:', categoryError)
      setError('Unable to save the scholarship. Please try again.')
      setSaving(false)
      return
    }
    const categoryId = (categoryRow as { id: string }).id

    let agencyId: string | null = null
    const agencyName = form.agency_name.trim()
    if (agencyName) {
      const existing = agencies.find((a) => a.name.toLowerCase() === agencyName.toLowerCase())
      if (existing) {
        agencyId = existing.id
      } else {
        const { data: newAgency, error: agencyError } = await (supabase as any)
          .from('scholarship_agencies')
          .insert({ category_id: categoryId, name: agencyName })
          .select('id')
          .single()
        if (agencyError) {
          console.error('Scholarship agency creation failed:', agencyError)
          setError(`Unable to create agency "${agencyName}". Please try again.`)
          setSaving(false)
          return
        }
        agencyId = newAgency.id
      }
    }

    const payload = {
      category_id: categoryId,
      agency_id: agencyId,
      name: form.name.trim(),
      code: form.code || null,
      description: form.description || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
      level: form.level || null,
      qualifications: form.qualifications || null,
      application_requirements: form.application_requirements || null,
      benefits_amount: form.benefits_amount || null,
      coverage_deadline: form.coverage_deadline || null,
      contact_person: form.contact_person || null,
      contact_email: form.contact_email || null,
      min_gwa: minGwaValue,
      min_units: minUnitsValue,
    }

    const isEdit = !!form.id
    const { error } = isEdit
      ? await (supabase as any).from('scholarships').update(payload).eq('id', form.id)
      : await (supabase as any).from('scholarships').insert(payload)

    setSaving(false)

    if (error) {
      console.error(`${isEdit ? 'Scholarship update' : 'Scholarship creation'} failed:`, error)
      setError(error.message.includes('duplicate') ? 'A scholarship with this name already exists in this category.' : 'Unable to save the scholarship. Please try again.')
      return
    }

    onSaved()
    onClose()
    void logActivity(
      isEdit ? 'update' : 'create',
      'scholarship',
      isEdit ? `Updated scholarship "${payload.name}".` : `Added new scholarship "${payload.name}".`,
      form.id
    ).catch((activityError) => console.error('Activity logging failed:', activityError))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="scholarship-modal-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <div className="min-w-0">
            <h2 id="scholarship-modal-title" className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
              {form.id ? 'Edit Scholarship' : 'Add Scholarship'}
            </h2>
            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{form.id ? form.name : category}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-md p-1 hover:bg-[var(--menu-hover-bg)]" style={{ color: 'var(--icon-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              >
                {levelChoices.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Agency (optional)</label>
              <input
                list="agency-suggestions"
                value={form.agency_name}
                onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                placeholder="e.g. CHED — leave blank if standalone"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
              <datalist id="agency-suggestions">
                {agencies.map((a) => (
                  <option key={a.id} value={a.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Scholarship Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="e.g. CHED Tertiary Education Subsidy (TES)"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Qualifications</label>
              <textarea
                value={form.qualifications}
                onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
                rows={2}
                placeholder="Eligibility requirements…"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Application Requirements</label>
              <textarea
                value={form.application_requirements}
                onChange={(e) => setForm((f) => ({ ...f, application_requirements: e.target.value }))}
                rows={2}
                placeholder="Documents needed…"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Minimum GWA (optional)</label>
              <input
                value={form.min_gwa}
                onChange={(e) => setForm((f) => ({ ...f, min_gwa: e.target.value }))}
                placeholder="e.g. 1.75"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Minimum Units Enrolled (optional)</label>
              <input
                value={form.min_units}
                onChange={(e) => setForm((f) => ({ ...f, min_units: e.target.value }))}
                placeholder="e.g. 15"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Set these for academic scholarships to auto-flag students who don't meet the requirement. Leave blank if this scholarship has no GWA/unit-load requirement.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Benefits / Amount</label>
              <input
                value={form.benefits_amount}
                onChange={(e) => setForm((f) => ({ ...f, benefits_amount: e.target.value }))}
                placeholder="e.g. ₱10,000 per semester"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Coverage A.Y. / Deadline</label>
              <input
                value={form.coverage_deadline}
                onChange={(e) => setForm((f) => ({ ...f, coverage_deadline: e.target.value }))}
                placeholder="e.g. A.Y. 2025-2026, deadline Aug 30"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contact Person(s)</label>
              <input
                value={form.contact_person}
                onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                placeholder="e.g. Ms. Santos, OAd Scholarship Unit"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="e.g. scholarships@clsu.edu.ph"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                min={form.start_date || undefined}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--input-border)' }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ScholarshipStatus }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--input-border)' }}
            >
              <option>Active</option>
              <option>Expiring Soon</option>
              <option>Inactive</option>
            </select>
          </div>

          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>
              {error}
            </p>
          )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-5" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)]"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:opacity-60"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Save Scholarship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
