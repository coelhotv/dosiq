-- (d) tabela nova sem GRANT nem declaração explícita de "só service_role".
CREATE TABLE public.things (id uuid PRIMARY KEY, user_id uuid NOT NULL, note text);
ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
CREATE TEMP TABLE _scratch AS SELECT 1;  -- temporária: fora da regra
