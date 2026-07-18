# Migrações Supabase — template e regras obrigatórias

> Extraído do CLAUDE.md em 2026-07-18 (redução do arquivo). Fonte de verdade para
> qualquer `CREATE TABLE` / função nova. Aplicação em prod: via MCP, após aprovação.

## Grants obrigatórios

A partir de 30/10/2026, novas tabelas no projeto **não recebem grants automáticos**.
Template obrigatório após `CREATE TABLE`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO service_role;
-- anon: apenas se a tabela tiver dados verdadeiramente públicos (raro no dosiq)
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;
```

Esquecer o grant = tabela invisível pro app com RLS ligada — falha silenciosa em prod
(classe AP-275: default privileges legados exigem REVOKE explícito ao mexer em objeto antigo).

## Funções SECURITY DEFINER — regras obrigatórias

- `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;` **antes** de qualquer `GRANT` explícito
  (default do Postgres é PUBLIC — AP-278/FR-019 do 046).
- `REVOKE EXECUTE ON FUNCTION ... FROM anon;` sempre — não autenticado não chama RPC privilegiada.
- `SET search_path = ''` no cabeçalho (previne search path injection).
- Com `search_path = ''`, usar `public.<tabela>` (schema qualificado) no body.
- Guarda interna de chamador quando a função é service-only: `auth.role()`, nunca `current_user`
  (dentro de DEFINER, `current_user` é sempre o OWNER — guarda inerte, AP-292).

## Checklist de saída

1. `pg_get_constraintdef` / `information_schema` conferidos (R-295 — o banco é a verdade).
2. Grants + RLS no mesmo arquivo da tabela (nunca "depois").
3. Assinatura única por função (overload = AP-227; `DROP FUNCTION` da antiga na mesma migração).
4. Teste `BEGIN..ROLLBACK` contra o banco real antes de aplicar (padrão PO-SEC).
5. `npm run supabase:types` após aplicar (regen `database.types.ts` — R-289).
