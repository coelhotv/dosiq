-- 20260819_dose_critical_events_occurred_at.test.sql — validação BEGIN..ROLLBACK (R-270 / PO-8)
--
-- Roda ANTES do apply_migration, contra o banco REAL, e desfaz tudo. Um bloco por failure mode —
-- não um smoke de "a coluna existe".
--
-- Uso: colar bloco a bloco via MCP execute_sql (o MCP não mantém sessão entre chamadas, então cada
-- bloco carrega seu próprio BEGIN/ROLLBACK e é autossuficiente).

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 1 — DDL aplica e NENHUMA linha existente é tocada (AC-5.2)
--           A coluna nasce NULL em 100% do passado, e o total por evento não muda.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events ADD COLUMN occurred_at timestamptz;

-- esperado: nulos == total (nada foi preenchido), e total > 0
SELECT count(*)                                        AS total,
       count(*) FILTER (WHERE occurred_at IS NULL)     AS nulos,
       count(*) FILTER (WHERE occurred_at IS NOT NULL) AS preenchidas
  FROM public.dose_critical_events;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 2 — a coluna é NULLABLE e SEM default
--           Failure mode alvo: um DEFAULT now() carimbaria a hora do INSERT e reintroduziria
--           exatamente o erro que a migração elimina — com aparência de dado bom.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events ADD COLUMN occurred_at timestamptz;

-- esperado: is_nullable = YES, column_default = NULL
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'dose_critical_events'
   AND column_name  = 'occurred_at';

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 3 — INSERT do cliente ANTIGO (sem a coluna) continua válido
--           Failure mode alvo: migração aditiva que na prática obriga o payload novo derruba
--           todo binário já publicado. A coluna NÃO pode ser NOT NULL.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events ADD COLUMN occurred_at timestamptz;

INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor, detail)
SELECT user_id, id, 'alarm_fired', 'android', 'system', NULL
  FROM public.dose_instances
 LIMIT 1;

-- esperado: 1 linha, occurred_at NULL (cliente antigo não escreve o campo)
SELECT event, platform, occurred_at
  FROM public.dose_critical_events
 ORDER BY created_at DESC
 LIMIT 1;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 4 — INSERT do cliente NOVO grava occurred_at ANTERIOR a created_at
--           Este é o caso que motivou a coluna: alarme às 12:00, flush às 12:19.
--           Failure mode alvo: um trigger/constraint que exigisse occurred_at >= created_at
--           tornaria a fila offline inexprimível.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events ADD COLUMN occurred_at timestamptz;

INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor, detail, occurred_at)
SELECT user_id, id, 'alarm_fired', 'android', 'system', NULL, now() - interval '20 minutes'
  FROM public.dose_instances
 LIMIT 1;

-- esperado: atraso_segundos ≈ 1200 (20 min), sem erro
SELECT event,
       occurred_at,
       created_at,
       EXTRACT(EPOCH FROM (created_at - occurred_at))::int AS atraso_segundos
  FROM public.dose_critical_events
 ORDER BY created_at DESC
 LIMIT 1;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 5 — grants inalterados (anon SEM escrita — FR-031 / AP-275)
--           Failure mode alvo: ALTER DEFAULT PRIVILEGES devolvendo privilégio a anon sem
--           ninguém pedir. Se anon aparecer com INSERT/UPDATE/DELETE, PARAR a migração.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events ADD COLUMN occurred_at timestamptz;

-- esperado: anon SEM INSERT/UPDATE/DELETE/TRUNCATE; authenticated com SELECT+INSERT
SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privilegios
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'dose_critical_events'
 GROUP BY grantee
 ORDER BY grantee;

ROLLBACK;
