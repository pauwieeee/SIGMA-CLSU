import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/sigma-high-fidelity.html', 'utf8')

test('high-fidelity prototype script is valid and major workflows are interactive', () => {
  const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'))
  assert.doesNotThrow(() => new Function(script))
  for (const id of ['loginForm', 'loadingScreen', 'notificationsView', 'activityView', 'settingsView', 'tourModal', 'logoutModal']) {
    assert.match(html, new RegExp(`id="${id}"`))
  }
  for (const feature of ['View All Notifications', 'View All Activity', 'Add New Student', 'Add Scholarship', 'Export PDF', 'SIGMAI']) {
    assert.match(html, new RegExp(feature))
  }
})

test('prototype includes complete analytics and scholarship program structures', () => {
  for (const chart of ['Scholars per Category', 'Government vs Institutional vs Private', 'Scholar Trends by Semester / A.Y.']) assert.match(html, new RegExp(chart))
  assert.ok((html.match(/class="card scholar-card"/g) ?? []).length >= 6)
  assert.match(html, /id="reportFilters"/)
  assert.match(html, /id="scholarGrid"/)
})
