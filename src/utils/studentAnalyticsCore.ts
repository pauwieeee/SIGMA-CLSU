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
