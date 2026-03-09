const fs = require('fs');
const path = require('path');

const dir = './frontend/src';

// Very broad regex for emojis
const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;

function walk(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else {
            if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                if (emojiRegex.test(content)) {
                    console.log('Found emoji in:', fullPath);
                    // We can choose to manually review or auto replace them
                }
            }
        }
    });
}
walk(dir);
