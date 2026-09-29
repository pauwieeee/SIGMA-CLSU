import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const combinedPrototypePath = 'prototypes/sigma-high-fidelity.html'
const deployedPrototypePath = 'public/sigma-high-fidelity.html'
const hasCombinedPrototype = existsSync(combinedPrototypePath)
const hasDeployedPrototype = existsSync(deployedPrototypePath)
const html = hasCombinedPrototype ? readFileSync(combinedPrototypePath, 'utf8') : ''
const deployedHtml = hasDeployedPrototype ? readFileSync(deployedPrototypePath, 'utf8') : ''

test('high-fidelity prototype script is valid and major workflows are interactive', { skip: !hasCombinedPrototype }, () => {
  const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'))
  assert.doesNotThrow(() => new Function(script))
  for (const id of ['loginForm', 'loadingScreen', 'notificationsView', 'activityView', 'settingsView', 'tourModal', 'logoutModal']) {
    assert.match(html, new RegExp(`id="${id}"`))
  }
  for (const feature of ['View All Notifications', 'View All Activity', 'Add New Student', 'Add Scholarship', 'Export PDF', 'SIGMAI']) {
    assert.match(html, new RegExp(feature))
  }
})

test('prototype includes complete analytics and scholarship program structures', { skip: !hasCombinedPrototype }, () => {
  for (const chart of ['Scholars per Category', 'Government vs Institutional vs Private', 'Scholar Trends by Semester / A.Y.']) assert.match(html, new RegExp(chart))
  assert.ok((html.match(/class="card scholar-card"/g) ?? []).length >= 6)
  assert.match(html, /id="reportFilters"/)
  assert.match(html, /id="scholarGrid"/)
})

test('deployable prototype contains the synchronized interactive screens', { skip: !hasDeployedPrototype }, () => {
  for (const marker of ['id="scholarshipActual"', 'id="reportsActual"', 'id="loginForm"', 'View All Notifications']) {
    assert.match(deployedHtml, new RegExp(marker))
  }
  assert.match(deployedHtml, /\/assets\/clsu-logo-/)
  assert.match(deployedHtml, /\/assets\/cobra-assistant-/)
})

test('Figma-ready prototype provides one standalone HTML file per page', () => {
  const pages = [
    '01-login.html',
    '02-forgot-password.html',
    '03-loading.html',
    '04-dashboard.html',
    '05-student-records.html',
    '06-scholarships.html',
    '07-reports.html',
    '08-notifications.html',
    '09-activity-log.html',
    '10-account-settings.html',
    '11-verify-enrollment.html',
    '12-import-results.html',
    '13-duplicate-review.html',
    '14-sigmai-chat.html',
  ]

  assert.equal(existsSync('prototypes/figma-pages/shared.css'), false)
  assert.equal(existsSync('prototypes/figma-pages/index.html'), false)

  for (const page of pages) {
    const path = `prototypes/figma-pages/${page}`
    assert.ok(existsSync(path), `${page} should exist`)
    const pageHtml = readFileSync(path, 'utf8')
    assert.match(pageHtml, /<style>/)
    assert.doesNotMatch(pageHtml, /shared\.css/)
    assert.doesNotMatch(pageHtml, /\.\.\/\.\.\/src\/assets\//)
    assert.match(pageHtml, /<!doctype html>/)
  }

  const login = readFileSync('prototypes/figma-pages/01-login.html', 'utf8')
  const dashboard = readFileSync('prototypes/figma-pages/04-dashboard.html', 'utf8')
  assert.match(login, /data:image\/png;base64,/)
  for (const marker of ['id="loginForm"', 'id="togglePassword"', 'id="forgotModal"', 'id="loadingScreen"', 'id="dashboardScreen"', 'id="tour"']) assert.match(login, new RegExp(marker))
  const loginScript = login.slice(login.indexOf('<script>') + 8, login.indexOf('</script>'))
  assert.doesNotThrow(() => new Function(loginScript))
  assert.match(dashboard, /Dashboard/)
  assert.match(dashboard, /Duplicate Flags/)
  for (const page of pages.slice(3, 10)) {
    const authenticatedPage = readFileSync(`prototypes/figma-pages/${page}`, 'utf8')
    assert.match(authenticatedPage, /prototype-sigmai/)
    assert.match(authenticatedPage, /SIGMAI Cobra mascot/)
  }
  const chatbot = readFileSync('prototypes/figma-pages/14-sigmai-chat.html', 'utf8')
  assert.match(chatbot, /Ask SIGMAI a question/)
  assert.match(chatbot, /Total Enrolled Students/)
  assert.match(chatbot, /SIGMAI Cobra mascot/)
})
