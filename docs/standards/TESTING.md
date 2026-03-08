# Guia de Testes - Meus Remédios

**Versão:** 1.0  
**Última Atualização:** 2026-02-17  
**Status:** Documento Oficial de Testes

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Testes](#arquitetura-de-testes)
3. [Localização de Arquivos](#localização-de-arquivos)
4. [Convenções de Nomenclatura](#convenções-de-nomenclatura)
5. [Tipos de Testes](#tipos-de-testes)
6. [Padrões de Teste](#padrões-de-teste)
7. [Configurações Vitest](#configurações-vitest)
8. [Scripts NPM](#scripts-npm)
9. [Pipeline CI/CD](#pipeline-cicd)
10. [Metas de Cobertura](#metas-de-cobertura)
11. [Troubleshooting](#troubleshooting)

---

## Visão Geral

Este projeto utiliza **Vitest 4.0+** como framework de testes, com uma arquitetura em pirâmide que prioriza testes unitários rápidos e confiáveis.

### Estado Atual
- **Framework**: Vitest 4.0.16
- **Ambiente**: jsdom (para testes de componentes React)
- **Cobertura**: ~40% (meta: 55% Fase 1, 70% Fase 2)
- **Smoke Tests**: 4 testes críticos (~10s execução)
- **Testes Totais**: ~25 arquivos de teste

---

## Arquitetura de Testes

### Pirâmide de Testes

```
                     /\
                    /  \         E2E Tests (FUTURO)
                   /    \        Testes manuais no browser
                  /------\
                 /        \      Integration Tests
                / Services \     Service + Supabase mocks
               /   + API    \    ~20% da suite
              /--------------\
             /                \   Unit Tests
            /  Schemas, Utils, \  Funções puras, hooks, componentes
           /   Hooks, Components\ ~80% da suite
          /----==================\
         /                        \ Smoke Tests
        /  Build + Critical Paths  \ Subset de testes unitários
       /____________________________\ ~5% da suite
```

### Categorias de Testes

| Categoria | Convenção de Nomenclatura | Configuração | Comando | Escopo |
|-----------|---------------------------|-------------|---------|--------|
| **Smoke** | `*.smoke.test.{js,jsx}` | `vitest.smoke.config.js` | `npm run test:smoke` | Verificação de build, validação de critical paths |
| **Unit** | `*.test.{js,jsx}` | `vitest.config.js` | `npm run test` | Toda lógica pura: schemas, utils, hooks, services |
| **Component** | `*.test.jsx` (em components/) | `vitest.config.js` | `npm run test:components` | Renderização e interação de componentes React |
| **Integration** | `*.integration.test.{js,jsx}` | `vitest.config.js` | `npm run test:integration` | Fluxos cross-service, multi-módulo |

---

## Localização de Arquivos

### Regra: TODOS os testes usam o padrão de subpasta `__tests__/`

Esta convenção foi escolhida porque:
- Árvore de arquivos mais limpa para navegação não-teste
- Mais fácil de fazer glob para configurações de CI
- Separação visual clara de código de produção vs teste
- Consistente com a maioria dos testes existentes no projeto

### Estrutura de Exemplo

```
src/
  services/
    api/
      medicineService.js
      __tests__/
        medicineService.test.js
        medicineService.integration.test.js
  schemas/
    medicineSchema.js
    __tests__/
      medicineSchema.test.js
      medicineSchema.smoke.test.js
  utils/
    adherenceLogic.js
    __tests__/
      adherenceLogic.test.js
  hooks/
    useCachedQuery.js
    __tests__/
      useCachedQuery.test.jsx
  components/
    medicine/
      MedicineCard.jsx
      __tests__/
        MedicineCard.test.jsx
  features/
    dashboard/
      hooks/
        useDashboardContext.jsx
        __tests__/
          useDashboardContext.test.jsx
      services/
        insightService.js
        __tests__/
          insightService.test.js

server/
  bot/
    tasks.js
    __tests__/
      tasks.test.js
  services/
    deadLetterQueue.js
    __tests__/
      deadLetterQueue.test.js
  utils/
    retryManager.js
    __tests__/
      retryManager.test.js
```

---

## Convenções de Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Teste unitário | `{sourceFileName}.test.{js,jsx}` | `medicineSchema.test.js` |
| Smoke test | `{sourceFileName}.smoke.test.{js,jsx}` | `medicineSchema.smoke.test.js` |
| Teste de integração | `{sourceFileName}.integration.test.{js,jsx}` | `stockService.integration.test.js` |
| Teste de componente | `{ComponentName}.test.jsx` | `MedicineCard.test.jsx` |

---

## Tipos de Testes

### Smoke Tests (Build + Critical Path)

**Objetivo**: Fail-safe rápido. Se estes quebrarem, nada funciona.

**Escopo**:
- Exports de schemas
- Factory functions de services
- Funções críticas de utils

**Regras**:
- Sem mocks externos (sem Supabase, sem fetch)
- Testar apenas que módulos exportam corretamente e contratos básicos funcionam
- Um smoke test por domínio: medicines, protocols, stock, adherence, hooks
- **Tempo máximo de execução**: 10 segundos total

**Exemplo**:
```javascript
// src/schemas/__tests__/medicineSchema.smoke.test.js
import { describe, it, expect } from 'vitest'
import { medicineSchema, validateMedicine } from '../medicineSchema'

describe('medicineSchema - Smoke', () => {
  it('deve exportar schema principal', () => {
    expect(medicineSchema).toBeDefined()
    expect(typeof medicineSchema.parse).toBe('function')
  })

  it('deve exportar função de validação', () => {
    expect(validateMedicine).toBeDefined()
    expect(typeof validateMedicine).toBe('function')
  })
})
```

### Unit Tests (Lógica Pura)

**Objetivo**: Validar funções individuais, hooks e componentes em isolamento.

**Escopo**:
- **Schemas**: Todo schema Zod valida dados corretos e rejeita inválidos
- **Utils**: Toda função exportada com casos extremos
- **Hooks**: Testes de comportamento com `renderHook`
- **Services**: Lógica de negócio com Supabase mockado
- **Components**: Renderização, interação do usuário, mudanças de estado

**Regras**:
- Mockar TODAS as dependências externas (Supabase, fetch, localStorage)
- Cada arquivo de teste mapeia 1:1 para um arquivo fonte
- Usar blocos `describe` organizados por função/método
- Usar português para descrições de teste (matches convenção do projeto)
- Testar caminhos de sucesso e erro
- Usar helpers de data relativa, nunca datas hardcoded

**Exemplo**:
```javascript
// src/schemas/__tests__/medicineSchema.test.js
import { describe, it, expect } from 'vitest'
import { validateMedicine } from '../medicineSchema'

describe('medicineSchema', () => {
  describe('validação de criação', () => {
    it('deve aceitar dados válidos', () => {
      const valid = {
        name: 'Losartana',
        dosage_per_pill: 50,
        dosage_unit: 'mg',
        // ...
      }
      const result = validateMedicine(valid)
      expect(result.success).toBe(true)
    })

    it('deve rejeitar nome vazio', () => {
      const invalid = { name: '', dosage_per_pill: 50 }
      const result = validateMedicine(invalid)
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Nome')
    })

    it('deve rejeitar dosagem negativa', () => {
      const invalid = { name: 'Med', dosage_per_pill: -10 }
      const result = validateMedicine(invalid)
      expect(result.success).toBe(false)
    })
  })
})
```

### Component Tests (React)

**Objetivo**: Verificar renderização de componente, tratamento de props, interações do usuário.

**Escopo**: Todos os componentes em `src/components/` e `src/shared/components/`

**Regras**:
- Usar `@testing-library/react` exclusivamente (sem `enzyme`, sem DOM direto)
- Mockar framer-motion com padrão de destructure padrão (documentado abaixo)
- Mockar Supabase no nível de service, não no nível de componente
- Testar: renderiza sem crash, lida com props, interações do usuário, estados loading/error
- Acessibilidade: elementos interativos chave devem ter labels acessíveis

**Exemplo**:
```javascript
// src/components/ui/__tests__/Button.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from '../Button'

describe('Button', () => {
  it('deve renderizar com children', () => {
    render(<Button>Clique aqui</Button>)
    expect(screen.getByText('Clique aqui')).toBeInTheDocument()
  })

  it('deve chamar onClick quando clicado', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clique</Button>)
    fireEvent.click(screen.getByText('Clique'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('deve estar desabilitado quando disabled=true', () => {
    render(<Button disabled>Desabilitado</Button>)
    expect(screen.getByText('Desabilitado')).toBeDisabled()
  })
})
```

### Integration Tests (Cross-Module)

**Objetivo**: Verificar que módulos funcionam corretamente juntos.

**Escopo**: Cadeias de services (ex: criação de log + decremento de estoque), fluxos de submissão de forms

**Regras**:
- Pode usar menos mocking que testes unitários
- Deve ainda mockar Supabase (sem chamadas reais ao DB)
- Testar fluxos realistas de usuário end-to-end dentro do frontend

**Exemplo**:
```javascript
// src/services/api/__tests__/logService.integration.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logService } from '../logService'
import { stockService } from '../stockService'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }))
  }
}))

describe('logService - Integration', () => {
  it('deve decrementar estoque ao registrar dose', async () => {
    const log = {
      medicine_id: '123',
      quantity_taken: 2,
      log_date: new Date().toISOString()
    }

    await logService.create(log)
    
    // Verificar que estoque foi decrementado
    // (em teste real, mockaria ambos os services)
  })
})
```

---

## Padrões de Teste

### Mocking Supabase

```javascript
// __mocks__/supabase.js (mock compartilhado)
import { vi } from 'vitest'

export const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
}

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}))
```

### Mocking Framer Motion

```javascript
import { vi } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ initial, animate, exit, transition, whileHover, whileTap, ...props }) => 
      <div {...props} />
    ),
    span: vi.fn(({ initial, animate, exit, transition, ...props }) => 
      <span {...props} />
    ),
  },
  AnimatePresence: vi.fn(({ children }) => <>{children}</>),
}))
```

### Tratamento de Datas

```javascript
// SEMPRE usar datas relativas
const getRelativeDate = (daysOffset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().split('T')[0]
}

// Uso em testes
const today = getRelativeDate(0)
const tomorrow = getRelativeDate(1)
const yesterday = getRelativeDate(-1)

// NUNCA usar datas fixas
// ❌ RUIM: const date = '2026-02-11'
```

### Idioma das Descrições

```javascript
// Usar português para blocos describe/it
describe('medicineSchema', () => {
  describe('validação de criação', () => {
    it('deve aceitar dados válidos', () => { /* ... */ })
    it('deve rejeitar nome vazio', () => { /* ... */ })
    it('deve rejeitar dosagem negativa', () => { /* ... */ })
  })

  describe('validação de atualização', () => {
    it('deve aceitar campos parciais', () => { /* ... */ })
  })
})
```

---

## Configurações Vitest

O projeto usa 3 configurações principais:

### 1. `vitest.config.js` (Padrão - Todos os Testes)

Executa TODOS os testes sob `src/`.

```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    
    pool: 'threads',
    singleThread: true,
    maxThreads: 1,
    minThreads: 1,
    
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // Incluir tudo em src/, incluindo features/
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/main.jsx',
        'src/App.jsx',
      ],
    },
  },
})
```

### 2. `vitest.smoke.config.js` (Smoke Tests Apenas)

Executa apenas testes `*.smoke.test.*`.

```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.smoke.test.{js,jsx}'],
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 5000,
    reporters: ['dot'],
  },
})
```

### 3. `vitest.lowram.config.js` (Máquinas com Pouca RAM - 8GB)

Executado sequencialmente para máquinas com recursos limitados (MacBook Air 2013, etc).

**Características**:
- `pool: 'forks'` com `singleFork: true` - Execução estritamente sequencial
- `testTimeout: 15000` - Timeouts mais generosos para máquinas lentas
- Coverage desabilitado por padrão (economiza ~200MB de memória)
- Reporter `dot` para output minimalista
- Exclusões: useCachedQueries e useCachedMutation (requerem arquitetura diferente)

```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/useCachedQueries.test.jsx',
      '**/useCachedMutation.test.jsx',
    ],

    coverage: { enabled: false },
    reporters: ['dot'],
    cache: { dir: '.vitest-cache-lowram' },
  },
})
```

**Uso**:
```bash
npm run test:lowram
```

### 4. `vitest.ci.config.js` (CI/CD com Coverage)

Suite completa com relatório de cobertura.

```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    pool: 'threads',
    maxThreads: 2,
    minThreads: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
    
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/',
        'src/main.jsx',
        'src/App.jsx',
        '**/__tests__/**',
        '**/*.test.{js,jsx}',
        '**/*.config.js',
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
      },
    },
  },
})
```

---

## Scripts NPM

### Scripts de Teste

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "vitest run --config vitest.smoke.config.js",
    "test:critical": "vitest run --config vitest.critical.config.js",
    "test:unit": "vitest run --config vitest.config.js",
    "test:lowram": "vitest run --config vitest.lowram.config.js",
    "test:changed": "vitest run --changed=main",
    "test:coverage": "vitest run --config vitest.ci.config.js",
    "test:components": "vitest run 'src/**/components/**/__tests__/*.test.jsx'",
    "test:services": "vitest run 'src/**/services/**/__tests__/*.test.js'",
    "validate:quick": "npm run lint && node scripts/run-tests-with-timeout.mjs 300 npm run test:changed",
    "validate:agent": "node scripts/run-tests-with-timeout.mjs 600 npm run -- test:critical --bail=1",
    "validate:full": "npm run lint && node scripts/run-tests-with-timeout.mjs 900 npm run test:coverage && npm run build"
  }
}
```

### Quando Usar Cada Comando

| Situação | Comando | Timeout | Tempo Real | Threads | Recomendado |
|----------|---------|---------|-----------|---------|-----------|
| Durante desenvolvimento | `npm run test:watch` | — | Contínuo | 1 | ✅ Sim |
| **Antes de commit (recomendado)** | **`npm run test:fast`** | — | **~6.5 min** | **1** | **✅ Recomendado** |
| Antes de commit (rápido) | `npm run test:changed` | 5 min | ~30s | 1 | Para iterações rápidas |
| Validação para agentes | `npm run validate:agent` | **10 min** | ~3 min | 4+ | ✅ Executado automaticamente |
| Validação pré-push (humano) | `npm run test:smoke` | — | ~10s | 1 | ✅ Fail-fast |
| Suite crítica (paralelo) | `npm run test:critical` | — | ~3 min | 4+ | Para CI/CD |
| Com cobertura (CI/CD) | `npm run validate:full` | **15 min** | ~5 min | 4+ | ✅ Executado em GitHub Actions |
| **Máquinas com 8GB RAM** | **`npm run test:lowram`** | — | **~20 min** | **Sequential** | **Apenas se test:fast falhar** |
| Paralelo rápido (risco) | `npx vitest run --maxThreads=2` | — | ~3-4 min | 2 | ⚠️ Pode ter race conditions |
| Debug/desenvolvimento isolado | `npm run test:components` | — | ~1 min | 1 | Para feature específica |

**Decisão Rápida:**
- ✅ **Local dev**: Use `npm run test:fast` (~6.5 min, 1 thread, totalmente seguro)
- ⚠️ **Precisa de velocidade**: Tente `--maxThreads=2` (~3 min) com cuidado
- ❌ **Se test:fast falhar em 8GB**: Use `npm run test:lowram` (~20 min) antes de push

---

## Timeout Policy e Anti-Padrões de Hang

### Princípio

Toda execução de testes **TEM um limite de tempo global**. Testes que demoram mais de 10-20 minutos destroem a agilidade de desenvolvimento e bloqueiam agentes de programação. Múltiplas camadas de proteção evitam travamentos.

### Limites de Timeout Global

Executados via `scripts/run-tests-with-timeout.mjs` (wrapper Node.js cross-platform):

| Contexto | Timeout | Script | Por quê |
|----------|---------|--------|---------|
| **Agente de programação** | 10 min | `validate:agent` | Fail-fast, testes críticos apenas |
| **Validação rápida** | 5 min | `validate:quick` | Apenas arquivos changed since main |
| **Suite completa** | 15 min | `validate:full` | Full coverage + build |

### Anti-Padrões Proibidos que Causam Hang

#### AP-T01: `setTimeout` Hardcoded em `act()`

**Problema:** Timing-dependent; falha se componente leva mais de N ms para renderizar.

```javascript
// ❌ PROIBIDO — pode travar indefinidamente
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
})
```

**Solução:** Use `waitFor()` com polling:

```javascript
// ✅ CORRETO — polling automático até condition ou timeout
await waitFor(() => {
  expect(result.current.isLoading).toBe(false)
})
```

#### AP-T02: Promise Sem Garantia de Resolução

**Problema:** Se assertion falhar antes de `resolve()` ser chamado, promise fica pendente para sempre.

```javascript
// ❌ PROIBIDO — resolveSave() nunca executado se waitFor() falhar
let resolveSave
mock.mockImplementation(() => new Promise(r => { resolveSave = r }))
await waitFor(() => { expect(...).toBeDefined() })
resolveSave() // ← Orphaned se expect acima falhar
```

**Solução:** Envolver em `try/finally`:

```javascript
// ✅ CORRETO
try {
  await waitFor(() => { expect(...).toBeDefined() })
} finally {
  resolveSave?.()  // Sempre executado, mesmo com erro
}
```

#### AP-T03: Timers Reais em Testes de Cancelamento/Cleanup

**Problema:** Timing frágil em CI — 150ms em máquina local pode não ser suficiente sob carga.

```javascript
// ❌ PROIBIDO — flaky em CI
unmount()
await new Promise(resolve => setTimeout(resolve, 150))
expect(result.current.data).toBe(undefined)
```

**Solução:** Use fake timers para controle determinístico:

```javascript
// ✅ CORRETO
vi.useFakeTimers()
unmount()
await vi.runAllTimersAsync()  // Drena todos os timers, determinístico
expect(result.current.data).toBe(undefined)
vi.useRealTimers()
```

#### AP-T04: Serviços Externos Sem Mock em Testes de Hooks com Provider

**Problema:** Hook que chama Provider que chama Supabase real sem env vars → promise nunca resolve → hang.

```javascript
// ❌ PROIBIDO — DashboardProvider chama medicineService.getAll() sem mock
const { result } = renderHook(() => useDashboard(), {
  wrapper: DashboardProvider,
})
```

**Solução:** Mock todos os serviços antes do `describe`:

```javascript
// ✅ CORRETO — mockar no top-level (Vitest hoists vi.mock)
vi.mock('@medications/services/medicineService', () => ({
  medicineService: { getAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@protocols/services/protocolService', () => ({
  protocolService: { getActive: vi.fn().mockResolvedValue([]) },
}))
```

### Limites de Timeout por Nível

| Nível | Valor | Config |
|-------|-------|--------|
| **Teste individual** | 10s | `testTimeout: 10000` |
| **Hook lifecycle** | 10s | `hookTimeout: 10000` |
| **Cleanup após teste** | 5s | `teardownTimeout: 5000` |
| **Suíte crítica** | 10 min | wrapper `run-tests-with-timeout.mjs 600` |
| **Suíte completa** | 15 min | wrapper `run-tests-with-timeout.mjs 900` |

### Quando um Teste Fica em Exclusão Temporária

Se um teste deve ser excluído do `vitest.critical.config.js`:

1. **OBRIGATÓRIO:** Adicionar comentário com `// TODO: FIXME — <issue link>`
2. **OBRIGATÓRIO:** Criar GitHub issue descrevendo o problema
3. **OBRIGATÓRIO:** Resolver dentro de **2 semanas**
4. **Consequência:** Após 2 semanas, teste é removido da suite inteira (coverage fica vermelha)

Exemplo:
```javascript
// Temporário — exclusão de 2 semanas (resolver até 2026-03-08)
// TODO: FIXME — https://github.com/project/issues/123
'src/shared/hooks/__tests__/useCachedQuery.test.jsx',
```

---

## Pipeline CI/CD

```
PR Aberto / Push para main
         |
    [Job 1: Lint]                    ~2 min
         |
    [Job 2: Build]                   ~3 min
         |
    [Job 3: Smoke Tests]             ~10 sec
         |
    [Job 4: Suite Completa + Coverage]  ~5 min
         |
    [Upload Coverage Artifact]
         |
    PASS = Merge permitido
```

### Mudanças em Relação ao Pipeline Atual

- Build roda ANTES dos testes (captura erros de build mais rápido)
- Smoke tests rodam standalone (sem prefix `npm run build`)
- Job "full test" único substitui jobs separate critical/build
- Coverage sempre gerado no CI (não opcional)

---

## Metas de Cobertura

| Domínio | Atual (est.) | Meta Fase 1 | Meta Fase 2 |
|---------|-------------|-------------|-------------|
| `src/schemas/` | ~80% | 95% | 95% |
| `src/utils/` | ~70% | 85% | 90% |
| `src/services/` | ~60% | 75% | 85% |
| `src/hooks/` | ~50% | 70% | 80% |
| `src/components/` | ~20% | 40% | 60% |
| `src/features/` | 0% | 30% | 60% |
| `server/` | 0% | 20% | 50% |
| **Overall** | ~40% | **55%** | **70%** |

---

## Troubleshooting

### Problema: Testes falham com "Cannot find module"

**Causa**: Importações incorretas ou mocks não aplicados antes dos imports.

**Solução**:
```javascript
// ✅ CORRETO - Mock ANTES do import
vi.mock('../../lib/supabase', () => ({ /* ... */ }))
import { medicineService } from '../medicineService'

// ❌ ERRADO - Import antes do mock
import { medicineService } from '../medicineService'
vi.mock('../../lib/supabase', () => ({ /* ... */ }))
```

### Problema: Testes de componente falham com erros do Framer Motion

**Causa**: Framer Motion não mockado corretamente.

**Solução**: Use o padrão de mock completo:
```javascript
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ initial, animate, exit, transition, whileHover, whileTap, ...props }) => 
      <div {...props} />
    ),
  },
  AnimatePresence: vi.fn(({ children }) => <>{children}</>),
}))
```

### Problema: Testes falham com datas no futuro filtradas

**Causa**: Datas hardcoded que se tornam passadas.

**Solução**: Use sempre helpers de data relativa:
```javascript
const getRelativeDate = (daysOffset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().split('T')[0]
}
```

### Problema: Coverage baixo para arquivos novos

**Causa**: Sem testes escritos.

**Solução**: Todo arquivo novo DEVE ter pelo menos um smoke test:
```javascript
describe('NovoModulo - Smoke', () => {
  it('deve exportar corretamente', () => {
    expect(NovoModulo).toBeDefined()
  })
})
```

### Problema: Vitest 4+ deprecation warnings

**Causa**: Uso de APIs antigas (`poolOptions.threads`).

**Solução**: Atualizar para API nova:
```javascript
// ❌ ANTIGO (Vitest 3)
poolOptions: {
  threads: { maxThreads: 2 }
}

// ✅ NOVO (Vitest 4+)
pool: 'threads',
maxThreads: 2,
minThreads: 1
```

### Problema: Testes OOM (Out of Memory) em máquinas com 8GB RAM

**Sintomas**:
- Worker crashes com "JS heap out of memory"
- Tests começam a passar mas falham ~8 testes depois
- Vitest timeout "Worker terminated due to reaching memory limit"

**Causas**:
1. Múltiplas promises não foram GC'd (Promise.all em parallel queries)
2. SetInterval executando globalmente (garbage collection não parado em testes)
3. localStorage em jsdom acumulando dados entre testes
4. Cache crescendo sem limite quando múltiplas entradas adicionadas

**Soluções por severidade**:

**Opção 1 - Imediata (Funciona hoje)**:
```bash
npm run test:lowram
```
Usa execução sequencial e exclui testes memory-intensive.

**Opção 2 - Para desenvolvimento**:
```bash
# Rode testes em arquivo individual (cada arquivo = novo worker)
NODE_ENV=test npx vitest run src/shared/hooks/__tests__/useCachedQuery.test.jsx

# Rode sem cache accumulation
npm run test:smoke  # Testes básicos, sempre funciona
```

**Opção 3 - Arquitetura (Longo prazo)**:
- Refatorar queryCache para evitar Promise.all em paralelo
- Implementar page-based cursoring ao invés de acumular 200 entradas
- Usar WeakMap para cache (permite GC de entries não usadas)

**Debugging**:
```javascript
// No seu teste, verifique memory entre testes
afterEach(() => {
  clearCache()
  vi.clearAllMocks()
  vi.clearAllTimers()
  if (global.gc) global.gc()  // Force GC hint
})
```

---

## Referências

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [`ARQUITETURA.md`](../ARQUITETURA.md) - Arquitetura do sistema
- [`PADROES_CODIGO.md`](../PADROES_CODIGO.md) - Padrões de código
- [`.memory/rules.md`](../../.memory/rules.md) - Lições aprendidas

---

*Última atualização: 2026-02-17 | v1.0*
