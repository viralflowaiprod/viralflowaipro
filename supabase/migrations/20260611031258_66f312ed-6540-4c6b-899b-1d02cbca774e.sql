
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS external_order_id text;

CREATE INDEX IF NOT EXISTS subscriptions_external_order_idx
  ON public.subscriptions (source, external_order_id);

CREATE INDEX IF NOT EXISTS subscriptions_buyer_email_idx
  ON public.subscriptions (buyer_email);
