# Guia de Testing - Meus Remédios

> Guia prático para desenvolvedores - Como executar testes de forma eficiente no projeto

---

## 📋 Sumário

1. [Comandos Disponíveis](#comandos-disponíveis)
2. [Hooks Automáticos](#hooks-automáticos)
3. [CI/CD](#cicd)
4. [Estrutura de Testes](#estrutura-de-testes)
5. [Boas Práticas](#boas-práticas)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Comandos Disponíveis

### Desenvolvimento Local

| Comando | Quando Usar | Tempo | Testes |
|---------|-------------|-------|--------|
| `npm run test:changed` | Verificar mudanças locais | ~10-20s | Modificados desde main |
| `npm run test:critical` | Mudanças em core (services/schemas) | ~30s | 143 testes |
| `npm run test:light` | Testes rápidos sem componentes | ~15s | ~100 testes |
| `npm run test:smoke` | Validação mínima pré-commit | ~6s | 7 testes |
| `npm run test:smart` | Seleção inteligente baseada em diff | Variável | Automático |
| `npm run test:quick` | Saída resumida (30 primeiras linhas) | ~30s | Todos (resumido) |

#### Exemplos de Uso

```bash
# Durante desenvolvimento - feedback contínuo
npm run test:watch:changed

# Verificar impacto das mudanças antes de commit
npm run test:changed

# Mudanças em services ou schemas
npm run test:critical

# Validação rápida sem UI
npm run test:light

# Script inteligente (detecta tipo de mudança)
npm run test:smart
```

### Validação Completa

| Comando | Quando Usar | Tempo | O que inclui |
|---------|-------------|-------|--------------|
| `npm run validate` | Antes de push importante | ~40s | Lint + 143 testes |
| `npm run validate:quick` | Durante desenvolvimento | ~20-30s | Lint + testes modificados |
| `npm run test:full` | Verificação completa | ~2-3min | Todos os testes |
| `npm run test:coverage` | Análise de cobertura | ~3-5min | Todos + relatório |

#### Exemplos de Uso

```bash
# Antes de push (recomendado)
npm run validate

# Durante desenvolvimento iterativo
npm run validate:quick

# Verificação completa antes de PR
npm run test:full

# Análise de cobertura
npm run test:coverage
```

### Watch Mode (Desenvolvimento Contínuo)

| Comando | Uso | Observação |
|---------|-----|------------|
| `npm run test:watch` | Modo contínuo padrão | Todos os testes |
| `npm run test:watch:changed` | Apenas modificados | Mais rápido |
| `npm run test:watch:critical` | Core da aplicação | Services, utils, schemas |

---

## 🪝 Hooks Automáticos

O projeto utiliza [Husky](https://typicode.github.io/husky/) para gerenciar hooks do Git automaticamente.

### Pre-commit Hook

**Executa automaticamente antes de cada commit:**

```bash
# 1. Testes em arquivos staged
vitest run --changed --passWithNoTests

# 2. ESLint com auto-fix
eslint --fix

# 3. Prettier para formatação
prettier --write --ignore-unknown
```

**Tempo típico:** 10-20 segundos

**Se falhar:** Commit é abortado, corrija os erros e tente novamente

### Pre-push Hook

**Executa automaticamente antes de cada push:**

```bash
# Testes críticos (143 testes)
npm run test:critical
```

**Tempo típico:** ~30 segundos

**Se falhar:** Push é abortado, execute `npm run validate` para investigar

### Bypassar Hooks (Emergência)

⚠️ **Use com extrema cautela:**

```bash
# Bypassar pre-commit
git commit --no-verify -m "mensagem"

# Bypassar pre-push
git push --no-verify
```

---

## 🔄 CI/CD

### Pipeline no GitHub Actions

O pipeline executa em camadas progressivas para feedback rápido:

```
┌─────────────────────────────────────────────────────────────┐
│  Job 1: Lint (3min)                                         │
│  └── ESLint em todo o código                                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  Job 2: Smoke Tests (5min)                                  │
│  └── Build + 7 testes críticos                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
        ┌──────────────┴──────────────┐
        ↓                             ↓
┌──────────────────┐      ┌──────────────────┐
│ Job 3: Critical  │      │ Job 4: Build     │
│ (8min)           │      │ (5min)           │
│ 143 testes       │      │ Verificação      │
└────────┬─────────┘      └──────────────────┘
         ↓
┌──────────────────┐
│ Job 5: Full      │
│ (15min)          │
│ Suite completa   │
│ + Coverage       │
└──────────────────┘
```

### Status Checks

Cada PR deve passar por:

1. ✅ **Lint** - Código sem erros de estilo
2. ✅ **Smoke Tests** - Build e testes básicos passam
3. ✅ **Critical Tests** - 143 testes unitários passam
4. ✅ **Full Suite** - Todos os testes passam (incluindo componentes)
5. ✅ **Build** - Build de produção gera sem erros

### Artefatos Gerados

| Artefato | Descrição | Retenção |
|----------|-----------|----------|
| `coverage-report` | Relatório HTML de cobertura | 7 dias |
| `build-dist` | Build de produção | 1 dia |

### Acesso aos Resultados

1. Abra o PR no GitHub
2. Clique em "Checks" ou "Actions"
3. Visualize o status de cada job
4. Baixe os artifacts (coverage, build) se necessário

---

## 🏗️ Estrutura de Testes

### Smoke Tests (`*.smoke.test.js`)

Testes ultrarrápidos para validação básica do sistema:

| Arquivo | Testes | Propósito |
|---------|--------|-----------|
| [`medicine.smoke.test.js`](../src/schemas/__tests__/medicine.smoke.test.js) | 1 | Validação básica de schema |
| [`queryCache.smoke.test.js`](../src/lib/__tests__/queryCache.smoke.test.js) | 2 | Cache SWR funciona |
| [`stock.smoke.test.js`](../src/services/api/__tests__/stock.smoke.test.js) | 1 | Service de estoque carrega |
| [`useCachedQuery.smoke.test.jsx`](../src/hooks/__tests__/useCachedQuery.smoke.test.jsx) | 2 | Hook de cache funciona |
| [`adherence.smoke.test.js`](../src/utils/__tests__/adherence.smoke.test.js) | 1 | Lógica de adesão funciona |

**Características:**
- Execução em ~6 segundos
- Sem mocks complexos
- Validam integridade básica
- Primeira linha de defesa

### Unitários Críticos (143 testes)

#### Services (87 testes)

| Service | Arquivo | Testes | Cobertura |
|---------|---------|--------|-----------|
| Protocol | [`protocolService.test.js`](../src/services/api/__tests__/protocolService.test.js) | 16 | 85%+ |
| Titration | [`titrationService.test.js`](../src/services/api/__tests__/titrationService.test.js) | 28 | 90%+ |
| Treatment Plan | [`treatmentPlanService.test.js`](../src/services/api/__tests__/treatmentPlanService.test.js) | 12 | 85%+ |
| Stock | [`stockService.test.js`](../src/services/api/__tests__/stockService.test.js) | 12 | 85%+ |
| Log | [`logService.test.js`](../src/services/api/__tests__/logService.test.js) | 19 | 80%+ |

#### Utils (7 testes)

| Utilitário | Arquivo | Testes |
|------------|---------|--------|
| Titration Utils | [`titrationUtils.test.js`](../src/utils/__tests__/titrationUtils.test.js) | 7 |

#### Schemas (23 testes)

| Schema | Arquivo | Testes |
|--------|---------|--------|
| Validação Geral | [`validation.test.js`](../src/schemas/__tests__/validation.test.js) | 23 |

#### Hooks (26 testes)

| Hook | Arquivo | Testes |
|------|---------|--------|
| useCachedQuery | [`useCachedQuery.test.jsx`](../src/hooks/__tests__/useCachedQuery.test.jsx) | 16 |
| useDashboardContext | [`useDashboardContext.test.jsx`](../src/hooks/__tests__/useDashboardContext.test.jsx) | 10 |

### Componentes do Dashboard (Sparkline Drill-Down)

Testes abrangentes para a funcionalidade de drill-down do gráfico de adesão:

| Componente | Arquivo | Testes | Cobertura |
|------------|---------|--------|-----------|
| SparklineAdesao | [`SparklineAdesao.test.jsx`](../src/components/dashboard/__tests__/SparklineAdesao.test.jsx) | 25+ | Renderização, interações, acessibilidade |
| DailyDoseModal | [`DailyDoseModal.test.jsx`](../src/components/dashboard/__tests__/DailyDoseModal.test.jsx) | 25 | Estados loading/empty/error, navegação, resumo |
| DoseListItem | [`DoseListItem.test.jsx`](../src/components/dashboard/__tests__/DoseListItem.test.jsx) | 23 | Status, horários, quantidades, acessibilidade |
| Dashboard (integração) | [`Dashboard.drilldown.test.jsx`](../src/components/dashboard/__tests__/Dashboard.drilldown.test.jsx) | 15+ | Fluxo drill-down completo |
| **Total Feature** | **4 arquivos** | **88+** | **Feature completa** |

**Para executar testes de componentes:**
```bash
npx vitest run --config vitest.component.config.js
```

### Componentes (Testes Existentes)

Localizados em `src/components/**/__tests__/*.test.jsx`:

- `LogForm.test.jsx`
- `StockForm.test.jsx`
- `Button.test.jsx`
- `HealthScoreCard.test.jsx`
- `SmartAlerts.test.jsx`
- `StockAlertsWidget.test.jsx`

**Nota:** Estes testes são mais lentos e não são incluídos em `test:critical` ou `test:light`.

---

## ✅ Boas Práticas

### 1. Durante o Desenvolvimento

```bash
# Feedback contínuo em watch mode
npm run test:watch:changed

# A cada mudança significativa
npm run test:changed

# Antes de considerar uma tarefa concluída
npm run test:critical
```

### 2. Antes de Commit

✅ **O hook pre-commit já faz isso automaticamente:**
- Testes em arquivos staged
- Lint com auto-fix
- Prettier

**Se quiser verificar manualmente:**
```bash
npm run validate:quick
```

### 3. Antes de Push

✅ **O hook pre-push já executa `test:critical`**

**Se quiser validação mais completa:**
```bash
npm run validate  # Lint + 143 testes
```

### 4. Antes de Criar PR

```bash
# Suite completa local
npm run test:full

# Ou com cobertura
npm run test:coverage
```

### 5. Escrevendo Novos Testes

#### Padrão para Services

```javascript
// src/services/api/__tests__/meuService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Supabase DEVE vir antes do import do service
vi.mock('../../lib/supabase.js', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      // ... outros métodos
    }))
  }
}))

import { meuService } from '../meuService.js'

describe('meuService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('deve retornar lista de itens', async () => {
      // Arrange
      const mockData = [{ id: 1, nome: 'Teste' }]
      
      // Act
      const result = await meuService.getAll()
      
      // Assert
      expect(result).toEqual(mockData)
    })
  })
})
```

#### Padrão para Smoke Tests

```javascript
// src/services/api/__tests__/meuService.smoke.test.js
import { describe, it, expect } from 'vitest'
import { meuService } from '../meuService.js'

describe('meuService - Smoke', () => {
  it('deve exportar funções esperadas', () => {
    expect(meuService).toHaveProperty('getAll')
    expect(meuService).toHaveProperty('create')
    expect(typeof meuService.getAll).toBe('function')
  })
})
```

### 6. Padrões de Nomenclatura

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Arquivos de teste | `*.test.js` ou `*.test.jsx` | `meuService.test.js` |
| Smoke tests | `*.smoke.test.js` | `meuService.smoke.test.js` |
| Describe | Descreve o módulo | `'meuService'` |
| It | Começa com "deve" | `'deve retornar dados'` |

---

## 🐛 Troubleshooting

### Problema: Testes falham apenas no CI

**Sintoma:** Passam localmente, falham no GitHub Actions

**Causas comuns:**
1. Cache desatualizado
2. Diferença de ambiente (Node version)
3. Mock não isolado corretamente

**Solução:**
```bash
# Limpar tudo e reinstalar
rm -rf node_modules .vitest-cache
npm ci

# Executar suite completa local
npm run test:full
```

### Problema: `test:changed` não detecta testes

**Sintoma:** "No test files found"

**Causa:** Arquivo não tem teste correspondente ou não está no git

**Solução:**
```bash
# Verificar padrão de busca
vitest run --changed --reporter=verbose

# Forçar execução específica
vitest run src/components/MeuComponente.test.jsx

# Adicionar arquivo ao git primeiro
git add src/components/MeuComponente.jsx
```

### Problema: Smoke tests falham

**Sintoma:** Build falha ou testes básicos não passam

**Causas comuns:**
1. Erro de sintaxe
2. Import quebrado
3. Export faltando

**Solução:**
```bash
# Verificar build primeiro
npm run build

# Executar smoke com verbose
vitest run --config vitest.smoke.config.js --reporter=verbose

# Verificar import/exports
node -e "import('./src/services/api/meuService.js').then(m => console.log(Object.keys(m)))"
```

### Problema: Testes críticos lentos

**Sintoma:** `test:critical` demora mais de 1 minuto

**Causa:** Possível vazamento de memória ou testes mal isolados

**Solução:**
```bash
# Executar com apenas 1 worker
vitest run src/services --pool=forks --maxWorkers=1

# Verificar memória
vitest run src/services --reporter=verbose 2>&1 | grep -i "memory\|heap"
```

### Problema: Hooks não executam

**Sintoma:** Commit/push ocorre sem rodar testes

**Causas comuns:**
1. Husky não instalado
2. Hooks não são executáveis
3. Bypass com `--no-verify`

**Solução:**
```bash
# Reinstalar husky
npm run prepare

# Verificar se hooks existem
ls -la .husky/

# Tornar executáveis (se necessário)
chmod +x .husky/pre-commit
chmod +x .husky/pre-push

# Testar hooks manualmente
npx husky run pre-commit
```

### Problema: Lint errors em testes

**Sintoma:** ESLint reclama de `describe`, `it`, `expect` não definidos

**Causa:** Vitest globals não configurados no ESLint

**Solução:** Já configurado no `vite.config.js`, mas se precisar:

```javascript
// Adicionar ao eslint.config.js se necessário
{
  files: ['**/*.test.{js,jsx}'],
  languageOptions: {
    globals: {
      describe: 'readonly',
      it: 'readonly',
      expect: 'readonly',
      beforeEach: 'readonly',
      afterEach: 'readonly',
      vi: 'readonly',
    },
  },
}
```

### Problema: Mock do Supabase não funciona

**Sintoma:** Teste usa dados reais ou falha com erro de conexão

**Causa:** Mock não está sendo aplicado corretamente

**Solução:**
```javascript
// ✅ Correto: Mock ANTES do import
vi.mock('../../lib/supabase.js', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null })
    }))
  }
}))

import { meuService } from '../meuService.js'

// ❌ Errado: Mock DEPOIS do import
import { meuService } from '../meuService.js'
vi.mock('../../lib/supabase.js', ...)
```

---

## 📊 Métricas de Referência

### Tempos Esperados

| Comando | Tempo Máximo Aceitável | Média Observada |
|---------|----------------------|-----------------|
| `test:changed` | 30s | 15s |
| `test:critical` | 1min | 30s |
| `test:light` | 30s | 15s |
| `test:smoke` | 15s | 6s |
| `validate` | 1min | 40s |
| `test:full` | 5min | 2-3min |

### Se testes estão mais lentos:

1. Verifique se há vazamento de memória
2. Limpe cache: `rm -rf .vitest-cache`
3. Reduza workers: `--maxWorkers=1`
4. Verifique se há loops infinitos em hooks

---

## 🔗 Referências

- [Estratégia de Otimização](./OTIMIZACAO_TESTES_ESTRATEGIA.md) - Documentação completa da estratégia
- [Relatório de Lint e Cobertura](./LINT_COVERAGE.md) - Status de qualidade
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Husky Documentation](https://typicode.github.io/husky/)

---

*Documento criado em: 11 de Fevereiro de 2026*  
*Versão: 1.0*  
*Status: **ATIVO** ✅*
