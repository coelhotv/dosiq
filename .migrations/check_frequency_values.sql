-- Diagnóstico: Verificar valores de frequência na tabela
SELECT DISTINCT frequency, COUNT(*) as count
FROM protocols
GROUP BY frequency
ORDER BY frequency;
