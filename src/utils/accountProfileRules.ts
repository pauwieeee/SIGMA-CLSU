export function validateAccountProfile(username: string, fullName: string, contactNumber: string) {
  const cleanUsername = username.trim()
  const cleanFullName = fullName.trim()
  const cleanContact = contactNumber.trim()
  return {
    username: cleanUsername.length < 2
      ? 'Preferred username must contain at least 2 characters.'
      : cleanUsername.length > 50 ? 'Preferred username cannot exceed 50 characters.' : '',
    fullName: cleanFullName && cleanFullName.length < 2 ? 'Full name must contain at least 2 characters.' : '',
    contact: cleanContact && !/^\+?[0-9\s()-]{7,20}$/.test(cleanContact) ? 'Enter a valid contact number.' : '',
  }
}
