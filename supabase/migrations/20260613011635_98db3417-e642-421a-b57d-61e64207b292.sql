ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS continuous_monthly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seed_idea text;