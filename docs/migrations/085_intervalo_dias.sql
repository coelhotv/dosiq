-- 085 Slice C1 — cadência "a cada N dias" (D-2 / ADR-102). Migração ADITIVA (R-310):
-- os 5 valores existentes seguem aceitos; nenhuma linha muda. Aplicar ANTES do código (FR-013).
-- Idempotente: pode rodar de novo sem efeito.

-- Evidência ANTES
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'protocols_frequency_check';

BEGIN;

ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS interval_days smallint NULL;

ALTER TABLE public.protocols DROP CONSTRAINT IF EXISTS protocols_frequency_check;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_frequency_check CHECK (
  frequency = ANY (ARRAY['diário','dias_alternados','semanal','personalizado','quando_necessário','intervalo_dias']::text[])
);

-- Faixa 2–180 (FR-011): N=1 é `diário`; 180 cobre o trimestral com folga.
ALTER TABLE public.protocols DROP CONSTRAINT IF EXISTS protocols_interval_days_range_check;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_interval_days_range_check CHECK (
  interval_days IS NULL OR interval_days BETWEEN 2 AND 180
);

-- Coerência nos DOIS sentidos: intervalo_dias ⇔ interval_days NOT NULL.
ALTER TABLE public.protocols DROP CONSTRAINT IF EXISTS protocols_interval_days_coherence_check;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_interval_days_coherence_check CHECK (
  (frequency = 'intervalo_dias') = (interval_days IS NOT NULL)
);

COMMENT ON COLUMN public.protocols.interval_days IS
  '085: intervalo em dias da cadência intervalo_dias (2–180), ancorado em start_date. NULL para as demais frequências.';

COMMIT;

-- Evidência DEPOIS
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'public.protocols'::regclass
   AND conname IN ('protocols_frequency_check','protocols_interval_days_range_check','protocols_interval_days_coherence_check');
SELECT frequency, count(*) FROM public.protocols GROUP BY frequency; -- idêntico ao ANTES
