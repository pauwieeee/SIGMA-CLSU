export function countDistinctStudentIds<T>(rows: T[], getStudentId: (row: T) => string | null | undefined): number {
  return new Set(rows.map(getStudentId).filter((id): id is string => Boolean(id))).size
}

export function isGenericStudentTotalQuestion(question: string): boolean {
  const normalized = question.toLowerCase()
  const asksForCount = /\b(?:how\s+many|count|number|total)\b/.test(normalized)
  const asksForStudents = /\bstudents?\b/.test(normalized)
  const hasSpecificScope = /\bscholars?\b|\bscholarships?\b|\benrolled\b|\bduplicate\b|\bacademic\s+year\b|\ba\.?y\.?\b|\bsemester\b|\bcollege\b|\bprogram\b|\bgovernment\b|\binstitutional\b|\bprivate\b/.test(normalized)
  return asksForCount && asksForStudents && !hasSpecificScope
}

export type StudentProfileCountScope = 'active' | 'all'

export function studentProfileCountScope(question: string): StudentProfileCountScope | null {
  const normalized = question.toLowerCase()
  const asksForCount = /\b(?:how\s+many|count|number|total)\b/.test(normalized)
  const asksForStudents = /\bstudents?\b/.test(normalized)
  const explicitlyAsksForScholars = /\bscholars?\b|\bscholarship\s+students?\b/.test(normalized)
  const hasFilteredScope = /\benrolled\b|\bduplicate\b|\bacademic\s+year\b|\ba\.?y\.?\b|\bsemester\b|\bcollege\b|\bprogram\b|\bgovernment\b|\binstitutional\b|\bprivate\b|\b(?:cass|cbaa|chsi?|coe|ce|ca|cs)\b/.test(normalized)
  if (!asksForCount || !asksForStudents || explicitlyAsksForScholars || hasFilteredScope) return null
  return /\bactive\b/.test(normalized) ? 'active' : 'all'
}
