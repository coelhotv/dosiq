-- 20260616_drop_biomarker_context_check.sql
-- Spec 032 (biomarker-pa) · ADR-070
--
-- `context` de biomarkers_log é DOMÍNIO EXTENSÍVEL (como type/source — ADR-060), não finito.
-- Cada família de biomarcador tem contextos próprios (glicemia: jejum/pós-refeição; PA:
-- em repouso/após exercício/após medicação; futuras famílias: outros). Travar com CHECK = uma
-- migração por família p/ sempre — a fricção que ADR-060 quis matar.
--
-- `context` NÃO é consumida por match exato em RPC/trigger (é label de display). Por isso o
-- CHECK não protege nenhuma lógica — só cobra migrações. Carve-out legítimo de R-271/R-082:
-- sem CHECK, o Zod (enums no core) vira autoridade única, igual a type/source.
--
-- Esta é a ÚLTIMA migração sobre `context`. Remover só AFROUXA: valores legados continuam válidos
-- (nenhuma migração de dados necessária).

ALTER TABLE public.biomarkers_log DROP CONSTRAINT IF EXISTS biomarkers_log_context_check;
