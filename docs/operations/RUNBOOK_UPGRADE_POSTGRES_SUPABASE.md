# Runbook — Upgrade de versão do Postgres no Supabase

> Uso: toda vez que o painel do Supabase (Project Settings → Infrastructure → Service versions) oferecer
> "Upgrade project". Primeira execução: **17.6.1.063 → 17.11.0.003** (oferta vista em 2026-10-19).
> Tarefa operacional (Tier 0): sem spec, sem PR. Fecha com a evidência da §5 registrada no journal.

## 1. O que muda e o que custa

- **Versão menor (17.x → 17.y):** correções de bug e segurança. SQL, extensões e RLS não mudam de comportamento.
  **Versão principal (17 → 18):** NÃO seguir este runbook sem antes ler as notas de upgrade do Supabase e testar numa branch.
- **Indisponibilidade de alguns minutos.** Nessa janela falham: app mobile, PWA, bot do Telegram, crons do
  `api/notify` (lembretes de dose podem não sair) e qualquer RPC.
- **Sem desfazer pelo painel.** No plano Free não existe restauração para um ponto no tempo (PITR). O backup da §3 é a única volta.
- **Auth e PostgREST não entram aqui.** O Supabase os atualiza sozinho; o efeito disso na spec 106 é vigiado pelo audit diário (FR-004 da 106).

## 2. Escolher a janela

Rodar no SQL editor (só leitura). Mostra quantas doses pendentes caem em cada hora (horário de Brasília) nos próximos 7 dias:

```sql
select extract(hour from scheduled_for at time zone 'America/Sao_Paulo') as hora_brt,
       count(*) as doses
from dose_instances
where status = 'pending'
  and scheduled_for between now() and now() + interval '7 days'
group by 1
order by 2 asc;
```

> R-295: conferir `dose_instances.scheduled_for` no `information_schema` antes de rodar, se este runbook ficar velho.

Escolher a hora com menos doses (normalmente madrugada) e um dia em que o PO esteja disponível para o smoke logo depois.

## 3. Backup antes (obrigatório)

**Pré-requisito — `pg_dump` local (macOS).** O pacote `libpq` traz só os clientes (`pg_dump`, `psql`, `pg_restore`), sem servidor:

```bash
brew install libpq
# keg-only: não entra no PATH sozinho (zsh → ~/.zprofile · bash → ~/.bash_profile)
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
pg_dump --version   # precisa ser ≥ 17 (2026-10-19: 18.6 no Mac Mini)
```

Se vier < 17: `brew install postgresql@17` e usar `/opt/homebrew/opt/postgresql@17/bin` no PATH.

String de conexão: painel → Connect → **Session pooler** (porta 5432), com a senha do banco.

```bash
mkdir -p ~/local/db-backups
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --no-owner --no-privileges \
  --file ~/local/db-backups/dosiq-pre-upgrade-$(date +%Y%m%d-%H%M).dump
ls -lh ~/local/db-backups/
```

- O `pg_dump` local precisa ser **da mesma versão principal ou mais nova** que o servidor (17). Conferir com `pg_dump --version`.
- O arquivo contém dado de saúde: fica só na máquina do PO, fora do iCloud e do git. Apagar depois de 30 dias sem incidente.
- Se o comando falhar, **não** seguir para o upgrade.

## 4. Upgrade

1. Painel → Project Settings → Infrastructure → **Upgrade project**. Anotar o horário de início.
2. Esperar o painel voltar a mostrar o projeto saudável e a nova versão em *Postgres version*.

## 5. Depois (smoke e evidência)

| Checagem | Como | Esperado |
|---|---|---|
| Versão | painel → Service versions | versão nova |
| Banco responde | `select version();` no SQL editor | versão nova |
| Login | app mobile (build de loja) com conta smoke | entra |
| Registrar dose | app mobile | dose `taken`, estoque decrementado |
| Notificação | esperar o próximo ciclo do cron do `notify` | push chega |
| Erros | Sentry + Supabase Logs na 1ª hora | sem pico novo |

Registrar no journal: versões antes/depois, horário de início/fim, nome do arquivo de backup, resultado de cada linha da tabela.

## 6. Se der errado

- Projeto não volta em 30 min: abrir chamado no suporte do Supabase (painel → Support) com o ref do projeto.
- Dado corrompido ou faltando: restaurar o dump num **projeto novo** primeiro (`pg_restore --no-owner -d <url-novo> <arquivo>`), conferir, e só então decidir com o PO como trocar. Nunca restaurar por cima do banco de produção sem essa conferência.
