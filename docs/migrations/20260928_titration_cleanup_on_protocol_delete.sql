-- 20260928_titration_cleanup_on_protocol_delete.sql — spec 090 D-4 · RC3 F3 · CON-032
-- Excluir um tratamento leva junto a escada de titulação que é só dele.
--
-- PROBLEMA (verificado em prod via MCP 2026-09-27/28):
--   titration_steps.protocol_id → protocols ON DELETE SET NULL. `titrations` não tem protocol_id
--   (o vínculo mora nas etapas — AP-311). Excluir o tratamento deixava a escada inteira com
--   protocol_id NULL (uma etapa ainda `current`) ⇒ "Titulação órfã (AP-311)" a cada carga.
--   Trocar a FK para CASCADE não resolve: apagaria as etapas e deixaria `titrations` vazia.
--
-- FIX: trigger BEFORE DELETE em protocols (as etapas ainda apontam p/ OLD.id) que remove as
--   `titrations` do MESMO usuário cujas etapas TODAS apontam para o protocolo excluído. Etapas caem
--   pela FK (titration_id, user_id) CASCADE. Escada que atravessa outro tratamento fica intacta
--   (a FK SET NULL continua valendo p/ ela). + saneamento das órfãs existentes.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                  | Análise / mitigação                                      |
-- |---------------------------------------|----------------------------------------------------------|
-- | Escada multi-protocolo (X e Y)        | NOT EXISTS etapa vinculada a protocolo ≠ OLD.id → intacta. |
-- | Etapa com protocol_id NULL na escada  | IGNORADA: não segura a escada. NULL é estado real — a EDIÇÃO (buildLadderEditPlan,
-- |                                       | run same-med) cria etapa de outro remédio sem vínculo até a confirmação (prod 28/09:
-- |                                       | escada c57e9667, etapa 1 pending_confirmation). Contar o NULL deixaria a escada órfã. |
-- | Protocolo sem titulação               | EXISTS falha → no-op.                                    |
-- | Titulação de outra conta              | t.user_id = OLD.user_id + FK composta (titration_id,user_id). |
-- | Dentro de delete_user_account (definer)| INVOKER roda com o papel do chamador; postgres vê tudo; user_id filtra. |
-- | RLS (app, authenticated)              | INVOKER: DELETE em titrations sob RLS do dono — a pessoa só apaga o que é dela. |
-- | Histórico (R-299)                     | Nada referencia titration_steps; dose_instances não é tocado por este trigger. |
-- | search_path hijack                    | SET search_path = '' + nomes qualificados.               |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Reversível (a função/trigger); o saneamento apaga 1 escada órfã sem tratamento (contagem 28/09: 64af0b38, conta de smoke do PO).
-- Aplicado via Supabase MCP (apply_migration) após dry-run BEGIN..ROLLBACK.

CREATE OR REPLACE FUNCTION public.delete_titrations_of_protocol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  DELETE FROM public.titrations t
   WHERE t.user_id = OLD.user_id
     AND EXISTS (
       SELECT 1 FROM public.titration_steps s
        WHERE s.titration_id = t.id AND s.protocol_id = OLD.id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.titration_steps s
        WHERE s.titration_id = t.id AND s.protocol_id IS NOT NULL AND s.protocol_id <> OLD.id
     );
  RETURN OLD;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_titrations_of_protocol() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_protocols_delete_titrations ON public.protocols;
CREATE TRIGGER trg_protocols_delete_titrations
  BEFORE DELETE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.delete_titrations_of_protocol();

-- Saneamento (FR-007): escadas sem nenhuma etapa vinculada a tratamento.
DELETE FROM public.titrations t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.titration_steps s
    WHERE s.titration_id = t.id AND s.protocol_id IS NOT NULL
 );
