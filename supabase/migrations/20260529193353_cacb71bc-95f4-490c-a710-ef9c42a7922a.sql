
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS error_message text;

-- Backfill topic from theme for existing rows
UPDATE public.video_jobs SET topic = theme WHERE topic IS NULL AND theme IS NOT NULL;

-- Enable realtime
ALTER TABLE public.video_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.videos REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'video_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
  END IF;
END $$;
