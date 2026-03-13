-- Migration: Add last_notified_at to protocols table
-- This enables smart time windows to prevent duplicate notifications

ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN protocols.last_notified_at IS 'Timestamp of the last notification sent for this protocol';
