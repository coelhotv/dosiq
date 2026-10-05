-- 20261004_titration_steps_relink.test.sql — spec 093 (PO-3)
--
-- BEGIN..ROLLBACK contra o banco REAL, sobre o dado de prod (é DML de saneamento: a prova é o
-- efeito no conjunto real, não numa fixture). Nada persiste.
--
-- | # | Caso                                                             | Esperado        |
-- |---|------------------------------------------------------------------|-----------------|
-- | 1 | 1ª execução afeta exatamente as NULL com irmã de dono único       | = alvo_antes    |
-- | 2 | depois: 0 etapas NULL em escada com tratamento vinculado          | 0               |
-- | 3 | 2ª execução (idempotência)                                        | 0 linhas        |
-- | 4 | escadas com >1 tratamento: antes e depois                         | 0 e 0 (iguais)  |
-- | 5 | nenhuma coluna além de protocol_id/updated_at mudou (INV-2)       | 0 divergências  |

BEGIN;

CREATE TEMP TABLE _snap ON COMMIT DROP AS SELECT * FROM public.titration_steps;
CREATE TEMP TABLE _r (n int, caso text, esperado text, obtido text) ON COMMIT DROP;

CREATE TEMP VIEW _alvo AS
  SELECT s.id FROM public.titration_steps s
  WHERE s.protocol_id IS NULL
    AND EXISTS (SELECT 1 FROM public.titration_steps x WHERE x.titration_id = s.titration_id AND x.protocol_id IS NOT NULL);
CREATE TEMP VIEW _multi AS
  SELECT titration_id FROM public.titration_steps WHERE protocol_id IS NOT NULL
  GROUP BY 1 HAVING count(DISTINCT protocol_id) > 1;

CREATE TEMP TABLE _antes ON COMMIT DROP AS
  SELECT (SELECT count(*) FROM _alvo) AS alvo, (SELECT count(*) FROM _multi) AS multi;

CREATE OR REPLACE FUNCTION pg_temp.relink() RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  WITH single_owner AS (
    SELECT titration_id, (array_agg(protocol_id ORDER BY position))[1] AS protocol_id
    FROM public.titration_steps WHERE protocol_id IS NOT NULL
    GROUP BY titration_id HAVING count(DISTINCT protocol_id) = 1
  )
  UPDATE public.titration_steps s SET protocol_id = o.protocol_id, updated_at = now()
  FROM single_owner o WHERE s.titration_id = o.titration_id AND s.protocol_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

INSERT INTO _r SELECT 1, '1ª execução = alvo', (SELECT alvo FROM _antes)::text, pg_temp.relink()::text;
INSERT INTO _r SELECT 2, 'NULL com dono depois', '0', (SELECT count(*) FROM _alvo)::text;
INSERT INTO _r SELECT 3, '2ª execução', '0', pg_temp.relink()::text;
INSERT INTO _r SELECT 4, 'multi-tratamento antes|depois', '0|0', (SELECT multi FROM _antes)::text || '|' || (SELECT count(*) FROM _multi)::text;
INSERT INTO _r SELECT 5, 'colunas além do vínculo', '0', count(*)::text
  FROM public.titration_steps s JOIN _snap p USING (id)
  WHERE (s.titration_id, s.user_id, s.position, s.medicine_id, s.dose, s.intake_unit, s.duration_days, s.status, s.started_at, s.ended_at)
        IS DISTINCT FROM (p.titration_id, p.user_id, p.position, p.medicine_id, p.dose, p.intake_unit, p.duration_days, p.status, p.started_at, p.ended_at);

SELECT n, caso, esperado, obtido, esperado = obtido AS passou FROM _r ORDER BY n;

ROLLBACK;
