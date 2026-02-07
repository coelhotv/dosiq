-- Migration: Normalizar valores de frequência para padrões válidos
-- Date: 2026-02-07
-- Purpose: Converter valores livres para valores padronizados do Zod

-- ATENÇÃO: Execute no Supabase SQL Editor

-- Passo 1: Verificar valores atuais
SELECT DISTINCT frequency, COUNT(*) as count
FROM protocols
GROUP BY frequency
ORDER BY frequency;

-- Passo 2: Normalizar valores para 'diário'
UPDATE protocols
SET frequency = 'diário'
WHERE frequency IN (
  '1x ao dia',
  '1x dia',
  '2x ao dia',
  'diariamente',
  'todo dia',
  'todos os dias',
  'diario',
  'daily',
  'uma vez ao dia',
  '1 x ao dia',
  '1x/dia',
  '1/dia'
);

-- Passo 3: Normalizar valores para 'dias_alternados'
UPDATE protocols
SET frequency = 'dias_alternados'
WHERE frequency IN (
  'dias alternados',
  'dia sim dia não',
  'dia sim dia nao',
  'alternado',
  'alternate',
  'um dia sim um dia não',
  'um dia sim um dia nao'
);

-- Passo 4: Normalizar valores para 'semanal'
UPDATE protocols
SET frequency = 'semanal'
WHERE frequency IN (
  '1x por semana',
  '1x na semana',
  'semanalmente',
  'weekly',
  'uma vez por semana',
  'por semana'
);

-- Passo 5: Normalizar valores para 'personalizado'
UPDATE protocols
SET frequency = 'personalizado'
WHERE frequency LIKE '%cada%'
   OR frequency LIKE '%horas%'
   OR frequency LIKE '%8h%'
   OR frequency LIKE '%12h%'
   OR frequency LIKE '%24h%'
   OR frequency LIKE '%6h%';

-- Passo 6: Normalizar valores para 'quando_necessário'
UPDATE protocols
SET frequency = 'quando_necessário'
WHERE frequency IN (
  'quando necessário',
  'quando precisar',
  'se precisar',
  'as needed',
  'se necessário',
  'sob demanda',
  'só se precisar',
  'se necessario',
  'quando necessario'
);

-- Passo 7: Verificar valores após normalização
SELECT DISTINCT frequency, COUNT(*) as count
FROM protocols
GROUP BY frequency
ORDER BY frequency;

-- Passo 8: Dropar e recriar constraint
ALTER TABLE protocols DROP CONSTRAINT IF EXISTS protocols_frequency_check;
ALTER TABLE protocols
ADD CONSTRAINT protocols_frequency_check
CHECK (frequency IN ('diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário'));

-- Verificação final
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'protocols_frequency_check';
