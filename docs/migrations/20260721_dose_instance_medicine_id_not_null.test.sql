-- 20260721_dose_instance_medicine_id_not_null.test.sql — 052 Slice B (T017 · PO-3)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270 / Constituição I): a transação inteira é desfeita,
-- inclusive o próprio ALTER. Roda ANTES de a migração ser aplicada em prod e continua verde
-- depois — é o teste do CADEADO, não do momento em que ele foi instalado.
--
-- O QUE ESTE ARQUIVO PROVA (PO-3 / AC): depois do gate, uma instância sem `medicine_id` é
-- IRREPRESENTÁVEL (erro 23502), e os caminhos de escrita legítimos seguem inserindo. A ordem
-- importa: o caso 1 mede a pré-condição (nenhuma linha órfã) DENTRO da mesma transação, porque
-- um NOT NULL aplicado sobre tabela suja falharia no próprio ALTER — e falhar ali seria um
-- resultado, não um acidente.
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────────────────────────┐
-- |  # | Caso                                                             | Esperado            |
-- |----|------------------------------------------------------------------|---------------------|
-- |  1 | pré-condição: nenhuma linha com medicine_id NULL antes do gate    | 0                   |
-- |  2 | o ALTER SET NOT NULL passa (a tabela está limpa)                  | sem erro            |
-- |  3 | INSERT SEM medicine_id é rejeitado                                | 23502               |
-- |  4 | INSERT COM medicine_id continua funcionando (write-path legítimo) | 1 linha             |
-- |  5 | UPDATE tentando anular a coluna é rejeitado                       | 23502               |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

CREATE TABLE public._r (n int, caso text, esperado text, obtido text, passou boolean);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'po3-052@test.local', '', now(), now());

INSERT INTO public.medicines (id, user_id, name, type, presentation, dosage_per_pill, dosage_unit)
VALUES ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000012',
        'Mounjaro 7,5', 'medicamento', 'injetavel', 7.5, 'mg');

INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, frequency,
                              weekdays, time_schedule, start_date, active)
VALUES ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012',
        '00000000-0000-4000-8000-0000000000c3', 'GLP-1 gate', 1, 'semanal',
        ARRAY['domingo'], '["08:00"]'::jsonb, '2026-07-01', true);

-- ── Caso 1: pré-condição (a mesma query que autoriza a migração em prod) ─────────────────────
INSERT INTO public._r
SELECT 1, 'nenhuma linha com medicine_id NULL antes do gate', '0', count(*)::text, count(*) = 0
FROM public.dose_instances WHERE medicine_id IS NULL;

-- ── Caso 2: o gate ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.dose_instances ALTER COLUMN medicine_id SET NOT NULL;
  INSERT INTO public._r VALUES (2, 'ALTER SET NOT NULL aplica sobre a tabela limpa', 'sem erro', 'sem erro', true);
EXCEPTION WHEN others THEN
  INSERT INTO public._r VALUES (2, 'ALTER SET NOT NULL aplica sobre a tabela limpa', 'sem erro', SQLSTATE, false);
END $$;

-- ── Caso 3: o estado errado deixa de ser representável ──────────────────────────────────────
DO $$
BEGIN
  INSERT INTO public.dose_instances (user_id, protocol_id, scheduled_for, expected_dose, status)
  VALUES ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011',
          now() + interval '1 day', 1, 'pending');
  INSERT INTO public._r VALUES (3, 'INSERT sem medicine_id é rejeitado', '23502', 'aceitou (!)', false);
EXCEPTION WHEN not_null_violation THEN
  INSERT INTO public._r VALUES (3, 'INSERT sem medicine_id é rejeitado', '23502', SQLSTATE, true);
END $$;

-- ── Caso 4: guard — o caminho legítimo não regride ──────────────────────────────────────────
DO $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status)
  VALUES ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011',
          '00000000-0000-4000-8000-0000000000c3', now() + interval '2 days', 1, 'pending');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public._r VALUES (4, 'INSERT com medicine_id continua funcionando', '1', v_count::text, v_count = 1);
EXCEPTION WHEN others THEN
  INSERT INTO public._r VALUES (4, 'INSERT com medicine_id continua funcionando', '1', SQLSTATE, false);
END $$;

-- ── Caso 5: nem por UPDATE ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  UPDATE public.dose_instances SET medicine_id = NULL
  WHERE protocol_id = '00000000-0000-4000-8000-000000000011';
  INSERT INTO public._r VALUES (5, 'UPDATE anulando medicine_id é rejeitado', '23502', 'aceitou (!)', false);
EXCEPTION WHEN not_null_violation THEN
  INSERT INTO public._r VALUES (5, 'UPDATE anulando medicine_id é rejeitado', '23502', SQLSTATE, true);
END $$;

SELECT n, caso, esperado, obtido, passou FROM public._r ORDER BY n;
SELECT count(*) FILTER (WHERE passou) AS ok, count(*) AS total FROM public._r;

ROLLBACK;
