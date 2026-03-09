const INSECURE_DEFAULTS = new Set([
    'your-secret-key-change-in-production',
    'your_jwt_secret_key_change_in_production',
    'local_dev_jwt_secret_key_change_in_production',
    'aseel_admin_2024_super_secret',
    'secret123',
    'Aseel@Admin2024!',
    'your_secure_password_here',
    'redis123',
    'postgres123',
]);

function assertEnv(name, opts = {}) {
    const { allowInDevelopment = true, minLength = 0 } = opts;
    const value = process.env[name];
    const isDev = (process.env.NODE_ENV || 'development') !== 'production';

    if (!value || !value.trim()) {
        if (!isDev || !allowInDevelopment) {
            throw new Error(`Missing required environment variable: ${name}`);
        }
        return;
    }

    if (value.trim().length < minLength) {
        throw new Error(`Environment variable ${name} is too short (min ${minLength})`);
    }

    if (!isDev && INSECURE_DEFAULTS.has(value.trim())) {
        throw new Error(`Environment variable ${name} uses an insecure default value`);
    }
}

function validateEnv() {
    const isProd = (process.env.NODE_ENV || 'development') === 'production';

    // Always required
    assertEnv('DB_PASSWORD', { allowInDevelopment: false, minLength: 8 });
    assertEnv('JWT_SECRET', { allowInDevelopment: false, minLength: 32 });

    // Production hard requirements
    if (isProd) {
        assertEnv('ADMIN_SECRET', { allowInDevelopment: false, minLength: 32 });
        assertEnv('ADMIN_PASSWORD', { allowInDevelopment: false, minLength: 12 });
    }
}

module.exports = {
    validateEnv,
    assertEnv,
};
