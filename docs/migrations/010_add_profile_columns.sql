-- Migration: Adicionar colunas de perfil + emergency_card em user_settings
-- Wave 10B — Profile Hub
-- Data: 2026-03-27
--
-- NOTA IMPORTANTE: A coluna emergency_card foi especificada desde a criação
-- do emergencyCardService (v3.x) mas NUNCA foi criada no banco.
-- O service já tem código completo para ler/escrever nela (write-through
-- pattern com localStorage como primário). Uma vez criada, o service
-- passa a funcionar como projetado — ZERO mudança de código necessária.
--
-- Execução: Rodar este script no Supabase Dashboard > SQL Editor
-- Ambiente: Production
-- Impacto: Aditivo (ADD COLUMN IF NOT EXISTS) — zero risco

-- 1. Coluna JSONB para cartão de emergência (corrige dívida técnica de v3.x)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS emergency_card JSONB;

-- 2. Novas colunas para dados de perfil do usuário
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 3. Comentários para documentação
COMMENT ON COLUMN user_settings.emergency_card IS 'Cartão de emergência (JSONB): emergency_contacts[], allergies[], blood_type, notes, last_updated. Lido/escrito por emergencyCardService.js via write-through com localStorage.';
COMMENT ON COLUMN user_settings.display_name IS 'Nome de exibição do usuário (editável no Profile Hub)';
COMMENT ON COLUMN user_settings.birth_date IS 'Data de nascimento para cálculo de idade';
COMMENT ON COLUMN user_settings.city IS 'Cidade do usuário';
COMMENT ON COLUMN user_settings.state IS 'Estado/UF do usuário';

-- 4. Nota: RLS policies existentes de user_settings já cobrem as novas colunas
--    (row-level security, não column-level). Sem mudanças necessárias.
