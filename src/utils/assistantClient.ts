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

function includesEntity(question: string, entity: string): boolean {
  const q = ` ${normalize(question)} `
  const name = normalize(entity)
  if (!name) return false
  return q.includes(` ${name} `) || name.split(' ').filter((part) => part.length > 2).every((part) => q.includes(` ${part} `))
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
async function resolveIntent(question: string): Promise<QueryResult> {
  const q = question.toLowerCase()

  if (q.includes('duplicate')) {
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

  if (q.includes('expiring') || q.includes('expire')) {
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

  const asksAboutPeople = /\bscholars?\b|\bstudents?\b/.test(q)

  if (/\bscholarships?\b/.test(q) && !asksAboutPeople) {
    const { data, error } = await supabase
      .from('scholarships')
      .select('name, status, end_date, scholarship_categories ( name ), scholarship_agencies ( name )')
      .is('archived_at', null)
      .order('name')
    assertQuerySucceeded(error)
    let rows = (data ?? []) as any[]
    const statuses = ['Active', 'Expiring Soon', 'Inactive']
    const matchedStatus = statuses.find((status) => q.includes(status.toLowerCase()))
    if (matchedStatus) rows = rows.filter((row) => row.status === matchedStatus)
    const categories = ['Government', 'Institutional', 'Private']
    const matchedCategory = categories.find((category) => q.includes(category.toLowerCase()))
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
    const { data, error } = await supabase
      .from('student_scholarships')
      .select(
        `academic_year, semester,
         students!inner(id, student_number, last_name, first_name, yr_level, archived_at,
           programs!inner(name, colleges!inner(name))),
         scholarships!inner(name, scholarship_categories!inner(name))`
      )
      .eq('status', 'Active')
      .is('archived_at', null)
      .is('students.archived_at', null)
    assertQuerySucceeded(error)

    const assignments = (data ?? []) as any[]
    const year = q.match(/\b(20\d{2}\s*[-–]\s*20\d{2})\b/)?.[1].replace(/\s|–/g, '-')
    const semester = q.includes('1st semester') || q.includes('first semester')
      ? '1st Semester'
      : q.includes('2nd semester') || q.includes('second semester')
        ? '2nd Semester'
        : q.includes('summer')
          ? 'Summer'
          : null

    let filtered = assignments.filter((row) => (!year || row.academic_year === year) && (!semester || row.semester === semester))

    const entityNames = Array.from(
      new Set(
        assignments.flatMap((row) => [
          row.students?.programs?.name,
          row.students?.programs?.colleges?.name,
          row.scholarships?.name,
          row.scholarships?.scholarship_categories?.name,
        ]).filter(Boolean)
      )
    ) as string[]
    const matchedEntities = entityNames.filter((name) => includesEntity(question, name))
    if (matchedEntities.length > 0) {
      filtered = filtered.filter((row) => {
        const values = [
          row.students?.programs?.name,
          row.students?.programs?.colleges?.name,
          row.scholarships?.name,
          row.scholarships?.scholarship_categories?.name,
        ]
        return matchedEntities.some((entity) => values.includes(entity))
      })
    }

    const distinctStudents = new Map<string, any>()
    for (const row of filtered) {
      const student = row.students
      if (student?.id && !distinctStudents.has(student.id)) distinctStudents.set(student.id, row)
    }
    const scholarRows = [...distinctStudents.values()].sort((a, b) =>
      String(a.students.last_name).localeCompare(String(b.students.last_name))
    )
    const filterLabel = [matchedEntities.join(' / '), year, semester].filter(Boolean).join(', ') || 'all active records'

    if (q.includes('per college') || q.includes('by college')) {
      const collegeStudents = new Map<string, Set<string>>()
      for (const row of filtered) {
        const college = row.students?.programs?.colleges?.name ?? 'Unknown'
        if (!collegeStudents.has(college)) collegeStudents.set(college, new Set())
        collegeStudents.get(college)!.add(row.students.id)
      }
      const breakdown = [...collegeStudents.entries()].sort((a, b) => b[1].size - a[1].size)
      const answer = breakdown.length === 0
        ? 'No active scholars matched that question.'
        : `${formatTable(['College', 'Active Scholars'], breakdown.map(([college, ids]) => [college, ids.size]))}\n\n### Summary\n**Total Active Scholars:** ${scholarRows.length}`
      return { intent: 'scholars_per_college', data: breakdown, answer }
    }

    const wantsList = /list|show|who|names|which/.test(q)
    const wantsCount = /how many|count|number|total/.test(q)
    if (wantsList) {
      const answer = scholarRows.length === 0
        ? `No active scholars were found for ${filterLabel}.`
        : `${scholarRows.length} active scholar${scholarRows.length === 1 ? '' : 's'} found for ${filterLabel}.\n\n${formatTable(
            ['Student ID', 'Name', 'Program', 'College'],
            scholarRows.slice(0, 50).map((row) => [
              row.students.student_number,
              `${row.students.first_name} ${row.students.last_name}`,
              row.students.programs?.name,
              row.students.programs?.colleges?.name,
            ])
          )}${scholarRows.length > 50 ? '\n\nShowing the first 50 records.' : ''}`
      return { intent: 'scholar_list', data: scholarRows, answer }
    }
    if (wantsCount || q.includes('scholar')) {
      return {
        intent: 'scholar_count',
        data: { count: scholarRows.length, filter: filterLabel },
        answer: `**Active Scholars (${filterLabel}):** ${scholarRows.length}`,
      }
    }
  }

  if (/dashboard|overview|summary|statistics|stats/.test(q)) {
    const { data, error } = await supabase.from('dashboard_stats').select('*').single()
    assertQuerySucceeded(error)
    return { intent: 'general_stats', data }
  }

  return {
    intent: 'unsupported',
    data: null,
    answer:
      "I couldn't match that question to a reliable SIGMA report. Try asking for active scholars by college, program, scholarship, category, academic year, or semester; open duplicate flags; or scholarships expiring within 30 days.",
  }
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

export async function askAssistant(question: string): Promise<string> {
  const result = await resolveIntent(question)

  // Known reports are formatted directly from database results. Gemini is
  // only used for the general dashboard summary, preventing it from changing
  // exact counts, names, filters, or dates returned by SIGMA.
  if (result.answer) return result.answer

  const prompt = `${FORMATTING_INSTRUCTIONS}

Question: ${question}
Data (intent: ${result.intent}): ${JSON.stringify(result.data)}`

  return callGeminiWithFallback(prompt)
}
