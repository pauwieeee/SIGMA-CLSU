export interface StudentRecordAssignmentFilter {
  category?: string | null
  academicYear?: string | null
  semester?: string | null
  status?: string | null
  college?: string | null
  program?: string | null
  scholarship?: string | null
  enrollment?: string | null
}

export interface StudentRecordAssignmentLike {
  category?: string | null
  academicYear?: string | null
  semester?: string | null
  assignmentStatus?: string | null
  scholarshipStatus?: string | null
  college?: string | null
  program?: string | null
  scholarship?: string | null
  isEnrolled?: boolean | null
}

export function effectiveStudentRecordStatus(
  assignmentStatus?: string | null,
  scholarshipStatus?: string | null,
): string | null {
  return scholarshipStatus && ['Expired', 'Expiring Soon'].includes(scholarshipStatus)
    ? scholarshipStatus
    : assignmentStatus ?? null
}

export function matchesStudentRecordAssignment(
  assignment: StudentRecordAssignmentLike,
  filters: StudentRecordAssignmentFilter,
): boolean {
  if (filters.category && assignment.category !== filters.category) return false
  if (filters.academicYear && assignment.academicYear !== filters.academicYear) return false
  if (filters.semester && assignment.semester !== filters.semester) return false
  if (filters.status && effectiveStudentRecordStatus(assignment.assignmentStatus, assignment.scholarshipStatus) !== filters.status) return false
  if (filters.college && assignment.college !== filters.college) return false
  if (filters.program && assignment.program !== filters.program) return false
  if (filters.scholarship && assignment.scholarship !== filters.scholarship) return false
  if (filters.enrollment === 'Enrolled' && assignment.isEnrolled !== true) return false
  if (filters.enrollment === 'Not Enrolled' && assignment.isEnrolled !== false) return false
  if (filters.enrollment === 'Not Yet Verified' && assignment.isEnrolled !== null) return false
  return true
}
