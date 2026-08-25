import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ScholarshipRow {
  id: string
  name: string
  code: string | null
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  notes: string | null
  agency_id: string | null
  agency_name: string | null
  category_name: string
  is_expiring_soon: boolean
  level: string | null
  qualifications: string | null
  application_requirements: string | null
  benefits_amount: string | null
  coverage_deadline: string | null
  contact_person: string | null
  contact_email: string | null
  min_gwa: number | null
  min_units: number | null
}

export function useScholarships(categoryName: string, showArchived = false) {
  const [rows, setRows] = useState<ScholarshipRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('scholarships')
      .select(
        'id, name, code, description, status, start_date, end_date, notes, agency_id, is_expiring_soon, level, qualifications, application_requirements, benefits_amount, coverage_deadline, contact_person, contact_email, min_gwa, min_units, scholarship_agencies ( name ), scholarship_categories!inner ( name )'
      )
      .eq('scholarship_categories.name', categoryName)
      .order('name')

    query = showArchived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

    const { data, error } = await query

    if (error) {
      // Surface the real failure instead of silently showing an empty list —
      // e.g. if is_expiring_soon doesn't exist yet because migration 0008
      // hasn't been run, this used to look identical to "no scholarships".
      setError(error.message)
      setRows([])
      setLoading(false)
      return
    }

    setRows(
      (data as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        description: r.description,
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        notes: r.notes,
        agency_id: r.agency_id,
        agency_name: r.scholarship_agencies?.name ?? null,
        category_name: r.scholarship_categories.name,
        is_expiring_soon: r.is_expiring_soon ?? false,
        level: r.level,
        qualifications: r.qualifications,
        application_requirements: r.application_requirements,
        benefits_amount: r.benefits_amount,
        coverage_deadline: r.coverage_deadline,
        contact_person: r.contact_person,
        contact_email: r.contact_email,
        min_gwa: r.min_gwa,
        min_units: r.min_units,
      }))
    )
    setLoading(false)
  }, [categoryName, showArchived])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  return { rows, loading, error, refetch: fetchRows }
}
