# plans/specs/ — Índice de Status (fonte de verdade)

> **Propósito:** agentes/consultores NÃO devem inferir o status de uma spec pelo header dela
> (histórico de drift: 001 dizia "Dev Ready" já entregue). **Este README é o índice canônico**;
> o header `**Status**` de cada spec deve espelhá-lo. Divergência → vale o README + evidência (PR#).
>
> **Manutenção (R-275):** todo C5 pós-merge que entrega (total ou parcialmente) uma spec DEVE
> atualizar (1) a linha desta tabela com o PR# e (2) o header `**Status**` da spec. Distill (D5)
> reconcilia.

## Vocabulário canônico (único permitido)

| Status | Significado |
|--------|-------------|
| `draft` | ideia/rascunho; não passou por specifying completo ou aguarda clarificação/priorização |
| `specified` | spec.md completa (S6); sem plan/tasks |
| `planned` | plan.md + tasks.md prontos (P4); aguarda coding |
| `in-progress` | coding iniciado; PRs parciais mergeados (anotar fases entregues) |
| `delivered` | 100% mergeado em prod (anotar PRs) |
| `superseded` | substituída/absorvida por outra spec (apontar qual) |

## Tabela de status (atualizada 2026-06-16)

| # | Spec | Status | Evidência / Nota |
|---|------|--------|------------------|
| 001 | native-alarm-persistent | **delivered** | mergeado 2026-06-03 (alarme v1; base da 010) |
| 002 | caregiver-demand-teaser | draft | migrated draft |
| 003 | patient-dose-history | **delivered** | PR #641 + evoluções em 0.15.x (CHANGELOG) |
| 004 | expanded-adherence-dashboard | draft | PO 2026-06-10: não entregue como spec'ado (mocks Fase 5 ≠ código) |
| 005 | consultation-mode-profile | draft | PO 2026-06-10: não entregue como spec'ado; **2026-06-15 absorve 012 (descope Fase E): líquidos/injetáveis + tendência de biomarkers** |
| 006 | public-emergency-qr-card | draft | migrated draft; **2026-06-15 absorve 012: líquidos/injetáveis em meds críticos (sem biomarkers)** |
| 007 | medical-pdf-report | planned | backlog; **2026-06-15 absorve a Fase E do 012 (FR-016 dose×biomarcador server-side) + líquidos/injetáveis → Tier 2** |
| 008 | complete-data-export-lgpd | draft | backlog; **2026-06-15 `biomarkers_log` promovido a FR-006 + colunas líquidos/injetáveis do 012 no inventário** |
| 009 | caregiver-mode | **specified** | próximo grande épico do roadmap; NÃO implementado; nota biomarkers (2026-06-10) |
| 010 | native-alarm-v2 | **delivered** | PR #634 (mobile 0.10.0, 🔴 corrigido na auditoria — estava "planned"); ADR-055/056 |
| 011 | notifications-from-instances | **delivered** | PR #633 (reminder ← dose_instances); ADR-057 |
| 012 | diabetes-t2-support | **delivered** | **Épico fechado A→D (2026-06-15)**. A injetável+TTL (#658) · B GLP-1/titulação (#659) · B2 canetas mg (#660) · B3 units_per_ml NULL (#661) · B4 dose-primário+container (#663/#664) · C biomarkers (#665/#666) · D FR-015b+relatórios (#667). ADR-058..068. **Fase E DESCOPED → redistribuída p/ 005/006/007/008**; FR-016 → 007 |
| 013 | whatsapp-bot-adapter | draft | migrated draft |
| 014 | whatsapp-templates-webhook | draft | migrated draft |
| 015 | ai-chatbot-mobile | draft | migrated draft |
| 016 | voice-dose-registration | draft | migrated draft |
| 017 | voice-dose-summary | draft | migrated draft |
| 018 | anvisa-interactions-local | draft | migrated draft |
| 019 | universal-links-web-banner | **delivered** | PR #607 (Web Push Dispatcher + PWA Deep Linking); confirmado PO 2026-06-10 |
| 020 | notification-copy-metrics | specified | dev ready, não iniciado |
| 021 | telegram-snooze-dose | specified | dev ready, não iniciado |
| 022 | liquid-medications | **delivered** | PRs #650 (A) #651 (B) #652 (C), 2026-06-08 |
| 023 | user-feedback | **delivered** | PRs #639/#640 (web 4.1.0 · mobile 0.11.0) |
| 024 | node22-upgrade | **delivered** | PRs #642/#643 |
| 025 | fix-notifications-alarms | **delivered** | PRs #644/#645/#646/#647 |
| 026 | activation-strategy | **in-progress** | Fase 1 (nudges in-app) entregue PR #653; demais fases pendentes |
| 027 | topical-ointments | draft | não iniciar sem priorização do PO |
| 028 | nudges-admin | **in-progress** | PR #654 (payload builder) mergeado; restante pendente |
| 029 | treatment-level-titration | draft | N2 — titulação plano-nível cross-medicamento; nasce da limitação exposta no 012 (FR-021/N1); não iniciar sem priorização do PO; depende de 012 B2 |
| 030 | fix-dose-history | **delivered** | PR #668 (web 4.8.1 · mobile 0.17.1) mergeado 2026-06-15. Doses avulsas/PRN no histórico + ícone/chip status mobile; fix ghost taken (web) + furo estoque (mobile, AP-231) + hint líquido. Descoberto no smoke da B4 do 012 |
| 031 | injection-site-rotation | **planned** | plan.md+tasks.md (P4, 2026-06-21); 10 POs; eng-review (6 findings); ADR-072 proposed; slice 031-A(wedge)/031-B(edit+hint); Tier 2; aguarda coding |
| 032 | biomarker-pa | **delivered** | PR #669 (core+mobile 0.18.0) + PR #670 (web 4.9.0) mergeados 2026-06-16. ADR-070 (context extensível, DROP CHECK). Hotfix caret iOS → 0.18.1 (main direto) |
| 033 | mobile-history-timeline-refactor | **delivered** | PR #671 mergeado 2026-06-16 (mobile 0.19.0). `historyTimelineService.js` (service-first, CON-023+CON-025) + `mapToMobileShape` (anti-corruption) + `BiomarkerHistoryCard` (tap→MeasureDetailSheet) + refactor `useHistoryData.js` + `HistoryScreen.jsx` (MeasureLogSheet inline, onSaved→measuresRepo) + fix DoseActionSheet instanceId (AP-193) + WeekCalendar filtra type==='dose' (ADR-054). 16 testes unit. Mobile-only (web/core intactos) |
| 034 | gemini-sunset | planned | Tier 2 — substituição do `gemini-code-assist` (sunset ~07/2026) por revisor IA independente OAuth; plan+tasks+checklist prontos; ADR-069 (proposed); aguarda coding |
| 036 | fix-alarm-stale-snooze | **delivered** | PR #672 (mobile `0.19.1`) mergeado 2026-06-17. Tier 1 hotfix — (1) cancel-on-resolve cross-superfície em `registerDose`/`Many` + auto-dismiss `AlarmFullScreen` (revalida `dose_instances.status`; grupo cancela id=ts + ids individuais); (2) transparência clínica: full-screen mostra ícone contextual (`MedicineIcon`) + concentração + quantidade (`formatMedicineConcentration`/`formatDoseItem`, corrige "un." hardcoded da 012), layout single reordenado. AP-235. Mobile-only |
| 035 | unified-dose-log-stock-core | **in-progress** | Implementação concluída, aguardando aprovação do PR `refactor/w25/035-unified-dose-log-stock-core` |

