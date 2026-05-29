-- Migração: Transição de dosage_unit 'cp' para 'un'
-- Data: 2026-05-28
-- Descrição: Atualiza todos os medicamentos cadastrados com a unidade 'cp' para 'un' de forma genérica.

-- Atualiza medicamentos existentes
UPDATE medicines 
SET dosage_unit = 'un' 
WHERE dosage_unit = 'cp';
