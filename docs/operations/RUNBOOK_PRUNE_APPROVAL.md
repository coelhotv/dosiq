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
| `prune_enqueue` | `https://dosiq.app/api/ops?job=prune_enqueue` | diário 21:20 | abre linhas, reavalia, avisos D+60/D+83, alerta ao admin |
| `prune_execute` | `https://dosiq.app/api/ops?job=prune_execute` | diário 21:25 | apaga só `approved` válidas (máx. 5) |

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
   do limite da política (90 + 15 dias). Os reavisos devidos entram em "avisos por e-mail a enviar".
2. A tela agrupa cada conta numa seção só, pela **próxima ação** (contadores no topo); trabalhe de cima
   para baixo:

   | Seção | Quem está ali | O que fazer |
   |---|---|---|
   | 📧 Enviar e-mail hoje | aviso D+60/D+83 devido em conta sem push | **Copiar e-mail** (revela 1 linha, com registro) → Gmail com o texto pronto → **Marcar enviado** |
   | ✅ Pronto para decidir | no prazo e com os 2 avisos (ou o reaviso) | **Apagar esta conta** (digitar o início do id, ≥ 6) ou **Adiar…** (motivo + data) |
   | ⛔ Bloqueado | no prazo **sem** os 2 avisos, ou legado sem kill switch 0.34 | sem aviso: mandar o **reaviso** (copiar → enviar → marcar). O prazo vira marcação + 7 dias e a conta passa para "Pronto para decidir". Legado: ver §4 onda 3 |
   | ⏳ Aprovadas | `approved` | nada — executa no ciclo das 21:25 a partir do prazo |
   | 🕒 Em contagem (recolhida) | na fila, nada a fazer hoje | nada — a linha diz o próximo marco |
   | 📨 Onda 2 — legado | contas antigas sem autorização | ver §4 |

3. Nenhum dado de saúde aparece na tela: só id curto, e-mail mascarado, motivo, datas e avisos.
4. O servidor recusa aprovar sem os avisos (FR-014) — esconder o botão não é a trava. Vale: D+60 e
   D+83; ou só o D+83 (se o D+60 se perdeu, não se manda um 2º D+83); ou o reaviso, único por linha.
5. Linha aprovada executa no ciclo das 21:25 a partir do prazo. Se o titular autorizou ou excluiu a
   conta antes, ela vira `cancelada` no Histórico, sem apagar nada.

### E-mails (FR-015)

**Remetente:** sempre `privacidade@dosiq.app` (domínio com SPF/DKIM/DMARC). Nunca de um Gmail pessoal:
é o que mais se parece com phishing.

**Como enviar:** na linha (ou na onda 2), **Copiar e-mail** → destinatário; **Copiar assunto** →
assunto; **Copiar mensagem formatada** → colar no corpo do Gmail (vai HTML com a identidade do dosiq;
num campo de texto puro, vira texto). Conferir a data na prévia ("Assunto: …" abre o texto) → enviar →
**Marcar enviado**.

Fonte única: `buildPruneEmail` em `packages/core/src/utils/pruneEmail.ts`. A tela escolhe a variante
sozinha:

| Variante | Quando | Gancho |
|---|---|---|
| `revoked` | D+60/D+83 de quem retirou a autorização | "Você retirou a autorização… exclusão em {prazo}" |
| `never_consented` | onda 2 do legado; D+60/D+83 de legado/onboarding | "Você ainda não autorizou… autorize até {prazo}" |
| `reaviso` | linha bloqueada sem os 2 avisos | "Último aviso: exclusão em {prazo}" (hoje + 7 dias) |

Todas trazem, com o endereço visível: App Store, Google Play, `dosiq.app`, Política de Privacidade e
Termos de Uso; "responda este e-mail" como contato; a frase "o dosiq nunca pede senha…"; e o rodapé com
o controlador (razão social e CNPJ). Nenhuma traz dado de saúde. Na onda 2 o prazo é hoje + 97 dias
(entra na fila 7 dias após a marcação, apaga 90 dias depois).

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

**Cadastro não confirmado (FR-016):** conta sem e-mail confirmado há mais de 30 dias (qualquer data de
criação) entra direto na fila como "Cadastro não confirmado", já em ✅ Pronto para decidir — sem onda 2,
sem aviso, sem e-mail (o endereço pode não ser do titular). Não aparece na lista da onda 2. Se a pessoa
confirmar antes da execução, a linha é cancelada (`confirmed`).

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
