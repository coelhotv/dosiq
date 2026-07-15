-- 20260715_consent_policy_v03.sql — spec 046, T019b.
--
-- Bump da política de privacidade para a versão 0.3 (publicação da política + termos completos
-- em HTML). É o interruptor do gate: a partir daqui os RPCs `consent_grant`/`consent_revoke`
-- carimbam '0.3' no `consent_log`, e a constante `CURRENT_POLICY_VERSION` (@dosiq/core) + os dois
-- HTMLs em apps/web/public/ passam a bater exatamente com este valor. Divergiu → trilha
-- inauditável (ver cabeçalho de consentSchema.ts).
--
-- Idempotente: a linha única (id=1) já existe desde 20260708_consent_log.sql.

UPDATE public.consent_policy
SET version = '0.3', updated_at = now()
WHERE id = 1 AND version <> '0.3';
