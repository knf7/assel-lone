/**
 * ── Secret Rotation Utility ──
 * This script provides a template for rotating JWT secrets and DB credentials.
 * In a production FinTech environment, this would integrate with AWS Secrets Manager or HashiCorp Vault.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.join(__dirname, '../.env');

const rotateJwtSecret = () => {
    console.log('🔄 Rotating JWT_SECRET...');
    const newSecret = crypto.randomBytes(64).toString('hex');

    if (!fs.existsSync(ENV_PATH)) {
        console.error('.env file not found');
        return;
    }

    let envContent = fs.readFileSync(ENV_PATH, 'utf8');

    // We should keep the OLD secret as JWT_SECRET_OLD for a transition window
    if (envContent.includes('JWT_SECRET=')) {
        envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${newSecret}`);
    } else {
        envContent += `\nJWT_SECRET=${newSecret}`;
    }

    fs.writeFileSync(ENV_PATH, envContent);
    console.log('✅ JWT_SECRET updated in .env. Restart server to apply.');
};

const rotateApiKey = () => {
    console.log('🔄 Logic for API Key rotation initialized...');
};

if (require.main === module) {
    rotateJwtSecret();
}

module.exports = { rotateJwtSecret, rotateApiKey };
