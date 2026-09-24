import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase as typedSupabase } from '@/lib/supabase'
import { logActivity } from '@/utils/logActivity'
const supabase = typedSupabase as any

export interface ImportRow { 'ID Number': string; 'Last Name': string; 'First Name': string; 'M.I.': string; Degree: string; 'Yr Lvl': string; Address: string; 'Contact #': string; Email: string; 'Acad Year': string; Semester: string; 'Type of Scholarship': string; Scholarship: string; Remarks: string }
export type ImportClassification = 'new' | 'existing' | 'conflict' | 'invalid'
export interface ImportPreviewItem { row: number; classification: ImportClassification; message: string; studentNumber: string; studentName: string; academicYear: string; semester: string; scholarship: string; importedData: ImportRow; payload?: Record<string, string | null> }
export interface ImportPreview { filename: string; totalRows: number; beforeStudentCount: number; newRecords: ImportPreviewItem[]; existingRecords: ImportPreviewItem[]; conflicts: ImportPreviewItem[]; invalidRecords: ImportPreviewItem[] }
export type ImportRowStatus = 'Success' | 'Failed' | 'Skipped'
export interface ImportRowResult { row: number; studentNumber: string; studentName: string; status: ImportRowStatus; errorType: string | null; message: string; suggestedCorrection: string; importedData: ImportRow }
export interface ImportResult { filename: string; totalRows: number; addedCount: number; existingCount: number; conflictCount: number; invalidCount: number; beforeStudentCount: number; afterStudentCount: number; status: 'Completed' | 'Completed with Errors' | 'Failed'; rows: ImportRowResult[]; errors: { row: number; message: string }[] }

const REQUIRED = ['ID Number','Last Name','First Name','Degree','Yr Lvl','Acad Year','Semester','Scholarship']
const YEARS = new Set(['1st Year','2nd Year','3rd Year','4th Year','5th Year','Graduate'])
const SEMESTERS = new Set(['1st Semester','2nd Semester','Summer'])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STATUSES: Record<string,string> = { active:'Active','for renewal':'For Renewal',renewal:'For Renewal','documents incomplete':'Documents Incomplete',incomplete:'Documents Incomplete','pending verification':'Pending Verification',pending:'Pending Verification',inactive:'Inactive' }
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ')
const keyOf = (student: unknown, scholarship: unknown, year: unknown, semester: unknown) => [student,scholarship,year,semester].map(norm).join('|')

async function parse(file: File) {
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('Select a CSV, XLSX, or XLS file.')
  if (/\.csv$/i.test(file.name)) return new Promise<{rows:ImportRow[];headers:string[]}>((resolve,reject) => Papa.parse<ImportRow>(file,{ header:true,skipEmptyLines:true,complete:r=>resolve({rows:r.data,headers:r.meta.fields??[]}),error:reject }))
  const workbook = XLSX.read(await file.arrayBuffer()); const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:''})
  return { headers:(matrix[0]??[]).map(String), rows:XLSX.utils.sheet_to_json<ImportRow>(sheet,{defval:''}) }
}

export async function previewStudentsFile(file: File): Promise<ImportPreview> {
  const { rows, headers } = await parse(file); const missing = REQUIRED.filter(h=>!headers.includes(h))
  if (missing.length) throw new Error(`Missing required header${missing.length>1?'s':''}: ${missing.join(', ')}`)
  const [programResult, scholarshipResult, studentResult, assignmentResult, countResult] = await Promise.all([
    supabase.from('programs').select('id,name,code'), supabase.from('scholarships').select('id,name,scholarship_categories(name)').is('archived_at',null),
    supabase.from('students').select('id,student_number,first_name,last_name'), supabase.from('student_scholarships').select('student_id,scholarship_id,academic_year,semester'),
    supabase.from('students').select('*',{count:'exact',head:true}).is('archived_at',null),
  ])
  for (const result of [programResult,scholarshipResult,studentResult,assignmentResult]) if (result.error) throw new Error(result.error.message)
  const programs = programResult.data??[], scholarships = scholarshipResult.data??[], students = studentResult.data??[], assignments = assignmentResult.data??[]
  const programMap=new Map<string,any>(), scholarshipMap=new Map<string,any>(), studentMap=new Map<string,any>(), studentNumberById=new Map<string,string>(), scholarshipById=new Map<string,string>()
  for(const p of programs){programMap.set(norm(p.name),p);if(p.code)programMap.set(norm(p.code),p)}
  for(const s of scholarships){scholarshipMap.set(norm(s.name),s);scholarshipById.set(s.id,s.name)}
  for(const s of students){studentMap.set(norm(s.student_number),s);studentNumberById.set(s.id,s.student_number)}
  const existing=new Set(assignments.map((a:any)=>keyOf(studentNumberById.get(a.student_id),scholarshipById.get(a.scholarship_id),a.academic_year,a.semester)))
  const seen=new Set<string>()
  const out:ImportPreview={filename:file.name,totalRows:rows.length,beforeStudentCount:countResult.count??0,newRecords:[],existingRecords:[],conflicts:[],invalidRecords:[]}
  rows.forEach((row,index)=>{
    const n=index+2, studentNumber=String(row['ID Number']??'').trim(), scholarshipName=String(row.Scholarship??'').trim(), year=String(row['Acad Year']??'').replace(/\s/g,''), semester=String(row.Semester??'').trim()
    const base={row:n,studentNumber,studentName:`${row['First Name']??''} ${row['Last Name']??''}`.trim(),academicYear:year,semester,scholarship:scholarshipName,importedData:row}
    const invalid=(message:string)=>out.invalidRecords.push({...base,classification:'invalid',message}); const program=programMap.get(norm(row.Degree)), scholarship=scholarshipMap.get(norm(scholarshipName))
    if(!studentNumber)return invalid('Student ID is missing.'); if(!/^\d{2}-\d{4}$/.test(studentNumber))return invalid(`Invalid Student ID "${studentNumber}"; expected 00-0000.`)
    if(!String(row['First Name']??'').trim()||!String(row['Last Name']??'').trim())return invalid('First Name and Last Name are required.'); if(!program)return invalid(`Unknown program "${row.Degree??''}".`)
    if(!YEARS.has(String(row['Yr Lvl']??'').trim()))return invalid(`Invalid year level "${row['Yr Lvl']??''}".`); if(!/^20\d{2}-20\d{2}$/.test(year))return invalid('Academic Year format must be YYYY-YYYY.')
    if(!SEMESTERS.has(semester))return invalid(`Invalid semester "${semester}".`); if(!scholarship)return invalid(`Unknown scholarship "${scholarshipName}".`); if(String(row.Email??'').trim()&&!EMAIL.test(String(row.Email).trim()))return invalid(`Invalid email "${row.Email}".`)
    const key=keyOf(studentNumber,scholarshipName,year,semester); if(seen.has(key))return out.existingRecords.push({...base,classification:'existing',message:'Duplicate within uploaded file.'}); seen.add(key)
    if(existing.has(key))return out.existingRecords.push({...base,classification:'existing',message:'Duplicate — already exists.'})
    const old=studentMap.get(norm(studentNumber)); if(old&&(norm(old.first_name)!==norm(row['First Name'])||norm(old.last_name)!==norm(row['Last Name'])))return invalid('Student ID exists with a different name; existing profile was not overwritten.')
    const payload={student_number:studentNumber,last_name:String(row['Last Name']).trim(),first_name:String(row['First Name']).trim(),middle_initial:String(row['M.I.']??'').trim()||null,program_id:program.id,yr_level:String(row['Yr Lvl']).trim(),address:String(row.Address??'').trim()||null,contact_number:String(row['Contact #']??'').trim()||null,email:String(row.Email??'').trim()||null,scholarship_id:scholarship.id,academic_year:year,semester,status:STATUSES[norm(row.Remarks)]??'Active'}
    const item={...base,payload,classification:'new' as const,message:'Ready to add.'}
    out.newRecords.push(item)
  }); return out
}

export async function commitStudentsImport(preview: ImportPreview): Promise<ImportResult> {
  const candidates=[...preview.newRecords,...preview.conflicts]
  const rpcRows=candidates.map(item=>({...item.payload,source_row:String(item.row)}))
  const {data,error}=await supabase.rpc('import_student_records_with_results',{p_rows:rpcRows}); if(error)throw new Error(error.message)
  const candidateByRow=new Map(candidates.map(item=>[item.row,item]))
  const databaseRows:ImportRowResult[]=(data??[]).map((result:any)=>{
    const item=candidateByRow.get(Number(result.source_row))!
    const status=result.result_status as ImportRowStatus
    return {row:item.row,studentNumber:item.studentNumber,studentName:item.studentName,status,errorType:result.error_type??null,message:result.result_message,suggestedCorrection:suggestionFor(result.result_message),importedData:item.importedData}
  })
  const skippedRows:ImportRowResult[]=preview.existingRecords.map(item=>({row:item.row,studentNumber:item.studentNumber,studentName:item.studentName,status:'Skipped',errorType:'Duplicate Record',message:item.message,suggestedCorrection:'No action is needed unless this row should use a different scholarship term.',importedData:item.importedData}))
  const invalidRows:ImportRowResult[]=preview.invalidRecords.map(item=>({row:item.row,studentNumber:item.studentNumber,studentName:item.studentName,status:'Failed',errorType:errorTypeFor(item.message),message:item.message,suggestedCorrection:suggestionFor(item.message),importedData:item.importedData}))
  const rows=[...databaseRows,...skippedRows,...invalidRows].sort((a,b)=>a.row-b.row)
  const added=rows.filter(row=>row.status==='Success').length, skipped=rows.filter(row=>row.status==='Skipped').length, failed=rows.filter(row=>row.status==='Failed').length
  const after=(await supabase.from('students').select('*',{count:'exact',head:true}).is('archived_at',null)).count??preview.beforeStudentCount
  const importStatus=failed>0?'Completed with Errors':'Completed'
  const failedDetails=rows.filter(row=>row.status==='Failed')
  await supabase.from('import_batches').insert({filename:preview.filename,row_count:preview.totalRows,error_count:failed,successful_rows:added,failed_rows:failed,skipped_rows:skipped,status:importStatus,error_log:failedDetails})
  await supabase.from('notifications').insert({type:'import_complete',title:'Import complete',message:`${preview.filename}: ${added} succeeded, ${failed} failed, ${skipped} skipped.`})
  await logActivity('import','student',`Imported ${preview.filename}: ${preview.totalRows} rows; ${added} succeeded, ${failed} failed, ${skipped} skipped.`)
  return {filename:preview.filename,totalRows:preview.totalRows,addedCount:added,existingCount:skipped,conflictCount:preview.conflicts.length,invalidCount:failed,beforeStudentCount:preview.beforeStudentCount,afterStudentCount:after,status:importStatus,rows,errors:failedDetails.map(item=>({row:item.row,message:item.message}))}
}

function errorTypeFor(message:string){const value=message.toLowerCase();if(value.includes('missing')||value.includes('required'))return'Missing Required Field';if(value.includes('duplicate')||value.includes('already exists'))return'Duplicate Record';if(value.includes('email')||value.includes('format'))return'Invalid Format';if(value.includes('unknown')||value.includes('invalid'))return'Invalid Value';return'Validation Error'}
function suggestionFor(message:string){const value=message.toLowerCase();if(value.includes('student id'))return'Use a unique Student ID in the format 00-0000.';if(value.includes('program'))return'Use an existing program name or code from SIGMA.';if(value.includes('year level'))return'Use 1st Year, 2nd Year, 3rd Year, 4th Year, 5th Year, or Graduate.';if(value.includes('academic year'))return'Use a consecutive academic year in YYYY-YYYY format.';if(value.includes('semester'))return'Use 1st Semester, 2nd Semester, or Summer.';if(value.includes('scholarship'))return'Use the exact name of an active scholarship program.';if(value.includes('email'))return'Enter a valid email address or leave the optional field blank.';return'Review the imported values and correct the field described in the error message.'}
