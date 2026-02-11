# Memory - Meus Remédios

Arquivo de memória longa do projeto consolidado. Contém padrões, lições aprendidas e regras operacionais verificadas.

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

*Última atualização: 2026-02-11 | Consolidação de memórias .kilocode e .roo*
