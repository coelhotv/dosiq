# Dosiq Plans Migration Status

> **Onda Atual:** Wave M2 (Backlog Antigo Ativo)  
> **Status:** 🟢 WAVE M2 CONCLUÍDA — 21 FEATURES MIGRADAS  
> **Data:** 1 de junho de 2026

Este painel quantifica e acompanha a evolução da migração de conhecimento de planejamento legados em especificações e planos estruturados SDD / DEVFLOW v1.8.

---

## 📊 Métricas Consolidadas

| Métrica | Contagem | Observações |
|:---|:---|:---|
| **Total de Arquivos Inventariados** | 32 | Todos os arquivos markdown sob `plans/` |
| **Migrados (M0 + M1 + M2)** | 26 | Setup de índices + `001` a `024` |
| **Pendentes (Wave M1 - Backlog Unificado)** | 0 | Todos os itens decompostos e migrados com absoluto sucesso |
| **Pendentes (Wave M2 - Backlog Antigo)** | 0 | Deep Links + Notificações + Épico de Líquidos (decomposto em 3) migrados |
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
*   **Status:** 🟢 CONCLUÍDO (18/18 Features Concluídas — M1 100% MIGRADO)
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
    *   `plans/specs/015-ai-chatbot-mobile/`
    *   `plans/specs/016-voice-dose-registration/`
    *   `plans/specs/017-voice-dose-summary/`
    *   `plans/specs/018-anvisa-interactions-local/`

### ✉️ Wave M2 — Backlog Antigo Ativo (GATE 1)
*   **Status:** 🟢 CONCLUÍDO (01/06/2026)
*   **Features Concluídas:**
    *   `plans/specs/019-universal-links-web-banner/`
    *   `plans/specs/020-notification-copy-metrics/`
    *   `plans/specs/021-telegram-snooze-dose/`
    *   `plans/specs/022-liquid-medications-db-backend/`
    *   `plans/specs/023-liquid-medications-core-api/`
    *   `plans/specs/024-liquid-medications-ui-bot/`
*   **Total de features atômicas restantes a criar:** 0
*   **Entregáveis por feature:** `spec.md`, `plan.md`, `tasks.md`, `analysis.md`, `checklists/requirements.md`

### 📚 Wave M3 — Estratégia, Referências e Histórico
*   **Status:** 🟢 CONCLUÍDO (Catalogado no M0 como deferred/excluded, sem tarefas ativas)

---

## 📋 Qualidade e Rastreabilidade (Gate Loop)

A migração de specs e planos da Wave M2 seguiu rigidamente as seguintes regras de governança para que agentes coders futuros as implementem com sucesso:
*   [x] **Zero placeholders**: todos os DoDs e critérios de aceitação legados mantidos.
*   [x] **Zod 4 schemas**: schemas Zod especificados para validação em `@dosiq/core/schemas/` (Regra R-021).
*   [x] **Integração profunda com `dose_instances`**: acoplamento total de logs e snooze ao modelo materializado, eliminando redundâncias.
*   [x] **SQP R-221 checkpoints**: tarefas de SemVer, changelog em português e validação de lint zero incluídas em todos os `plan.md` e `tasks.md`.
