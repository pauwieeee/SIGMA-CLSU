// PDF export for Reports & Analytics. Dynamically imported so jspdf /
// jspdf-autotable (a sizeable chunk) never load until the admin actually
// clicks "Export as PDF" — keeps them out of the initial page bundle.

interface Filters {
  academicYear: string
  semester: string
  college: string
  category: string
}

interface CategoryDatum {
  category_name: string
  scholar_count: number
}

interface TrendDatum {
  term: string
  scholar_count: number
}

export interface ReportPdfInput {
  filters: Filters
  categoryData: CategoryDatum[]
  trendData: TrendDatum[]
  duplicateFlagCount: number
}

export async function exportReportPdf(input: ReportPdfInput) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default

  const doc = new jsPDF()
  const marginX = 14
  let y = 18

  doc.setFontSize(16)
  doc.setTextColor(11, 46, 19) // --nav-header-dark
  doc.text('SIGMA Reports & Analytics', marginX, y)
  y += 8

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  const filterLine = [
    `A.Y.: ${input.filters.academicYear || 'All'}`,
    `Semester: ${input.filters.semester || 'All'}`,
    `College: ${input.filters.college || 'All Colleges'}`,
    `Category: ${input.filters.category || 'All Categories'}`,
  ].join('   |   ')
  doc.text(filterLine, marginX, y)
  y += 4
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y)
  y += 10

  doc.setFontSize(12)
  doc.setTextColor(11, 46, 19)
  doc.text('Scholars per Category', marginX, y)
  y += 4
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Scholar Count']],
    body: input.categoryData.map((c) => [c.category_name, String(c.scholar_count)]),
    theme: 'grid',
    headStyles: { fillColor: [59, 110, 51] },
    margin: { left: marginX },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  const total = input.categoryData.reduce((s, c) => s + c.scholar_count, 0)
  doc.setFontSize(12)
  doc.setTextColor(11, 46, 19)
  doc.text("Institutional vs Gov't vs Private", marginX, y)
  y += 4
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Count', 'Share']],
    body: input.categoryData.map((c) => [
      c.category_name,
      String(c.scholar_count),
      total > 0 ? `${Math.round((c.scholar_count / total) * 100)}%` : '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [59, 110, 51] },
    margin: { left: marginX },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  if (y > 250) {
    doc.addPage()
    y = 18
  }

  doc.setFontSize(12)
  doc.setTextColor(11, 46, 19)
  doc.text('Scholars Trend by Semester / A.Y.', marginX, y)
  y += 4
  autoTable(doc, {
    startY: y,
    head: [['Term', 'Scholar Count']],
    body: input.trendData.map((t) => [t.term, String(t.scholar_count)]),
    theme: 'grid',
    headStyles: { fillColor: [59, 110, 51] },
    margin: { left: marginX },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(12)
  doc.setTextColor(11, 46, 19)
  doc.text(`Duplicate-Flag Count: ${input.duplicateFlagCount}`, marginX, y)

  doc.save('sigma-report.pdf')
}
