-- Migration: Create feedbacks table and RLS policies
-- Created: 2026-06-04

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  comment text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'other')),
  device text,
  app_version text,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can insert own feedbacks" ON public.feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own feedbacks" ON public.feedbacks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Restrição estrita para anon e authenticated (liberando SELECT/INSERT controlados por RLS)
REVOKE ALL ON public.feedbacks FROM anon;
REVOKE ALL ON public.feedbacks FROM authenticated;
GRANT SELECT, INSERT ON public.feedbacks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO service_role;

-- View para estatísticas de feedbacks (calculado no banco de dados para evitar gargalos em memória)
CREATE OR REPLACE VIEW public.feedback_stats AS
SELECT
  coalesce(count(*), 0)::integer AS total_count,
  coalesce(count(*) FILTER (WHERE NOT is_resolved), 0)::integer AS pending_count,
  coalesce(round(avg(rating), 1), 0.0)::numeric AS avg_rating
FROM public.feedbacks;

REVOKE ALL ON public.feedback_stats FROM anon;
REVOKE ALL ON public.feedback_stats FROM authenticated;
GRANT SELECT ON public.feedback_stats TO service_role;

