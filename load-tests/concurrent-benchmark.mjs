/**
 * SyncPad High-Throughput Concurrent Benchmark
 * Measures throughput and latency under heavy concurrency.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.TARGET_URL || 'https://localhost';
const CONCURRENT_WORKERS = parseInt(process.env.CONCURRENT_WORKERS || '20', 10);
const ITERATIONS_PER_WORKER = parseInt(process.env.ITERATIONS || '5', 10);

console.log(`============================================================`);
console.log(`  SyncPad High-Throughput Concurrency Benchmark`);
console.log(`  Target: ${BASE_URL}`);
console.log(`  Concurrent Workers: ${CONCURRENT_WORKERS}`);
console.log(`  Iterations/Worker: ${ITERATIONS_PER_WORKER}`);
console.log(`  Total Iterations: ${CONCURRENT_WORKERS * ITERATIONS_PER_WORKER}`);
console.log(`============================================================\n`);

let totalRequests = 0;
let failedRequests = 0;
const latencies = [];

async function timeRequest(name, fn) {
  const start = Date.now();
  try {
    totalRequests++;
    const res = await fn();
    const duration = Date.now() - start;
    latencies.push(duration);
    if (!res.ok) {
      failedRequests++;
      return { ok: false, status: res.status, duration };
    }
    return { ok: true, status: res.status, duration, data: await res.json().catch(() => ({})) };
  } catch (err) {
    totalRequests++;
    failedRequests++;
    return { ok: false, error: err.message };
  }
}

async function setupUsers(count) {
  const tokens = [];
  for (let i = 1; i <= count; i++) {
    const email = `benchmark_seed_user_${i}_${Date.now()}@syncpad.bench`;
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!', name: `Seed User ${i} ${Date.now()}` })
    });
    const data = await res.json().catch(() => ({}));
    const token = data.token || data.accessToken;
    if (token) {
      tokens.push(token);
    } else {
      console.error(`Registration failed (${res.status}):`, data);
    }
  }
  return tokens;
}

async function runWorker(workerId, token) {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  for (let i = 0; i < ITERATIONS_PER_WORKER; i++) {
    // 1. Create Document
    const createRes = await timeRequest('createDoc', () =>
      fetch(`${BASE_URL}/documents`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: `Concurrent RFC Worker ${workerId} Run ${i}`,
          content: `Initial architecture content for worker ${workerId} at timestamp ${Date.now()}`,
          fileType: 'DOC'
        })
      })
    );

    const docId = createRes.data?.id;

    if (docId) {
      // 2. Document Update & Version Snapshot
      await timeRequest('updateDoc', () =>
        fetch(`${BASE_URL}/documents/${docId}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            title: `Concurrent RFC Worker ${workerId} Run ${i} (Updated)`,
            content: `Updated revision snapshot with enhanced load benchmark content.`
          })
        })
      );

      // 3. Document Version History Retrieval
      await timeRequest('getVersions', () =>
        fetch(`${BASE_URL}/documents/${docId}/versions`, {
          headers: authHeaders
        })
      );
    }

    // 4. Global Full-Text Search
    await timeRequest('search', () =>
      fetch(`${BASE_URL}/documents/search?q=Concurrent`, {
        headers: authHeaders
      })
    );

    // 5. System Health & Prometheus Metrics Check
    await timeRequest('health', () => fetch(`${BASE_URL}/actuator/health`));
  }
}

async function main() {
  console.log(`--> Initializing authenticated session pool...`);
  const tokens = await setupUsers(5);
  if (tokens.length === 0) {
    console.error(`Failed to initialize session pool. Check backend connectivity.`);
    process.exit(1);
  }
  console.log(`    Successfully authenticated ${tokens.length} pool sessions.\n`);

  console.log(`--> Executing ${CONCURRENT_WORKERS} concurrent worker tasks...`);
  const startTime = Date.now();

  const workerPromises = [];
  for (let i = 0; i < CONCURRENT_WORKERS; i++) {
    const token = tokens[i % tokens.length];
    workerPromises.push(runWorker(i + 1, token));
  }

  await Promise.all(workerPromises);

  const durationSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const rps = Math.round(totalRequests / durationSec);

  console.log(`\n============================================================`);
  console.log(`  SyncPad High-Throughput Load Test Results`);
  console.log(`============================================================`);
  console.log(`  Total Execution Time : ${durationSec.toFixed(2)}s`);
  console.log(`  Total HTTP Requests  : ${totalRequests}`);
  console.log(`  Successful Requests  : ${totalRequests - failedRequests}`);
  console.log(`  Failed Requests      : ${failedRequests}`);
  console.log(`  Error Rate           : ${((failedRequests / totalRequests) * 100).toFixed(2)}%`);
  console.log(`  Throughput           : ${rps} req/sec`);
  console.log(`------------------------------------------------------------`);
  console.log(`  Latency Distribution:`);
  console.log(`    Average Latency    : ${avg}ms`);
  console.log(`    p50 (Median)       : ${p50}ms`);
  console.log(`    p95 (95th %ile)    : ${p95}ms`);
  console.log(`    p99 (99th %ile)    : ${p99}ms`);
  console.log(`============================================================\n`);

  if (failedRequests > 0 || p95 > 1000) {
    console.error(`FAILED: Concurrency load test failed latency or error thresholds.`);
    process.exit(1);
  } else {
    console.log(`PASSED: All throughput and latency SLAs validated successfully!`);
  }
}

main();
