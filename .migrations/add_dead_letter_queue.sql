-- Migração: Fila de Notificações Falhas (Dead Letter Queue)
-- Criação: 2026-02-15
-- Fase: P1 - Reliability
-- Nota: Usa IF NOT EXISTS / OR REPLACE para ser idempotente

-- Tabela para armazenar notificações que falharam após todas as tentativas
CREATE TABLE IF NOT EXISTS failed_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
    correlation_id UUID NOT NULL,
    
    -- Dados da notificação
    notification_type VARCHAR(50) NOT NULL,
    notification_payload JSONB NOT NULL,
    
    -- Informações do erro
    error_code VARCHAR(50),
    error_message TEXT,
    error_category VARCHAR(50) NOT NULL DEFAULT 'unknown',
    
    -- Controle de retry
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    
    -- Status: failed, pending, retrying, resolved, discarded
    status VARCHAR(20) NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'pending', 'retrying', 'resolved', 'discarded')),
    
    -- Resolução
    resolution_notes TEXT
);

-- Comentários em português para documentação
-- Nota: COMMENT não suporta IF EXISTS, então usamos DO block
DO $$
BEGIN
    COMMENT ON TABLE failed_notification_queue IS 'Fila de notificações falhas (Dead Letter Queue) - armazena notificações que não puderam ser entregues após todas as tentativas de retry';
    COMMENT ON COLUMN failed_notification_queue.user_id IS 'ID do usuário destinatário';
    COMMENT ON COLUMN failed_notification_queue.protocol_id IS 'ID do protocolo relacionado (pode ser nulo para notificações globais)';
    COMMENT ON COLUMN failed_notification_queue.correlation_id IS 'ID de correlação para rastreamento da notificação';
    COMMENT ON COLUMN failed_notification_queue.notification_type IS 'Tipo: dose_reminder, soft_reminder, stock_alert, etc.';
    COMMENT ON COLUMN failed_notification_queue.notification_payload IS 'Dados completos da notificação em JSON';
    COMMENT ON COLUMN failed_notification_queue.error_category IS 'Categoria do erro: network_error, rate_limit, invalid_chat, etc.';
    COMMENT ON COLUMN failed_notification_queue.status IS 'Status: failed, pending, retrying, resolved, discarded';
EXCEPTION
    WHEN undefined_object THEN
        -- Table doesn't exist yet, comments will be added when table is created
        NULL;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_failed_notif_user ON failed_notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_failed_notif_status ON failed_notification_queue(status) WHERE status IN ('failed', 'pending');
CREATE INDEX IF NOT EXISTS idx_failed_notif_correlation ON failed_notification_queue(correlation_id);
CREATE INDEX IF NOT EXISTS idx_failed_notif_created_at ON failed_notification_queue(created_at);

-- UNIQUE constraint on correlation_id (required for upsert onConflict)
-- Adiciona a constraint se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_failed_notification_queue_correlation_id'
    ) THEN
        ALTER TABLE failed_notification_queue 
        ADD CONSTRAINT uq_failed_notification_queue_correlation_id UNIQUE (correlation_id);
    END IF;
END $$;

-- Índice parcial único para prevenir race conditions no upsert
-- Apenas uma notificação pendente por (user, protocolo, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_notif_unique_pending
    ON failed_notification_queue(user_id, protocol_id, notification_type)
    WHERE status = 'pending';

-- Políticas RLS para isolamento por usuário
ALTER TABLE IF EXISTS failed_notification_queue ENABLE ROW LEVEL SECURITY;

-- Criar política apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'failed_notification_queue' AND policyname = 'Users can only see their own failed notifications'
    ) THEN
        CREATE POLICY "Users can only see their own failed notifications"
            ON failed_notification_queue
            FOR ALL
            USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'failed_notification_queue' AND policyname = 'Service role can manage all notifications'
    ) THEN
        CREATE POLICY "Service role can manage all notifications"
            ON failed_notification_queue
            FOR ALL
            TO service_role
            USING (true);
    END IF;
END $$;

-- Trigger para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_failed_notif_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_failed_notif_timestamp'
        AND event_object_table = 'failed_notification_queue'
    ) THEN
        CREATE TRIGGER trigger_update_failed_notif_timestamp
            BEFORE UPDATE ON failed_notification_queue
            FOR EACH ROW
            EXECUTE FUNCTION update_failed_notif_timestamp();
    END IF;
END $$;

-- Função PostgreSQL para estatísticas da DLQ (performance otimizada)
-- Evita transferir todas as linhas para o cliente
CREATE OR REPLACE FUNCTION get_dlq_stats()
RETURNS TABLE (
    status VARCHAR,
    count BIGINT,
    error_category VARCHAR,
    oldest_failure TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.status,
        COUNT(*)::BIGINT,
        f.error_category,
        MIN(f.created_at) as oldest_failure
    FROM failed_notification_queue f
    GROUP BY f.status, f.error_category
    ORDER BY f.status, COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_dlq_stats() IS 'Retorna estatísticas agregadas da DLQ para evitar transferência de dados desnecessária';
