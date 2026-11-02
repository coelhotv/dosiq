-- Spec 108 · FR-012 — gera o script de restauração das ACLs do `public` (rodar ANTES da migração,
-- em QA e em prod; a saída vira `20261031_108_acl_restore_<qa|prod>.sql`). Só leitura.
-- Cobre relacl, attacl, proacl (public) e pg_default_acl (todos os schemas). Papéis: anon, authenticated, PUBLIC.
WITH rel AS (
  SELECT c.oid, format('%I.%I', n.nspname, c.relname) AS obj,
         CASE c.relkind WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END AS kind, c.relacl
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','S','p')
), fn AS (
  SELECT p.oid, format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS obj, p.proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
), who(r) AS (VALUES ('anon'),('authenticated'),('PUBLIC'))
SELECT string_agg(stmt, E'\n' ORDER BY ord, stmt) AS restore_sql FROM (
  -- 1. zera os 3 papéis e reemite a ACL de tabela/sequência
  SELECT 1 ord, format('REVOKE ALL ON %s %s FROM anon, authenticated, PUBLIC;', kind, obj) stmt FROM rel
  UNION ALL
  SELECT 2, format('GRANT %s ON %s %s TO %s;', a.privilege_type, r.kind, r.obj,
                   CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END)
  FROM rel r, aclexplode(r.relacl) a
  WHERE a.grantee = 0 OR a.grantee::regrole::text IN ('anon','authenticated')
  UNION ALL
  -- 2. grants por coluna
  SELECT 3, format('GRANT %s (%I) ON TABLE %s TO %s;', a.privilege_type, att.attname, r.obj,
                   CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END)
  FROM rel r JOIN pg_attribute att ON att.attrelid = r.oid AND att.attacl IS NOT NULL, aclexplode(att.attacl) a
  WHERE a.grantee = 0 OR a.grantee::regrole::text IN ('anon','authenticated','service_role')
  UNION ALL
  -- 3. funções (proacl NULL = padrão embutido = EXECUTE a PUBLIC)
  SELECT 4, format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, PUBLIC;', obj) FROM fn
  UNION ALL
  SELECT 5, format('GRANT EXECUTE ON FUNCTION %s TO %s;', f.obj,
                   CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END)
  FROM fn f, aclexplode(coalesce(f.proacl, acldefault('f', (SELECT proowner FROM pg_proc WHERE oid = f.oid)))) a
  WHERE a.grantee = 0 OR a.grantee::regrole::text IN ('anon','authenticated')
  UNION ALL
  -- 4. padrões (pg_default_acl) — as linhas que a 108 altera
  SELECT 6, format('ALTER DEFAULT PRIVILEGES FOR ROLE %I%s GRANT %s ON %s TO %s;',
                   d.defaclrole::regrole::text,
                   CASE WHEN d.defaclnamespace = 0 THEN '' ELSE ' IN SCHEMA ' || quote_ident(d.defaclnamespace::regnamespace::text) END,
                   a.privilege_type,
                   CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' WHEN 'T' THEN 'TYPES' WHEN 'n' THEN 'SCHEMAS' END,
                   CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END)
  FROM pg_default_acl d, aclexplode(d.defaclacl) a
  WHERE d.defaclrole = 'postgres'::regrole AND (a.grantee = 0 OR a.grantee::regrole::text IN ('anon','authenticated'))
) s;
