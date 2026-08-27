/**
 * SyncPad End-to-End (E2E) Test Suite
 * Validates full authentication, workspace hierarchy, document lifecycle,
 * authorization barriers, share link revocation, and security headers against live stack.
 */

const BASE_URL = process.env.TARGET_URL || 'https://localhost'

// Disable TLS verification for self-signed certificates in local/staging test
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

let testsRun = 0
let testsPassed = 0

function assert(condition, message) {
  testsRun++
  if (!condition) {
    console.error(`  [FAIL] ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  testsPassed++
  console.log(`  [PASS] ${message}`)
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': '198.51.100.42',
    ...(options.headers || {})
  }
  const res = await fetch(url, { ...options, headers })
  let data = null
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, headers: res.headers, body: data }
}

async function runSuite() {
  console.log(`\n============================================================`)
  console.log(`       SyncPad Automated End-to-End (E2E) Test Suite        `)
  console.log(`       Target: ${BASE_URL}                                  `)
  console.log(`============================================================\n`)

  const ts = Date.now()
  const user1Email = `e2e_user1_${ts}@syncpad.test`
  const user2Email = `e2e_user2_${ts}@syncpad.test`
  const password = 'StrongPassword123!'

  // 1. Security Headers Verification
  console.log(`--> Scenario 1: Reverse Proxy TLS & Security Headers`)
  const healthRes = await request('/actuator/health')
  assert(healthRes.status === 200, `Actuator health status 200`)
  assert(healthRes.body.status === 'UP', `Actuator reports status UP`)
  assert(healthRes.headers.get('content-security-policy') !== null, `Content-Security-Policy header is present`)
  assert(healthRes.headers.get('x-content-type-options')?.includes('nosniff'), `X-Content-Type-Options is nosniff`)
  assert(healthRes.headers.get('x-frame-options')?.includes('DENY'), `X-Frame-Options is DENY`)
  assert(healthRes.headers.get('strict-transport-security') !== null, `Strict-Transport-Security is present`)

  // 2. Authentication & JWT Refresh Tokens
  console.log(`\n--> Scenario 2: User Authentication & Token Lifecycle`)
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: `Alice E2E ${ts}`, email: user1Email, password })
  })
  assert(regRes.status === 200, `User 1 registration succeeds`)
  assert(!!regRes.body.token, `Registration issues JWT access token`)
  assert(!!regRes.body.refreshToken, `Registration issues refresh token`)

  const user1Token = regRes.body.token
  const user1RefreshToken = regRes.body.refreshToken

  // Register User 2
  const regRes2 = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: `Bob E2E ${ts}`, email: user2Email, password })
  })
  assert(regRes2.status === 200, `User 2 registration succeeds`)
  const user2Token = regRes2.body.token

  // Refresh token rotation
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: user1RefreshToken })
  })
  assert(refreshRes.status === 200, `Token refresh succeeds`)
  assert(!!refreshRes.body.token, `Rotated access token issued`)
  assert(!!refreshRes.body.refreshToken, `Rotated refresh token issued`)
  const activeUser1Token = refreshRes.body.token

  // 3. Workspace Creation
  console.log(`\n--> Scenario 3: Workspace & Folder Hierarchy`)
  const wsRes = await request('/workspaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: JSON.stringify({ name: `E2E Workspace ${ts}`, description: 'E2E Test WS', color: '#4F46E5' })
  })
  assert(wsRes.status === 200, `Workspace created successfully`)
  assert(wsRes.body.currentUserRole === 'OWNER', `Creator assigned OWNER role in workspace`)
  const workspaceName = wsRes.body.name

  // Folder creation
  const folderRes = await request('/folders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: JSON.stringify({ name: 'Architecture Docs', workspaceName })
  })
  assert(folderRes.status === 200, `Folder created successfully`)
  const folderId = folderRes.body.id

  // 4. Document Creation & DTO Validation
  console.log(`\n--> Scenario 4: Document Creation & DTO Returns`)
  const docRes = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: JSON.stringify({
      title: 'E2E Master Document',
      content: 'Production Readiness Verified',
      fileType: 'DOC',
      workspaceName,
      folderId
    })
  })
  assert(docRes.status === 200, `Document created successfully`)
  assert(docRes.body.title === 'E2E Master Document', `Document title matches`)
  assert(typeof docRes.body.version === 'number', `DocumentResponse includes numeric version`)
  const docId = docRes.body.id

  // Attach PDF
  const pdfRes = await request(`/documents/${docId}/pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: JSON.stringify({ fileName: 'spec.pdf', pdfUrl: 'https://storage.syncpad.internal/spec.pdf' })
  })
  assert(pdfRes.status === 200, `PDF attached successfully`)
  assert(pdfRes.body.pdfFileName === 'spec.pdf', `DocumentResponse contains pdfFileName`)

  // 5. Cross-Workspace Document Creation Authorization Barrier
  console.log(`\n--> Scenario 5: Cross-Workspace Authorization Barrier`)
  const maliciousDocRes = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: JSON.stringify({
      title: 'Malicious Cross-Workspace Doc',
      content: 'Unauthorized payload',
      workspaceName
    })
  })
  assert(maliciousDocRes.status === 403, `Cross-workspace unauthorized document creation rejected (403 Forbidden)`)

  // 6. Share Link Ephemeral Permissions & Immediate Revocation
  console.log(`\n--> Scenario 6: Ephemeral Share Link & Immediate Revocation`)
  const shareLinkRes = await request(`/documents/${docId}/share-link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: JSON.stringify({ role: 'VIEWER' })
  })
  assert(shareLinkRes.status === 200, `Share link created successfully`)
  const shareToken = shareLinkRes.body.token

  // User 2 accesses shared document via token
  const readShareRes = await request(`/documents/share/${shareToken}`, {
    headers: { Authorization: `Bearer ${user2Token}` }
  })
  assert(readShareRes.status === 200, `User 2 can access document via valid share link`)
  assert(readShareRes.body.role === 'VIEWER', `Shared document access role is VIEWER`)

  // Revoke share link
  const revokeRes = await request(`/documents/share-link/${shareToken}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(revokeRes.status === 200, `Share link revoked successfully`)

  // User 2 attempts to access again via revoked share link
  const readRevokedRes = await request(`/documents/share/${shareToken}`, {
    headers: { Authorization: `Bearer ${user2Token}` }
  })
  assert(readRevokedRes.status === 403, `Access via revoked share link rejected (403 Forbidden)`)

  // User 2 attempts direct document access -> must be rejected (NO permanent permissions retained)
  const directDocRes = await request(`/documents/${docId}`, {
    headers: { Authorization: `Bearer ${user2Token}` }
  })
  assert(directDocRes.status === 403, `Direct document access rejected: no permanent permissions persisted (403 Forbidden)`)

  // 7. Full-Text Search Across Documents
  console.log(`\n--> Scenario 7: Global Full-Text Search`)
  const searchRes = await request(`/documents/search?q=Readiness`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(searchRes.status === 200, `Search request returns 200 OK`)
  assert(Array.isArray(searchRes.body), `Search returns array of results`)
  assert(searchRes.body.some(d => d.id === docId), `Search results contain created document`)

  // User 2 searches for the same term -> must NOT see User 1's private document
  const searchRes2 = await request(`/documents/search?q=Readiness`, {
    headers: { Authorization: `Bearer ${user2Token}` }
  })
  assert(searchRes2.status === 200, `User 2 search returns 200 OK`)
  assert(!searchRes2.body.some(d => d.id === docId), `Unauthorized documents are excluded from search results`)

  console.log(`\n============================================================`)
  console.log(` E2E Verification Complete: ${testsPassed}/${testsRun} Assertions Passed!`)
  console.log(`============================================================\n`)
}

runSuite().catch(err => {
  console.error('\nE2E Test Run Failed:', err)
  process.exit(1)
})
