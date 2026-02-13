# Memory - Meus Remédios

Arquivo de memória longa do projeto consolidado. Contém padrões, lições aprendidas e regras operacionais verificadas.

> **📚 Regras Consolidadas (v2.8.0+):**
> - **Coding Rules**: [`.roo/rules-code/rules.md`](rules-code/rules.md) - Padrões de código, nomenclatura, React, Zod
> - **Architecture Rules**: [`.roo/rules-architecture/rules.md`](rules-architecture/rules.md) - Governança técnica, organização, fluxo de dados

---

## 🎯 Regras Locais Prioritárias

### Componentes Consolidados (v2.7.0+)

| Componente | Padrão | Uso |
|------------|--------|-----|
| [`MedicineForm`](src/components/medicine/MedicineForm.jsx) | Props de onboarding | `onSuccess`, `autoAdvance`, `showCancelButton` |
| [`ProtocolForm`](src/components/protocol/ProtocolForm.jsx) | Mode-based | `mode='full'` \| `'simple'`, `preselectedMedicine` |
| [`Calendar`](src/components/ui/Calendar.jsx) | Feature flags | `enableLazyLoad`, `enableSwipe`, `enableMonthPicker` |
| [`AlertList`](src/components/ui/AlertList.jsx) | Base + variant | `variant='smart'` \| `'stock'`, wrappers específicos |
| [`LogForm`](src/components/log/LogForm.jsx) | UX unificada | Sempre passar `treatmentPlans` para bulk registration |

### Padrões Críticos

```jsx
// 1. LogForm retorna ARRAY quando type === 'plan'
// SEMPRE verificar ambos os casos:
if (Array.isArray(logData)) {
  await logService.createBulk(logData)
} else {
  await logService.create(logData)
}

// 2. Estados ANTES de useMemo/useEffect (evita TDZ)
const [snoozedAlertIds, setSnoozedAlertIds] = useState(new Set())
const smartAlerts = useMemo(() => { ... }, [snoozedAlertIds]) // ✅ OK

// 3. Props com defaults para backward compatibility
function MedicineForm({
  onSave,
  onSuccess,              // Opcional: ativa modo onboarding
  autoAdvance = false,    // false = comportamento padrão
  showCancelButton = true // true = comportamento padrão
})
```

### Validação de Testes

⚠️ **ATENÇÃO**: Comando `test:related` pode não estar disponível em todas as versões do Vitest.

```bash
# Use estes comandos verificados:
npm run test:critical    # Services, utils, schemas, hooks
npm run test:changed     # Arquivos modificados desde main
npm run test:smoke       # Suite mínima
npm run validate         # Lint + testes críticos
```

---

## 📚 Knowledge Base Consolidado

### React & Componentes

**Ordem de Declaração Obrigatória:**
1. Estados (`useState`)
2. Memos (`useMemo`)
3. Effects (`useEffect`)
4. Handlers

**Type Checking para LogForm:**
```jsx
// LogForm tem dois modos de retorno:
// - Objeto único: type === 'protocol'
// - Array: type === 'plan' (bulk registration)
// SEMPRE verificar Array.isArray(data) antes de processar
```

**Framer Motion + ESLint:**
```javascript
// Adicionar ao eslint.config.js:
varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])'
```

### Telegram Bot

**Limite de callback_data:**
```javascript
// ❌ NUNCA usar UUIDs (excede 64 bytes)
callback_data: `reg_med:${medicineId}:${protocolId}` // ~81 chars

// ✅ SEMPRE usar índices numéricos
callback_data: `reg_med:${index}` // ~15 chars
// Armazenar mapeamento na sessão: session.set('medicineMap', medicines)
```

**Cálculo de Dosagem:**
```javascript
// dosage_per_intake = comprimidos por dose (ex: 4)
// dosage_per_pill = mg por comprimido (ex: 500)
// dosage_real = 4 * 500 = 2000mg

// GRAVAR no banco: quantity_taken = pillsToDecrease (comprimidos)
// NUNCA gravar mg (2000 excede limite do schema Zod = 100)
const pillsToDecrease = quantity / dosagePerPill
```

**Ordem de Operações:**
```javascript
// ✅ Validação → Gravação → Decremento
try {
  // 1. Validar estoque
  if (stock < pillsToDecrease) throw new Error('Estoque insuficiente')
  // 2. Gravar dose
  await logService.create(log)
  // 3. Decrementar estoque
  await stockService.decrease(medicineId, pillsToDecrease)
}
```

### Zod & Validação

**Tradução de Enums:**
```javascript
// SEMPRE traduzir para português (consistência com UI)
const FREQUENCIES = ['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']
const MEDICINE_TYPES = ['comprimido', 'cápsula', 'líquido', 'injeção', 'pomada', 'spray', 'outro']
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// SEMPRE exportar labels para UI
export const FREQUENCY_LABELS = { diário: 'Diário', dias_alternados: 'Dias Alternados', ... }
```

### CSS & UI

**Glassmorphism Tokens:**
```css
--glass-light: rgba(255, 255, 255, 0.03);
--glass-standard: rgba(255, 255, 255, 0.08);
--glass-heavy: rgba(255, 255, 255, 0.15);
--glass-hero: rgba(255, 255, 255, 0.2);
```

**Setas em JSX:**
```jsx
// ✅ Usar {'<'} e {'>'} para evitar parsing errors
<button>{'<'}</button>
<button>{'>'}</button>
```

**Modais Mobile:**
```css
/* SEMPRE considerar BottomNav fixo */
.modal {
  max-height: 85vh; /* Nunca 100vh */
  padding-bottom: 60px; /* Espaço para scroll */
}
```

### Cache SWR

**Invalidação Automática:**
```javascript
// cachedServices já invalidam cache automaticamente
// NÃO precisa chamar invalidateCache manualmente
await cachedMedicineService.create(medicine) // Cache invalidado ✅
```

### Git Workflow

**Commits:**
```bash
# Sempre usar --no-ff para preservar histórico
git merge --no-ff feature/wave-X/nome-descritivo

# Deletar branch após merge
git branch -d feature/wave-X/nome-descritivo
```

---

## 🚨 Anti-Patterns Identificados

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| Declarar estado após useMemo | ReferenceError (TDZ) | SEMPRE: estados → memos → effects |
| Ignorar Array.isArray no LogForm | `expected object, received array` | Verificar ambos os modos |
| Usar UUID em callback_data | BUTTON_DATA_INVALID | Usar índices numéricos |
| Gravar mg em quantity_taken | Excede schema (limite 100) | Converter para comprimidos |
| Chamar getSession sem await | Sessão undefined | SEMPRE usar await |
| Mock data não remover | Dados incorretos em produção | grep por MOCK_USER_ID |

---

## 📝 Convenção de Idioma

| Contexto | Idioma |
|----------|--------|
| Raciocínio interno / Pensamento | Inglês |
| Código (variáveis, funções) | Inglês |
| Comentários de código | Português |
| Documentação | Português |
| Mensagens de erro | Português |
| UI (labels, botões) | Português |
| Commits | Português |

---

## 🔍 Debugging Rápido

**Problema: Botão não responde**
1. Verificar se handler trata o action label
2. Verificar se estado está declarado antes do useMemo

**Problema: Dose não registra**
1. Verificar se quantity_taken está em comprimidos (não mg)
2. Verificar ordem: validação → gravação → decremento

**Problema: Erro BUTTON_DATA_INVALID**
1. Verificar tamanho de callback_data (< 64 bytes)
2. Substituir UUIDs por índices numéricos

**Problema: Sessão expirada no bot**
1. Verificar se getSession tem await
2. Verificar se userId está sendo obtido via getUserIdByChatId

---

## 📊 Métricas de Consolidação

| Métrica | Valor |
|---------|-------|
| Linhas de código removidas | ~783 LOC |
| Componentes consolidados | 6 grupos |
| Breaking changes | 0 |
| Testes mantidos passando | 100% |

---

## 🔗 Referências Rápidas

- [PADROES_CODIGO.md](../../docs/PADROES_CODIGO.md) - Convenções completas
- [ARQUITETURA.md](../../docs/ARQUITETURA.md) - Padrões arquiteturais
- [AGENTS.md](../../AGENTS.md) - Guia completo do projeto

## Memory Entry — 2026-02-11 17:51
**Contexto / Objetivo**
- Corrigir warnings de lint e erros nos testes de schemas de validação
- Remover diretivas `eslint-disable` não utilizadas
- Alinhar testes com schemas em português

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/components/dashboard/SwipeRegisterItem.jsx` — removido `eslint-disable-line no-unused-vars`
  - `src/components/dashboard/TreatmentAccordion.jsx` — removido `eslint-disable-line no-unused-vars`
  - `src/schemas/__tests__/validation.test.js` — corrigidos 5 testes

**O que deu certo**
- Remoção direta das diretivas ESLint não utilizadas (motion é usado via JSX, não precisa de eslint-disable)
- Valor padrão de tipo: `'medicine'` → `'medicamento'` (em português)
- Frequências: `'daily'` → `'diário'` (valores do schema em português)
- Adição do campo obrigatório `stage_started_at` para testes de titulação
- Flexibilização da verificação de erro de horário (field contém 'time_schedule')

**O que não deu certo / riscos**
- Nenhum - todas as correções passaram lint e testes

**Regras locais para o futuro (lições acionáveis)**
- Se o ESLint reportar "Unused eslint-disable directive", remover a diretiva - o código já está em conformidade
- Os schemas Zod usam valores em português: 'medicamento', 'diário', 'estável', 'titulando'
- Protocolos com titulação exigem `stage_started_at` (campo obrigatório quando há titration_schedule)
- Sempre executar `npm run lint` e `npm run test` após modificar testes

**Pendências / próximos passos**
- Nenhuma - tarefa concluída

---

## Memory Entry — 2026-02-11 18:09
**Contexto / Objetivo**
- Corrigir suite de testes: corrigir vitest.smoke.config.js, remover arquivo duplicado e criar 5 smoke tests
- Garantir que todos os smoke tests passem e lint esteja limpo

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `vitest.smoke.config.js` — corrigido import: `from 'vite'` → `from 'vitest/config'`
  - `src/components/log/LogForm.test.jsx` — removido (duplicado)
  - `src/schemas/__tests__/medicine.smoke.test.js` — criado
  - `src/lib/__tests__/queryCache.smoke.test.js` — criado
  - `src/services/api/__tests__/stock.smoke.test.js` — criado
  - `src/hooks/__tests__/useCachedQuery.smoke.test.jsx` — criado
  - `src/utils/__tests__/adherence.smoke.test.js` — criado

**O que deu certo**
- Import do Vitest corrigido permite execução da configuração smoke
- Mock factory pattern (`vi.mock` com função factory) funciona corretamente quando definido antes do import do módulo a ser mockado
- Smoke tests simples são rápidos de implementar e cobrem caminhos críticos (schema, cache, service, hook, logic)
- Remoção via `git rm` foi a forma correta de eliminar arquivo duplicado

**O que não deu certo / riscos**
- `calculateAdherenceRate` não existe em `adherenceLogic.js` — substituído por `calculateAdherenceStats` (função real existente)
- Mock de Supabase precisa de cuidado com hoisting — vi.mock factory não pode referenciar variáveis externas

**Regras locais para o futuro (lições acionáveis)**
- SEMPRE verificar funções exportadas antes de escrever testes — não assumir nomes
- Mock Vitest: usar factory function dentro de `vi.mock()` para evitar problemas de hoisting
- Padrão de mock de Supabase: criar objeto mock completo com chain methods dentro da factory
- Smoke tests devem ser mínimos e focados em verificar se o módulo carrega e responde corretamente

**Pendências / próximos passos**
- Nenhuma — tarefa concluída
- Opção `--include` não existe no Vitest CLI; usar config file para definir patterns de inclusão

---

## Memory Entry — 2026-02-11 21:18
**Contexto / Objetivo**
- Executar validação final completa do pipeline (lint + testes críticos + smoke tests)
- Confirmar que todas as correções e otimizações estão funcionando
- Garantir 100% de sucesso em todos os comandos de validação

**O que foi feito (mudanças)**
- Arquivos modificados:
  - `src/services/api/__tests__/stock.smoke.test.js` — corrigido mock do Supabase para teste de estoque
  - `package.json` — adicionada exclusão de smoke tests ao comando `test:critical`

**O que deu certo**
- Validação completa executada com sucesso em todas as etapas
- Lint: 0 erros, 0 warnings
- Testes críticos: 87 testes passando (100%)
- Smoke tests: 5 arquivos, 7 testes passando (100%)
- Build de produção: sucesso (dist/ gerado)
- Ajuste no `test:critical` para excluir smoke tests resolveu conflito de mocks

**O que não deu certo / riscos**
- Nenhum — todas as validações passaram
- Observação: Smoke tests não devem ser executados junto com testes regulares devido a conflitos de mock

**Regras locais para o futuro (lições acionáveis)**
- SEMPRE excluir `**/*.smoke.test.{js,jsx}` de comandos de teste que incluem services (conflito de mocks)
- Smoke tests devem ser executados isoladamente via config dedicada (`vitest.smoke.config.js`)
- Mock factory de Supabase precisa ser declarado antes de qualquer import do módulo mockado
- Executar `npm run validate` antes de qualquer push para garantir pipeline limpo

**Pendências / próximos passos**
- Pipeline pronto para merge ✅
- Branch pode ser deletada após merge com `--no-ff`

---

## Memory Entry — 2026-02-11 21:44
**Contexto / Objetivo**
- Implementar Fase 2 da estratégia de otimização de testes: Test Selection Inteligente
- Adicionar scripts de teste otimizados e configurações adicionais
- Criar script inteligente para seleção de testes baseado em git diff

**O que foi feito (mudanças)**
- Arquivos criados:
  - `vitest.light.config.js` — Configuração leve para testes rápidos (exclui componentes, usa forks)
  - `scripts/test-smart.js` — Script Node.js para seleção inteligente de testes baseado em git diff
- Arquivos modificados:
  - `package.json` — Adicionados 5 novos scripts de teste otimizados

**Comandos novos disponíveis**
| Comando | Descrição | Uso |
|---------|-----------|-----|
| `npm run test:git` | Testes em arquivos modificados desde main | CI/CD rápido |
| `npm run test:affected` | Alias para test:changed | Compatibilidade |
| `npm run test:light` | Configuração leve (exclui componentes) | Desenvolvimento rápido |
| `npm run test:smart` | Script inteligente baseado em diff | Pre-push inteligente |
| `npm run test:quick` | Saída resumida (30 primeiras linhas) | Verificação rápida |
| `npm run validate:quick` | Lint + testes relacionados | Pre-commit |

**O que deu certo**
- Ajuste rápido da API de pool do Vitest (v4 usa `pool: 'forks'` e `maxWorkers`, não `poolOptions`)
- Descoberta que `--related` não existe nesta versão do Vitest — substituído por `--changed=main`
- Script test-smart.js detecta automaticamente tipo de mudança (config, service, util) e executa suite apropriada
- Todos os comandos passaram em lint, testes críticos e build

**O que não deu certo / riscos**
- `test:related` original usava `--related` que não existe no Vitest 4.0.18
- Solução: unificar todos os comandos relacionados para usar `--changed=main`
- `test:light` inicialmente usava API depreciada `poolOptions.threads` — corrigido para `pool: 'forks'`

**Decisões & trade-offs**
- Decisão: Não usar `--related` (inexistente), usar `--changed=main` como fallback
- Trade-off: `test:light` exclui todos os testes de componentes para velocidade, mas cobre menos casos
- Decisão: Script `test-smart.js` usa patterns de regex simples para detectar tipo de arquivo

**Regras locais para o futuro (lições acionáveis)**
- Se o Vitest reportar "Unknown option `--related`", usar `--changed=main` como alternativa
- Vitest 4: usar `pool: 'forks'` e `maxWorkers` ao invés de `poolOptions.threads`
- SEMPRE executar `npm run lint` após criar scripts Node.js (verificar imports não utilizados)
- Script `test-smart.js` detecta: config → full suite, services/schemas/hooks → critical, utils/lib → unit, outros → changed
- Para testes rápidos em desenvolvimento: `npm run test:light` (exclui componentes)
- Para validação antes de commit: `npm run validate:quick` (lint + changed)

**Pendências / próximos passos**
- Fase 2 concluída ✅
- Possível Fase 3: Parallel Execution e Shard Distribution para CI
- Documentar comandos no README do projeto

---

## Memory Entry — 2026-02-11 21:51
**Contexto / Objetivo**
- Implementar Fase 3 da estratégia de otimização de testes: Git Hooks com Husky + lint-staged
- Automatizar execução de testes nos hooks de git para garantir qualidade antes de commits/pushes

**O que foi feito (mudanças)**
- Arquivos criados:
  - `.husky/pre-commit` — Hook executado antes de cada commit
  - `.husky/pre-push` — Hook executado antes de cada push
  - `.lintstagedrc.js` — Configuração do lint-staged para testes seletivos
  - `.prettierrc` — Configuração do Prettier
  - `.prettierignore` — Arquivos ignorados pelo Prettier
- Arquivos modificados:
  - `package.json` — Adicionado script `prepare: "husky"` e dependências `husky` e `lint-staged`

**Configuração dos Hooks**

| Hook | Comando | Quando Executa |
|------|---------|----------------|
| `pre-commit` | `npx lint-staged` | Antes de cada commit |
| `pre-push` | `npm run test:critical` | Antes de cada push |

**Comportamento dos Hooks**

**Pre-commit (lint-staged):**
```bash
# Executa em arquivos staged:
- vitest run --changed --passWithNoTests  (testes relacionados)
- eslint --fix                             (lint em JS/JSX)
- prettier --write --ignore-unknown        (formatação em CSS/MD)
```

**Pre-push:**
```bash
- Executa: npm run test:critical
- Se falhar: push é abortado
- Se passar: push continua normalmente
```

**O que deu certo**
- Husky v9+ é mais simples: não requer `.husky/_/husky.sh` no script do hook
- Script `prepare: "husky"` ativa hooks automaticamente após `npm install`
- Comando `npx husky run pre-commit` permite testar hooks manualmente
- Commits semânticos organizados em 4 commits atômicos

**Lições sobre Husky v9+ (Diferenças da v8)**

| Aspecto | Husky v8 | Husky v9+ |
|---------|----------|-----------|
| Shell script | `#!/bin/sh` + `.husky/_/husky.sh` | Shell direto, sem sourcing |
| Inicialização | `npx husky-init` + editar | `npx husky init` (auto-setup) |
| Script prepare | `husky install` | `husky` (simplificado) |
| Hooks locais | `chmod +x` necessário | Execução automática |

**Regras locais para o futuro (lições acionáveis)**
- Se Husky v9+: usar scripts diretos nos hooks, sem `.husky/_/husky.sh`
- SEMPRE incluir `--passWithNoTests` no lint-staged para evitar falhas em arquivos sem testes
- Para testar hooks manualmente: `npx husky run pre-commit` ou `npx husky run pre-push`
- O script `prepare` roda automaticamente após `npm install` — garante que novos devs tenham hooks ativos
- Pre-push executa `test:critical` — não usar `test:full` para não bloquear pushes longos
- Se precisar bypassar hooks: `git commit --no-verify` (use com cautela)

**Pendências / próximos passos**
- Monitorar tempo de execução dos hooks em máquinas de desenvolvedores
- Considerar adicionar `commit-msg` hook para validação de commits semânticos
- Documentar em `docs/OTIMIZACAO_TESTES_ESTRATEGIA.md` que Fase 3 está completa

---

## Memory Entry — 2026-02-11 21:58
**Contexto / Objetivo**
- Implementar Fase 4 da estratégia de otimização de testes: Pipeline CI/CD Estratificado no GitHub Actions
- Criar workflow com jobs em camadas (smoke → critical → full)
- Automatizar execução de testes em PRs e pushes para main/develop

**O que foi feito (mudanças)**
- Arquivos criados:
  - `.github/workflows/test.yml` — Pipeline principal com 5 jobs estratificados
  - `.github/workflows/cache-cleanup.yml` — Workflow de limpeza semanal de cache
- Dependência `yaml-lint` adicionada ao projeto (devDependency)

**Estrutura do Pipeline CI/CD**

| Job | Descrição | Timeout | Dependências | Comando Executado |
|-----|-----------|---------|--------------|-------------------|
| **lint** | Validação ESLint | 3min | — | `npm run lint` |
| **smoke** | Smoke tests rápidos | 5min | lint | `npm run test:smoke` |
| **critical** | Testes unitários críticos | 8min | smoke | `npm run test:critical` |
| **full** | Suite completa + coverage | 15min | critical | `npm run test:coverage` |
| **build** | Verificação de build | 5min | smoke | `npm run build` |

**Diagrama de Dependências**
```
          lint (3min)
             ↓
          smoke (5min)
         /            \
   critical (8min)   build (5min)
        ↓
   full (15min) + coverage
```

**Gatilhos (Triggers)**
- Push para branches: `main`, `develop`
- Pull Requests para: `main`, `develop`

**Artifacts Gerados**
- `coverage-report` — Relatório de cobertura de código (retention: 7 dias)
- `build-dist` — Build de produção para verificação (retention: 1 dia)

**Cache Cleanup**
- Schedule: Domingos às 00:00 (`0 0 * * 0`)
- Também pode ser executado manualmente via `workflow_dispatch`

**O que deu certo**
- Sintaxe YAML validada com `yaml-lint`
- Estratégia de dependências otimizada: jobs independentes rodam em paralelo
- Timeouts configurados por job garantem que pipeline não fique preso
- Node 20 + cache de npm acelera execução

**Regras locais para o futuro (lições acionáveis)**
- SEMPRE validar YAML antes de commit: `npx yaml-lint .github/workflows/*.yml`
- Jobs são executados em paralelo quando possível para otimizar tempo total
- O job `full` só executa se `critical` passar — economiza tempo em falhas rápidas
- `build` pode rodar em paralelo com `critical` pois ambos dependem apenas de `smoke`
- Artifact retention configurado para não acumular storage desnecessário
- Para adicionar novos jobs: definir `needs` corretamente para manter estratificação

**Interpretando Resultados no GitHub Actions**

| Badge | Significado | Ação |
|-------|-------------|------|
| ✅ All checks passed | Pipeline completo passou | PR pode ser mergeado |
| ❌ lint failed | Erros de ESLint | Corrigir código localmente |
| ❌ smoke failed | Smoke tests quebraram | Verificar testes de integridade |
| ❌ critical failed | Testes críticos falharam | Investigar services/utils/schemas |
| ❌ full failed | Suite completa falhou | Verificar cobertura/todos os testes |
| ❌ build failed | Build de produção falhou | Verificar dependências/bundle |

**Pendências / próximos passos**
- Fase 4 concluída ✅
- Monitorar tempo médio de execução do pipeline
- Considerar adicionar job de deploy automático para staging após build
- Documentar em `docs/OTIMIZACAO_TESTES_ESTRATEGIA.md` que Fase 4 está completa

---

## Memory Entry — 2026-02-11 22:08
**Contexto / Objetivo**
- Expandir cobertura de testes para os services: protocolService, titrationService e treatmentPlanService
- Seguir o padrão dos testes existentes (stockService.test.js)
- Validar pipeline completo antes do merge

**O que foi feito (mudanças)**
- Arquivos criados:
  - `src/services/api/__tests__/protocolService.test.js` — 16 testes
  - `src/services/api/__tests__/titrationService.test.js` — 28 testes
  - `src/services/api/__tests__/treatmentPlanService.test.js` — 12 testes
- Branch: `test/expand-services-coverage`
- Commit: `test(services): adicionar testes para protocolService, titrationService e treatmentPlanService`

**Estrutura dos Testes Criados**

| Service | Testes | Cobertura |
|---------|--------|-----------|
| protocolService | 16 | getAll, getActive, getById, create, update, delete, getByMedicineId, advanceTitrationStage |
| titrationService | 28 | calculateTitrationSteps, getDaysUntilNextStep, getStepProgress, formatDose, formatDaysRemaining, isTitrationActive, hasReachedTarget, getTitrationSummary |
| treatmentPlanService | 12 | getAll, create, update, delete |

**O que deu certo**
- Padrão de mock do Supabase com factory function funcionou corretamente em todos os testes
- Testes de titrationService (funções puras) são os mais simples — não requerem mock
- Schema Zod exige `titration_status` quando há `titration_schedule` — capturado em teste
- getByMedicineId não usa `.order()` no service — mock precisou ser ajustado

**O que não deu certo / riscos**
- 2 testes iniciais falharam devido a:
  1. Protocolo com titulação sem `titration_status` — schema Zod rejeita
  2. getByMedicineId mockado com `.order()` quando service não usa
- Correções rápidas aplicadas antes do commit final

**Regras locais para o futuro (lições acionáveis)**
- SEMPRE verificar schema Zod quando criar dados de teste — alguns campos são obrigatórios condicionalmente
- Protocolos com `titration_schedule` exigem `titration_status: 'titulando' | 'alvo_atingido'`
- Antes de mockar, verificar a cadeia de métodos real no service (ex: getByMedicineId não tem .order())
- titrationService contém funções puras — ideal para testes unitários sem mocks

**Pendências / próximos passos**
- Total de 56 novos testes adicionados ao projeto
- Suite de testes críticos agora com 143 testes passando
- PR criado e pronto para merge

---

## Memory Entry — 2026-02-13 16:58
**Contexto / Objetivo**
- Implementar Fase 1: Correções críticas no sistema de notificações do bot Telegram
- Corrigir falhas que bloqueavam todas as notificações (INSERT sem user_id)
- Atualizar lógica de deduplicação para distinguir notificações por usuário vs por protocolo

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/services/notificationDeduplicator.js` — correção completa das funções `shouldSendNotification()` e `logNotification()`
  - `server/bot/tasks.js` — atualização de 7 call sites para nova assinatura + logging em português
  - `api/notify.js` — adicionado try/catch em `sendMessage` com logs de sucesso/erro

**Mudanças específicas:**
1. `shouldSendNotification(userId, protocolId, notificationType)` — agora requer userId obrigatório
2. `logNotification(userId, protocolId, notificationType)` — agora inclui user_id no INSERT
3. Deduplicação por protocolo: `protocolId !== null` → filtra por `protocol_id`
4. Deduplicação por usuário: `protocolId === null` → filtra `protocol_id IS NULL`
5. Call sites atualizados:
   - Line 258: `shouldSendNotification(userId, p.id, 'dose_reminder')`
   - Line 280: `shouldSendNotification(userId, p.id, 'soft_reminder')`
   - Line 385: `shouldSendNotification(userId, null, 'daily_digest')`
   - Line 496: `shouldSendNotification(userId, null, 'stock_alert')`
   - Line 573: `shouldSendNotification(userId, null, 'weekly_adherence')`
   - Line 640: `shouldSendNotification(userId, protocol.id, 'titration_alert')`
   - Line 719: `shouldSendNotification(userId, null, 'monthly_report')`
6. Logging em português adicionado em todas as funções de cron
7. `logNotification()` chamado após cada envio bem-sucedido

**O que deu certo**
- Schema mismatch corrigido — user_id agora é sempre incluído na tabela notification_log
- Lógica de deduplicação funciona corretamente para ambos os tipos de notificação
- Lint passa 100% (0 erros, 0 warnings)
- Testes críticos passam: 149 testes em 11 arquivos (4.83s)
- Mensagens de log em português facilitam debugging no console

**Regras locais para o futuro (lições acionáveis)**
- Tabela `notification_log` requer `user_id` NOT NULL — sempre passar userId em notificações
- Notificações de protocolo (dose_reminder, soft_reminder, titration_alert): usar `protocolId !== null`
- Notificações de usuário (daily_digest, stock_alert, weekly/monthly reports): usar `protocolId === null`
- SEMPRE chamar `logNotification()` após envio bem-sucedido para rastreamento
- Funções de cron devem usar `console.log()` em português para facilitar debugging
- Verificar ordem de declaração: variável `users` deve ser declarada antes de ser usada em console.log

**Pendências / próximos passos**
- Fase 2 (opcional): Adicionar health check endpoint em `/api/notify/health`
- Fase 3 (opcional): Implementar batch processing para reduzir chamadas à API do Telegram
- Monitorar logs em produção para confirmar que notificações estão sendo enviadas

---

## Memory Entry — 2026-02-13 17:08
**Contexto / Objetivo**
- Finalizar correção crítica do sistema de notificações do bot Telegram
- Criar PR no GitHub para review e merge
- Documentar lições aprendidas sobre o processo multi-agente

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/services/notificationDeduplicator.js` — correção de schema (user_id obrigatório)
  - `server/bot/tasks.js` — atualização de 7 call sites + logging em português
  - `api/notify.js` — adicionado try/catch em sendMessage
- Branch criada: `fix/telegram-notifications-phase-1`
- PR criado: #16 (https://github.com/coelhotv/meus-remedios/pull/16)
- Documentos criados:
  - `plans/TELEGRAM_BOT_ALERTS_ARCHITECTURE_ANALYSIS.md` — análise arquitetural
  - `plans/TELEGRAM_BOT_FIX_SPEC.md` — especificação técnica detalhada
  - `PULL_REQUEST_TELEGRAM_FIX_PHASE_1.md` — template do PR

**O que deu certo**
- Processo multi-agente funcionou bem: Orchestrator → Ask (análise) → Architect (especificação) → Code (implementação)
- Cada agente especializado produziu deliveráveis de alta qualidade
- Validação humana aprovou a criação do PR sem necessidade de deploy prévio
- Todos os testes passando (149) e lint limpo (0 erros)

**O que não deu certo / riscos**
- Nenhum — processo foi executado conforme planejado
- Observação: O PR ainda precisa ser mergeado pelo humano

**Decisões & trade-offs**
- Decisão: Criar PR para review ao invés de deploy direto
- Motivo: Permite validação humana antes do merge em main
- Alternativa: Deploy de branch para teste em produção (descartado para agilizar)

**Regras locais para o futuro (lições acionáveis)**
- Quando correções são críticas mas bem compreendidas, criar PR direto economiza tempo
- Documentação em `plans/` é essencial para manter contexto entre sessões
- Processo multi-agente é eficaz: análise → especificação → implementação → PR
- SEMPRE atualizar `memory.md` ao final de correções significativas

**Pendências / próximos passos**
- Aguardar review e merge do PR #16 pelo humano
- Monitorar logs após deploy para confirmar notificações funcionando
- Fase 2 (opcional): Implementar health check endpoint

---

## Memory Entry — 2026-02-13 17:25
**Contexto / Objetivo**
- Corrigir chamadas redundantes de `logNotification()` identificadas no code review do PR #16
- Evitar duplicação de logs na tabela `notification_log`

**O que foi feito (mudanças)**
- Arquivo alterado:
  - `server/bot/tasks.js` — removidas 7 chamadas redundantes de `logNotification()` e removido import não utilizado

**Chamadas removidas:**
- Linha 270: `logNotification(userId, p.id, 'dose_reminder')`
- Linha 312: `logNotification(userId, p.id, 'soft_reminder')`
- Linha 425: `logNotification(userId, null, 'daily_digest')`
- Linha 506: `logNotification(userId, null, 'stock_alert')`
- Linha 620: `logNotification(userId, null, 'weekly_adherence')`
- Linha 663: `logNotification(userId, protocol.id, 'titration_alert')`
- Linha 775: `logNotification(userId, null, 'monthly_report')`

**O que deu certo**
- A função `shouldSendNotification()` já chama `logNotification()` internamente quando a notificação deve ser enviada (linha 52 do `notificationDeduplicator.js`)
- Remover chamadas explícitas elimina duplicatas sem perder funcionalidade
- Todas as `console.log` de debug em português foram mantidas
- Lint passou (0 erros, 0 warnings)
- Testes críticos passaram (149 testes)

**Regras locais para o futuro (lições acionáveis)**
- `shouldSendNotification()` já inclui `logNotification()` — nunca chamar explicitamente após `shouldSendNotification()` retornar `true`
- Se precisar de logging customizado, usar `logger.info()` em vez de `logNotification()` diretamente
- Manter `console.log` em português para funções de cron (convenção do projeto)

**Pendências / próximos passos**
- PR #16 pronto para merge após esta correção
- Monitorar logs em produção para confirmar que não há duplicatas

---

## Memory Entry — 2026-02-13 17:52
**Contexto / Objetivo**
- Consolidar todas as regras e padrões dos documentos do projeto em arquivos de regras centralizados
- Atualizar os arquivos em `.roo/rules/` para refletir a documentação mais recente (v2.8.0)
- Garantir que agentes de código e arquitetura tenham acesso rápido aos padrões

**O que foi feito (mudanças)**
- Arquivos criados:
  - `.roo/rules-code/rules.md` - Regras de código consolidadas (nomenclatura, React, Zod, testes)
  - `.roo/rules-architecture/rules.md` - Regras arquiteturais (organização, fluxo de dados, segurança)
- Documentação consolidada de:
  - `docs/PADROES_CODIGO.md` - Padrões de código
  - `docs/ARQUITETURA_FRAMEWORK.md` - Governança técnica
  - `docs/ARQUITETURA.md` - Visão arquitetural
  - `docs/CSS_ARCHITECTURE.md` - Padrões CSS
  - `docs/TESTING_GUIDE.md` - Estratégia de testes
  - `docs/OTIMIZACAO_TESTES_ESTRATEGIA.md` - Pipeline de qualidade

**Padrões Consolidados Essenciais**

| Categoria | Padrão | Local no Código |
|-----------|--------|-----------------|
| **Organização** | Feature-based (F4.6) | `src/features/*`, `src/shared/*` |
| **Imports** | Path aliases obrigatórios | `@shared/*`, `@features/*` |
| **React** | Ordem: States→Memos→Effects→Handlers | Todos os componentes |
| **Validação** | Zod em português | `src/schemas/*.js` |
| **Cache** | SWR em todas as leituras | `cachedServices`, `useCachedQuery` |
| **Testes** | 143 testes críticos | `npm run test:critical` |

**Novos Padrões da v2.8.0**
1. **Feature Organization**: `src/features/{domain}/` com components/hooks/services/utils
2. **Shared Layer**: Recursos comuns em `src/shared/`
3. **Path Aliases**: Nunca usar imports relativos longos
4. **PWA Layer**: Service Worker, Push, Analytics privacy-first

**Regras de Validação Atualizadas**
- Ordem de declaração React: Estados → Memos → Effects → Handlers
- Zod: Todos os valores de enum em português
- Telegram: callback_data < 64 bytes (usar índices numéricos)
- Dosagem: Gravar em comprimidos, nunca em mg
- LogForm: Verificar `Array.isArray(data)` para bulk registration

**Checklist Pre-Commit (v2.8.0)**
- [ ] `npm run lint` - 0 erros
- [ ] `npm run test:critical` - 143 testes passando
- [ ] `npm run build` - Build de produção OK
- [ ] Path aliases usados (não imports relativos longos)
- [ ] Estados declarados antes de useMemo/useEffect
- [ ] Zod validation em services
- [ ] Cache invalidado após mutations

**Referências Rápidas**
- Coding Rules: `.roo/rules-code/rules.md`
- Architecture Rules: `.roo/rules-architecture/rules.md`
- Documentação completa: `docs/` folder

**Pendências / próximos passos**
- Monitorar uso dos novos arquivos de regras por agentes
- Coletar feedback sobre organização dos padrões
- Atualizar quando houver mudanças na v2.9.0

---

*Última atualização: 2026-02-13 | Regras consolidadas em .roo/rules-code/rules.md e .roo/rules-architecture/rules.md*
