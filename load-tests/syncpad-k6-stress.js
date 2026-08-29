import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom Prometheus-compatible Trend & Rate metrics
export const exportDuration = new Trend('syncpad_export_duration_ms');
export const exportFailureRate = new Rate('syncpad_export_failure_rate');
export const wsConnectDuration = new Trend('syncpad_ws_connect_duration_ms');
export const wsMessagesSent = new Counter('syncpad_ws_messages_sent_total');
export const wsErrors = new Rate('syncpad_ws_error_rate');

// Test Configuration: 50 to 100 Virtual Users (VUs)
export const options = {
  scenarios: {
    // Scenario A: High-Concurrency Bulk Document Export Operations
    bulk_export_stress: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '15s', target: 50 },  // Ramp to 50 VUs
        { duration: '30s', target: 100 }, // Peak at 100 VUs
        { duration: '15s', target: 20 },  // Ramp down
      ],
      gracefulRampDown: '5s',
      exec: 'bulkExportScenario',
    },
    // Scenario B: Real-Time WebSocket Collaborative Editors
    websocket_collaboration: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '15s', target: 25 },  // Ramp to 25 editors
        { duration: '30s', target: 50 },  // Peak at 50 concurrent editors
        { duration: '15s', target: 10 },  // Ramp down
      ],
      gracefulRampDown: '5s',
      exec: 'websocketScenario',
    },
  },
  thresholds: {
    // SLO Thresholds
    'syncpad_export_duration_ms': ['p(95)<800', 'p(99)<1500'],
    'syncpad_export_failure_rate': ['rate<0.02'], // Max 2% failure under peak 100 VUs
    'syncpad_ws_connect_duration_ms': ['p(95)<400'],
    'syncpad_ws_error_rate': ['rate<0.05'],
  },
};

// Target Configuration passed via Environment variables
const BASE_URL = __ENV.TARGET_URL || 'https://localhost';
const WS_BASE_URL = __ENV.TARGET_WS_URL || 'wss://localhost/ws/websocket';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const DOC_ID = __ENV.DOC_ID || '1';

const EXPORT_FORMATS = ['md', 'html', 'txt', 'json', 'zip'];

// Headers
const getHeaders = () => ({
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Accept': '*/*',
});

/**
 * Workload 1: Bulk Document Export Operations
 * Exercises database read transactions, serialization, and stream compression.
 */
export function bulkExportScenario() {
  // Randomly select export format
  const format = EXPORT_FORMATS[Math.floor(Math.random() * EXPORT_FORMATS.length)];
  const url = `${BASE_URL}/documents/${DOC_ID}/export?format=${format}`;

  const startTime = new Date().getTime();
  const res = http.get(url, {
    headers: getHeaders(),
    timeout: '15s',
    insecureSkipTLSVerify: true,
  });
  const duration = new Date().getTime() - startTime;

  exportDuration.add(duration);

  const isSuccess = check(res, {
    'export status is 200': (r) => r.status === 200,
    'export body is non-empty': (r) => r.body && r.body.length > 0,
  });

  exportFailureRate.add(!isSuccess);

  // Think time: 100ms - 400ms between requests per VU
  sleep(0.1 + Math.random() * 0.3);
}

/**
 * Workload 2: Real-Time WebSocket Collaborative Editing
 * Establishes STOMP sessions, subscribes to topic, and pushes edit bursts.
 */
export function websocketScenario() {
  const wsUrl = `${WS_BASE_URL}?token=${encodeURIComponent(AUTH_TOKEN)}`;
  const connectStart = new Date().getTime();
  let isClosing = false;

  const res = ws.connect(wsUrl, { insecureSkipTLSVerify: true }, function (socket) {
    socket.on('open', () => {
      const connDuration = new Date().getTime() - connectStart;
      wsConnectDuration.add(connDuration);

      // STOMP CONNECT frame with Bearer token authentication
      const stompConnect = `CONNECT\naccept-version:1.2,1.1,1.0\nheart-beat:10000,10000\nAuthorization:Bearer ${AUTH_TOKEN}\n\n\0`;
      socket.send(stompConnect);

      // STOMP SUBSCRIBE frame to document topic
      const stompSub = `SUBSCRIBE\nid:sub-vu-${__VU}\ndestination:/topic/document/${DOC_ID}\n\n\0`;
      socket.send(stompSub);

      // Send periodic collaborative edits every 1 second
      let editCount = 0;
      const intervalId = socket.setInterval(() => {
        editCount++;
        const editPayload = JSON.stringify({
          documentId: DOC_ID,
          type: 'CONTENT_UPDATED',
          version: editCount,
          author: `VU-${__VU}`,
          timestamp: new Date().toISOString(),
          content: `Concurrent edit frame ${editCount} from VU ${__VU} at ${Date.now()}`
        });
        const stompSend = `SEND\ndestination:/app/chat.sendMessage\ncontent-type:application/json\n\n${editPayload}\0`;
        socket.send(stompSend);
        wsMessagesSent.add(1);
      }, 1000);

      socket.setTimeout(() => {
        isClosing = true;
        socket.clearInterval(intervalId);
        const stompDisconnect = 'DISCONNECT\nreceipt:bye\n\n\0';
        socket.send(stompDisconnect);
        socket.close();
      }, 25000);
    });

    socket.on('close', () => {
      // Normal graceful closure
    });

    socket.on('error', (e) => {
      if (isClosing) {
        return; // Normal teardown
      }
      wsErrors.add(1);
    });
  });

  check(res, { 'ws connected successfully': (r) => r && r.status === 101 });
  sleep(1.0);
}

