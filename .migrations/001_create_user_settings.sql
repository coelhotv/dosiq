-- Migration: Criar tabela user_settings para persistência do onboarding
-- Data: 2026-02-03
-- Autor: Sistema

-- Criar tabela user_settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT user_settings_user_id_key UNIQUE (user_id)
);

-- Comentários
COMMENT ON TABLE user_settings IS 'Configurações do usuário incluindo status do onboarding';
COMMENT ON COLUMN user_settings.onboarding_completed IS 'Flag indicando se o usuário completou o onboarding';

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own settings" 
    ON user_settings FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" 
    ON user_settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" 
    ON user_settings FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir automaticamente para usuários existentes (opcional)
-- INSERT INTO user_settings (user_id, onboarding_completed)
-- SELECT id, TRUE FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;