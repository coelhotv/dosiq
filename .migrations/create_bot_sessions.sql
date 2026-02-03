-- Migration: Create bot_sessions table for persistent session storage
-- Provides TTL-based session management with automatic cleanup
-- Created: 2026-02-03

-- Create the bot_sessions table with all required fields
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id UUID,
  context JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint on chat_id for efficient upsert operations
ALTER TABLE bot_sessions 
DROP CONSTRAINT IF EXISTS bot_sessions_chat_id_key;

ALTER TABLE bot_sessions 
ADD CONSTRAINT bot_sessions_chat_id_key UNIQUE (chat_id);

-- Create indexes for performance
-- Index for fast lookup by chat_id
CREATE INDEX IF NOT EXISTS idx_sessions_chat 
ON bot_sessions(chat_id);

-- Index for efficient cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_sessions_expires 
ON bot_sessions(expires_at);

-- Index for finding sessions by user
CREATE INDEX IF NOT EXISTS idx_sessions_user 
ON bot_sessions(user_id) 
WHERE user_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Service role can manage sessions" ON bot_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON bot_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON bot_sessions;

-- Create policy for service role (full access)
CREATE POLICY "Service role can manage sessions"
ON bot_sessions FOR ALL
USING (true)
WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE bot_sessions IS 'Stores conversational session state for Telegram bot with TTL support';
COMMENT ON COLUMN bot_sessions.chat_id IS 'Telegram chat ID (unique identifier for the conversation)';
COMMENT ON COLUMN bot_sessions.context IS 'JSONB session state data';
COMMENT ON COLUMN bot_sessions.expires_at IS 'Session expiration timestamp (TTL)';
COMMENT ON COLUMN bot_sessions.user_id IS 'Optional reference to app user (MOCK_USER_ID)';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at (drop first for idempotency)
DROP TRIGGER IF EXISTS update_bot_sessions_updated_at ON bot_sessions;

CREATE TRIGGER update_bot_sessions_updated_at
  BEFORE UPDATE ON bot_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a function for periodic cleanup (can be called via pg_cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_bot_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bot_sessions 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_bot_sessions() IS 'Removes expired bot sessions, returns count of deleted rows';
