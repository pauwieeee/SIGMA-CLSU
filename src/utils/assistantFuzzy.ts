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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function scholarshipNameMatchesQuestion(question: string, name: string, code?: string | null): boolean {
  const normalizedQuestion = ` ${normalizeEntity(stripScholarshipReferenceMetadata(question))} `
  const normalizedName = normalizeEntity(stripScholarshipReferenceMetadata(name))
  if (!normalizedName) return false
  if (normalizedQuestion.includes(` ${normalizedName} `)) return true

  const coreName = normalizedName.replace(/\s+(?:scholarship\s+program|scholarship|program)$/i, '').trim()
  if (coreName.split(' ').length >= 2 && normalizedQuestion.includes(` ${coreName} `)) return true

  const normalizedCode = normalizeEntity(code ?? '')
  return Boolean(normalizedCode && normalizedQuestion.includes(` ${normalizedCode} `))
}
