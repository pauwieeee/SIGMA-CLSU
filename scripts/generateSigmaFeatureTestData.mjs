import * as XLSX from 'xlsx'

const output = 'sample-data/SIGMA_Feature_Test_Data_2023_to_2026_Corrected.xlsx'
const mismatchOutput = 'sample-data/SIGMA_Name_Mismatch_Reimport_Test_Corrected.xlsx'
const years = ['2023-2024', '2024-2025', '2025-2026', '2026-2027']
const semesters = ['1st Semester', '2nd Semester']
const programs = [
  ['Bachelor of Science in Information Technology', '1st Year'],
  ['Bachelor of Science in Civil Engineering', '2nd Year'],
  ['Bachelor of Science in Agriculture', '3rd Year'],
  ['Bachelor of Science in Accountancy', '4th Year'],
  ['Bachelor of Science in Psychology', '2nd Year'],
  ['Bachelor of Science in Chemistry', '3rd Year'],
]
const scholarships = [
  ['Government', 'DOST-SEI (undergrad)'],
  ['Government', 'CHED Tertiary Education Subsidy (TES)'],
  ['Government', 'BFAR Scholarship'],
  ['Institutional', 'Academic Scholarship - College Scholarship'],
  ['Institutional', 'CLSU Tanglaw'],
  ['Private', 'UNAHCO'],
  ['Private', 'Philchema Inc'],
  ['Private', 'Bounty Cares Foundation Inc.'],
]
const firstNames = ['Althea', 'Brent', 'Clarisse', 'Darren', 'Elaine', 'Francis', 'Giselle', 'Harold', 'Iris', 'Jerome', 'Kyla', 'Lance']
const lastNames = ['Abad', 'Beltran', 'Castro', 'Dizon', 'Evangelista', 'Ferrer', 'Guevarra', 'Hilario', 'Ignacio', 'Javier', 'Katigbak', 'Lopez']
const headers = ['ID Number', 'Last Name', 'First Name', 'M.I.', 'Degree', 'Yr Lvl', 'Address', 'Contact #', 'Email', 'Acad Year', 'Semester', 'Type of Scholarship', 'Scholarship', 'Remarks']

function baseRow(index) {
  const year = years[Math.floor(index / 12)]
  const idPrefix = year.slice(2, 4)
  const idSequence = 9001 + (index % 12)
  const [degree, yearLevel] = programs[index % programs.length]
  const [category, scholarship] = scholarships[index % scholarships.length]
  const first = firstNames[index % firstNames.length]
  const last = lastNames[index % lastNames.length]
  return {
    'ID Number': `${idPrefix}-${idSequence}`,
    'Last Name': last,
    'First Name': first,
    'M.I.': `${String.fromCharCode(65 + (index % 20))}.`,
    Degree: degree,
    'Yr Lvl': yearLevel,
    Address: `Test Address ${index + 1}, Nueva Ecija`,
    'Contact #': `0917${String(5000000 + index).slice(-7)}`,
    Email: `sigma.test.${1000 + index}@example.test`,
    'Acad Year': year,
    Semester: semesters[index % 2],
    'Type of Scholarship': category,
    Scholarship: scholarship,
    Remarks: index % 9 === 0 ? 'For renewal' : index % 11 === 0 ? 'Pending verification' : index % 13 === 0 ? 'Documents incomplete' : 'Active',
  }
}

const students = Array.from({ length: 48 }, (_, index) => baseRow(index))
for (const studentIndex of [0, 12, 24, 36]) {
  students[studentIndex].Remarks = 'Active'
}
const rows = [...students]

// Same student, same term, different Active scholarship: should create a Duplicate Flag.
for (const [studentIndex, scholarshipIndex] of [[0, 1], [12, 5], [24, 6], [36, 3]]) {
  const [category, scholarship] = scholarships[scholarshipIndex]
  rows.push({ ...students[studentIndex], 'Type of Scholarship': category, Scholarship: scholarship, Remarks: 'Active' })
}

// Valid history/renewal cases: same profile, different term or academic year.
for (const studentIndex of [1, 13, 25, 37]) {
  const original = students[studentIndex]
  const yearIndex = years.indexOf(original['Acad Year'])
  rows.push({ ...original, 'Acad Year': years[Math.min(yearIndex + 1, years.length - 1)], Semester: original.Semester === '1st Semester' ? '2nd Semester' : '1st Semester', Remarks: 'Active' })
}

// Exact duplicates inside the file: preview should classify these as skipped.
for (const studentIndex of [2, 14, 26]) rows.push({ ...students[studentIndex] })

// Invalid rows: these must appear in the downloadable error report.
rows.push({ ...students[3], 'ID Number': '', Email: 'missing-id@example.test' })
rows.push({ ...students[4], 'ID Number': '25-9901', 'Acad Year': '2025/2026' })
rows.push({ ...students[5], 'ID Number': '25-9902', Degree: 'Unknown Test Program' })
rows.push({ ...students[6], 'ID Number': 'BAD-ID' })

function styleSheet(sheet, widths) {
  sheet['!autofilter'] = { ref: sheet['!ref'] }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
  sheet['!cols'] = widths.map((wch) => ({ wch }))
}

const workbook = XLSX.utils.book_new()
const importSheet = XLSX.utils.json_to_sheet(rows, { header: headers })
styleSheet(importSheet, [13, 16, 16, 7, 49, 12, 35, 17, 35, 13, 16, 22, 48, 23])
XLSX.utils.book_append_sheet(workbook, importSheet, 'STUDENT IMPORT')

const scenarios = [
  ['Feature', 'Test Data / Action', 'Expected Result'],
  ['Academic-year coverage', years.join(', '), 'Reports and SIGMAI can filter every year through the current 2026-2027 year'],
  ['Valid imports', 'First 48 rows', 'New fictional student profiles and scholarship assignments are created'],
  ['Duplicate flags', 'IDs 23-9001, 24-9001, 25-9001, 26-9001 each have two Active scholarships in one term', 'Four Duplicate Flags are created for administrator review'],
  ['Renewal/history', 'IDs 23-9002, 24-9002, 25-9002, 26-9002 have another term', 'Student profile is reused; scholarship history shows both terms'],
  ['Exact duplicates', 'Three repeated rows near the end', 'Rows are skipped and reported as duplicates'],
  ['Invalid rows', 'Final four rows', 'Rows fail independently and appear in Download Error Report'],
  ['Name mismatch', 'Import the separate SIGMA_Name_Mismatch_Reimport_Test.xlsx after this workbook', 'Student ID conflict is rejected with the existing student name'],
  ['Enrollment verification', 'Use the OFFICIAL ENROLLMENT IDS sheet for 2026-2027 • 1st Semester', 'Listed IDs match; remaining active records stay Pending Review until confirmed'],
  ['Expiration', 'Apply SCHOLARSHIP DATE PLAN using Scholarship Edit', 'Expired, Expiring Soon/this month, and Active states can be verified'],
  ['Archive/restore', 'Archive then restore any 23/24/25/26-9xxx student and scholarship history row', 'No record is deleted and timeline records both actions'],
  ['Search', 'Try 23-9001, Althea, DOST, 0917, 2025-2026, BSIT', 'Advanced search returns partial matches'],
  ['Privacy', 'All 23/24/25/26-9xxx people, emails, phones, and addresses', 'Entire workbook is fictional test data'],
]
const scenarioSheet = XLSX.utils.aoa_to_sheet(scenarios)
styleSheet(scenarioSheet, [25, 85, 85])
XLSX.utils.book_append_sheet(workbook, scenarioSheet, 'TEST SCENARIOS')

const enrollmentRows = [
  ['Official Enrolled Student IDs', 'Academic Year', 'Semester'],
  ...students.filter((row) => row['Acad Year'] === '2026-2027' && row.Semester === '1st Semester').slice(0, 4).map((row) => [row['ID Number'], row['Acad Year'], row.Semester]),
]
const enrollmentSheet = XLSX.utils.aoa_to_sheet(enrollmentRows)
styleSheet(enrollmentSheet, [30, 18, 18])
XLSX.utils.book_append_sheet(workbook, enrollmentSheet, 'OFFICIAL ENROLLMENT IDS')

const datePlan = [
  ['Scholarship', 'Set End Date', 'Expected on 2026-09-27', 'Action'],
  ['BFAR Scholarship', '2026-09-15', 'Expired', 'Scholarships → Edit → End Date → Save'],
  ['DOST-SEI (undergrad)', '2026-09-30', 'Expiring Soon / Expiring This Month', 'Scholarships → Edit → End Date → Save'],
  ['CLSU Tanglaw', '2027-03-31', 'Active', 'Scholarships → Edit → End Date → Save'],
  ['', '', '', 'Expiration is scholarship-level data and cannot be set by the Student Import format.'],
]
const dateSheet = XLSX.utils.aoa_to_sheet(datePlan)
styleSheet(dateSheet, [44, 18, 38, 78])
XLSX.utils.book_append_sheet(workbook, dateSheet, 'SCHOLARSHIP DATE PLAN')

const sigmaQuestions = [
  ['SIGMAI Test Question', 'Expected Scope'],
  ['How many active scholars for 2025-2026?', 'Distinct active students in 2025-2026'],
  ['How about 2023-2024?', 'Same active/count filters; only academic year changes'],
  ['List DOST scholars in CEN for 2026-2027.', 'DOST + College of Engineering + academic year'],
  ['Who are they?', 'Same previous filtered result, freshly queried'],
  ['Who is Student ID 23-9001?', 'Exact profile and current scholarship details'],
  ['Show scholarships expiring this month.', 'DOST-SEI after applying the date plan'],
]
const sigmaSheet = XLSX.utils.aoa_to_sheet(sigmaQuestions)
styleSheet(sigmaSheet, [58, 75])
XLSX.utils.book_append_sheet(workbook, sigmaSheet, 'SIGMAI QUESTIONS')

XLSX.writeFile(workbook, output, { compression: true })

const mismatchRow = {
  ...students[0],
  'First Name': 'Different',
  'Last Name': 'Identity',
  Scholarship: 'UNAHCO',
  'Type of Scholarship': 'Private',
}
const mismatchWorkbook = XLSX.utils.book_new()
const mismatchSheet = XLSX.utils.json_to_sheet([mismatchRow], { header: headers })
styleSheet(mismatchSheet, [13, 16, 16, 7, 49, 12, 35, 17, 35, 13, 16, 22, 48, 23])
XLSX.utils.book_append_sheet(mismatchWorkbook, mismatchSheet, 'STUDENT IMPORT')
XLSX.writeFile(mismatchWorkbook, mismatchOutput, { compression: true })

console.log(`${output}\nRows: ${rows.length}\nValid base students: 48\nDuplicate-flag assignments: 4\nHistory rows: 4\nExact duplicates: 3\nInvalid rows: 4\n\n${mismatchOutput}\nRows: 1`)
