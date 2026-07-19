-- 052 Slice A (T002) — dose_instances.medicine_id: snapshot de identidade do medicamento
--
-- POR QUÊ. Para o usuário existe UM tratamento que evolui; para o app, cada `medicine_switch`
-- da titulação (029) cria um `protocols` novo. Hoje a identidade do medicamento de uma dose
-- agendada é resolvida por JOIN `protocol_id → protocols.medicine_id` no momento da LEITURA —
-- 61% das instâncias em prod (3.085 de 5.068, medido 2026-07-18) dependem 100% desse join.
-- Logo, mutar `protocols.medicine_id` reescreve o passado: doses de junho que eram Mounjaro
-- 2,5 mg passariam a renderizar como 15 mg. Falsificação clínica no dado que vai ao relatório
-- do médico.
--
-- A tabela já sabia disso pela metade: `expected_dose` EXISTE — alguém já concluiu que a dose
-- varia no tempo e precisa ser congelada na instância. Esta coluna aplica a mesma lógica ao
-- medicamento, que só não variava antes da 029.
--
-- ON DELETE CASCADE (e não RESTRICT/SET NULL): medido em `pg_constraint.confdeltype` — TODAS as
-- FKs → `medicines` já são CASCADE (`protocols`, `medicine_logs`, `stock`, `purchases`,
-- `stock_adjustments`, `stock_consumptions`), exceto `titration_steps` (no action). Apagar um
-- medicine já apaga o protocol em cascata, o que apagaria estas instâncias de qualquer forma —
-- RESTRICT criaria um bloqueio novo redundante com o do titration_steps, e SET NULL conflita
-- com o gate NOT NULL do Slice B (spec §NC1).
--
-- NULLABLE de propósito. Passo 1 de 4 (spec §Cenários de migração): coluna → escrita dual →
-- backfill → gate NOT NULL em migração SEPARADA. Deploy neutro, reversível por DROP COLUMN.
-- O upsert do write-path é `ON CONFLICT DO NOTHING` (createDoseInstanceRepository.ts:51), então
-- linha existente NUNCA ganha a coluna pela escrita — o backfill é o único caminho do legado.
--
-- Grants: `dose_instances` é tabela PREEXISTENTE com grants e RLS já ativos; ADD COLUMN herda
-- as permissões da tabela. O template de grants de docs/standards/SUPABASE_MIGRATIONS.md vale
-- para CREATE TABLE, não se aplica aqui (nenhum objeto novo é criado).

ALTER TABLE public.dose_instances
  ADD COLUMN IF NOT EXISTS medicine_id uuid;

ALTER TABLE public.dose_instances
  DROP CONSTRAINT IF EXISTS dose_instances_medicine_id_fkey;

ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES public.medicines(id) ON DELETE CASCADE;

-- Índice: o read-path canônico do Slice B filtra/agrupa instâncias por medicamento
-- (timeline, aderência, zonas de dose). Sem ele, o cutover troca um JOIN indexado por um
-- seq scan na tabela que mais cresce no schema.
CREATE INDEX IF NOT EXISTS idx_dose_instances_medicine_id
  ON public.dose_instances (medicine_id);

COMMENT ON COLUMN public.dose_instances.medicine_id IS
  '052: snapshot do medicamento vigente em scheduled_for (irmão de expected_dose). Vem do step da escada vigente na data (titration_steps.medicine_id) com fallback em protocols.medicine_id. Nullable até o backfill fechar; SET NOT NULL na migração 2 (Slice B).';
