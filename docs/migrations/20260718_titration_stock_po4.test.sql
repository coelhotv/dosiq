-- 20260718_titration_stock_po4.test.sql — 029 Slice F5 (T028 · PO-4)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270 / Constituição I: nenhum dado de produção é
-- alterado — a transação inteira é desfeita). Não deixa rastro.
--
-- O QUE ESTE ARQUIVO PROVA (PO-4): a transição de etapa preserva o estoque da etapa anterior
-- **as-is** (vocabulário do congelamento da 044: nada apagado, nada transferido) e o consumo
-- FIFO passa a correr no medicamento da etapa VIGENTE.
--
-- ⚠️ POR QUE NÃO TEM MOCK: a propriedade sob teste é o efeito COMBINADO de duas coisas que só
-- existem no banco — a RPC `confirm_titration_switch` (que troca o protocol executor) e a RPC
-- `consume_stock_fifo` (que debita por `medicine_id`). Mockar qualquer uma mediria o mock.
-- Nenhum código novo é exercitado aqui de propósito: a tese do T028 é justamente que o
-- roteamento do estoque por etapa cai fora de graça do modelo (o protocol vigente carrega o
-- medicine_id), e um teste é a forma de PROVAR isso em vez de afirmar.
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────────────────────────┐
-- |  # | Caso                                                          | Esperado               |
-- |----|---------------------------------------------------------------|------------------------|
-- |  1 | pré-condição: saldo do medicamento da etapa 1                 | 3 (2 lotes: 1 + 2)     |
-- |  2 | confirm_titration_switch devolve medicine_switch               | true / medicine_switch |
-- |  3 | saldo do medicamento ANTERIOR após a transição                 | 3 — INALTERADO         |
-- |  4 | nenhum lote do anterior foi apagado                            | 2 lotes                |
-- |  5 | nada foi TRANSFERIDO para o medicamento novo                   | saldo novo = 5 (só compra própria) |
-- |  6 | dose pós-transição debita o medicamento da etapa VIGENTE       | novo: 5 → 4            |
-- |  7 | a dose pós-transição NÃO tocou o medicamento anterior          | anterior segue 3       |
-- |  8 | FIFO consumiu o lote mais ANTIGO do medicamento vigente        | lote antigo zerado     |
-- |  9 | dose-only (sem linha em stock): transição não cria movimentação | 0 linhas de estoque    |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

CREATE TABLE public._r (n int, caso text, esperado text, obtido text, passou boolean);
CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
INSERT INTO public._ids (k, v) VALUES
  ('u', gen_random_uuid()),
  ('med_ant', gen_random_uuid()), ('med_novo', gen_random_uuid()), ('med_dose_only', gen_random_uuid()),
  ('proto_ant', gen_random_uuid()), ('proto_do', gen_random_uuid()),
  ('tit', gen_random_uuid()), ('tit_do', gen_random_uuid()),
  ('step_0', gen_random_uuid()), ('step_1', gen_random_uuid()),
  ('step_do_0', gen_random_uuid()), ('step_do_1', gen_random_uuid()),
  ('lote_ant_velho', gen_random_uuid()), ('lote_ant_novo', gen_random_uuid()),
  ('lote_novo_velho', gen_random_uuid()), ('lote_novo_recente', gen_random_uuid()),
  ('log_pos_transicao', gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '-029f5@test.local' FROM public._ids WHERE k = 'u';

INSERT INTO public.medicines (id, user_id, name, dosage_unit, type, presentation) VALUES
  ((SELECT v FROM public._ids WHERE k='med_ant'),  (SELECT v FROM public._ids WHERE k='u'), 'Semaglutida 0,25 mg', 'mg', 'medicamento', 'injetavel'),
  ((SELECT v FROM public._ids WHERE k='med_novo'), (SELECT v FROM public._ids WHERE k='u'), 'Semaglutida 0,5 mg',  'mg', 'medicamento', 'injetavel'),
  ((SELECT v FROM public._ids WHERE k='med_dose_only'), (SELECT v FROM public._ids WHERE k='u'), 'Metoprolol 50 mg', 'mg', 'medicamento', 'comprimido');

-- Executor da etapa 0 (será PAUSADO na troca).
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, intake_unit,
                              frequency, time_schedule, start_date, active)
VALUES ((SELECT v FROM public._ids WHERE k='proto_ant'), (SELECT v FROM public._ids WHERE k='u'),
        (SELECT v FROM public._ids WHERE k='med_ant'), 'GLP', 0.25, 'mg', 'semanal',
        '["22:00"]'::jsonb, current_date - 30, true);

INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, intake_unit,
                              frequency, time_schedule, start_date, active)
VALUES ((SELECT v FROM public._ids WHERE k='proto_do'), (SELECT v FROM public._ids WHERE k='u'),
        (SELECT v FROM public._ids WHERE k='med_dose_only'), 'Metoprolol', 1, NULL, 'diário',
        '["08:00"]'::jsonb, current_date - 30, true);

-- SOBRA na etapa anterior (o cerne do PO-4: o usuário trocou de etapa com caneta pela metade).
-- 2 lotes para provar que nenhum é apagado e que o FIFO tem de fato uma ordem a respeitar.
INSERT INTO public.stock (id, user_id, medicine_id, quantity, original_quantity, purchase_date, entry_type) VALUES
  ((SELECT v FROM public._ids WHERE k='lote_ant_velho'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_ant'), 1, 4, current_date - 60, 'purchase'),
  ((SELECT v FROM public._ids WHERE k='lote_ant_novo'),  (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_ant'), 2, 2, current_date - 10, 'purchase');

-- Estoque do medicamento NOVO (já comprado — o aviso de preparo da timeline levou o usuário a isso).
INSERT INTO public.stock (id, user_id, medicine_id, quantity, original_quantity, purchase_date, entry_type) VALUES
  ((SELECT v FROM public._ids WHERE k='lote_novo_velho'),   (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_novo'), 1, 1, current_date - 20, 'purchase'),
  ((SELECT v FROM public._ids WHERE k='lote_novo_recente'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_novo'), 4, 4, current_date - 1, 'purchase');

INSERT INTO public.titrations (id, user_id) VALUES
  ((SELECT v FROM public._ids WHERE k='tit'),    (SELECT v FROM public._ids WHERE k='u')),
  ((SELECT v FROM public._ids WHERE k='tit_do'), (SELECT v FROM public._ids WHERE k='u'));

INSERT INTO public.titration_steps (id, titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at, protocol_id) VALUES
  ((SELECT v FROM public._ids WHERE k='step_0'), (SELECT v FROM public._ids WHERE k='tit'),
   (SELECT v FROM public._ids WHERE k='u'), 0, (SELECT v FROM public._ids WHERE k='med_ant'),
   0.25, 'mg', 28, 'current', now() - interval '28 days', (SELECT v FROM public._ids WHERE k='proto_ant')),
  ((SELECT v FROM public._ids WHERE k='step_1'), (SELECT v FROM public._ids WHERE k='tit'),
   (SELECT v FROM public._ids WHERE k='u'), 1, (SELECT v FROM public._ids WHERE k='med_novo'),
   0.5, 'mg', 28, 'pending_confirmation', NULL, NULL),
  -- Escada dose-only: mesmo medicamento, sem NENHUMA linha em `stock` (tracking desligado — 044).
  ((SELECT v FROM public._ids WHERE k='step_do_0'), (SELECT v FROM public._ids WHERE k='tit_do'),
   (SELECT v FROM public._ids WHERE k='u'), 0, (SELECT v FROM public._ids WHERE k='med_dose_only'),
   1, 'cp', 28, 'current', now() - interval '28 days', (SELECT v FROM public._ids WHERE k='proto_do')),
  ((SELECT v FROM public._ids WHERE k='step_do_1'), (SELECT v FROM public._ids WHERE k='tit_do'),
   (SELECT v FROM public._ids WHERE k='u'), 1, (SELECT v FROM public._ids WHERE k='med_dose_only'),
   2, 'cp', 28, 'pending_confirmation', NULL, (SELECT v FROM public._ids WHERE k='proto_do'));

CREATE OR REPLACE FUNCTION public._as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
END; $fn$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASO 1 — pré-condição
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r
SELECT 1, 'pré: saldo do medicamento da etapa 1', '3', sum(quantity)::text, sum(quantity) = 3
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_ant');

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASO 2 — a transição
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM public._as_user((SELECT v FROM public._ids WHERE k='u'));
  SET LOCAL ROLE authenticated;
  r := public.confirm_titration_switch((SELECT v FROM public._ids WHERE k='step_1'));
  SET LOCAL ROLE postgres;
  INSERT INTO public._r VALUES (2, 'confirm_titration_switch → medicine_switch',
    'true/medicine_switch',
    (r->>'success') || '/' || coalesce(r->>'transition','-'),
    (r->>'success')::boolean AND r->>'transition' = 'medicine_switch');
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASOS 3-5 — o estoque anterior é CONGELADO, não apagado nem transferido
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r
SELECT 3, 'saldo do medicamento ANTERIOR após a transição (congelado as-is)', '3',
       sum(quantity)::text, sum(quantity) = 3
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_ant');

INSERT INTO public._r
SELECT 4, 'nenhum lote do anterior foi apagado', '2', count(*)::text, count(*) = 2
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_ant');

INSERT INTO public._r
SELECT 5, 'nada transferido p/ o medicamento novo (só a compra própria)', '5',
       sum(quantity)::text, sum(quantity) = 5
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_novo');

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASOS 6-8 — a dose PÓS-transição debita o medicamento da etapa VIGENTE (FIFO)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_med uuid; v_user uuid;
BEGIN
  v_user := (SELECT v FROM public._ids WHERE k='u');
  -- O medicamento vigente NÃO é lido de coluna nova: vem do protocol que a escada ativou.
  -- É exatamente esta indireção que faz o roteamento do estoque cair de graça.
  SELECT p.medicine_id INTO v_med
    FROM public.titration_steps s JOIN public.protocols p ON p.id = s.protocol_id
   WHERE s.id = (SELECT v FROM public._ids WHERE k='step_1');

  -- `consume_stock_fifo` EXIGE `p_medicine_log_id` (RAISE 'medicine_log_id é obrigatório'):
  -- o débito é sempre rastreável até a tomada que o causou. Ordem canônica da casa:
  -- Validar → Registrar → Decrementar estoque.
  INSERT INTO public.medicine_logs (id, user_id, protocol_id, medicine_id, quantity_taken, taken_at)
  VALUES ((SELECT v FROM public._ids WHERE k='log_pos_transicao'), v_user,
          (SELECT s.protocol_id FROM public.titration_steps s
            WHERE s.id = (SELECT v FROM public._ids WHERE k='step_1')),
          v_med, 1, now());

  PERFORM public.consume_stock_fifo(v_user, v_med, 1,
    (SELECT v FROM public._ids WHERE k='log_pos_transicao'));
END $$;

INSERT INTO public._r
SELECT 6, 'dose pós-transição debita o medicamento VIGENTE (5 → 4)', '4',
       sum(quantity)::text, sum(quantity) = 4
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_novo');

INSERT INTO public._r
SELECT 7, 'a dose pós-transição NÃO tocou o medicamento anterior', '3',
       sum(quantity)::text, sum(quantity) = 3
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_ant');

INSERT INTO public._r
SELECT 8, 'FIFO consumiu o lote mais ANTIGO do vigente', '0', quantity::text, quantity = 0
FROM public.stock WHERE id = (SELECT v FROM public._ids WHERE k='lote_novo_velho');

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASO 9 — dose-only (044): sem estoque cadastrado, a transição não inventa movimentação
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM public._as_user((SELECT v FROM public._ids WHERE k='u'));
  SET LOCAL ROLE authenticated;
  r := public.confirm_titration_switch((SELECT v FROM public._ids WHERE k='step_do_1'));
  SET LOCAL ROLE postgres;
END $$;

INSERT INTO public._r
SELECT 9, 'dose-only: transição não cria linha de estoque', '0', count(*)::text, count(*) = 0
FROM public.stock WHERE medicine_id = (SELECT v FROM public._ids WHERE k='med_dose_only');

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n, caso, esperado, obtido, CASE WHEN passou THEN 'PASS' ELSE 'FAIL' END AS resultado
FROM public._r ORDER BY n;

ROLLBACK;
