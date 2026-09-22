import type { StudentRecordRow } from '@/hooks/useStudentRecords'

export async function exportStudentRecordsPdf(rows: StudentRecordRow[]) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default
  const doc = new jsPDF({ orientation: 'landscape' })
  const marginX = 14

  doc.setFontSize(16)
  doc.setTextColor(11, 46, 19)
  doc.text('SIGMA Student Records', marginX, 18)

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Selected records: ${rows.length}`, marginX, 26)
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, 31)

  autoTable(doc, {
    startY: 38,
    head: [['Student Number', 'Name', 'College', 'Program', 'Scholarship', 'Academic Year', 'Semester', 'Status']],
    body: rows.map((row) => [
      row.student_number,
      row.full_name,
      row.college,
      row.program,
      row.scholarship ?? '—',
      row.academic_year ?? '—',
      row.semester ?? '—',
      row.hasDuplicate ? 'Duplicate' : row.status ?? 'Closed',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [59, 110, 51] },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: marginX, right: marginX },
  })

  doc.save('sigma-student-records.pdf')
}
