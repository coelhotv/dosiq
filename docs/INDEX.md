---
title: "Documentação Oficial - Dosiq"
description: "Índice principal de documentação técnica, padrões e guias do Dosiq."
version: "4.15.4"
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
updated_at: "2026-07-09"
---

# Documentação Oficial - Dosiq

Bem-vindo à documentação oficial do Dosiq. O projeto adota uma arquitetura Turborepo (monorepo), operando com React 19, Vite, Supabase, regras rigorosas via Zod, e processos guiados pelo **DEVFLOW**.

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

---

### 🏗️ Arquitetura & Design

Detalhamento sobre as escolhas arquiteturais da v4.0.0+ do monorepo, regras de negócio e design system.

| Documento | Descrição |
|-----------|-----------|
| [`ARQUITETURA.md`](ARQUITETURA.md) | Visão macro da arquitetura do projeto e topologia do monorepo |
| [`design-philosophy.md`](design-philosophy.md) | Filosofia de design do Dosiq e diretrizes de experiência do usuário |
| [`architecture/DATABASE.md`](architecture/DATABASE.md) | Esquemas do banco de dados Supabase, RLS policies e constraints |
| [`architecture/DOSE_INSTANCES.md`](architecture/DOSE_INSTANCES.md) | Engenharia e materialização de instâncias de doses (Core v4) |
| [`architecture/NOTIFICATIONS.md`](architecture/NOTIFICATIONS.md) | Engenharia do sistema de notificações, alertas e integradores |
| [`architecture/CSS.md`](architecture/CSS.md) | Arquitetura de CSS Vanilla, tokens de design e componentes |
| [`architecture/TELEGRAM_BOT.md`](architecture/TELEGRAM_BOT.md) | Estrutura técnica, tratamento de erros e resiliência do Bot Telegram |
| [`architecture/CHATBOT_AI.md`](architecture/CHATBOT_AI.md) | Arquitetura do chatbot baseado em IA e integrações com o Groq |
| [`architecture/PWA_WEB_PUSH.md`](architecture/PWA_WEB_PUSH.md) | Service Workers, cache offline (Workbox) e Web Push do PWA |
| [`architecture/EXPO_METRO_PIPELINE.md`](architecture/EXPO_METRO_PIPELINE.md) | Bundler Metro, hermes, EAS e pipeline de build mobile |

---

### 📏 Padrões de Desenvolvimento & Qualidade

Convenções técnicas obrigatórias de codificação, testes e processos de pull request.

| Documento | Descrição |
|-----------|-----------|
| [`PADROES_CODIGO.md`](PADROES_CODIGO.md) | Convenções completas de nomenclatura, hooks, imports e TypeScript |
| [`standards/TESTING.md`](standards/TESTING.md) | Guia abrangente de testes (Vitest + Testing Library) e timeouts |
| [`standards/MOBILE_PERFORMANCE.md`](standards/MOBILE_PERFORMANCE.md) | Padrões de otimização de performance M2+ (lazy load e skeletons) |
| [`standards/GIT_WORKFLOW.md`](standards/GIT_WORKFLOW.md) | Workflow Git e políticas de branches (Trunk-Based) |
| [`standards/PULL_REQUEST_TEMPLATE.md`](standards/PULL_REQUEST_TEMPLATE.md) | Template oficial de Pull Request |
| [`standards/CHANGELOG_AND_RELEASES.md`](standards/CHANGELOG_AND_RELEASES.md) | Protocolos R-221 (SQP) para changelog e logs C5 de liberação |
| [`../GEMINI.md`](../GEMINI.md) | Diretrizes e regras de comportamento para a IA Gemini (Antigravity) |
| [`standards/DELIVER_SPRINT_WORKFLOW.md`](standards/DELIVER_SPRINT_WORKFLOW.md) | Protocolo oficial do comando `/deliver-sprint` de agentes |
| [`standards/DELIVER_SPRINT_EXAMPLES.md`](standards/DELIVER_SPRINT_EXAMPLES.md) | Exemplos práticos de sprints do monorepo |

---

### 📖 Referência de API e Frontend

Documentação técnica de referências internas do Dosiq.

| Documento | Descrição |
|-----------|-----------|
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

Procedimentos operacionais de infraestrutura, bancos e publicação nas lojas.

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
| [`operations/GUIA_NUDGE_BANNERS.md`](operations/GUIA_NUDGE_BANNERS.md) | Administração e publicação de banners informativos/avisos do sistema |
| [`operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md`](operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md) | ETL e upload dos dados da ANVISA para o Supabase Storage |
| [`operations/supabase-email-config.md`](operations/supabase-email-config.md) | Configuração de SMTP personalizado e templates de e-mail no Supabase |

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

*(Nota: Quaisquer menções passadas ao diretório `.memory/` estão oficialmente obsoletas em favor da estrutura `.agent/memory/`)*.

---

*Índice atualizado estruturalmente de acordo com a fase de adequação de documentação do DEVFLOW e Dosiq v4.15.4.*
