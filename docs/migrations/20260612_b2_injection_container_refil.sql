-- 012 Fase B2 (FR-019) — adiciona 'refil' ao enum injection_container.
--
-- Contexto: smoke PO 2026-06-12. O enum original cobria caneta pré-preenchida
-- descartável (GLP-1) mas faltava o REFIL/cartucho de caneta recarregável
-- (comum em insulina — Lantus, NovoRapid). Apenas rótulo de UI; não afeta estoque.
--
-- Sincronizado com INJECTION_CONTAINERS (packages/core/src/schemas/medicineSchema.js)
-- e CHECK medicines_injection_container_check (R-271 — exato).
--
-- Idempotente (DROP IF EXISTS + ADD). 0 linhas afetadas (coluna nullable; valores
-- existentes ⊂ novo conjunto). Aplicar em prod SÓ com autorização explícita do PO.

ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_injection_container_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_injection_container_check
  CHECK (injection_container IS NULL OR injection_container = ANY (
    ARRAY['caneta'::text, 'refil'::text, 'ampola'::text, 'frasco_ampola'::text, 'seringa_preenchida'::text]));
