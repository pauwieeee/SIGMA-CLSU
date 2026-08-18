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
    const { data } = await supabase
      .from('duplicate_flags')
      .select('id, reason, students ( student_number, last_name, first_name )')
      .eq('status', 'Open')
      .limit(20)
    return { intent: 'duplicates', data }
  }

  if (q.includes('expiring') || q.includes('expire')) {
    const { data } = await supabase
      .from('scholarships')
      .select('name, end_date')
      .not('end_date', 'is', null)
      .lte('end_date', new Date(Date.now() + 30 * 86400000).toISOString())
      .gte('end_date', new Date().toISOString())
      .is('archived_at', null)
    return { intent: 'expiring', data }
  }

  const collegeMatch = q.match(/(?:in|for)\s+([a-z\s]+?)(?:\?|$)/)
  if (q.includes('how many') && collegeMatch) {
    const { data } = await supabase
      .from('students')
      .select('id, programs!inner(colleges!inner(name))')
      .ilike('programs.colleges.name', `%${collegeMatch[1].trim()}%`)
    return { intent: 'count_by_college', data: { count: data?.length ?? 0 } }
  }

  // "list/who are the scholars in <program or college>" — matches against
  // both program names (e.g. "Information Technology") and college names
  // (e.g. "College of Engineering"), since admins phrase this either way.
  if ((q.includes('list') || q.includes('who are') || q.includes('names of')) && collegeMatch) {
    const term = collegeMatch[1].trim()
    const [{ data: matchedPrograms }, { data: matchedColleges }] = await Promise.all([
      supabase.from('programs').select('id').ilike('name', `%${term}%`),
      supabase.from('colleges').select('id').ilike('name', `%${term}%`),
    ])

    let programIds = (matchedPrograms ?? []).map((p: { id: string }) => p.id)
    if (matchedColleges && matchedColleges.length > 0) {
      const { data: programsInColleges } = await supabase
        .from('programs')
        .select('id')
        .in(
          'college_id',
          matchedColleges.map((c: { id: string }) => c.id)
        )
      programIds = [...programIds, ...((programsInColleges ?? []).map((p: { id: string }) => p.id))]
    }

    if (programIds.length === 0) return { intent: 'scholar_list', data: [] }

    const { data } = await supabase
      .from('students')
      .select('student_number, last_name, first_name, yr_level, programs ( name, colleges ( name ) )')
      .in('program_id', programIds)
      .is('archived_at', null)
      .order('last_name')
      .limit(50)
    return { intent: 'scholar_list', data }
  }

  if (q.includes('per college') || q.includes('by college')) {
    const { data } = await supabase.from('students').select('programs ( colleges ( name ) )')
    return { intent: 'scholars_per_college', data }
  }

  const { data } = await supabase.from('dashboard_stats').select('*').single()
  return { intent: 'general_stats', data }
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

  const prompt = `${FORMATTING_INSTRUCTIONS}

Question: ${question}
Data (intent: ${result.intent}): ${JSON.stringify(result.data)}`

  return callGeminiWithFallback(prompt)
}
