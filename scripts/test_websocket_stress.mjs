/**
 * SyncPad WebSocket Multi-Client Concurrency & Stress Test
 * Simulates concurrent collaborative sessions over SockJS / STOMP
 * measuring message broadcast latency, throughput, and delivery integrity.
 */

import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Disable TLS verification for local test certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const BASE_HTTP_URL = process.env.TARGET_URL || 'https://localhost'
const WS_URL = process.env.WS_URL || `${BASE_HTTP_URL}/ws`
const NUM_CLIENTS = parseInt(process.env.CONCURRENT_CLIENTS || '15', 10)
const MESSAGES_PER_CLIENT = parseInt(process.env.MESSAGES_PER_CLIENT || '5', 10)

const require = createRequire(import.meta.url)
const SockJS = require(path.join(rootDir, 'Document Workspace Design/node_modules/sockjs-client'))
const { Client } = await import('file://' + path.join(rootDir, 'Document Workspace Design/node_modules/@stomp/stompjs/esm6/index.js'))

async function jsonRequest(urlPath, options = {}) {
  const res = await fetch(`${BASE_HTTP_URL}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.99',
      ...(options.headers || {})
    }
  })
  const text = await res.text()
  try {
    return { status: res.status, data: JSON.parse(text) }
  } catch {
    return { status: res.status, data: text }
  }
}

async function main() {
  console.log(`\n============================================================`)
  console.log(`     SyncPad WebSocket Concurrency & Stress Test Suite      `)
  console.log(`     Target: ${WS_URL}                                      `)
  console.log(`     Clients: ${NUM_CLIENTS} | Messages/client: ${MESSAGES_PER_CLIENT} `)
  console.log(`============================================================\n`)

  const ts = Date.now()
  const email = `ws_stress_${ts}@syncpad.test`
  const password = 'StressPassword123!'

  console.log(`--> [Setup] Registering stress test user [${email}]...`)
  const regRes = await jsonRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: `Stress Test User ${ts}`, email, password })
  })

  if (regRes.status !== 200) {
    console.error(`Registration failed:`, regRes)
    process.exit(1)
  }

  const token = regRes.data.token
  const authHeaders = { Authorization: `Bearer ${token}` }

  console.log(`--> [Setup] Creating workspace & document...`)
  const wsRes = await jsonRequest('/workspaces', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `WS Stress Workspace ${ts}`, description: 'Stress WS', color: '#10B981' })
  })
  const workspaceName = wsRes.data.name

  const docRes = await jsonRequest('/documents', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Real-Time Concurrency Test Doc',
      content: 'Initial stress test content',
      fileType: 'DOC',
      workspaceName
    })
  })
  const documentId = docRes.data.id
  console.log(`--> [Setup] Test Document ID: ${documentId}`)

  console.log(`\n--> [Step 1] Connecting ${NUM_CLIENTS} concurrent STOMP clients...`)
  const clients = []
  const receivedMessages = new Map() // clientIndex -> Array<Message>
  const connectionPromises = []

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const clientIndex = i
    receivedMessages.set(clientIndex, [])

    const p = new Promise((resolve, reject) => {
      const stompClient = new Client({
        webSocketFactory: () => new SockJS(WS_URL),
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 0,
        debug: () => {},
        onConnect: () => {
            try {
              const body = JSON.parse(msg.body)
              receivedMessages.get(clientIndex).push({ ...body, receivedAt: Date.now() })
            } catch (e) {
              console.error(`Client ${clientIndex} parse error`, e)
            }
          })
          resolve(stompClient)
        },
        onStompError: (frame) => {
          console.error(`Client ${clientIndex} STOMP error:`, frame.headers['message'])
          reject(new Error(frame.headers['message']))
        },
        onWebSocketError: (event) => {
          reject(new Error(`WebSocket error for client ${clientIndex}`))
        }
      })

      stompClient.activate()
      clients.push(stompClient)
    })

    connectionPromises.push(p)
  }

  await Promise.all(connectionPromises)
  console.log(`--> All ${NUM_CLIENTS} clients successfully connected and subscribed to /topic/documents/${documentId}!`)

  // Brief pause to stabilize subscriptions across RabbitMQ STOMP broker
  await new Promise(r => setTimeout(r, 1000))

  console.log(`\n--> [Step 2] Broadcasting ${MESSAGES_PER_CLIENT} delta edits per client...`)
  const startTime = Date.now()
  const latencies = []
  let totalPublished = 0

  for (let round = 1; round <= MESSAGES_PER_CLIENT; round++) {
    for (let i = 0; i < NUM_CLIENTS; i++) {
      const sendTs = Date.now()
      const payload = {
        documentId,
        title: `Stress Update Round ${round}`,
        content: `Edit payload from client ${i} at timestamp ${sendTs}`,
        senderName: `Client-${i}`,
        type: 'EDIT',
        timestamp: sendTs
      }

      clients[i].publish({
        destination: `/app/documents/${documentId}/edit`,
        body: JSON.stringify(payload)
      })
      totalPublished++
    }
    // Small pacing interval
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`--> Sent ${totalPublished} broadcast messages across ${NUM_CLIENTS} clients. Waiting for deliveries...`)

  // Wait up to 5 seconds for message propagation
  await new Promise(r => setTimeout(r, 3000))

  const totalExpectedDeliveries = totalPublished * NUM_CLIENTS
  let actualDeliveries = 0
  for (let i = 0; i < NUM_CLIENTS; i++) {
    const count = receivedMessages.get(i).length
    actualDeliveries += count
    for (const msg of receivedMessages.get(i)) {
      if (msg.timestamp && msg.receivedAt) {
        latencies.push(msg.receivedAt - msg.timestamp)
      }
    }
  }

  const durationSec = (Date.now() - startTime) / 1000
  const throughput = (actualDeliveries / durationSec).toFixed(1)
  const avgLatency = latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : 0
  const p95Latency = latencies.length ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0

  console.log(`\n============================================================`)
  console.log(`            WebSocket Stress Test Results                   `)
  console.log(`============================================================`)
  console.log(` Connected Clients:            ${NUM_CLIENTS}`)
  console.log(` Total Broadcasts Sent:        ${totalPublished}`)
  console.log(` Total Messages Delivered:     ${actualDeliveries} / ${totalExpectedDeliveries}`)
  console.log(` Delivery Success Rate:        ${((actualDeliveries / totalExpectedDeliveries) * 100).toFixed(1)}%`)
  console.log(` Delivery Throughput:          ${throughput} msgs/sec`)
  console.log(` Average End-to-End Latency:   ${avgLatency} ms`)
  console.log(` P95 End-to-End Latency:       ${p95Latency} ms`)
  console.log(`============================================================\n`)

  // Teardown
  for (const c of clients) {
    try {
      c.deactivate()
    } catch {}
  }

  if (actualDeliveries === 0) {
    console.error(`FAILED: Zero messages delivered across WebSocket broker!`)
    process.exit(1)
  }

  console.log(`==> WebSocket Stress & Concurrency Test PASSED Successfully!`)
  process.exit(0)
}

main().catch(err => {
  console.error('\nWebSocket Stress Test Failed:', err)
  process.exit(1)
})
