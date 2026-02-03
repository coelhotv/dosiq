# 📋 Estratégia de Commits - Onda 1

> Estrutura de commits atômicos semânticos seguindo [Conventional Commits](https://www.conventionalcommits.org/)

## 🎯 Visão Geral

Esta estratégia organiza as entregas da Onda 1 em commits atômicos, semânticos e bem documentados, facilitando:
- **Code review** granular e eficiente
- **Rollback** pontual quando necessário
- **Histórico claro** para auditoria
- **Geração automática** de changelog

---

## 🌿 Branch Strategy

```text
main
  └── docs/wave-1-completion  ← Branch desta entrega
```

**Branch:** `docs/wave-1-completion`
**Base:** `main`
**Objetivo:** Consolidar documentação e marcar conclusão da Onda 1

---

## 📝 Estrutura de Commits

### 1️⃣ Testes Unitários (Tarefa 1.1)

```text
feat(tests): adicionar 110 testes unitários com Vitest

- Setup completo do Vitest com jsdom e Testing Library
- Testes de componentes: Button, Calendar, Modal, Card
- Testes de hooks: useCachedQuery com mock de cache
- Testes de serviços: logService, stockService
- Testes de schemas: validações Zod (23 testes)
- Cobertura: componentes críticos do sistema
- Scripts: `npm test` e `npm run test:coverage`

Refs: #wave-1, #task-1.1
```

**Arquivos:**
- `src/components/**/*.test.jsx`
- `src/hooks/__tests__/*.test.js`
- `src/services/api/__tests__/*.test.js`
- `src/schemas/__tests__/*.test.js`
- `src/lib/__tests__/*.test.js`
- `vite.config.js` (configuração Vitest)
- `package.json` (scripts e dependências)

---

### 2️⃣ Validação com Zod (Tarefa 1.2)

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

---

### 3️⃣ Persistência de Sessões do Bot (Tarefa 1.3)

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
- `server/test-session-persistence.js`
- Tabela `bot_sessions` no Supabase

---

### 4️⃣ Onboarding Wizard (Tarefa 1.4)

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

### 5️⃣ Cache SWR (Tarefa 1.5)

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

### 6️⃣ View de Estoque Otimizada (Tarefa 1.6)

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
- Migration SQL: `medicine_stock_summary` view
- `docs/BENCHMARK_STOCK_VIEW.md`
- `src/services/api/stockService.js` (atualizado)

---

### 7️⃣ Documentação Técnica (Consolidação)

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
- `docs/BENCHMARK_CACHE_SWR.md`
- `docs/BENCHMARK_STOCK_VIEW.md`
- `docs/SCHEMAS_VALIDACAO.md`
- `docs/TRANSICAO_AUTOMATICA.md`
- `docs/ARQUITETURA.md`
- `docs/DECISOES_TECNICAS.md`
- `docs/PADROES_CODIGO.md`
- `docs/API_SERVICES.md`
- `docs/HOOKS.md`
- `docs/SETUP.md`
- `docs/QUICKSTART.md`

---

## 🧹 Commits de Limpeza

### Remoção de console.logs de debug

```text
chore(cleanup): remover console.logs de debug do cache

- Substituição de logs de debug por sistema de logging
- Mantidos logs de erro críticos
- Removidos logs de performance em produção
- Arquivo `src/lib/queryCache.js` limpo

Refs: #cleanup
```

### Remoção de arquivos temporários

```text
chore(cleanup): remover arquivos temporários de teste

- Removido `server/test-session-persistence.js` (integrado)
- Limpeza de arquivos de cache do build
- Organização de imports não utilizados

Refs: #cleanup
```

---

## 🔄 Ordem de Execução

```bash
# 1. Criar branch
git checkout -b docs/wave-1-completion

# 2. Commits das features (ordem recomendada)
git add <arquivos-testes>
git commit -m "feat(tests): adicionar 110 testes unitários com Vitest..."

git add <arquivos-schemas>
git commit -m "feat(validation): implementar schemas Zod para validação de dados..."

git add <arquivos-sessao>
git commit -m "feat(bot): implementar persistência de sessões com TTL 30min..."

git add <arquivos-onboarding>
git commit -m "feat(onboarding): implementar wizard de 4 passos mobile-first..."

git add <arquivos-cache>
git commit -m "feat(performance): implementar cache SWR com 95% melhoria Dashboard..."

git add <arquivos-view>
git commit -m "feat(database): criar view medicine_stock_summary 5x mais rápida..."

# 3. Documentação
git add docs/
git commit -m "docs: expandir documentação técnica da Onda 1..."

# 4. Limpeza
git add <arquivos-limpos>
git commit -m "chore(cleanup): remover console.logs de debug do cache..."

# 5. Push
git push origin docs/wave-1-completion
```

---

## ✅ Checklist de Validação

- [ ] Cada commit é atômico (uma única responsabilidade)
- [ ] Mensagens seguem Conventional Commits
- [ ] Descrições em português (conforme requisito)
- [ ] Referências às tarefas incluídas (Refs)
- [ ] Todos os testes passam (`npm test`)
- [ ] Lint sem erros (`npm run lint`)
- [ ] Build bem-sucedido (`npm run build`)
- [ ] Documentação atualizada

---

## 📊 Métricas da Onda 1

| Tarefa | Entrega | Testes | Performance |
|--------|---------|--------|-------------|
| 1.1 - Testes | 110 testes | ✅ 100% | - |
| 1.2 - Validação | 23 schemas | ✅ 100% | - |
| 1.3 - Sessões Bot | TTL 30min | ✅ 8 testes | < 100ms |
| 1.4 - Onboarding | 4 steps | ✅ E2E | Mobile-first |
| 1.5 - Cache SWR | 95% ganho | ✅ Integrado | Dashboard 5x |
| 1.6 - View Estoque | 5x mais rápida | ✅ SQL | Query única |

---

## 🏷️ Tags e Releases

Após o merge, criar tag:

```bash
git tag -a v2.3.0 -m "Onda 1 - Fundação: Testes, Validação, Cache, Onboarding"
git push origin v2.3.0
```

**Versão:** `2.3.0` (minor bump - novas features)

---

## 📝 Notas

- Commits em português conforme cultura do projeto
- Cada commit pode ser revertido independentemente
- Histórico limpo facilita bisect em caso de bugs
- Documentação viva, atualizada junto com o código
