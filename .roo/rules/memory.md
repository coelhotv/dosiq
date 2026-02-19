# Meus Remédios - Consolidated Agent Memory

> **Projeto**: Meus Remédios - Medication Management PWA  
> **Versão**: 3.0.0 | React 19 + Vite + Supabase  
> **Idioma**: Português (documentação), Inglês (pensamento/código)  
> **Última Atualização**: 2026-02-19

---

## 📋 Table of Contents

1. [Agent Learning Loop Protocol](#agent-learning-loop-protocol)
2. [Universal Golden Rules](#universal-golden-rules)
3. [Critical Constraints (Non-Negotiable)](#critical-constraints)
4. [Component Patterns & APIs](#component-patterns)
5. [Domain-Specific Knowledge](#domain-knowledge)
6. [Workflows & Checklists](#workflows)
7. [Chronological Memory Entries](#memory-entries)
8. [Anti-Patterns & Pitfalls](#anti-patterns)

---

## 1. Agent Learning Loop Protocol {#agent-learning-loop-protocol}

### 1.1 At the Beginning of Each Task Set
- **READ** this memory file: `@/.roo/rules/memory.md`
- **EXTRACT** 3-7 local rules/applicable learnings (e.g., "in this repo, X usually breaks Y")
- **CHECK** for duplicate files before modifying anything

### 1.2 At the End of Each Task Set (MANDATORY)
**APPEND** a new entry to this file. **Never overwrite** existing entries.

#### Entry Format Template:
```markdown
## Memory Entry — YYYY-MM-DD HH:MM
**Contexto / Objetivo**
- (1-3 bullets of what was requested and expected outcome)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `path/to/file.ext` — (summary)
- Comportamento impactado:
  - (bullet)

**O que deu certo**
- (2-5 bullets: techniques, approaches, decisions that worked)

**O que não deu certo / riscos**
- (2-5 bullets: dead ends, failures, attention points, debts)

**Causa raiz (se foi debug)**
- Sintoma:
- Causa:
- Correção:
- Prevenção:

**Decisões & trade-offs**
- Decisão:
- Alternativas consideradas:
- Por que:

**Regras locais para o futuro (lições acionáveis)**
- (3-7 short bullets, in "If X, then Y" style)

**Pendências / próximos passos**
- (objective bullets, with priority if possible)
```

### 1.3 What NOT to Include in Memory
- Secrets/credentials
- Long redundant text
- Discussions irrelevant to project's future
- Vague opinions without action ("it was difficult")

> If anything is uncertain, explicitly state assumptions and propose the safest next step.

---

## 2. Universal Golden Rules {#universal-golden-rules}

### 2.1 Duplicate File Prevention (HIGHEST PRIORITY)

**This prevents production bugs caused by outdated duplicate files.**

```bash
# BEFORE modifying ANY file, ALWAYS run:

# 1. Search for duplicate files with same name
find src -name "ProtocolForm*" -type f
find src -name "*Service.js" -type f | grep -i adherence

# 2. Search for all exports of the same function
grep -r "export.*adherenceService" src/

# 3. Check which file is ACTUALLY imported (trace imports)
grep -r "from.*adherenceService" src/
```

**Canonical File Locations:**
| Domain | Canonical Location | DO NOT USE |
|--------|-------------------|------------|
| Services | `src/services/api/*.js` | `src/features/*/services/*.js` |
| Schemas | `src/schemas/*.js` | `src/shared/constants/*.js` |
| Utils | `src/utils/*.js` | `src/features/*/utils/*.js` |
| Protocol Components | `src/features/protocols/components/*.jsx` | `src/components/protocol/*.jsx` |
| Dashboard Components | `src/features/dashboard/components/*.jsx` | `src/components/dashboard/*.jsx` |

**Path Aliases (from `vite.config.js`):**
| Alias | Resolves To | Warning |
|-------|-------------|---------|
| `@services` | `src/services` | Preferred |
| `@schemas` | `src/schemas` | Preferred |
| `@utils` | `src/utils` | Preferred |
| `@protocols` | `src/features/protocols` | ⚠️ Check actual path |
| `@adherence` | `src/features/adherence` | ⚠️ NOT `src/services/api/` |

**⚠️ CRITICAL**: When you see `import { x } from '@adherence/services/...'`, this resolves to `src/features/adherence/services/...`, NOT `src/services/api/...`. Always verify!

### 2.2 React Hook Declaration Order
```jsx
// ✅ CORRECT - Prevents TDZ (Temporal Dead Zone)
function Component() {
  const [data, setData] = useState()              // 1. States first
  const processed = useMemo(() => ..., [data])    // 2. Memos
  useEffect(() => { ... }, [processed])           // 3. Effects
  const handleClick = () => { ... }               // 4. Handlers
}

// ❌ WRONG - ReferenceError
function Component() {
  const processed = useMemo(() => data + 1, [data]) // data is undefined!
  const [data, setData] = useState(0)               // Too late
}
```

### 2.3 Zod Schema Values in Portuguese
```javascript
// ✅ CORRECT - UI consistency
const FREQUENCIES = ['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']
const MEDICINE_TYPES = ['comprimido', 'cápsula', 'líquido', 'injeção', 'pomada', 'spray', 'outro']
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// SEMPRE exportar labels para UI
export const FREQUENCY_LABELS = { 
  diário: 'Diário', 
  dias_alternados: 'Dias Alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessário: 'Quando Necessário'
}

// ❌ WRONG - Never use English in schemas
const FREQUENCIES = ['daily', 'weekly'] // Causes UI inconsistencies
```

### 2.4 Telegram Bot Constraints
```javascript
// ❌ WRONG - Exceeds 64 bytes
callback_data: `reg_med:${medicineId}:${protocolId}` // ~81 chars

// ✅ CORRECT - Use numeric indices
callback_data: `reg_med:${index}` // ~15 chars
session.set('medicineMap', medicines) // Store mapping in session

// ✅ MARKDOWNV2 ESCAPING (always use escapeMarkdownV2())
// Escape backslash FIRST, then other special characters
const escapeMarkdownV2 = (text) => {
  return text
    .replace(/\\/g, '\\\\')      // Must be first
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!')
}
```

### 2.5 Dosage Recording Units (CRITICAL)
```javascript
// dosage_per_intake = pills per dose (e.g., 4)
// dosage_per_pill = mg per pill (e.g., 500)
// dosage_real = 4 * 500 = 2000mg

// ✅ CORRECT - Record in pills (within Zod limit of 100)
const pillsToDecrease = quantity / dosagePerPill
await logService.create({ quantity_taken: pillsToDecrease })

// ❌ WRONG - Exceeds Zod schema limit
await logService.create({ quantity_taken: 2000 }) // mg exceeds limit!

// ✅ OPERATION ORDER: Validate → Record → Decrement
try {
  if (stock < pillsToDecrease) throw new Error('Estoque insuficiente')
  await logService.create(log)
  await stockService.decrease(medicineId, pillsToDecrease)
}
```

### 2.6 LogForm Dual Return Type
```jsx
// LogForm returns ARRAY when type === 'plan' (bulk registration)
// LogForm returns OBJECT when type === 'protocol'
// ✅ ALWAYS check both return types
if (Array.isArray(logData)) {
  await logService.createBulk(logData) // type === 'plan'
} else {
  await logService.create(logData)     // type === 'protocol'
}
```

### 2.7 Timezone Handling (GMT-3 Brazil)
```javascript
// ✅ CORRECT - Local timezone (GMT-3 for Brazil)
const parseLocalDate = (dateStr) => new Date(dateStr + 'T00:00:00')

// ❌ WRONG - Creates UTC date (21:00 previous day in GMT-3)
const parseUTCDate = (dateStr) => new Date(dateStr) // midnight UTC

// Always use parseLocalDate from dateUtils.js
import { parseLocalDate, formatLocalDate } from '@utils/dateUtils'
```

### 2.8 SWR Cache Pattern
```javascript
// ✅ Using cachedServices automatically invalidates cache
import { cachedMedicineService } from '@services/api/cachedServices'

// Read with cache
const medicines = await cachedMedicineService.getAll()

// Cache automatically invalidated after mutation
await cachedMedicineService.create(medicine)

// Manual invalidation if needed
queryCache.delete('medicines')
```

---

## 3. Critical Constraints (Non-Negotiable) {#critical-constraints}

| Constraint | Rule | Prevention |
|------------|------|------------|
| **Hook Order** | States → Memos → Effects → Handlers | Prevents TDZ errors |
| **Zod Enums** | Portuguese only | UI consistency |
| **Telegram Callback** | < 64 bytes | Use indices, not UUIDs |
| **Dosage Units** | Pills, never mg | `quantity_taken = pills` |
| **Operation Order** | Validate → Record → Decrement | Stock consistency |
| **Duplicate Files** | Check before modifying | `find src -name "*File*"` |
| **Import Path** | Verify actual resolution | Check `vite.config.js` aliases |
| **MarkdownV2** | Always escape special chars | Use `escapeMarkdownV2()` |
| **Timezone** | Use `T00:00:00` suffix | Prevents GMT-3 offset bugs |
| **JSDoc** | Portuguese only | Documentation consistency |

---

## 4. Component Patterns & APIs {#component-patterns}

### 4.1 Consolidated Components (v2.7.0+)

| Component | Location | Pattern | Key Props |
|-----------|----------|---------|-----------|
| [`MedicineForm`](src/components/medicine/MedicineForm.jsx) | `src/components/medicine/` | Onboarding props | `onSuccess`, `autoAdvance`, `showCancelButton` |
| [`ProtocolForm`](src/features/protocols/components/ProtocolForm.jsx) | `src/features/protocols/components/` | Mode-based | `mode='full' \| 'simple'`, `preselectedMedicine` |
| [`Calendar`](src/components/ui/Calendar.jsx) | `src/components/ui/` | Feature flags | `enableLazyLoad`, `enableSwipe`, `enableMonthPicker` |
| [`AlertList`](src/components/ui/AlertList.jsx) | `src/components/ui/` | Base + variant | `variant='smart' \| 'stock'` |
| [`LogForm`](src/components/log/LogForm.jsx) | `src/components/log/` | UX unified | Always pass `treatmentPlans` for bulk registration |

### 4.2 Props with Defaults (Backward Compatibility)
```jsx
function MedicineForm({
  onSave,
  onSuccess,              // Optional: enables onboarding mode
  autoAdvance = false,    // false = default behavior
  showCancelButton = true // true = default behavior
})
```

### 4.3 Framer Motion + ESLint
```javascript
// Add to eslint.config.js:
varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])'
```

---

## 5. Domain-Specific Knowledge {#domain-knowledge}

### 5.1 CSS & UI Tokens

**Glassmorphism:**
```css
--glass-light: rgba(255, 255, 255, 0.03);
--glass-standard: rgba(255, 255, 255, 0.08);
--glass-heavy: rgba(255, 255, 255, 0.15);
--glass-hero: rgba(255, 255, 255, 0.2);
```

**Mobile Modals:**
```css
/* Always consider fixed BottomNav */
.modal {
  max-height: 85vh;        /* Never 100vh */
  padding-bottom: 60px;    /* Space for scroll */
}
```

**JSX Arrows:**
```jsx
// Use {'<'} and {'>'} to avoid parsing errors
<button>{'<'}</button>
<button>{'>'}</button>
```

### 5.2 Stock Management

**Stock Levels:**
```javascript
const STOCK_LEVELS = {
  CRITICAL: { threshold: 7, color: '#ef4444', label: 'Crítico' },   // < 7 days
  LOW: { threshold: 14, color: '#f59e0b', label: 'Baixo' },        // < 14 days
  NORMAL: { threshold: 30, color: '#22c55e', label: 'Normal' },    // < 30 days
  HIGH: { threshold: Infinity, color: '#3b82f6', label: 'Bom' },    // >= 30 days
}
```

### 5.3 RLS (Row Level Security)

**All user data tables MUST have RLS enabled:**
```sql
CREATE POLICY "Users can only see their own medicines"
  ON medicines FOR SELECT
  USING (user_id = auth.uid());
```

**Client Configuration:**
```javascript
// Frontend (anon key - public)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Backend (service role - privileged)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

### 5.4 Vercel Serverless Functions

**NEVER use `process.exit()` in serverless:**
```javascript
// ❌ WRONG - Terminates function
process.exit(1)

// ✅ CORRECT - Throw error
throw new Error('Something went wrong')
```

**Conditional dotenv:**
```javascript
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
```

**vercel.json rewrites (modern syntax):**
```json
{
  "rewrites": [
    { "source": "/api/dlq", "destination": "/api/dlq.js" },
    { "source": "/api/dlq/:id/retry", "destination": "/api/dlq/[id]/retry.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 6. Workflows & Checklists {#workflows}

### 6.1 Before Modifying ANY File
```bash
# Step 1: Check for duplicate files
find src -name "*TargetFile*" -type f

# Step 2: Identify which file is ACTUALLY used
grep -r "from.*TargetFile" src/ | head -20

# Step 3: Check path aliases in vite.config.js
# An import like "@adherence/services/x" resolves to "src/features/adherence/services/x"

# Step 4: Verify the correct file before making changes
```

### 6.2 Pre-Commit Checklist
- [ ] **NO duplicate files exist** (`find src -name "*ComponentName*" -type f`)
- [ ] **Import resolves to correct file** (check `vite.config.js` aliases)
- [ ] Code follows naming conventions (PascalCase, camelCase, etc.)
- [ ] Props have validation/default values
- [ ] Zod validation applied in all services
- [ ] Cache invalidated after mutations
- [ ] Errors handled with try/catch
- [ ] Tests added for new logic
- [ ] `console.log` debug statements removed
- [ ] CSS follows mobile-first
- [ ] Imports organized correctly
- [ ] States declared BEFORE useMemo/useEffect
- [ ] `npm run validate` passes (lint + tests)

### 6.3 Test Commands
```bash
npm run test:critical    # Services, utils, schemas, hooks
npm run test:changed     # Files modified since main
npm run test:smoke       # Minimal suite (~10s)
npm run validate         # Lint + critical tests
npm run build            # Production build check
```

### 6.4 Git Workflow
```bash
# 1. Create branch
git checkout -b feature/wave-X/name

# 2. Make changes (follow standards)

# 3. Validate (MUST PASS)
npm run validate

# 4. Commit with semantic message
git commit -m "feat(scope): descrição"

# 5. Push
git push origin feature/wave-X/name

# 6. Create PR (use template)

# 7. Wait for Gemini review

# 8. Merge with cleanup
gh pr merge <number> --merge --delete-branch
```

---

## 7. Anti-Patterns & Pitfalls {#anti-patterns}

| Anti-Pattern | Consequence | Prevention |
|--------------|-------------|------------|
| **Modify duplicate file** | Production bug | Check for duplicates FIRST |
| **Assume import location** | Wrong file modified | Trace actual import path |
| Declare state after useMemo | ReferenceError (TDZ) | States → Memos → Effects |
| Skip validation | Broken build | Always run `npm run validate` |
| Commit to main | Unreviewed code | Always create branch |
| Ignore lint errors | Build fails | Fix all errors |
| Mix languages in schemas | UI inconsistency | Portuguese only |
| Use `--no-verify` | Bypass quality gates | Fix errors properly |
| Import non-existent file | ERR_MODULE_NOT_FOUND | Validate with `npm run build` |
| `process.exit()` in serverless | Function termination | Use `throw new Error()` |
| `new Date('YYYY-MM-DD')` | UTC timezone bug | Use `new Date(dateStr + 'T00:00:00')` |
| Unescaped MarkdownV2 | Telegram API error | Always use `escapeMarkdownV2()` |

---

## 8. Chronological Memory Entries {#memory-entries}

*Note: Entries are kept in chronological order for traceability. New entries should be appended at the end.*

---

## Memory Entry — 2026-02-07 00:34
**Contexto / Objetivo**
- Corrigir campo frequency no ProtocolForm que estava em texto livre e com valores em inglês após implementação de validação Zod

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/protocolSchema.js` — Traduziu FREQUENCIES de inglês para português e adicionou FREQUENCY_LABELS
  - `src/components/protocol/ProtocolForm.jsx` — Transformou input de texto em dropdown com opções válidas
  - `src/components/onboarding/FirstProtocolStep.jsx` — Atualizou para usar constantes do schema
  - `src/components/protocol/ProtocolCard.jsx` — Adiciona label traduzida na exibição
  - `src/components/protocol/ProtocolForm.test.jsx` — Atualizou testes com novos valores em português

**O que deu certo**
- Uso de constantes exportadas do schema para manter consistência entre validação e UI
- Mapeamento label/valor permite exibir texto amigável mantendo valores válidos para o banco
- Verificação de outros componentes que usam frequency identificou todos os pontos de ajuste

**O que não deu certo / riscos**
- Dados existentes no banco com frequência em inglês ('daily', 'alternate', etc.) precisarão de migração
- Protocolos existentes com frequency em inglês podem não renderizar corretamente no dropdown

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar outros componentes quando uma validação Zod muda
- Exportar labels de enum para uso em componentes UI
- Usar dropdown para campos com valores limitados em vez de texto livre
- Testes unitários devem ser atualizados junto com schemas

---

## Memory Entry — 2026-02-07 01:45
**Contexto / Objetivo**
- Identificar e traduzir outros termos em inglês nos schemas Zod além do frequency
- Corrigir MEDICINE_TYPES e WEEKDAY que também estavam em inglês

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/medicineSchema.js` — Traduziu MEDICINE_TYPES para português
  - `src/components/medicine/MedicineForm.jsx` — Atualizou para usar constantes exportadas
  - `src/components/medicine/MedicineCard.jsx` — Corrigiu verificação de tipo
  - `src/components/onboarding/FirstMedicineStep.jsx` — Atualizou opções do dropdown
  - `src/views/Medicines.jsx` — Corrigiu filtro de tipo
  - `src/components/protocol/ProtocolForm.jsx` — Corrigiu verificação de medicine.type
  - `src/schemas/protocolSchema.js` — Traduziu WEEKDAYS para português
  - `.migrations/20260207_migrate_medicine_type_to_portuguese.sql` — Migration SQL criada

**Regras locais para o futuro (lições acionáveis)**
- Sempre fazer grep por termos em inglês (monday, tuesday, medicine, supplement) ao traduzir schemas
- Verificar se constantes estão exportadas antes de usar em componentes
- Criar migrations SQL para cada enum traduzido antes de alterar código frontend
- Manter Labels mapeados para exibição amigável

---

## Memory Entry — 2026-02-07 02:40
**Contexto / Objetivo**
- Corrigir comportamento do botão ADIAR no smart alert de atraso de doses
- O botão não respondia ao clique, não suprimindo o alerta nem pulando a dose

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Adicionou estado `snoozedAlertIds` e handler para ADIAR
  - `src/hooks/__tests__/useCachedQuery.test 2.jsx` — Corrigiu lint errors (catch vazio)

**Causa raiz (se foi debug)**
- Sintoma: Botão ADIAR não fazia nada ao clicar
- Causa: Handler `onAction` em Dashboard.jsx não tratava `action.label === 'ADIAR'`
- Correção: Adicionado handler que adiciona alert.id ao Set de silenciados

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar todos os action labels no handler de SmartAlerts
- Usar Set para tracking de IDs é mais performático que Array.includes
- Catch vazio (`catch {}`) é aceito pelo lint, variável não é necessária

---

## Memory Entry — 2026-02-07 05:20
**Contexto / Objetivo**
- Corrigir ReferenceError no Dashboard: Cannot access 'snoozedAlertIds' before initialization
- O dashboard não carregava, tela ficava vazia

**Causa raiz (se foi debug)**
- Sintoma: Dashboard não carregava, ReferenceError no console
- Causa: `snoozedAlertIds` era declarado após o useMemo que o utiliza (TDZ)
- Correção: Moveu declaração do estado para antes do useMemo
- Prevenção: Sempre declarar estados antes de hooks que os utilizam

**Regras locais para o futuro (lições acionáveis)**
- Estados devem ser declarados antes de useMemo/useEffect que os utilizam
- Em React, ordem de declarações importa para evitar TDZ
- Criar ordem lógica: states -> useMemo -> useEffects -> handlers

---

## Memory Entry — 2026-02-07 12:00
**Contexto / Objetivo**
- Auditoria técnica completa do bot do Telegram inoperante há mais de 3 dias
- Identificar causa raiz da falha e propor correções específicas

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/services/sessionManager.js` — Removida importação de MOCK_USER_ID não existente
  - `server/services/sessionManager.js` — Implementada obtenção dinâmica de userId via getUserIdByChatId
  - `plans/AUDITORIA_BOT_TELEGRAM.md` — Relatório completo de auditoria técnica criado

**Causa raiz (se foi debug)**
- Sintoma: Bot não iniciava em produção, SyntaxError nos logs da Vercel
- Causa: sessionManager.js tentava importar MOCK_USER_ID de supabase.js, mas essa constante não existia
- Correção: Removida importação de MOCK_USER_ID e implementada obtenção dinâmica de userId via getUserIdByChatId
- Prevenção: Sempre verificar se constantes exportadas existem antes de importar

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar logs de produção da Vercel ao diagnosticar falhas
- Verificar se constantes exportadas existem antes de importar
- Remover referências a MOCK_USER_ID hardcoded em todo o código
- Usar getUserIdByChatId para obter userId dinamicamente em contexto de bot

---

## Memory Entry — 2026-02-08 18:04
**Contexto / Objetivo**
- Integrar micro-interações e analytics na aplicação (Fase 3)
- Componentes de animação foram criados mas não estavam integrados

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Integrado ConfettiAnimation, page_view, dose_registered, MilestoneCelebration
  - `src/components/dashboard/SwipeRegisterItem.jsx` — Integrado PulseEffect e tracking swipe_used
  - `src/components/medicine/MedicineForm.jsx` — Integrado ShakeEffect em campos com erro
  - `src/components/protocol/ProtocolForm.jsx` — Integrado ShakeEffect em campos com erro
  - `src/components/ui/ThemeToggle.jsx` — Adicionado tracking theme_changed
  - `src/components/dashboard/SparklineAdesao.jsx` — Adicionado tracking sparkline_tapped
  - `src/components/gamification/MilestoneCelebration.jsx` — Adicionado tracking milestone_achieved

**Regras locais para o futuro (lições acionáveis)**
- Sempre declarar estados antes de useMemo/useEffect que os utilizam (evita TDZ)
- Usar analyticsService.track() para todos os eventos de usuário importantes
- Integrar componentes de animação (ConfettiAnimation, PulseEffect, ShakeEffect) com estados React
- Verificar lint antes de fazer commit para evitar erros
- ShakeEffect deve ser aplicado em campos com erro de validação Zod

---

## Memory Entry — 2026-02-09 18:32
**Contexto / Objetivo**
- Integrar bot do Telegram com Supabase para gerenciamento de lembretes de medicamentos
- Implementar sistema de agendamento de tarefas com node-cron
- Criar handlers para comandos `/hoje`, `/registrar`, `/estoque`

**O que foi feito (mudanças)**
- Arquivos criados:
  - `server/bot/index.js` - Entry point do bot com initialization e error handling
  - `server/bot/commands/*.js` - Comandos (/start, /hoje, /registrar, /estoque, /historico)
  - `server/bot/scheduler.js` - Agendamento de tarefas com node-cron
  - `server/services/supabase.js` - Cliente Supabase para o bot
  - `server/services/medicines.js` - Service para buscar medicamentos do usuário

**Regras locais para o futuro (lições acionáveis)**
- Bot initialization: `try/catch` + `process.exit()` apenas em erros de initialization (não em serverless)
- Command handlers: Respostas em MarkdownV2 com formatação consistente
- Cron scheduler: Agenda verificações a cada 5 minutos para doses pendentes

---

## Memory Entry — 2026-02-10 15:08
**Contexto / Objetivo**
- Implementar validação Zod robusta em todos os services do Supabase
- Padronizar tratamento de erros em formato consistente

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/medicineSchema.js` - Schema de validação para medicamentos
  - `src/schemas/logSchema.js` - Schema de validação para registros de doses
  - `src/services/api/medicineService.js` - Implementação de validação Zod
  - `server/services/medicines.js` - Validação no backend para dados do bot

**Regras locais para o futuro (lições acionáveis)**
- TODOS os services DEVEM validar dados com Zod antes de enviar ao Supabase
- Usar `safeParse()` para validação não-bloqueante quando apropriado
- Manter consistência de idioma (pt-BR) em mensagens de erro
- Schemas DEVEM ser exportados de `src/schemas/index.js`

---

## Memory Entry — 2026-02-10 16:32
**Contexto / Objetivo**
- Otimizar performance de leituras com sistema de cache SWR
- Implementar stale-while-revalidate pattern

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/lib/queryCache.js` - Implementação de cache SWR customizado
  - `src/hooks/useCachedQuery.js` - Hook de React para cache de queries
  - `src/services/api/cachedServices.js` - Services com cache integrado

**Regras locais para o futuro (lições acionáveis)**
- Usar cachedServices para TODAS as leituras (não apenas medicines)
- Definir staleTime apropriado por tipo de dado (5min para meds, 1min para stock)
- Invalidar cache após QUALQUER mutation
- cachedServices já invalidam automaticamente após mutations

---

## Memory Entry — 2026-02-11 13:47
**Contexto / Objetivo**
- Configurar Row Level Security (RLS) no Supabase para proteção de dados
- Criar políticas de acesso baseadas em user_id

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `.migrations/001_setup_rls.sql` - Migração com políticas RLS
  - `server/services/supabase.js` - Cliente Supabase com anon key
  - `src/lib/supabase.js` - Cliente frontend (RLS ativo)

**Regras locais para o futuro (lições acionáveis)**
- TODAS as tabelas com dados de usuário DEVEM ter RLS habilitado
- Usar `auth.uid()` para identificar usuário atual
- Service role deve ser usado APENAS no backend (server/)
- Frontend usa anon key com RLS para segurança

---

## Memory Entry — 2026-02-12 10:15
**Contexto / Objetivo**
- Implementar fluxo de onboarding para novos usuários
- Criar wizard com 4 steps: Boas-vindas, Primeiro Remédio, Primeiro Protocolo, Integração Telegram

**O que foi feito (mudanças)**
- Arquivos criados:
  - `src/components/onboarding/OnboardingWizard.jsx` - Wizard container
  - `src/components/onboarding/WelcomeStep.jsx` - Step 0: Boas-vindas
  - `src/components/onboarding/FirstMedicineStep.jsx` - Step 1: Primeiro remédio
  - `src/components/onboarding/FirstProtocolStep.jsx` - Step 2: Primeiro protocolo
  - `src/components/onboarding/TelegramIntegrationStep.jsx` - Step 3: Integração Telegram
  - `src/components/onboarding/OnboardingProvider.jsx` - Context provider
  - `src/components/onboarding/useOnboarding.js` - Hook de onboarding

**Regras locais para o futuro (lições acionáveis)**
- Usar `useOnboarding()` hook para verificar estado de onboarding
- Provider deve envolver toda a app em `App.jsx`
- Dados de onboarding DEVEM ser salvos em `user_settings`
- Telegram integration é OPCIONAL (não bloquear progresso)

---

## Memory Entry — 2026-02-12 19:22
**Contexto / Objetivo**
- Implementar sistema de gestão de estoque de medicamentos
- Criar indicadores visuais de estoque baixo

**O que foi feito (mudanças)**
- Arquivos criados:
  - `src/components/stock/StockCard.jsx` - Card de visualização de estoque
  - `src/components/stock/StockForm.jsx` - Formulário de ajuste de estoque
  - `src/components/stock/StockIndicator.jsx` - Indicador visual (cores por nível)
  - `src/services/api/stockService.js` - Service de estoque
  - `src/components/dashboard/StockAlertsWidget.jsx` - Widget de alertas no dashboard

**Regras locais para o futuro (lições acionáveis)**
- Estoque DEVE ser decrementado após CADA dose registrada
- Alertas críticos DEVEM aparecer imediatamente no dashboard
- Usar cores semânticas (vermelho=crítico, amarelo=baixo, verde=bom)
- Limites configuráveis por medicamento

---

## Memory Entry — 2026-02-13 17:25
**Contexto / Objetivo**
- Corrigir chamadas redundantes de `logNotification()` identificadas no code review do PR #16
- Evitar duplicação de logs na tabela `notification_log`

**O que foi feito (mudanças)**
- Arquivo alterado:
  - `server/bot/tasks.js` — removidas 7 chamadas redundantes de `logNotification()`

**O que deu certo**
- A função `shouldSendNotification()` já chama `logNotification()` internamente quando a notificação deve ser enviada
- Remover chamadas explícitas elimina duplicatas sem perder funcionalidade

**Regras locais para o futuro (lições acionáveis)**
- `shouldSendNotification()` já inclui `logNotification()` — nunca chamar explicitamente após `shouldSendNotification()` retornar `true`
- Se precisar de logging customizado, usar `logger.info()` em vez de `logNotification()` diretamente
- Manter `console.log` em português para funções de cron (convenção do projeto)

---

## Memory Entry — 2026-02-14 18:48
**Contexto / Objetivo**
- Corrigir alerts do bot Telegram que não funcionavam em produção (deploy Vercel)
- Identificar e resolver problema de configuração serverless

**Causa raiz (se foi debug)**
- Sintoma: Bot não enviava notificações em produção
- Causa: `dotenv.config()` tentava carregar arquivo `.env` que não existe em Vercel
- Causa: `process.exit(1)` terminava a função serverless ao invés de lançar erro
- Correção: dotenv condicional + throw ao invés de exit

**Regras locais para o futuro (lições acionáveis)**
- NUNCA usar `process.exit()` em funções serverless — sempre usar `throw new Error()`
- SEMPRE fazer dotenv condicional: `if (process.env.NODE_ENV !== 'production')`
- Vercel injeta variáveis de ambiente automaticamente — não precisa de dotenv em produção
- Configurar `maxDuration` em `vercel.json` para funções que processam múltiplos usuários

---

## Memory Entry — 2026-02-16 00:55
**Contexto / Objetivo**
- Corrigir falha de parsing Markdown no bot Telegram (20:30)
- Identificar root cause e implementar fixes imediatos

**Causa raiz (se foi debug)**
- Sintoma: Mensagens do bot falhavam com erro "Character '!' is reserved and must be escaped"
- Causa: Literais de template com `!` não escapados (ex: `Hora do seu remédio!`)
- Causa: DLQ schema sem UNIQUE constraint para upsert com onConflict
- Correção: Escapar caracteres especiais MarkdownV2 + migration idempotente

**Regras locais para o futuro (lições acionáveis)**
- TODAS as mensagens MarkdownV2 DEVEM usar escapeMarkdown() ou telegramFormatter
- Literal `!` em templates string é caractere especial em MarkdownV2 e DEVE ser escapado como `\!`
- Migrations DEVEM usar IF NOT EXISTS para políticas RLS e constraints
- Usar `grep -n "![^}]" server/bot/*.js` para encontrar caracteres não escapados

---

## Memory Entry — 2026-02-16 06:09
**Contexto / Objetivo**
- Reverter implantação da Fase 1 (P1) de melhorias do bot Telegram
- A execução trouxe mais problemas do que soluções

**Ações realizadas**
- Verificado que `feature/bot-X/retry-mechanism` não estava mergeada em `main`
- Deletada a branch local e remota: `feature/bot-X/retry-mechanism`
- Removido de `main` o arquivo `server/bot/retryManager.js`
- PR #25 recebeu comentário de encerramento e foi fechado

**Lições aprendidas e salvaguardas**
1. Testar mudanças de infra/robustez em staging com tráfego e cenário real antes de integrar ao `main`
2. Criar uma biblioteca de formatação Telegram (`telegramFormatter`) com testes de fuzzing
3. Atualizar `docs/PULL_REQUEST_TEMPLATE.md` com checklist obrigatório para PRs que toquem infra/bot
4. Evitar `force-push` em `main`; usar `git revert` para desfazer merges quando necessário
5. Monitoramento: métricas de erro, DLQ size e alertas para regressões

---

## Memory Entry — 2026-02-16 10:30
**Contexto / Objetivo**
- Analisar erro de produção no Telegram bot: `ERR_MODULE_NOT_FOUND: Cannot find module 'retryManager.js'`
- Criar plano de correção

**Causa raiz (se foi debug)**
- Sintoma: Vercel build falhando com ERR_MODULE_NOT_FOUND
- Causa: `server/bot/tasks.js` importava `sendWithRetry` de `./retryManager.js` que não existia
- Causa: P1 foi parcialmente implementado e depois revertido, mas o import ficou órfão
- Correção: Remover import e usar `bot.sendMessage()` diretamente

**Regras locais para o futuro (lições acionáveis)**
- **NUNCA** importar arquivos que não existem
- Sempre validar imports com `npm run build` antes de push
- Começar com solução simples, adicionar complexidade apenas quando necessário

---

## Memory Entry — 2026-02-16 18:56
**Contexto / Objetivo**
- Corrigir bot do Telegram que estava com erro de produção (ERR_MODULE_NOT_FOUND)
- Implementar melhorias de confiabilidade P1 (DLQ Admin, Daily Digest, Simple Retry)
- Seguir workflow Git obrigatório com PRs e code review

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/tasks.js` — Removido import de retryManager inexistente, simplificado sendDoseNotification
  - `api/notify.js` — Adicionado retry de 2 tentativas, DLQ digest schedule (09:00)
  - `api/dlq.js` — Criado endpoint GET para listar notificações falhadas
  - `api/dlq/[id]/retry.js` — Criado endpoint POST para re-tentar notificação
  - `api/dlq/[id]/discard.js` — Criado endpoint POST para descartar notificação
  - `src/services/api/dlqService.js` — Criado serviço frontend para DLQ
  - `src/views/admin/DLQAdmin.jsx` — Criada view de administração do DLQ
  - `server/utils/retryManager.js` — Criado helper de retry com isRetryableError

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** verificar se arquivos importados existem antes de commitar
- **SEMPRE** rodar `npm run build` localmente antes de push
- Usar abordagem incremental: P0 (bloqueante) → P1 (melhorias) → P2 (opcional)
- Simplificar ao invés de over-engineer - complexidade causa falhas
- Gemini Code Review é obrigatório - aguardar comentários antes de merge
- Configurar ADMIN_CHAT_ID na Vercel para DLQ digest funcionar
- Retry simples (2 tentativas) é suficiente para a maioria dos casos

---

## Memory Entry — 2026-02-17 16:40
**Contexto / Objetivo**
- Merge PR #44 (refactor(bot): extract formatters and improve code organization)
- Criar backlog items para melhorias de JSDoc identificadas no code review

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** escrever JSDoc em português desde o primeiro commit
- Verificar JSDoc antes de criar PR
- Adicionar verificação de JSDoc em inglês ao code review checklist
- Usar template: `/** * Descrição em português. * @param {tipo} nome - Descrição. * @returns {tipo} Descrição. */`

---

## Memory Entry — 2026-02-17 20:37
**Contexto / Objetivo**
- Implementar especificação TELEGRAM_MARKDOWNV2_ESCAPE_SPEC.md
- Corrigir erro DLQ: "Character '!' is reserved and must be escaped"
- Garantir que todas as mensagens do bot Telegram usem MarkdownV2 corretamente

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/utils/formatters.js` — Criada função `escapeMarkdownV2()` com 18 caracteres reservados
  - `server/utils/__tests__/formatters.test.js` — 63 testes unitários
  - `server/bot/tasks.js` — 8 funções atualizadas com escape
  - `server/bot/commands/*.js` — 7 arquivos de comandos migrados para MarkdownV2
  - `server/bot/callbacks/*.js` — 2 arquivos de callbacks migrados para MarkdownV2
  - `docs/architecture/TELEGRAM_BOT.md` — Documentação consolidada do bot
  - `package.json` — Version bump para 2.9.0
  - `CHANGELOG.md` — Release notes v2.9.0

**Regras locais para o futuro (lições acionáveis)**
- SEMPRE escapar backslash primeiro em funções de escape MarkdownV2
- Usar `escapeMarkdownV2()` para todas as mensagens com `parse_mode: 'MarkdownV2'`
- NÃO escapar texto em `answerCallbackQuery` (plain text, não Markdown)
- JSDoc deve ser em português desde o primeiro commit
- Gemini Code Review é obrigatório antes de merge

---

## Memory Entry — 2026-02-18 03:55
**Contexto / Objetivo**
- Corrigir 2 problemas HIGH priority identificados no PR #50 review
- Timezone Inconsistency: `adherenceService.js` usava datas em local vs UTC
- Duplicated Logic: `isProtocolActiveOnDate` estava duplicada

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/utils/dateUtils.js` — Criado módulo compartilhado com funções de data em timezone local
  - `src/utils/adherenceLogic.js` — Removida função duplicada, importa de dateUtils.js
  - `src/services/api/adherenceService.js` — Removida função duplicada, importa de dateUtils.js

**Causa raiz (se foi debug)**
- Sintoma: Cálculos de adesão podiam estar incorretos devido a inconsistência de timezone
- Causa: `new Date('YYYY-MM-DD')` cria data em UTC (meia-noite UTC), que em GMT-3 é 21:00 do dia anterior
- Correção: Padronizar para `new Date(dateStr + 'T00:00:00')` que cria meia-noite em timezone local

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** usar `parseLocalDate(dateStr)` ou `new Date(dateStr + 'T00:00:00')` para datas em timezone local
- **NUNCA** usar `new Date('YYYY-MM-DD')` diretamente - isso cria data em UTC
- Centralizar funções de data em módulo compartilhado evita duplicação e inconsistências

---

## Memory Entry — 2026-02-18 13:15
**Contexto / Objetivo**
- Corrigir HIGH priority issue do PR #50 review: Timezone inconsistency em protocolSchema.js

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/protocolSchema.js` — Adicionado `T00:00:00` na validação de datas
  - `src/shared/constants/protocolSchema.js` — Adicionado `T00:00:00` na validação de datas
  - `src/features/protocols/constants/protocolSchema.js` — Adicionado `T00:00:00` na validação de datas

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** usar `new Date(dateStr + 'T00:00:00')` para comparações de data em timezone local
- **NUNCA** usar `new Date('YYYY-MM-DD')` diretamente - isso cria data em UTC
- Verificar se labels existem antes de usar `gh issue create --label`
- Aplicar correções em todos os arquivos duplicados para manter consistência

---

## Memory Entry — 2026-02-18 17:54
**Contexto / Objetivo**
- Final validation and merge of PR #50 (Protocol Start/End Dates for Accurate Adherence)
- Create version 3.0.0 release with Git tag and GitHub release

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** rodar validação completa antes de merge: lint, test:critical, build
- Usar `gh pr view <number> --json state,mergeable,statusCheckRollup` para verificar status do PR
- Usar `gh pr merge <number> --merge --delete-branch` para merge com cleanup automático
- Usar `npm version <version> --no-git-tag-version` para version bump sem criar tag automática
- Criar release notes focadas para GitHub, diferente de CHANGELOG.md completo

---

## Memory Entry — 2026-02-18 19:06
**Contexto / Objetivo**
- Debug produção: adherence score não considerava start_date dos protocolos
- Investigar por que feature implementada no PR #50 não funcionava em produção
- Consolidar arquivos duplicados identificados durante investigação

**Causa raiz (se foi debug)**
- Sintoma: Adherence score não considerava start_date dos protocolos em produção
- Causa: Dashboard importava `adherenceLogic.js` de `src/features/dashboard/utils/` que não tinha a correção do PR #50
- Causa: Arquivos duplicados em `src/features/adherence/utils/` e `src/shared/constants/` não foram atualizados
- Correção: Deletar arquivos duplicados e consolidar imports usando aliases `@utils/` e `@schemas/`

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** verificar se existem arquivos duplicados antes de implementar features críticas
- Usar `grep -r "function_name" src/` ou `grep -r "export.*function" src/` para encontrar duplicatas
- **SEMPRE** usar path aliases (`@utils/`, `@schemas/`) para imports em vez de caminhos relativos
- Quando encontrar arquivo duplicado, consolidar em um único local canônico
- Adicionar aliases ao vite.config.js quando criar novos diretórios canônicos
- Testes podem passar mesmo com código duplicado - verificar imports reais usados pela aplicação
- **CRÍTICO**: Code review deve verificar se PRs atualizam TODOS os arquivos duplicados

---

## Memory Entry — 2026-02-18 21:15
**Contexto / Objetivo**
- Debug produção: 3 issues reportados após PR #57 merge
- Issue 1: Sparkline não considerava start_date dos protocolos
- Issue 2: Drilldown modal header com totais incorretos
- Issue 3: ProtocolForm não exibia campos start_date/end_date
- Atualizar AGENTS.md com processos para prevenir bugs futuros

**Causa raiz (se foi debug)**
- Sintoma: 3 issues de produção após PR #57 merge
- Causa: Aplicação importava de `@adherence/services/adherenceService` (desatualizado) ao invés de `@services/api/adherenceService` (correto)
- Causa: ProtocolForm em `src/components/protocol/` não tinha campos start_date/end_date, mas app importava de lá
- Causa: Path aliases (`@adherence/services/`) mascaravam a localização real dos arquivos
- Correção: Deletar todos os arquivos duplicados e atualizar imports para localizações canônicas

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** executar `find src -name "*TargetFile*" -type f` antes de modificar qualquer arquivo
- **SEMPRE** verificar `vite.config.js` para entender para onde path aliases resolvem
- **SEMPRE** usar `grep -r "from.*TargetFile" src/` para rastrear imports reais
- **NUNCA** assumir localização de arquivo baseado em nome - verificar import real
- **CRÍTICO**: Code review DEVE verificar se existem arquivos duplicados que precisam ser atualizados
- Quando encontrar arquivo duplicado, DELETAR ao invés de atualizar
- Usar path aliases canônicos (`@services/`, `@schemas/`, `@utils/`) para evitar ambiguidade

---

## Memory Entry — 2026-02-18 20:00
**Contexto / Objetivo**
- Corrigir bug na DLQ Admin UI onde descartar mensagem falhada retornava erro "The string did not match the expected pattern"
- Investigar causa raiz e aplicar correção

**Causa raiz (se foi debug)**
- Sintoma: DLQ Admin UI retornava erro ao tentar descartar mensagem
- Causa: `vercel.json` não tinha rewrites para rotas DLQ, catch-all `/(.*) -> /index.html` interceptava POST requests
- Correção: Adicionar rewrites explícitos para `/api/dlq`, `/api/dlq/:id/retry`, `/api/dlq/:id/discard`
- Prevenção: Sempre adicionar rewrites explícitos para novas rotas API no `vercel.json`

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** adicionar rewrites explícitos no `vercel.json` para novas rotas API
- O catch-all `/(.*) -> /index.html` deve ser sempre o **último** rewrite
- Erros 405 em rotas API geralmente indicam configuração faltando no `vercel.json`
- Verificar logs do browser (Network tab) para identificar erros HTTP reais

---

## Memory Entry — 2026-02-19 14:38
**Contexto / Objetivo**
- Corrigir issues de segurança e roteamento identificados pelo Gemini no PR #73
- O PR original usava `routes` (legacy) e não tinha autenticação nos endpoints DLQ
- Gemini identificou 1 CRITICAL, 2 HIGH e 1 MEDIUM issues

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `vercel.json` — Substituído `routes` por `rewrites` com `:id` parameter syntax
  - `api/dlq.js` — Adicionada função `verifyAdminAccess()` com Supabase Auth + ADMIN_CHAT_ID
  - `api/dlq/[id]/retry.js` — Adicionada verificação de admin antes de processar
  - `api/dlq/[id]/discard.js` — Adicionada verificação de admin antes de processar
  - `src/services/api/dlqService.js` — Adicionado envio de token de autenticação via header

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** adicionar autenticação em endpoints que usam `service_role` key
- `service_role` key bypassa RLS - qualquer endpoint que a usa precisa de autenticação
- Usar Supabase Auth para verificar identidade do usuário no frontend
- Verificar se o usuário é admin via campo específico (ex: telegram_chat_id = ADMIN_CHAT_ID)
- `rewrites` é a propriedade moderna do Vercel, `routes` é legacy
- Usar `:id` syntax em `rewrites` para parâmetros dinâmicos

---

## Memory Entry — 2026-02-19 17:40
**Contexto / Objetivo**
- Finalizar PR #73 (DLQ Admin UI routing + authentication fix)
- Confirmar funcionamento em produção
- Limpar branch após merge

**O que foi feito (mudanças)**
- Operações realizadas:
  - Merge PR #73 via `gh pr merge 73 --merge --delete-branch`
  - Validação em produção confirmada pelo usuário
  - Branch local e remota deletadas
  - Issue #74 criada para refactoring (extrair `verifyAdminAccess` para módulo compartilhado)

**Regras locais para o futuro (lições acionáveis)**
- **SEMPRE** usar `gh pr merge <number> --merge --delete-branch` para merge com cleanup automático
- Gemini Code Assist é obrigatório antes de merge - aguardar review comments
- Criar issues de backlog para refactoring identificados em code review
- Testar em produção após deploy para confirmar funcionamento

---

*Fim do arquivo de memória consolidado.*

---

## Referências Rápidas

- **Coding Rules**: `.roo/rules-code/rules.md`
- **Architecture Rules**: `.roo/rules-architecture/rules.md`
- **AGENTS.md (Guia Principal)**: `AGENTS.md`
- **Documentação Completa**: `docs/INDEX.md`
- **Setup**: `docs/getting-started/SETUP.md`
- **Testing**: `docs/standards/TESTING.md`
- **Git Workflow**: `docs/standards/GIT_WORKFLOW.md`

---

*Última atualização deste arquivo: 2026-02-19*  
*Versão do projeto: 3.0.0*  
*Entradas de memória: 35+*
