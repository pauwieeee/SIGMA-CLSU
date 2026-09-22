// Client-side SIGMA Assistant logic. Calls Gemini directly from the browser
// using VITE_GEMINI_API_KEY — by design this key is bundled into the client
// JS and publicly readable (see README for the tradeoff this project chose
// vs. routing through a server-side Edge Function). Ported from the
// supabase/functions/sigma-assistant Edge Function so behavior (intent
// resolution, safe parameterized queries, model fallback chain) stays the
// same either way.

import { supabase } from '@/lib/supabase'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

export class AssistantError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface QueryResult {
  intent: string
  data: unknown
  answer?: string
  context?: AssistantQueryContext | null
}

export interface AssistantConversationMessage {
  role: 'assistant' | 'user'
  text: string
}

export interface AssistantScholarContext {
  kind: 'scholars'
  filterLabel: string
  assignments: any[]
  studentIds: string[]
}

export type AssistantQueryContext = AssistantScholarContext

export interface AssistantResponse {
  answer: string
  context: AssistantQueryContext | null
}

function assertQuerySucceeded(error: { message: string } | null) {
  if (error) throw new AssistantError('database_error', error.message)
}

function cleanCell(value: unknown): string {
  return String(value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function formatTable(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cleanCell).join(' | ')} |`),
  ].join('\n')
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function includesEntity(question: string, entity: string, aliases: string[] = []): boolean {
  const q = ` ${normalize(question)} `
  return [entity, ...aliases].some((candidate) => {
    const name = normalize(candidate)
    if (!name) return false

    // Two-letter program acronyms overlap with normal English words (for
    // example BAIS previously produced the alias "IS"). Accept them only
    // when the user types the uppercase acronym or uses it after a clear
    // scope such as "in IT" / "department of IT".
    if (/^[a-z]{2}$/.test(name)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const uppercaseAcronym = new RegExp(`\\b${escaped.toUpperCase()}\\b`).test(question)
      const scopedAcronym = new RegExp(`\\b(?:in|from|under|of)\\s+(?:dept(?:artment)?\\.?\\s+of\\s+)?${escaped}\\b`, 'i').test(question)
      return uppercaseAcronym || scopedAcronym
    }

    if (q.includes(` ${name} `)) return true

    const significantWords = name.split(' ').filter((part) => part.length > 2)
    return significantWords.length > 0 && significantWords.every((part) => q.includes(` ${part} `))
  })
}

function programAliases(name: string, code?: string | null): string[] {
  const aliases = code ? [code] : []

  const specialization = name.match(/\bin\s+(.+)$/i)?.[1]
  if (specialization) {
    aliases.push(specialization)
    const acronym = specialization
      .split(/\s+/)
      .filter((word) => !['and', 'of', 'the'].includes(word.toLowerCase()))
      .map((word) => word[0])
      .join('')
    if (acronym.length >= 2) aliases.push(acronym)
  }
  return aliases
}

// Verified against this project's actual API key via direct generateContent
// test calls (2026-08 — re-verify periodically, since Google's model
// availability and this project's entitlements can shift):
//   - gemini-2.0-flash(-lite), gemini-2.5-flash(-lite) → 404 "no longer
//     available to new users"
//   - gemini-pro-latest (→ gemini-3.1-pro) → hard limit: 0 on free tier
//   - gemini-flash-latest, gemini-flash-lite-latest, gemini-3.1-flash-lite,
//     gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.6-flash → all
//     CONFIRMED WORKING (real generateContent responses returned)
//
// RPM values below are estimates (lite variants generally get a higher
// quota than full models) since this key has no visible Rate Limit
// dashboard yet — adjust once real usage data is available.
type ModelLimit = { slug: string; rpm: number }
const MODEL_LIMITS: ModelLimit[] = [
  { slug: 'gemini-flash-lite-latest', rpm: 15 },
  { slug: 'gemini-3.5-flash-lite', rpm: 15 },
  { slug: 'gemini-3.1-flash-lite', rpm: 15 },
  { slug: 'gemini-flash-latest', rpm: 5 },
  { slug: 'gemini-3.6-flash', rpm: 5 },
  { slug: 'gemini-3.5-flash', rpm: 5 },
]
const FALLBACK_CHAIN = MODEL_LIMITS.filter((m) => m.rpm > 0)
  .sort((a, b) => b.rpm - a.rpm)
  .map((m) => m.slug)

let lastGoodModel: string | null = null
const rateLimitedUntil: Record<string, number> = {}
const COOLDOWN_MS = 60_000

function orderedChain(): string[] {
  const now = Date.now()
  const usable = FALLBACK_CHAIN.filter((slug) => (rateLimitedUntil[slug] ?? 0) < now)
  if (lastGoodModel && usable.includes(lastGoodModel)) {
    return [lastGoodModel, ...usable.filter((s) => s !== lastGoodModel)]
  }
  return usable.length > 0 ? usable : FALLBACK_CHAIN
}

// ------------------------------------------------------------
// Safe, parameterized intents — same set the Edge Function used. Runs
// against the browser's already-authenticated Supabase client, so RLS
// still governs exactly what data comes back.
// ------------------------------------------------------------
function isFollowUpQuestion(question: string): boolean {
  return /\b(it|that|those|them|they|their|there|these|this|same|previous|above)\b/i.test(question)
    || /^(and|also|what about|how about|are|is|do|does|can|only)\b/i.test(question.trim())
}

function questionWithContext(question: string, history: AssistantConversationMessage[]): string {
  if (!isFollowUpQuestion(question)) return question

  const userQuestions = history.filter((message) => message.role === 'user').map((message) => message.text)
  if (userQuestions.length === 0) return question

  // Keep the complete chain from the latest standalone question. Using only
  // the immediately previous message loses the original filter after a
  // sequence such as "How many are in IT?" → "Who are they?" → "What year?".
  let contextStart = 0
  for (let i = userQuestions.length - 1; i >= 0; i--) {
    if (!isFollowUpQuestion(userQuestions[i])) {
      contextStart = i
      break
    }
  }
  return [...userQuestions.slice(contextStart), question].join(' ')
}

function distinctScholarRows(assignments: any[]): any[] {
  const students = new Map<string, any>()
  for (const assignment of assignments) {
    const student = assignment.students
    if (student?.id && !students.has(student.id)) students.set(student.id, assignment)
  }
  return [...students.values()].sort((a, b) =>
    String(a.students.last_name).localeCompare(String(b.students.last_name))
      || String(a.students.first_name).localeCompare(String(b.students.first_name))
  )
}

function studentName(row: any): string {
  const student = row.students
  return `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim()
}

function formatScholarList(assignments: any[], filterLabel: string): string {
  const rows = distinctScholarRows(assignments)
  if (rows.length === 0) return `No matching scholars were found for ${filterLabel}.`

  const scholarshipsByStudent = new Map<string, Set<string>>()
  for (const assignment of assignments) {
    const studentId = assignment.students?.id
    const scholarship = assignment.scholarships?.name
    if (!studentId || !scholarship) continue
    if (!scholarshipsByStudent.has(studentId)) scholarshipsByStudent.set(studentId, new Set())
    scholarshipsByStudent.get(studentId)!.add(scholarship)
  }

  return `### Matching Scholars\n${rows.length} matching scholar${rows.length === 1 ? '' : 's'} found for ${filterLabel}. Showing all ${rows.length} record${rows.length === 1 ? '' : 's'}.\n\n${formatTable(
    ['Student ID', 'Name', 'Program', 'College', 'Scholarship'],
    rows.map((row) => [
      row.students.student_number,
      studentName(row),
      row.students.programs?.name,
      row.students.programs?.colleges?.name,
      [...(scholarshipsByStudent.get(row.students.id) ?? [])].sort().join(', '),
    ])
  )}\n\n### Summary\n**Total Matching Scholars:** ${rows.length}`
}

async function resolveIntent(
  question: string,
  history: AssistantConversationMessage[] = [],
  previousContext: AssistantQueryContext | null = null,
): Promise<QueryResult> {
  const q = question.toLowerCase()
  const contextualQuestion = questionWithContext(question, history)
  const contextualQ = contextualQuestion.toLowerCase()

  if (contextualQ.includes('duplicate')) {
    const { data, error } = await supabase
      .from('duplicate_flags')
      .select('id, reason, students ( student_number, last_name, first_name )')
      .eq('status', 'Open')
      .order('created_at', { ascending: false })
      .limit(50)
    assertQuerySucceeded(error)
    const rows = (data ?? []) as any[]
    const wantsCount = /how many|count|number|total/.test(q)
    const answer = wantsCount
      ? `**Open Duplicate Flags:** ${rows.length}`
      : rows.length === 0
        ? 'There are no open duplicate flags.'
        : `${rows.length} open duplicate flag${rows.length === 1 ? '' : 's'} found.\n\n${formatTable(
            ['Student ID', 'Student', 'Reason'],
            rows.map((row) => [
              row.students?.student_number,
              `${row.students?.first_name ?? ''} ${row.students?.last_name ?? ''}`.trim(),
              row.reason,
            ])
          )}\n\n### Summary\n**Total Open Flags:** ${rows.length}`
    return { intent: 'duplicates', data: rows, answer }
  }

  if (contextualQ.includes('expiring') || contextualQ.includes('expire')) {
    const today = new Date()
    const cutoff = new Date(today.getTime() + 30 * 86400000)
    const asDate = (date: Date) => date.toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('scholarships')
      .select('name, end_date')
      .not('end_date', 'is', null)
      .lte('end_date', asDate(cutoff))
      .gte('end_date', asDate(today))
      .is('archived_at', null)
      .order('end_date')
    assertQuerySucceeded(error)
    const rows = (data ?? []) as { name: string; end_date: string | null }[]
    const wantsCount = /how many|count|number|total/.test(q)
    const answer = wantsCount
      ? `**Scholarships Expiring Within 30 Days:** ${rows.length}`
      : rows.length === 0
        ? 'No scholarships are expiring within the next 30 days.'
        : `${rows.length} scholarship${rows.length === 1 ? '' : 's'} will expire within 30 days.\n\n${formatTable(
            ['Scholarship', 'End Date'],
            rows.map((row) => [row.name, row.end_date])
          )}`
    return { intent: 'expiring', data: rows, answer }
  }

  const asksAboutPeople = /\bscholars?\b|\bstudents?\b/.test(contextualQ)

  if (/\bscholarships?\b/.test(contextualQ) && !asksAboutPeople) {
    const { data, error } = await supabase
      .from('scholarships')
      .select('name, status, end_date, scholarship_categories ( name ), scholarship_agencies ( name )')
      .is('archived_at', null)
      .order('name')
    assertQuerySucceeded(error)
    let rows = (data ?? []) as any[]
    const statuses = ['Active', 'Expiring Soon', 'Expired', 'Inactive']
    const matchedStatus = statuses.find((status) => contextualQ.includes(status.toLowerCase()))
    if (matchedStatus) rows = rows.filter((row) => row.status === matchedStatus)
    const categories = ['Government', 'Institutional', 'Private']
    const matchedCategory = categories.find((category) => contextualQ.includes(category.toLowerCase()))
    if (matchedCategory) {
      rows = rows.filter((row) => row.scholarship_categories?.name === matchedCategory)
    }
    const filterLabel = [matchedStatus, matchedCategory].filter(Boolean).join(' ') || 'available'
    const wantsCount = /how many|count|number|total/.test(q)
    const answer = wantsCount
      ? `**${filterLabel} Scholarships:** ${rows.length}`
      : rows.length === 0
        ? `No ${filterLabel.toLowerCase()} scholarships were found.`
        : `${rows.length} ${filterLabel.toLowerCase()} scholarship${rows.length === 1 ? '' : 's'} found.\n\n${formatTable(
            ['Scholarship', 'Category', 'Agency', 'Status', 'End Date'],
            rows.slice(0, 50).map((row) => [
              row.name,
              row.scholarship_categories?.name,
              row.scholarship_agencies?.name,
              row.status,
              row.end_date,
            ])
          )}${rows.length > 50 ? '\n\nShowing the first 50 records.' : ''}`
    return { intent: 'scholarship_list', data: rows, answer }
  }

  // A scholar means a distinct, non-archived student with an active,
  // non-archived student_scholarships record. Fetching the relationship here
  // prevents ordinary (non-scholar) students from being counted by mistake.
  if (asksAboutPeople) {
    if (/^\s*(?:who are|show|list)\s+(?:the\s+)?scholars\s*[?.!]*\s*$/i.test(question) && !previousContext) {
      return {
        intent: 'ambiguous_scholar_query',
        data: null,
        answer: 'Which scholars would you like me to show — all scholars, or scholars from a specific college, program, scholarship, academic year, semester, or status?',
      }
    }

    const { data, error } = await supabase
      .from('student_scholarships')
      .select(
        `id, academic_year, semester, status, is_enrolled,
         students!inner(id, student_number, last_name, first_name, yr_level, archived_at,
           programs!inner(name, code, colleges!inner(name, code))),
         scholarships!inner(name, scholarship_categories!inner(name))`
      )
      .is('archived_at', null)
      .is('students.archived_at', null)
    assertQuerySucceeded(error)

    const assignments = (data ?? []) as any[]
    const year = contextualQ.match(/\b(20\d{2}\s*[-–]\s*20\d{2})\b/)?.[1].replace(/\s|–/g, '-')
    const semester = contextualQ.includes('1st semester') || contextualQ.includes('first semester')
      ? '1st Semester'
      : contextualQ.includes('2nd semester') || contextualQ.includes('second semester')
        ? '2nd Semester'
        : contextualQ.includes('summer')
          ? 'Summer'
          : null
    const yearMatches = [...contextualQuestion.matchAll(/\b(20\d{2}\s*-\s*20\d{2})\b/g)]
    const appliedYear = yearMatches.at(-1)?.[1].replace(/\s/g, '-') ?? year
    const semesterMatches = [...contextualQuestion.matchAll(/\b(1st|first|2nd|second)\s+semester\b|\bsummer\b/gi)]
    const latestSemester = semesterMatches.at(-1)?.[0].toLowerCase()
    const appliedSemester = latestSemester?.includes('1st') || latestSemester?.includes('first')
      ? '1st Semester'
      : latestSemester?.includes('2nd') || latestSemester?.includes('second')
        ? '2nd Semester'
        : latestSemester === 'summer' ? 'Summer' : semester

    const statusMatchers: [string, RegExp][] = [
      ['For Renewal', /\b(?:for\s+)?renewal\b/i],
      ['Documents Incomplete', /\b(?:documents?\s+)?incomplete\b/i],
      ['Pending Verification', /\b(?:pending(?:\s+verification)?)\b/i],
      ['Inactive', /\binactive\b/i],
      ['Active', /\bactive\b/i],
    ]
    const requestedStatuses = statusMatchers.flatMap(([status, pattern]) => {
      const matches = [...contextualQuestion.matchAll(new RegExp(pattern.source, 'gi'))]
      return matches.map((match) => ({ status, index: match.index ?? -1 }))
    }).sort((a, b) => a.index - b.index)
    const requestedStatus = requestedStatuses.at(-1)?.status ?? null
    let filtered = assignments.filter((row) =>
      (!requestedStatus || row.status === requestedStatus)
      && (!appliedYear || row.academic_year === appliedYear)
      && (!appliedSemester || row.semester === appliedSemester)
    )

    type EntityType = 'program' | 'college' | 'scholarship' | 'category'
    const entityAliases: Record<EntityType, Map<string, Set<string>>> = {
      program: new Map(), college: new Map(), scholarship: new Map(), category: new Map(),
    }
    function addEntity(type: EntityType, name: string | undefined, aliases: string[] = []) {
      if (!name) return
      if (!entityAliases[type].has(name)) entityAliases[type].set(name, new Set())
      for (const alias of aliases) entityAliases[type].get(name)!.add(alias)
    }
    for (const row of assignments) {
      const program = row.students?.programs
      addEntity('program', program?.name, programAliases(program?.name ?? '', program?.code))
      addEntity('college', program?.colleges?.name, program?.colleges?.code ? [program.colleges.code] : [])
      const scholarshipName = row.scholarships?.name as string | undefined
      const scholarshipAliases = scholarshipName && /\bDOST(?:-SEI)?\b/i.test(scholarshipName)
        ? ['DOST', 'DOST-SEI', 'DOST Scholarship', 'DOST-SEI Scholarship']
        : []
      addEntity('scholarship', scholarshipName, scholarshipAliases)
      addEntity('category', row.scholarships?.scholarship_categories?.name)
    }
    const matchedByType = (Object.keys(entityAliases) as EntityType[]).map((type) => {
      const entities = [...entityAliases[type].entries()]
      const directNames = entities
        .filter(([name]) => includesEntity(contextualQuestion, name))
        .map(([name]) => name)
      const names = type === 'scholarship' && directNames.length > 0
        ? directNames
        : entities
            .filter(([name, aliases]) => includesEntity(contextualQuestion, name, [...aliases]))
            .map(([name]) => name)
      return { type, names }
    }).filter((match) => match.names.length > 0)

    if (matchedByType.length > 0) {
      filtered = filtered.filter((row) => matchedByType.every(({ type, names }) => {
        const value = type === 'program' ? row.students?.programs?.name
          : type === 'college' ? row.students?.programs?.colleges?.name
            : type === 'scholarship' ? row.scholarships?.name
              : row.scholarships?.scholarship_categories?.name
        return names.includes(value)
      }))
    }

    const matchedEntities = matchedByType.flatMap((match) => match.names)
    const hasUnmatchedScope = matchedEntities.length === 0 && /\b(?:in|from|under|taking)\s+[a-z0-9]/i.test(contextualQuestion)
    if (hasUnmatchedScope) {
      return {
        intent: 'unmatched_scholar_filter',
        data: [],
        answer:
          "I couldn't match that program, college, scholarship, or category to SIGMA's records. Try its full name or official code, such as **Information Technology** or **BSIT**.",
      }
    }

    const scholarRows = distinctScholarRows(filtered)
    const filterLabel = [requestedStatus, matchedEntities.join(' / '), appliedYear, appliedSemester].filter(Boolean).join(', ') || 'all scholar records'
    const scholarContext: AssistantScholarContext = {
      kind: 'scholars',
      filterLabel,
      assignments: filtered,
      studentIds: scholarRows.map((row) => row.students.id),
    }

    if (q.includes('per college') || q.includes('by college')) {
      const collegeStudents = new Map<string, Set<string>>()
      for (const row of filtered) {
        const college = row.students?.programs?.colleges?.name ?? 'Unknown'
        if (!collegeStudents.has(college)) collegeStudents.set(college, new Set())
        collegeStudents.get(college)!.add(row.students.id)
      }
      const breakdown = [...collegeStudents.entries()].sort((a, b) => b[1].size - a[1].size)
      const answer = breakdown.length === 0
        ? `No matching scholars were found for ${filterLabel}.`
        : `${formatTable(['College', 'Matching Scholars'], breakdown.map(([college, ids]) => [college, ids.size]))}\n\n### Summary\n**Total Matching Scholars:** ${scholarRows.length}`
      return { intent: 'scholars_per_college', data: breakdown, answer, context: scholarContext }
    }

    const wantsList = /list|show|who|names|which|give me|\ball\b/.test(q)
    const wantsCount = /how many|count|number|total/.test(q)
    if (wantsList) {
      return { intent: 'scholar_list', data: scholarRows, answer: formatScholarList(filtered, filterLabel), context: scholarContext }
    }
    if (wantsCount || q.includes('scholar')) {
      return {
        intent: 'scholar_count',
        data: { count: scholarRows.length, filter: filterLabel, studentIds: scholarContext.studentIds },
        answer: `**Matching Scholars (${filterLabel}):** ${scholarRows.length}`,
        context: scholarContext,
      }
    }
  }

  if (/dashboard|overview|summary|statistics|stats/.test(q)) {
    const { data, error } = await supabase.from('dashboard_stats').select('*').single()
    assertQuerySucceeded(error)
    const stats = data as any
    return {
      intent: 'general_stats',
      data,
      answer: [
        `**Total Scholars:** ${stats?.total_scholars ?? 0}`,
        `**Active Scholarships:** ${stats?.active_scholarships ?? 0}`,
        `**Open Duplicate Flags:** ${stats?.duplicate_flags_open ?? 0}`,
        `**Expiring Soon:** ${stats?.expiring_soon ?? 0}`,
      ].join('\n\n'),
    }
  }

  return { intent: 'conversation', data: null }
}

async function callGeminiWithFallback(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new AssistantError('config_missing', 'VITE_GEMINI_API_KEY is not set')
  }

  let sawOnlyAuthFailures = true

  for (const slug of orderedChain()) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${slug}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: controller.signal,
        }
      )
    } catch (err) {
      clearTimeout(timeout)
      sawOnlyAuthFailures = false
      if ((err as Error).name === 'AbortError') continue // timeout, try next model
      throw new AssistantError('network_error', `Network error calling Gemini: ${(err as Error).message}`)
    }
    clearTimeout(timeout)

    // 401 = the key itself is rejected outright. 403 here is usually
    // per-model access denial ("this project can't use this model"), not a
    // bad key — a key that's truly invalid gets 401, not 403. Both cases
    // still move on to the next model rather than aborting immediately;
    // only if EVERY model in the chain comes back 401/403 do we conclude
    // the key itself is the problem.
    if (res.status === 401 || res.status === 403) {
      console.warn(`Model "${slug}" denied (${res.status}) — trying next model.`)
      continue
    }
    sawOnlyAuthFailures = false

    if (res.status === 404) continue // wrong/renamed slug, try next
    if (res.status === 429) {
      rateLimitedUntil[slug] = Date.now() + COOLDOWN_MS
      continue
    }
    if (!res.ok) continue

    const json = await res.json()
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (text && typeof text === 'string' && text.trim() !== '') {
      lastGoodModel = slug
      return text
    }
  }

  if (sawOnlyAuthFailures) {
    throw new AssistantError('gemini_unauthorized', 'Gemini rejected the API key on every model in the chain')
  }

  throw new AssistantError('gemini_rate_limited', 'All available Gemini models are currently rate-limited or unavailable')
}

const FORMATTING_INSTRUCTIONS = `You are SIGMA Assistant, a scholarship records assistant for CLSU's Office of Admissions.
Answer using ONLY the data provided below — never invent numbers or records. If the data is empty, say so plainly.

Your replies are rendered by a lightweight Markdown renderer inside a chat bubble. It supports exactly this syntax
and nothing else, so don't use any other Markdown:
- "## heading" / "### heading" lines
- "**bold**" inline
- Pipe tables: a "| a | b |" header row followed by a "|---|---|" separator row, then "| ... |" data rows
- "- " bullet lists and "1. " numbered lists
- Record cards: a "### Title" line immediately followed by one or more "Label: value" lines (no blank line
  between them) renders as its own bordered card block. Prefix the title with "⚠️" (e.g. "### ⚠️ Gino Torres") to
  render it as a warning-styled card — use this for duplicate/conflict records.
- A line starting with "⚠️" on its own (not a heading) renders as a plain highlighted warning line.

NEVER combine multiple records into one paragraph or one sentence. One record = one visual block. Keep the intro
to 1-2 short sentences max, then go straight into the structured content. Don't say "As SIGMA Assistant..." or
restate the question.

Response-type rules — pick based on how many records the data contains:
- 1 result → one "### Title" record card with its "Label: value" fields (e.g. Student ID:, Status:, Semester:,
  Scholarships:).
- 2-5 results → one "### Title" record card per record, each with its own "Label: value" fields, one after another
  (blank line between cards). This is the default for lists of students/scholarships of that size — do NOT
  collapse them into a table or a paragraph.
- 6+ results → a Markdown table instead (one row per record) so the reply doesn't get too long — mention the
  total count in a sentence above the table.
- Duplicate/conflict records → one "### ⚠️ Name" warning card per duplicate, with fields like Student ID:,
  Scholarships:, Semester:, Reason:.
- Statistics/summary → don't use record cards; instead put each statistic on its own bold line
  ("**Total Scholars:** 428"), one per line.
- Comparisons (e.g. college vs college) → a Markdown table with one row per item being compared.
- Whenever the reply covers multiple records or a duplicate list, end with a short "### Summary" section (as a
  record card is not needed here — just one or two bold "**Label:** value" lines with the key total or finding).

Never dump raw JSON, field names like "student_number" or "programs.colleges.name", or database identifiers —
translate them into the plain labels above (Student ID, College, Status, Semester, Scholarships, Total, etc).
Keep sentences short and conversational; no filler, no repeated preambles, no emoji except "⚠️".`

export async function askAssistant(
  question: string,
  history: AssistantConversationMessage[] = [],
  previousContext: AssistantQueryContext | null = null,
): Promise<AssistantResponse> {
  const recentHistory = history.slice(-8)
  const result = await resolveIntent(question, recentHistory, previousContext)
  const nextContext = result.context ?? (isFollowUpQuestion(question) ? previousContext : null)

  // Known reports are formatted directly from database results. Gemini is
  // only used for the general dashboard summary, preventing it from changing
  // exact counts, names, filters, or dates returned by SIGMA.
  if (result.answer) return { answer: result.answer, context: nextContext }

  const conversation = recentHistory
    .map((message) => `${message.role === 'user' ? 'Admin' : 'SIGMA Assistant'}: ${message.text}`)
    .join('\n')

  const prompt = `${FORMATTING_INSTRUCTIONS}

You are having a continuing conversation. Use the recent conversation to understand pronouns and follow-up
questions. Be friendly and natural, but stay focused on SIGMA and scholarship administration. If the supplied
data does not contain the answer, say what information is unavailable and suggest a supported SIGMA question.
Never claim that you searched, changed, exported, or verified a record unless the supplied data proves it.

Recent conversation:
${conversation || '(none)'}

Question: ${question}
Data (intent: ${result.intent}): ${JSON.stringify(result.data)}`

  return { answer: await callGeminiWithFallback(prompt), context: nextContext }
}
