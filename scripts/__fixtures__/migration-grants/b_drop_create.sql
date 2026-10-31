-- (b) mudança de assinatura: DROP + CREATE apaga os grants da versão anterior.
DROP FUNCTION public.register_thing(uuid);
CREATE FUNCTION public.register_thing(p_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  INSERT INTO public.things (id, note) VALUES (p_id, p_note);
END $fn$;
