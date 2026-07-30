---
title: "Documentação Oficial - Dosiq"
description: "Índice principal de documentação técnica, padrões e guias do Dosiq."
version: "5.0.0"
status: active
category: reference
audience:
  - dev
  - agent
tags:
  - index
  - docs
  - reference
created_at: "2026-02-01"
updated_at: "2026-07-30"
epic: "049"
---

# Documentação Oficial - Dosiq

Bem-vindo à documentação oficial do Dosiq. O projeto adota uma arquitetura **Turborepo (monorepo)** 100% TypeScript, operando com React 19, Vite, Supabase, validação runtime via Zod 4, e processos guiados pelo **DEVFLOW**.

> **73 docs ativos** · **16 docs de arquitetura** · **11 docs de referência** · **12 padrões**

---

## 📚 Índice por Categoria

### 🚀 Onboarding & Primeiros Passos

Guias iniciais para configuração do ambiente de desenvolvimento local e conceitos introdutórios.

| Documento | Descrição |
|-----------|-----------|
| [`getting-started/SETUP.md`](getting-started/SETUP.md) | Configuração do ambiente web, Supabase, GitHub e Vercel |
| [`getting-started/SETUP_NATIVE_HIBRIDO.md`](getting-started/SETUP_NATIVE_HIBRIDO.md) | Setup local para desenvolvimento iOS/Android/Expo da frente mobile |
| [`getting-started/vercel-env-setup.md`](getting-started/vercel-env-setup.md) | Guia de configuração e sync de variáveis de ambiente no Vercel |
| [`getting-started/GIT_ARCHITECTURE.md`](getting-started/GIT_ARCHITECTURE.md) | Visão geral da arquitetura de versionamento e repositórios |
| [`getting-started/MAINTAINING_REDESIGN_CSS.md`](getting-started/MAINTAINING_REDESIGN_CSS.md) | Guia de manutenção do CSS após o redesign v4 |

---

### 🏗️ Arquitetura & Design

Detalhamento sobre as escolhas arquiteturais do monorepo TypeScript pós-040.

| Documento | Descrição |
|-----------|-----------|
| [`ARQUITETURA.md`](ARQUITETURA.md) | Visão macro da arquitetura do projeto e topologia do monorepo |
| [`design-philosophy.md`](design-philosophy.md) | Filosofia de design do Dosiq e diretrizes de experiência do usuário |
| [`architecture/MONOREPO.md`](architecture/MONOREPO.md) | ⭐ Topologia Turborepo, npm workspaces, herança tsconfig e build order |
| [`architecture/PACKAGES_CORE.md`](architecture/PACKAGES_CORE.md) | ⭐ `@dosiq/core`: filosofia de pureza, submódulos, build pipeline |
| [`architecture/DEPENDENCY_GRAPH.md`](architecture/DEPENDENCY_GRAPH.md) | ⭐ Diagrama mermaid de dependências, fluxo de tipos e regras de acoplamento |
| [`architecture/DATABASE.md`](architecture/DATABASE.md) | Esquemas do banco de dados Supabase, RLS policies e constraints |
| [`architecture/DOSE_INSTANCES.md`](architecture/DOSE_INSTANCES.md) | Engenharia e materialização de instâncias de doses (Core v4) |
| [`architecture/CSS.md`](architecture/CSS.md) | Arquitetura de CSS Vanilla, tokens de design e componentes |
| [`architecture/CHATBOT_AI.md`](architecture/CHATBOT_AI.md) | Arquitetura do chatbot baseado em IA e integrações com o Groq |
| [`architecture/PWA_WEB_PUSH.md`](architecture/PWA_WEB_PUSH.md) | Service Workers, cache offline (Workbox) e Web Push do PWA |
| [`architecture/EXPO_METRO_PIPELINE.md`](architecture/EXPO_METRO_PIPELINE.md) | Bundler Metro, Hermes, EAS e pipeline de build mobile |
| [`architecture/NUDGE_BANNERS.md`](architecture/NUDGE_BANNERS.md) | Arquitetura de banners informativos e sistema de nudges |

---

### 📱 Mobile

Arquitetura, hooks e funcionalidades exclusivas do app React Native.

| Documento | Descrição |
|-----------|-----------|
| [`architecture/MOBILE_APP.md`](architecture/MOBILE_APP.md) | ⭐ Arquitetura geral: features, platform, navigation, screens, shared |
| [`architecture/MOBILE_NOTIFICATIONS.md`](architecture/MOBILE_NOTIFICATIONS.md) | ⭐ Expo Push + APNS, alarmes nativos, AlarmSchedulerBridge, quiet hours |
| [`architecture/DOSE_LIVE_ACTIVITY.md`](architecture/DOSE_LIVE_ACTIVITY.md) | ⭐ iOS Live Activities + Android: SwiftUI widget, bridges TS/Swift, APNS |
| [`reference/MOBILE_HOOKS.md`](reference/MOBILE_HOOKS.md) | ⭐ Catálogo de hooks mobile: push, alarmes, formulários, mutations |

---

### 🔔 Notificações (Cross-Platform)

Ecossistema completo de notificações do Dosiq — server, web, mobile e Telegram.

| Documento | Descrição |
|-----------|-----------|
| [`architecture/NOTIFICATIONS.md`](architecture/NOTIFICATIONS.md) | Hub de navegação: visão geral cross-platform do ecossistema de notificações |
| [`architecture/SERVER_NOTIFICATIONS.md`](architecture/SERVER_NOTIFICATIONS.md) | ⭐ Engine de servidor: dispatcher → channels → providers, APNS, Outbox, DLQ |
| [`architecture/TELEGRAM_BOT.md`](architecture/TELEGRAM_BOT.md) | Bot Telegram: pipeline de middleware, comandos, callbacks, serviços tipados |

---

### 📏 Padrões de Desenvolvimento & Qualidade

Convenções técnicas obrigatórias de codificação, TypeScript, testes e processos.

| Documento | Descrição |
|-----------|-----------|
| [`PADROES_CODIGO.md`](PADROES_CODIGO.md) | Convenções completas de nomenclatura, hooks, imports e TypeScript |
| [`standards/TYPESCRIPT.md`](standards/TYPESCRIPT.md) | ⭐ Regime strict islands, tsconfig hierarchy, catraca de dívida, ESM R-282 |
| [`standards/TYPING_PATTERNS.md`](standards/TYPING_PATTERNS.md) | ⭐ Cookbook de tipagem: services, hooks, repos, schemas, componentes |
| [`standards/TESTING.md`](standards/TESTING.md) | Guia abrangente de testes (Vitest + Testing Library) e timeouts |
| [`standards/MOBILE_PERFORMANCE.md`](standards/MOBILE_PERFORMANCE.md) | Padrões de otimização de performance M2+ (lazy load e skeletons) |
| [`standards/GIT_WORKFLOW.md`](standards/GIT_WORKFLOW.md) | Workflow Git e políticas de branches (Trunk-Based) |
| [`standards/PULL_REQUEST_TEMPLATE.md`](standards/PULL_REQUEST_TEMPLATE.md) | Template oficial de Pull Request |
| [`standards/CHANGELOG_AND_RELEASES.md`](standards/CHANGELOG_AND_RELEASES.md) | Protocolos R-221 (SQP) para changelog e logs C5 de liberação |
| [`standards/AI_REVIEW.md`](standards/AI_REVIEW.md) | Protocolo RC5/RC6 de revisão de código por IA (pós-Gemini) |
| [`standards/RELEASES.md`](standards/RELEASES.md) | Notas de loja — textos publicados no App Store e Google Play |
| [`standards/SUPABASE_MIGRATIONS.md`](standards/SUPABASE_MIGRATIONS.md) | Template SQL e regras obrigatórias para migrações Supabase |
| [`standards/DELIVER_SPRINT_WORKFLOW.md`](standards/DELIVER_SPRINT_WORKFLOW.md) | Protocolo oficial do comando `/deliver-sprint` de agentes |
| [`standards/DELIVER_SPRINT_EXAMPLES.md`](standards/DELIVER_SPRINT_EXAMPLES.md) | Exemplos práticos de sprints do monorepo |

---

### 📖 Referência Técnica

Documentação de referência interna do Dosiq — APIs, schemas, services, hooks e pacotes.

| Documento | Descrição |
|-----------|-----------|
| [`reference/CORE_SCHEMAS.md`](reference/CORE_SCHEMAS.md) | ⭐ Catálogo dos 20+ schemas Zod do `@dosiq/core`, validação e locale PT-BR |
| [`reference/CORE_REPOSITORIES.md`](reference/CORE_REPOSITORIES.md) | ⭐ 9 repositories, factory pattern, contratos I/O, syncInstancesOnWrite |
| [`reference/API_ENDPOINTS.md`](reference/API_ENDPOINTS.md) | ⭐ Catálogo de endpoints Vercel serverless, roteadores e autenticação |
| [`reference/PACKAGES_MINOR.md`](reference/PACKAGES_MINOR.md) | ⭐ `@dosiq/design-tokens`, `@dosiq/storage`, `@dosiq/shared-data`, `@dosiq/config` |
| [`reference/SERVICES.md`](reference/SERVICES.md) | API interna de services (camada de dados do web e mobile) |
| [`reference/HOOKS.md`](reference/HOOKS.md) | Catálogo de hooks customizados e wrappers SWR |
| [`reference/SCHEMAS.md`](reference/SCHEMAS.md) | Schemas de validação Zod para persistência e runtime |
| [`reference/FORM_KIT.md`](reference/FORM_KIT.md) | Sistema de formulários reutilizável da interface (FormInput, etc.) |
| [`reference/LINTING.md`](reference/LINTING.md) | Regras estáticas configuradas no ESLint |
| [`reference/GLOSSARY.md`](reference/GLOSSARY.md) | Dicionário de termos do domínio de negócio (adesão, titulação, etc.) |

---

### 🎯 Produto & Funcionalidades (Features)

Guias de conceitos e comportamentos funcionais de produto.

| Documento | Descrição |
|-----------|-----------|
| [`features/NOTIFICATIONS_EXPERIENCE.md`](features/NOTIFICATIONS_EXPERIENCE.md) | Estratégia de engajamento, agrupamentos e inbox do usuário |
| [`features/TITRATION.md`](features/TITRATION.md) | Regras de negócio e UX do assistente de titulação de doses |
| [`features/AUTO_TRANSITION.md`](features/AUTO_TRANSITION.md) | Regras e limites para transição automática de doses |
| [`features/INSIGHT_CARDS.md`](features/INSIGHT_CARDS.md) | Mecanismo de geração dinâmica de cards de insights motivacionais |
| [`features/USER_GUIDE.md`](features/USER_GUIDE.md) | Guia em português para o usuário final sobre as telas principais |

---

### ⚙️ Guias Operacionais (Operations)

Procedimentos operacionais de infraestrutura, bancos, publicação nas lojas e comunicação.

| Documento | Descrição |
|-----------|-----------|
| [`operations/DEV_TIME_TRAVEL.md`](operations/DEV_TIME_TRAVEL.md) | Procedimento para manipulação do tempo local no debug de cron/doses |
| [`operations/GUIA_APP_ACCESS_PLAY_CONSOLE.md`](operations/GUIA_APP_ACCESS_PLAY_CONSOLE.md) | Configurações de acesso de teste para revisão do app no Google Play |
| [`operations/GUIA_APP_STORE_CONNECT_IOS.md`](operations/GUIA_APP_STORE_CONNECT_IOS.md) | Manual de publicação e certificados no Apple App Store Connect |
| [`operations/GUIA_ASO_E_CONTEUDOS_APP_STORE.md`](operations/GUIA_ASO_E_CONTEUDOS_APP_STORE.md) | Palavras-chave, descrições e ASO na App Store da Apple |
| [`operations/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`](operations/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md) | Palavras-chave, descrições e ASO no Google Play Store |
| [`operations/GUIA_EXPO_DEV_E_EAS_ANDROID.md`](operations/GUIA_EXPO_DEV_E_EAS_ANDROID.md) | Execução de builds Android, keystores e deploys via EAS CLI |
| [`operations/GUIA_EXPO_DEV_E_EAS_IOS.md`](operations/GUIA_EXPO_DEV_E_EAS_IOS.md) | Execução de builds iOS, provisionamentos Apple e EAS CLI |
| [`operations/GUIA_GOOGLE_PLAY_CONSOLE_MVP_ANDROID.md`](operations/GUIA_GOOGLE_PLAY_CONSOLE_MVP_ANDROID.md) | Configurações iniciais e faixas de teste interno na Google Play Console |
| [`operations/GUIA_KILL_SWITCH_VERSAO_MINIMA.md`](operations/GUIA_KILL_SWITCH_VERSAO_MINIMA.md) | Ativação, confirmação e desativação do bloqueio de boot por versão mínima |
| [`operations/GUIA_NUDGE_BANNERS.md`](operations/GUIA_NUDGE_BANNERS.md) | Administração e publicação de banners informativos/avisos do sistema |
| [`operations/GUIA_OTA_EAS_UPDATE.md`](operations/GUIA_OTA_EAS_UPDATE.md) | Publicação, rollout escalonado, rollback e versionamento de updates OTA |
| [`operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md`](operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md) | ETL e upload dos dados da ANVISA para o Supabase Storage |
| [`operations/supabase-email-config.md`](operations/supabase-email-config.md) | Configuração de SMTP personalizado e templates de e-mail no Supabase |
| [`operations/email_boas_vindas.md`](operations/email_boas_vindas.md) | Template HTML de e-mail de boas-vindas (Android Closed Testing) |
| [`operations/email_reativacao_outage_julho2026.md`](operations/email_reativacao_outage_julho2026.md) | Templates de reativação pós-outage (4 variantes iOS/Android) |

---

### ⚖️ Legal & Privacidade

| Documento | Descrição |
|-----------|-----------|
| [`legal/POLITICA_DE_PRIVACIDADE_v0.2.md`](legal/POLITICA_DE_PRIVACIDADE_v0.2.md) | Política de privacidade v0.2 |
| [`legal/POLITICA_DE_PRIVACIDADE_v0.3.md`](legal/POLITICA_DE_PRIVACIDADE_v0.3.md) | Política de privacidade v0.3 (vigente) |
| [`legal/TERMOS_DE_USO.md`](legal/TERMOS_DE_USO.md) | Termos de uso do aplicativo |
| [`legal/RIPD.md`](legal/RIPD.md) | Relatório de Impacto à Proteção de Dados (LGPD) |

---

### 🔄 Migrações

| Documento | Descrição |
|-----------|-----------|
| [`migrations/M3_EXECUTION_GUIDE.md`](migrations/M3_EXECUTION_GUIDE.md) | Guia de execução da migração M3 de banco de dados |

---

### 📦 Histórico de Versões & Releases

O Dosiq utiliza o arquivo unificado `CHANGELOG.md` na raiz como fonte única de verdade e histórico para todas as releases.

- **[CHANGELOG.md](../CHANGELOG.md)**: Histórico completo de versões, bumps e registros SQP (Standard Quality Protocol) executados em todas as fases do projeto.

---

### 🤖 Workspace de Agentes de IA (DEVFLOW)

O Dosiq usa um robusto sistema de memória para Agentes de Codificação. Como agente, você deve primariamente focar em:

1. **[CLAUDE.md](../CLAUDE.md)** e **[GEMINI.md](../GEMINI.md)** - Regras e contexto gerais.
2. **[AGENTS.md](../AGENTS.md)** - Protocolos canônicos, workflows obrigatórios (DEVFLOW C1-C5).
3. **`.agent/memory/RULES_INDEX.md`** - Fonte de verdade para as regras de codificação e produto ativas (`R-NNN`).
4. **`.agent/memory/ANTI_PATTERNS_INDEX.md`** - Registro de antipadrões mapeados (`AP-NNN`).

*(Nota: Quaisquer menções passadas ao diretório `.memory/` estão oficialmente obsoletas em favor da estrutura `.agent/memory/`)*

---

> ⭐ = Documentação nova criada na Fase 5 do épico 049 (Docs Revamp pós-040 TypeScript)

*Índice regenerado em 2026-07-30. Reflete a reorganização estrutural do épico 049 e os 16 novos docs criados nos sprints 5.1–5.3.*
