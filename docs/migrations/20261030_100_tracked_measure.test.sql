-- Spec 100 Slice A — prova da migração 20261030_100_tracked_measure.sql (PO-9, FM-1..FM-3, FM-14).
--
-- Execução (MCP execute_sql, QA primeiro): roda DEPOIS do corpo da migração, no MESMO script, e
-- termina com RAISE EXCEPTION 'RESULT …' — o erro final desfaz tudo. Nada sobra no banco.

DO $$
DECLARE v text; ok int := 0;
BEGIN
  -- FM-14: coluna nova herda o grant de tabela de authenticated; anon segue como estava na tabela.
  IF NOT has_column_privilege('authenticated', 'public.protocols', 'tracked_measure', 'SELECT,UPDATE,INSERT') THEN
    RAISE EXCEPTION 'FM-14: authenticated sem privilégio em protocols.tracked_measure';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.medicines', 'therapeutic_class_code', 'SELECT,UPDATE,INSERT') THEN
    RAISE EXCEPTION 'FM-14: authenticated sem privilégio em medicines.therapeutic_class_code';
  END IF;

  -- INV-2: DDL não preencheu nenhuma linha.
  IF EXISTS (SELECT 1 FROM public.protocols WHERE tracked_measure IS NOT NULL) THEN
    RAISE EXCEPTION 'INV-2: tracked_measure nasceu preenchido';
  END IF;

  -- FM-2/FM-3: valores inválidos tropeçam no CHECK REAL (UPDATE numa linha existente, desfeito no fim).
  FOREACH v IN ARRAY ARRAY['Peso', 'pressão', '', 'batimentos'] LOOP
    BEGIN
      UPDATE public.protocols SET tracked_measure = v WHERE id = (SELECT id FROM public.protocols LIMIT 1);
      RAISE EXCEPTION 'FM-2: % aceito', v;
    EXCEPTION WHEN check_violation THEN ok := ok + 1;
    END;
  END LOOP;
  FOREACH v IN ARRAY ARRAY['c7a', ' C7A', 'C', 'A10X9Z9', '7A'] LOOP
    BEGIN
      UPDATE public.medicines SET therapeutic_class_code = v WHERE id = (SELECT id FROM public.medicines LIMIT 1);
      RAISE EXCEPTION 'FM-3: % aceito', v;
    EXCEPTION WHEN check_violation THEN ok := ok + 1;
    END;
  END LOOP;

  -- Válidos passam no CHECK real; NULL também.
  UPDATE public.protocols SET tracked_measure = 'nenhum' WHERE id = (SELECT id FROM public.protocols LIMIT 1);
  UPDATE public.protocols SET tracked_measure = NULL WHERE id = (SELECT id FROM public.protocols LIMIT 1);
  UPDATE public.medicines SET therapeutic_class_code = 'A10X9' WHERE id = (SELECT id FROM public.medicines LIMIT 1);
  UPDATE public.medicines SET therapeutic_class_code = NULL WHERE id = (SELECT id FROM public.medicines LIMIT 1);

  RAISE EXCEPTION 'RESULT ok — % rejeições esperadas (9), válidos e NULL aceitos', ok;
END $$;
