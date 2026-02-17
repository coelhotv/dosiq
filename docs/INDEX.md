# Documentação - Meus Remédios

**Versão:** 2.8.1  
**Última Atualização:** 2026-02-17  
**Status:** Índice Principal de Documentação

---

## 📚 Índice por Audiência

### 🚀 Para Novos Desenvolvedores

1. [`getting-started/SETUP.md`](getting-started/SETUP.md) - Configuração do ambiente e início rápido ✅
2. [`ARQUITETURA.md`](ARQUITETURA.md) - Visão geral da arquitetura (v2.8.0) ✅
3. [`PADROES_CODIGO.md`](PADROES_CODIGO.md) - Padrões de código completos ✅
4. [`standards/TESTING.md`](standards/TESTING.md) - Guia completo de testes ✅

### 🏗️ Arquitetura & Design

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [`ARQUITETURA.md`](ARQUITETURA.md) | Visão arquitetural completa do sistema (v2.8.0) | ✅ Atual |
| [`architecture/DATABASE.md`](architecture/DATABASE.md) | Esquemas do banco de dados Supabase | ✅ Migrado |
| [`architecture/CSS.md`](architecture/CSS.md) | Arquitetura CSS e design system | ✅ Migrado |

**Nota**: ARQUITETURA.md permanece na raiz como documento primário. ARQUITETURA_FRAMEWORK.md arquivado (conteúdo sobreposto).

### 📏 Padrões de Desenvolvimento

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [`PADROES_CODIGO.md`](PADROES_CODIGO.md) | Convenções completas de nomenclatura, imports, React | ✅ Atual (v2.8.0) |
| [`standards/TESTING.md`](standards/TESTING.md) | Guia completo de testes (smoke, unit, integration) | ✅ Completo (Fase 1) |
| [`standards/GIT_WORKFLOW.md`](standards/GIT_WORKFLOW.md) | Workflow Git obrigatório extraído | ✅ Completo (Fase 3) |
| [`standards/PULL_REQUEST_TEMPLATE.md`](standards/PULL_REQUEST_TEMPLATE.md) | Template de PR | ✅ Migrado |

**Nota**: PADROES_CODIGO.md permanece na raiz como documento primário (1500+ linhas). Consolidação futura opcional.

### 📖 Referência de API

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [`reference/SERVICES.md`](reference/SERVICES.md) | API interna de services | ✅ Migrado |
| [`reference/HOOKS.md`](reference/HOOKS.md) | Hooks customizados | ✅ Migrado |
| [`reference/SCHEMAS.md`](reference/SCHEMAS.md) | Schemas Zod e validação | ✅ Completo (Fase 3) |

### 🎯 Guias de Features

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [`features/TITRATION.md`](features/TITRATION.md) | Guia de protocolos em titulação | ✅ Migrado |
| [`features/AUTO_TRANSITION.md`](features/AUTO_TRANSITION.md) | Transição automática de doses | ✅ Migrado |
| [`features/USER_GUIDE.md`](features/USER_GUIDE.md) | Guia do usuário final | ✅ Migrado |

### 🤖 Para Agentes de IA

1. [`🛡️ AGENTS.md`](../AGENTS.md) - Guia principal para agentes (routing table)
2. [`.roo/rules-code/rules.md`](../.roo/rules-code/rules.md) - Regras de código
3. [`.roo/rules-architecture/rules.md`](../.roo/rules-architecture/rules.md) - Regras arquiteturais
4. [`standards/TESTING.md`](standards/TESTING.md) - Padrões de testes
5. [`.roo/rules/memory.md`](../.roo/rules/memory.md) - Memória de longo prazo

---

## 🗂️ Ordem de Leitura Recomendada

### Onboarding Completo (Novos Desenvolvedores)

```
1. getting-started/SETUP.md          [30 min] - Setup do ambiente
2. architecture/OVERVIEW.md          [45 min] - Entender arquitetura
3. standards/CODE_PATTERNS.md        [45 min] - Aprender convenções
4. standards/TESTING.md              [30 min] - Como escrever testes
5. reference/SERVICES.md             [20 min] - API de services
6. standards/GIT_WORKFLOW.md         [15 min] - Workflow obrigatório
```

### Quick Reference (Desenvolvedores Experientes)

```
- Padrões de código:     standards/CODE_PATTERNS.md
- Criar testes:          standards/TESTING.md
- API de services:       reference/SERVICES.md
- Hooks customizados:    reference/HOOKS.md
- Schemas Zod:           reference/SCHEMAS.md
```

### Tópicos Específicos

| Preciso entender... | Leia... |
|---------------------|---------|
| Como funciona a arquitetura | [`architecture/OVERVIEW.md`](ARQUITETURA.md) |
| Esquemas do banco de dados | [`architecture/DATABASE.md`](architecture/DATABASE.md) |
| Sistema CSS e tokens | [`architecture/CSS.md`](architecture/CSS.md) |
| Bot do Telegram | [`architecture/TELEGRAM_BOT.md`](TELEGRAM_BOT_NOTIFICATION_SYSTEM.md) |
| Como nomear variáveis/funções | [`standards/CODE_PATTERNS.md`](PADROES_CODIGO.md) |
| Onde colocar testes | [`standards/TESTING.md`](standards/TESTING.md#localização-de-arquivos) |
| Como criar PR | [`standards/PULL_REQUEST_TEMPLATE.md`](standards/PULL_REQUEST_TEMPLATE.md) |
| API de um service específico | [`reference/SERVICES.md`](reference/SERVICES.md) |
| Como usar um hook | [`reference/HOOKS.md`](reference/HOOKS.md) |
| Protocolos em titulação | [`features/TITRATION.md`](features/TITRATION.md) |

---

## 📦 Arquivo e Documentação Histórica

Documentação mais antiga ou relatórios históricos foram arquivados em:

- [`archive/past_deliveries/`](archive/past_deliveries/) - Relatórios de entregas passadas
- [`archive/tech-specs/`](archive/tech-specs/) - Especificações técnicas antigas
- [`archive/LINT_COVERAGE.md`](LINT_COVERAGE.md) - Relatório histórico de lint *(para migrar)*
- [`archive/OTIMIZACAO_TESTES_ESTRATEGIA.md`](OTIMIZACAO_TESTES_ESTRATEGIA.md) - Estratégia antiga de testes *(para migrar)*

---

## 🔄 Status da Migração de Documentação

Este índice faz parte da **Phase 2: Documentation Restructure** do plano de overhaul.

### ✅ Concluído (Phase 1)
- Criação de `standards/TESTING.md`
- Reestruturação da infraestrutura de testes

### 🚧 Em Progresso (Phase 2)
- Criação desta estrutura de diretórios
- Migração de arquivos simples
- Arquivamento de documentação antiga

### 📋 Pendente (Phases 2-3)
- Consolidação de `ARQUITETURA.md` + `ARQUITETURA_FRAMEWORK.md`
- Consolidação de `PADROES_CODIGO.md`
- Extração de Git Workflow para documento separado
- Criação de `reference/SCHEMAS.md`
- Reescrita de `AGENTS.md` como routing table conciso

---

## 🤝 Como Contribuir com a Documentação

1. **Para correções pequenas**: Edite diretamente e faça PR
2. **Para novos documentos**: Siga a estrutura de diretórios acima
3. **Para reestruturações grandes**: Consulte [`plans/documentation-and-testing-overhaul.md`](../plans/documentation-and-testing-overhaul.md)

### Padrões de Documentação

- **Idioma**: Português para documentação, inglês para código
- **Formato**: Markdown com hierarquia clara
- **Metadados**: Incluir versão e data de atualização no topo
- **Links**: Usar links relativos para navegação interna
- **Status**: Indicar claramente se documento está completo/em migração/depreciado

---

## 📞 Referências Externas

- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev/guide/
- **Vitest Docs**: https://vitest.dev/
- **Zod Docs**: https://zod.dev/
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Testing Library**: https://testing-library.com/docs/react-testing-library/intro/

---

*Índice criado em: 2026-02-17*  
*Última atualização: 2026-02-17*  
*Versão do projeto: 2.8.1*
