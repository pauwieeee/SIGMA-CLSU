import { programLookupKeys } from './programMatching.ts'

export interface SearchableStudentRecord {
  student_number: string
  full_name: string
  college: string
  program: string
  scholarship: string | null
  email: string | null
  contactNumber: string | null
  academic_year: string | null
  semester: string | null
}

export function normalizedIdentity(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function studentNamesMatch(existingFirst: string, existingLast: string, incomingFirst: string, incomingLast: string) {
  return normalizedIdentity(existingFirst) === normalizedIdentity(incomingFirst)
    && normalizedIdentity(existingLast) === normalizedIdentity(incomingLast)
}

export function studentSearchText(record: SearchableStudentRecord) {
  return [record.student_number, record.full_name, record.college, record.program,
    ...programLookupKeys(record.program), record.scholarship, record.email, record.contactNumber, record.academic_year, record.semester]
    .filter(Boolean).join(' ').toLocaleLowerCase()
}

export function isSameScholarshipTerm(
  left: { scholarshipId: string; academicYear: string; semester: string },
  right: { scholarshipId: string; academicYear: string; semester: string },
) {
  return left.scholarshipId === right.scholarshipId
    && left.academicYear === right.academicYear
    && left.semester === right.semester
}

export function shouldFlagMultipleActiveScholarships(
  left: { studentId: string; academicYear: string; semester: string; status: string; category: string },
  right: { studentId: string; academicYear: string; semester: string; status: string; category: string },
) {
  const categories = new Set([left.category, right.category])
  return left.studentId === right.studentId
    && left.academicYear === right.academicYear
    && left.semester === right.semester
    && left.status === 'Active'
    && right.status === 'Active'
    && categories.size === 2
    && categories.has('Government')
    && categories.has('Private')
}
