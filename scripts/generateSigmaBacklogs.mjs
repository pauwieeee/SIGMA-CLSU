import XLSX from 'xlsx'

const templatePath = 'C:/Users/Admin/Downloads/AquaGas_-_Product_Backlog.xlsx'
const outputPath = 'sample-data/SIGMA_Product_and_Sprint_Backlogs.xlsx'

const stories = [
  ['SIG-01','Centralized Data Management','Administrative Aide & Head of Scholarship Dept','As an administrator, I want scholarship information stored in one centralized database, so that records are unified and consistently maintained.','High',8,'Sprint 1','Done','Student, scholarship, assignment, and history data use the centralized Supabase schema.','Dashboard; Student Records; Scholarships; Supabase migrations'],
  ['SIG-02','Data Migration','Administrative Aide & Head of Scholarship Dept','As an administrator, I want historical paper and spreadsheet records digitized, so that previous scholarship history remains searchable.','High',8,'Sprint 1','CSV/XLSX import accepts valid historical records; previous terms remain searchable and are not deleted.','Student Records > Import Students; scholarship history'],
  ['SIG-03','Record Retrieval','Administrative Aide','As an administrative aide, I want to retrieve records directly from the database, so that I no longer search separate spreadsheets.','High',5,'Sprint 1','Records load from the live database and can be opened from Student Records and Scholarships.','Student Records; Scholarships'],
  ['SIG-04','Individual Entry','Administrative Aide','As an administrative aide, I want to add one student manually, so that a file import is unnecessary for individual records.','High',5,'Sprint 1','Add Student validates required data and unique Student ID, saves the record, and refreshes the table.','Student Records > Add Student'],
  ['SIG-05','Duplicate Prevention','Administrative Aide & Head of Scholarship Dept','As an administrator, I want true logical duplicates detected automatically, so that data quality is protected without flagging legitimate multiple scholarships.','High',8,'Sprint 2','Duplicate identity uses Student + Scholarship + Academic Year + Semester; different scholarships are not duplicates.','Automatic database trigger; Dashboard Data Review; Reports review modal'],
  ['SIG-06','Import Safety','Administrative Aide','As an administrative aide, I want repeated imports handled safely, so that existing records are skipped and valid new records are added.','High',8,'Sprint 2','Import preview classifies new, existing, and invalid rows; existing logical records are not overwritten.','Student Records > Import Students preview'],
  ['SIG-07','Search','Administrative Aide & Head of Scholarship Dept','As an administrator, I want to search by student name or ID, so that I can find a record immediately.','High',3,'Sprint 2','Name and Student ID searches return matching database records and an accurate result count.','Student Records search'],
  ['SIG-08','Filtering','Administrative Aide & Head of Scholarship Dept','As an administrator, I want multi-field filters, so that I can narrow records by college, program, scholarship, term, and status.','Medium',5,'Sprint 2','Filters work independently and together with search without changing the underlying records.','Student Records filters; Reports & Analytics toolbar'],
  ['SIG-09','Scholarship Status','Administrative Aide & Head of Scholarship Dept','As an administrator, I want scholarship and enrollment statuses managed separately, so that Active + Not Enrolled remains valid.','High',5,'Sprint 3','Enrollment never automatically expires or deletes a scholarship; status badges clearly separate both concepts.','Student Records; Student Detail; migrations 0020-0022'],
  ['SIG-10','Expiration Monitoring','Head of Scholarship Dept','As the department head, I want expiration based on actual end dates, so that renewals are handled on time.','High',5,'Sprint 3','Expiring Soon uses the 30-day threshold; Expired uses a passed end date; historical records remain.','Dashboard; Scholarships; daily expiration function'],
  ['SIG-11','Enrollment Verification','Administrative Aide','As an administrative aide, I want to preview official enrollment reconciliation, so that bulk changes are safe and understandable.','High',8,'Sprint 3','Preview separates matches and non-matches; default changes only matches; Not Enrolled requires explicit complete-list confirmation.','Student Records > Verify Enrollment; migration 0022'],
  ['SIG-12','Notifications & Audit','Administrative Aide & Head of Scholarship Dept','As an administrator, I want notifications and an audit trail, so that important changes and responsible admins are traceable.','High',5,'Sprint 3','Activity records include actor, time, action, and affected context; notifications link to relevant review areas.','Notification bell; Recent Activity; Activity Log'],
  ['SIG-13','Cloud Deployment','Head of Scholarship Dept','As the department head, I want a cloud-hosted system, so that authorized staff can access it beyond one office computer.','High',5,'Sprint 4','Authenticated application is available over HTTPS and protected pages validate the Supabase session.','Vercel production deployment; Supabase Auth'],
  ['SIG-14','Usability & Responsive UI','Administrative Aide & Head of Scholarship Dept','As an administrator, I want a clear responsive interface, so that routine work is possible on desktop and laptop without advanced skills.','High',5,'Sprint 4','Navigation, forms, tables, dialogs, and toolbars remain understandable and responsive.','Dashboard; Student Records; Scholarships; Reports'],
  ['SIG-15','Maintainability','System Administrator','As a system administrator, I want modular and documented code, so that future developers can maintain and migrate the system.','Medium',5,'Sprint 4','Application modules, migrations, reusable components, and environment examples are organized in source control.','GitHub repository; src; supabase/migrations'],
  ['SIG-16','Reports & Analytics','Administrative Aide & Head of Scholarship Dept','As an administrator, I want filterable analytics and PDF export, so that current and historical scholarship information supports decisions.','Medium',8,'Sprint 4','Seven report filters update charts and totals; PDF export uses selected filters; historical records remain available.','Reports & Analytics'],
  ['SIG-17','SIGMAI Assistant','Administrative Aide & Head of Scholarship Dept','As an administrator, I want a data-grounded assistant, so that I can ask scholarship questions in plain language.','Medium',8,'Sprint 4','Answers use live filtered SIGMA data, identify ambiguity, and do not invent students or totals.','SIGMAI chat button and assistant panel'],
  ['SIG-18','Account Security','Administrative Aide & Head of Scholarship Dept','As an authorized administrator, I want secure account and password management, so that administrative access remains protected.','High',5,'Sprint 1','No public sign-up is offered; protected routes require a valid session; password changes verify current credentials.','Login; Account Settings; Supabase Auth'],
]

const sprintGoals = {
  'Sprint 1': 'Establish secure centralized data management, historical migration, direct retrieval, individual entry, and authenticated administration.',
  'Sprint 2': 'Protect data quality with accurate duplicate rules, safe additive imports, and fast combined search and filtering.',
  'Sprint 3': 'Separate scholarship lifecycle from enrollment, add safe verification, expiration monitoring, notifications, and auditability.',
  'Sprint 4': 'Complete deployment readiness, responsive usability, maintainability, analytics, and the data-grounded SIGMAI assistant.',
}

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)) }
function setCell(sheet, address, value, styleSource) {
  const old = sheet[address] ?? {}
  sheet[address] = { ...old, v: value, t: typeof value === 'number' ? 'n' : 's' }
  if (styleSource?.s) sheet[address].s = clone(styleSource.s)
}
function clearValues(sheet) {
  for (const key of Object.keys(sheet)) if (!key.startsWith('!')) delete sheet[key]
}
function writeRows(sheet, rows, styleRows = {}) {
  clearValues(sheet)
  rows.forEach((row, r) => row.forEach((value, c) => {
    if (value === '') return
    const sourceRow = styleRows[r] ?? styleRows.default
    const source = sourceRow ? styleRows.sheet?.[XLSX.utils.encode_cell({ r: sourceRow, c })] : undefined
    setCell(sheet, XLSX.utils.encode_cell({ r, c }), value, source)
  }))
  sheet['!ref'] = `A1:${XLSX.utils.encode_col(Math.max(...rows.map(r => r.length)) - 1)}${rows.length}`
}

const wb = XLSX.readFile(templatePath, { cellStyles: true })
const templateProduct = wb.Sheets['Product Backlog']
const productStyles = clone(templateProduct)
const productRows = [
  ['SIGMA PRODUCT BACKLOG'],
  ['Central Luzon State University - Scholarship Information and Grants Management Analytics'],
  [],
  ['ID','Epic','Role','User Story','Priority','Story Points','Target Sprint','Current Status','Acceptance Criteria','Current Website Evidence'],
  ...stories,
]
writeRows(templateProduct, productRows, { sheet: productStyles, 0: 0, 1: 1, 3: 3, default: 4 })
templateProduct['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:9} }, { s:{r:1,c:0}, e:{r:1,c:9} }]
templateProduct['!cols'] = productStyles['!cols']
templateProduct['!autofilter'] = { ref: `A4:J${productRows.length}` }
templateProduct['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft', state: 'frozen' }

for (let sprintNo = 1; sprintNo <= 4; sprintNo++) {
  const name = `Sprint ${sprintNo}`
  const sheetName = `${name} Backlog`
  const sheet = wb.Sheets[sheetName]
  const styles = clone(sheet)
  const selected = stories.filter(row => row[6] === name)
  const points = selected.reduce((sum, row) => sum + row[5], 0)
  const rows = [
    [`SIGMA ${name.toUpperCase()} BACKLOG`],
    [`Sprint goal: ${sprintGoals[name]}`],
    [],
    ['Sprint',name,'','Metric','Value'],
    ['Status','Completed','','Committed items',selected.length],
    ['Capacity (points)',points + 8,'','Done points',points],
    ['Committed Points',points,'','Completion','100%'],
    [],[],
    ['ID','Type','User Story Title','Story Points','Priority','Owner / Workstream','Status','Definition of Done'],
    ...selected.map(row => [row[0],'User Story',row[3].replace(/^As an? [^,]+, I want /,'').replace(/, so that.*$/,''),row[5],row[4],row[1],'Done',row[8]]),
    [],[],
    ['IMPLEMENTATION TASKS'],
    ['Task ID','Related Story','Task','Estimated Hours','Notes','Owner / Workstream','Status','Acceptance / Test Result'],
    ...selected.map((row, index) => [`T-${String(index + 1).padStart(2,'0')}`,row[0],`Implement and verify: ${row[2]} - ${row[1]}`,Math.max(4,row[5] * 2),'',row[1],'Done',row[9]]),
  ]
  writeRows(sheet, rows, { sheet: styles, 0: 0, 1: 1, 3: 3, 9: 10, default: 11 })
  const taskHeader = 14 + selected.length
  sheet['!merges'] = [{s:{r:0,c:0},e:{r:0,c:7}}, {s:{r:1,c:0},e:{r:1,c:7}}, {s:{r:taskHeader - 1,c:0},e:{r:taskHeader - 1,c:7}}]
  sheet['!cols'] = styles['!cols']
  sheet['!freeze'] = { xSplit: 0, ySplit: 10, topLeftCell: 'A11', activePane: 'bottomLeft', state: 'frozen' }
}

for (const obsolete of ['Sprint 5 Backlog','Sprint 6 Backlog']) {
  delete wb.Sheets[obsolete]
  wb.SheetNames = wb.SheetNames.filter(name => name !== obsolete)
}

const totalPoints = stories.reduce((sum, row) => sum + row[5], 0)
const summary = wb.Sheets.Summary
const summaryStyles = clone(summary)
const summaryRows = [
  ['SIGMA BACKLOG SUMMARY'],[],
  ['KPI','Value','','Sprint','Items','Story Points'],
  ['Total backlog items',stories.length,'','Sprint 1',stories.filter(r=>r[6]==='Sprint 1').length,stories.filter(r=>r[6]==='Sprint 1').reduce((s,r)=>s+r[5],0)],
  ['Total story points',totalPoints,'','Sprint 2',stories.filter(r=>r[6]==='Sprint 2').length,stories.filter(r=>r[6]==='Sprint 2').reduce((s,r)=>s+r[5],0)],
  ['Implemented items',stories.length,'','Sprint 3',stories.filter(r=>r[6]==='Sprint 3').length,stories.filter(r=>r[6]==='Sprint 3').reduce((s,r)=>s+r[5],0)],
  ['In progress items',0,'','Sprint 4',stories.filter(r=>r[6]==='Sprint 4').length,stories.filter(r=>r[6]==='Sprint 4').reduce((s,r)=>s+r[5],0)],
  ['Not started items',0],[],[],
  ['Scope Notes'],
  ['- Backlog content is based on SIGMA requirements, implemented modules, database migrations, and the professor-verification navigation guide.'],
  ['- Sprint dates and individual assignees should be filled in by the team if required by the instructor.'],
  ['- Statuses describe the current implemented application as of September 2026.'],
  ['- Product and sprint estimates are planning values and may be adjusted during team review.'],
]
writeRows(summary, summaryRows, { sheet: summaryStyles, 0: 0, 2: 2, default: 3 })
summary['!merges'] = [{s:{r:0,c:0},e:{r:0,c:7}}, ...[10,11,12,13,14].map(r=>({s:{r,c:0},e:{r,c:7}}))]
summary['!cols'] = summaryStyles['!cols']

const coverage = wb.Sheets['Website Coverage']
const coverageStyles = clone(coverage)
const coverageRows = [
  ['SIGMA WEBSITE COVERAGE & TRACEABILITY'],[],
  ['Area','Representative Page / Component','Covered Stories','Verification Note'],
  ['Authentication','Login, Account Settings, AuthProvider','SIG-13, SIG-18','Admin-only authentication, protected routes, persistent session, password recovery and secure password change.'],
  ['Student management','Student Records, Add Student, Import Students','SIG-01, SIG-02, SIG-03, SIG-04, SIG-06','Individual and bulk workflows use the same centralized student and scholarship-assignment schema.'],
  ['Search and filtering','Student Records search and filter toolbar','SIG-07, SIG-08','Search and filters combine while preserving accurate result counts.'],
  ['Duplicate review','Database trigger, Dashboard Data Review, Reports modal','SIG-05','Logical duplicate identity includes student, scholarship, academic year, and semester.'],
  ['Enrollment','Verify Enrollment modal and RPC','SIG-09, SIG-11','Read-only preview and explicit reconciliation confirmation keep enrollment separate from scholarship status.'],
  ['Scholarship lifecycle','Scholarships, expiration trigger and scheduled refresh','SIG-09, SIG-10','Actual end dates determine Expiring Soon and Expired without deleting history.'],
  ['Audit and notifications','Notification bell, Recent Activity, Activity Log','SIG-12','Administrative actions retain actor and timestamp context.'],
  ['Analytics','Dashboard and Reports & Analytics','SIG-16','Database-driven totals, filters, charts, historical comparison, and PDF export.'],
  ['AI assistance','SIGMAI assistant','SIG-17','Plain-language questions use live SIGMA data and explicit filters.'],
  ['Deployment and maintenance','Vercel, Supabase, GitHub repository','SIG-13, SIG-15','Cloud deployment and versioned migrations support continued operation and maintenance.'],
  ['Responsive experience','Shared responsive components and horizontal table/toolbars','SIG-14','Primary workflows support desktop and laptop, with safe narrow-screen overflow or stacking.'],
]
writeRows(coverage, coverageRows, { sheet: coverageStyles, 0: 0, 2: 2, default: 3 })
coverage['!merges'] = [{s:{r:0,c:0},e:{r:0,c:3}}]
coverage['!cols'] = coverageStyles['!cols']
coverage['!autofilter'] = { ref: `A3:D${coverageRows.length}` }

XLSX.writeFile(wb, outputPath, { cellStyles: true, compression: true })
console.log(`Created ${outputPath}`)
