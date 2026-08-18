import type { ReactNode } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase'

export function ConfigGate({ children }: { children: ReactNode }) {
  if (isSupabaseConfigured) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-clsu-bg p-6">
      <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h1 className="text-lg font-bold text-clsu-dark">Supabase not configured</h1>
        <p className="mt-2 text-sm text-gray-600">
          Copy <code className="rounded bg-white px-1 py-0.5">.env.example</code> to{' '}
          <code className="rounded bg-white px-1 py-0.5">.env</code> and fill in your Supabase project URL and anon
          key, then restart <code className="rounded bg-white px-1 py-0.5">npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
