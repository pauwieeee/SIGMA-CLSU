import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const footer = readFileSync('src/components/layout/SiteFooter.tsx', 'utf8')
const layout = readFileSync('src/components/layout/AppLayout.tsx', 'utf8')

test('shared application layout renders the reusable institutional footer', () => {
  assert.match(layout, /import \{ SiteFooter \}/)
  assert.match(layout, /<SiteFooter \/>/)
  assert.match(layout, /flex min-h-screen flex-col/)
  assert.match(layout, /max-w-\[1600px\] flex-1/)
})

test('footer includes compact branding, contact information, and copyright', () => {
  for (const text of [
    'Office of Admissions',
    'Scholarship Management System',
    'admissions@clsu.edu.ph',
    '© 2026 Central Luzon State University',
  ]) assert.match(footer, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.equal((footer.match(/href="https:\/\/oad\.clsu\.edu\.ph\/"/g) ?? []).length, 2)
  assert.doesNotMatch(footer, /mailto:/)
  assert.doesNotMatch(footer, /tel:/)
  assert.doesNotMatch(footer, /target=/)
  assert.doesNotMatch(footer, /Quick Links/)
  assert.doesNotMatch(footer, /react-router-dom/)
  assert.match(footer, /data-sigma-footer/)
  assert.match(footer, /md:flex-row/)
  assert.doesNotMatch(footer, /background: 'var\(--bg-app\)'/)
  assert.match(footer, /border-t px-6 py-2 text-center/)
})

test('SIGMAI launcher moves above the visible footer', () => {
  const assistant = readFileSync('src/components/assistant/SigmaAssistant.tsx', 'utf8')
  assert.match(assistant, /querySelector<HTMLElement>\('\[data-sigma-footer\]'\)/)
  assert.match(assistant, /visibleFooterHeight/)
  assert.match(assistant, /bottom: footerOffset/)
})
