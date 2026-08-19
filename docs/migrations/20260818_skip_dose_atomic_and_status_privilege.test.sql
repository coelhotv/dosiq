-- 20260818_skip_dose_atomic_and_status_privilege.test.sql — spec 067 Slice B
--
-- Validação por FAILURE MODE em BEGIN..ROLLBACK (R-270). Cada bloco é rodado ISOLADO
-- (o RAISE aborta a transação): rodar bloco a bloco, colar o output no C4.
--
-- Blocos:
--   1. caminho feliz (dentro da janela) — o guard de tudo
--   2. janela: adiantado / vencido / futuro
--   3. posse: instância de outro usuário (PO-SEC-1)
--   4. degenerados: array vazio/NULL, dose já resolvida
--   5. pausa/retomada preserva semântica (não toca passado nem status alheio)
--   6. perfil das funções (PO-SEC-6) + grants de coluna (PO-SEC-2)

-- ═══ Bloco 1 — caminho feliz ══════════════════════════════════════════════════
BEGIN;
  CREATE TEMP TABLE t_ids ON COMMIT DROP AS
    SELECT id, user_id, scheduled_for FROM public.dose_instances WHERE status = 'pending' LIMIT 1;

  UPDATE public.dose_instances SET scheduled_for = now(), tolerance_minutes = 120,
         early_window_minutes = 120
   WHERE id IN (SELECT id FROM t_ids);

  SELECT public.skip_dose_atomic(
    (SELECT user_id FROM t_ids),
    ARRAY(SELECT id FROM t_ids),
    now()
  ) AS esperado_skipped_1;

  SELECT status AS esperado_skipped_user FROM public.dose_instances
   WHERE id IN (SELECT id FROM t_ids);
ROLLBACK;

-- ═══ Bloco 2 — janela ═════════════════════════════════════════════════════════
-- 2a. adiantado além do piso ⇒ 'Fora da janela da dose'
BEGIN;
  CREATE TEMP TABLE t2 ON COMMIT DROP AS
    SELECT id, user_id FROM public.dose_instances WHERE status = 'pending' LIMIT 1;
  UPDATE public.dose_instances SET scheduled_for = now() + interval '200 minutes',
         early_window_minutes = 120, tolerance_minutes = 120
   WHERE id IN (SELECT id FROM t2);
  SELECT public.skip_dose_atomic((SELECT user_id FROM t2), ARRAY(SELECT id FROM t2), now());
ROLLBACK;

-- 2b. vencido além do teto ⇒ 'Fora da janela da dose'
BEGIN;
  CREATE TEMP TABLE t2b ON COMMIT DROP AS
    SELECT id, user_id FROM public.dose_instances WHERE status = 'pending' LIMIT 1;
  UPDATE public.dose_instances SET scheduled_for = now() - interval '200 minutes',
         early_window_minutes = 120, tolerance_minutes = 120
   WHERE id IN (SELECT id FROM t2b);
  SELECT public.skip_dose_atomic((SELECT user_id FROM t2b), ARRAY(SELECT id FROM t2b), now());
ROLLBACK;

-- 2c. instante declarado no futuro ⇒ 'Instante declarado no futuro' (FR-033)
BEGIN;
  CREATE TEMP TABLE t2c ON COMMIT DROP AS
    SELECT id, user_id FROM public.dose_instances WHERE status = 'pending' LIMIT 1;
  SELECT public.skip_dose_atomic((SELECT user_id FROM t2c), ARRAY(SELECT id FROM t2c),
                                 now() + interval '1 hour');
ROLLBACK;

-- ═══ Bloco 3 — posse (PO-SEC-1) ═══════════════════════════════════════════════
-- Instância do usuário B pulada com p_user_id do usuário A, SEM jwt (papel service_role,
-- que é como o bot roda). Tem de levantar mesmo sem `auth.uid()`.
BEGIN;
  CREATE TEMP TABLE t3 ON COMMIT DROP AS
    SELECT di.id, di.user_id FROM public.dose_instances di WHERE di.status = 'pending' LIMIT 1;
  SELECT public.skip_dose_atomic(
    (SELECT user_id FROM public.dose_instances
      WHERE user_id <> (SELECT user_id FROM t3) LIMIT 1),
    ARRAY(SELECT id FROM t3),
    now()
  );
ROLLBACK;

-- Controle: a instância alvo continua `pending` depois da recusa (a txn abortou, nada mudou).
-- `dose_instances` não tem `updated_at` — o controle é o status da própria linha.
SELECT status AS esperado_pending
  FROM public.dose_instances
 WHERE id = (SELECT id FROM public.dose_instances WHERE status = 'pending' LIMIT 1);

-- ═══ Bloco 4 — degenerados ════════════════════════════════════════════════════
-- 4a. array vazio ⇒ 'Nenhuma dose informada para pular'
BEGIN;
  SELECT public.skip_dose_atomic((SELECT user_id FROM public.dose_instances LIMIT 1),
                                 ARRAY[]::uuid[], now());
ROLLBACK;

-- 4b. NULL ⇒ mesma exceção
BEGIN;
  SELECT public.skip_dose_atomic((SELECT user_id FROM public.dose_instances LIMIT 1),
                                 NULL, now());
ROLLBACK;

-- 4c. dose já resolvida ⇒ 'Dose indisponível para pular' (R-305: 0 linhas é FALHA)
BEGIN;
  CREATE TEMP TABLE t4 ON COMMIT DROP AS
    SELECT id, user_id FROM public.dose_instances WHERE status = 'taken' LIMIT 1;
  SELECT public.skip_dose_atomic((SELECT user_id FROM t4), ARRAY(SELECT id FROM t4), now());
ROLLBACK;

-- ═══ Bloco 5 — pausa/retomada (FR-030) ════════════════════════════════════════
BEGIN;
  CREATE TEMP TABLE t5 ON COMMIT DROP AS
    SELECT protocol_id, user_id FROM public.dose_instances
     WHERE status = 'pending' AND scheduled_for > now() LIMIT 1;

  SELECT count(*) FILTER (WHERE status = 'pending' AND scheduled_for > now())  AS futuras_antes,
         count(*) FILTER (WHERE scheduled_for <= now())                        AS passado_antes
    FROM public.dose_instances
   WHERE protocol_id = (SELECT protocol_id FROM t5);

  SELECT public.set_protocol_dose_state_atomic(
    (SELECT user_id FROM t5), (SELECT protocol_id FROM t5), 'pause_all') AS pausou;

  SELECT count(*) FILTER (WHERE status = 'skipped_paused' AND scheduled_for > now()) AS pausadas,
         count(*) FILTER (WHERE scheduled_for <= now() AND status = 'skipped_paused') AS esperado_zero_passado
    FROM public.dose_instances
   WHERE protocol_id = (SELECT protocol_id FROM t5);

  SELECT public.set_protocol_dose_state_atomic(
    (SELECT user_id FROM t5), (SELECT protocol_id FROM t5), 'resume') AS retomou;

  SELECT count(*) FILTER (WHERE status = 'pending' AND scheduled_for > now()) AS futuras_depois
    FROM public.dose_instances
   WHERE protocol_id = (SELECT protocol_id FROM t5);
ROLLBACK;

-- ═══ Bloco 6 — perfil e privilégio ════════════════════════════════════════════
-- 6a. PO-SEC-6: as RPCs novas com o MESMO perfil das existentes
SELECT p.proname, p.prosecdef, p.proconfig, p.proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('skip_dose_atomic', 'set_protocol_dose_state_atomic',
                     'register_dose_atomic', 'update_dose_log_atomic', 'delete_dose_log_atomic')
 ORDER BY p.proname;

-- 6b. PO-SEC-2: `authenticated` sem UPDATE em `status`, com UPDATE nas demais
SELECT column_name, privilege_type
  FROM information_schema.column_privileges
 WHERE table_name = 'dose_instances' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
 ORDER BY column_name;
