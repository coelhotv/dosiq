-- Migration: Adicionar coluna weekdays à tabela protocols para suporte a frequências semanais/personalizadas
-- Criado em: 2026-05-26

ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS weekdays text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.protocols.weekdays IS 'Dias da semana selecionados para frequências semanal ou personalizada';
