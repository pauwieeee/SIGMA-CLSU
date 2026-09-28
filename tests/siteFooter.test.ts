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

  assert.match(footer, /mailto:admissions@clsu\.edu\.ph/)
  assert.match(footer, /tel:\+63444560688/)
  assert.doesNotMatch(footer, /Quick Links/)
  assert.doesNotMatch(footer, /react-router-dom/)
  assert.match(footer, /data-sigma-footer/)
  assert.match(footer, /md:flex-row/)
})

test('SIGMAI launcher moves above the visible footer', () => {
  const assistant = readFileSync('src/components/assistant/SigmaAssistant.tsx', 'utf8')
  assert.match(assistant, /querySelector<HTMLElement>\('\[data-sigma-footer\]'\)/)
  assert.match(assistant, /visibleFooterHeight/)
  assert.match(assistant, /bottom: footerOffset/)
})
