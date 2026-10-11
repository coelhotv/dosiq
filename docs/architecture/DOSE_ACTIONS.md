---
title: "Ações da dose — matriz de caminhos (Tomar · Adiar/Soneca · Pular)"
description: "Cada ação sobre uma dose, por entrada (notificação, Live Activity, tela cheia, superfície Android, app aberto, servidor): quem executa, com que dados, e qual função única termina o efeito."
version: "1.0.0"
status: active
category: architecture
audience:
  - dev
  - agent
tags:
  - alarmes
  - live-activity
  - soneca
  - notificacoes
created_at: "2026-10-11"
updated_at: "2026-10-11"
---

# Ações da dose — matriz de caminhos

> **Por que existe:** a spec 101 teve 32 achados de smoke; a maior classe (10) foi a mesma ação com
> várias entradas e uma delas sem o efeito (R-324). Este doc é a matriz preenchida do estado atual.
> Spec que toca alarme, soneca, superfície ou push **parte daqui** no C1.5 e atualiza as linhas que mudar.
> Comportamento de plataforma citado como `P-N` está em
> [DOSE_LIVE_ACTIVITY.md §Contratos de plataforma](./DOSE_LIVE_ACTIVITY.md#contratos-de-plataforma-verificados-ap-257).

## Pontos únicos

Toda entrada de uma ação termina na mesma função; o efeito colateral mora nela, não no caminho.

| Ação | Função única | Arquivo | Efeitos que ela garante |
|---|---|---|---|
| **Tomar** | `registerTaken` → `registerDose` | `platform/alarms/quickDoseRegistration.ts` · `features/dose/services/doseService.ts` | `medicine_log` pela via canônica; cancela o alarme; card `done` (Android) / `triggerDoseActivityRefresh` (iOS, app vivo) |
| **Pular** | `registerSkip` → `skipDose` (RPC) | `platform/alarms/quickDoseRegistration.ts` · `@dosiq/core` | `status='skipped_user'`, instante decidido pelo banco; recusa fora da janela; auditoria crítica |
| **Adiar / Soneca** | `scheduleSnooze` | `platform/alarms/alarmService.ts` | ver abaixo |
| **Registrar** (LA / superfície) | `navigateToDose` / `navigateSurfaceRegister` | `DoseLiveActivityBridge.ts` · `quickDoseRegistration.ts` | **não registra**: abre a modal (sítio de injetável só lá) |

### O que `scheduleSnooze` faz (em ordem)

1. `cancelAlarm` — mata o som do alarme atual.
2. Recusa fora da janela (067 A2) ⇒ `false`.
3. **Contagem:** `max(currentSnoozeAttempt do chamador, getSnoozeAttempts() local) + 1`; acima de
   `MAX_SNOOZE_ATTEMPTS` (3) ⇒ `false` (C-25/C-28 — o chamador pode não saber a tentativa).
4. **Âncora:** `max(agora, scheduled_for) + 5 min` — a soneca nunca antecipa o aviso (FR-002).
5. Agenda o alarme (notifee) com o `data` recebido + `snoozeAttempt` + `snoozedUntil`.
6. `_anchorAndDeferSurface`: grava âncora e contagem locais; tira a superfície Android até a âncora;
   **encerra a LA iOS** se a dose é crítica (C-24).
7. `setSnoozedUntil` no banco (o `syncAlarms` respeita; o servidor recria a LA a partir dele).
8. Auditoria `snoozed` (prova da soneca para o gate de push crítico — 082 D1; ordem travada por teste).
9. Retorna `{ fireAt }` — fonte única do "Alarme reagendado para HH:MM".

Quem chama **tem de** passar o `data` completo do alarme (`buildSingleAlarmData(doseItem)`), senão a
notificação da soneca sai sem concentração/horário e o "Tomei" dela fica sem protocolo (C-32).

## Matriz

Legenda — *Executa*: `headless` = JS sem UI (P-6); `foreground` = só quando o app abre.

### Tomar

| Entrada | Plataforma | App | Executa | Dados | Resultado |
|---|---|---|---|---|---|
| "Tomei" da notificação do alarme | iOS · Android | qualquer | headless | `data` do alarme | `registerTaken`; iOS: LA vira `done`/encerra pelo servidor (`RESOLVED_STATUSES`, ≤ 1 min) |
| "Tomei" da tela cheia | Android | aberto (tela) | foreground | `data` do alarme | `registerTaken`; recusa vira `Alert` |
| "Registrar" da LA | iOS ≥ 17 | qualquer | enfileira → foreground (P-6) | `instanceId` → `resolveDoseItem` | abre a modal; **exige sessão validada** (`liveUserId`) |
| "Registrar" da superfície | Android | qualquer | abre o app | `data` da superfície | abre a modal bulk |
| Tela Hoje | ambas | aberto | foreground | banco | `registerDose`; iOS refresca a LA na hora |

### Adiar / Soneca

| Entrada | Plataforma | App | Rede | Executa | Dados | Resultado |
|---|---|---|---|---|---|---|
| "Soneca 5 min" da notificação | iOS · Android | qualquer | on · off | headless | `data` do alarme (`snoozeAttempt` incluso) | `scheduleSnooze`; LA iOS encerra na hora |
| "Adiar" da tela cheia | Android | aberto (tela) | on · off | foreground | `data` do alarme | `scheduleSnooze` |
| "Adiar" da superfície | Android | qualquer | on · off | headless (mapeado p/ `SNOOZE`) | `data` da superfície | `scheduleSnooze`, `source = DOSE_ACTIVITY` |
| "Adiar" da LA | iOS ≥ 17 | qualquer | on | enfileira → foreground (P-6) | `instanceId` → banco → `buildSingleAlarmData` | `scheduleSnooze` + toast "Alarme reagendado para HH:MM" |
| "Adiar" da LA | iOS ≥ 17 | qualquer | **off** | enfileira → foreground | `getCachedDoseItem` (último derive online — C-31) + sessão local (`getSession`, P-8) | idem; banco/auditoria falham fail-open |
| Recusa (teto) | todas | — | — | — | — | `false`; na LA: toast "Limite de 3 sonecas atingido. Tome ou pule a dose." |
| Volta da soneca | iOS | fechado | on | servidor (cron, claim do minuto) | `snoozed_until` | LA recriada já em `now` até `SNOOZE_RETURN_LEAD_MS` (90 s) antes da âncora + alarme local toca na âncora |
| Volta da soneca | Android | qualquer | — | trigger notifee | âncora no `data` | `reconcileDoseActivityFromAlarm` re-arma a superfície em `now` |

### Pular

| Entrada | Plataforma | App | Executa | Resultado |
|---|---|---|---|---|
| "Pular" da notificação | iOS · Android | qualquer | headless | `registerSkip`; Android tira a superfície (C-12); iOS: servidor encerra a LA (`skipped_user` ∈ `RESOLVED_STATUSES`, C-29) |
| "Pular" da tela cheia | Android | aberto (tela) | foreground | `registerSkip`; recusa vira `Alert` |
| LA / superfície | — | — | — | **sem botão de Pular** (de propósito: ação destrutiva só com contexto) |

## Invariantes

- **Uma LA por vez.** O `start` nativo encerra as existentes; a LA remota que chega depois encerra as
  outras pelo observer de `activityUpdates` (P-7, C-30).
- **Superfície por notificação é só Android.** Toda função exportada de `doseActivityScheduler`
  retorna cedo fora do Android, na própria função (AP-364); o resync do iOS limpa resíduos `:surface`.
- **Offline, só a soneca segue sem sessão validada.** Registrar/Pular gravam em conta e exigem
  `getUser` (PO-SEC-2).
- **Clocks (R-288):** cron 1×/min; âncora com segundos; desalinhamento LA × alarme de até 60 s é
  conhecido (spec 103, fatia E).

## Como manter

Ação nova, entrada nova ou mudança de quem executa ⇒ linha nova aqui **no mesmo PR**, e cada célula
alterada vira caso de smoke (R-234). Célula que ninguém sabe preencher = spike no device (AP-257).
