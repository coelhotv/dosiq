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

## Tabela de status (atualizada 2026-06-10)

| # | Spec | Status | Evidência / Nota |
|---|------|--------|------------------|
| 001 | native-alarm-persistent | **delivered** | mergeado 2026-06-03 (alarme v1; base da 010) |
| 002 | caregiver-demand-teaser | draft | migrated draft |
| 003 | patient-dose-history | ⚠️ auditar | histórico de doses mobile EXISTE em prod (CHANGELOG 0.15.3) — conferir se cobre 100% da spec |
| 004 | expanded-adherence-dashboard | ⚠️ auditar | drill-down de adesão citado como entregue nos mocks Fase 5 — conferir código |
| 005 | consultation-mode-profile | ⚠️ auditar | Modo Consulta aparece como entregue no handoff de design — conferir código |
| 006 | public-emergency-qr-card | draft | migrated draft |
| 007 | medical-pdf-report | planned | backlog; nota de coordenação c/ 012 Fase E (2026-06-10) |
| 008 | complete-data-export-lgpd | draft | backlog; DEVE incluir `biomarkers_log` (nota 2026-06-10) |
| 009 | caregiver-mode | **specified** | próximo grande épico do roadmap; NÃO implementado; nota biomarkers (2026-06-10) |
| 010 | native-alarm-v2 | planned | ADR-055/056; pré-req = 011 |
| 011 | notifications-from-instances | ⚠️ auditar | ADR-057; era pré-req da 010 — conferir se mergeado |
| 012 | diabetes-t2-support | **planned** | aguarda coding Fase A; ADR-058..062 accepted; design Fase C foldado |
| 013 | whatsapp-bot-adapter | draft | migrated draft |
| 014 | whatsapp-templates-webhook | draft | migrated draft |
| 015 | ai-chatbot-mobile | draft | migrated draft |
| 016 | voice-dose-registration | draft | migrated draft |
| 017 | voice-dose-summary | draft | migrated draft |
| 018 | anvisa-interactions-local | draft | migrated draft |
| 019 | universal-links-web-banner | draft | migrated draft |
| 020 | notification-copy-metrics | specified | dev ready, não iniciado |
| 021 | telegram-snooze-dose | specified | dev ready, não iniciado |
| 022 | liquid-medications | **delivered** | PRs #650 (A) #651 (B) #652 (C), 2026-06-08 |
| 023 | user-feedback | ⚠️ auditar | header "Dev Ready" — conferir se entregue |
| 024 | node22-upgrade | **delivered** | header IMPLEMENTED |
| 025 | fix-notifications-alarms | ⚠️ auditar | header "APPROVED" (ambíguo) — conferir merge |
| 026 | activation-strategy | **in-progress** | Fase 1 (nudges in-app) entregue PR #653; demais fases pendentes |
| 027 | pomadas-topicas | draft | não iniciar sem priorização do PO |
| 028 | nudges-admin | ⚠️ auditar | "specified"; relação com 026 Fase 1 — conferir |

> ⚠️ **auditar** = status real não confirmado contra PRs/prod nesta data. Primeira sessão que tocar
> a spec (ou o próximo distill) resolve e atualiza a linha. NÃO assumir delivered nem pending.
