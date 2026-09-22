import type { User } from '@supabase/supabase-js'

export function getUserDisplayName(user: User | null | undefined, fallback = 'Admin') {
  const metadata = user?.user_metadata
  const savedName = metadata?.preferred_username ?? metadata?.full_name ?? metadata?.display_name ?? metadata?.name
  if (typeof savedName === 'string' && savedName.trim()) return savedName.trim()
  return user?.email?.split('@')[0] || fallback
}
