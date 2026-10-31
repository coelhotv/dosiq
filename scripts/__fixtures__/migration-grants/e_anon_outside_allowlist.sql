-- (e) grant a anon fora da allowlist versionada no checador.
CREATE TABLE public.things (id uuid PRIMARY KEY, note text);
GRANT SELECT ON TABLE public.things TO anon, authenticated;
