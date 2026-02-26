const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Only configure Google Strategy if credentials exist
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
        proxy: true
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

                if (!email) {
                    return done(new Error('No email found in Google profile'));
                }

                const result = await db.query('SELECT * FROM merchants WHERE email = $1', [email]);

                let merchant;
                if (result.rows.length > 0) {
                    merchant = result.rows[0];
                    // Link Google ID if not linked
                    if (!merchant.google_id) {
                        await db.query('UPDATE merchants SET google_id = $1 WHERE id = $2', [profile.id, merchant.id]);
                        merchant.google_id = profile.id;
                    }
                } else {
                    // Create new user
                    const apiKey = crypto.randomBytes(32).toString('hex');
                    const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);

                    const newMerchant = await db.query(
                        `INSERT INTO merchants 
                    (business_name, email, password_hash, api_key, subscription_plan, subscription_status, google_id, mobile_number)
                    VALUES ($1, $2, $3, $4, 'Free', 'Active', $5, $6)
                    RETURNING *`,
                        [profile.displayName, email, passwordHash, apiKey, profile.id, null]
                    );
                    merchant = newMerchant.rows[0];
                }
                return done(null, merchant);
            } catch (err) {
                console.error('Passport Google Strat Error', err);
                return done(err);
            }
        }
    ));
}

module.exports = passport;
