-- 20260817_dose_instance_early_window.test.sql — validação BEGIN..ROLLBACK (R-270 / PO-SEC-5)
--
-- Roda ANTES do apply_migration, contra o banco REAL, e desfaz tudo. Um teste por failure mode da
-- tabela do preflight — não um smoke de "a coluna existe".
--
-- Uso: colar bloco a bloco via MCP execute_sql (o MCP não mantém sessão entre chamadas, então cada
-- bloco carrega seu próprio BEGIN/ROLLBACK e é autossuficiente).

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 1 — DDL aplica, fast default preenche TODA linha existente, nada fica NULL
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

-- esperado: total > 0, nulos = 0, fora_do_range = 0, distintos = 1 (só o 120 do default)
SELECT count(*)                                                  AS total,
       count(*) FILTER (WHERE early_window_minutes IS NULL)       AS nulos,
       count(*) FILTER (WHERE early_window_minutes NOT BETWEEN 0 AND 120) AS fora_do_range,
       count(DISTINCT early_window_minutes)                       AS distintos
  FROM public.dose_instances;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 2 — CHECK barra piso > 120 (deve levantar 23514)
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

-- esperado: ERROR 23514 dose_instances_early_window_minutes_check
UPDATE public.dose_instances SET early_window_minutes = 999
 WHERE id = (SELECT id FROM public.dose_instances LIMIT 1);

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 3 — CHECK barra piso negativo (deve levantar 23514)
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

-- esperado: ERROR 23514
UPDATE public.dose_instances SET early_window_minutes = -1
 WHERE id = (SELECT id FROM public.dose_instances LIMIT 1);

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 4 — NOT NULL barra piso nulo explícito (deve levantar 23502)
--   Prova que "piso ausente" NÃO é um estado alcançável — é o núcleo da resposta ao RC-SEC/S-5.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;

-- esperado: ERROR 23502 null value in column "early_window_minutes"
UPDATE public.dose_instances SET early_window_minutes = NULL
 WHERE id = (SELECT id FROM public.dose_instances LIMIT 1);

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 5 — piso 0 é ACEITO (documenta o limite conhecido, não é bug)
--   Range 0..120 vem da FR-032. Gap < 4 min produziria piso 0 e desligaria o lado adiantado
--   daquela dose; menor gap real em prod = 285 min. Registrado como risco MEDIUM no plan.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

-- esperado: 1 linha, sem erro
UPDATE public.dose_instances SET early_window_minutes = 0
 WHERE id = (SELECT id FROM public.dose_instances LIMIT 1)
 RETURNING id, early_window_minutes;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 6 — GUARD da PO-13: o DDL não encosta em tolerance_minutes
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE _tol_antes AS
  SELECT id, tolerance_minutes FROM public.dose_instances;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

-- esperado: divergencias = 0
SELECT count(*) AS divergencias
  FROM _tol_antes a
  JOIN public.dose_instances d ON d.id = a.id
 WHERE d.tolerance_minutes IS DISTINCT FROM a.tolerance_minutes;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 7 — ROLLBACK da migração é limpo (drop constraint + drop column)
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_instances
  ADD COLUMN early_window_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

ALTER TABLE public.dose_instances
  DROP CONSTRAINT dose_instances_early_window_minutes_check;
ALTER TABLE public.dose_instances
  DROP COLUMN early_window_minutes;

-- esperado: 0 (coluna sumiu) e 0 (constraint sumiu)
SELECT (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name='dose_instances'
           AND column_name='early_window_minutes') AS coluna_restante,
       (SELECT count(*) FROM pg_constraint
         WHERE conname='dose_instances_early_window_minutes_check') AS constraint_restante;

ROLLBACK;
