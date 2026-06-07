
-- 1) Master codes
ALTER TABLE public.activation_codes
  ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;

-- 2) Privacy mode
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_mode text NOT NULL DEFAULT 'save_all';

-- 3) Video jobs: prompt + reference images
ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS reference_images jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4) Automation settings
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'auto',
  daily_quantity integer NOT NULL DEFAULT 36,
  platforms jsonb NOT NULL DEFAULT '["youtube","instagram","tiktok","pinterest"]'::jsonb,
  time_slots jsonb NOT NULL DEFAULT '["08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"]'::jsonb,
  niche text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_settings TO authenticated;
GRANT ALL ON public.automation_settings TO service_role;

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own automation settings"
  ON public.automation_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER automation_settings_touch
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Seed master activation code
INSERT INTO public.activation_codes (code, source, plan_tier, status, is_master)
VALUES ('VIRALFLOW-MASTER-2026', 'manual', 'master', 'active', true)
ON CONFLICT (code) DO UPDATE SET is_master = true, status = 'active';
