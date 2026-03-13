-- Add last_soft_reminder_at to protocols
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS last_soft_reminder_at TIMESTAMPTZ;
