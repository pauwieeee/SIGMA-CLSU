const INTENT_WORDS = ['enrolled', 'students', 'student', 'scholars', 'scholar', 'academic', 'duplicate', 'resolved']

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[right.length]
}

export function normalizeAssistantQuestion(question: string): string {
  return question.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase()
    const match = INTENT_WORDS.find((candidate) => {
      const allowance = candidate.length >= 8 ? 2 : 1
      return Math.abs(candidate.length - lower.length) <= allowance && editDistance(lower, candidate) <= allowance
    })
    if (!match) return word
    return word[0] === word[0]?.toUpperCase() ? match[0].toUpperCase() + match.slice(1) : match
  })
}

/** Removes board-resolution references attached to scholarship names. */
export function stripScholarshipReferenceMetadata(value: string): string {
  const resolution = String.raw`(?:br\.?\s*res(?:olution)?|board\s+resolution|resolution)\.?\s*(?:no\.?)?\s*\d{1,4}\s*-\s*\d{2,4}`
  return value
    .replace(new RegExp(`\\(\\s*${resolution}\\s*\\)`, 'gi'), ' ')
    .replace(new RegExp(`\\b${resolution}\\b`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeEntity(value: string): string {
  return value.toLowerCase().replace(/\bundergrad\b/g, 'undergraduate').replace(/[^a-z0-9]+/g, ' ').trim()
}

function compactEntity(value: string): string {
  return normalizeEntity(value).replace(/\s+/g, '')
}

export function scholarshipNameMatchesQuestion(question: string, name: string, aliases: string | string[] = []): boolean {
  const normalizedQuestionValue = normalizeEntity(stripScholarshipReferenceMetadata(question))
  const normalizedQuestion = ` ${normalizedQuestionValue} `
  const questionTokens = new Set(normalizedQuestionValue.split(' ').filter(Boolean))
  const candidates = new Set([name, name.replace(/\([^)]*\)/g, ' '), ...(Array.isArray(aliases) ? aliases : [aliases])])
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeEntity(stripScholarshipReferenceMetadata(candidate))
    if (!normalizedCandidate) continue
    if (normalizedQuestion.includes(` ${normalizedCandidate} `)) return true

    // Treat punctuation, hyphens, and spaces as presentation differences for
    // database-derived entity names. This makes DA-ATI, DA ATI, and DAATI the
    // same entity without maintaining a hardcoded scholarship alias list.
    const compactCandidate = compactEntity(stripScholarshipReferenceMetadata(candidate))
    if (compactCandidate.length >= 4 && questionTokens.has(compactCandidate)) return true

    const coreName = normalizedCandidate.replace(/\s+(?:scholarship\s+program|scholarship|program)$/i, '').trim()
    if (coreName.split(' ').length >= 2 && normalizedQuestion.includes(` ${coreName} `)) return true
    const compactCoreName = compactEntity(coreName)
    if (compactCoreName.length >= 4 && questionTokens.has(compactCoreName)) return true
  }
  return false
}

export type DuplicateQueryMode = 'count' | 'list'

export function duplicateQueryMode(question: string): DuplicateQueryMode {
  return /\b(?:how\s+many|count|number|total)\b/i.test(question) ? 'count' : 'list'
}

export function requestedDuplicateResultLimit(question: string, fallback = 50): number {
  const numeric = question.match(/\b(?:give|show|list|find)?\s*(?:me\s+)?(\d{1,2})\b/i)?.[1]
  if (numeric) return Math.min(Math.max(Number(numeric), 1), 50)

  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  }
  const word = question.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i)?.[1]?.toLowerCase()
  return word ? words[word] : fallback
}
