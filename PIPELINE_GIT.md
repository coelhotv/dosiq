# 🔄 Pipeline Git - Onda 1

> Documentação da estrutura de branches, commits e Pull Requests da Onda 1

---

## 📋 Visão Geral

Este documento descreve a estrutura Git criada para a Onda 1 do projeto Meus Remédios, seguindo as diretrizes do [COMMIT_STRATEGY.md](COMMIT_STRATEGY.md) e [pull_request_template.md](.github/pull_request_template.md).

---

## 🌿 Branches Criadas

### Estrutura de Branches

```
main (base)
├── feature/wave-1/validacao-zod        # Tarefa 1.2 - Base para outras features
├── feature/wave-1/tests-unitarios      # Tarefa 1.1 - Testes
├── feature/wave-1/sessoes-bot          # Tarefa 1.3 - Bot
├── feature/wave-1/onboarding-wizard    # Tarefa 1.4 - UX
├── feature/wave-1/cache-swr            # Tarefa 1.5 - Performance
├── feature/wave-1/view-estoque         # Tarefa 1.6 - Database
└── docs/wave-1/documentacao            # Documentação
```

---

## 📝 Commits por Branch

### 1️⃣ feature/wave-1/validacao-zod

**Commit:** `2e92a9e`

```text
feat(validation): implementar schemas Zod para validação de dados

- Schema medicineSchema: validação completa de medicamentos
- Schema protocolSchema: regras de protocolos de tratamento
- Schema stockSchema: validação de estoque com quantidades
- Schema logSchema: validação de registros de doses
- Helper validationHelper: utilitários de validação
- 23 testes unitários para cobertura de edge cases
- Integração com formulários existentes

Refs: #wave-1, #task-1.2
```

**Arquivos:**
- `src/schemas/index.js`
- `src/schemas/medicineSchema.js`
- `src/schemas/protocolSchema.js`
- `src/schemas/stockSchema.js`
- `src/schemas/logSchema.js`
- `src/schemas/validationHelper.js`
- `src/schemas/__tests__/validation.test.js`
- `docs/SCHEMAS_VALIDACAO.md`

---

### 2️⃣ feature/wave-1/tests-unitarios

**Commit:** `8acefe7`

```text
feat(tests): adicionar 110 testes unitários com Vitest

- Setup completo do Vitest com jsdom e Testing Library
- Testes de componentes: Button, Calendar, Modal, Card
- Testes de hooks: useCachedQuery com mock de cache
- Testes de serviços: logService, stockService
- Testes de schemas: validações Zod (23 testes)
- Cobertura: componentes críticos do sistema
- Scripts: npm test e npm run test:coverage

Refs: #wave-1, #task-1.1
```

**Arquivos:**
- `src/components/ui/Button.test.jsx`
- `src/components/protocol/*.test.jsx`
- `src/components/stock/__tests__/*.test.jsx`
- `src/components/log/__tests__/*.test.jsx`
- `src/lib/__tests__/queryCache.test.js`
- `src/services/api.test.js`
- `src/services/api/__tests__/*.test.js`
- `src/utils/__tests__/titrationUtils.test.js`
- `package.json` (scripts e dependências)
- `vite.config.js` (configuração Vitest)

---

### 3️⃣ feature/wave-1/sessoes-bot

**Commit:** `0c2be57`

```text
feat(bot): implementar persistência de sessões com TTL 30min

- SessionManager: gerenciamento de sessões em Supabase
- TTL configurável: 30 minutos de expiração
- Cache local em memória para performance
- Auto-cleanup de sessões expiradas
- Testes de persistência simulando restart
- Suporte a múltiplas sessões concorrentes
- Performance: < 100ms para read/write

Refs: #wave-1, #task-1.3
```

**Arquivos:**
- `server/services/sessionManager.js`
- `server/index.js`
- `.migrations/create_bot_sessions.sql`

---

### 4️⃣ feature/wave-1/onboarding-wizard

**Commit:** `2840a89`

```text
feat(onboarding): implementar wizard de 4 passos mobile-first

- Step 1: WelcomeStep - boas-vindas e apresentação
- Step 2: FirstMedicineStep - cadastro do primeiro remédio
- Step 3: FirstProtocolStep - configuração de protocolo
- Step 4: TelegramIntegrationStep - integração com bot
- OnboardingProvider: contexto de estado do wizard
- Design mobile-first com responsividade
- Persistência de progresso no localStorage
- Validação em tempo real com Zod

Refs: #wave-1, #task-1.4
```

**Arquivos:**
- `src/components/onboarding/OnboardingWizard.jsx`
- `src/components/onboarding/OnboardingProvider.jsx`
- `src/components/onboarding/WelcomeStep.jsx`
- `src/components/onboarding/FirstMedicineStep.jsx`
- `src/components/onboarding/FirstProtocolStep.jsx`
- `src/components/onboarding/TelegramIntegrationStep.jsx`
- `src/components/onboarding/index.js`
- `src/components/onboarding/*.css`

---

### 5️⃣ feature/wave-1/cache-swr

**Commit:** `1ba8ef1`

```text
feat(performance): implementar cache SWR com 95% melhoria Dashboard

- QueryCache: sistema de cache em memória com LRU
- useCachedQuery: hook para queries com cache
- useCachedMutation: invalidação inteligente de cache
- Stale-while-revalidate: dados atualizados em background
- Garbage collection automático
- Deduplicação de requests simultâneos
- Métricas: 95% redução de tempo de carregamento

Refs: #wave-1, #task-1.5
```

**Arquivos:**
- `src/lib/queryCache.js`
- `src/hooks/useCachedQuery.js`
- `src/services/api/cachedServices.js`
- `docs/BENCHMARK_CACHE_SWR.md`

---

### 6️⃣ feature/wave-1/view-estoque

**Commit:** `a205309`

```text
feat(database): criar view medicine_stock_summary 5x mais rápida

- View SQL otimizada para resumo de estoque
- Agregação de dados em tempo real
- Índices para performance de consulta
- Substituição de múltiplas queries por uma única view
- Suporte a alertas de estoque baixo
- Documentação de benchmark incluída

Refs: #wave-1, #task-1.6
```

**Arquivos:**
- `.migrations/create_medicine_stock_summary_view.sql`
- `src/services/api/stockService.js`
- `docs/BENCHMARK_STOCK_VIEW.md`

---

### 7️⃣ docs/wave-1/documentacao

**Commit:** `2d45c82`

```text
docs: expandir documentação técnica da Onda 1

- Guia de titulação de medicamentos
- Benchmarks de performance (cache e views)
- Documentação de schemas de validação
- Guia de transição automática de protocolos
- Arquitetura do sistema atualizada
- Decisões técnicas documentadas
- Guia de contribuição e padrões de código

Refs: #wave-1, #docs
```

**Arquivos:**
- `docs/GUIA_TITULACAO.md`
- `docs/API_SERVICES.md`
- `docs/ARQUITETURA.md`
- `docs/DECISOES_TECNICAS.md`
- `docs/HOOKS.md`
- `docs/PADROES_CODIGO.md`
- `docs/QUICKSTART.md`
- `docs/database-schema.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`
- `README.md`
- `.migrations/001_create_user_settings.sql`

---

## 🔀 Pull Requests

### Estrutura dos PRs

Cada branch terá um Pull Request associado seguindo o template:

#### PR #1: Validação Zod
```markdown
# 📦 Tarefa 1.2 - Validação com Zod

## 🎯 Resumo
Implementação de schemas Zod para validação de dados de medicamentos, protocolos, estoque e logs.

## 📋 Checklist
- [x] Schema medicineSchema
- [x] Schema protocolSchema
- [x] Schema stockSchema
- [x] Schema logSchema
- [x] Helper de validação
- [x] 23 testes unitários

## 🔗 Relacionado
- Base para: feature/wave-1/onboarding-wizard
- Base para: feature/wave-1/tests-unitarios
```

#### PR #2: Testes Unitários
```markdown
# 📦 Tarefa 1.1 - Testes Unitários (110 testes)

## 🎯 Resumo
Setup completo de testes com Vitest e 110 testes unitários cobrindo componentes, hooks e serviços.

## 📋 Checklist
- [x] Setup Vitest
- [x] Testes de componentes
- [x] Testes de hooks
- [x] Testes de serviços
- [x] Testes de schemas

## 🔗 Relacionado
- Depends on: feature/wave-1/validacao-zod
```

#### PR #3: Sessões do Bot
```markdown
# 📦 Tarefa 1.3 - Persistência de Sessões do Bot

## 🎯 Resumo
Implementação de persistência de sessões do bot Telegram com TTL de 30 minutos.

## 📋 Checklist
- [x] SessionManager com Supabase
- [x] TTL configurável
- [x] Cache local em memória
- [x] Auto-cleanup

## 🔗 Relacionado
- Integração: feature/wave-1/onboarding-wizard
```

#### PR #4: Onboarding Wizard
```markdown
# 📦 Tarefa 1.4 - Onboarding Wizard

## 🎯 Resumo
Wizard de 4 passos mobile-first para primeiro uso do aplicativo.

## 📋 Checklist
- [x] WelcomeStep
- [x] FirstMedicineStep
- [x] FirstProtocolStep
- [x] TelegramIntegrationStep
- [x] Persistência de progresso

## 🔗 Relacionado
- Depends on: feature/wave-1/validacao-zod
- Integração: feature/wave-1/sessoes-bot
```

#### PR #5: Cache SWR
```markdown
# 📦 Tarefa 1.5 - Cache SWR

## 🎯 Resumo
Sistema de cache SWR com 95% de melhoria no carregamento do Dashboard.

## 📋 Checklist
- [x] QueryCache com LRU
- [x] Hook useCachedQuery
- [x] Deduplicação de requests
- [x] Benchmark de performance

## 🔗 Relacionado
- Independente
```

#### PR #6: View de Estoque
```markdown
# 📦 Tarefa 1.6 - View de Estoque Otimizada

## 🎯 Resumo
View SQL medicine_stock_summary 5x mais rápida para consultas de estoque.

## 📋 Checklist
- [x] Migration SQL
- [x] Índices otimizados
- [x] Atualização do stockService
- [x] Documentação de benchmark

## 🔗 Relacionado
- Independente
```

#### PR #7: Documentação
```markdown
# 📦 Documentação da Onda 1

## 🎯 Resumo
Consolidação de toda a documentação técnica da Onda 1.

## 📋 Checklist
- [x] GUIA_TITULACAO.md
- [x] API_SERVICES.md
- [x] ARQUITETURA.md
- [x] BENCHMARKS.md
- [x] PADROES_CODIGO.md

## 🔗 Relacionado
- Documenta todas as features
```

---

## 🚀 Comandos para Criar PRs

### Usando GitHub CLI

```bash
# 1. Validação Zod (deve ser mergeado primeiro)
git checkout feature/wave-1/validacao-zod
gh pr create --title "feat(validation): implementar schemas Zod para validação" \
             --body-file .github/pull_request_template.md \
             --base main

# 2. Testes Unitários
git checkout feature/wave-1/tests-unitarios
gh pr create --title "feat(tests): adicionar 110 testes unitários com Vitest" \
             --body-file .github/pull_request_template.md \
             --base main

# 3. Sessões do Bot
git checkout feature/wave-1/sessoes-bot
gh pr create --title "feat(bot): implementar persistência de sessões com TTL 30min" \
             --body-file .github/pull_request_template.md \
             --base main

# 4. Onboarding Wizard
git checkout feature/wave-1/onboarding-wizard
gh pr create --title "feat(onboarding): implementar wizard de 4 passos mobile-first" \
             --body-file .github/pull_request_template.md \
             --base main

# 5. Cache SWR
git checkout feature/wave-1/cache-swr
gh pr create --title "feat(performance): implementar cache SWR com 95% melhoria" \
             --body-file .github/pull_request_template.md \
             --base main

# 6. View de Estoque
git checkout feature/wave-1/view-estoque
gh pr create --title "feat(database): criar view medicine_stock_summary 5x mais rápida" \
             --body-file .github/pull_request_template.md \
             --base main

# 7. Documentação
git checkout docs/wave-1/documentacao
gh pr create --title "docs: expandir documentação técnica da Onda 1" \
             --body-file .github/pull_request_template.md \
             --base main
```

---

## 📊 Resumo da Estrutura

| Branch | Commit | Tarefa | Status |
|--------|--------|--------|--------|
| `feature/wave-1/validacao-zod` | `2e92a9e` | 1.2 | ✅ Criada |
| `feature/wave-1/tests-unitarios` | `8acefe7` | 1.1 | ✅ Criada |
| `feature/wave-1/sessoes-bot` | `0c2be57` | 1.3 | ✅ Criada |
| `feature/wave-1/onboarding-wizard` | `2840a89` | 1.4 | ✅ Criada |
| `feature/wave-1/cache-swr` | `1ba8ef1` | 1.5 | ✅ Criada |
| `feature/wave-1/view-estoque` | `a205309` | 1.6 | ✅ Criada |
| `docs/wave-1/documentacao` | `2d45c82` | Docs | ✅ Criada |

---

## 🔗 Ordem de Merge Recomendada

```
1. feature/wave-1/validacao-zod      (base para outros)
2. feature/wave-1/tests-unitarios    (valida schemas)
3. feature/wave-1/cache-swr          (independente)
4. feature/wave-1/view-estoque       (independente)
5. feature/wave-1/sessoes-bot        (independente)
6. feature/wave-1/onboarding-wizard  (depende de schemas + bot)
7. docs/wave-1/documentacao          (documenta tudo)
```

---

## 📚 Convenções

### Nomenclatura de Branches
- Features: `feature/wave-{n}/{descricao-curta}`
- Docs: `docs/wave-{n}/{descricao-curta}`
- Fix: `fix/wave-{n}/{descricao-curta}`

### Mensagens de Commit
Seguir [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(scope): descrição em português`
- `fix(scope): descrição em português`
- `docs(scope): descrição em português`
- `test(scope): descrição em português`
- `refactor(scope): descrição em português`

---

*Documento gerado em: 2026-02-03*
*Onda 1 - Meus Remédios*
