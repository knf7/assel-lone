function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

function createObservability({ logger, notify } = {}) {
    const windowMs = Number(process.env.ALERT_WINDOW_MS || 60000);
    const alertMinRequests = Number(process.env.ALERT_MIN_REQUESTS || 20);
    const alert5xxRate = Number(process.env.ALERT_5XX_RATE_PERCENT || 5);
    const alertP95Ms = Number(process.env.ALERT_P95_MS || 1200);
    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MS || 300000);
    const records = [];
    let lastAlertAt = 0;

    const cleanup = (now) => {
        while (records.length && now - records[0].ts > windowMs) {
            records.shift();
        }
    };

    const snapshot = () => {
        const now = Date.now();
        cleanup(now);
        const total = records.length;
        const status500 = records.filter((r) => r.status >= 500);
        const latencies = records.map((r) => r.durationMs);
        const avgLatencyMs = total ? latencies.reduce((a, b) => a + b, 0) / total : 0;
        const p95LatencyMs = total ? percentile(latencies, 95) : 0;
        const errorRate5xx = total ? (status500.length / total) * 100 : 0;

        return {
            windowMs,
            totalRequests: total,
            errors5xx: status500.length,
            errorRate5xx: Number(errorRate5xx.toFixed(2)),
            avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
            p95LatencyMs: Number(p95LatencyMs.toFixed(2)),
            threshold: {
                minRequests: alertMinRequests,
                errorRate5xxPercent: alert5xxRate,
                p95Ms: alertP95Ms,
            },
        };
    };

    const evaluate = () => {
        const now = Date.now();
        const s = snapshot();
        if (s.totalRequests < alertMinRequests) return;
        const breach5xx = s.errorRate5xx >= alert5xxRate;
        const breachLatency = s.p95LatencyMs >= alertP95Ms;
        if (!breach5xx && !breachLatency) return;
        if (now - lastAlertAt < cooldownMs) return;
        lastAlertAt = now;

        const parts = [];
        if (breach5xx) parts.push(`5xx=${s.errorRate5xx}% >= ${alert5xxRate}%`);
        if (breachLatency) parts.push(`p95=${s.p95LatencyMs}ms >= ${alertP95Ms}ms`);
        const message = `[ALERT] API threshold breach (${parts.join(' | ')})`;

        if (logger?.warn) logger.warn(message, { snapshot: s });
        if (typeof notify === 'function') {
            notify(message, s, 'warning');
        }
    };

    setInterval(evaluate, 15000).unref();

    const middleware = (req, res, next) => {
        const start = process.hrtime.bigint();
        res.on('finish', () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1e6;
            const item = {
                ts: Date.now(),
                method: req.method,
                path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
                status: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
            };
            records.push(item);
            cleanup(item.ts);

            if (res.statusCode >= 500 && logger?.error) {
                logger.error('HTTP 5xx response', item);
                if (typeof notify === 'function') {
                    notify(`[HTTP 5xx] ${item.method} ${item.path}`, item, 'error');
                }
            }
        });
        next();
    };

    return {
        middleware,
        getSnapshot: snapshot,
    };
}

module.exports = {
    createObservability,
};
