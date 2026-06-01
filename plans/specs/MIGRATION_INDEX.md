# Dosiq Plans Migration Index

> **Onda:** M0 + M1 (Setup e Backlog Unificado)  
> **Status Geral:** 🟡 ETAPA 1 PARCIALMENTE MIGRADA — 2 FEATURES COMPLETAS  
> **Data:** 31 de maio de 2026

Este índice cataloga todos os arquivos legados de especificações e planos de desenvolvimento localizados sob a pasta `plans/`, classificando cada um de acordo com as regras de **Spec-Driven Development (SDD)** do Dosiq e delineando o plano de decomposição em especificações atômicas de feature.

---

## 🗺️ Mapa de Migração de Planos

| Legacy Path | Class | Target Spec Dir / Action | Status | Notes |
|:---|:---|:---|:---|:---|
| **Backlog Unificado 2026** | | | | |
| `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md` | `active_exec_spec` | `plans/specs/001-native-alarm-persistent/` | `migrated` | Alarme local invasivo via Notifee. Decommission do Expo Go. |
| `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md` | `active_exec_spec` | `plans/specs/002-caregiver-demand-teaser/` | `migrated` | Painted door test do Modo Cuidador na ProfileScreen. |
| `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` | `master_plan` | **Decomposição em 6 sub-features atômicas:**<br>• `plans/specs/003-patient-dose-history/`<br>• `plans/specs/004-expanded-adherence-dashboard/`<br>• `plans/specs/005-consultation-mode-profile/`<br>• `plans/specs/006-public-emergency-qr-card/`<br>• `plans/specs/007-medical-pdf-report/`<br>• `plans/specs/008-complete-data-export-lgpd/` | `migrated` | Decomposição em 6 sub-features atômicas ativadas e criadas em conformidade SQP R-221. |
| `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` | `master_plan` | **Decomposição em 6 sub-features atômicas:**<br>• `plans/specs/009-caregiver-setup-flow/`<br>• `plans/specs/010-caregiver-links-rls/`<br>• `plans/specs/011-caregiver-dashboard/`<br>• `plans/specs/012-medical-observer-dashboard/`<br>• `plans/specs/013-whatsapp-bot-adapter/`<br>• `plans/specs/014-whatsapp-templates-webhook/` | `migrated` | Decomposição em 6 sub-features atômicas ativadas e criadas em conformidade SQP R-221. |
| `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` | `master_plan` | **Decomposição em 4 sub-features atômicas:**<br>• `plans/specs/015-ai-chatbot-mobile/`<br>• `plans/specs/016-voice-dose-registration/`<br>• `plans/specs/017-voice-dose-summary/`<br>• `plans/specs/018-anvisa-interactions-local/` | `pending` | IA, voz nativa (decommission Expo Go) e interações ANVISA lazy-loaded. |
| `plans/backlog-unified_app_2026/BACKLOG_TRIGGER_GATED.md` | `master_plan` | `plans/specs/BACKLOG_TRIGGER_GATED.md` (Emenda) | `migrated` | Atualizado com justificativa e descarte de C02 (Parceiro de Responsabilidade). |
| `plans/backlog-unified_app_2026/DRAFT_CAREGIVER_MODE.md` | `prd` | Usado como referência para `009-caregiver-setup-flow` etc. | `deferred` | Não migrar como spec executável; manter como referência histórica. |
| `plans/backlog-unified_app_2026/UNIFIED_ROADMAP_2026.md` | `master_plan` | `plans/backlog-unified_app_2026/UNIFIED_ROADMAP_2026.md` (Revisão) | `migrated` | Roadmap estratégico do ecossistema. Atualizado. |
| `plans/backlog-unified_app_2026/sound-identity-draft.md` | `strategy` | Referenciável em `001-native-alarm-persistent`. | `deferred` | Não migrar como spec executável. |
| **Backlogs Antigos & Roadmap V4** | | | | |
| `plans/backlog-native_app/EXEC_SPEC_DEEPLINK_UNIVERSAL_LINKS_WEB_BANNER.md` | `active_exec_spec` | `plans/specs/019-universal-links-web-banner/` | `pending` | A ser migrado na Wave M2 (Deep Links). |
| `plans/backlog-native_app/EXEC_SPEC_FASE1_MEDICAMENTOS.md` | `active_exec_spec` | N/A (Mapeado como referência concluída) | `excluded` | Funcionalidade CRUD Medicamentos concluída em produção. |
| `plans/backlog-native_app/EXEC_SPEC_FASE2_PROTOCOLOS.md` | `active_exec_spec` | N/A (Mapeado como referência concluída) | `excluded` | Funcionalidade CRUD Protocolos concluída em produção. |
| `plans/backlog-native_app/EXEC_SPEC_FASE3_ESTOQUE.md` | `active_exec_spec` | N/A (Mapeado como referência concluída) | `excluded` | Funcionalidade CRUD Estoque concluída em produção. |
| `plans/backlog-native_app/EXEC_SPEC_FASE4_PERFIL.md` | `active_exec_spec` | N/A (Mapeado como referência concluída) | `excluded` | Funcionalidade Perfil concluída em produção. |
| `plans/backlog-native_app/EXEC_SPEC_FASE5_ANALITICAS.md` | `active_exec_spec` | N/A (Mapeado como referência concluída) | `excluded` | Funcionalidade antiga substituída pelas analíticas da Fase 5 (003/004). |
| `plans/backlog-native_app/EXEC_SPEC_PRE_REQUISITOS.md` | `active_exec_spec` | N/A (Referência de setup concluída) | `excluded` | Setup do projeto React Native concluído. |
| `plans/backlog-native_app/EXEC_SPEC_SIGNUP_PREMIUM_ABRIR_EMAIL.md` | `active_exec_spec` | Deferido para otimização de onboarding futuro | `deferred` | Fora do escopo atual de paridade. |
| `plans/backlog-native_app/INDEX_EXEC_SPECS.md` | `index` | N/A (Referência de qualidade) | `excluded` | Índice de especificações nativas legadas. |
| `plans/backlog-native_app/MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md` | `master_plan` | N/A (Histórico de arquitetura) | `excluded` | Concluído e superado pelas implementações. |
| `plans/backlog-native_app/RETRO_FASE1_CRUD_MEDICAMENTOS.md` | `retro` | N/A (Aprendizados DEVFLOW) | `excluded` | Lições incorporadas nas regras da pasta `.agent/memory/`. |
| `plans/backlog-native_app/RETRO_FASE2_CRUD_PROTOCOLOS.md` | `retro` | N/A (Aprendizados DEVFLOW) | `excluded` | Lições incorporadas nas regras da pasta `.agent/memory/`. |
| `plans/backlog-roadmap_v4/ANALISE_FONTES_INTERACOES.md` | `strategy` | Referenciável in `018-anvisa-interactions-local`. | `deferred` | Spike de interações ANVISA concluído. |
| `plans/backlog-roadmap_v4/EXEC_SPEC_FASE_8.md` | `active_exec_spec` | Superado por `PHASE_8_SMART_WOW_FACTOR.md`. | `excluded` | Versão antiga substituída pela spec unificada 2026. |
| `plans/backlog-roadmap_v4/EXEC_SPEC_PDF_CONSULTA_MEDICA.md` | `active_exec_spec` | Superado por `PHASE_5_6_PARITY_AND_BEYOND.md`. | `excluded` | Versão antiga da spec de PDF. |
| `plans/backlog-roadmap_v4/PHASE_7_SPEC.md` | `prd` | Superado por `PHASE_7_COMMUNICATION_CUIDADOR.md`. | `excluded` | Versão antiga da spec de cuidador. |
| `plans/backlog-roadmap_v4/PHASE_8_SPEC.md` | `prd` | Superado por `PHASE_8_SMART_WOW_FACTOR.md`. | `excluded` | Versão antiga da spec de chatbot/voz. |
| `plans/backlog-roadmap_v4/ROADMAP_v4.md` | `master_plan` | Superado por `UNIFIED_ROADMAP_2026.md`. | `excluded` | Antigo roadmap v4.0. |
| `plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md` | `master_plan` | A ser analisado na Wave M2 (Notificações). | `pending` | Escopo de notificações pendente. |
| **Arquivos Estratégicos Soltos** | | | | |
| `plans/PRODUCT_STRATEGY_CONSOLIDATED.md` | `strategy` | N/A (Referência estratégica) | `excluded` | Visão estratégica de posicionamento de produto. |
| `plans/DOSIQ_PRODUCT_BRIEF.md` | `strategy` | N/A (Referência estratégica) | `excluded` | Product brief original. |
| `plans/UX_VISION_EXPERIENCIA_PACIENTE.md` | `strategy` | N/A (Referência de design) | `excluded` | Visão de experiência de paciente do Dosiq. |
| `plans/DESIGN-SYSTEM.md` | `strategy` | N/A (Referência de CSS/Tokens) | `excluded` | Diretrizes de design e identidade visual. |
| `plans/spec-driven.md` | `strategy` | N/A (Constituição do workflow) | `excluded` | Manifesto de Spec-Driven Development. |

---

## 🚫 Critérios de Classificação e Status

*   `migrated`: Spec completamente reestruturada e criada em formato atômico sob `plans/specs/`.
*   `pending`: Spec ativa/backlog mapeado para migração em ondas futuras.
*   `deferred`: Item não executável diretamente no backlog atual, preservado como material de referência.
*   `excluded`: Item considerado arquivado, obsoleto ou já implementado em produção, não gerando novas tarefas.
