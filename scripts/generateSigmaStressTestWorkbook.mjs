import * as XLSX from 'xlsx'

const output = 'sample-data/SIGMA_Comprehensive_Stress_Test_200.xlsx'
const years = ['2022-2023', '2023-2024', '2024-2025', '2025-2026']
const semesters = ['1st Semester', '2nd Semester']
const programs = [
  ['College of Agriculture', 'Bachelor of Science in Agriculture'],
  ['College of Fisheries', 'Bachelor of Science in Fisheries'],
  ['College of Home Science and Industry', 'Bachelor of Science in Food Technology'],
  ['College of Home Science and Industry', 'Bachelor of Science in Hospitality Management'],
  ['College of Arts and Social Sciences', 'Bachelor of Arts in Literature'],
  ['College of Arts and Social Sciences', 'Bachelor of Science in Psychology'],
  ['College of Business Administration and Accountancy', 'Bachelor of Science in Accountancy'],
  ['College of Business Administration and Accountancy', 'Bachelor of Science in Entrepreneurship'],
  ['College of Education', 'Bachelor of Physical Education'],
  ['College of Education', 'Bachelor of Elementary Education'],
  ['College of Engineering', 'Bachelor of Science in Civil Engineering'],
  ['College of Engineering', 'Bachelor of Science in Information Technology'],
  ['College of Science', 'Bachelor of Science in Chemistry'],
  ['College of Science', 'Bachelor of Science in Statistics'],
  ['College of Veterinary Science and Medicine', 'Doctor of Veterinary Medicine'],
]
const scholarships = {
  Government: ['BFAR Scholarship', 'DA-ATI', 'CHED Tertiary Education Subsidy (TES)', 'DOST-SEI (undergrad)'],
  Institutional: ['Academic Scholarship - College Scholarship', 'CLSU Supreme Student Council', 'CLSU Tanglaw', 'Full Scholarship - Varsity'],
  Private: ['Bounty Cares Foundation Inc.', 'GOKONGWEI BROTHERS', 'Philchema Inc', 'Vicente B Bello Scholarship'],
}
const categories = ['Government', 'Institutional', 'Private']
const statuses = ['Active', 'Active', 'Active', 'For renewal', 'Pending verification', 'Documents incomplete']
const lastNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Bautista', 'Navarro', 'Aquino', 'Castillo', 'Ramos', 'Flores', 'Rivera', 'Torres', 'Villanueva', 'Domingo', 'Pascual', 'Soriano', 'Valdez', 'Mercado', 'Aguilar']
const firstNames = ['Maria', 'Jose', 'Angela', 'Miguel', 'Andrea', 'Paolo', 'Camille', 'Rafael', 'Bianca', 'Carlo', 'Jasmine', 'Nathan', 'Sofia', 'Gabriel', 'Leah', 'Marco']
const municipalities = ['Science City of Munoz', 'Talavera', 'Guimba', 'San Jose City', 'Cabanatuan City', 'Zaragoza', 'Lupao', 'Licab']
const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduate']

const students = Array.from({ length: 160 }, (_, index) => {
  const yearIndex = index % years.length
  const idPrefix = 22 + yearIndex
  const last = lastNames[index % lastNames.length]
  const first = firstNames[Math.floor(index / lastNames.length) % firstNames.length]
  const middle = String.fromCharCode(65 + (index % 20))
  const [college, degree] = programs[index % programs.length]
  const category = categories[index % categories.length]
  const scholarshipList = scholarships[category]
  const scholarship = scholarshipList[Math.floor(index / categories.length) % scholarshipList.length]
  const academicYear = years[yearIndex]
  const semester = semesters[Math.floor(index / years.length) % 2]
  return {
    'ID Number': `${idPrefix}-${String(1000 + index).slice(-4)}`,
    'Last Name': last,
    'First Name': first,
    'M.I.': middle,
    Degree: degree,
    College: college,
    'Yr Lvl': degree === 'Doctor of Veterinary Medicine' ? (index % 2 ? '5th Year' : 'Graduate') : yearLevels[index % 5],
    Address: `${municipalities[index % municipalities.length]}, Nueva Ecija`,
    'Contact #': `09${String(170000000 + index).slice(-9)}`,
    Email: `${first.toLowerCase()}.${last.toLowerCase()}.${1000 + index}@clsu2.edu.ph`,
    'Acad Year': academicYear,
    Semester: semester,
    'Type of Scholarship': category,
    Scholarship: scholarship,
    Remarks: index < 10 ? 'Active' : statuses[index % statuses.length],
  }
})

const rows = [...students]

// Legitimate history: same permanent student, a different term, no duplicate profile.
for (let index = 0; index < 30; index += 1) {
  const base = students[index]
  const termIndex = years.indexOf(base['Acad Year']) * 2 + semesters.indexOf(base.Semester)
  const nextTerm = (termIndex + 1) % 8
  rows.push({
    ...base,
    'Acad Year': years[Math.floor(nextTerm / 2)],
    Semester: semesters[nextTerm % 2],
    Remarks: index % 3 === 0 ? 'For renewal' : 'Active',
  })
}

// Intentional exact duplicates: the import preview should skip these safely.
for (let index = 0; index < 10; index += 1) {
  const base = students[index]
  rows.push({
    ...base,
    Remarks: 'Duplicate test row — should be skipped',
  })
}

const workbook = XLSX.utils.book_new()
const dataSheet = XLSX.utils.json_to_sheet(rows, { header: [
  'ID Number', 'Last Name', 'First Name', 'M.I.', 'Degree', 'College', 'Yr Lvl', 'Address',
  'Contact #', 'Email', 'Acad Year', 'Semester', 'Type of Scholarship', 'Scholarship', 'Remarks',
] })
dataSheet['!autofilter'] = { ref: `A1:O${rows.length + 1}` }
dataSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
dataSheet['!cols'] = [12, 16, 16, 7, 48, 43, 12, 34, 16, 36, 13, 15, 22, 48, 22].map((wch) => ({ wch }))
XLSX.utils.book_append_sheet(workbook, dataSheet, 'STUDENT IMPORT')

const scenarios = [
  ['Test Feature', 'Rows / Instructions', 'Expected Result'],
  ['Import volume', 'All 200 rows', '160 student profiles; 190 unique assignments; 10 exact duplicates skipped'],
  ['Historical semesters', 'Last 30 rows before conflicts', 'Same Student ID receives another term without a duplicate profile'],
  ['Duplicate prevention', 'Final 10 rows', 'Exact student + scholarship + academic year + semester duplicates are skipped'],
  ['Academic year filter', years.join(', '), 'Each year returns a different subset'],
  ['Semester filter', semesters.join(', '), 'Both semesters contain data'],
  ['Category analytics', categories.join(', '), 'All three categories have balanced records'],
  ['Status filters', statuses.join(', '), 'Active, renewal, pending, and incomplete subsets are available'],
  ['Enrollment verification', 'Use Verify Enrollment after import for a selected term', 'Mark listed IDs Enrolled and unlisted IDs Not Enrolled'],
  ['Expiration', 'Apply dates from SCHOLARSHIP DATE PLAN in Scholarship edit forms', 'Dashboard and status badges follow actual end_date'],
  ['Search', 'Search Santos, Maria, an ID, BSIT, or a scholarship', 'Matching records are returned'],
  ['Privacy', 'Every person and contact value is fictional', 'No real personal data is used'],
]
const scenarioSheet = XLSX.utils.aoa_to_sheet(scenarios)
scenarioSheet['!autofilter'] = { ref: `A1:C${scenarios.length}` }
scenarioSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
scenarioSheet['!cols'] = [{ wch: 25 }, { wch: 75 }, { wch: 70 }]
XLSX.utils.book_append_sheet(workbook, scenarioSheet, 'TEST SCENARIOS')

const datePlan = [
  ['Scholarship', 'Test End Date', 'Expected Status on 2026-09-23', 'How to Apply'],
  ['BFAR Scholarship', '2026-09-15', 'Expired', 'Scholarships > Government > Edit > End Date'],
  ['DOST-SEI (undergrad)', '2026-10-10', 'Expiring Soon', 'Scholarships > Government > Edit > End Date'],
  ['CLSU Tanglaw', '2027-03-15', 'Active', 'Scholarships > Institutional > Edit > End Date'],
  ['Bounty Cares Foundation Inc.', '', 'Active / no expiration', 'Leave End Date empty'],
  ['', '', '', 'Expiration dates are scholarship-level data and are intentionally not overwritten by Student Import.'],
]
const dateSheet = XLSX.utils.aoa_to_sheet(datePlan)
dateSheet['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 32 }, { wch: 75 }]
XLSX.utils.book_append_sheet(workbook, dateSheet, 'SCHOLARSHIP DATE PLAN')

XLSX.writeFile(workbook, output, { compression: true })
console.log(`${output}\nRows: ${rows.length}\nStudents: ${students.length}\nHistory rows: 30\nExact duplicate test rows: 10`)
