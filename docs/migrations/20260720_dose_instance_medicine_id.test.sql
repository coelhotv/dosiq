-- 20260720_dose_instance_medicine_id.test.sql — 052 Slice A (T007 · PO-1)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270 / Constituição I: nenhum dado de produção é
-- alterado — a transação inteira é desfeita). Não deixa rastro.
--
-- O QUE ESTE ARQUIVO PROVA (PO-1 / AC-1): uma instância criada ANTES da troca de medicamento
-- preserva o medicamento da época depois de `protocols.medicine_id` mudar. É a propriedade que a
-- spec inteira existe para garantir — e que hoje NÃO vale, porque a identidade da dose agendada é
-- resolvida por join na leitura (61% das instâncias em prod dependem 100% dele).
--
-- ⚠️ AS LINHAS DO FIXTURE FORAM EMITIDAS PELO GERADOR REAL, NÃO ESCRITAS À MÃO.
-- Este é o guard do RC3 sobre o PO-1: um INSERT digitado à mão provaria o BANCO (que um UPDATE
-- numa tabela não mexe noutra — o que já sabemos), não o PRODUTO. O payload abaixo é a saída
-- literal de `generateInstances` para um protocolo semanal com escada CROSS-MED (etapa 1 = med A
-- por 28d desde 2026-06-01 → etapa 2 = med B), incluindo o `tolerance_minutes` que o gerador
-- calcula. Note o que ele já prova sozinho: as 4 primeiras ocorrências congelam o med A e as 2
-- posteriores à virada da etapa congelam o med B — dose e medicamento saindo da MESMA etapa.
-- Reproduzir com o script de `plans/specs/052-.../` (local-only) ou re-emitindo via
-- `generateInstances(protocolo, '2026-06-01', '2026-07-12', 'America/Sao_Paulo', steps)`.
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────────────────────────┐
-- |  # | Caso                                                            | Esperado             |
-- |----|-----------------------------------------------------------------|----------------------|
-- |  1 | pré-condição: o gerador congelou 2 medicamentos distintos        | 2 medicamentos       |
-- |  2 | a virada da etapa cai na data certa (med A até 28/06, B em 05/07)| a1 / b2              |
-- |  3 | UPDATE protocols.medicine_id → instância PASSADA intocada        | segue med A          |
-- |  4 | UPDATE protocols.medicine_id → instância FUTURA intocada         | segue med B          |
-- |  5 | nenhuma linha foi reescrita pelo UPDATE (contagem por medicamento)| 4 / 2                |
-- |  6 | o join (comportamento ANTIGO) teria mentido: protocolo != snapshot| divergem             |
-- |  7 | FK ON DELETE CASCADE: apagar o medicine leva as instâncias junto  | 0 linhas             |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

CREATE TABLE public._r (n int, caso text, esperado text, obtido text, passou boolean);

-- Fixture mínimo: usuário, 2 medicamentos, 1 protocolo. `medicines`/`protocols` exigem as
-- colunas NOT NULL do schema real — se alguma faltar, o INSERT falha alto (que é o desejado:
-- fixture que "se ajusta" ao schema esconde deriva).
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'po1-052@test.local', '', now(), now());

INSERT INTO public.medicines (id, user_id, name, type, presentation, dosage_per_pill, dosage_unit)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000002',
   'Mounjaro 2,5', 'medicamento', 'injetavel', 2.5, 'mg'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000002',
   'Mounjaro 5', 'medicamento', 'injetavel', 5, 'mg');

INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, frequency,
                              weekdays, time_schedule, start_date, active)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-0000000000a1', 'GLP-1', 1, 'semanal',
        ARRAY['domingo'], '["08:00"]'::jsonb, '2026-06-01', true);

-- ── Payload LITERAL do gerador (ver aviso acima) ────────────────────────────────────────────
INSERT INTO public.dose_instances
  (user_id, protocol_id, scheduled_for, expected_dose, medicine_id, tolerance_minutes, critical_alarm)
VALUES
  ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2026-06-07T11:00:00.000Z'::timestamptz, 0.25, '00000000-0000-4000-8000-0000000000a1'::uuid, 5040, false),
  ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2026-06-14T11:00:00.000Z'::timestamptz, 0.25, '00000000-0000-4000-8000-0000000000a1'::uuid, 5040, false),
  ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2026-06-21T11:00:00.000Z'::timestamptz, 0.25, '00000000-0000-4000-8000-0000000000a1'::uuid, 5040, false),
  ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2026-06-28T11:00:00.000Z'::timestamptz, 0.25, '00000000-0000-4000-8000-0000000000a1'::uuid, 5040, false),
  ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2026-07-05T11:00:00.000Z'::timestamptz, 0.5, '00000000-0000-4000-8000-0000000000b2'::uuid, 5040, false),
  ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2026-07-12T11:00:00.000Z'::timestamptz, 0.5, '00000000-0000-4000-8000-0000000000b2'::uuid, 5040, false);

-- Caso 1 — o gerador congelou DOIS medicamentos distintos (não replicou o do protocolo).
INSERT INTO public._r
SELECT 1, 'gerador congelou 2 medicamentos distintos', '2', count(DISTINCT medicine_id)::text,
       count(DISTINCT medicine_id) = 2
FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001';

-- Caso 2 — a virada cai na fronteira da etapa (28d desde 01/06 ⇒ 29/06).
INSERT INTO public._r
SELECT 2, 'virada da etapa na data certa (28/06 = A, 05/07 = B)', 'a1|b2',
       (SELECT right(medicine_id::text, 2) FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001' AND scheduled_for = '2026-06-28T11:00:00.000Z') || '|' ||
       (SELECT right(medicine_id::text, 2) FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001' AND scheduled_for = '2026-07-05T11:00:00.000Z'),
       (SELECT right(medicine_id::text, 2) FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001' AND scheduled_for = '2026-06-28T11:00:00.000Z') = 'a1'
   AND (SELECT right(medicine_id::text, 2) FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001' AND scheduled_for = '2026-07-05T11:00:00.000Z') = 'b2';

-- ── O ATO SOB TESTE: o tratamento evolui (medicine_switch / edição manual do medicamento) ────
UPDATE public.protocols
   SET medicine_id = '00000000-0000-4000-8000-0000000000b2'
 WHERE id = '00000000-0000-4000-8000-000000000001';

-- Caso 3 — instância PASSADA: o histórico não é reescrito. É o coração do AC-1.
INSERT INTO public._r
SELECT 3, 'instância passada preserva o medicamento da época', 'a1',
       right(medicine_id::text, 2), right(medicine_id::text, 2) = 'a1'
FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001' AND scheduled_for = '2026-06-07T11:00:00.000Z';

-- Caso 4 — instância FUTURA já materializada também não é tocada pelo UPDATE. (Quem reprojeta o
-- futuro é o wipe+regen do write-path — FR-007 —, nunca uma reescrita silenciosa do banco.)
INSERT INTO public._r
SELECT 4, 'instância futura preserva o snapshot (quem regenera é o FR-007)', 'b2',
       right(medicine_id::text, 2), right(medicine_id::text, 2) = 'b2'
FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001' AND scheduled_for = '2026-07-12T11:00:00.000Z';

-- Caso 5 — contagem por medicamento inalterada: nenhuma linha migrou de medicamento.
INSERT INTO public._r
SELECT 5, 'nenhuma linha reescrita (4 do med A, 2 do med B)', '4|2',
       count(*) FILTER (WHERE right(medicine_id::text, 2) = 'a1')::text || '|' ||
       count(*) FILTER (WHERE right(medicine_id::text, 2) = 'b2')::text,
       count(*) FILTER (WHERE right(medicine_id::text, 2) = 'a1') = 4
   AND count(*) FILTER (WHERE right(medicine_id::text, 2) = 'b2') = 2
FROM public.dose_instances WHERE protocol_id = '00000000-0000-4000-8000-000000000001';

-- Caso 6 — a MENTIRA que o join contava: para a dose de 07/06, o protocolo agora aponta para o
-- medicamento novo. O read-path antigo renderizaria "Mounjaro 5" numa dose que foi Mounjaro 2,5.
-- Este caso é o valor da spec expresso como asserção, não como argumento.
INSERT INTO public._r
SELECT 6, 'join divergiria do snapshot (a falsificação que a 052 mata)', 'divergem',
       CASE WHEN p.medicine_id <> di.medicine_id THEN 'divergem' ELSE 'iguais' END,
       p.medicine_id <> di.medicine_id
FROM public.dose_instances di
JOIN public.protocols p ON p.id = di.protocol_id
WHERE di.protocol_id = '00000000-0000-4000-8000-000000000001' AND di.scheduled_for = '2026-06-07T11:00:00.000Z';

-- Caso 7 — FK ON DELETE CASCADE (decisão do plan §Technical Context): apagar o medicamento não
-- deixa instância órfã apontando para um id inexistente.
DELETE FROM public.medicines WHERE id = '00000000-0000-4000-8000-0000000000a1';
INSERT INTO public._r
SELECT 7, 'ON DELETE CASCADE remove as instâncias do medicamento apagado', '0', count(*)::text, count(*) = 0
FROM public.dose_instances WHERE medicine_id = '00000000-0000-4000-8000-0000000000a1';

-- ── Resultado ────────────────────────────────────────────────────────────────────────────────
SELECT n, caso, esperado, obtido, CASE WHEN passou THEN 'PASS' ELSE 'FAIL' END AS status
FROM public._r ORDER BY n;

SELECT count(*) FILTER (WHERE passou) || '/' || count(*) AS resumo,
       bool_and(passou) AS tudo_verde
FROM public._r;

ROLLBACK;
