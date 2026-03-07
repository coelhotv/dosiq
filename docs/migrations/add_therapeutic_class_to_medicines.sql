-- Migração: Adicionar coluna therapeutic_class na tabela medicines
-- Descrição: Adiciona o campo opcional therapeutic_class para a feature de interações medicamentosas (F8.2)
-- Criado em: 2026-03-07
-- Status: Pronto para deploy

BEGIN;

-- Adicionar coluna therapeutic_class
ALTER TABLE medicines
ADD COLUMN IF NOT EXISTS therapeutic_class TEXT;

-- Comentário de documentação
COMMENT ON COLUMN medicines.therapeutic_class IS 'Classe terapêutica do medicamento (ex: ANTI-HIPERTENSIVOS). Usado para detectar interações medicamentosas na Fase 8. Preenchido automaticamente via autocomplete ANVISA ou manualmente pelo usuário.';

-- Opcional: Criar índice para consultas de interações medicamentosas (F8.2)
-- Comentado por enquanto, descomentar quando F8.2 for implementada
-- CREATE INDEX IF NOT EXISTS idx_medicines_therapeutic_class
-- ON medicines(user_id, therapeutic_class)
-- WHERE therapeutic_class IS NOT NULL;

COMMIT;
