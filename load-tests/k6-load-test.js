import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const successfulRequests = new Counter('syncpad_successful_requests');
const failureRate = new Rate('syncpad_failure_rate');
const searchDuration = new Trend('syncpad_search_duration_ms');
const saveDuration = new Trend('syncpad_save_duration_ms');

export const options = {
  stages: [
    { duration: '3s', target: 15 }, // Ramp up to 15 concurrent VUs
    { duration: '10s', target: 30 }, // High-throughput concurrency plateau
    { duration: '3s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
    syncpad_failure_rate: ['rate<0.02'],
  },
  insecureSkipTLSVerify: true,
};

const BASE_URL = __ENV.TARGET_URL || 'https://localhost';

// Idiomatic k6 setup phase: pre-authenticates user pool
export function setup() {
  const tokens = [];
  for (let i = 1; i <= 5; i++) {
    const payload = JSON.stringify({
      email: `k6_seed_${i}_${Date.now()}@syncpad.bench`,
      password: 'Password123!',
      name: `K6 User ${i} ${Date.now()}`,
    });

    const res = http.post(`${BASE_URL}/auth/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      const data = JSON.parse(res.body);
      const token = data.token || data.accessToken;
      if (token) tokens.push(token);
    } catch {}
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];
  if (!token) return;

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let docId = null;

  // 1. Document Creation
  group('01_Document_Creation', function () {
    const docPayload = JSON.stringify({
      title: `K6 Concurrent Benchmark Doc VU ${__VU}`,
      content: `# High-Throughput Distributed Load Testing\n\nBenchmarking iteration ${__ITER} under VU ${__VU}.`,
      fileType: 'DOC',
    });

    const docRes = http.post(`${BASE_URL}/documents`, docPayload, {
      headers: authHeaders,
    });

    const docOk = check(docRes, {
      'create doc status is 200': (r) => r.status === 200,
    });

    failureRate.add(!docOk);
    if (docOk) {
      successfulRequests.add(1);
      try {
        docId = JSON.parse(docRes.body).id;
      } catch {}
    }
  });

  // 2. Document Update & Versioning
  if (docId) {
    group('02_Document_Update', function () {
      const updatePayload = JSON.stringify({
        title: `K6 Concurrent Benchmark Doc VU ${__VU} (Updated)`,
        content: `Updated revision with persistent version snapshot for iteration ${__ITER}.`,
      });

      const start = Date.now();
      const updateRes = http.put(`${BASE_URL}/documents/${docId}`, updatePayload, {
        headers: authHeaders,
      });
      saveDuration.add(Date.now() - start);

      const updateOk = check(updateRes, {
        'update doc status is 200': (r) => r.status === 200,
      });

      failureRate.add(!updateOk);
      if (updateOk) successfulRequests.add(1);
    });
  }

  // 3. Global Full-Text Search
  group('03_Full_Text_Search', function () {
    const start = Date.now();
    const searchRes = http.get(`${BASE_URL}/documents/search?q=Benchmark`, {
      headers: authHeaders,
    });
    searchDuration.add(Date.now() - start);

    const searchOk = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
    });

    failureRate.add(!searchOk);
    if (searchOk) successfulRequests.add(1);
  });

  // 4. System Health & Metrics
  group('04_Health_Check', function () {
    const healthRes = http.get(`${BASE_URL}/actuator/health`);
    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);
}
