-- (a) função nova sem GRANT: nasce fechada (ADR-119) e o app recebe 42501.
CREATE OR REPLACE FUNCTION public.list_things(p_user uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT id FROM public.things WHERE user_id = p_user;  -- ';' dentro do corpo não divide statement
$$;
