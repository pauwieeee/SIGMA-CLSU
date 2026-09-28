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

test('footer includes branding, navigation, contact information, and copyright', () => {
  for (const text of [
    'Office of Admissions',
    'Scholarship Management System',
    'Dashboard',
    'Student Records',
    'Scholarships',
    'Reports & Analytics',
    'admissions@clsu.edu.ph',
    '© 2026 Central Luzon State University',
  ]) assert.match(footer, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.match(footer, /mailto:admissions@clsu\.edu\.ph/)
  assert.match(footer, /tel:\+63444560688/)
  assert.match(footer, /md:grid-cols-2/)
  assert.match(footer, /lg:grid-cols-/)
})
