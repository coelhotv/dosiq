-- 20261013_medicines_anvisa_registration.sql — spec 066 Slice C · M1a · D7/D11
-- Registro ANVISA (9 dígitos, REGISTRO[:9] da CMED) do medicamento de marca escolhido pela
-- caixa no passo 2 da busca 2C. Genérico grava NULL: o registro é por fabricante (D11).
--
-- Verificado em prod via MCP (2026-10-13): coluna inexistente; grants de `medicines` são de
-- TABELA (anon/authenticated/service_role) ⇒ a coluna nova herda, sem GRANT próprio. Sem
-- função nova ⇒ sem SECURITY DEFINER. RLS existente cobre a linha inteira.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                         | Análise / mitigação                                          |
-- |------------------------------|--------------------------------------------------------------|
-- | Linhas existentes            | Coluna nullable, sem DEFAULT ⇒ NULL; CHECK aceita NULL. PASS |
-- | Valor da fonte fora do formato| Índice CMED 1.1.12: 26.580/26.580 com `^[0-9]{9}$`. PASS     |
-- | '' vindo do form             | CHECK rejeita ('' ≠ 9 dígitos, 23514); o app só envia o valor do rascunho ou NULL. PASS |
-- | Cliente antigo (sem o campo) | Insert/update sem a coluna ⇒ NULL / inalterado. PASS          |
-- | Leitor com select('*')       | Recebe a chave nova; consumidores ignoram campo extra. PASS   |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Reversível: ALTER TABLE public.medicines DROP COLUMN anvisa_registration;
-- Aplicado via Supabase MCP (apply_migration).

ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS anvisa_registration text NULL;

ALTER TABLE public.medicines
  ADD CONSTRAINT medicines_anvisa_registration_check
  CHECK (anvisa_registration IS NULL OR anvisa_registration ~ '^[0-9]{9}$');

COMMENT ON COLUMN public.medicines.anvisa_registration IS
  'REGISTRO[:9] da CMED da caixa escolhida (marca). NULL em genérico (D11) e em cadastro manual. Spec 066.';
