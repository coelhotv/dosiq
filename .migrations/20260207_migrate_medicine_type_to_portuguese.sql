-- Migration: Migrate medicine type from English to Portuguese
-- Date: 2026-02-07
-- Purpose: Update type values in medicines table to match new Zod schema with Portuguese values

-- ATENÇÃO: Execute no Supabase SQL Editor

-- Passo 1: Verificar valores atuais
SELECT type, COUNT(*) as count
FROM medicines
WHERE type IS NOT NULL
GROUP BY type
ORDER BY type;

-- Passo 2: Dropar constraint existente se existir
ALTER TABLE medicines DROP CONSTRAINT IF EXISTS medicines_type_check;

-- Passo 3: Atualizar os dados de tipo
UPDATE medicines
SET type = CASE type
  WHEN 'medicine' THEN 'medicamento'
  WHEN 'supplement' THEN 'suplemento'
  ELSE type
END
WHERE type IN ('medicine', 'supplement');

-- Passo 4: Verificar valores após update
SELECT type, COUNT(*) as count
FROM medicines
WHERE type IS NOT NULL
GROUP BY type
ORDER BY type;

-- Passo 5: Adicionar constraint CHECK
ALTER TABLE medicines
ADD CONSTRAINT medicines_type_check
CHECK (type IN ('medicamento', 'suplemento'));

-- Verificação final
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'medicines_type_check';
