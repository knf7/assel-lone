const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
    }
}

async function run() {
    loadEnv();
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3100}`;
    const metricsKey = process.env.ADMIN_SECRET || '';
    const max5xxRate = Number(process.env.MONITOR_MAX_5XX_RATE || 5);
    const maxP95Ms = Number(process.env.MONITOR_MAX_P95_MS || 1200);
    const minRequestsForAlarm = Number(process.env.ALERT_MIN_REQUESTS || 20);
    let failed = false;

    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json().catch(() => ({}));
    console.log('Health:', healthRes.status, health);
    if (healthRes.status >= 500 || health.status === 'degraded') {
        console.error('Health check failed/degraded.');
        failed = true;
    }

    if (!metricsKey) {
        console.warn('ADMIN_SECRET is not set. Skipping runtime metrics check.');
    } else {
        const rtRes = await fetch(`${baseUrl}/api/ops/runtime-metrics`, {
            headers: { 'x-metrics-key': metricsKey },
        });
        const runtime = await rtRes.json().catch(() => ({}));
        console.log('Runtime metrics:', rtRes.status, runtime.runtime || runtime);
        if (!rtRes.ok) {
            console.error('Runtime metrics endpoint failed.');
            failed = true;
        } else {
            const snap = runtime.runtime || {};
            const totalRequests = Number(snap.totalRequests || 0);
            const sampleSizeGate = Number.isFinite(totalRequests) && totalRequests >= minRequestsForAlarm;

            if (!sampleSizeGate) {
                console.log(`Runtime sample too small for alarms (${totalRequests}/${minRequestsForAlarm}); skipping threshold failure.`);
            } else {
                if ((snap.errorRate5xx || 0) > max5xxRate) {
                    console.error(`5xx rate alarm: ${snap.errorRate5xx}% > ${max5xxRate}%`);
                    failed = true;
                }
                if ((snap.p95LatencyMs || 0) > maxP95Ms) {
                    console.error(`Latency alarm: p95 ${snap.p95LatencyMs}ms > ${maxP95Ms}ms`);
                    failed = true;
                }
            }
        }
    }

    if (failed) process.exit(1);
    console.log('Monitor checks passed.');
}

run().catch((err) => {
    console.error('Monitor check failed:', err);
    process.exit(1);
});
