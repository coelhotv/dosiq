# Dosiq Plans Migration Status

> **Onda Atual:** M0 + M1 (Setup e Backlog Unificado)  
> **Status:** 🟡 ETAPA 1 PARCIALMENTE MIGRADA — 2 FEATURES COMPLETAS  
> **Data:** 31 de maio de 2026

Este painel quantifica e acompanha a evolução da migração de conhecimento de planejamento legados em especificações e planos estruturados SDD / DEVFLOW v1.8.

---

## 📊 Métricas Consolidadas

| Métrica | Contagem | Observações |
|:---|:---|:---|
| **Total de Arquivos Inventariados** | 31 | Todos os arquivos markdown sob `plans/` |
| **Migrados (M0 + M1 + M2)** | 16 | Setup de índices concluído + `001` a `014` |
| **Pendentes (Wave M1 - Backlog Unificado)** | 4 | Mapeados para serem migrados em diretórios atômicos nesta etapa |
| **Pendentes (Wave M2 - Backlog Antigo)** | 2 | `plans/backlog-notifications/` + Deep Links |
| **Adiados (Deferred)** | 4 | Sound Identity, Caregiver Draft, ANVISA DDI spike, Signup Premium |
| **Excluídos / Arquivados (Excluded)** | 5 | Antigos arquivos de produto / estratégia geral de referência |
| **Excluídos por Obsolecência (Obsolete)** | 12 | Antigos planos de features já construídas ou versões de specs superadas |

---

## 🚀 Acompanhamento por Ondas

### 📋 Wave M0 — Setup e Mapeamento Inicial (GATE 0)
*   **Status:** 🟢 CONCLUÍDO (31/05/2026)
*   **Arquivos Criados:**
    *   `plans/specs/MIGRATION_INDEX.md`
    *   `plans/specs/MIGRATION_STATUS.md`

### 📱 Wave M1 — Backlog Unificado 2026 (Etapa 1 Combinada)
*   **Status:** 🟡 EM ANDAMENTO (14/18 Features Concluídas — LOTE 2 COMPLETO)
*   **Features Concluídas:**
    *   `plans/specs/001-native-alarm-persistent/`
    *   `plans/specs/002-caregiver-demand-teaser/`
    *   `plans/specs/003-patient-dose-history/`
    *   `plans/specs/004-expanded-adherence-dashboard/`
    *   `plans/specs/005-consultation-mode-profile/`
    *   `plans/specs/006-public-emergency-qr-card/`
    *   `plans/specs/007-medical-pdf-report/`
    *   `plans/specs/008-complete-data-export-lgpd/`
    *   `plans/specs/009-caregiver-setup-flow/`
    *   `plans/specs/010-caregiver-links-rls/`
    *   `plans/specs/011-caregiver-dashboard/`
    *   `plans/specs/012-medical-observer-dashboard/`
    *   `plans/specs/013-whatsapp-bot-adapter/`
    *   `plans/specs/014-whatsapp-templates-webhook/`
*   **Total de features atômicas restantes a criar:** 4 (IDs `015` a `018`)
*   **Entregáveis por feature:** `spec.md`, `plan.md`, `tasks.md`, `analysis.md`, `checklists/requirements.md`

### ✉️ Wave M2 — Backlog Antigo Ativo (GATE 1)
*   **Status:** ⬚ PENDENTE
*   **Total de features atômicas a criar:** 2 (`019` Deep Links, `020` Notifications Revamp)

### 📚 Wave M3 — Estratégia, Referências e Histórico
*   **Status:** 🟢 CONCLUÍDO (Catalogado no M0 como deferred/excluded, sem tarefas ativas)

---

## 📋 Qualidade e Rastreabilidade (Gate Loop)

A migração de specs e planos da Wave M1 seguirá rigidamente as seguintes regras de governança para que agentes coders futuros as implementem com sucesso:
*   [x] **Zero placeholders**: todos os DoDs e critérios de aceitação legados mantidos.
*   [x] **Zod 4 schemas**: schemas Zod especificados para validação em `@dosiq/core/schemas/` (Regra R-021).
*   [x] **Decommission Expo Go**: aviso mandatório em todas as specs mobile exigindo Development Builds.
*   [x] **SQP R-221 checkpoints**: tarefas de SemVer, changelog em português e validação de lint zero incluídas em todos os `plan.md` e `tasks.md`.
