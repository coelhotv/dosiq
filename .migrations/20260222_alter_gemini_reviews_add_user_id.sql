-- Migração: Adicionar user_id e atualizar enums para português
-- Criação: 2026-02-22
-- Fase: P4.1 - Correções pós-review do Gemini

-- ============================================================================
-- ADICIONAR COLUNA user_id
-- ============================================================================

-- Adicionar coluna user_id para vincular review ao usuário
ALTER TABLE gemini_reviews ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice para user_id
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_user ON gemini_reviews(user_id);

-- ============================================================================
-- ATUALIZAR ENUMS PARA PORTUGUÊS
-- ============================================================================

-- Criar novas colunas temporárias com valores em português
ALTER TABLE gemini_reviews ADD COLUMN IF NOT EXISTS status_pt TEXT;
ALTER TABLE gemini_reviews ADD COLUMN IF NOT EXISTS priority_pt TEXT;
ALTER TABLE gemini_reviews ADD COLUMN IF NOT EXISTS category_pt TEXT;

-- Migrar dados de inglês para português
UPDATE gemini_reviews SET
  status_pt = CASE status
    WHEN 'pending' THEN 'pendente'
    WHEN 'in_progress' THEN 'em_progresso'
    WHEN 'fixed' THEN 'corrigido'
    WHEN 'discarded' THEN 'descartado'
    ELSE status
  END,
  priority_pt = CASE priority
    WHEN 'critical' THEN 'critica'
    WHEN 'high' THEN 'alta'
    WHEN 'medium' THEN 'media'
    WHEN 'low' THEN 'baixa'
    ELSE priority
  END,
  category_pt = CASE category
    WHEN 'style' THEN 'estilo'
    WHEN 'bug' THEN 'bug'
    WHEN 'security' THEN 'seguranca'
    WHEN 'performance' THEN 'performance'
    WHEN 'maintainability' THEN 'manutenibilidade'
    ELSE category
  END;

-- Remover colunas antigas (inglês)
ALTER TABLE gemini_reviews DROP COLUMN IF EXISTS status;
ALTER TABLE gemini_reviews DROP COLUMN IF EXISTS priority;
ALTER TABLE gemini_reviews DROP COLUMN IF EXISTS category;

-- Renomear colunas novas (português)
ALTER TABLE gemini_reviews RENAME COLUMN status_pt TO status;
ALTER TABLE gemini_reviews RENAME COLUMN priority_pt TO priority;
ALTER TABLE gemini_reviews RENAME COLUMN category_pt TO category;

-- Adicionar constraints CHECK com valores em português
ALTER TABLE gemini_reviews ADD CONSTRAINT chk_status CHECK (status IN ('pendente', 'em_progresso', 'corrigido', 'descartado'));
ALTER TABLE gemini_reviews ADD CONSTRAINT chk_priority CHECK (priority IS NULL OR priority IN ('critica', 'alta', 'media', 'baixa'));
ALTER TABLE gemini_reviews ADD CONSTRAINT chk_category CHECK (category IS NULL OR category IN ('estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade'));

-- ============================================================================
-- ATUALIZAR POLÍTICAS RLS (MAIS RESTRITIVAS)
-- ============================================================================

-- Remover políticas antigas (permissivas)
DROP POLICY IF EXISTS "Usuários autenticados podem ver reviews" ON gemini_reviews;
DROP POLICY IF EXISTS "Usuários autenticados podem criar reviews" ON gemini_reviews;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar reviews" ON gemini_reviews;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar reviews" ON gemini_reviews;

-- Nova política: Usuários só podem ver suas próprias reviews
CREATE POLICY "Usuários só podem ver suas próprias reviews"
    ON gemini_reviews FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Nova política: Usuários só podem criar reviews para si mesmos
CREATE POLICY "Usuários só podem criar suas próprias reviews"
    ON gemini_reviews FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Nova política: Usuários só podem atualizar suas próprias reviews
CREATE POLICY "Usuários só podem atualizar suas próprias reviews"
    ON gemini_reviews FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Nova política: Usuários só podem deletar suas próprias reviews
CREATE POLICY "Usuários só podem deletar suas próprias reviews"
    ON gemini_reviews FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- ATUALIZAR COMENTÁRIOS
-- ============================================================================

COMMENT ON COLUMN gemini_reviews.user_id IS 'ID do usuário dono da review';
COMMENT ON COLUMN gemini_reviews.status IS 'Status: pendente, em_progresso, corrigido, descartado';
COMMENT ON COLUMN gemini_reviews.priority IS 'Prioridade: critica, alta, media, baixa';
COMMENT ON COLUMN gemini_reviews.category IS 'Categoria: estilo, bug, seguranca, performance, manutenibilidade';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gemini_reviews'
ORDER BY ordinal_position;
