// Client-side SIGMA Assistant logic. Calls Gemini directly from the browser
// using VITE_GEMINI_API_KEY — by design this key is bundled into the client
// JS and publicly readable (see README for the tradeoff this project chose
// vs. routing through a server-side Edge Function). Ported from the
// supabase/functions/sigma-assistant Edge Function so behavior (intent
// resolution, safe parameterized queries, model fallback chain) stays the
// same either way.

import { supabase } from '@/lib/supabase'
import { explicitCollegeName, explicitScholarshipCategory, isContextualFollowUp, lastAcademicYearText, relativeAcademicYear, type ScholarQueryMode } from '@/utils/assistantContext'
import { duplicateQueryMode, normalizeAssistantQuestion, requestedDuplicateResultLimit, scholarshipNameMatchesQuestion, stripScholarshipReferenceMetadata } from '@/utils/assistantFuzzy'
import { fetchCanonicalStudentCounts, isGenericStudentTotalQuestion, studentProfileCountScope, summarizeAssignmentPopulation } from '@/utils/studentAnalytics'
import { matchesStudentRecordAssignment } from '@/utils/studentRecordFilters'
import { retryAssistantOperation } from '@/utils/assistantRetry'
import { findProgramsInText, programLookupKeys, type ProgramReference } from '@/utils/programMatching'

// Gemini credentials live only in the authenticated Edge Function.
const GEMINI_API_KEY: string | undefined = undefined

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
  pagination?: AssistantPagination
}

export interface AssistantPagination {
  title: string
  noun: string
  pageSize: number
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, string>>
}

export interface AssistantConversationMessage {
  role: 'assistant' | 'user'
  text: string
  pagination?: AssistantPagination
  page?: number
}

export interface AssistantScholarContext {
  kind: 'scholars'
  filterLabel: string
  assignments: any[]
  studentIds: string[]
  mode: ScholarQueryMode
  academicYear: string | null
  semester: string | null
  scholarshipStatus: string | null
  needsReview: boolean
  categories: string[]
  scholarships: string[]
  colleges: string[]
  programs: string[]
  pendingPrograms?: ProgramReference[]
  pendingProgramQuestion?: string
}

export type AssistantQueryContext = AssistantScholarContext

export interface AssistantResponse {
  answer: string
  context: AssistantQueryContext | null
  pagination?: AssistantPagination
}

function isStructuredDatabaseQuestion(question: string): boolean {
  const normalized = normalizeAssistantQuestion(question).toLowerCase()
  const requestsRecords = /\b(?:how\s+many|count|number|total|list|show|who|which|find)\b/.test(normalized)
  const namesDatabaseScope = /\b(?:students?|scholars?|scholarships?|college|program|category|status|semester|academic\s+year|enrolled|duplicate|active|inactive|renewal|pending|incomplete|government|institutional|private)\b/.test(normalized)
  return requestsRecords && namesDatabaseScope
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
  const aliases = [...programLookupKeys(name), ...programLookupKeys(code)]

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

function referenceAliases(name: string, code?: string | null): string[] {
  const aliases = new Set<string>()
  if (code?.trim()) aliases.add(code.trim())

  const nameWithoutReferences = stripScholarshipReferenceMetadata(name)
  const nameWithoutParentheses = nameWithoutReferences.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (nameWithoutParentheses && normalize(nameWithoutParentheses) !== normalize(name)) aliases.add(nameWithoutParentheses)

  for (const match of name.matchAll(/\(([^)]+)\)/g)) {
    if (match[1]?.trim()) aliases.add(match[1].trim())
  }

  // Hyphenated official names commonly combine an agency prefix with the
  // recognizable program name (for example, AGENCY-Program). The suffix is
  // derived from the database value and is accepted only as an exact phrase.
  const hyphenSuffix = nameWithoutParentheses.match(/^[^-]+-(.+)$/)?.[1]?.trim()
  if (hyphenSuffix && normalize(hyphenSuffix).length >= 4) aliases.add(hyphenSuffix)
  const leadingCompound = nameWithoutParentheses.match(/^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\b/)?.[1]?.trim()
  if (leadingCompound) aliases.add(leadingCompound)

  const words = name
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  const significant = words.filter((word) => !['and', 'of', 'the', 'on', 'for'].includes(word.toLowerCase()))
  const acronym = significant.map((word) => word[0]).join('')
  if (acronym.length >= 2) aliases.add(acronym)

  // Database college names commonly use a compact code such as CEN for
  // "College of Engineering". Derive it from the stored name when a code
  // was not populated, without maintaining a hardcoded college list.
  const collegeSubject = name.match(/^College\s+of\s+(.+)$/i)?.[1]
  if (collegeSubject) {
    const compactSubject = normalize(collegeSubject).replace(/\s+/g, '')
    if (compactSubject.length >= 2) aliases.add(`C${compactSubject.slice(0, 2)}`.toUpperCase())
    const subjectWords = collegeSubject.split(/[^A-Za-z0-9]+/).filter((word) => word && !['and', 'of', 'the'].includes(word.toLowerCase()))
    const subjectInitials = subjectWords.map((word) => word[0]).join('').toUpperCase()
    if (subjectInitials) {
      aliases.add(`C${subjectInitials}`)
      aliases.add(`CO${subjectInitials}`)
    }
  }

  return [...aliases]
}

const OFFICIAL_COLLEGE_ALIASES: Record<string, string[]> = {
  CEN: ['college of engineering'],
  CEAT: ['college of engineering', 'college of engineering and technology', 'college of engineering and agro industrial technology'],
  CASS: ['college of arts and social sciences'],
  CBAA: ['college of business administration', 'college of business administration and accountancy'],
  COE: ['college of education'],
  CAS: ['college of arts and sciences'],
}

function collegeAliases(name: string, code?: string | null): string[] {
  const aliases = new Set(referenceAliases(name, code))
  const normalizedName = normalize(name)
  for (const [alias, officialNames] of Object.entries(OFFICIAL_COLLEGE_ALIASES)) {
    if (officialNames.some((officialName) => {
      const normalizedOfficial = normalize(officialName)
      return normalizedName === normalizedOfficial
        || normalizedName.includes(normalizedOfficial)
        || normalizedOfficial.includes(normalizedName)
    })) aliases.add(alias)
  }
  return [...aliases]
}

function requestedScholarshipQualifier(question: string): string | null {
  const beforeScholars = question.match(/^\s*(?:(?:show|list|find|give me|who are)\s+)?(?:(?:all|the|of)\s+)*(.*?)\s+scholars?\b/i)?.[1]
  if (!beforeScholars) return null

  const ignored = new Set([
    'active', 'inactive', 'pending', 'verification', 'renewal', 'incomplete', 'documents',
    'government', 'institutional', 'private', 'all', 'the', 'of', 'matching',
    'show', 'list', 'find', 'give', 'me', 'who', 'are',
    'how', 'many', 'count', 'number', 'total', 'display', 'student', 'students',
    'academic', 'year', 'ay',
  ])
  const meaningful = normalize(beforeScholars).split(' ').filter((word) => word && !ignored.has(word))
  return meaningful.length > 0 ? meaningful.join(' ') : null
}

function extractStudentNumber(question: string): string | null {
  const match = question.match(/\b(\d{2})-?(\d{4})\b/)
  return match ? `${match[1]}-${match[2]}` : null
}

function plainStudentName(student: any): string {
  return [student?.first_name, student?.middle_name, student?.last_name, student?.suffix]
    .filter(Boolean)
    .join(' ')
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
  return isContextualFollowUp(question)
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
    ['Student ID', 'Name', 'Scholarship', 'Program', 'Status'],
    rows.map((row) => [
      row.students.student_number,
      studentName(row),
      [...(scholarshipsByStudent.get(row.students.id) ?? [])].sort().join(', '),
      row.students.programs?.name,
      row.status,
    ])
  )}\n\n### Summary\n**Total Matching Scholars:** ${rows.length}`
}

function scholarPagination(assignments: any[], filterLabel: string): AssistantPagination {
  const rows = distinctScholarRows(assignments)
  const scholarshipsByStudent = new Map<string, Set<string>>()
  for (const assignment of assignments) {
    const studentId = assignment.students?.id
    const scholarship = assignment.scholarships?.name
    if (!studentId || !scholarship) continue
    if (!scholarshipsByStudent.has(studentId)) scholarshipsByStudent.set(studentId, new Set())
    scholarshipsByStudent.get(studentId)!.add(scholarship)
  }
  return {
    title: `${filterLabel} Scholars`,
    noun: 'students',
    pageSize: 10,
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'studentId', label: 'Student ID' },
      { key: 'scholarship', label: 'Scholarship' },
    ],
    rows: rows.map((row) => ({
      student: studentName(row),
      studentId: String(row.students?.student_number ?? '—'),
      scholarship: [...(scholarshipsByStudent.get(row.students?.id) ?? [])].sort().join(', ') || '—',
    })),
  }
}

async function resolveIntent(
  question: string,
  history: AssistantConversationMessage[] = [],
  previousContext: AssistantQueryContext | null = null,
): Promise<QueryResult> {
  const q = normalizeAssistantQuestion(question).toLowerCase()
  const normalizedCurrentQuestion = stripScholarshipReferenceMetadata(normalizeAssistantQuestion(question))
  const currentQ = normalizedCurrentQuestion.toLowerCase()
  let contextualQuestion = normalizeAssistantQuestion(questionWithContext(question, history))
  const pendingProgramMatches = previousContext?.pendingPrograms?.length
    ? findProgramsInText(normalizedCurrentQuestion, previousContext.pendingPrograms)
    : []
  const resolvesPendingProgram = pendingProgramMatches.length === 1
  const continuesScholarContext = isFollowUpQuestion(question) || resolvesPendingProgram
  if (resolvesPendingProgram && previousContext?.pendingProgramQuestion) {
    contextualQuestion = normalizeAssistantQuestion(`${previousContext.pendingProgramQuestion} ${question}`)
  }
  const resolvedRelativeYear = previousContext?.kind === 'scholars'
    ? relativeAcademicYear(question, previousContext.academicYear)
    : null
  if (resolvedRelativeYear) contextualQuestion += ` academic year ${resolvedRelativeYear}`
  contextualQuestion = stripScholarshipReferenceMetadata(contextualQuestion)
  const contextualQ = contextualQuestion.toLowerCase()

  // Exact Student ID lookups always win over generic scholar analytics. A
  // missing ID must return "not found", never a system-wide fallback count.
  const studentNumber = extractStudentNumber(contextualQuestion)
  if (studentNumber) {
    const { data, error } = await supabase
      .from('students')
      .select(`id, student_number, first_name, middle_name, last_name, suffix, yr_level, email, contact_number, archived_at,
        programs(name, code, colleges(name, code)),
        student_scholarships(id, academic_year, semester, status, is_enrolled, archived_at, term_closed_at,
          scholarships(name, status, archived_at))`)
      .eq('student_number', studentNumber)
      .maybeSingle()
    assertQuerySucceeded(error)

    if (!data) {
      return {
        intent: 'student_id_not_found',
        data: null,
        answer: `No student record was found for Student ID **${studentNumber}**.`,
      }
    }

    const student = data as any
    const name = plainStudentName(student)
    const program = student.programs
    const collegeLabel = [program?.colleges?.code, program?.colleges?.name].filter(Boolean).join(' — ') || '—'
    const programLabel = [program?.code, program?.name].filter(Boolean).join(' — ') || '—'
    const asksForActiveScholarship = /\bactive\b.*\bscholarship|\bscholarship\b.*\bactive\b|\bhas?\b.*\bscholarship|\bis there\b.*\bscholarship/i.test(question)

    if (asksForActiveScholarship) {
      const activeAssignments = (student.student_scholarships ?? []).filter((assignment: any) =>
        assignment.status === 'Active'
        && !assignment.archived_at
        && !assignment.term_closed_at
        && !assignment.scholarships?.archived_at
        && ['Active', 'Expiring Soon'].includes(assignment.scholarships?.status)
      )

      if (activeAssignments.length === 0) {
        return {
          intent: 'active_scholarship_by_student_id',
          data: { student, assignments: [] },
          answer: `Student **${studentNumber}** exists (${name}), but no active scholarship was found.`,
        }
      }

      const answer = activeAssignments.length === 1
        ? [
            '### Active Scholarship Found',
            `**Student:** ${name}`,
            `**Student ID:** ${studentNumber}`,
            `**Scholarship:** ${activeAssignments[0].scholarships?.name ?? '—'}`,
            `**Status:** ${activeAssignments[0].status}`,
            `**Academic Year:** ${activeAssignments[0].academic_year}`,
            `**Semester:** ${activeAssignments[0].semester}`,
          ].join('\n\n')
        : `### Active Scholarships for ${name}\n${formatTable(
            ['Scholarship', 'Status', 'Academic Year', 'Semester'],
            activeAssignments.map((assignment: any) => [
              assignment.scholarships?.name,
              assignment.status,
              assignment.academic_year,
              assignment.semester,
            ])
          )}`
      return { intent: 'active_scholarship_by_student_id', data: { student, assignments: activeAssignments }, answer }
    }

    const assignments = (student.student_scholarships ?? []).filter((assignment: any) => !assignment.archived_at)
    const current = assignments.sort((a: any, b: any) => `${b.academic_year}-${b.semester}`.localeCompare(`${a.academic_year}-${a.semester}`))[0]
    return {
      intent: 'student_by_id',
      data: student,
      answer: [
        '### Student Found',
        `**Name:** ${name}`,
        `**Student ID:** ${studentNumber}`,
        `**College:** ${collegeLabel}`,
        `**Program:** ${programLabel}`,
        `**Year Level:** ${student.yr_level ?? '—'}`,
        `**Scholarship:** ${current?.scholarships?.name ?? '—'}`,
        `**Academic Year:** ${current?.academic_year ?? '—'}`,
        `**Semester:** ${current?.semester ?? '—'}`,
        `**Scholarship Status:** ${current?.status ?? '—'}`,
        `**Enrollment Status:** ${current?.is_enrolled == null ? 'Not yet verified' : current.is_enrolled ? 'Enrolled' : 'Not Enrolled'}`,
      ].join('\n\n'),
    }
  }

  if (contextualQ.includes('duplicate')) {
    const resolved = /\bresolved?\b|\bclosed?\b/.test(contextualQ)
    const requestedFlagStatus = resolved ? 'Resolved' : 'Open'
    const mode = duplicateQueryMode(q)
    const resultLimit = requestedDuplicateResultLimit(question, Number.MAX_SAFE_INTEGER)
    let duplicateQuery = supabase
      .from('duplicate_flags')
      .select(`id, reason, status, created_at,
        students ( id, student_number, last_name, first_name ),
        a:student_scholarship_id_a ( academic_year, semester, scholarships ( name ) ),
        b:student_scholarship_id_b ( academic_year, semester, scholarships ( name ) )`)
    duplicateQuery = resolved
      ? duplicateQuery.in('status', ['Resolved', 'Confirmed Valid'])
      : duplicateQuery.in('status', ['Open', 'Under Review'])
    const { data, error } = await duplicateQuery
      .order('created_at', { ascending: false })
    assertQuerySucceeded(error)
    const rows = (data ?? []) as any[]
    const uniqueStudents = new Map<string, any>()
    for (const row of rows) {
      const key = row.students?.id ?? row.students?.student_number ?? row.id
      if (!uniqueStudents.has(key)) uniqueStudents.set(key, row)
    }
    const studentRows = [...uniqueStudents.values()]

    if (mode === 'count') {
      const asksForStudents = /\bstudents?\b|\bscholars?\b/.test(contextualQ) && !/\bcases?\b|\bflags?\b/.test(contextualQ)
      const total = asksForStudents ? studentRows.length : rows.length
      return {
        intent: resolved ? 'resolved_duplicate_count' : 'open_duplicate_count',
        data: { count: total, caseCount: rows.length, studentCount: studentRows.length, status: requestedFlagStatus },
        answer: `**${resolved ? 'Resolved' : 'Open'} Duplicate ${asksForStudents ? 'Students' : 'Cases'}:** ${total}`,
      }
    }

    if (studentRows.length === 0) {
      return {
        intent: 'duplicate_student_list',
        data: [],
        answer: `There are currently 0 ${requestedFlagStatus.toLowerCase()} duplicate scholarship cases in SIGMA.`,
      }
    }

    const selected = studentRows.slice(0, resultLimit)
    const detailRows = selected.map((row) => [
      row.students?.student_number,
      `${row.students?.first_name ?? ''} ${row.students?.last_name ?? ''}`.trim(),
      [row.a?.scholarships?.name, row.b?.scholarships?.name].filter(Boolean).join(' & '),
      [row.a?.academic_year ?? row.b?.academic_year, row.a?.semester ?? row.b?.semester].filter(Boolean).join(' \u2022 '),
      `${row.status} Duplicate Case`,
    ])
    const intro = selected.length === 1
      ? 'One student with a duplicate scholarship:'
      : `${selected.length} students with duplicate scholarships:`
    const answer = selected.length === 1 ? `${intro}\n\n${formatTable(
      ['Student ID', 'Name', 'Conflicting Scholarships', 'Academic Term', 'Status'],
      detailRows,
    )}\n\nThere are **${rows.length} total ${requestedFlagStatus.toLowerCase()} duplicate cases** currently${resolved ? '.' : ' requiring review.'}`
      : `**${selected.length} ${requestedFlagStatus} Duplicate Students Found**`
    const pagination: AssistantPagination | undefined = selected.length > 1 ? {
      title: `${requestedFlagStatus} Duplicate Students`,
      noun: 'students',
      pageSize: 10,
      columns: [
        { key: 'student', label: 'Student' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'scholarship', label: 'Conflicting Scholarships' },
        { key: 'term', label: 'Academic Term' },
      ],
      rows: selected.map((row) => ({
        student: `${row.students?.first_name ?? ''} ${row.students?.last_name ?? ''}`.trim(),
        studentId: String(row.students?.student_number ?? '—'),
        scholarship: [row.a?.scholarships?.name, row.b?.scholarships?.name].filter(Boolean).join(' & ') || '—',
        term: [row.a?.academic_year ?? row.b?.academic_year, row.a?.semester ?? row.b?.semester].filter(Boolean).join(' • ') || '—',
      })),
    } : undefined
    return { intent: 'duplicate_student_list', data: selected, answer, pagination }
  }

  const profileCountScope = studentProfileCountScope(contextualQuestion)
  if (profileCountScope) {
    const counts = await fetchCanonicalStudentCounts()
    const count = profileCountScope === 'active' ? counts.activeStudents : counts.allStudents
    return {
      intent: profileCountScope === 'active' ? 'active_student_count' : 'total_student_count',
      data: { count, scope: profileCountScope },
      answer: profileCountScope === 'active'
        ? `**Total Active Students:** ${count}\n\nThere are **${count} active student records** currently in SIGMA.`
        : `**Total Students:** ${count}\n\nThere are **${count} distinct student profiles** in the SIGMA database.`,
    }
  }

  // Retain the legacy generic detector as a safe fallback for phrasing that
  // has not yet been classified by the stricter student-profile scope.
  if (isGenericStudentTotalQuestion(contextualQuestion)) {
    const counts = await fetchCanonicalStudentCounts()
    return {
      intent: 'total_student_count',
      data: { count: counts.allStudents, scope: 'all' },
      answer: `**Total Students:** ${counts.allStudents}\n\nThere are **${counts.allStudents} distinct student profiles** in the SIGMA database.`,
    }
  }

  const enrollmentQuestion = /\benrolled\b/.test(contextualQ) && /\bstudents?\b|\bscholars?\b/.test(contextualQ)
  if (enrollmentQuestion) {
    const wantsNotEnrolled = /\bnot\s+enrolled\b|\bunenrolled\b/.test(contextualQ)
    const { data, error } = await supabase
      .from('student_scholarships')
      .select('student_id, is_enrolled, students!inner(archived_at)')
      .is('archived_at', null)
      .is('term_closed_at', null)
      .is('students.archived_at', null)
      .not('is_enrolled', 'is', null)
    assertQuerySucceeded(error)
    const rows = (data ?? []) as { student_id: string; is_enrolled: boolean }[]
    const enrolledIds = new Set(rows.filter((row) => row.is_enrolled === true).map((row) => row.student_id))
    const notEnrolledIds = new Set(rows.filter((row) => row.is_enrolled === false && !enrolledIds.has(row.student_id)).map((row) => row.student_id))
    const count = wantsNotEnrolled ? notEnrolledIds.size : enrolledIds.size
    return {
      intent: wantsNotEnrolled ? 'not_enrolled_student_count' : 'enrolled_student_count',
      data: { count, enrollmentStatus: wantsNotEnrolled ? 'Not Enrolled' : 'Enrolled' },
      answer: `**Total ${wantsNotEnrolled ? 'Students Who Are Not Enrolled' : 'Enrolled Students'}:** ${count}`,
    }
  }

  const asksForExpiringStudents = /\bstudents?\b|\bscholars?\b/.test(contextualQ)
  if ((contextualQ.includes('expiring') || contextualQ.includes('expire')) && !asksForExpiringStudents) {
    const today = new Date()
    const asksThisMonth = /this month|current month/.test(contextualQ)
    const rangeStart = asksThisMonth ? new Date(today.getFullYear(), today.getMonth(), 1) : today
    const cutoff = asksThisMonth ? new Date(today.getFullYear(), today.getMonth() + 1, 0) : new Date(today.getTime() + 30 * 86400000)
    const asDate = (date: Date) => date.toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('scholarships')
      .select('name, end_date')
      .not('end_date', 'is', null)
      .lte('end_date', asDate(cutoff))
      .gte('end_date', asDate(rangeStart))
      .is('archived_at', null)
      .order('end_date')
    assertQuerySucceeded(error)
    const rows = (data ?? []) as { name: string; end_date: string | null }[]
    const wantsCount = /how many|count|number|total/.test(q)
    const answer = wantsCount
      ? `**Scholarships Expiring ${asksThisMonth ? 'This Month' : 'Within 30 Days'}:** ${rows.length}`
      : rows.length === 0
        ? `No scholarships are expiring ${asksThisMonth ? 'this month' : 'within the next 30 days'}.`
        : `${rows.length} scholarship${rows.length === 1 ? '' : 's'} will expire ${asksThisMonth ? 'this month' : 'within 30 days'}.\n\n${formatTable(
            ['Scholarship', 'End Date'],
            rows.map((row) => [row.name, row.end_date])
          )}`
    return { intent: 'expiring', data: rows, answer }
  }

  const scopedCountWithoutNoun = /\b(?:how\s+many|count|number|total)\b/.test(contextualQ)
    && /\b(?:under|in|from|with)\b/.test(contextualQ)
    && !/\bscholarships?\b/.test(contextualQ)
  const asksAboutPeople = /\bscholars?\b|\bstudents?\b/.test(contextualQ) || scopedCountWithoutNoun || resolvesPendingProgram

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

    const [assignmentResult, scholarshipResult, programResult, duplicateResult] = await Promise.all([
      supabase
        .from('student_scholarships')
        .select(
          `id, academic_year, semester, status, is_enrolled,
           students!inner(id, student_number, last_name, first_name, yr_level, archived_at,
             programs(name, code, colleges(name, code))),
           scholarships!inner(name, code, status, archived_at, scholarship_categories!inner(name), scholarship_agencies(name))`
        )
        .is('archived_at', null)
        .is('students.archived_at', null)
        .is('scholarships.archived_at', null),
      supabase
        .from('scholarships')
        .select('name, code, scholarship_categories(name), scholarship_agencies(name)')
        .is('archived_at', null),
      supabase
        .from('programs')
        .select('id, name, code')
        .order('name'),
      supabase
        .from('duplicate_flags')
        .select('student_id')
        .eq('status', 'Open'),
    ])
    assertQuerySucceeded(assignmentResult.error)
    assertQuerySucceeded(scholarshipResult.error)
    assertQuerySucceeded(programResult.error)
    assertQuerySucceeded(duplicateResult.error)

    const assignments = (assignmentResult.data ?? []) as any[]
    const scholarshipCatalog = (scholarshipResult.data ?? []) as any[]
    const programCatalog = (programResult.data ?? []) as Array<{ id: string; name: string; code?: string | null }>
    const semester = currentQ.includes('1st semester') || currentQ.includes('first semester')
      ? '1st Semester'
      : currentQ.includes('2nd semester') || currentQ.includes('second semester')
        ? '2nd Semester'
        : currentQ.includes('summer')
          ? 'Summer'
          : null
    const appliedYear = lastAcademicYearText(normalizedCurrentQuestion)
      ?? (continuesScholarContext ? previousContext?.academicYear ?? null : null)
    const appliedSemester = semester
      ?? (continuesScholarContext ? previousContext?.semester ?? null : null)

    const statusMatchers: [string, RegExp][] = [
      ['Expiring Soon', /\bexpiring(?:\s+soon)?\b/i],
      ['For Renewal', /\b(?:for\s+)?renewal\b/i],
      ['Documents Incomplete', /\b(?:documents?\s+)?incomplete\b/i],
      ['Pending Verification', /\b(?:pending(?:\s+verification)?)\b/i],
      ['Inactive', /\binactive\b/i],
      ['Active', /\bactive\b/i],
    ]
    const requestedStatuses = statusMatchers.flatMap(([status, pattern]) => {
      const matches = [...normalizedCurrentQuestion.matchAll(new RegExp(pattern.source, 'gi'))]
      return matches.map((match) => ({ status, index: match.index ?? -1 }))
    }).sort((a, b) => a.index - b.index)
    const explicitlyRequestedStatus = requestedStatuses.at(-1)?.status ?? null
    const currentNeedsReview = /\bneeds?\s+review\b/i.test(normalizedCurrentQuestion)
    const requestedStatus = explicitlyRequestedStatus
      ?? (continuesScholarContext ? previousContext?.scholarshipStatus ?? null : null)
    const needsReview = currentNeedsReview || Boolean(
      continuesScholarContext && !explicitlyRequestedStatus && previousContext?.needsReview,
    )
    const openDuplicateStudentIds = new Set((duplicateResult.data ?? []).map((row: any) => row.student_id))
    let filtered = assignments.filter((row) => matchesStudentRecordAssignment({
      academicYear: row.academic_year,
      semester: row.semester,
      assignmentStatus: row.status,
      scholarshipStatus: row.scholarships?.status,
    }, {
      academicYear: appliedYear,
      semester: appliedSemester,
      status: needsReview ? null : requestedStatus,
    }) && (!needsReview || openDuplicateStudentIds.has(row.students?.id)))

    type EntityType = 'program' | 'college' | 'scholarship' | 'agency' | 'category'
    const entityAliases: Record<EntityType, Map<string, Set<string>>> = {
      program: new Map(), college: new Map(), scholarship: new Map(), agency: new Map(), category: new Map(),
    }
    function addEntity(type: EntityType, name: string | undefined, aliases: string[] = []) {
      if (!name) return
      if (!entityAliases[type].has(name)) entityAliases[type].set(name, new Set())
      for (const alias of aliases) entityAliases[type].get(name)!.add(alias)
    }
    for (const row of assignments) {
      const program = row.students?.programs
      addEntity('program', program?.name, programAliases(program?.name ?? '', program?.code))
      addEntity('college', program?.colleges?.name, collegeAliases(program?.colleges?.name ?? '', program?.colleges?.code))
      const scholarshipName = row.scholarships?.name as string | undefined
      addEntity('scholarship', scholarshipName, referenceAliases(scholarshipName ?? '', row.scholarships?.code))
      const agencyName = row.scholarships?.scholarship_agencies?.name as string | undefined
      addEntity('agency', agencyName, referenceAliases(agencyName ?? ''))
      addEntity('category', row.scholarships?.scholarship_categories?.name)
    }
    // Include every current scholarship definition, even when it has no
    // assignments. An empty assignment set means zero scholars, not an
    // unknown scholarship.
    for (const scholarship of scholarshipCatalog) {
      addEntity('scholarship', scholarship.name, referenceAliases(scholarship.name ?? '', scholarship.code))
      addEntity('agency', scholarship.scholarship_agencies?.name, referenceAliases(scholarship.scholarship_agencies?.name ?? ''))
      addEntity('category', scholarship.scholarship_categories?.name)
    }
    for (const program of programCatalog) {
      addEntity('program', program.name, programAliases(program.name, program.code))
    }
    const currentProgramMatches = findProgramsInText(normalizedCurrentQuestion, programCatalog)
    if (currentProgramMatches.length > 1) {
      const pendingMode: ScholarQueryMode = /list|show|who|names|which|give me|\ball\b/.test(q) ? 'list' : 'count'
      return {
        intent: 'ambiguous_program_filter',
        data: currentProgramMatches,
        answer: `I found multiple official programs that may match your question:\n\n${currentProgramMatches.map((program) => `- **${program.name}**${program.code ? ` (${program.code})` : ''}`).join('\n')}\n\nPlease choose one program so I can return the correct students.`,
        context: {
          kind: 'scholars',
          filterLabel: 'program selection',
          assignments: [],
          studentIds: [],
          mode: pendingMode,
          academicYear: appliedYear,
          semester: appliedSemester,
          scholarshipStatus: requestedStatus,
          needsReview,
          categories: continuesScholarContext ? previousContext?.categories ?? [] : [],
          scholarships: continuesScholarContext ? previousContext?.scholarships ?? [] : [],
          colleges: continuesScholarContext ? previousContext?.colleges ?? [] : [],
          programs: [],
          pendingPrograms: currentProgramMatches,
          pendingProgramQuestion: contextualQuestion,
        },
      }
    }
    const matchedByType = (Object.keys(entityAliases) as EntityType[]).map((type) => {
      const entities = [...entityAliases[type].entries()]
      const currentQuestionMatches = entities
        .filter(([name, aliases]) => type === 'scholarship'
          ? scholarshipNameMatchesQuestion(question, name, [...aliases])
          : includesEntity(question, name, [...aliases]))
        .map(([name]) => name)
      const directNames = entities
        .filter(([name]) => type === 'scholarship'
          ? scholarshipNameMatchesQuestion(contextualQuestion, name, [...(entityAliases.scholarship.get(name) ?? [])])
          : includesEntity(contextualQuestion, name))
        .map(([name]) => name)
      const inheritedNames = type === 'scholarship' && directNames.length > 0
        ? directNames
        : entities
            .filter(([name, aliases]) => includesEntity(contextualQuestion, name, [...aliases]))
            .map(([name]) => name)
      let names = currentQuestionMatches.length > 0 ? currentQuestionMatches : inheritedNames
      if (continuesScholarContext && currentQuestionMatches.length === 0 && previousContext) {
        if (type === 'category') names = previousContext.categories
        if (type === 'scholarship') names = previousContext.scholarships
        if (type === 'college') names = previousContext.colleges
        if (type === 'program') names = previousContext.programs
      }
      return { type, names }
    }).filter((match) => match.names.length > 0)

    // A category or scholarship named in the current follow-up replaces the
    // prior scholarship scope while status, term, college, and result mode
    // continue from the structured context.
    const currentCategory = explicitScholarshipCategory(normalizedCurrentQuestion)
    const currentCollege = explicitCollegeName(normalizedCurrentQuestion)
    const currentScholarshipNames = [...entityAliases.scholarship.entries()]
      .filter(([name, aliases]) => scholarshipNameMatchesQuestion(normalizedCurrentQuestion, name, [...aliases]))
      .map(([name]) => name)
    if (currentCategory || currentScholarshipNames.length > 0) {
      const categoryIndex = matchedByType.findIndex((match) => match.type === 'category')
      const scholarshipIndex = matchedByType.findIndex((match) => match.type === 'scholarship')
      if (currentCategory) {
        if (categoryIndex >= 0) matchedByType[categoryIndex].names = [currentCategory]
        else matchedByType.push({ type: 'category', names: [currentCategory] })
        if (scholarshipIndex >= 0) matchedByType.splice(scholarshipIndex, 1)
      } else {
        if (scholarshipIndex >= 0) matchedByType[scholarshipIndex].names = currentScholarshipNames
        else matchedByType.push({ type: 'scholarship', names: currentScholarshipNames })
        const inheritedCategoryIndex = matchedByType.findIndex((match) => match.type === 'category')
        if (inheritedCategoryIndex >= 0) matchedByType.splice(inheritedCategoryIndex, 1)
      }
    }
    if (currentCollege) {
      const collegeIndex = matchedByType.findIndex((match) => match.type === 'college')
      if (collegeIndex >= 0) matchedByType[collegeIndex].names = [currentCollege]
      else matchedByType.push({ type: 'college', names: [currentCollege] })

      // Short college aliases such as CE, CA, and CS must not also narrow the
      // result through a coincidentally matching program code.
      const programIndex = matchedByType.findIndex((match) => match.type === 'program')
      if (programIndex >= 0) matchedByType.splice(programIndex, 1)
    }
    if (currentProgramMatches.length === 1) {
      const programIndex = matchedByType.findIndex((match) => match.type === 'program')
      const officialProgramName = currentProgramMatches[0].name
      if (programIndex >= 0) matchedByType[programIndex].names = [officialProgramName]
      else matchedByType.push({ type: 'program', names: [officialProgramName] })
    }

    if (matchedByType.length > 0) {
      filtered = filtered.filter((row) => matchedByType.every(({ type, names }) => {
        const value = type === 'program' ? row.students?.programs?.name
          : type === 'college' ? row.students?.programs?.colleges?.name
            : type === 'scholarship' ? row.scholarships?.name
              : type === 'agency' ? row.scholarships?.scholarship_agencies?.name
                : row.scholarships?.scholarship_categories?.name
        return names.includes(value)
      }))
    }

    const categoryFilter = matchedByType.find((match) => match.type === 'category')?.names ?? []
    if (categoryFilter.length > 0) {
      filtered = filtered.filter((row) => matchesStudentRecordAssignment({
        category: row.scholarships?.scholarship_categories?.name,
      }, { category: categoryFilter.length === 1 ? categoryFilter[0] : null }))
    }

    const matchedEntities = matchedByType.flatMap((match) => match.names)
    const scholarshipQualifier = requestedScholarshipQualifier(contextualQuestion)
    const matchedScholarshipScope = matchedByType.some((match) => match.type === 'scholarship' || match.type === 'agency')
    if (scholarshipQualifier && !matchedScholarshipScope) {
      return {
        intent: 'unmatched_scholarship_filter',
        data: [],
        answer: `I couldn't confidently match **${scholarshipQualifier.toUpperCase()}** to a scholarship or provider in SIGMA's records. Please use its official scholarship or organization name.`,
      }
    }
    const hasRecognizedFilter = Boolean(requestedStatus || needsReview || appliedYear || appliedSemester || currentCategory || currentCollege)
    const hasUnmatchedScope = matchedEntities.length === 0 && !hasRecognizedFilter && /\b(?:in|from|under|taking)\s+[a-z0-9]/i.test(contextualQuestion)
    if (hasUnmatchedScope) {
      return {
        intent: 'unmatched_scholar_filter',
        data: [],
        answer:
          "I couldn't match that program, college, scholarship, provider, or category to SIGMA's records. Try its full name or official database code.",
      }
    }

    const scholarRows = distinctScholarRows(filtered)
    const filteredPopulation = summarizeAssignmentPopulation(
      filtered,
      (row) => row.students?.id,
      (row) => row.status === 'Active',
    )
    const matchingStudentCount = filteredPopulation.distinctStudents
    const statusLabel = needsReview ? 'Needs Review' : requestedStatus
    const filterLabel = [statusLabel, matchedEntities.join(' / '), appliedYear, appliedSemester].filter(Boolean).join(', ') || 'all scholar records'
    const asksToListNow = /list|show|who|names|which|give me|\ball\b/.test(q)
    const asksToCountNow = /how many|count|number|total/.test(q)
    const mode: ScholarQueryMode = asksToListNow ? 'list' : asksToCountNow ? 'count'
      : continuesScholarContext ? previousContext?.mode ?? 'count' : 'count'
    const scholarContext: AssistantScholarContext = {
      kind: 'scholars',
      filterLabel,
      assignments: filtered,
      studentIds: scholarRows.map((row) => row.students.id),
      mode,
      academicYear: appliedYear ?? null,
      semester: appliedSemester ?? null,
      scholarshipStatus: requestedStatus,
      needsReview,
      categories: matchedByType.find((match) => match.type === 'category')?.names ?? [],
      scholarships: matchedByType.find((match) => match.type === 'scholarship')?.names ?? [],
      colleges: matchedByType.find((match) => match.type === 'college')?.names ?? [],
      programs: matchedByType.find((match) => match.type === 'program')?.names ?? [],
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

    if (mode === 'list') {
      const pagination = scholarRows.length > 1 ? scholarPagination(filtered, filterLabel) : undefined
      const answer = pagination
        ? `**${scholarRows.length} ${filterLabel} Scholars Found**`
        : formatScholarList(filtered, filterLabel)
      return { intent: 'scholar_list', data: scholarRows, answer, context: scholarContext, pagination }
    }
    if (mode === 'count' || q.includes('scholar')) {
      const matchedScholarships = matchedByType.find((match) => match.type === 'scholarship')?.names ?? []
      const exactScholarshipLabel = matchedScholarships.length === 1 ? matchedScholarships[0] : null
      const matchedCategories = matchedByType.find((match) => match.type === 'category')?.names ?? []
      const exactCategoryLabel = matchedCategories.length === 1 ? matchedCategories[0] : null
      const matchedColleges = matchedByType.find((match) => match.type === 'college')?.names ?? []
      const exactCollegeLabel = matchedColleges.length === 1 ? matchedColleges[0] : null
      const statusPrefix = statusLabel ? `${statusLabel} ` : ''
      const confirmsPreviousCategory = Boolean(
        exactCategoryLabel
        && previousContext?.categories.includes(exactCategoryLabel)
        && /\b(?:is|are)\s+(?:that|this|those|they)\b.*\bunder\b/i.test(normalizedCurrentQuestion),
      )
      return {
        intent: 'scholar_count',
        data: { count: matchingStudentCount, filter: filterLabel, studentIds: scholarContext.studentIds },
        answer: exactScholarshipLabel
          ? `**${exactScholarshipLabel}** currently has **${matchingStudentCount}** student${matchingStudentCount === 1 ? '' : 's'} assigned${appliedYear ? ` in A.Y. ${appliedYear}` : ''}${appliedSemester ? `, ${appliedSemester}` : ''}.`
          : exactCollegeLabel
            ? `**${exactCollegeLabel}**\n\nThere ${matchingStudentCount === 1 ? 'is' : 'are'} **${matchingStudentCount}** student${matchingStudentCount === 1 ? '' : 's'} with ${statusLabel?.toLowerCase() ?? 'matching'} scholarships under the ${exactCollegeLabel}${appliedYear ? ` in A.Y. ${appliedYear}` : ''}${appliedSemester ? `, ${appliedSemester}` : ''}.`
          : exactCategoryLabel
            ? `${confirmsPreviousCategory ? `Yes. The **${matchingStudentCount}** refers only to ${exactCategoryLabel} scholars${statusLabel ? ` with ${statusLabel} status` : ''}.` : `**${statusPrefix}${exactCategoryLabel} Scholars:** ${matchingStudentCount}\n\nThere ${matchingStudentCount === 1 ? 'is' : 'are'} **${matchingStudentCount}**${statusLabel ? ` ${statusLabel.toLowerCase()}` : ''} student${matchingStudentCount === 1 ? '' : 's'} under ${exactCategoryLabel} scholarships${appliedYear ? ` in A.Y. ${appliedYear}` : ''}${appliedSemester ? `, ${appliedSemester}` : ''}.`}`
            : appliedSemester
              ? `**${statusPrefix}${appliedSemester} Students:** ${matchingStudentCount}\n\nThere are **${matchingStudentCount}** distinct students matching ${filterLabel}.`
              : `**Total${statusLabel ? ` ${statusLabel}` : ''} Students:** ${matchingStudentCount}\n\nThere are **${matchingStudentCount}** distinct students matching ${filterLabel}.`,
        context: scholarContext,
      }
    }
  }

  if (/dashboard|overview|summary|statistics|stats/.test(q)) {
    const [{ data, error }, counts] = await Promise.all([
      supabase.from('dashboard_stats').select('*').single(),
      fetchCanonicalStudentCounts(),
    ])
    assertQuerySucceeded(error)
    const stats = data as any
    return {
      intent: 'general_stats',
      data,
      answer: [
        `**Total Students:** ${counts.activeStudents}`,
        `**Active Scholarships:** ${stats?.active_scholarships ?? 0}`,
        `**Open Duplicate Flags:** ${stats?.duplicate_flags_open ?? 0}`,
        `**Expiring Soon:** ${stats?.expiring_soon ?? 0}`,
      ].join('\n\n'),
    }
  }

  return { intent: 'conversation', data: null }
}

/* oxlint-disable no-unreachable -- legacy direct-call code is retained temporarily for rollback reference */
async function callGeminiWithFallback(prompt: string): Promise<string> {
  return retryAssistantOperation(async () => {
    const edgeResult = await supabase.functions.invoke('sigma-assistant', { body: { question: prompt } })
    if (edgeResult.error) throw new AssistantError('assistant_service_error', edgeResult.error.message)
    if (!edgeResult.data?.answer || typeof edgeResult.data.answer !== 'string') {
      throw new AssistantError('assistant_bad_response', 'SIGMAI returned an invalid response')
    }
    return edgeResult.data.answer
  }, {
    attempts: 3,
    shouldRetry: (error) => error instanceof AssistantError
      && ['assistant_service_error', 'assistant_bad_response', 'network_error'].includes(error.code),
  })

  /* Legacy direct-call fallback intentionally left unreachable until the
     Edge Function rollout has been verified in production. */
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

/* oxlint-enable no-unreachable */
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
  const result = await retryAssistantOperation(
    () => resolveIntent(question, recentHistory, previousContext),
    {
      attempts: 3,
      shouldRetry: (error) => error instanceof AssistantError && error.code === 'database_error',
    },
  )
  const nextContext = result.context ?? (isFollowUpQuestion(question) ? previousContext : null)

  // Known reports are formatted directly from database results. Gemini is
  // only used for the general dashboard summary, preventing it from changing
  // exact counts, names, filters, or dates returned by SIGMA.
  if (result.answer) return { answer: result.answer, context: nextContext, pagination: result.pagination }

  // Structured database questions must never depend on the language service.
  // Their counts and lists are resolved above from Supabase; if a future
  // parser cannot identify the requested entity, report that deterministically
  // instead of presenting an unrelated language-service failure.
  if (isStructuredDatabaseQuestion(question)) {
    return {
      answer: "I couldn't confidently match that database filter to SIGMA's live records. Try the official scholarship, college, program, category, status, academic year, or semester name.",
      context: nextContext,
    }
  }

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

  try {
    return { answer: await callGeminiWithFallback(prompt), context: nextContext }
  } catch (error) {
    if (error instanceof AssistantError && ['assistant_service_error', 'assistant_bad_response', 'network_error'].includes(error.code)) {
      return {
        answer: 'I could not identify a supported live-data query from that wording. Try asking for a student, scholarship, count, status, college, category, academic year, semester, enrollment status, or duplicate case.',
        context: nextContext,
      }
    }
    throw error
  }
}
