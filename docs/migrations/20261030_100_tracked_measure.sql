-- Spec 100 Slice A — medida acompanhada por tratamento + código da classe CMED (ADR-121, FR-001/FR-003).
--
-- Só DDL: nenhuma linha de usuário é alterada (INV-2). Sem DEFAULT nem backfill de tracked_measure:
--   NULL      = não decidido (legado) ⇒ runtime segue a regra da 069 (semanal → peso)
--   'nenhum'  = desligado pelo usuário
--   medida    = mesmos valores de biomarkers_log.type (espelhados em TRACKED_MEASURES no core)
-- Backfill de therapeutic_class_code é passo separado (FR-011, planilha curada pelo PO).
--
-- Grants: protocols/medicines têm grant de TABELA a authenticated (verificado em prod 2026-10-30);
-- coluna nova herda — nenhum GRANT/REVOKE aqui (docs/standards/SUPABASE_MIGRATIONS.md: não se aplica
-- o REVOKE de tabela nova). Rollback: DROP COLUMN das duas (nenhum dado de usuário até o slice B).

ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS tracked_measure text NULL
  CONSTRAINT protocols_tracked_measure_check
  CHECK (tracked_measure IN ('peso', 'glicemia', 'pressao_arterial', 'nenhum'));

COMMENT ON COLUMN public.protocols.tracked_measure IS
  'Spec 100: medida pedida no ritual da dose e mostrada no detalhe. NULL = não decidido (regra da 069); nenhum = desligado. Só o usuário grava (form mobile).';

-- Formato EphMRA do índice CMED (A10C5, C7A, A8A…): 541 códigos reais, todos 3–5 chars (2026-10-18).
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS therapeutic_class_code text NULL
  CONSTRAINT medicines_therapeutic_class_code_check
  CHECK (therapeutic_class_code ~ '^[A-Z][0-9A-Z]{1,5}$');

COMMENT ON COLUMN public.medicines.therapeutic_class_code IS
  'Spec 100: código da classe terapêutica CMED (CmedRow.c). NULL em cadastro manual/ANVISA antiga.';
