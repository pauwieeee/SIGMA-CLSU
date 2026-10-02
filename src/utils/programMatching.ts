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

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function searchableProgramPhrases(program: ProgramReference): string[] {
  const specialization = program.name.match(/\bin\s+(.+)$/i)?.[1]
  return [program.name, program.code, specialization]
    .filter((value): value is string => Boolean(value?.trim()))
}

/** Resolve official programs mentioned inside a longer natural-language query. */
export function findProgramsInText<T extends ProgramReference>(text: string, programs: T[]): T[] {
  const normalizedText = normalizeProgramReference(text)
  const textWords = normalizedText.split(' ').filter(Boolean)
  const compactTextTokens = new Set(textWords.map((word) => word.replace(/[^a-z0-9]/g, '')))
  for (let index = 0; index < textWords.length;) {
    if (textWords[index].length !== 1) { index += 1; continue }
    let end = index
    while (end < textWords.length && textWords[end].length === 1) end += 1
    if (end - index >= 2) compactTextTokens.add(textWords.slice(index, end).join(''))
    index = end
  }
  const matches = new Map<string, T>()

  for (const program of programs) {
    for (const phrase of searchableProgramPhrases(program)) {
      const normalizedPhrase = normalizeProgramReference(phrase)
      const phraseKeys = programLookupKeys(phrase)
      const exactPhrase = normalizedPhrase.length >= 3 && ` ${normalizedText} `.includes(` ${normalizedPhrase} `)
      const exactAlias = phraseKeys.some((key) => key.length >= 3 && compactTextTokens.has(key))
      if (exactPhrase || exactAlias) {
        matches.set(program.id, program)
        break
      }

      const phraseWords = normalizedPhrase.split(' ')
        .filter((word) => word.length >= 4 && !ACRONYM_STOP_WORDS.has(word))
      if (phraseWords.length === 0) continue
      const fuzzyPhrase = phraseWords.every((phraseWord) => textWords.some((textWord) => {
        if (textWord.length < 4) return false
        const tolerance = phraseWord.length >= 8 ? 2 : 1
        return editDistance(phraseWord, textWord) <= tolerance
      }))
      if (fuzzyPhrase) {
        matches.set(program.id, program)
        break
      }
    }
  }

  return [...matches.values()]
}
