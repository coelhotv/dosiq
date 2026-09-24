-- 085 Slice A — migração do protocolo órfão `personalizado` → `diário`
--
-- CONTEXTO. `FREQUENCY_MATCHERS` nunca implementou `personalizado`: o matcher é `() => false`
-- e o protocolo fica sem NENHUMA ocorrência materializada. Medido em 2026-09-19: 1 linha,
-- ativa desde 2026-05-28, com 0 `dose_instances` — a paciente não recebeu um lembrete em
-- 3,5 meses. `weekdays` com os 7 dias É `diário` (decisão do PO, plan §4).
--
-- O CHECK **NÃO** muda: `personalizado` continua aceito pelo banco (FR-003, R-310). O que sai
-- é a OFERTA na UI, no código desta mesma entrega.
--
-- ⚠️ `generated_through` VAI JUNTO, e é o ponto não óbvio (C1.5 §4a). O cron
-- `generateDoseInstances` (server/bot/doseInstanceScheduler.ts:52-60) só varre protocolos com
-- `generated_through IS NULL OR generated_through < now() + 7d`. O órfão está com
-- 2026-09-29 — o gerador CARIMBOU a janela como gerada tendo produzido zero instâncias.
-- Sem zerar o high-water-mark, a linha fica migrada e mesmo assim invisível por ~10 dias.
-- Família AP-308: escrita por SQL cru pula o hook do repositório (`frequency` está em
-- SCHEDULING_FIELDS, que dispararia wipeFuturePending + planWindow pelo app).
-- NULL, e não uma data no passado, porque é o valor que o próprio cron já lê como
-- "nunca gerado". `planWindow` é idempotente (upsert ON CONFLICT DO NOTHING).
--
-- IDEMPOTENTE: o WHERE deixa de casar depois da primeira execução.

-- Evidência ANTES (colar a saída no PR)
SELECT id, name, frequency, weekdays, time_schedule, start_date, end_date, active,
       paused_at, dosage_per_intake, intake_unit, medicine_id, treatment_plan_id,
       generated_through,
       (SELECT count(*) FROM dose_instances di WHERE di.protocol_id = p.id) AS instancias
  FROM protocols p
 WHERE p.frequency = 'personalizado';

-- Migração
UPDATE protocols
   SET frequency = 'diário',
       generated_through = NULL
 WHERE frequency = 'personalizado';

-- Evidência DEPOIS (mesma projeção, agora por id — a linha já não casa por frequency)
SELECT id, name, frequency, weekdays, time_schedule, start_date, end_date, active,
       paused_at, dosage_per_intake, intake_unit, medicine_id, treatment_plan_id,
       generated_through,
       (SELECT count(*) FROM dose_instances di WHERE di.protocol_id = p.id) AS instancias
  FROM protocols p
 WHERE p.id = 'c0063ffc-4e30-478a-a95d-7d5319f38a73';

-- Verificação de saída: zero protocolo ATIVO com frequência de matcher constante (SC-002)
SELECT count(*) AS ativos_personalizado
  FROM protocols
 WHERE frequency = 'personalizado' AND active;
