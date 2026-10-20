# Runbook — registro de acesso do Marco Civil (spec 106)

> **Para quê:** o dosiq, como pessoa jurídica provedora de aplicação, guarda por **6 meses**, sob
> sigilo, o registro de acesso de cada conta: data, hora (UTC) e IP (Lei 12.965/2014, art. 15).
> Este runbook diz como o registro é coletado, como entregá-lo **só** sob ordem judicial, como
> desligar a coleta e o que conferir na revisão periódica.
>
> Migração: `docs/migrations/20261020_access_log_retention.sql`.

## Como funciona

| Peça | O que faz |
|---|---|
| `trg_access_log_capture` em `auth.sessions` | a cada login ou renovação de sessão, chama `private.capture_access_log()` |
| `private.access_log` | uma linha por `(user_id, ip, hora UTC)`; `first_seen`/`last_seen` dentro da hora |
| `private.access_log_runs` | erros da captura (só código e mensagem, sem IP) e execuções do purge |
| `private.access_log_disclosures` | registro de cada entrega a terceiros (sem IP) |
| cron `prune-access-log` 03:45 UTC | apaga linhas com mais de 6 meses |
| `public.access_log_health()` | chamada pelo `api/notify.ts` às 05:00 SP; havendo problema, evento "Registro de acesso (Marco Civil) com problema" no Sentry |

O schema `private` não é exposto pela API: nenhum usuário do app lê, escreve ou vê estas tabelas.
O `service_role` também não (sem USAGE no schema). Só o `postgres` (painel/SQL do Supabase) lê.

### Limites declarados

- **Precisão por renovação, não por requisição.** O app só renova a sessão quando o token está perto
  de vencer e o app está em primeiro plano. O registro diz "a conta usou o app a partir deste IP
  nesta hora, ou até cerca de 1 h depois". Ações pela notificação com a tela bloqueada só geram linha
  se precisarem renovar.
- **Sem porta lógica.** `auth.sessions` não guarda a porta de origem. Em CGNAT (comum no 4G), o IP
  sozinho pode não identificar o assinante. Declarar isso em toda resposta a ofício.
- **Bot do Telegram fica fora.** O IP visto é do servidor do Telegram, não do titular.
- **Início da coleta:** data em que a migração foi aplicada. Antes disso não há registro com IP.
- **Exclusão de conta não apaga o registro** (LGPD art. 16, I). O `user_id` fica como pseudônimo.

## Regra de acesso (RC-SEC S-5)

Fora de uma extração sob ordem judicial, **ninguém lista IPs da frota**, e isso vale também para
sessões de agente de IA com MCP. Consultas operacionais usam só `count(*)`, ou filtram pelo
`user_id` de uma conta de smoke.

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
   SELECT host(ip) AS ip, hour_bucket AS hora_utc, first_seen, last_seen
     FROM private.access_log
    WHERE user_id = '<user_id>'
      AND hour_bucket >= '<início UTC>' AND hour_bucket < '<fim UTC>'
    ORDER BY hour_bucket;
   ```
5. Entregar com os limites declarados acima (horário em UTC, precisão por renovação, sem porta).
6. Fechar o registro:
   ```sql
   UPDATE private.access_log_disclosures SET delivered_at = now() WHERE id = <id do passo 3>;
   ```

## Desligar a coleta em 1 comando (RC3 E-5)

Se o gatilho atrapalhar o login (ou qualquer suspeita disso):

```sql
DROP TRIGGER IF EXISTS trg_access_log_capture ON auth.sessions;
```

⚠️ `ALTER TABLE auth.sessions DISABLE TRIGGER …` **não funciona**: exige ser dono da tabela, que é
o `supabase_auth_admin` (medido em 2026-10-20, erro 42501). `DROP TRIGGER` funciona.

O audit das 05:00 vai acusar `trigger_missing` no dia seguinte, e isso é esperado: a obrigação legal
segue valendo. Para religar, rodar de novo o bloco `CREATE TRIGGER` da migração. As tabelas **nunca**
são apagadas: o conteúdo está sob obrigação legal de guarda.

## O que o alerta do Sentry quer dizer

| `check_name` | Significado | O que fazer |
|---|---|---|
| `capture_stalled` | houve sessão renovada nas últimas 24 h e nenhuma linha nova | ler `access_log_runs`; conferir se o Supabase mudou o Auth |
| `capture_errors` | a captura falhou N vezes (o login seguiu normal) | `SELECT ran_at, error FROM private.access_log_runs WHERE job='capture_error' ORDER BY ran_at DESC LIMIT 20` |
| `sessions_schema_changed` | coluna de `auth.sessions` sumiu ou mudou de tipo | upgrade do Auth: rever o gatilho antes que pare |
| `trigger_missing` / `trigger_disabled` | gatilho removido ou desabilitado | religar (seção acima) ou descobrir quem removeu |
| `purge_stalled` | há linha com mais de 6 meses + 2 dias | `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='prune-access-log') ORDER BY start_time DESC LIMIT 5` |

## Revisão periódica (FR-005)

Primeira em **2027-01-15** (depois da virada das regras de log do Supabase), depois **a cada 6 meses**.
Registrar o resultado no journal.

1. A renovação de sessão ainda grava o IP novo? Repetir a PO-5 da spec 106: conta de smoke, trocar
   Wi-Fi → 4G, forçar renovação, comparar `auth.sessions.ip` antes e depois.
2. O IP mandado pelo cliente em `X-Forwarded-For` continua **sem** virar o IP do registro (PO-SEC-1)?
3. `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'auth.sessions'::regclass AND NOT tgisinternal;`
4. Volume: `SELECT count(*), min(hour_bucket) FROM private.access_log;` (só contagem).
5. Alguma mudança do Supabase (Auth, plano, logs) alterou como a sessão é renovada?
