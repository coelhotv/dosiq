-- Spec 108 · PO-6 / FR-002 — varredura de resíduo de privilégio no `public` (só leitura, reutilizável).
-- Esperado: 0 linhas em QA e prod. Cada linha = objeto fora da matriz (20261031_108_matrix.md).
-- Matriz mudou (tabela/RPC nova legítima)? Atualize as listas abaixo NO MESMO PR da migração.
WITH
rel AS (SELECT c.oid, c.relname, c.relkind, c.relowner FROM pg_class c
         WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','p','S')),
fn  AS (SELECT p.oid, p.oid::regprocedure::text AS sig, p.proname, p.proowner, p.proacl FROM pg_proc p
         WHERE p.pronamespace = 'public'::regnamespace),
-- relações a que authenticated NÃO tem acesso algum
auth_none(relname) AS (VALUES ('stock_adjustments'),('stock_consumptions'),('v_dose_critical_summary'),
  ('v_dose_critical_trace'),('user_emails'),('feedback_stats'),('beta_signups'),('bot_sessions'),
  ('consent_copy_history'),('notification_outbox'),('prune_queue'),('prune_queue_audit')),
-- RPCs/funções de gatilho com EXECUTE explícito de authenticated (matriz §3)
auth_fn(proname) AS (VALUES ('apply_manual_stock_adjustment'),('archived_is_terminal'),('confirm_titration_switch'),
  ('consent_grant'),('consent_revoke'),('consume_stock_fifo'),('create_purchase_with_stock'),('delete_device_activity'),
  ('delete_dose_log_atomic'),('delete_user_account'),('generate_telegram_token'),('get_low_stock_medicines'),
  ('get_my_deletion_notice'),('guard_brevo_synced_at'),('guard_consent_revoked_at'),('guard_consent_revoked_at_insert'),
  ('guard_transfer_granted_at'),('guard_transfer_granted_at_insert'),('medicines_archive_on_delete'),
  ('protocols_archive_on_delete'),('register_dose_atomic'),('report_dose_days'),('restore_stock_for_log'),
  ('set_protocol_dose_state_atomic'),('skip_dose_atomic'),('update_dose_log_atomic'),('upsert_device_activity'),
  ('upsert_notification_device'),('update_failed_notif_timestamp'),('update_updated_at_column'),
  ('cleanup_expired_bot_sessions'),('get_dlq_stats'),('refresh_stock_summary'))
SELECT 'dono ≠ postgres' AS problema, relname AS objeto FROM rel WHERE relowner <> 'postgres'::regrole
UNION ALL SELECT 'dono ≠ postgres', sig FROM fn WHERE proowner <> 'postgres'::regrole
UNION ALL
SELECT 'anon:' || x, r.relname FROM rel r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) x
 WHERE r.relkind <> 'S' AND has_table_privilege('anon', r.oid, x) AND NOT (r.relname = 'consent_policy' AND x = 'SELECT')
UNION ALL
SELECT 'anon: coluna ' || a.attname, r.relname FROM rel r JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
 WHERE r.relkind <> 'S' AND has_column_privilege('anon', r.oid, a.attnum, 'SELECT,INSERT,UPDATE,REFERENCES')
   AND r.relname NOT IN ('consent_policy', 'app_version_gate')
UNION ALL
SELECT 'authenticated:' || x, r.relname FROM rel r CROSS JOIN unnest(ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) x
 WHERE r.relkind <> 'S' AND has_table_privilege('authenticated', r.oid, x)
UNION ALL
SELECT 'authenticated: fora da matriz', r.relname FROM rel r JOIN auth_none n USING (relname)
 WHERE has_any_column_privilege('authenticated', r.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
UNION ALL
SELECT 'authenticated: escrita em view', r.relname FROM rel r CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE']) x
 WHERE r.relkind IN ('v','m') AND has_table_privilege('authenticated', r.oid, x)
UNION ALL
SELECT 'sequência aberta', r.relname FROM rel r
 WHERE r.relkind = 'S' AND (has_sequence_privilege('anon', r.oid, 'USAGE,SELECT,UPDATE') OR has_sequence_privilege('authenticated', r.oid, 'USAGE,SELECT,UPDATE'))
UNION ALL
SELECT 'EXECUTE a PUBLIC', f.sig FROM fn f
 WHERE EXISTS (SELECT 1 FROM aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a WHERE a.grantee = 0)
UNION ALL
SELECT 'anon: EXECUTE', f.sig FROM fn f WHERE has_function_privilege('anon', f.oid, 'EXECUTE')
UNION ALL
SELECT 'authenticated: EXECUTE fora da matriz', f.sig FROM fn f
 WHERE has_function_privilege('authenticated', f.oid, 'EXECUTE') AND f.proname NOT IN (SELECT proname FROM auth_fn)
UNION ALL
SELECT 'padrão aberto (' || d.defaclobjtype::text || ')', coalesce(d.defaclnamespace::regnamespace::text, '<global>')
  FROM pg_default_acl d, aclexplode(d.defaclacl) a
 WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
   AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
ORDER BY 1, 2;
