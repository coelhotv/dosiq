-- 20260524_user_settings_phone.sql
--
-- Fase 4 (Perfil) — adiciona 1 coluna a public.user_settings:
--   • phone  text  — telefone do usuário (opcional, campo do Editar Perfil)
--
-- NOTA: a "Densidade da interface" das Configurações (Padrão/Automático/Detalhado)
-- NÃO ganha coluna nova — mapeia na coluna EXISTENTE `complexity_override`
-- ('simple' | 'complex' | NULL=auto):
--     Padrão = 'simple' · Detalhado = 'complex' · Automático = NULL
-- (evita duplicar a lógica de persona — R-152/R-183.)
--
-- user_settings é tabela EXISTENTE (RLS já ativa, grants já concedidos) —
-- a coluna nova herda grants/RLS. Idempotente. PO aplica manualmente.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS phone text;

-- ── Verificação (rodar após aplicar) ─────────────────────────────────────────
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'user_settings'
--    AND column_name = 'phone';
-- Esperado: phone | text
