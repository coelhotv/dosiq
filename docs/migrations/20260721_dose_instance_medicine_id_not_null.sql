-- 052 Slice B (T017/PO-3) — dose_instances.medicine_id: o cadeado
--
-- POR QUÊ. Passo 4 de 4 do plano da spec (coluna → escrita dual → backfill → gate). Os passos
-- 1-3 tornaram o snapshot CORRETO; este torna o estado errado IRREPRESENTÁVEL. Sem o NOT NULL,
-- um writer novo que esqueça a coluna volta a produzir instância sem identidade — e o sintoma
-- não aparece na escrita, só meses depois, no relatório do médico, como dose atribuída ao
-- medicamento errado. É exatamente a classe do AP-301 (writer esquecido), e o banco é o único
-- lugar onde ela morre por construção em vez de por vigilância.
--
-- PRÉ-CONDIÇÃO (verificada IMEDIATAMENTE antes de aplicar, não uma vez no passado):
--   SELECT count(*) FROM public.dose_instances WHERE medicine_id IS NULL;  -- DEVE ser 0
-- Se der ≠ 0, NÃO aplicar e NÃO "consertar" com UPDATE: toda linha criada depois do backfill
-- de 2026-07-19 nasceu pelo write-path novo, então um NULL é a assinatura de um writer que o
-- inventário do PO-2 não pegou. O UPDATE esconde o writer; a investigação o mata.
--
-- Este ALTER pega ACCESS EXCLUSIVE e varre a tabela para validar. Em 5k linhas é instantâneo;
-- documentado porque o custo cresce com a tabela e a próxima pessoa merece saber.
--
-- Reversível: ALTER TABLE public.dose_instances ALTER COLUMN medicine_id DROP NOT NULL;
--
-- Grants: nenhum objeto novo é criado — ADD/ALTER COLUMN herda as permissões e a RLS da tabela
-- preexistente. O template de docs/standards/SUPABASE_MIGRATIONS.md vale para CREATE TABLE.

ALTER TABLE public.dose_instances
  ALTER COLUMN medicine_id SET NOT NULL;

COMMENT ON COLUMN public.dose_instances.medicine_id IS
  'Identidade CONGELADA do medicamento na materialização da ocorrência (spec 052). Espelha o '
  'congelamento que expected_dose já fazia com a dose. NUNCA resolver a identidade de uma dose '
  'por protocol_id → protocols.medicine_id: o protocolo evolui (medicine_switch da titulação ou '
  'edição do tratamento) e o join reescreveria o passado. Leitura pelo helper canônico '
  'resolveInstanceMedicine (@dosiq/core).';
