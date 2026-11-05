-- Backfill de medicines.therapeutic_class_code (spec 100 FR-011, follow-up 115) — 2026-11-05
--
-- Causa: instalações novas fazem o onboarding no bundle embarcado 0.34.0, antes do OTA
-- [0.34.0+ota.1] aplicar; esse bundle não grava o código de classe vindo da caixa.
-- O 0.34.4 (loja) fecha a causa. Rodar de novo após a adoção do 0.34.4.
--
-- Origem do código: índice CMED (dosiq-moat/data/anvisa/cmedIndex.json), registro ANVISA → coluna `c`,
-- normalizeClassCode — a mesma regra do cadastro pela caixa (cmedMedicine.ts). Cada registro abaixo
-- casou com UMA classe só no índice (ambíguo ficaria fora).
--   112600202 Mounjaro  → A10S
--   117660043 Extensior → A10S
--   102351473 Ozivy     → A10S
--
-- Só linha com código NULL (idempotente; nunca sobrescreve escolha do usuário). Não toca
-- tracked_measure: inferMeasure nunca roda em migração (spec 100 INV-1).

UPDATE public.medicines m
SET therapeutic_class_code = v.code
FROM (VALUES
  ('112600202', 'A10S'),
  ('117660043', 'A10S'),
  ('102351473', 'A10S')
) AS v(registration, code)
WHERE m.anvisa_registration = v.registration
  AND m.therapeutic_class_code IS NULL
RETURNING m.id, m.anvisa_registration, m.therapeutic_class_code;

-- ── Evidência ──────────────────────────────────────────────────────────────────────────────────
-- QA (ikcvwxyohmntncanclze) 2026-11-05, fixture em DO-block desfeito:
--   RESULT OK — NULL preenchido (A10S), código existente intacto (A8A); desfeito
-- Prod (kwqjtdsqkkbebfiaxubb) 2026-11-05: RETURNING 5 linhas, todas A10S
--   (3× 112600202, 1× 117660043, 1× 102351473). Restantes NULL com registro válido: 0.
--   get_admin_growth_analytics → wedge.glp1_antiobesidade 20 usuários / 24 tratamentos.
