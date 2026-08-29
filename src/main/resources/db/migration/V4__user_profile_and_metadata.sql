-- Migration V4: Add profile picture and created_at metadata to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(1024);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill created_at for any pre-existing user records
UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
