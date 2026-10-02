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
const PROGRAM_STRUCTURE_WORDS = new Set([...ACRONYM_STOP_WORDS, 'major', 'program', 'degree'])

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

export function semanticProgramWords(value: unknown): string[] {
  const words = normalizeProgramReference(value).split(' ').filter(Boolean)
  const expanded = words.flatMap((word, index) => {
    if (index !== 0) return [word]
    if (word === 'bs') return ['bachelor', 'science']
    if (word === 'ba') return ['bachelor', 'arts']
    return [word]
  })
  return expanded.filter((word) => !PROGRAM_STRUCTURE_WORDS.has(word))
}

function semanticProgramKey(value: unknown): string {
  return semanticProgramWords(value).join(' ')
}

export function createProgramMatcher<T extends ProgramReference>(programs: T[]) {
  const nameLookup = new Map<string, Map<string, T>>()
  const codeLookup = new Map<string, Map<string, T>>()
  const semanticLookup = new Map<string, Map<string, T>>()
  const aliasLookup = new Map<string, Map<string, T>>()
  const add = (lookup: Map<string, Map<string, T>>, key: string, program: T) => {
    if (!key) return
    if (!lookup.has(key)) lookup.set(key, new Map())
    lookup.get(key)!.set(program.id, program)
  }
  for (const program of programs) {
    const normalizedName = normalizeProgramReference(program.name)
    add(nameLookup, normalizedName, program)
    add(nameLookup, normalizedName.replace(/\s/g, ''), program)
    for (const key of programLookupKeys(program.code)) add(codeLookup, key, program)
    add(semanticLookup, semanticProgramKey(program.name), program)
    for (const key of programLookupKeys(program.name)) add(aliasLookup, key, program)
  }

  return (value: unknown): ProgramMatch<T> => {
    const normalized = normalizeProgramReference(value)
    const lookupGroups: Array<Array<Map<string, T> | undefined>> = [
      [nameLookup.get(normalized), nameLookup.get(normalized.replace(/\s/g, ''))],
      [semanticLookup.get(semanticProgramKey(value))],
      programLookupKeys(value).map((key) => codeLookup.get(key)),
      programLookupKeys(value).map((key) => aliasLookup.get(key)),
    ]
    for (const group of lookupGroups) {
      const matches = new Map<string, T>()
      for (const candidates of group) {
        for (const [id, program] of candidates ?? []) matches.set(id, program)
      }
      const matchedPrograms = [...matches.values()]
      if (matchedPrograms.length === 1) return { status: 'matched', program: matchedPrograms[0] }
      if (matchedPrograms.length > 1) return { status: 'ambiguous', programs: matchedPrograms }
    }
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
  const semanticTextWords = new Set(semanticProgramWords(text))
  const compactTextTokens = new Set(textWords.map((word) => word.replace(/[^a-z0-9]/g, '')))
  for (let index = 0; index < textWords.length;) {
    if (textWords[index].length !== 1) { index += 1; continue }
    let end = index
    while (end < textWords.length && textWords[end].length === 1) end += 1
    if (end - index >= 2) compactTextTokens.add(textWords.slice(index, end).join(''))
    index = end
  }
  const matches = new Map<string, T>()

  const semanticMatches = programs
    .map((program) => ({ program, words: semanticProgramWords(program.name) }))
    .filter(({ words }) => words.length >= 2 && words.every((word) => semanticTextWords.has(word)))
  if (semanticMatches.length > 0) {
    const mostSpecificLength = Math.max(...semanticMatches.map(({ words }) => words.length))
    return semanticMatches.filter(({ words }) => words.length === mostSpecificLength).map(({ program }) => program)
  }

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
