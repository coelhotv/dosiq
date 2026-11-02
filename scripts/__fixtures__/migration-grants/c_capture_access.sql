-- (c) recria o hook de pre-request sem devolver EXECUTE a anon: TODA requisição cai (spec 108 PO-9).
-- migration-grants: ok — o marcador NÃO libera a regra (c)
DROP FUNCTION access_hook.capture_access();
CREATE FUNCTION access_hook.capture_access() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN RETURN; END $$;
GRANT EXECUTE ON FUNCTION access_hook.capture_access() TO authenticated, service_role;
