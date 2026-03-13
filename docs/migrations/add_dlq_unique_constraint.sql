-- Migration: Add UNIQUE constraint for DLQ upsert
-- Created: 2026-02-15
-- Purpose: Fixes "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Note: Run this independently if the failed_notification_queue table already exists

-- Add UNIQUE constraint on correlation_id for upsert conflict resolution
-- This is required for the upsert() call in deadLetterQueue.js to work
ALTER TABLE failed_notification_queue 
ADD CONSTRAINT IF NOT EXISTS uq_failed_notification_queue_correlation_id UNIQUE (correlation_id);

-- Migration complete
