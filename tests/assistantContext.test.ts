import test from 'node:test'
import assert from 'node:assert/strict'
import { explicitCollegeName, explicitScholarshipCategory, isContextualFollowUp, lastAcademicYearText, normalizeAcademicYearText, relativeAcademicYear } from '../src/utils/assistantContext.ts'
import { duplicateQueryMode, normalizeAssistantQuestion, requestedDuplicateResultLimit, scholarshipNameMatchesQuestion, stripScholarshipReferenceMetadata } from '../src/utils/assistantFuzzy.ts'
import { countDistinctStudentIds, isGenericStudentTotalQuestion, studentProfileCountScope } from '../src/utils/studentAnalyticsCore.ts'
import { effectiveStudentRecordStatus, matchesStudentRecordAssignment } from '../src/utils/studentRecordFilters.ts'

test('academic years normalize hyphen, en dash, and em dash consistently', () => {
  assert.equal(normalizeAcademicYearText('AY 2023-2024'), '2023-2024')
  assert.equal(normalizeAcademicYearText('A.Y. 2023–2024'), '2023-2024')
  assert.equal(normalizeAcademicYearText('academic year 2023—2024'), '2023-2024')
})

test('follow-up year overrides the earlier year in a conversation chain', () => {
  assert.equal(lastAcademicYearText('active scholars 2025-2026 How about 2023–2024?'), '2023-2024')
})

test('relative academic-year follow-ups derive from structured context', () => {
  assert.equal(relativeAcademicYear('What about the previous academic year?', '2025-2026'), '2024-2025')
  assert.equal(relativeAcademicYear('How about the next academic year?', '2025-2026'), '2026-2027')
  assert.equal(relativeAcademicYear('How about this year?', '2025-2026'), '2025-2026')
})

test('required conversational phrases are classified as follow-ups', () => {
  for (const question of ['How about 2023-2024?', 'And for 2024-2025?', 'How many for 2023-2024?', 'Who are they?', 'List them.', 'How many are active?']) {
    assert.equal(isContextualFollowUp(question), true, question)
  }
  assert.equal(isContextualFollowUp('How many students are in BSIT?'), false)
  assert.equal(isContextualFollowUp('How many active students?'), false)
})

test('scholarship category wording is normalized for contextual switches', () => {
  assert.equal(explicitScholarshipCategory('How about government?'), 'Government')
  assert.equal(explicitScholarshipCategory('CLSU scholarships only'), 'Institutional')
  assert.equal(explicitScholarshipCategory('private scholars'), 'Private')
  assert.equal(explicitScholarshipCategory('What about TES?'), null)
})

test('college names and required abbreviations resolve to one official college', () => {
  assert.equal(explicitCollegeName('active scholars in CASS'), 'College of Arts and Social Sciences')
  assert.equal(explicitCollegeName('active scholars in CE'), 'College of Engineering')
  assert.equal(explicitCollegeName('active scholars in COE'), 'College of Education')
  assert.equal(explicitCollegeName('active scholars in CBAA'), 'College of Business Administration and Accountancy')
  assert.equal(explicitCollegeName('active scholars in CA'), 'College of Agriculture')
  assert.equal(explicitCollegeName('active scholars in CS'), 'College of Science')
  assert.equal(explicitCollegeName('active scholars in CHS'), 'College of Home Science and Industry')
  assert.equal(explicitCollegeName('under College of Arts and Social Sciences'), 'College of Arts and Social Sciences')
})

test('assistant normalizes minor intent spelling mistakes', () => {
  assert.equal(normalizeAssistantQuestion('enroled studnts'), 'enrolled students')
  assert.equal(normalizeAssistantQuestion('dost scholrs in acadmic year'), 'dost scholars in academic year')
  assert.equal(normalizeAssistantQuestion('resolved duplicate cases'), 'resolved duplicate cases')
})

test('board-resolution references are metadata, not Student IDs or scholarship search terms', () => {
  assert.equal(
    stripScholarshipReferenceMetadata('CAT Top 20 Qualifiers (BR Res. No. 37-2002)'),
    'CAT Top 20 Qualifiers',
  )
  assert.equal(
    stripScholarshipReferenceMetadata('CAT Top 20 Qualifiers Board Resolution No. 37-2002'),
    'CAT Top 20 Qualifiers',
  )
  assert.equal(
    stripScholarshipReferenceMetadata('CAT Top 20 Qualifiers Resolution No. 37-2002'),
    'CAT Top 20 Qualifiers',
  )
})

test('scholarship names match without case, punctuation, generic suffixes, or resolution metadata', () => {
  assert.equal(scholarshipNameMatchesQuestion('students under clsu tanglaw', 'CLSU Tanglaw Scholarship'), true)
  assert.equal(scholarshipNameMatchesQuestion('students under Francine Scholarship', 'Francine Scholarship'), true)
  assert.equal(
    scholarshipNameMatchesQuestion('CAT Top 20 Qualifiers (BR Res. No. 37-2002)', 'CAT Top 20 Qualifiers'),
    true,
  )
  assert.equal(scholarshipNameMatchesQuestion('students under an unknown scholarship', 'CLSU Tanglaw Scholarship'), false)
})

test('government scholarship aliases derived from official database names are recognized', () => {
  assert.equal(scholarshipNameMatchesQuestion('students under DA ATI', 'DA-ATI'), true)
  assert.equal(scholarshipNameMatchesQuestion('students under TES', 'CHED Tertiary Education Subsidy (TES)', ['TES']), true)
  assert.equal(scholarshipNameMatchesQuestion('students under CHED TES', 'CHED Tertiary Education Subsidy (TES)', ['TES']), true)
  assert.equal(scholarshipNameMatchesQuestion('students under DOST SEI', 'DOST-SEI Undergraduate Scholarship', ['DOST-SEI']), true)
  assert.equal(scholarshipNameMatchesQuestion('students under DOST-SEI undergrad', 'DOST-SEI (undergrad)', ['DOST-SEI']), true)
  assert.equal(scholarshipNameMatchesQuestion('students under Estatiskolar', 'CHED-Estatiskolar', ['Estatiskolar']), true)
})

test('duplicate queries distinguish counts from requested student examples', () => {
  assert.equal(duplicateQueryMode('How many duplicate students?'), 'count')
  assert.equal(duplicateQueryMode('Give me 1 student who has duplicated scholar.'), 'list')
  assert.equal(duplicateQueryMode('Show one student with duplicate scholarship.'), 'list')
  assert.equal(duplicateQueryMode('Give an example of a duplicate scholar.'), 'list')
  assert.equal(duplicateQueryMode('Who has a duplicate scholarship?'), 'list')
  assert.equal(duplicateQueryMode('Show one duplicate case.'), 'list')
  assert.equal(requestedDuplicateResultLimit('Give me 3 duplicate students'), 3)
  assert.equal(requestedDuplicateResultLimit('Show one duplicate case'), 1)
  assert.equal(requestedDuplicateResultLimit('List duplicate students'), 50)
})

test('generic student totals are separated from filtered scholar and enrollment queries', () => {
  assert.equal(isGenericStudentTotalQuestion('How many students are there?'), true)
  assert.equal(isGenericStudentTotalQuestion('Total number of students'), true)
  assert.equal(isGenericStudentTotalQuestion('How many enrolled students are there?'), false)
  assert.equal(isGenericStudentTotalQuestion('How many students are in academic year 2025-2026?'), false)
  assert.equal(isGenericStudentTotalQuestion('How many DOST scholars are there?'), false)
  assert.equal(countDistinctStudentIds([{ id: 'a' }, { id: 'a' }, { id: 'b' }], (row) => row.id), 2)
})

test('active student profiles remain distinct from active scholarship assignments', () => {
  assert.equal(studentProfileCountScope('How many active students?'), 'active')
  assert.equal(studentProfileCountScope('Total active students'), 'active')
  assert.equal(studentProfileCountScope('How many students are there?'), 'all')
  assert.equal(studentProfileCountScope('How many active scholars?'), null)
  assert.equal(studentProfileCountScope('How many active students in CASS?'), null)
  assert.equal(studentProfileCountScope('How many enrolled students?'), null)
})

test('shared Student Records filters normalize effective status, category, and semester', () => {
  assert.equal(effectiveStudentRecordStatus('For Renewal', 'Expired'), 'Expired')
  assert.equal(effectiveStudentRecordStatus('For Renewal', 'Active'), 'For Renewal')
  assert.equal(matchesStudentRecordAssignment({
    category: 'Government', academicYear: '2025-2026', semester: '1st Semester',
    assignmentStatus: 'For Renewal', scholarshipStatus: 'Active',
  }, {
    category: 'Government', academicYear: '2025-2026', semester: '1st Semester', status: 'For Renewal',
  }), true)
  assert.equal(matchesStudentRecordAssignment({
    category: 'Private', semester: '2nd Semester', assignmentStatus: 'Pending Verification',
  }, { category: 'Government', semester: '1st Semester' }), false)
})
