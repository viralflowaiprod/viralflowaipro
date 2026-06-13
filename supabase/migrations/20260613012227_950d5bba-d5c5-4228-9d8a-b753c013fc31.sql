ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS current_job_id uuid,
  ADD COLUMN IF NOT EXISTS last_resume_at timestamptz;