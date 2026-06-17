# Documentação Oficial - Dosiq

**Versão:** 4.1.0  
**Última Atualização:** Junho de 2026  
**Status:** Índice Principal de Documentação

Bem-vindo à documentação oficial do Dosiq. O projeto adota uma arquitetura Turborepo (monorepo), operando com React 19, Vite, Supabase, regras rigorosas via Zod, e processos guiados pelo **DEVFLOW**.

---

## 📚 Índice por Audiência

### 🚀 Para Novos Desenvolvedores & Onboarding

1. [`getting-started/SETUP.md`](getting-started/SETUP.md) - Configuração do ambiente e início rápido
2. [`getting-started/SETUP_NATIVE_HIBRIDO.md`](getting-started/SETUP_NATIVE_HIBRIDO.md) - Setup local para desenvolvimento iOS/Android/Expo da frente mobile
3. [`ARQUITETURA.md`](ARQUITETURA.md) - Visão geral da arquitetura atual (v4.0.0+)
4. [`PADROES_CODIGO.md`](PADROES_CODIGO.md) - Padrões de código completos
5. [`standards/TESTING.md`](standards/TESTING.md) - Guia completo de testes
6. [`AGENTS.md`](../AGENTS.md) - **LEITURA OBRIGATÓRIA**: Guia de governança e workflow para agentes IA

### 🏗️ Arquitetura & Design

| Documento | Descrição |
|-----------|-----------|
| [`ARQUITETURA.md`](ARQUITETURA.md) | Visão arquitetural completa do sistema |
| [`architecture/DATABASE.md`](architecture/DATABASE.md) | Esquemas do banco de dados Supabase e lógica de constraints |
| [`architecture/DOSE_INSTANCES.md`](architecture/DOSE_INSTANCES.md) | Engenharia e materialização de instâncias de doses (Core v4) |
| [`architecture/NOTIFICATIONS.md`](architecture/NOTIFICATIONS.md) | Engenharia da Central de Notificações, DLQ e Bot Telegram |
| [`architecture/CSS.md`](architecture/CSS.md) | Arquitetura CSS e design system |
| [`architecture/TELEGRAM_BOT.md`](architecture/TELEGRAM_BOT.md) | Estrutura técnica e resiliência do Bot do Telegram |
| [`architecture/CHATBOT_AI.md`](architecture/CHATBOT_AI.md) | Integrações de AI conversacional |
| [`architecture/PWA_WEB_PUSH.md`](architecture/PWA_WEB_PUSH.md) | Arquitetura de Service Workers e Web Push do PWA |
| [`architecture/EXPO_METRO_PIPELINE.md`](architecture/EXPO_METRO_PIPELINE.md) | Arquitetura Metro, Expo e Pipeline Mobile |

### 📏 Padrões de Desenvolvimento & Qualidade

| Documento | Descrição |
|-----------|-----------|
| [`PADROES_CODIGO.md`](PADROES_CODIGO.md) | Convenções completas de nomenclatura, imports e React |
| [`standards/TESTING.md`](standards/TESTING.md) | Guia abrangente de Vitest e Testing Library (smoke, unit, integration) |
| [`standards/MOBILE_PERFORMANCE.md`](standards/MOBILE_PERFORMANCE.md) | Padrões estritos de otimização de performance M2+ (lazy load, views) |
| [`standards/GIT_WORKFLOW.md`](standards/GIT_WORKFLOW.md) | Workflow Git e políticas de branches |
| [`standards/PULL_REQUEST_TEMPLATE.md`](standards/PULL_REQUEST_TEMPLATE.md) | Template oficial de PR |
| [`standards/CHANGELOG_AND_RELEASES.md`](standards/CHANGELOG_AND_RELEASES.md) | Protocolos R-221 (SQP) para Changelog e Logs C5 |
| [`standards/GEMINI_INTEGRATION.md`](standards/GEMINI_INTEGRATION.md) | Integração GitHub Actions + Gemini Code Assist |
| [`standards/DELIVER_SPRINT_WORKFLOW.md`](standards/DELIVER_SPRINT_WORKFLOW.md) | Guia do workflow `/deliver-sprint` de agentes |

### 📖 Referência de API e Frontend

| Documento | Descrição |
|-----------|-----------|
| [`reference/SERVICES.md`](reference/SERVICES.md) | API interna de services do Dosiq |
| [`reference/HOOKS.md`](reference/HOOKS.md) | Hooks customizados globais |
| [`reference/SCHEMAS.md`](reference/SCHEMAS.md) | Schemas Zod e documentação de validação |
| [`reference/FORM_KIT.md`](reference/FORM_KIT.md) | Documentação do sistema de formulários da interface |
| [`reference/LINTING.md`](reference/LINTING.md) | Regras configuradas no ESLint |
| [`reference/GLOSSARY.md`](reference/GLOSSARY.md) | Dicionário do domínio da aplicação |

### 🎯 Produto & Funcionalidades (Features)

| Documento | Descrição |
|-----------|-----------|
| [`features/NOTIFICATIONS_EXPERIENCE.md`](features/NOTIFICATIONS_EXPERIENCE.md) | Estratégia de engajamento, agrupamento e "Inbox-First" |
| [`features/TITRATION.md`](features/TITRATION.md) | Guia e lógica de protocolos em titulação |
| [`features/AUTO_TRANSITION.md`](features/AUTO_TRANSITION.md) | Transição automática de doses e limites lógicos |
| [`features/USER_GUIDE.md`](features/USER_GUIDE.md) | Guia do usuário final para funções principais |

### 🤖 Workspace de Agentes de IA (DEVFLOW)

O Dosiq usa um robusto sistema de memória para Agentes de Codificação. Como agente, você deve primariamente focar em:

1. **[CLAUDE.md](../CLAUDE.md)** e **[GEMINI.md](../GEMINI.md)** - Regras e contexto gerais.
2. **[AGENTS.md](../AGENTS.md)** - Protocolos canônicos, workflows obrigatórios (DEVFLOW C1-C5).
3. **`.agent/memory/RULES_INDEX.md`** - Fonte de verdade para as regras de codificação e produto ativas (`R-NNN`).
4. **`.agent/memory/ANTI_PATTERNS_INDEX.md`** - Registro de antipadrões mapeados (`AP-NNN`).

*(Nota: Quaisquer menções passadas ao diretório `.memory/` estão oficialmente obsoletas em favor da estrutura `.agent/memory/`)*.

---

## 🗂️ Ordem de Leitura Sugerida para Contribuição

```text
1. CLAUDE.md / GEMINI.md             [10 min] - Regras de Ouro
2. AGENTS.md                         [15 min] - Regras de workflow (Essencial para IA)
3. ARQUITETURA.md                    [20 min] - Visão Macro e Turborepo
4. architecture/DATABASE.md          [15 min] - Schema de tabelas Supabase
5. architecture/DOSE_INSTANCES.md    [20 min] - O coração do sistema na v4.0.0+
6. PADROES_CODIGO.md                 [20 min] - Regras de React e Features
7. standards/TESTING.md              [15 min] - Política restritiva de testes e Timeouts
```

---

## 🤝 Contribuição e Manutenção de Docs

- **Status:** Todos os documentos mantidos fora do diretório `archive/` são considerados **ativos**.
- Quando uma funcionalidade sofrer refactoring drástico, atualize o documento da respectiva `feature` ou `architecture` **antes** do merge.
- Use path relativos nos links entre documentos.

---

*Índice atualizado estruturalmente de acordo com a fase de adequação de documentação do DEVFLOW e Dosiq v4.1.*
