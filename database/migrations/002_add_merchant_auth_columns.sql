-- Add username and security columns to merchants

ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS username VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS merchants_username_key
    ON merchants (username)
    WHERE username IS NOT NULL;

ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS session_version INT DEFAULT 1;
