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
  let body = options.body
  if (body && typeof body === 'object') {
    body = JSON.stringify(body)
  }
  const res = await fetch(url, { ...options, headers, body })
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

  // 8. Trash / Soft-Delete Lifecycle
  console.log(`\n--> Scenario 8: Trash / Soft-Delete Lifecycle`)
  const trashDocRes = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { title: 'Trash Lifecycle Document', content: '<p>Testing trash & restore lifecycle</p>' }
  })
  assert(trashDocRes.status === 200, `Create document for trash test succeeds (200 OK)`)
  const trashDocId = trashDocRes.body.id

  // Verify document is in active list
  const activeList1 = await request('/documents', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(activeList1.body.some(d => d.id === trashDocId), `Document appears in active list`)

  // Move document to trash via POST /documents/{id}/trash
  const moveTrashRes = await request(`/documents/${trashDocId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(moveTrashRes.status === 200, `Move document to trash succeeds (200 OK)`)
  assert(moveTrashRes.body.trashed === true, `Document trashed flag is true`)
  assert(!!moveTrashRes.body.trashedAt, `Document trashedAt timestamp is populated`)

  // Verify document is removed from active list
  const activeList2 = await request('/documents', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(!activeList2.body.some(d => d.id === trashDocId), `Document no longer appears in active list`)

  // Verify document appears in GET /documents/trash
  const trashList1 = await request('/documents/trash', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(trashList1.status === 200, `GET /documents/trash returns 200 OK`)
  assert(trashList1.body.some(d => d.id === trashDocId), `Document appears in trash list`)

  // Restore document via POST /documents/{id}/restore-trash
  const restoreRes = await request(`/documents/${trashDocId}/restore-trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(restoreRes.status === 200, `Restore document succeeds (200 OK)`)
  assert(restoreRes.body.trashed === false, `Document trashed flag is false`)
  assert(!restoreRes.body.trashedAt, `Document trashedAt is cleared`)

  // Verify restored document is back in active list and not in trash
  const activeList3 = await request('/documents', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(activeList3.body.some(d => d.id === trashDocId), `Document is back in active list`)

  const trashList2 = await request('/documents/trash', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(!trashList2.body.some(d => d.id === trashDocId), `Document no longer appears in trash list`)

  // Soft-delete via DELETE /documents/{id}
  const deleteSoftRes = await request(`/documents/${trashDocId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(deleteSoftRes.status === 200, `DELETE /documents/{id} soft-deletes into trash`)

  // Permanently delete via DELETE /documents/{id}/permanent
  const permDeleteRes = await request(`/documents/${trashDocId}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(permDeleteRes.status === 200, `DELETE /documents/{id}/permanent succeeds`)

  // Verify permanently purged
  const trashList3 = await request('/documents/trash', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(!trashList3.body.some(d => d.id === trashDocId), `Document purged permanently from trash`)

  // Empty trash test
  const tempDocRes = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { title: 'To Be Emptied', content: '<p>Temporary doc</p>' }
  })
  await request(`/documents/${tempDocRes.body.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  const emptyRes = await request('/documents/trash/empty', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(emptyRes.status === 200, `DELETE /documents/trash/empty succeeds (200 OK)`)
  assert(emptyRes.body.count >= 1, `Purged count reported accurately`)

  const trashListFinal = await request('/documents/trash', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(trashListFinal.body.length === 0, `Trash is completely empty`)

  // Bulk restore and bulk permanent delete test
  const bulkDoc1 = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { title: 'Bulk Doc 1', content: '<p>Bulk 1</p>' }
  })
  const bulkDoc2 = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { title: 'Bulk Doc 2', content: '<p>Bulk 2</p>' }
  })

  // Soft delete both
  await request(`/documents/${bulkDoc1.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${activeUser1Token}` } })
  await request(`/documents/${bulkDoc2.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${activeUser1Token}` } })

  // Bulk restore
  const bulkRestoreRes = await request('/documents/trash/restore-bulk', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { documentIds: [bulkDoc1.body.id, bulkDoc2.body.id] }
  })
  assert(bulkRestoreRes.status === 200, `POST /documents/trash/restore-bulk returns 200 OK`)
  assert(bulkRestoreRes.body.count === 2, `Bulk restored count is 2`)

  // Soft delete both again
  await request(`/documents/${bulkDoc1.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${activeUser1Token}` } })
  await request(`/documents/${bulkDoc2.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${activeUser1Token}` } })

  // Bulk permanent delete
  const bulkDeleteRes = await request('/documents/trash/delete-bulk', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { documentIds: [bulkDoc1.body.id, bulkDoc2.body.id] }
  })
  assert(bulkDeleteRes.status === 200, `POST /documents/trash/delete-bulk returns 200 OK`)
  assert(bulkDeleteRes.body.count === 2, `Bulk permanent deleted count is 2`)

  const afterBulkTrash = await request('/documents/trash', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(afterBulkTrash.body.length === 0, `Trash is verified empty after bulk operations`)

  // -------------------------------------------------------------
  // Scenario 9: Document Tags & Categorization
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 9: Document Tags & Categorization`)
  
  // 1. Create a workspace for tagging
  const tagWsRes = await request('/workspaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { name: `TagWs_${Date.now()}`, description: 'Workspace for tag tests' }
  })
  assert(tagWsRes.status === 200, `POST /workspaces for tags returns 200 OK`)
  const tagWsId = tagWsRes.body.id

  // 2. Create a document in this workspace
  const tagDocRes = await request('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { title: 'Tagged Architecture Document', content: 'Architecture content', fileType: 'DOC', workspaceName: tagWsRes.body.name }
  })
  assert(tagDocRes.status === 200, `POST /documents returns 200 OK`)
  const tagDocId = tagDocRes.body.id

  // 3. POST /documents/{id}/tags to add a new tag "planning" with color "#10b981"
  const addTagRes = await request(`/documents/${tagDocId}/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: { name: 'planning', color: '#10b981' }
  })
  assert(addTagRes.status === 200, `POST /documents/{id}/tags returns 200 OK`)
  assert(addTagRes.body.tags && addTagRes.body.tags.some(t => t.name === 'planning'), `Document has tag 'planning'`)
  const createdTagId = addTagRes.body.tags.find(t => t.name === 'planning').id

  // 4. GET /workspaces/{id}/tags to retrieve workspace tags
  const wsTagsRes = await request(`/workspaces/${tagWsId}/tags`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(wsTagsRes.status === 200, `GET /workspaces/{id}/tags returns 200 OK`)
  assert(wsTagsRes.body.some(t => t.name === 'planning'), `Workspace tags include 'planning'`)

  // 5. GET /documents?tag=planning
  const filterTagRes = await request('/documents?tag=planning', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(filterTagRes.status === 200, `GET /documents?tag=planning returns 200 OK`)
  assert(filterTagRes.body.some(d => d.id === tagDocId), `Filtered documents contain tagged doc`)

  // 6. DELETE /documents/{id}/tags/{tagId} to remove the tag
  const deleteTagRes = await request(`/documents/${tagDocId}/tags/${createdTagId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(deleteTagRes.status === 200, `DELETE /documents/{id}/tags/{tagId} returns 200 OK`)

  // Verify tag was removed
  const verifyDocRes = await request(`/documents/${tagDocId}`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(!verifyDocRes.body.tags || !verifyDocRes.body.tags.some(t => t.id === createdTagId), `Tag successfully removed from document`)

  // -------------------------------------------------------------
  // Scenario 10: Starred / Favorited Documents & Whiteboards
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 10: Starred / Favorited Documents`)

  // 1. Initial starred list should not contain tagDocId
  const initialStarredRes = await request('/documents/starred', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(initialStarredRes.status === 200, `GET /documents/starred returns 200 OK`)
  assert(!initialStarredRes.body.some(d => d.id === tagDocId), `Document is not initially starred`)

  // 2. POST /documents/{id}/star
  const starRes = await request(`/documents/${tagDocId}/star`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(starRes.status === 200, `POST /documents/{id}/star returns 200 OK`)
  assert(starRes.body.isStarred === true || starRes.body.starred === true, `Document response reflects isStarred = true`)

  // 3. GET /documents/starred should now contain the document
  const starredListRes = await request('/documents/starred', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(starredListRes.status === 200, `GET /documents/starred returns 200 OK`)
  assert(starredListRes.body.some(d => d.id === tagDocId), `GET /documents/starred includes newly starred document`)

  // 4. DELETE /documents/{id}/star
  const unstarRes = await request(`/documents/${tagDocId}/star`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(unstarRes.status === 200, `DELETE /documents/{id}/star returns 200 OK`)
  assert(unstarRes.body.isStarred === false || unstarRes.body.starred === false, `Document response reflects isStarred = false`)

  // 5. GET /documents/starred should no longer contain the document
  const finalStarredRes = await request('/documents/starred', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(!finalStarredRes.body.some(d => d.id === tagDocId), `Document is removed from GET /documents/starred`)

  // -------------------------------------------------------------
  // Scenario 11: Audit Trail & Workspace Activity Feed
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 11: Audit Trail & Activity Feed`)
  const wsActivityRes = await request(`/workspaces/${tagWsId}/activity`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(wsActivityRes.status === 200, `GET /workspaces/{id}/activity returns 200 OK`)
  assert(Array.isArray(wsActivityRes.body.content), `Workspace activity contains paginated log entries`)

  const docActivityRes = await request(`/documents/${tagDocId}/activity`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(docActivityRes.status === 200, `GET /documents/{id}/activity returns 200 OK`)
  assert(Array.isArray(docActivityRes.body.content), `Document activity contains paginated log entries`)

  // -------------------------------------------------------------
  // Scenario 12: Templates & Blueprint Gallery
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 12: Document Templates & Blueprint Gallery`)
  const templatesRes = await request('/templates', {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(templatesRes.status === 200, `GET /templates returns 200 OK`)
  assert(templatesRes.body.length >= 5, `Built-in blueprints loaded (at least 5 seeded templates)`)
  const meetingNotesTemplate = templatesRes.body.find(t => t.title.includes('Meeting Notes'))
  assert(!!meetingNotesTemplate, `Blueprint 'Meeting Notes' exists`)

  // Instantiate template into document
  const instantiateRes = await request(`/templates/${meetingNotesTemplate.id}/instantiate?workspaceId=${tagWsId}&title=Q4%20Planning%20Notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(instantiateRes.status === 200, `POST /templates/{id}/instantiate returns 200 OK`)
  assert(instantiateRes.body.title === 'Q4 Planning Notes', `Instantiated document has specified title`)
  assert(instantiateRes.body.content.includes('Agenda'), `Instantiated document contains template body`)
  const templateDocId = instantiateRes.body.id

  // Create custom template
  const customTemplateRes = await request('/templates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: {
      title: 'Incident Post-Mortem',
      description: 'Standard root-cause analysis blueprint',
      content: '# Post-Mortem\n\n## Timeline\n\n## Root Cause\n\n## Action Items',
      category: 'Engineering',
      icon: 'alert-triangle',
      workspaceId: tagWsId
    }
  })
  assert(customTemplateRes.status === 200, `POST /templates creates custom template`)
  assert(customTemplateRes.body.title === 'Incident Post-Mortem', `Custom template saved with title`)

  // -------------------------------------------------------------
  // Scenario 13: Server-Side Document Export Engine
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 13: Server-Side Document Export Engine`)
  
  // Export Markdown
  const exportMdRes = await request(`/documents/${templateDocId}/export?format=md`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(exportMdRes.status === 200, `GET /documents/{id}/export?format=md returns 200 OK`)
  assert(exportMdRes.headers.get('content-disposition')?.includes('.md'), `Markdown export has .md Content-Disposition`)

  // Export HTML
  const exportHtmlRes = await request(`/documents/${templateDocId}/export?format=html`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(exportHtmlRes.status === 200, `GET /documents/{id}/export?format=html returns 200 OK`)
  assert(typeof exportHtmlRes.body === 'string' && exportHtmlRes.body.includes('<!DOCTYPE html>'), `HTML export contains HTML document`)

  // Export TXT
  const exportTxtRes = await request(`/documents/${templateDocId}/export?format=txt`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(exportTxtRes.status === 200, `GET /documents/{id}/export?format=txt returns 200 OK`)

  // Export JSON bundle
  const exportJsonRes = await request(`/documents/${templateDocId}/export?format=json`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(exportJsonRes.status === 200, `GET /documents/{id}/export?format=json returns 200 OK`)
  assert(exportJsonRes.body.title === 'Q4 Planning Notes', `JSON export includes document title and metadata`)

  // Export ZIP archive bundle
  const exportZipRes = await request(`/documents/${templateDocId}/export?format=zip`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(exportZipRes.status === 200, `GET /documents/{id}/export?format=zip returns 200 OK`)
  assert(exportZipRes.headers.get('content-disposition')?.includes('.zip'), `ZIP export has .zip Content-Disposition`)

  // -------------------------------------------------------------
  // Scenario 14: Webhooks & Outbound Integrations
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 14: Webhooks & Outbound Integrations`)
  const createWebhookRes = await request(`/workspaces/${tagWsId}/webhooks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: {
      name: 'Slack DevOps Alerts',
      url: 'https://httpbin.org/post',
      secret: 'syncpad_test_hmac_secret',
      events: 'DOCUMENT_CREATED,COMMENT_ADDED'
    }
  })
  if (createWebhookRes.status !== 200) {
    console.error('DEBUG createWebhookRes failed:', createWebhookRes.status, createWebhookRes.body)
  }
  assert(createWebhookRes.status === 200, `POST /workspaces/{id}/webhooks returns 200 OK`)
  assert(createWebhookRes.body.name === 'Slack DevOps Alerts', `Webhook created with name`)
  const webhookId = createWebhookRes.body.id

  // List webhooks
  const listWebhooksRes = await request(`/workspaces/${tagWsId}/webhooks`, {
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(listWebhooksRes.status === 200, `GET /workspaces/{id}/webhooks returns 200 OK`)
  assert(listWebhooksRes.body.some(h => h.id === webhookId), `Registered webhook appears in workspace list`)

  // Test webhook ping
  const testHookRes = await request(`/workspaces/${tagWsId}/webhooks/${webhookId}/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(testHookRes.status === 200, `POST /workspaces/{id}/webhooks/{id}/test returns 200 OK`)

  // Delete webhook
  const delHookRes = await request(`/workspaces/${tagWsId}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeUser1Token}` }
  })
  assert(delHookRes.status === 200, `DELETE /workspaces/{id}/webhooks/{id} returns 200 OK`)

  // -------------------------------------------------------------
  // Scenario 15: Granular Collaboration RBAC (COMMENTER Role)
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 15: Granular Collaboration RBAC (COMMENTER Role)`)

  // User 1 shares document with User 2 with COMMENTER role and 24h duration
  const shareCommenterRes = await request(`/documents/${templateDocId}/share`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeUser1Token}` },
    body: {
      email: user2Email,
      role: 'COMMENTER',
      durationHours: 24
    }
  })
  assert(shareCommenterRes.status === 200, `POST /documents/{id}/share returns 200 OK with COMMENTER role`)
  assert(shareCommenterRes.body.role === 'COMMENTER', `Permission response reflects COMMENTER role`)
  assert(!!shareCommenterRes.body.expiresAt, `Expiring guest access has expiresAt timestamp`)
  assert(shareCommenterRes.body.isExpired === false || shareCommenterRes.body.expired === false, `Guest access is not expired`)

  // User 2 can read comments and post a comment
  const postCommentRes = await request(`/documents/${templateDocId}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: {
      text: 'I suggest revising item 2 in the agenda.'
    }
  })
  assert(postCommentRes.status === 200, `Commenter can post comments to document`)
  assert(postCommentRes.body.text.includes('revising item 2'), `Comment body saved correctly`)

  // User 2 cannot edit content (assertCanEditDocument blocks COMMENTER)
  const editAttemptRes = await request(`/documents/${templateDocId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: {
      title: 'Tampered Title',
      content: 'Tampered Content'
    }
  })
  assert(editAttemptRes.status === 403, `Commenter is FORBIDDEN (403) from updating document content`)

  // User 2 cannot rename document
  const renameAttemptRes = await request(`/documents/${templateDocId}/rename`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: {
      title: 'Commenter Rename'
    }
  })
  assert(renameAttemptRes.status === 403, `Commenter is FORBIDDEN (403) from renaming document`)

  console.log(`\n--> Scenario 16: AI Document Assistant & Generative Intelligence`)
  // 1. GET /api/ai/actions
  const aiActionsRes = await request('/api/ai/actions', {
    headers: { Authorization: `Bearer ${user1Token}` }
  })
  assert(aiActionsRes.status === 200, `GET /api/ai/actions returns 200 OK`)
  assert(Array.isArray(aiActionsRes.body), `AI actions returned as an array`)
  assert(aiActionsRes.body.some(a => a.action === 'SUMMARIZE'), `AI actions include SUMMARIZE`)
  assert(aiActionsRes.body.some(a => a.action === 'ACTION_ITEMS'), `AI actions include ACTION_ITEMS`)

  // 2. POST /api/ai/generate with SUMMARIZE
  const aiSummarizeRes = await request('/api/ai/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: {
      documentId: templateDocId,
      action: 'SUMMARIZE'
    }
  })
  assert(aiSummarizeRes.status === 200, `POST /api/ai/generate with SUMMARIZE returns 200 OK`)
  assert(aiSummarizeRes.body.text && aiSummarizeRes.body.text.includes('Summary'), `Summary text contains executive summary`)
  assert(aiSummarizeRes.body.modelUsed !== undefined, `Response specifies model used`)

  // 3. POST /api/ai/generate with ACTION_ITEMS
  const aiActionsExtractRes = await request('/api/ai/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: {
      documentId: templateDocId,
      action: 'ACTION_ITEMS'
    }
  })
  assert(aiActionsExtractRes.status === 200, `POST /api/ai/generate with ACTION_ITEMS returns 200 OK`)
  assert(aiActionsExtractRes.body.text && aiActionsExtractRes.body.text.includes('- [ ]'), `Action items formatted as markdown checklist`)

  // 4. Cross-workspace unauthorized user access blocked (403 Forbidden)
  const user3Email = `e2e_ai_unauth_${Date.now()}@syncpad.com`
  const user3Reg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Unauthorized AI User', email: user3Email, password: 'password123' }
  })
  const user3Token = user3Reg.body.accessToken

  const unauthAiRes = await request('/api/ai/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user3Token}` },
    body: {
      documentId: templateDocId,
      action: 'SUMMARIZE'
    }
  })
  assert(unauthAiRes.status === 403, `Unauthorized AI document access blocked (403 Forbidden)`)

  // -------------------------------------------------------------
  // Scenario 17: Progressive Web App (PWA) & Offline Mobile Mode
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 17: Progressive Web App (PWA) & Offline Mobile Mode`)

  // 1. GET /manifest.json returns 200 OK and valid PWA manifest
  const manifestRes = await request('/manifest.json')
  assert(manifestRes.status === 200, `GET /manifest.json returns 200 OK`)
  assert(manifestRes.body.name === 'SyncPad Collaborative Workspace', `Manifest declares correct app name`)
  assert(manifestRes.body.display === 'standalone', `Manifest specifies standalone display mode`)
  assert(manifestRes.body.icons && manifestRes.body.icons.length >= 4, `Manifest includes high-res PNG and SVG icons`)

  // 2. GET /sw.js returns 200 OK with Service Worker implementation
  const swRes = await request('/sw.js')
  assert(swRes.status === 200, `GET /sw.js returns 200 OK`)
  assert(typeof swRes.body === 'string' && swRes.body.includes('syncpad-v1-cache'), `Service Worker manages cache lifecycle`)

  // 3. GET /icons/icon-192.png returns 200 OK
  const iconPngRes = await request('/icons/icon-192.png')
  assert(iconPngRes.status === 200, `GET /icons/icon-192.png returns 200 OK`)

  // 4. GET /icons/icon-192.svg returns 200 OK
  const iconSvgRes = await request('/icons/icon-192.svg')
  assert(iconSvgRes.status === 200, `GET /icons/icon-192.svg returns 200 OK`)

  // 5. GET /js/offline/syncpad-offline.js returns 200 OK
  const offlineJsRes = await request('/js/offline/syncpad-offline.js')
  assert(offlineJsRes.status === 200, `GET /js/offline/syncpad-offline.js returns 200 OK`)
  assert(typeof offlineJsRes.body === 'string' && offlineJsRes.body.includes('SyncPadOfflineDB'), `IndexedDB offline storage manager loaded`)

  // -------------------------------------------------------------
  // Scenario 18: Enterprise SSO & SCIM 2.0 Directory Lifecycle
  // -------------------------------------------------------------
  console.log(`\n--> Scenario 18: Enterprise SSO (SAML 2.0 / OIDC) & SCIM 2.0 Provisioning`)

  // 1. GET /auth/sso/providers returns configured enterprise IdPs
  const ssoProvidersRes = await request('/auth/sso/providers')
  assert(ssoProvidersRes.status === 200, `GET /auth/sso/providers returns 200 OK`)
  assert(Array.isArray(ssoProvidersRes.body) && ssoProvidersRes.body.length >= 3, `Discovered enterprise identity providers (Okta, Azure, Google)`)

  // 2. POST /auth/sso/discover resolves corporate email to provider metadata
  const ssoDiscoverRes = await request('/auth/sso/discover', {
    method: 'POST',
    body: { email: 'staff@okta.com' }
  })
  assert(ssoDiscoverRes.status === 200, `POST /auth/sso/discover returns 200 OK`)
  assert(ssoDiscoverRes.body.provider === 'OKTA', `Domain correctly mapped to OKTA identity provider`)

  // 3. POST /auth/sso/login executes Just-In-Time (JIT) provisioning
  const ssoUserEmail = `sso_employee_${ts}@okta.com`
  const ssoLoginRes = await request('/auth/sso/login', {
    method: 'POST',
    body: {
      provider: 'OKTA',
      email: ssoUserEmail,
      name: 'SSO Employee',
      department: 'Infrastructure & Security',
      assertion: 'valid-okta-saml-response'
    }
  })
  assert(ssoLoginRes.status === 200, `POST /auth/sso/login with JIT provisioning returns 200 OK`)
  const ssoToken = ssoLoginRes.body.accessToken || ssoLoginRes.body.token
  assert(ssoToken !== undefined, `SSO login issues JWT access token`)
  assert(ssoLoginRes.body.refreshToken !== undefined, `SSO login issues refresh token`)

  // Verify auto-provisioned workspace exists for JIT provisioned user
  const ssoWsRes = await request('/workspaces', {
    headers: { Authorization: `Bearer ${ssoToken}` }
  })
  assert(ssoWsRes.status === 200, `GET /workspaces for JIT user returns 200 OK`)
  assert(Array.isArray(ssoWsRes.body) && ssoWsRes.body.length > 0, `Auto-provisioned default personal workspace for SSO user`)

  // 4. GET /scim/v2/ServiceProviderConfig returns RFC 7643 compliance
  const scimConfigRes = await request('/scim/v2/ServiceProviderConfig')
  assert(scimConfigRes.status === 200, `GET /scim/v2/ServiceProviderConfig returns 200 OK`)
  assert(scimConfigRes.body.patch && scimConfigRes.body.patch.supported === true, `SCIM 2.0 declares PATCH operation support`)

  // 5. POST /scim/v2/Users provisions employee via enterprise directory sync
  const scimEmployeeEmail = `scim_staff_${ts}@syncpad.test`
  const scimCreateRes = await request('/scim/v2/Users', {
    method: 'POST',
    body: {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: scimEmployeeEmail,
      displayName: 'Directory Employee',
      department: 'Product Engineering',
      active: true,
      emails: [{ value: scimEmployeeEmail, primary: true }]
    }
  })
  assert(scimCreateRes.status === 201, `POST /scim/v2/Users provisions user (201 Created)`)
  assert(scimCreateRes.body.id !== undefined, `SCIM provisioned user returns unique ID`)
  const scimUserId = scimCreateRes.body.id

  // 6. GET /scim/v2/Users/{id} retrieves user representation
  const scimGetRes = await request(`/scim/v2/Users/${scimUserId}`)
  assert(scimGetRes.status === 200, `GET /scim/v2/Users/{id} returns 200 OK`)
  assert(scimGetRes.body.active === true, `SCIM user active status is true`)

  // 7. PATCH /scim/v2/Users/{id} deactivates user (employee offboarding)
  const scimDeactivateRes = await request(`/scim/v2/Users/${scimUserId}`, {
    method: 'PATCH',
    body: {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', path: 'active', value: false }]
    }
  })
  assert(scimDeactivateRes.status === 200, `PATCH /scim/v2/Users/{id} deactivates user (200 OK)`)
  assert(scimDeactivateRes.body.active === false, `Patched user active status is false`)

  // 8. Deactivated corporate user is FORBIDDEN (403) from SSO login
  const deactLoginRes = await request('/auth/sso/login', {
    method: 'POST',
    body: {
      provider: 'OKTA',
      email: scimEmployeeEmail,
      name: 'Directory Employee'
    }
  })
  assert(deactLoginRes.status === 403, `Deactivated corporate account rejected from SSO login (403 Forbidden)`)

  console.log(`\n============================================================`)
  console.log(` E2E Verification Complete: ${testsPassed}/${testsRun} Assertions Passed!`)
  console.log(`============================================================\n`)
}

runSuite().catch(err => {
  console.error('\nE2E Test Run Failed:', err)
  process.exit(1)
})
