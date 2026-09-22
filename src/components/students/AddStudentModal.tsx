import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase as typedSupabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'
import {
  SEMESTER_OPTIONS,
  STUDENT_SCHOLARSHIP_STATUS_OPTIONS,
  STUDENT_YEAR_LEVEL_OPTIONS,
} from '@/types/database'
import { statusShortLabel } from '@/utils/statusStyle'

const supabase = typedSupabase as any

interface ProgramOption {
  id: string
  name: string
  collegeId: string
  collegeName: string
}

interface ScholarshipOption {
  id: string
  name: string
  categoryName: string
}

interface FormValues {
  studentNumber: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  dateOfBirth: string
  sex: string
  email: string
  contactNumber: string
  collegeId: string
  programId: string
  yearLevel: string
  academicYear: string
  semester: string
  scholarshipId: string
  scholarshipType: string
  scholarshipStatus: string
  dateAwarded: string
}

const EMPTY_FORM: FormValues = {
  studentNumber: '', firstName: '', middleName: '', lastName: '', suffix: '',
  dateOfBirth: '', sex: '', email: '', contactNumber: '', collegeId: '', programId: '',
  yearLevel: '', academicYear: '', semester: '', scholarshipId: '', scholarshipType: '',
  scholarshipStatus: '', dateAwarded: '',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STUDENT_NUMBER_PATTERN = /^[0-9]{2}-[0-9]{4}$/

type FieldErrors = Partial<Record<keyof FormValues | 'form', string>>

interface Props {
  open: boolean
  onClose: () => void
  onAdded: (studentName: string) => void
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--status-error-text)' }}> *</span>}
        </span>
        {children}
      </label>
      {error && <p className="mt-1 text-xs" style={{ color: 'var(--status-error-text)' }}>{error}</p>}
    </div>
  )
}

const controlClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-100'

export function AddStudentModal({ open, onClose, onAdded }: Props) {
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [scholarships, setScholarships] = useState<ScholarshipOption[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FORM)
    setErrors({})
    setLoadingOptions(true)

    Promise.all([
      supabase.from('programs').select('id, name, college_id, colleges ( name )').order('name'),
      supabase.from('scholarships').select('id, name, scholarship_categories ( name )').is('archived_at', null).order('name'),
    ]).then(([programResult, scholarshipResult]) => {
      if (programResult.error || scholarshipResult.error) {
        setErrors({ form: programResult.error?.message ?? scholarshipResult.error?.message ?? 'Could not load form options.' })
        setLoadingOptions(false)
        return
      }
      setPrograms((programResult.data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        collegeId: row.college_id,
        collegeName: row.colleges?.name ?? 'Unknown College',
      })))
      setScholarships((scholarshipResult.data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        categoryName: row.scholarship_categories?.name ?? 'Uncategorized',
      })))
      setLoadingOptions(false)
    })
  }, [open])

  const colleges = useMemo(() => {
    const map = new Map<string, string>()
    programs.forEach((program) => map.set(program.collegeId, program.collegeName))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [programs])

  const visiblePrograms = useMemo(
    () => form.collegeId ? programs.filter((program) => program.collegeId === form.collegeId) : programs,
    [programs, form.collegeId],
  )

  const scholarshipTypes = useMemo(
    () => [...new Set(scholarships.map((scholarship) => scholarship.categoryName))].sort(),
    [scholarships],
  )

  const visibleScholarships = useMemo(
    () => scholarships.filter((scholarship) => !form.scholarshipType || scholarship.categoryName === form.scholarshipType),
    [scholarships, form.scholarshipType],
  )

  const emailValid = !form.email.trim() || EMAIL_PATTERN.test(form.email.trim())
  const yearLevelValid = STUDENT_YEAR_LEVEL_OPTIONS.includes(form.yearLevel.trim() as (typeof STUDENT_YEAR_LEVEL_OPTIONS)[number])
  const coreFieldsValid = STUDENT_NUMBER_PATTERN.test(form.studentNumber.trim())
    && Boolean(form.firstName.trim() && form.lastName.trim() && form.collegeId && form.programId)
    && yearLevelValid
  const scholarshipFieldsValid = !form.scholarshipId || Boolean(form.academicYear.trim() && form.semester && form.scholarshipStatus)
  const canSubmit = coreFieldsValid && emailValid && scholarshipFieldsValid && !saving && !loadingOptions

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!form.studentNumber.trim()) next.studentNumber = 'Student ID is required.'
    else if (!STUDENT_NUMBER_PATTERN.test(form.studentNumber.trim())) next.studentNumber = 'Use the format 00-0000.'
    if (!form.firstName.trim()) next.firstName = 'First name is required.'
    if (!form.lastName.trim()) next.lastName = 'Last name is required.'
    if (!form.collegeId) next.collegeId = 'College/Department is required.'
    if (!form.programId) next.programId = 'Program/Course is required.'
    if (!form.yearLevel.trim()) next.yearLevel = 'Year level is required.'
    else if (!yearLevelValid) next.yearLevel = 'Enter 1st Year, 2nd Year, 3rd Year, 4th Year, 5th Year, or Graduate.'
    if (!emailValid) next.email = 'Enter a valid email address.'
    if (form.dateOfBirth && form.dateOfBirth > new Date().toISOString().slice(0, 10)) next.dateOfBirth = 'Date of birth cannot be in the future.'
    if (form.dateAwarded && form.dateAwarded > new Date().toISOString().slice(0, 10)) next.dateAwarded = 'Date awarded cannot be in the future.'
    if (form.scholarshipId && !form.academicYear.trim()) next.academicYear = 'Academic year is required when a scholarship is selected.'
    if (form.scholarshipId && !form.semester) next.semester = 'Semester is required when a scholarship is selected.'
    return next
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    setErrors({})
    const studentNumber = form.studentNumber.trim()

    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('student_number', studentNumber)
      .maybeSingle()

    if (existing) {
      setErrors({ studentNumber: 'Student ID already exists.' })
      setSaving(false)
      return
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({
        student_number: studentNumber,
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim() || null,
        middle_initial: form.middleName.trim() ? form.middleName.trim().charAt(0).toUpperCase() : null,
        last_name: form.lastName.trim(),
        suffix: form.suffix.trim() || null,
        date_of_birth: form.dateOfBirth || null,
        sex: form.sex || null,
        email: form.email.trim() || null,
        contact_number: form.contactNumber.trim() || null,
        program_id: form.programId,
        yr_level: form.yearLevel.trim(),
      })
      .select('id')
      .single()

    if (studentError || !student) {
      const duplicate = studentError?.code === '23505' || studentError?.message?.toLowerCase().includes('student_number')
      setErrors(duplicate
        ? { studentNumber: 'Student ID already exists.' }
        : { form: studentError?.message ?? 'The student could not be added.' })
      setSaving(false)
      return
    }

    if (form.scholarshipId) {
      const { error: assignmentError } = await supabase.from('student_scholarships').insert({
        student_id: student.id,
        scholarship_id: form.scholarshipId,
        academic_year: form.academicYear.trim(),
        semester: form.semester,
        status: form.scholarshipStatus,
        start_date: form.dateAwarded || null,
      })

      if (assignmentError) {
        await supabase.from('students').delete().eq('id', student.id)
        setErrors({ form: assignmentError.message })
        setSaving(false)
        return
      }
    }

    const studentName = `${form.firstName.trim()} ${form.middleName.trim() ? `${form.middleName.trim()} ` : ''}${form.lastName.trim()}${form.suffix.trim() ? ` ${form.suffix.trim()}` : ''}`
    await logActivity('create', 'student', `Added student ${studentName} (${studentNumber}).`, student.id)
    setSaving(false)
    onAdded(studentName)
  }

  if (!open) return null

  const inputStyle = (hasError?: boolean) => ({ borderColor: hasError ? 'var(--status-error-text)' : 'var(--input-border)' })

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="add-student-title">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--divider-light)' }}>
          <div>
            <h2 id="add-student-title" className="text-lg font-bold" style={{ color: 'var(--nav-header-dark)' }}>Add New Student</h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>Create one student record. Scholarship information is optional.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close Add Student" style={{ color: 'var(--icon-muted)' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>Student Information</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Student ID / Student Number" required error={errors.studentNumber}>
                <input value={form.studentNumber} onChange={(e) => update('studentNumber', e.target.value)} placeholder="e.g. 24-0123" className={controlClass} style={inputStyle(Boolean(errors.studentNumber))} />
              </Field>
              <Field label="First Name" required error={errors.firstName}><input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={controlClass} style={inputStyle(Boolean(errors.firstName))} /></Field>
              <Field label="Middle Name"><input value={form.middleName} onChange={(e) => update('middleName', e.target.value)} className={controlClass} style={inputStyle()} /></Field>
              <Field label="Last Name" required error={errors.lastName}><input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={controlClass} style={inputStyle(Boolean(errors.lastName))} /></Field>
              <Field label="Suffix"><input value={form.suffix} onChange={(e) => update('suffix', e.target.value)} placeholder="Jr., III" className={controlClass} style={inputStyle()} /></Field>
              <Field label="Date of Birth" error={errors.dateOfBirth}><input type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} className={controlClass} style={inputStyle(Boolean(errors.dateOfBirth))} /></Field>
              <Field label="Sex/Gender"><select value={form.sex} onChange={(e) => update('sex', e.target.value)} className={controlClass} style={inputStyle()}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></Field>
              <Field label="Email" error={errors.email}><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={controlClass} style={inputStyle(Boolean(errors.email))} /></Field>
              <Field label="Contact Number"><input type="tel" value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} className={controlClass} style={inputStyle()} /></Field>
            </div>
          </section>

          <section className="mt-6 border-t pt-5" style={{ borderColor: 'var(--divider-light)' }}>
            <h3 className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>Academic Information</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="College/Department" required error={errors.collegeId}>
                <select value={form.collegeId} onChange={(e) => { update('collegeId', e.target.value); update('programId', '') }} className={controlClass} style={inputStyle(Boolean(errors.collegeId))}><option value="">Select college</option>{colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
              </Field>
              <Field label="Program/Course" required error={errors.programId}>
                <select
                  value={form.programId}
                  onChange={(e) => {
                    const id = e.target.value
                    const selectedProgram = programs.find((program) => program.id === id)
                    update('programId', id)
                    if (selectedProgram) update('collegeId', selectedProgram.collegeId)
                  }}
                  disabled={loadingOptions}
                  className={controlClass}
                  style={inputStyle(Boolean(errors.programId))}
                >
                  <option value="">{loadingOptions ? 'Loading programs…' : 'Select program'}</option>
                  {visiblePrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {form.collegeId ? program.name : `${program.name} — ${program.collegeName}`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Year Level" required error={errors.yearLevel}><input value={form.yearLevel} onChange={(e) => update('yearLevel', e.target.value)} placeholder="Enter year level" className={controlClass} style={inputStyle(Boolean(errors.yearLevel))} /></Field>
              <Field label="Academic Year" error={errors.academicYear}><input value={form.academicYear} onChange={(e) => update('academicYear', e.target.value)} placeholder="e.g. 2026-2027" className={controlClass} style={inputStyle(Boolean(errors.academicYear))} /></Field>
              <Field label="Semester" error={errors.semester}><select value={form.semester} onChange={(e) => update('semester', e.target.value)} className={controlClass} style={inputStyle(Boolean(errors.semester))}><option value="">Select semester</option>{SEMESTER_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            </div>
          </section>

          <section className="mt-6 border-t pt-5" style={{ borderColor: 'var(--divider-light)' }}>
            <h3 className="mb-3 text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--widget-heading-text)' }}>Scholarship Information <span className="font-normal normal-case" style={{ color: 'var(--text-muted)' }}>(Optional)</span></h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Scholarship Type"><select value={form.scholarshipType} onChange={(e) => { update('scholarshipType', e.target.value); update('scholarshipId', '') }} className={controlClass} style={inputStyle()}><option value="">All types</option>{scholarshipTypes.map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Scholarship Program"><select value={form.scholarshipId} onChange={(e) => { const id = e.target.value; update('scholarshipId', id); const selected = scholarships.find((item) => item.id === id); if (selected) update('scholarshipType', selected.categoryName) }} className={controlClass} style={inputStyle()}><option value="">No scholarship</option>{visibleScholarships.map((scholarship) => <option key={scholarship.id} value={scholarship.id}>{scholarship.name}</option>)}</select></Field>
              <Field label="Scholarship Status"><select value={form.scholarshipStatus} onChange={(e) => update('scholarshipStatus', e.target.value)} className={controlClass} style={inputStyle()}><option value="">Select status</option>{STUDENT_SCHOLARSHIP_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{statusShortLabel(value)}</option>)}</select></Field>
              <Field label="Date Awarded" error={errors.dateAwarded}><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateAwarded} onChange={(e) => update('dateAwarded', e.target.value)} className={controlClass} style={inputStyle(Boolean(errors.dateAwarded))} /></Field>
            </div>
          </section>

          {errors.form && <p role="alert" className="mt-5 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-incomplete-bg)', color: 'var(--status-incomplete-text)' }}>{errors.form}</p>}

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-2 border-t px-6 pt-4 pb-1" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--menu-hover-bg)] disabled:opacity-60" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={!canSubmit} className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[var(--btn-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>{saving ? 'Adding Student…' : 'Add Student'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
