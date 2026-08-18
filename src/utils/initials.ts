// fullName is always formatted "Lastname, Firstname Middle." (see
// useStudentRecords / useStudentDetail). Initials are strictly:
// first letter of last name + first letter of first name — never derived
// from middle initial, and never assigned manually.
export function getInitials(fullName: string): string {
  const [lastName, firstNamePart] = fullName.split(',').map((s) => s.trim())
  const lastInitial = lastName?.charAt(0).toUpperCase() ?? ''
  const firstInitial = firstNamePart?.charAt(0).toUpperCase() ?? ''
  return `${lastInitial}${firstInitial}`
}
