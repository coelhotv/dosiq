-- 20260715_titrations.test.sql — 029 Slice F1 (T004 / PO-SEC-1)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270). Não deixa rastro.
-- Auto-contido: aplica a migração DENTRO da transação (DDL é transacional no Postgres),
-- ataca, prova, e desfaz tudo. Rodar ANTES de aplicar em prod.
--
-- ┌─ PO-SEC-1 — titrations/titration_steps inacessíveis a anon e a outro usuário ──────────────┐
-- | #  | Caso                                                             | Esperado             |
-- |----|------------------------------------------------------------------|----------------------|
-- |  1 | anon: SELECT titrations                                          | permission denied    |
-- |  2 | anon: SELECT titration_steps                                     | permission denied    |
-- |  3 | anon: INSERT titrations                                          | permission denied    |
-- |  4 | has_table_privilege('anon','titrations','SELECT')                | false                |
-- |  5 | has_table_privilege('anon','titration_steps','SELECT')           | false                |
-- |  6 | authenticated(B): SELECT escada do user A (cross-user)           | 0 linhas (RLS)       |
-- |  7 | authenticated(B): SELECT step do user A (cross-user)             | 0 linhas (RLS)       |
-- |  8 | authenticated(B): UPDATE escada do user A                        | 0 linhas afetadas    |
-- |  9 | authenticated(B): INSERT step com user_id de A (spoof)          | RLS viola (erro)     |
-- | 10 | POSITIVO: dono (A) cria escada + etapa e as lê de volta          | linhas OK            |
-- | 11 | RLS habilitada nas 2 tabelas                                     | relrowsecurity=true  |
-- | 12 | CHECK intake_unit rejeita valor fora do domínio                  | erro (23514)         |
-- | 13 | CHECK dose > 0 rejeita dose = 0                                  | erro (23514)         |
-- | 14 | UNIQUE(titration_id, position) rejeita posição duplicada        | erro (23505)         |
-- | 15 | duration_days NULL aceito (etapa contínua)                      | insere OK            |
-- | 16 | GUARD: exclusão da conta (auth.users) leva escada+etapas junto   | 0 linhas (CASCADE)   |
-- └───────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0 — a migração (idêntica ao arquivo; DDL é transacional)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.titrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL,
  migrated_from_protocol_id uuid REFERENCES public.protocols(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_titrations_user ON public.titrations (user_id);
CREATE INDEX IF NOT EXISTS idx_titrations_treatment_plan ON public.titrations (treatment_plan_id);
ALTER TABLE public.titrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS titrations_select_own ON public.titrations;
CREATE POLICY titrations_select_own ON public.titrations FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS titrations_insert_own ON public.titrations;
CREATE POLICY titrations_insert_own ON public.titrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titrations_update_own ON public.titrations;
CREATE POLICY titrations_update_own ON public.titrations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titrations_delete_own ON public.titrations;
CREATE POLICY titrations_delete_own ON public.titrations FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.titrations FROM PUBLIC;
REVOKE ALL ON public.titrations FROM anon;
REVOKE ALL ON public.titrations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titrations TO service_role;

CREATE TABLE IF NOT EXISTS public.titration_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titration_id uuid NOT NULL REFERENCES public.titrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  dose numeric NOT NULL CHECK (dose > 0),
  intake_unit text NOT NULL CHECK (intake_unit IN ('gotas','ml','UI','mg','cp')),
  duration_days integer CHECK (duration_days IS NULL OR duration_days > 0),
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','current','pending_confirmation','completed')),
  protocol_id uuid REFERENCES public.protocols(id) ON DELETE SET NULL,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT titration_steps_position_unique UNIQUE (titration_id, position)
);
CREATE INDEX IF NOT EXISTS idx_titration_steps_titration ON public.titration_steps (titration_id, position);
CREATE INDEX IF NOT EXISTS idx_titration_steps_user ON public.titration_steps (user_id);
CREATE INDEX IF NOT EXISTS idx_titration_steps_protocol ON public.titration_steps (protocol_id);
ALTER TABLE public.titration_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS titration_steps_select_own ON public.titration_steps;
CREATE POLICY titration_steps_select_own ON public.titration_steps FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS titration_steps_insert_own ON public.titration_steps;
CREATE POLICY titration_steps_insert_own ON public.titration_steps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titration_steps_update_own ON public.titration_steps;
CREATE POLICY titration_steps_update_own ON public.titration_steps FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titration_steps_delete_own ON public.titration_steps;
CREATE POLICY titration_steps_delete_own ON public.titration_steps FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.titration_steps FROM PUBLIC;
REVOKE ALL ON public.titration_steps FROM anon;
REVOKE ALL ON public.titration_steps FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titration_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titration_steps TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — fixtures
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public._r (n int, caso text, esperado text, obtido text, ok boolean);
GRANT ALL ON public._r TO authenticated, anon, service_role;

CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON public._ids TO authenticated, anon, service_role;
INSERT INTO public._ids (k, v) VALUES
  ('u_a', gen_random_uuid()),   -- dono da escada
  ('u_b', gen_random_uuid()),   -- atacante cross-user
  ('med_a', gen_random_uuid()),
  ('tit_a', gen_random_uuid()),
  ('step_a', gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '-029@test.local' FROM public._ids WHERE k IN ('u_a','u_b');

INSERT INTO public.medicines (id, user_id, name, dosage_unit, type)
  VALUES ((SELECT v FROM public._ids WHERE k='med_a'), (SELECT v FROM public._ids WHERE k='u_a'),
          'Semaglutida F1', 'mg', 'injetavel');

CREATE OR REPLACE FUNCTION public._as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
END; $fn$;
GRANT EXECUTE ON FUNCTION public._as_user(uuid) TO authenticated, anon, service_role;

-- Escada + etapa do dono A (via service_role, bypassa RLS — simula seed; a leitura é que testamos).
INSERT INTO public.titrations (id, user_id) VALUES
  ((SELECT v FROM public._ids WHERE k='tit_a'), (SELECT v FROM public._ids WHERE k='u_a'));
INSERT INTO public.titration_steps (id, titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status)
  VALUES ((SELECT v FROM public._ids WHERE k='step_a'), (SELECT v FROM public._ids WHERE k='tit_a'),
          (SELECT v FROM public._ids WHERE k='u_a'), 0, (SELECT v FROM public._ids WHERE k='med_a'),
          0.25, 'mg', 28, 'current');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — grants estáticos (4/5) e RLS habilitada (11)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r VALUES (4,'has_table_privilege(anon, titrations, SELECT)','false',
  has_table_privilege('anon','public.titrations','SELECT')::text,
  has_table_privilege('anon','public.titrations','SELECT') = false);
INSERT INTO public._r VALUES (5,'has_table_privilege(anon, titration_steps, SELECT)','false',
  has_table_privilege('anon','public.titration_steps','SELECT')::text,
  has_table_privilege('anon','public.titration_steps','SELECT') = false);
INSERT INTO public._r
SELECT 11,'RLS habilitada nas 2 tabelas','ambas true',
  string_agg(relname||'='||relrowsecurity::text, ', '),
  bool_and(relrowsecurity)
FROM pg_class WHERE relname IN ('titrations','titration_steps') AND relnamespace = 'public'::regnamespace;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — anon (1/2/3)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
SET LOCAL ROLE anon;
DO $$
DECLARE v_cnt int;
BEGIN
  BEGIN
    SELECT count(*) INTO v_cnt FROM public.titrations;
    INSERT INTO public._r VALUES (1,'anon: SELECT titrations','permission denied',v_cnt||' linha(s)',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (1,'anon: SELECT titrations','permission denied',SQLERRM,SQLSTATE='42501');
  END;
  BEGIN
    SELECT count(*) INTO v_cnt FROM public.titration_steps;
    INSERT INTO public._r VALUES (2,'anon: SELECT titration_steps','permission denied',v_cnt||' linha(s)',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (2,'anon: SELECT titration_steps','permission denied',SQLERRM,SQLSTATE='42501');
  END;
  BEGIN
    INSERT INTO public.titrations (user_id) VALUES (gen_random_uuid());
    INSERT INTO public._r VALUES (3,'anon: INSERT titrations','permission denied','INSERT PASSOU',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (3,'anon: INSERT titrations','permission denied',SQLERRM,SQLSTATE='42501');
  END;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — cross-user: B ataca a escada de A (6/7/8/9)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_b'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_cnt int; v_uid_a uuid := (SELECT v FROM public._ids WHERE k='u_a');
        v_tit_a uuid := (SELECT v FROM public._ids WHERE k='tit_a');
BEGIN
  SELECT count(*) INTO v_cnt FROM public.titrations WHERE id = v_tit_a;
  INSERT INTO public._r VALUES (6,'authenticated(B): SELECT escada de A','0 linhas',v_cnt||' linha(s)', v_cnt = 0);

  SELECT count(*) INTO v_cnt FROM public.titration_steps WHERE titration_id = v_tit_a;
  INSERT INTO public._r VALUES (7,'authenticated(B): SELECT step de A','0 linhas',v_cnt||' linha(s)', v_cnt = 0);

  WITH upd AS (UPDATE public.titrations SET updated_at = now() WHERE id = v_tit_a RETURNING 1)
  SELECT count(*) INTO v_cnt FROM upd;
  INSERT INTO public._r VALUES (8,'authenticated(B): UPDATE escada de A','0 linhas afetadas',v_cnt||' linha(s)', v_cnt = 0);

  BEGIN
    INSERT INTO public.titrations (user_id) VALUES (v_uid_a);  -- spoof: escada em nome de A
    INSERT INTO public._r VALUES (9,'authenticated(B): INSERT escada com user_id de A','RLS viola','INSERT PASSOU — spoof',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (9,'authenticated(B): INSERT escada com user_id de A','RLS viola',SQLERRM,true);
  END;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5 — dono A: caminho positivo (10) + CHECKs (12/13/14/15)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_cnt int; v_uid_a uuid := (SELECT v FROM public._ids WHERE k='u_a');
        v_tit_a uuid := (SELECT v FROM public._ids WHERE k='tit_a');
        v_med_a uuid := (SELECT v FROM public._ids WHERE k='med_a');
BEGIN
  -- 10. dono lê a própria escada + etapa
  SELECT count(*) INTO v_cnt FROM public.titrations t
   JOIN public.titration_steps s ON s.titration_id = t.id
   WHERE t.id = v_tit_a;
  INSERT INTO public._r VALUES (10,'POSITIVO: dono A lê própria escada+etapa','1 linha',v_cnt||' linha(s)', v_cnt = 1);

  -- 12. intake_unit fora do domínio
  BEGIN
    INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit)
    VALUES (v_tit_a, v_uid_a, 90, v_med_a, 1, 'comprimido');
    INSERT INTO public._r VALUES (12,'CHECK intake_unit rejeita valor fora do domínio','erro 23514','ACEITOU',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (12,'CHECK intake_unit rejeita valor fora do domínio','erro 23514',SQLERRM,SQLSTATE='23514');
  END;

  -- 13. dose = 0
  BEGIN
    INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit)
    VALUES (v_tit_a, v_uid_a, 91, v_med_a, 0, 'mg');
    INSERT INTO public._r VALUES (13,'CHECK dose > 0 rejeita dose = 0','erro 23514','ACEITOU',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (13,'CHECK dose > 0 rejeita dose = 0','erro 23514',SQLERRM,SQLSTATE='23514');
  END;

  -- 14. position duplicada (já existe position 0 na escada A)
  BEGIN
    INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit)
    VALUES (v_tit_a, v_uid_a, 0, v_med_a, 0.5, 'mg');
    INSERT INTO public._r VALUES (14,'UNIQUE(titration_id, position) rejeita duplicata','erro 23505','ACEITOU',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (14,'UNIQUE(titration_id, position) rejeita duplicata','erro 23505',SQLERRM,SQLSTATE='23505');
  END;

  -- 15. duration_days NULL = etapa contínua
  BEGIN
    INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days)
    VALUES (v_tit_a, v_uid_a, 2, v_med_a, 1, 'mg', NULL);
    INSERT INTO public._r VALUES (15,'duration_days NULL (etapa contínua)','insere OK','inseriu',true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (15,'duration_days NULL (etapa contínua)','insere OK',SQLERRM,false);
  END;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 6 — GUARD: exclusão de conta leva escada + etapas (16, AP-272 / R-287)
-- ═══════════════════════════════════════════════════════════════════════════════
DELETE FROM auth.users WHERE id = (SELECT v FROM public._ids WHERE k='u_a');
INSERT INTO public._r
SELECT 16,'CASCADE: excluir auth.users(A) apaga escada+etapas','0 linhas',
       (SELECT count(*) FROM public.titrations WHERE user_id = (SELECT v FROM public._ids WHERE k='u_a'))
       || ' escada(s) + '
       || (SELECT count(*) FROM public.titration_steps WHERE user_id = (SELECT v FROM public._ids WHERE k='u_a'))
       || ' etapa(s)',
       (SELECT count(*) FROM public.titrations WHERE user_id = (SELECT v FROM public._ids WHERE k='u_a')) = 0
       AND (SELECT count(*) FROM public.titration_steps WHERE user_id = (SELECT v FROM public._ids WHERE k='u_a')) = 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n,
       CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r,
       caso, esperado, obtido
FROM public._r ORDER BY n;

ROLLBACK;
