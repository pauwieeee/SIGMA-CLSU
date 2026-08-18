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
  agency_id: string
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
}

const emptyForm: ScholarshipFormValues = {
  name: '',
  code: '',
  description: '',
  agency_id: '',
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
    setSaving(true)
    setError(null)

    const { data: categoryRow } = await supabase
      .from('scholarship_categories')
      .select('id')
      .eq('name', category)
      .single()

    if (!categoryRow) {
      setError('Category lookup failed.')
      setSaving(false)
      return
    }

    const payload = {
      category_id: (categoryRow as { id: string }).id,
      agency_id: form.agency_id || null,
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
    }

    const isEdit = !!form.id
    const { error } = isEdit
      ? await (supabase as any).from('scholarships').update(payload).eq('id', form.id)
      : await (supabase as any).from('scholarships').insert(payload)

    setSaving(false)

    if (error) {
      setError(error.message.includes('duplicate') ? 'A scholarship with this name already exists in this category.' : error.message)
      return
    }

    await logActivity(
      isEdit ? 'update' : 'create',
      'scholarship',
      isEdit ? `Updated scholarship "${payload.name}".` : `Added new scholarship "${payload.name}".`,
      form.id
    )

    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl shadow-xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--divider-light)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--nav-header-dark)' }}>
            {form.id ? 'Edit Scholarship' : 'Add Scholarship'} — {category}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--icon-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
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
            {agencies.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Agency (optional)</label>
                <select
                  value={form.agency_id}
                  onChange={(e) => setForm((f) => ({ ...f, agency_id: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--input-border)' }}
                >
                  <option value="">Standalone (no agency group)</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="flex justify-end gap-2 pt-2">
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
              {saving ? 'Saving…' : 'Save Scholarship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
