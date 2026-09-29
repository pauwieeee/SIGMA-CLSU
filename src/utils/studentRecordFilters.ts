export interface StudentRecordAssignmentFilter {
  category?: string | null
  academicYear?: string | null
  semester?: string | null
  status?: string | null
}

export interface StudentRecordAssignmentLike {
  category?: string | null
  academicYear?: string | null
  semester?: string | null
  assignmentStatus?: string | null
  scholarshipStatus?: string | null
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
  return true
}
