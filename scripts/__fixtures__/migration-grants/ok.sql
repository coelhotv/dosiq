-- Migração correta: tudo que nasce recebe GRANT explícito por papel.
CREATE TABLE public.things (id uuid PRIMARY KEY, user_id uuid NOT NULL, note text);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.things TO authenticated;
GRANT ALL ON TABLE public.things TO service_role;

CREATE TABLE public.thing_jobs (id bigint PRIMARY KEY);
-- grants: nenhum (só service_role)

CREATE VIEW public.v_things WITH (security_invoker = on) AS SELECT id, note FROM public.things;
GRANT SELECT ON public.v_things TO authenticated;

CREATE OR REPLACE FUNCTION public.list_things(p_user uuid)
RETURNS SETOF uuid LANGUAGE sql SET search_path = '' AS $$ SELECT id FROM public.things WHERE user_id = p_user $$;
GRANT EXECUTE ON FUNCTION public.list_things(uuid) TO authenticated;

-- migration-grants: ok — CREATE OR REPLACE preserva a ACL atual (só postgres)
CREATE OR REPLACE FUNCTION public._internal_core(p uuid) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;

GRANT SELECT (platform, min_supported_version) ON TABLE public.app_version_gate TO anon, authenticated;
GRANT SELECT ON TABLE public.consent_policy TO anon;
GRANT EXECUTE ON FUNCTION access_hook.capture_access() TO anon, authenticated;
COMMENT ON TABLE public.things IS 'GRANT SELECT TO anon numa string não conta; CREATE TABLE x também não';
