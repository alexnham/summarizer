-- 07_add_status.sql
-- Add status column to track transcription progress

ALTER TABLE public.summaries 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

ALTER TABLE public.summaries 
ADD COLUMN IF NOT EXISTS error_message text;

-- Update existing records to have 'completed' status
UPDATE public.summaries SET status = 'completed' WHERE status IS NULL;
