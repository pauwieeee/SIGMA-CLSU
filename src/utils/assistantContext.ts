export type ScholarQueryMode = 'count' | 'list'

export type ScholarshipCategory = 'Government' | 'Institutional' | 'Private'

export function explicitScholarshipCategory(question: string): ScholarshipCategory | null {
  if (/\b(?:institutional(?:\s+scholars?)?|clsu\s+scholarships?)\b/i.test(question)) return 'Institutional'
  if (/\b(?:government(?:\s+scholars?)?|gov(?:ernment)?\.?\s+scholars?)\b/i.test(question)) return 'Government'
  if (/\bprivate(?:\s+scholars?)?\b/i.test(question)) return 'Private'
  return null
}

export function normalizeAcademicYearText(value: string): string | null {
  const match = value.match(/\b(20\d{2})\s*[-–—]\s*(20\d{2})\b/)
  return match ? `${match[1]}-${match[2]}` : null
}

export function lastAcademicYearText(value: string): string | null {
  const matches = [...value.matchAll(/\b(20\d{2})\s*[-–—]\s*(20\d{2})\b/g)]
  const match = matches.at(-1)
  return match ? `${match[1]}-${match[2]}` : null
}

export function shiftAcademicYear(academicYear: string, amount: number): string | null {
  const normalized = normalizeAcademicYearText(academicYear)
  if (!normalized) return null
  const [start, end] = normalized.split('-').map(Number)
  return `${start + amount}-${end + amount}`
}

export function relativeAcademicYear(question: string, previousAcademicYear?: string | null): string | null {
  if (!previousAcademicYear) return null
  if (/\b(?:previous|last)\s+(?:academic\s+)?year\b/i.test(question)) return shiftAcademicYear(previousAcademicYear, -1)
  if (/\bnext\s+(?:academic\s+)?year\b/i.test(question)) return shiftAcademicYear(previousAcademicYear, 1)
  if (/\bthis\s+(?:academic\s+)?year\b/i.test(question)) return previousAcademicYear
  return null
}

export function isContextualFollowUp(question: string): boolean {
  const trimmed = question.trim()
  return /\b(it|that|those|them|they|their|there|these|this|same|previous|above)\b/i.test(trimmed)
    || /^(and|also|what about|how about|are|is|do|does|can|only)\b/i.test(trimmed)
    || /^(?:how many|who|list|show)\s+(?:are\s+)?(?:for|of|them|they)\b/i.test(trimmed)
}
