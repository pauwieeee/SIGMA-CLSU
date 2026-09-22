import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase as typedSupabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'

// The generated Database type only declares Row shapes precisely; insert/upsert
// payloads here are validated manually against the schema instead.
const supabase = typedSupabase as any

// Expected columns, matching the sample sheet:
// ID Number, Last Name, First Name, M.I., Degree, Yr Lvl, Address, Contact #,
// Email, Acad Year, Semester, Type of Scholarship, Scholarship, Remarks

export interface ImportRow {
  'ID Number': string
  'Last Name': string
  'First Name': string
  'M.I.': string
  Degree: string
  'Yr Lvl': string
  Address: string
  'Contact #': string
  Email: string
  'Acad Year': string
  Semester: string
  'Type of Scholarship': string
  Scholarship: string
  Remarks: string
}

export interface ImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: { row: number; message: string }[]
}

function parseFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse<ImportRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: reject,
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json<ImportRow>(sheet))
      }
      reader.onerror = reject
      reader.readAsBinaryString(file)
    }
  })
}

const remarksToStatus: Record<string, string> = {
  Active: 'Active',
  'For renewal': 'For Renewal',
  'Documents incomplete': 'Documents Incomplete',
  'Pending verification': 'Pending Verification',
}

// Normalizes away the kind of formatting drift that shows up across
// different exports of "the same" sheet: en/em dashes vs hyphens, extra
// whitespace, case.
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[‒–—]/g, '-') // – — → -
    .replace(/\s+/g, ' ')
}

// Older exports of the sample sheet use short-form degree names ("BS
// Agriculture") while the programs table stores full official titles
// ("Bachelor of Science in Agriculture"). Builds a lookup that accepts
// either, plus each program's short `code` (e.g. "BSA"), plus a
// startsWith fallback for names that were also abbreviated at the tail
// (e.g. "...Sustainable Dev" vs "...Sustainable Development").
function buildProgramLookup(programs: { id: string; name: string; code: string | null }[]) {
  const byExact = new Map<string, string>()
  const byCode = new Map<string, string>()
  const fullNames: { normalized: string; id: string }[] = []

  const prefixExpansions: [RegExp, string][] = [
    [/^bachelor of science in /, 'bs '],
    [/^bachelor of arts in /, 'ba '],
  ]

  for (const p of programs) {
    const normalizedFull = normalize(p.name)
    byExact.set(normalizedFull, p.id)
    fullNames.push({ normalized: normalizedFull, id: p.id })

    if (p.code) byCode.set(p.code.trim().toLowerCase(), p.id)

    for (const [pattern, replacement] of prefixExpansions) {
      if (pattern.test(normalizedFull)) {
        byExact.set(normalizedFull.replace(pattern, replacement), p.id)
      }
    }
  }

  return function resolve(rawDegree: string): string | null {
    const input = normalize(String(rawDegree ?? ''))
    if (!input) return null

    const exact = byExact.get(input) ?? byCode.get(input)
    if (exact) return exact

    // Fallback: a full program name that starts with the (possibly
    // truncated) input, as long as exactly one program matches.
    const candidates = fullNames.filter((f) => f.normalized.startsWith(input))
    if (candidates.length === 1) return candidates[0].id

    return null
  }
}

export async function importStudentsFile(file: File): Promise<ImportResult> {
  const rows = await parseFile(file)
  const errors: ImportResult['errors'] = []
  let successCount = 0

  const { data: programs } = await supabase.from('programs').select('id, name, code')
  const { data: scholarships } = await supabase.from('scholarships').select('id, name')
  const programList = (programs ?? []) as { id: string; name: string; code: string | null }[]
  const scholarshipList = (scholarships ?? []) as { id: string; name: string }[]
  const resolveProgramId = buildProgramLookup(programList)
  const scholarshipByName = new Map(scholarshipList.map((s) => [normalize(s.name), s.id]))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // account for header row

    try {
      const studentNumber = String(row['ID Number'] ?? '').trim()
      if (!/^[0-9]{2}-[0-9]{4}$/.test(studentNumber)) {
        throw new Error(`Invalid student number "${studentNumber}"`)
      }

      const programId = resolveProgramId(row.Degree)
      if (!programId) throw new Error(`Unknown program "${row.Degree}"`)

      const { data: student, error: studentError } = await supabase
        .from('students')
        .upsert(
          {
            student_number: studentNumber,
            last_name: row['Last Name'],
            first_name: row['First Name'],
            middle_initial: row['M.I.'] || null,
            program_id: programId,
            yr_level: row['Yr Lvl'],
            address: row.Address || null,
            contact_number: row['Contact #'] || null,
            email: row.Email || null,
          },
          { onConflict: 'student_number' }
        )
        .select('id')
        .single()

      if (studentError || !student) throw new Error(studentError?.message ?? 'Failed to upsert student')

      const scholarshipId = scholarshipByName.get(normalize(String(row.Scholarship ?? '')))
      if (!scholarshipId) throw new Error(`Unknown scholarship "${row.Scholarship}"`)

      const remark = String(row.Remarks ?? '').trim()
      const status = remarksToStatus[remark] ?? (remark.toLowerCase().startsWith('duplicate') ? 'Active' : 'Active')

      const { error: linkError } = await supabase.from('student_scholarships').upsert(
        {
          student_id: student.id,
          scholarship_id: scholarshipId,
          academic_year: row['Acad Year'],
          semester: row.Semester,
          status,
        },
        { onConflict: 'student_id,scholarship_id,academic_year,semester' }
      )

      if (linkError) throw new Error(linkError.message)

      successCount++
    } catch (err) {
      errors.push({ row: rowNum, message: (err as Error).message })
    }
  }

  await supabase.from('import_batches').insert({
    filename: file.name,
    row_count: rows.length,
    error_count: errors.length,
    status: errors.length === rows.length ? 'Failed' : 'Completed',
    error_log: errors,
  })

  await supabase.from('notifications').insert({
    type: 'import_complete',
    title: 'Import complete',
    message: `${file.name}: ${successCount} of ${rows.length} rows imported${errors.length ? `, ${errors.length} failed` : ''}.`,
  })

  if (successCount > 0) {
    await logActivity(
      'import',
      'student',
      `Imported ${successCount} student record(s) from ${file.name}${errors.length ? ` (${errors.length} failed)` : ''}.`
    )
  }

  return { totalRows: rows.length, successCount, errorCount: errors.length, errors }
}
