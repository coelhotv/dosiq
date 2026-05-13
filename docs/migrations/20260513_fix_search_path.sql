-- Migration: 20260513_fix_search_path
-- Adiciona SET search_path = '' a funções que não definem search_path explícito.
-- Sem isso, um atacante com permissão de criar schemas pode fazer search path injection.
-- Contexto: Supabase Security Advisor lint 0011_function_search_path_mutable.
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. update_updated_at_column (trigger genérico, SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. update_push_subscriptions_updated_at (trigger, SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.update_push_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. update_failed_notif_timestamp (trigger, SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.update_failed_notif_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. cleanup_expired_bot_sessions (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.cleanup_expired_bot_sessions()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.bot_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 5. get_dlq_stats (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.get_dlq_stats()
RETURNS TABLE(status character varying, count bigint, error_category character varying, oldest_failure timestamp with time zone)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.status,
    COUNT(*)::BIGINT,
    f.error_category,
    MIN(f.created_at) AS oldest_failure
  FROM public.failed_notification_queue f
  GROUP BY f.status, f.error_category
  ORDER BY f.status, COUNT(*) DESC;
END;
$$;

-- 6. refresh_stock_summary (no-op, SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.refresh_stock_summary()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN;
END;
$$;

-- 7. batch_update_review_status (SECURITY DEFINER — anon já revogado em T1)
CREATE OR REPLACE FUNCTION public.batch_update_review_status(
  review_ids uuid[],
  new_status text,
  resolution_type text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count INTEGER;
  valid_statuses TEXT[] := ARRAY[
    'detected', 'reported', 'assigned', 'resolved',
    'partial', 'wontfix', 'duplicate',
    'pendente', 'em_progresso', 'corrigido', 'descartado'
  ];
  valid_resolution_types TEXT[] := ARRAY['fixed', 'rejected', 'partial'];
BEGIN
  IF NOT (new_status = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Status inválido: %. Status permitidos: %', new_status, array_to_string(valid_statuses, ', ');
  END IF;

  IF resolution_type IS NOT NULL AND NOT (resolution_type = ANY(valid_resolution_types)) THEN
    RAISE EXCEPTION 'Tipo de resolução inválido: %. Tipos permitidos: %', resolution_type, array_to_string(valid_resolution_types, ', ');
  END IF;

  UPDATE public.gemini_reviews
  SET
    status = new_status,
    resolution_type = COALESCE(resolution_type, public.gemini_reviews.resolution_type),
    updated_at = NOW()
  WHERE id = ANY(review_ids);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 8. migrate_pilot_data (SECURITY DEFINER — anon já revogado em T1)
CREATE OR REPLACE FUNCTION public.migrate_pilot_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid;
  pilot_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  current_user_id := auth.uid();

  IF current_user_id = pilot_id THEN
    RAISE EXCEPTION 'Cannot migrate to pilot ID';
  END IF;

  UPDATE public.medicine_logs SET user_id = current_user_id WHERE user_id = pilot_id;
  UPDATE public.medicines SET user_id = current_user_id WHERE user_id = pilot_id;
  UPDATE public.notification_log SET user_id = current_user_id WHERE user_id = pilot_id;
  UPDATE public.protocols SET user_id = current_user_id WHERE user_id = pilot_id;
  UPDATE public.stock SET user_id = current_user_id WHERE user_id = pilot_id;
  UPDATE public.treatment_plans SET user_id = current_user_id WHERE user_id = pilot_id;
  UPDATE public.bot_sessions SET user_id = current_user_id WHERE user_id = pilot_id;

  IF EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = pilot_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = current_user_id) THEN
      UPDATE public.user_settings SET user_id = current_user_id WHERE user_id = pilot_id;
    ELSE
      DELETE FROM public.user_settings WHERE user_id = current_user_id;
      UPDATE public.user_settings SET user_id = current_user_id WHERE user_id = pilot_id;
    END IF;
  END IF;
END;
$$;
