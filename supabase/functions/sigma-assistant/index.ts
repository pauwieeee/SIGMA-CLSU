// Supabase Edge Function: sigma-assistant
// Receives a natural-language question, resolves it against a small set of
// safe, parameterized Postgres queries (never raw user SQL), then asks
// Gemini to phrase the result as a short answer. The Gemini API key and the
// Supabase service role key are read from environment secrets and never
// reach the client.
//
// Deploy: supabase functions deploy sigma-assistant
// Secrets: supabase secrets set GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Error codes returned to the client (see src/components/assistant/SigmaAssistant.tsx
// for how each is rendered as a distinct inline chat message):
//   config_missing      — a required secret isn't set on this deployment
//   gemini_unauthorized — Gemini rejected the API key (401/403)
//   gemini_rate_limited — every model in the fallback chain is rate-limited/unavailable
//   gemini_timeout      — a Gemini request took too long
//   gemini_bad_response — Gemini returned 2xx but no usable text
//   invalid_request     — the client sent a malformed body
//   internal_error      — anything else (also logged server-side via console.error)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface QueryResult {
  intent: string
  data: unknown
}

class AssistantError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message)
  }
}

// ============================================================
// Task 2 — data-driven fallback chain, RPM-filtered + sorted.
//
// Verified 2026-08 against this project's real API key via direct
// generateContent calls (re-verify periodically — Google's model
// availability and this project's entitlements can change):
//   - gemini-2.0-flash(-lite), gemini-2.5-flash(-lite) → 404 "no longer
//     available to new users"
//   - gemini-pro-latest (→ gemini-3.1-pro) → hard limit: 0 on free tier
//   - gemini-flash-latest, gemini-flash-lite-latest, gemini-3.1-flash-lite,
//     gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.6-flash → all
//     CONFIRMED WORKING (real generateContent responses returned)
//
// RPM values are estimates (lite variants generally get higher quota than
// full models) — adjust once real usage data is available for this key.
// ============================================================
type ModelLimit = { slug: string; rpm: number; tpm: number; rpd: number }

const MODEL_LIMITS: ModelLimit[] = [
  { slug: 'gemini-flash-lite-latest', rpm: 15, tpm: 250_000, rpd: 500 },
  { slug: 'gemini-3.5-flash-lite', rpm: 15, tpm: 250_000, rpd: 500 },
  { slug: 'gemini-3.1-flash-lite', rpm: 15, tpm: 250_000, rpd: 500 },
  { slug: 'gemini-flash-latest', rpm: 5, tpm: 250_000, rpd: 20 },
  { slug: 'gemini-3.6-flash', rpm: 5, tpm: 250_000, rpd: 20 },
  { slug: 'gemini-3.5-flash', rpm: 5, tpm: 250_000, rpd: 20 },
]

const FALLBACK_CHAIN = MODEL_LIMITS.filter((m) => m.rpm > 0)
  .sort((a, b) => b.rpm - a.rpm)
  .map((m) => m.slug)

// ============================================================
// Task 4 — session-level "sticky" model preference. Per-instance only
// (Edge Function instances can cold-start at any time, wiping this) — pure
// optimization, never required for correctness. Cooldown mirrors Google's
// per-minute RPM window so a model isn't retried again for ~60s after a 429.
// ============================================================
const RATE_LIMIT_COOLDOWN_MS = 60_000
let lastGoodModel: string | null = null
const rateLimitedUntil: Record<string, number> = {}

function orderedChainForThisRequest(): string[] {
  const now = Date.now()
  const usable = FALLBACK_CHAIN.filter((slug) => (rateLimitedUntil[slug] ?? 0) < now)
  if (lastGoodModel && usable.includes(lastGoodModel)) {
    return [lastGoodModel, ...usable.filter((s) => s !== lastGoodModel)]
  }
  return usable.length > 0 ? usable : FALLBACK_CHAIN // if everything's cooling down, try anyway
}

// ============================================================
// Task 1 — verify real model slugs. Not run automatically on every request
// (that would waste a call/quota per invocation) — trigger it manually by
// POSTing { "debug": "list-models" } to this function, then diff the logged
// list against MODEL_LIMITS above.
// ============================================================
async function verifyModelSlugs(): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`)
  if (!res.ok) {
    console.error('verifyModelSlugs: failed to list models', res.status, await res.text())
    return []
  }
  const json = await res.json()
  const names: string[] = (json.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, ''))
  console.log('verifyModelSlugs: models available to this API key:', names)
  console.log(
    'verifyModelSlugs: MODEL_LIMITS slugs NOT found in that list (fix these):',
    MODEL_LIMITS.map((m) => m.slug).filter((slug) => !names.includes(slug))
  )
  return names
}

// ------------------------------------------------------------
// Safe, parameterized intents. Add new capabilities here rather
// than allowing free-form SQL from the assistant.
// ------------------------------------------------------------
async function resolveIntent(supabase: ReturnType<typeof createClient>, question: string): Promise<QueryResult> {
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
      .select('id, programs!inner(colleges!inner(name))', { count: 'exact' })
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
    const { data } = await supabase
      .from('students')
      .select('programs ( colleges ( name ) )')
    return { intent: 'scholars_per_college', data }
  }

  const { data } = await supabase.from('dashboard_stats').select('*').single()
  return { intent: 'general_stats', data }
}

// ============================================================
// Task 3 — fallback loop, now handling 429 the same way as 404: log and
// move to the next model rather than aborting the whole chain.
// ============================================================
async function callGeminiWithFallback(prompt: string): Promise<string> {
  const errors: { slug: string; status: number; message: string }[] = []
  let sawOnlyAuthFailures = true

  for (const slug of orderedChainForThisRequest()) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let res: Response
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${slug}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeout)
      if ((err as Error).name === 'AbortError') {
        console.error(`Model "${slug}" timed out after 15s.`)
        errors.push({ slug, status: 0, message: 'timeout' })
        continue
      }
      console.error(`Model "${slug}" threw a network error:`, err)
      errors.push({ slug, status: 0, message: String(err) })
      continue
    }
    clearTimeout(timeout)

    // 401 = key rejected outright. 403 is usually per-model access denial
    // ("this project can't use this model"), not a bad key — so both still
    // move on to the next model; only if EVERY model comes back 401/403 do
    // we conclude the key itself is the problem.
    if (res.status === 401 || res.status === 403) {
      console.warn(`Model "${slug}" denied (${res.status}) — trying next model.`)
      errors.push({ slug, status: res.status, message: 'denied' })
      continue
    }
    sawOnlyAuthFailures = false

    if (res.status === 404) {
      console.warn(`Model "${slug}" not found — skipping to next in chain.`)
      errors.push({ slug, status: 404, message: 'not found' })
      continue
    }

    if (res.status === 429) {
      console.warn(`Model "${slug}" rate-limited — falling back to next model.`)
      rateLimitedUntil[slug] = Date.now() + RATE_LIMIT_COOLDOWN_MS
      errors.push({ slug, status: 429, message: 'rate limited' })
      continue
    }

    if (!res.ok) {
      const body = await res.text()
      console.error(`Model "${slug}" failed with status ${res.status}: ${body}`)
      errors.push({ slug, status: res.status, message: body })
      continue
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (text && typeof text === 'string' && text.trim() !== '') {
      console.info(`Model "${slug}" succeeded.`)
      lastGoodModel = slug
      return text
    }

    errors.push({ slug, status: res.status, message: 'empty response' })
  }

  console.error('All models in fallback chain failed:', errors)
  if (sawOnlyAuthFailures) {
    throw new AssistantError('gemini_unauthorized', 'Gemini rejected the API key on every model in the chain', 502)
  }
  throw new AssistantError(
    'gemini_rate_limited',
    'All available Gemini models are currently rate-limited or unavailable',
    429
  )
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

async function askGemini(question: string, result: QueryResult): Promise<string> {
  const prompt = `${FORMATTING_INSTRUCTIONS}

Question: ${question}
Data (intent: ${result.intent}): ${JSON.stringify(result.data)}`

  return callGeminiWithFallback(prompt)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ code: 'invalid_request', error: 'Method not allowed' }), { status: 405 })
  }

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('sigma-assistant: missing required secret(s)', {
      hasGeminiKey: !!GEMINI_API_KEY,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SERVICE_ROLE_KEY,
    })
    return new Response(
      JSON.stringify({ code: 'config_missing', error: 'Assistant is not configured on this deployment' }),
      { status: 500 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ code: 'invalid_request', error: 'Malformed JSON body' }), { status: 400 })
  }

  // Task 1 manual verification hook — POST { "debug": "list-models" }.
  if (body?.debug === 'list-models') {
    const names = await verifyModelSlugs()
    return new Response(JSON.stringify({ models: names }), { headers: { 'Content-Type': 'application/json' } })
  }

  const question = body?.question
  if (!question || typeof question !== 'string') {
    return new Response(JSON.stringify({ code: 'invalid_request', error: 'Missing or invalid "question" field' }), {
      status: 400,
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const result = await resolveIntent(supabase, question)
    const answer = await askGemini(question, result)

    return new Response(JSON.stringify({ answer, intent: result.intent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof AssistantError) {
      console.error(`sigma-assistant: ${err.code}`, err.message)
      return new Response(JSON.stringify({ code: err.code, error: err.message }), { status: err.status })
    }
    console.error('sigma-assistant: unhandled error', err)
    return new Response(JSON.stringify({ code: 'internal_error', error: (err as Error).message }), { status: 500 })
  }
})
