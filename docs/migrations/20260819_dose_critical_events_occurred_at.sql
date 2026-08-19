-- 20260819_dose_critical_events_occurred_at.sql — spec 067 Slice C.2 (T060)
--
-- OBJETIVO (Decisão 21 do PO, 2026-08-19): separar QUANDO O FATO ACONTECEU de QUANDO A LINHA
-- ENTROU. Hoje só existe `created_at`, e ele vinha sendo lido como se fosse a hora do disparo —
-- leitura errada nas DUAS plataformas:
--
--   iOS      — não roda JS no disparo (AP-257); `deriveIosAlarmOutcome` deriva o evento no
--              foreground, então `created_at` é a hora em que o APP ABRIU. Mediana +143 min.
--   Android  — o beacon enfileira no headless e só drena no foreground seguinte, então
--              `created_at` é a hora do FLUSH. Medido no smoke do B1: dose 795b701a com alarme às
--              12:00:00 e linha às 12:19:58 — 20 min de erro na plataforma tida como confiável.
--
-- FORMA: coluna NULLABLE. NULL significa "hora do fato desconhecida", que é exatamente o que as
-- linhas legadas são. NÃO usar DEFAULT now(): o default carimbaria a hora do INSERT e reintroduziria
-- silenciosamente o mesmo erro que esta migração existe para eliminar — pior que o NULL, porque
-- pareceria um dado bom.
--
-- ⚠️ NENHUMA LINHA EXISTENTE É REESCRITA (AC-5.2 / FR-017 emendada). As 86 linhas iOS e 75 Android
--    já gravadas ficam com `occurred_at IS NULL`. **A decisão de NÃO migrar é o entregável**, não
--    uma omissão: derivar o instante do passado exigiria inventar um valor a partir do `created_at`
--    — o mesmo dado contaminado —, o que falsificaria fato datado ([[R-299]]) numa trilha clínica.
--    Consulta de série longa usa COALESCE(occurred_at, created_at); a de série precisa,
--    WHERE occurred_at IS NOT NULL. A escolha fica explícita para quem consulta.
--
-- ADITIVA E SEGURA PARA CLIENTE ANTIGO: app não atualizado simplesmente não escreve a coluna
-- (fica NULL). Diferente do REVOKE do B2, esta migração NÃO precisa esperar adoção de loja —
-- pode ser aplicada antes do deploy (plan.md §C).
--
-- Sem CHECK novo em `event` (Decisão 21 §4): nenhum valor de enum é criado, então R-271 não é
-- acionada e não há risco de 23514.

BEGIN;

ALTER TABLE public.dose_critical_events
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz;

COMMENT ON COLUMN public.dose_critical_events.occurred_at IS
  'Instante em que o FATO ocorreu (disparo do alarme, ação da paciente). NULL = hora desconhecida — '
  'linhas legadas e eventos iOS derivados no foreground (AP-257), que carregam captured_at_foreground '
  'no detail. Distinto de created_at, que é quando a LINHA entrou (pode ser a hora do flush da fila '
  'offline). Série longa: COALESCE(occurred_at, created_at). Série precisa: WHERE occurred_at IS NOT NULL. '
  'Spec 067 Slice C, Decisão 21.';

-- Grants: NÃO são reemitidos. Coluna nova em tabela existente herda os grants de tabela já
-- concedidos (o template de `docs/standards/SUPABASE_MIGRATIONS.md` vale para tabela NOVA).
-- O perfil vigente desta tabela é o do 067 A2 (FR-031): authenticated com SELECT+INSERT; anon sem
-- DELETE/UPDATE/TRUNCATE. Conferido no bloco de verificação abaixo — se `anon` reaparecer com
-- privilégio de escrita, é ALTER DEFAULT PRIVILEGES (AP-275) e a migração deve PARAR.

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICAÇÃO (rodar após o COMMIT — colar a saída no C4 / PO-8)
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A coluna existe, é nullable e NÃO tem default:
--
--    SELECT column_name, data_type, is_nullable, column_default
--      FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name   = 'dose_critical_events'
--       AND column_name  = 'occurred_at';
--    -- esperado: timestamp with time zone | YES | NULL
--
-- 2. Nenhuma linha do passado foi tocada nem perdida (guard da PO-8):
--
--    SELECT event, count(*) FROM public.dose_critical_events GROUP BY 1 ORDER BY 1;
--    SELECT count(*) FILTER (WHERE occurred_at IS NULL) AS legadas_sem_instante,
--           count(*)                                    AS total
--      FROM public.dose_critical_events;
--    -- esperado logo após a migração: legadas_sem_instante == total
--
-- 3. Grants inalterados (anon sem escrita — FR-031/AP-275):
--
--    SELECT grantee, privilege_type
--      FROM information_schema.role_table_grants
--     WHERE table_schema = 'public' AND table_name = 'dose_critical_events'
--     ORDER BY grantee, privilege_type;
