const os = require('os');
const db = require('../config/database');

exports.getMetrics = async (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const cpuLoad = os.loadavg();
        const uptime = process.uptime();

        // Database pool metrics
        const poolInfo = {
            totalConnections: db.pool.totalCount,
            idleConnections: db.pool.idleCount,
            waitingRequests: db.pool.waitingCount,
            usagePercentage: ((db.pool.totalCount - db.pool.idleCount) / db.pool.totalCount * 100).toFixed(2)
        };

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
            process: {
                memory: {
                    rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                },
                cpu: {
                    load1m: cpuLoad[0].toFixed(2),
                    load5m: cpuLoad[1].toFixed(2),
                    load15m: cpuLoad[2].toFixed(2),
                }
            },
            database: poolInfo,
            system: {
                freeMemory: `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`,
                totalMemory: `${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`,
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve metrics', details: err.message });
    }
};
