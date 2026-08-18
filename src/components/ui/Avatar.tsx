import { getInitials } from '@/utils/initials'

// Single shared avatar style for every student initials circle in the app
// (Student Records, Student Detail, and anywhere else a student is shown).
// Color always comes from the .avatar-circle CSS class — never per-instance
// props — so it can never vary by status/category/role.
export function Avatar({ name, size }: { name: string; size?: number }) {
  return (
    <span className="avatar-circle" style={size ? { width: size, height: size, fontSize: size * 0.36 } : undefined}>
      {getInitials(name)}
    </span>
  )
}
