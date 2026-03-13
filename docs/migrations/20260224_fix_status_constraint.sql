-- Migração: Corrigir constraint de status da tabela gemini_reviews
-- Data: 2026-02-24
-- Problema: Constraint antiga (chk_status) não permite 'detected', 'reported', etc.
-- Solução: Remover constraint antiga e criar nova com valores corretos

-- ============================================================================
-- PASSO 1: Descobrir o nome real da constraint
-- ============================================================================

-- Executar primeiro para descobrir o nome:
-- SELECT conname FROM pg_constraint 
-- WHERE conrelid = 'gemini_reviews'::regclass 
-- AND contype = 'c';

-- ============================================================================
-- PASSO 2: Remover constraint antiga (por qualquer nome)
-- ============================================================================

-- Tentar remover pelo nome padrão
ALTER TABLE gemini_reviews DROP CONSTRAINT IF EXISTS chk_status;

-- Tentar remover pelo nome alternativo
ALTER TABLE gemini_reviews DROP CONSTRAINT IF EXISTS gemini_reviews_status_check;

-- Tentar remover pelo nome da tabela
ALTER TABLE gemini_reviews DROP CONSTRAINT IF EXISTS gemini_reviews_pkey CASCADE;

-- ============================================================================
-- PASSO 3: Adicionar nova constraint com estados expandidos
-- ============================================================================

ALTER TABLE gemini_reviews
  ADD CONSTRAINT gemini_reviews_status_check 
  CHECK (status IN (
    -- Novos estados (workflow inteligente)
    'detected',      -- Detectado pelo Gemini
    'reported',      -- Reportado ao GitHub (issue criada)
    'assigned',      -- Atribuído a agent
    'resolved',      -- Completamente resolvido
    'partial',       -- Parcialmente resolvido
    'wontfix',       -- Ignorado/falso positivo
    'duplicate',     -- Duplicata
    -- Estados legados (para compatibilidade)
    'pendente',
    'em_progresso', 
    'corrigido',
    'descartado'
  ));

-- ============================================================================
-- PASSO 4: Verificar se a constraint foi aplicada
-- ============================================================================

SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'gemini_reviews'::regclass 
AND contype = 'c';

-- ============================================================================
-- PASSO 5: Atualizar registros existentes com status antigo
-- ============================================================================

-- Migrar status antigos para novos
UPDATE gemini_reviews SET status = 'detected' WHERE status = 'pendente';
UPDATE gemini_reviews SET status = 'assigned' WHERE status = 'em_progresso';
UPDATE gemini_reviews SET status = 'resolved' WHERE status = 'corrigido';
UPDATE gemini_reviews SET status = 'wontfix' WHERE status = 'descartado';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar status distintos
SELECT DISTINCT status, COUNT(*) as count 
FROM gemini_reviews 
GROUP BY status 
ORDER BY count DESC;
