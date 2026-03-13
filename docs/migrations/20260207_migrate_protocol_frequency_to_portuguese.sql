-- Migration: Migrate protocol frequency from English to Portuguese
-- Date: 2026-02-07
-- Purpose: Update frequency values in protocols table to match new Zod schema with Portuguese values

-- ATENÇÃO: Execute no Supabase SQL Editor

-- Passo 1: Dropar constraint existente se existir
ALTER TABLE protocols DROP CONSTRAINT IF EXISTS protocols_frequency_check;

-- Passo 2: Verificar valores atuais únicos
SELECT DISTINCT frequency FROM protocols WHERE frequency IS NOT NULL;

-- Passo 3: Atualizar os dados de frequência (antes de adicionar constraint)
UPDATE protocols
SET frequency = CASE frequency
  WHEN 'daily' THEN 'diário'
  WHEN 'alternate' THEN 'dias_alternados'
  WHEN 'weekly' THEN 'semanal'
  WHEN 'custom' THEN 'personalizado'
  WHEN 'as_needed' THEN 'quando_necessário'
  ELSE frequency
END
WHERE frequency IN ('daily', 'alternate', 'weekly', 'custom', 'as_needed');

-- Passo 4: Verificar valores após update
SELECT DISTINCT frequency FROM protocols WHERE frequency IS NOT NULL;

-- Passo 5: Adicionar constraint com NOT VALID (não verifica linhas existentes)
ALTER TABLE protocols
ADD CONSTRAINT protocols_frequency_check
CHECK (frequency IN ('diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário'))
NOT VALID;

-- Passo 6: Validar a constraint (verifica que todas as linhas cumprem a constraint)
ALTER TABLE protocols VALIDATE CONSTRAINT protocols_frequency_check;

-- Verificação final
SELECT conname, convalidated, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'protocols_frequency_check';
