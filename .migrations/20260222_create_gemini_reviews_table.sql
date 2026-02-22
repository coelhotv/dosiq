-- Migração: Tabela de Reviews do Gemini Code Assist
-- Criação: 2026-02-22
-- Fase: P4.1 - API via Supabase para Controle de Reviews
-- Nota: Usa IF NOT EXISTS para ser idempotente

-- ============================================================================
-- CRIAÇÃO DA TABELA
-- ============================================================================

CREATE TABLE IF NOT EXISTS gemini_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação do PR e commit
    pr_number INTEGER NOT NULL,
    commit_sha TEXT NOT NULL,

    -- Localização do código
    file_path TEXT NOT NULL,
    line_start INTEGER,
    line_end INTEGER,

    -- Hash único do código problemático (MD5 para detectar duplicatas)
    issue_hash TEXT NOT NULL,

    -- Status da review
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'fixed', 'discarded')),

    -- Prioridade e categoria
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category TEXT CHECK (category IN ('style', 'bug', 'security', 'performance', 'maintainability')),

    -- Conteúdo da review
    title TEXT,
    description TEXT,
    suggestion TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,

    -- Referência ao usuário que resolveu (se aplicável)
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

DO $$
BEGIN
    COMMENT ON TABLE gemini_reviews IS 'Tabela de controle de reviews do Gemini Code Assist';
    COMMENT ON COLUMN gemini_reviews.pr_number IS 'Número do Pull Request';
    COMMENT ON COLUMN gemini_reviews.commit_sha IS 'Hash do commit analisado';
    COMMENT ON COLUMN gemini_reviews.file_path IS 'Caminho do arquivo analisado';
    COMMENT ON COLUMN gemini_reviews.line_start IS 'Linha inicial do código problemático';
    COMMENT ON COLUMN gemini_reviews.line_end IS 'Linha final do código problemático';
    COMMENT ON COLUMN gemini_reviews.issue_hash IS 'Hash MD5 do código problemático para identificação única';
    COMMENT ON COLUMN gemini_reviews.status IS 'Status: pending, in_progress, fixed, discarded';
    COMMENT ON COLUMN gemini_reviews.priority IS 'Prioridade: critical, high, medium, low';
    COMMENT ON COLUMN gemini_reviews.category IS 'Categoria: style, bug, security, performance, maintainability';
    COMMENT ON COLUMN gemini_reviews.title IS 'Título da issue identificada';
    COMMENT ON COLUMN gemini_reviews.description IS 'Descrição detalhada da issue';
    COMMENT ON COLUMN gemini_reviews.suggestion IS 'Sugestão de correção';
    COMMENT ON COLUMN gemini_reviews.resolved_at IS 'Data de resolução da issue';
    COMMENT ON COLUMN gemini_reviews.resolved_by IS 'ID do usuário que resolveu a issue';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr ON gemini_reviews(pr_number);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_status ON gemini_reviews(status);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_issue_hash ON gemini_reviews(issue_hash);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_category ON gemini_reviews(category);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_priority ON gemini_reviews(priority);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_created_at ON gemini_reviews(created_at);

-- Índice composto para buscas comuns
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr_status ON gemini_reviews(pr_number, status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS na tabela
ALTER TABLE gemini_reviews ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só podem ver reviews do seu próprio PR
-- Nota: Esta política assume que há uma forma de vincular PR ao usuário
-- Por padrão, todos os usuários autenticados podem ver todas as reviews
-- Ajustar conforme necessidade de negócio

-- Política de SELECT: todos os usuários autenticados podem ler
DROP POLICY IF EXISTS "Usuários autenticados podem ver reviews" ON gemini_reviews;
CREATE POLICY "Usuários autenticados podem ver reviews"
    ON gemini_reviews FOR SELECT
    TO authenticated
    USING (true);

-- Política de INSERT: todos os usuários autenticados podem criar
DROP POLICY IF EXISTS "Usuários autenticados podem criar reviews" ON gemini_reviews;
CREATE POLICY "Usuários autenticados podem criar reviews"
    ON gemini_reviews FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política de UPDATE: todos os usuários autenticados podem atualizar
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar reviews" ON gemini_reviews;
CREATE POLICY "Usuários autenticados podem atualizar reviews"
    ON gemini_reviews FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política de DELETE: apenas usuários autenticados (restrito conforme necessidade)
DROP POLICY IF EXISTS "Usuários autenticados podem deletar reviews" ON gemini_reviews;
CREATE POLICY "Usuários autenticados podem deletar reviews"
    ON gemini_reviews FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- TRIGGER PARA AUTO-UPDATE DE updated_at
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger na tabela gemini_reviews
DROP TRIGGER IF EXISTS update_gemini_reviews_updated_at ON gemini_reviews;
CREATE TRIGGER update_gemini_reviews_updated_at
    BEFORE UPDATE ON gemini_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'gemini_reviews'
ORDER BY ordinal_position;

-- Verificar índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'gemini_reviews';

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'gemini_reviews';
