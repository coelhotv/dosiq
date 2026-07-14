-- 20260708_delete_user_account_receipt.sql — 046 Slice A / T001b
-- Pipeline ÚNICO de exclusão de conta + recibo `account_deleted` DENTRO da transação.
--
-- Base: `pg_get_functiondef(public.delete_user_account)` extraído de PROD via MCP em 2026-07-14.
-- A lista de DELETEs abaixo é a de produção, verbatim — não foi "melhorada" de passagem.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- A TOPOLOGIA (e por que ela não é a que as tasks descrevem literalmente)
-- ─────────────────────────────────────────────────────────────────────────────
-- As tasks pedem duas coisas que, escritas ao pé da letra, se contradizem:
--   S2  → `delete_user_account_by_id` deve ter guarda interna "só service_role".
--   AP-227 → `delete_user_account()` continua existindo e vira wrapper que chama `_by_id`.
-- Se o wrapper (chamado pelo TITULAR, role `authenticated`) passar pela guarda de service_role,
-- a exclusão pelo próprio dono quebra.
--
-- Some-se a isso um fato do Postgres que torna a guarda ingênua INÚTIL: dentro de uma função
-- SECURITY DEFINER, `current_user` é sempre o OWNER (postgres) — nunca o chamador. Uma guarda
-- `IF current_user <> 'service_role'` jamais dispararia, nem para um `authenticated` que tivesse
-- recebido EXECUTE por engano. Quem revela o chamador real é `auth.role()` (a role do JWT
-- verificado pelo PostgREST).
--
-- Topologia adotada — TRÊS funções, cada uma com um trabalho:
--   1. `_delete_user_account_core(uuid)`  PRIVADA, sem GRANT para ninguém. Só EXECUTA:
--      recibo + DELETEs + DELETE FROM auth.users. Zero regra de negócio.
--   2. `delete_user_account_by_id(uuid)`  entrada do CONTROLADOR (prune, Slice C).
--      Guarda: `auth.role() = 'service_role'`. Sem `active_treatments_block` (ver S1 abaixo).
--   3. `delete_user_account()`            entrada do TITULAR. Assinatura pública INALTERADA
--      (AP-227 — createProfileRepository.deleteAccount() segue chamando `.rpc('delete_user_account')`).
--      Guarda: auth.uid() + `active_treatments_block`.
-- Pipeline continua ÚNICO: as duas entradas convergem no MESMO core. É isso que a decisão F4
-- protege — a próxima tabela nova entra em um lugar só. **Admin API `deleteUser` está PROIBIDA.**
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- S1 — O BLOQUEIO DE TRATAMENTO ATIVO FOI MOVIDO, NÃO REMOVIDO
-- ─────────────────────────────────────────────────────────────────────────────
-- `active_treatments_block` é regra de UX DO TITULAR ("você tem tratamento em curso, tem certeza?").
-- Ela fica no wrapper. O núcleo NÃO a tem — e isso é deliberado: o alvo típico do prune D+90 É
-- alguém com tratamento ativo (revogou o consentimento e sumiu). Com o bloqueio herdado, o job
-- levantaria a exceção, a conta NUNCA seria apagada, a obrigação legal seria descumprida EM
-- SILÊNCIO — e o job passaria verde. Falha perfeita: todos os testes passam, a lei é violada.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- F6 — O RECIBO
-- ─────────────────────────────────────────────────────────────────────────────
-- Gravado ANTES do `DELETE FROM auth.users`, na MESMA transação. Duas razões, ambas duras:
--   · o `subject_hash` sai do e-mail que vive em auth.users — depois do DELETE não existe mais
--     e-mail nenhum para derivar. É literalmente a última chance de lê-lo.
--   · emitir o evento DEPOIS, na aplicação, abriria a janela "apagou e morreu antes de registrar":
--     conta excluída sem prova de que a exclusão foi executada.
-- `policy_version` do recibo = a do ÚLTIMO evento de consentimento do titular, lida do próprio
-- consent_log. NULL se ele nunca consentiu. Nada de versão hardcoded no SQL — o canônico vive em
-- @dosiq/core e o banco não lê TypeScript.
--
-- O `DELETE FROM auth.users` dispara o `ON DELETE SET NULL` da FK: as linhas do titular no
-- consent_log — INCLUSIVE o recibo recém-gravado — ficam órfãs com `subject_hash` intacto.
-- É esse o estado final desejado (PO-6).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                   |
-- |----------------------------------------|-------------------------------------------------------|
-- | p_user_id NULL                         | RAISE 'not_authenticated' no core (wrapper) / 'user_not_found'. Sem NULL, o `WHERE user_id = NULL` não casaria NADA e a função apagaria auth.users com WHERE id IS NULL = zero linhas: no-op silencioso. Barrado. |
-- | p_user_id inexistente                  | RAISE 'user_not_found'. Sem isso, o recibo seria gravado para um titular que não existe (subject_hash de e-mail NULL → RAISE em consent_subject_hash de qualquer forma). |
-- | Pepper ausente                         | consent_subject_hash faz RAISE → transação inteira aborta → conta NÃO é apagada. Correto: melhor não apagar do que apagar sem recibo. |
-- | Titular que nunca consentiu            | policy_version do recibo = NULL (permitido pelo CHECK: só granted/revoked exigem versão). O recibo sai mesmo assim — a exclusão tem que ser provável independentemente de ter havido consentimento. |
-- | authenticated com EXECUTE forçado em _by_id | Guarda `auth.role() <> 'service_role'` → RAISE 'forbidden'. Defesa em profundidade: um GRANT escorregando numa migração futura não vira IDOR de exclusão de conta em massa. |
-- | Chamada direta como `postgres` no SQL editor | auth.role() é NULL → cai em current_user ('postgres') → 'forbidden'. Para operar manualmente: `SET LOCAL ROLE service_role;`. Intencional. |
-- | Recibo duplicado (dupla chamada)       | Impossível: a 2ª chamada não acha o usuário (RAISE 'user_not_found'). A 1ª já apagou auth.users. |
-- | Ordem DELETE vs recibo                 | Recibo PRIMEIRO (FK ainda válida, user_id preenchido), DELETEs depois. Invertido, o insert violaria a FK. |
-- | Tabelas fora da lista de DELETE        | Cobertas por FK ON DELETE CASCADE p/ auth.users (verificado em prod: biomarkers_log, feedbacks, notification_outbox, dose_* [T000], push_*, notification_*, stock_*, purchases, bot_sessions). As SEM FK (medicines, protocols, treatment_plans, stock, medicine_logs, user_settings) são as que aparecem explicitamente abaixo. |
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. _delete_user_account_core(uuid) — PRIVADA. Executa, não decide.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._delete_user_account_core(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email          text;
  v_policy_version text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  -- Última chance de ler o e-mail: daqui a algumas linhas ele não existe mais.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Versão do último ato de consentimento do titular (NULL se nunca consentiu).
  SELECT c.policy_version INTO v_policy_version
  FROM public.consent_log c
  WHERE c.user_id = p_user_id
    AND c.action IN ('granted', 'revoked')
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- O RECIBO. `consent_type = 'health_data'`: é o tratamento cuja cessação está sendo provada.
  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (
    p_user_id,
    public.consent_subject_hash(v_email),
    'health_data',
    'account_deleted',
    v_policy_version,
    'server'
  );

  -- Lista de prod, verbatim (tabelas sem FK p/ auth.users + as que já cascateiam; idempotente).
  DELETE FROM public.stock_consumptions        WHERE user_id = p_user_id;
  DELETE FROM public.stock_adjustments         WHERE user_id = p_user_id;
  DELETE FROM public.medicine_logs             WHERE user_id = p_user_id;
  DELETE FROM public.stock                     WHERE user_id = p_user_id;
  DELETE FROM public.purchases                 WHERE user_id = p_user_id;
  DELETE FROM public.failed_notification_queue WHERE user_id = p_user_id;
  DELETE FROM public.notification_log          WHERE user_id = p_user_id;
  DELETE FROM public.notification_devices      WHERE user_id = p_user_id;
  DELETE FROM public.push_notification_logs    WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions        WHERE user_id = p_user_id;
  DELETE FROM public.bot_sessions              WHERE user_id = p_user_id;
  DELETE FROM public.protocols                 WHERE user_id = p_user_id;
  DELETE FROM public.treatment_plans           WHERE user_id = p_user_id;
  DELETE FROM public.medicines                 WHERE user_id = p_user_id;
  DELETE FROM public.gemini_reviews            WHERE user_id = p_user_id;
  DELETE FROM public.user_settings             WHERE user_id = p_user_id;

  -- Dispara o CASCADE das demais tabelas E o SET NULL do consent_log (a trilha fica órfã, viva).
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Ninguém chama o core diretamente. As duas entradas abaixo são DEFINER owned por postgres e
-- alcançam-no pelo privilégio do OWNER — não precisam de GRANT.
REVOKE ALL ON FUNCTION public._delete_user_account_core(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_user_account_core(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._delete_user_account_core(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._delete_user_account_core(uuid) FROM service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. delete_user_account_by_id(uuid) — entrada do CONTROLADOR (prune D+90, Slice C)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_account_by_id(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- auth.role() = role do JWT verificado. `current_user` NÃO serve: dentro de uma DEFINER ele é
  -- sempre o owner. O coalesce cobre a chamada sem JWT (psql/cron com `SET LOCAL ROLE`).
  v_caller text := coalesce(auth.role(), current_user::text);
BEGIN
  IF v_caller <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Sem `active_treatments_block` DE PROPÓSITO (S1). Ver cabeçalho.
  PERFORM public._delete_user_account_core(p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. delete_user_account() — entrada do TITULAR. Assinatura inalterada (AP-227).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid          uuid := auth.uid();
  active_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Regra de UX do titular — vive AQUI, e só aqui (S1). O botão in-app segue bloqueando.
  SELECT count(*) INTO active_count
  FROM public.protocols
  WHERE user_id = uid
    AND active = true
    AND (end_date IS NULL OR end_date >= current_date);

  IF active_count > 0 THEN
    RAISE EXCEPTION 'active_treatments_block'
      USING DETAIL = active_count::text;
  END IF;

  PERFORM public._delete_user_account_core(uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
