# Runbook — registro de acesso do Marco Civil (spec 106)

> **Para quê:** o dosiq, como pessoa jurídica provedora de aplicação, guarda por **6 meses**, sob
> sigilo, o registro de acesso de cada conta: data, hora (UTC) e IP (Lei 12.965/2014, art. 15).
> Este runbook diz como o registro é coletado, como entregá-lo **só** sob ordem judicial, como
> desligar a coleta e o que conferir na revisão periódica.
>
> Migração: `docs/migrations/20261020_access_log_retention.sql` · Decisão: ADR-113.

## Como funciona

| Peça | O que faz |
|---|---|
| `access_hook.capture_access()` | função de pré-request da Data API (`pgrst.db_pre_request` no papel `authenticator`). Em toda requisição de usuário logado lê o `sub` do JWT e o `cf-connecting-ip`; na 1ª vez de `(conta, IP, hora UTC)` grava uma linha |
| papel `access_log_writer` | grava por `dblink` numa conexão própria (o GET roda em transação somente-leitura). Só tem `INSERT` em `private.access_log` — não lê nada |
| segredo `ACCESS_LOG_WRITER_DSN_PASSWORD` (Vault) | senha desse papel |
| `private.access_log` | uma linha por `(user_id, ip, hora UTC)`, com `first_seen` |
| `private.access_log_runs` | execuções do purge |
| `private.access_log_disclosures` | registro de cada entrega a terceiros (sem IP) |
| cron `prune-access-log` 03:45 UTC | apaga linhas com mais de 6 meses |
| `public.access_log_health()` | chamada pelo `api/notify.ts` às 05:00 SP; havendo problema, evento "Registro de acesso (Marco Civil) com problema" no Sentry |

O schema `private` não é exposto pela API: nenhum usuário do app lê, escreve ou vê estas tabelas.
O `service_role` também não (sem USAGE no schema). Só o `postgres` (painel/SQL do Supabase) lê.

**De onde vem o IP:** só do `cf-connecting-ip`, que a borda do Supabase (Cloudflare) preenche.
Cliente que tenta forjá-lo leva 403 na borda; `X-Forwarded-For` forjado não o altera (medido em
2026-10-20). **Nunca** usar `auth.sessions.ip`: o Auth grava ali o 1º valor do `X-Forwarded-For`
mandado pelo cliente, que é forjável.

**A função nunca derruba uma requisição:** qualquer erro (segredo ausente, conexão recusada, tabela
renomeada) é engolido e a requisição segue. A falha aparece no audit das 05:00, não no app.

### Limites declarados

- **Precisão:** registra a 1ª requisição de dados de cada conta, por IP, em cada hora UTC. Login sem
  nenhuma requisição de dados depois não gera linha (o app sempre consulta dados ao abrir).
- **Só a Data API.** Hoje o app não usa Realtime, Storage nem Edge Functions; se passar a usar, uso
  feito só por esses canais não gera linha.
- **Sem porta lógica.** Em CGNAT (comum no 4G), o IP sozinho pode não identificar o assinante.
  Declarar isso em toda resposta a ofício.
- **Bot do Telegram e jobs do servidor ficam fora** (chamam como `service_role`, sem conta de usuário).
- **Início da coleta:** 2026-10-20 06:18 UTC (primeira linha). Antes disso não há registro com IP.
- **Exclusão de conta não apaga o registro** (LGPD art. 16, I). O `user_id` fica como pseudônimo.

## Regra de acesso (RC-SEC S-5)

Fora de uma extração sob ordem judicial, **ninguém lista IPs da frota**, e isso vale também para
sessões de agente de IA com MCP. Consultas operacionais usam só `count(*)`, ou filtram pela conta
de smoke resolvida por e-mail em `auth.users` na hora.

## Provisionar ou trocar a senha do papel

A senha é gerada **dentro do banco** e não aparece para ninguém (nem no SQL, nem no repo). Rodar no
SQL Editor do Supabase como `postgres`:

```sql
DO $$
DECLARE v_pwd text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  EXECUTE format('ALTER ROLE access_log_writer PASSWORD %L', v_pwd);
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ACCESS_LOG_WRITER_DSN_PASSWORD') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'ACCESS_LOG_WRITER_DSN_PASSWORD'), v_pwd);
  ELSE
    PERFORM vault.create_secret(v_pwd, 'ACCESS_LOG_WRITER_DSN_PASSWORD',
      'spec 106 — senha do papel access_log_writer (ADR-113)');
  END IF;
END $$;
```

Trocar a senha (rotação, suspeita de vazamento) é rodar o mesmo bloco. Um vazamento só permitiria
inserir linhas falsas, não ler o registro.

## Extração sob ordem judicial (FR-007)

Entrega a terceiros **só com ordem judicial** (Marco Civil art. 10, § 1º e art. 15, § 3º). Quem
executa é o encarregado (DPO). Ofício sem ordem judicial (polícia, advogado, o próprio titular
pedindo os IPs de outra pessoa) **não** dá acesso: responder pedindo a ordem.

1. Conferir que a ordem nomeia a conta (e-mail ou identificador) e o período, e que o período cabe
   nos últimos 6 meses. Período mais antigo: responder que o registro não existe mais (prazo legal).
2. Achar o `user_id` pelo e-mail em `auth.users`.
3. **Registrar ANTES de extrair** (no SQL Editor do Supabase):
   ```sql
   INSERT INTO private.access_log_disclosures
     (requested_at, case_ref, user_id, period_start, period_end, executed_by)
   VALUES ('<data do ofício>', '<nº do processo / ofício>', '<user_id>',
           '<início UTC>', '<fim UTC>', '<nome de quem executa>')
   RETURNING id;
   ```
4. Extrair só a conta e o período da ordem:
   ```sql
   SELECT host(ip) AS ip, hour_bucket AS hora_utc, first_seen
     FROM private.access_log
    WHERE user_id = '<user_id>'
      AND hour_bucket >= '<início UTC>' AND hour_bucket < '<fim UTC>'
    ORDER BY hour_bucket;
   ```
5. Entregar com os limites declarados acima (horário em UTC, 1ª ocorrência por hora, sem porta).
6. Fechar o registro:
   ```sql
   UPDATE private.access_log_disclosures SET delivered_at = now() WHERE id = <id do passo 3>;
   ```

## Desligar a coleta em 1 comando (RC3 E-5)

Se houver qualquer suspeita de que a coleta atrapalha a API:

```sql
ALTER ROLE authenticator RESET pgrst.db_pre_request;
NOTIFY pgrst, 'reload config';
```

O audit das 05:00 vai acusar `pre_request_missing` no dia seguinte, e isso é esperado: a obrigação
legal segue valendo. Para religar, trocar `RESET pgrst.db_pre_request` por
`SET pgrst.db_pre_request = 'access_hook.capture_access'`. As tabelas **nunca** são apagadas: o
conteúdo está sob obrigação legal de guarda.

⚠️ Qualquer outro trabalho que precise de `pgrst.db_pre_request` tem de **compor** com esta função
(chamá-la de dentro da nova), nunca substituí-la.

## O que o alerta do Sentry quer dizer

| `check_name` | Significado | O que fazer |
|---|---|---|
| `pre_request_missing` | `pgrst.db_pre_request` do `authenticator` não aponta para `access_hook.capture_access` | religar (seção acima) ou descobrir quem trocou |
| `writer_secret_missing` | segredo ausente ou vazio no Vault | rodar o bloco "Provisionar ou trocar a senha" |
| `capture_stalled` | houve sessão renovada nas últimas 24 h e nenhuma linha nova | conferir as duas linhas acima; testar o `dblink` (abaixo); conferir se a borda ainda manda `cf-connecting-ip` |
| `purge_failed` | o cron `prune-access-log` falhou nas últimas 48 h | `SELECT start_time, status, return_message FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='prune-access-log') ORDER BY start_time DESC LIMIT 5` |
| `purge_stalled` | há linha com mais de 6 meses + 2 dias | mesma consulta acima |

Teste do `dblink` (sem gravar nada, só autentica):

```sql
SELECT extensions.dblink_connect('t', format(
  'host=db.kwqjtdsqkkbebfiaxubb.supabase.co port=5432 dbname=postgres user=access_log_writer password=%s connect_timeout=2',
  (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ACCESS_LOG_WRITER_DSN_PASSWORD')));
SELECT extensions.dblink_disconnect('t');
```

Não trocar o host por `127.0.0.1`/`localhost`: na rede local o banco não pede senha, e o `dblink`
recusa (erro `2F003`).

## Revisão periódica (FR-005)

Primeira em **2027-01-15** (depois da virada das regras de log do Supabase), depois **a cada 6 meses**.
Registrar o resultado no journal.

1. `cf-connecting-ip` forjado ainda leva 403, e `X-Forwarded-For` forjado ainda não muda o IP
   gravado (PO-S1/PO-SEC-1 da spec 106, com a conta de smoke)?
2. `SELECT * FROM public.access_log_health();` vazio?
3. Volume e conexões: `SELECT count(*), count(DISTINCT user_id), min(hour_bucket) FROM private.access_log;`
   (só contagem) e `max_connections` × pico de uso.
4. Alguma mudança do Supabase (PostgREST, borda, planos, logs) alterou o pré-request ou o header?
