-- Migração: Tabela de Reviews do Gemini Code Assist
-- Criação: 2026-02-22
-- Fase: P4.1 - API via Supabase para Controle de Reviews
-- Nota: Usa IF NOT EXISTS para ser idempotente

-- ============================================================================
-- CRIAÇÃO DA TABELA
-- ============================================================================

CREATE TABLE IF NOT EXISTS gemini_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação do usuário (para RLS)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identificação do PR e commit
    pr_number INTEGER NOT NULL,
    commit_sha TEXT NOT NULL,

    -- Localização do código
    file_path TEXT NOT NULL,
    line_start INTEGER,
    line_end INTEGER,

    -- Hash único do código problemático (MD5 para detectar duplicatas)
    issue_hash TEXT NOT NULL,

    -- Status da review (valores em português)
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'corrigido', 'descartado')),

    -- Prioridade e categoria (valores em português)
    priority TEXT CHECK (priority IN ('critica', 'alta', 'media', 'baixa')),
    category TEXT CHECK (category IN ('estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade')),

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
    COMMENT ON COLUMN gemini_reviews.user_id IS 'ID do usuário dono da review (para RLS)';
    COMMENT ON COLUMN gemini_reviews.pr_number IS 'Número do Pull Request';
    COMMENT ON COLUMN gemini_reviews.commit_sha IS 'Hash do commit analisado';
    COMMENT ON COLUMN gemini_reviews.file_path IS 'Caminho do arquivo analisado';
    COMMENT ON COLUMN gemini_reviews.line_start IS 'Linha inicial do código problemático';
    COMMENT ON COLUMN gemini_reviews.line_end IS 'Linha final do código problemático';
    COMMENT ON COLUMN gemini_reviews.issue_hash IS 'Hash MD5 do código problemático para identificação única';
    COMMENT ON COLUMN gemini_reviews.status IS 'Status: pendente, em_progresso, corrigido, descartado';
    COMMENT ON COLUMN gemini_reviews.priority IS 'Prioridade: critica, alta, media, baixa';
    COMMENT ON COLUMN gemini_reviews.category IS 'Categoria: estilo, bug, seguranca, performance, manutenibilidade';
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

CREATE INDEX IF NOT EXISTS idx_gemini_reviews_user ON gemini_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr ON gemini_reviews(pr_number);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_status ON gemini_reviews(status);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_issue_hash ON gemini_reviews(issue_hash);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_category ON gemini_reviews(category);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_priority ON gemini_reviews(priority);
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_created_at ON gemini_reviews(created_at);

-- Índice composto para buscas comuns
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr_status ON gemini_reviews(pr_number, status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - RESTRITIVO
-- ============================================================================

-- Habilitar RLS na tabela
ALTER TABLE gemini_reviews ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só podem ver suas próprias reviews
DROP POLICY IF EXISTS "Usuários só podem ver suas próprias reviews" ON gemini_reviews;
CREATE POLICY "Usuários só podem ver suas próprias reviews"
    ON gemini_reviews FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Política: Usuários só podem criar reviews para si mesmos
DROP POLICY IF EXISTS "Usuários só podem criar suas próprias reviews" ON gemini_reviews;
CREATE POLICY "Usuários só podem criar suas próprias reviews"
    ON gemini_reviews FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Política: Usuários só podem atualizar suas próprias reviews
DROP POLICY IF EXISTS "Usuários só podem atualizar suas próprias reviews" ON gemini_reviews;
CREATE POLICY "Usuários só podem atualizar suas próprias reviews"
    ON gemini_reviews FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Política: Usuários só podem deletar suas próprias reviews
DROP POLICY IF EXISTS "Usuários só podem deletar suas próprias reviews" ON gemini_reviews;
CREATE POLICY "Usuários só podem deletar suas próprias reviews"
    ON gemini_reviews FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

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
