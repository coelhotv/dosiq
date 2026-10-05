-- 20261004_titration_steps_relink.sql — spec 093 (US-2 / FR-003 / PO-3)
--
-- Saneamento ÚNICO e IDEMPOTENTE, só DML: etapa de escada com `protocol_id` NULL recebe o
-- tratamento das IRMÃS da mesma escada — só quando as irmãs vinculadas têm EXATAMENTE um
-- `protocol_id` distinto. Espelha a regra da RPC `confirm_titration_switch` (1ª irmã vinculada).
--
-- Origem: `buildLadderEditPlan` (mobile) manteve a regra "run same-med" (A5) depois do executor
-- único (052 Slice C / ADR-085) e gravava NULL na etapa de outro medicamento. Corrigido no cliente
-- na 0.34.0; builds antigos seguem gravando NULL até a adoção ⇒ reaplicar após a 0.34 (SC-001).
-- Sem schema, sem grant novo (UPDATE em tabela existente, executado como owner).
--
-- ┌─ Failure modes (R-270) ─────────────────────────────────────────────────────────────────────┐
-- | Condição                                        | Comportamento                      | OK   |
-- |-------------------------------------------------|------------------------------------|------|
-- | escada com TODAS as etapas NULL                 | sem irmã vinculada ⇒ não toca      | PASS |
-- | escada com >1 protocol_id distinto              | HAVING count(distinct)=1 ⇒ não toca| PASS |
-- | etapa congelada (current/completed) NULL        | só ganha o vínculo; resto intacto  | PASS (INV-2) |
-- | `col <> x` com NULL (lógica 3 valores)          | filtro é `IS NULL`, não `<>`       | PASS |
-- | reaplicar                                       | 0 linhas (alvo some após 1ª rodada)| PASS |
-- | tratamento excluído                             | FK SET NULL ⇒ vínculo restante é   | PASS |
-- |                                                 | sempre de tratamento existente     |      |
-- | volume (AP-186)                                 | UPDATE set-based, sem SELECT paginado | PASS |
-- └─────────────────────────────────────────────────────────────────────────────────────────────┘

WITH single_owner AS (
  SELECT titration_id, (array_agg(protocol_id ORDER BY position))[1] AS protocol_id
  FROM public.titration_steps
  WHERE protocol_id IS NOT NULL
  GROUP BY titration_id
  HAVING count(DISTINCT protocol_id) = 1
)
UPDATE public.titration_steps s
SET protocol_id = o.protocol_id,
    updated_at = now()
FROM single_owner o
WHERE s.titration_id = o.titration_id
  AND s.protocol_id IS NULL;
