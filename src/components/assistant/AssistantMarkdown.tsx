import { Fragment } from 'react'

// Minimal Markdown-lite renderer for SIGMA Assistant responses — deliberately
// not a full Markdown parser (no new dependency needed). It handles exactly
// the subset the assistant's system prompt is instructed to produce:
// ## headers, **bold**, | pipe | tables |, "- " bullets, "1. " numbered
// lists, and plain paragraphs. Anything outside that subset just renders as
// text, which is a safe fallback.

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} style={{ color: 'var(--nav-header-dark)' }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
  })
}

function isTableRow(line: string) {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

function isTableSeparator(line: string) {
  return /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-')
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

// "### Title" followed immediately by "Label: value" lines is treated as a
// single record — rendered as its own bordered card instead of loose text,
// so multiple records read as separate visual blocks rather than one
// continuous paragraph. A "⚠️" prefix on the title switches it to the
// warning-styled card used for duplicate/conflict records.
const RECORD_FIELD_RE = /^[A-Za-z][\w /#-]*:\s+.+/

function isRecordHeading(line: string) {
  return /^###\s+/.test(line)
}

export function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    // Table: a row followed by a "---|---" separator row
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(line)
      const bodyRows: string[][] = []
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={key++} className="my-2.5 overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-card)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--menu-active-bg)' }}>
                {headerCells.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--nav-header-dark)' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-t" style={{ borderColor: 'var(--divider-light)' }}>
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                      {ci === row.length - 1 && /^\d/.test(c) ? <strong>{c}</strong> : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Record block: "### Title" followed by "Label: value" lines
    if (isRecordHeading(line) && i + 1 < lines.length && RECORD_FIELD_RE.test(lines[i + 1])) {
      const rawTitle = line.replace(/^###\s+/, '').trim()
      const isWarning = rawTitle.startsWith('⚠️')
      const title = isWarning ? rawTitle.replace(/^⚠️\s*/, '') : rawTitle
      const fields: { label: string; value: string }[] = []
      i++
      while (i < lines.length && RECORD_FIELD_RE.test(lines[i])) {
        const idx = lines[i].indexOf(':')
        fields.push({ label: lines[i].slice(0, idx).trim(), value: lines[i].slice(idx + 1).trim() })
        i++
      }
      blocks.push(
        <div
          key={key++}
          className="my-2 rounded-lg border px-3.5 py-3"
          style={
            isWarning
              ? { background: 'var(--status-pending-bg)', borderColor: 'var(--status-pending-text)' }
              : { background: 'var(--bg-card)', borderColor: 'var(--divider-light)' }
          }
        >
          <p
            className="mb-1.5 text-sm font-bold"
            style={{ color: isWarning ? 'var(--status-pending-text)' : 'var(--nav-header-dark)' }}
          >
            {isWarning ? '⚠️ ' : ''}
            {renderInline(title, `rt${key}`)}
          </p>
          <div className="space-y-1">
            {fields.map((f, fi) => (
              <p key={fi} className="text-xs" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{f.label}: </span>
                <strong>{renderInline(f.value, `rf${key}-${fi}`)}</strong>
              </p>
            ))}
          </div>
        </div>
      )
      continue
    }

    // Heading
    if (/^#{1,3}\s+/.test(line)) {
      const content = line.replace(/^#{1,3}\s+/, '')
      blocks.push(
        <p key={key++} className="mt-2 mb-1 text-sm font-bold first:mt-0" style={{ color: 'var(--nav-header-dark)' }}>
          {renderInline(content, `h${key}`)}
        </p>
      )
      i++
      continue
    }

    // Bullet or numbered list — consume consecutive list lines together
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && (/^[-*]\s+/.test(lines[i]) || /^\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^([-*]|\d+\.)\s+/, ''))
        i++
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag key={key++} className={`my-1 space-y-1 pl-4 text-sm ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `li${key}-${ii}`)}</li>
          ))}
        </ListTag>
      )
      continue
    }

    // Warning line (starts with ⚠️)
    if (line.trim().startsWith('⚠️')) {
      blocks.push(
        <p
          key={key++}
          className="my-1 rounded-md px-2.5 py-1.5 text-sm font-medium"
          style={{ background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' }}
        >
          {renderInline(line.trim(), `w${key}`)}
        </p>
      )
      i++
      continue
    }

    // Plain paragraph
    blocks.push(
      <p key={key++} className="text-sm">
        {renderInline(line, `p${key}`)}
      </p>
    )
    i++
  }

  return <div className="space-y-0.5">{blocks}</div>
}
