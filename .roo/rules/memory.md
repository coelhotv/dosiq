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

---

*Última atualização: 2026-02-11 | Consolidação de memórias .kilocode e .roo*
