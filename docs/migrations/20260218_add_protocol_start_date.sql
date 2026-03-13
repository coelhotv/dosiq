-- Migration: Add start_date and end_date columns to protocols table
-- Date: 2026-02-18
-- Purpose: Fix adherence score calculation by tracking protocol start/end dates
-- Related: ADHERENCE_SCORE_FIX_EXECUTION_PLAN.md

-- ATENÇÃO: Execute no Supabase SQL Editor

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- Passo 1: Verificar estrutura atual da tabela protocols
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'protocols'
ORDER BY ordinal_position;

-- Passo 2: Adicionar coluna start_date (inicialmente nullable para migração)
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS start_date DATE;

-- Passo 3: Adicionar coluna end_date (sempre nullable para protocolos ativos)
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS end_date DATE;

-- Passo 4: Migrar dados existentes (copiar created_at para start_date)
UPDATE protocols
SET start_date = DATE(created_at)
WHERE start_date IS NULL;

-- Passo 5: Verificar se todos os registros foram migrados
SELECT
  COUNT(*) as total_protocols,
  COUNT(start_date) as with_start_date,
  COUNT(*) - COUNT(start_date) as missing_start_date
FROM protocols;

-- Passo 6: Tornar start_date NOT NULL após migração
ALTER TABLE protocols ALTER COLUMN start_date SET NOT NULL;

-- Passo 7: Adicionar índice para performance de queries
CREATE INDEX IF NOT EXISTS idx_protocols_start_date ON protocols(start_date);
CREATE INDEX IF NOT EXISTS idx_protocols_end_date ON protocols(end_date) WHERE end_date IS NOT NULL;

-- Passo 8: Adicionar comentários para documentação
COMMENT ON COLUMN protocols.start_date IS 'Data de início do protocolo (obrigatório)';
COMMENT ON COLUMN protocols.end_date IS 'Data de término do protocolo (NULL se ativo)';

-- Passo 9: Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'protocols'
  AND column_name IN ('start_date', 'end_date')
ORDER BY column_name;

-- ============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- ============================================================================
-- Execute os comandos abaixo apenas se precisar reverter a migration:
--
-- -- Remover índices
-- DROP INDEX IF EXISTS idx_protocols_start_date;
-- DROP INDEX IF EXISTS idx_protocols_end_date;
--
-- -- Remover colunas
-- ALTER TABLE protocols DROP COLUMN IF EXISTS start_date;
-- ALTER TABLE protocols DROP COLUMN IF EXISTS end_date;
--
-- -- Verificar estrutura após rollback
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'protocols'
-- ORDER BY ordinal_position;
-- ============================================================================

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 1. Esta migration é parte da Fase 1 do ADHERENCE_SCORE_FIX_EXECUTION_PLAN.md
-- 2. Após executar, atualize o schema Zod em src/schemas/protocolSchema.js
-- 3. O índice em end_date é parcial (WHERE end_date IS NOT NULL) para otimizar
--    consultas de protocolos ativos
-- 4. Execute manualmente no Supabase SQL Editor e verifique cada passo
-- ============================================================================
