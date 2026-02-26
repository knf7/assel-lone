/**
 * Dependency-free Logger
 * Avoids 'winston' if npm install fails in restricted environments.
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (meta && Object.keys(meta).length > 0) {
        try {
            metaStr = ` | ${JSON.stringify(meta)}`;
        } catch (e) {
            metaStr = ` | [Circular/Unparseable Meta]`;
        }
    }
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

function log(level, message, meta) {
    const formatted = formatMessage(level, message, meta);

    // Console output
    if (level === 'error') {
        console.error(formatted.trim());
    } else {
        console.log(formatted.trim());
    }

    // File output
    try {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(LOG_DIR, `app-${date}.log`);
        fs.appendFileSync(logFile, formatted);
    } catch (err) {
        console.error('❌ Failed to write to log file:', err.message);
    }
}

module.exports = {
    info: (msg, meta) => log('info', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
};
