export interface ProgramReference {
  id: string
  name: string
  code?: string | null
}

export type ProgramMatch<T extends ProgramReference> =
  | { status: 'matched'; program: T }
  | { status: 'ambiguous'; programs: T[] }
  | { status: 'unmatched'; programs: [] }

const ACRONYM_STOP_WORDS = new Set(['a', 'an', 'and', 'of', 'in', 'the', 'for', 'to'])

export function normalizeProgramReference(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function acronymFor(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !ACRONYM_STOP_WORDS.has(word.toLowerCase()))
    .map((word) => /^[A-Z0-9]{2,5}$/.test(word) ? word.toLowerCase() : word[0].toLowerCase())
    .join('')
}

/** Lookup keys are derived only from the live program name/code. */
export function programLookupKeys(value: unknown): string[] {
  const normalized = normalizeProgramReference(value)
  if (!normalized) return []
  const compact = normalized.replace(/\s/g, '')
  const acronym = acronymFor(value)
  return [...new Set([normalized, compact, acronym].filter(Boolean))]
}

export function createProgramMatcher<T extends ProgramReference>(programs: T[]) {
  const lookup = new Map<string, Map<string, T>>()
  for (const program of programs) {
    const keys = [...programLookupKeys(program.name), ...programLookupKeys(program.code)]
    for (const key of keys) {
      if (!lookup.has(key)) lookup.set(key, new Map())
      lookup.get(key)!.set(program.id, program)
    }
  }

  return (value: unknown): ProgramMatch<T> => {
    const matches = new Map<string, T>()
    for (const key of programLookupKeys(value)) {
      for (const [id, program] of lookup.get(key) ?? []) matches.set(id, program)
    }
    const programs = [...matches.values()]
    if (programs.length === 1) return { status: 'matched', program: programs[0] }
    if (programs.length > 1) return { status: 'ambiguous', programs }
    return { status: 'unmatched', programs: [] }
  }
}
