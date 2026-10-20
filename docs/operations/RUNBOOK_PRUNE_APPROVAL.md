---
title: "Fila de exclusão com aprovação manual"
description: "Runbook da fila de exclusão de contas (prune) com aprovação conta a conta no admin web, os jobs do api/ops, as ondas do legado e a lápide do Marco Civil."
version: "1.0.0"
status: active
category: operation
audience:
  - dev
  - ops
tags:
  - lgpd
  - marco-civil
  - prune
  - cron
created_at: "2026-10-20"
updated_at: "2026-10-20"
epic: "107"
---

# Runbook — Fila de exclusão com aprovação manual (spec 107)

## O que mudou

Até a 107, o prune da 046 apagava **sozinho**, dentro do `api/notify.ts`, quem tinha retirado a
autorização há mais de 90 dias. Agora:

- Nada é apagado sem uma linha `approved` na `public.prune_queue`, decidida pelo `ADMIN_USER_ID` no
  admin web (**Configurações → Administração → Exclusões pendentes**). Não existe aprovação em lote.
- Os jobs saem do `notify.ts` e moram em `api/ops.ts` (função Vercel 8/12), um ping por job.
- Toda exclusão de conta (pela fila **ou** pedida pelo titular) grava a lápide do Marco Civil
  (`private.account_tombstone`: e-mail ↔ `user_id` por 6 meses). Ofício judicial: ver
  [`RUNBOOK_ACCESS_LOG.md`](RUNBOOK_ACCESS_LOG.md) §Extração.

Decisão: ADR-111 · contrato: CON-043 · migração: `docs/migrations/20261020_107_prune_queue.sql`.

---

## 1. Pings do cron-job.org (criar ANTES do merge)

Mesmo segredo do `notify` (`CRON_SECRET`), no header. Um job por ping, para cada um ter histórico de
falha próprio. Erro ou abort do job devolve **5xx** e o cron-job.org alerta.

| Job | URL | Horário (America/Sao_Paulo) | O que faz |
|---|---|---|---|
| `prune_enqueue` | `https://<domínio>/api/ops?job=prune_enqueue` | diário 09:30 | abre linhas, reavalia, avisos D+60/D+83, alerta ao admin |
| `prune_execute` | `https://<domínio>/api/ops?job=prune_execute` | diário 10:00 | apaga só `approved` válidas (máx. 5) |

Header: `Authorization: Bearer <CRON_SECRET>`. Método: `GET`.
Depois do merge, conferir no cron-job.org que a 1ª execução de cada um voltou `200`.

**Janela sem prune entre o merge e o 1º ping:** inofensiva. A fila só *atrasa* decisões, nunca apaga
sozinha.

## 2. Kill switches (env da Vercel, sem deploy)

| Env | Efeito |
|---|---|
| `CONSENT_PRUNE_ENABLED=0` | desliga enqueue **e** execute (nem avisos saem) |
| `CONSENT_PRUNE_MODE` ≠ `armed` | executor só lista (dry-run); não apaga, não reivindica |
| `CONSENT_PRUNE_CAP` (default 5) | acima disso o execute aborta **tudo** (linhas seguem `approved`) |
| `CONSENT_PRUNE_NOTICE_CAP` (default 50) | acima disso o enqueue não envia nenhum aviso |

## 3. Rotina do admin

1. O push diário ("Exclusões aguardando decisão") traz só contagens. Vermelho = pendência a ≤ 10 dias
   do limite da política (90 + 15 dias).
2. Na tela, cada linha mostra id curto, e-mail mascarado, motivo, datas e avisos. Nenhum dado de saúde.
3. **Apagar esta conta** → digitar o início do id (≥ 6). O servidor confere de novo.
   **Adiar…** exige motivo e data de reavaliação.
4. **Aviso por e-mail devido** (conta sem push): **Copiar e-mail** (revela 1 linha, com registro) →
   enviar pelo Gmail com o texto abaixo → **Marcar enviado**. Sem a marcação o aviso continua devido
   (e entra no push diário).
5. Linha aprovada executa no próximo ciclo das 10:00. Se o titular autorizou ou excluiu a conta antes,
   ela vira `cancelada` no Histórico, sem apagar nada.

Texto dos avisos por e-mail (sem nenhum dado de saúde). A tela mostra este texto pronto, já com a
data, em cada linha com aviso devido — fonte única: `PRUNE_EMAIL_NOTICE_COPY` no `@dosiq/core`:

> **Assunto:** Sua conta no dosiq precisa de uma ação
> Você ainda não autorizou o uso de dados no dosiq. Sem essa autorização, sua conta e os dados dela
> serão excluídos em **{data}**. Para manter a conta, abra o app (atualizado pela loja) e toque em
> **Autorizar e continuar**. Se preferir, você pode excluir a conta agora pelo próprio app.

## 4. Ondas do legado (36 contas sem consentimento, FR-011)

| Onda | Quando | O que fazer | Trava |
|---|---|---|---|
| 1 | merge + loja 0.34 | servidor, admin, trava nova no app | — |
| 2 | 0.34 **publicada nas duas lojas** | Medir a frota (abaixo); na seção **Onda 2** da tela: Copiar e-mail → enviar → **Marcar enviado** | o enqueue só abre a linha 7 dias após a marcação |
| 3 | antes da 1ª aprovação `legacy_no_consent` (≈ D+80 do e-mail) | Ativar o kill switch 0.34 nas duas plataformas ([`GUIA_KILL_SWITCH_VERSAO_MINIMA.md`](GUIA_KILL_SWITCH_VERSAO_MINIMA.md), cerimônia `acknowledge_affected_devices`) | aprovar e executar legado é **recusado** pelo servidor sem gate ≥ 0.34 ativo nas duas plataformas **e** sem o e-mail da onda 2 no rastro |

Medição da frota do legado (FR-012), antes da onda 2:

```sql
SELECT coalesce(d.app_version, 'sem aparelho') AS versao, count(DISTINCT u.id) AS contas
  FROM auth.users u
  LEFT JOIN public.notification_devices d ON d.user_id = u.id
 WHERE u.created_at < '2026-10-20T03:00:00Z'
   AND NOT EXISTS (SELECT 1 FROM public.consent_log c
                    WHERE c.user_id = u.id AND c.consent_type = 'health_data' AND c.action = 'granted')
 GROUP BY 1 ORDER BY 2 DESC;
```

Medido em 2026-10-20: 36 contas — 22 sem aparelho, 13 com aparelho e só 1 em versão ≥ 0.30.0. Para
quase todas, o e-mail é o único canal.

**Onboarding (FR-009):** contas criadas a partir de 2026-10-20 sem autorização entram sozinhas na fila
30 dias depois (`onboarding_no_consent`). As anteriores são legado e **só** entram pela onda 2 (G-5).

## 5. Verificações rápidas

```sql
-- Fila viva
SELECT reason, decision, count(*) FROM public.prune_queue
 WHERE executed_at IS NULL AND decision <> 'void' GROUP BY 1, 2;

-- SC-001: nenhuma exclusão pela fila sem aprovação registrada
SELECT count(*) FROM public.prune_queue WHERE executed_at IS NOT NULL AND (decided_by IS NULL OR decision <> 'approved');

-- Lápides vivas (só contagem — o e-mail não sai daqui fora de ofício)
SELECT count(*) FROM private.account_tombstone;
```

## 6. Pendências conhecidas

- `api/notify.ts` ainda compara o segredo do cron com `!==` e loga o header recusado (RC-SEC S-4,
  fora do escopo da 107; o `api/ops` já usa comparação em tempo constante). Item de backlog.
