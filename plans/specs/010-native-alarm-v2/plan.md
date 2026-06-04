# Plan: Alarme Nativo v2 — Critical Alerts iOS + Crítico por-protocolo

**Spec:** `spec.md` · **Tier:** 2 (Epic) · **Status:** Planned (Planning) · **Pré-req:** spec 011 (ADR-057)
**ADRs:** ADR-055 (modelo de dado, proposed), ADR-056 (roteamento, proposed — **re-escopo pós-011**)
**Contracts:** CON-024 (DoseItem — aditivo), CON-019/CON-021 (notif payload)

> **Reconciliação com a 011 (2026-06-03):** a 011 (ADR-057) move o reminder p/ ler `dose_instances`.
> Isso torna a FR-003/Q3 (dispatcher usa `dose_instances.critical_alarm` como fonte primária)
> literalmente verdadeira e **elimina o hack de duas fontes** que a versão original do ADR-056
> usava (split lendo `protocols.critical_alarm`). C3 da 010 só inicia **após a 011 mergeada**.

---

## Summary

Granularidade **por-tratamento** do alarme crítico (aposenta o toggle global v1) + upgrade
iOS Critical Alerts (com fallback) + controle de sobreposição **per-dose** com o push normal
+ wire completo com `dose_instances` (critical_alarm materializado, snoozed_until pela soneca).

## Technical Context (evidência real — file:line)

| Peça | Evidência | Nota |
|------|-----------|------|
| Tabela de tratamento | `protocols` (`docs/migrations/20260526_add_weekdays_to_protocols.sql:4` — padrão ADD COLUMN) | é `protocols`, não `treatment_plans` (este é agrupador) |
| Gerador de instâncias | `packages/core/src/utils/doseInstanceGenerator.js:183-186` (monta `{protocol_id, scheduled_for, expected_dose, tolerance_minutes}`) | add `critical_alarm` aqui |
| dose_instances schema | `docs/architecture/DOSE_INSTANCES.md:46-61` (`snoozed_until` ociosa l.58) | 2 colunas: nova `critical_alarm` + uso de `snoozed_until` |
| Mobile scheduler | `apps/mobile/src/platform/alarms/useAlarmScheduler.js:52-53` (`buildDoseItemsFromInstances(...).filter(it=>it.status==='pending')`) | add `.filter(it=>it.critical)` |
| DoseItem shape | `packages/core/src/utils/doseZones.js:134-144` (`{instanceId, protocolId, status, ...}`) | add `critical: instance.critical_alarm` |
| Server reminder | `server/bot/_reminderHelpers.js` — **pós-011 lê `dose_instances`** (ADR-057), não `protocols` | dose já carrega `critical_alarm` materializado → split no partition lê a coluna direto |
| Gate v1 atual | `server/notifications/channels/expoPushChannel.js:11-25` (`DOSE_REMINDER_KINDS`, `filter(d=>!d.native_alarm_enabled)`) | ressemantizar p/ per-dose-criticality + capacidade |
| Canais por usuário | `server/notifications/policies/resolveChannelsForUser.js` | inalterado; computa rota |
| v1 skip→DB | `apps/mobile/src/platform/alarms/quickDoseRegistration.js:68` (`status='skipped_user'`) | já alinhado |
| v1 snooze | `apps/mobile/src/platform/alarms/alarmService.js` `scheduleSnooze` (sem DB) | add write `snoozed_until` |
| RPC device | `docs/migrations/20260603_native_alarm_enabled_device_flag.sql` | base do flag de capacidade |
| iOS interruption | `apps/mobile/src/platform/alarms/alarmService.js:35` (`IOS_INTERRUPTION_LEVEL='timeSensitive'`) | promover a 'critical' condicional |

## Constitution Check
- **V** (ADR p/ mudança de payload/rota de notif) → ADR-056 cobre. ✓
- **VI** (SQP) → bump mobile minor (target v0.9.1); CHANGELOG PT; store-note. ✓
- **VII** (PO smoke + human merge) → smoke obrigatório (alarme×push). ✓
- **I** (health data) → migração default false; sem mutar prod em teste (fixtures). ✓
- **III** (server-side aggregation) → gate no server, não no client. ✓

## Architecture / Approach

### Camada 1 — Dados (ADR-055)
- Migration: `protocols.critical_alarm` + `dose_instances.critical_alarm` (default false).
- `doseInstanceGenerator` materializa `critical_alarm` da flag do protocolo.
- Re-materialização no edit do protocolo (`syncInstancesOnWrite` — wipe+regen futuro).

### Camada 2 — Mobile scheduler
- `buildDoseItemsFromInstances` → DoseItem ganha `critical` (CON-024 aditivo).
- `useAlarmScheduler.syncAlarms` filtra `critical===true` (além de pending).
- Toggle global v1 (`AlarmToggleSection`) **aposentado**; novo toggle por-tratamento
  na tela de detalhe/edição; hint de migração pros que tinham global ON.
- Permissão SO no ponto de intenção ao ligar (R-239); FR-006b.

### Camada 3 — Soneca → dose_instances (FR-010)
- `scheduleSnooze` passa a gravar `dose_instances.snoozed_until = now+5min` (via repo).
- `syncAlarms` respeita `snoozed_until` (não reagenda antes); limpa ao resolver.

### Camada 4 — Roteamento server (ADR-056, sobre a fonte da 011)
- `_reminderHelpers` (pós-011 já lê `dose_instances`): cada dose carrega `critical_alarm`
  materializado; partition **separa** críticas dos blocos de push (críticas não geram push —
  o alarme cobre). Sem segundo SELECT em `protocols`.
- `expoPushChannel`: filtro ressemantizado → para dose crítica, suprime devices **com
  capacidade** de alarme; device sem capacidade recebe (fallback).

### Camada 5 — iOS Critical Alerts
- Entitlement `...critical-alerts` declarado **condicionalmente** (só quando aprovado;
  R-259 — não declarar antes, profile falha). `IOS_INTERRUPTION_LEVEL`→`'critical'` +
  `critical:true` p/ doses críticas; fallback `timeSensitive`.

## Target Files (verificados)

| Arquivo | Ação | Verif |
|---------|------|-------|
| `docs/migrations/2026XXXX_critical_alarm.sql` | NEW — 2 colunas + grants/RLS | ✅ padrão |
| `packages/core/src/utils/doseInstanceGenerator.js` | materializa critical_alarm | ✅ :183 |
| `packages/core/src/utils/doseZones.js` | DoseItem.critical | ✅ :134 |
| `packages/core/src/repositories/createDoseInstanceRepository.js` | setSnoozedUntil + select critical | ✅ |
| `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | filtro critical + snoozed | ✅ :52 |
| `apps/mobile/src/platform/alarms/alarmService.js` | snooze→DB + iOS critical | ✅ |
| `apps/mobile/src/platform/alarms/quickDoseRegistration.js` | limpar snoozed ao resolver | ✅ |
| `apps/mobile/src/features/treatments/.../<detalhe-edição>` | toggle por-tratamento | ⚠️ localizar no C1 |
| `apps/mobile/src/features/profile/components/AlarmToggleSection.jsx` | aposentar/hint | ✅ |
| `server/bot/_reminderHelpers.js` | split partition por `dose_instances.critical_alarm` (fonte já trocada pela 011) | ✅ (depende da 011) |
| `server/bot/utils/partitionDoses.js` | split crítico×normal | ⚠️ confirmar no C1 |
| `server/notifications/channels/expoPushChannel.js` | gate per-dose+capacidade | ✅ :11 |
| `apps/mobile/app.config.js` + `ios/Dosiq.entitlements` | critical-alerts condicional | ✅ |

## Risks + Quality Gates
- **R1 (resolvido pela 011):** o reminder passa a ler `dose_instances` (ADR-057), então o gate
  server lê `dose_instances.critical_alarm` direto (fonte única). **Dependência:** C3 da 010 só
  após a 011 mergeada. (Original: reminder lia `protocols` → exigia hack de duas fontes; eliminado.)
- **R2:** bloco misto (R-191) → split per-dose obrigatório (ADR-056).
- **R3:** device sem capacidade não pode ficar sem notificação (fallback no expoPushChannel).
- **R4:** entitlement Critical Alerts não aprovado → fallback timeSensitive (sem crash).
- **R5:** migração + materialização — AP-209 (deploy ordering), AP-201 (view security_invoker).
- Gates: `rtk lint` 0 erros · `rtk npm run validate:agent` · jest mobile · vitest server ·
  smoke PO (alarme×push, 2 tratamentos) · SQP.

## Clarifications (P1.5)
- Q1/Q2/Q2b/Q3 resolvidos no spec.md (Clarifications). **Reconciliação pós-011:** a 011
  (ADR-057) move o reminder p/ `dose_instances` → gate server lê `dose_instances.critical_alarm`
  direto (fonte única), confirmando a FR-003/Q3. Eliminado o gate por `protocols.critical_alarm`.
- Pendente decisão de implementação (não bloqueia plano): split no `partitionDoses` via novo
  kind vs flag no bloco → decidir no C1 ao ler `partitionDoses.js`.
