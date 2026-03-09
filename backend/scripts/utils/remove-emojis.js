const fs = require('fs');
const path = require('path');

const dir = './frontend/src';

// Regex for all emoji characters, excluding standard Arabic text, numbers, and basic punctuation
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F200}-\u{1F251}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2B50}\u{23F1}\u{231A}]/gu;

function walk(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else {
            if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                if (emojiRegex.test(content)) {
                    console.log('Replacing emojis in:', fullPath);
                    const newContent = content.replace(emojiRegex, '');
                    fs.writeFileSync(fullPath, newContent, 'utf8');
                }
            }
        }
    });
}
walk(dir);
console.log('Done stripping emojis.');
