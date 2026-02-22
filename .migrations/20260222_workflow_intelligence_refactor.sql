-- .migrations/20260222_workflow_intelligence_refactor.sql
-- ============================================
-- Workflow Intelligence Refactor Migration
-- Versão: 2.0.0
-- Data: 2026-02-22
-- Autor: Architect
-- ============================================

-- ============================================
-- PARTE 1: Backup dos dados existentes
-- ============================================

-- Criar tabela de backup
CREATE TABLE IF NOT EXISTS gemini_reviews_backup_20260222 AS 
SELECT * FROM gemini_reviews;

-- Registrar quantidade de registros
DO $$
DECLARE
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM gemini_reviews_backup_20260222;
  RAISE NOTICE 'Backup criado com % registros', backup_count;
END $$;

-- ============================================
-- PARTE 2: Adicionar novos campos
-- ============================================

-- Adicionar issue_hash com UNIQUE constraint
ALTER TABLE gemini_reviews
  ADD COLUMN IF NOT EXISTS issue_hash TEXT,
  ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Criar UNIQUE constraint no hash (após popular dados)
-- Nota: Só pode ser aplicado se não houver duplicatas
-- ALTER TABLE gemini_reviews ADD CONSTRAINT unique_issue_hash UNIQUE (issue_hash);

-- ============================================
-- PARTE 3: Migrar dados existentes
-- ============================================

-- Atualizar registros existentes com hash baseado nos dados
-- Isso precisa ser feito via script Node.js para calcular SHA-256
-- O script scripts/migrate-hashes.cjs deve ser executado

-- Comentário para documentação
COMMENT ON COLUMN gemini_reviews.issue_hash IS 
  'SHA-256 hash do conteúdo da issue para deduplicação determinística';

COMMENT ON COLUMN gemini_reviews.github_issue_number IS 
  'Número da issue correspondente no GitHub';

COMMENT ON COLUMN gemini_reviews.resolution_type IS 
  'Tipo de resolução: fixed, rejected, partial';

COMMENT ON COLUMN gemini_reviews.resolved_by IS 
  'UUID do agent ou usuário que resolveu';

COMMENT ON COLUMN gemini_reviews.resolved_at IS 
  'Timestamp de resolução';

-- ============================================
-- PARTE 4: Atualizar CHECK constraint de status
-- ============================================

-- Remover constraint antiga (se existir)
ALTER TABLE gemini_reviews 
  DROP CONSTRAINT IF EXISTS gemini_reviews_status_check;

-- Adicionar nova constraint com estados expandidos
ALTER TABLE gemini_reviews
  ADD CONSTRAINT gemini_reviews_status_check 
  CHECK (status IN (
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

-- ============================================
-- PARTE 5: Criar índices de performance
-- ============================================

-- Índice para busca por hash (único após migração)
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_issue_hash 
  ON gemini_reviews(issue_hash);

-- Índice para busca por issue do GitHub
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_github_issue 
  ON gemini_reviews(github_issue_number) 
  WHERE github_issue_number IS NOT NULL;

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_status 
  ON gemini_reviews(status);

-- Índice composto para queries do workflow
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr_status 
  ON gemini_reviews(pr_number, status) 
  WHERE status IN ('detected', 'reported');

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_created 
  ON gemini_reviews(created_at DESC);

-- ============================================
-- PARTE 6: Atualizar RLS policies
-- ============================================

-- Garantir RLS habilitado
ALTER TABLE gemini_reviews ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON gemini_reviews;
DROP POLICY IF EXISTS "Enable insert for service role" ON gemini_reviews;
DROP POLICY IF EXISTS "Enable update for service role" ON gemini_reviews;

-- Criar policies atualizadas
CREATE POLICY "Enable read access for authenticated users" 
  ON gemini_reviews FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" 
  ON gemini_reviews FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" 
  ON gemini_reviews FOR UPDATE 
  USING (auth.role() = 'service_role');

-- ============================================
-- PARTE 7: Trigger para updated_at automático
-- ============================================

-- Função de atualização
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (remover se existir para evitar duplicatas)
DROP TRIGGER IF EXISTS set_updated_at ON gemini_reviews;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON gemini_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PARTE 8: Função auxiliar para batch update
-- ============================================

CREATE OR REPLACE FUNCTION batch_update_review_status(
  review_ids UUID[],
  new_status TEXT,
  resolution_type TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
  valid_statuses TEXT[] := ARRAY[
    'detected', 'reported', 'assigned', 'resolved',
    'partial', 'wontfix', 'duplicate',
    'pendente', 'em_progresso', 'corrigido', 'descartado'
  ];
  valid_resolution_types TEXT[] := ARRAY['fixed', 'rejected', 'partial', NULL];
BEGIN
  -- Validar status
  IF NOT (new_status = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Status inválido: %. Status permitidos: %', new_status, array_to_string(valid_statuses, ', ');
  END IF;
  
  -- Validar resolution_type se fornecido
  IF resolution_type IS NOT NULL AND NOT (resolution_type = ANY(ARRAY['fixed', 'rejected', 'partial'])) THEN
    RAISE EXCEPTION 'Tipo de resolução inválido: %. Tipos permitidos: fixed, rejected, partial', resolution_type;
  END IF;
  
  UPDATE gemini_reviews
  SET
    status = new_status,
    resolution_type = COALESCE(resolution_type, gemini_reviews.resolution_type),
    updated_at = NOW()
  WHERE id = ANY(review_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

DO $$
DECLARE
  total_records INTEGER;
  with_hash INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM gemini_reviews;
  SELECT COUNT(*) INTO with_hash FROM gemini_reviews WHERE issue_hash IS NOT NULL;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration concluída!';
  RAISE NOTICE 'Total de registros: %', total_records;
  RAISE NOTICE 'Registros com hash: %', with_hash;
  RAISE NOTICE '============================================';
END $$;
