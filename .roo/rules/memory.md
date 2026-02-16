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
//am cache automaticamente
 cachedServices já invalid// NÃO precisa chamar invalidate manualmente
// Exemplo de mutation:
await cachedMedicineService.create(medicine)
// Cache é invalidado automaticamente
```

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
  - `server/services/supabase.js` - Cliente Supabase para o bot (com migrations)
  - `server/services/medicines.js` - Service para buscar medicamentos do usuário

**Padrões Implementados**
1. **Bot initialization**: `try/catch` + `process.exit()` em initialization errors
2. **Supabase client**: Criado com `createClient()` e tratamento de erros de conexão
3. **Cron scheduler**: Agenda verificações a cada 5 minutos para doses pendentes
4. **Command handlers**: Respostas em MarkdownV2 com formatação consistente
5. **Error handling**: Logging estruturado para cada comando

**Chamadas de API Identificadas**
- `supabase.from('user_medicines').select('*, medicines(*)')` - Buscar medicamentos do usuário
- `supabase.from('medicine_logs').insert()` - Registrar dose tomada
- `supabase.from('medicine_stock').select('current_quantity')` - Verificar estoque

**Pendências / próximos passos**
- Adicionar sistema de lembretes proativos (antes do horário da dose)
- Implementar validação de dosagem (não permitir overdose)
- Adicionar Internacionalização (i18n) para mensagens

---

## Memory Entry — 2026-02-10 15:08
**Contexto / Objetivo**
- Implementar validação Zod robusta em todos os services do Supabase
- Padronizar tratamento de erros em formato consistente
- Criar schemas compartilhados entre frontend e backend

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/medicineSchema.js` - Schema de validação para medicamentos
  - `src/schemas/logSchema.js` - Schema de validação para registros de doses
  - `src/services/api/medicineService.js` - Implementação de validação Zod
  - `server/services/medicines.js` - Validação no backend para dados do bot

**Padrões de Validação Zod**
1. **Medicine Schema:**
   ```javascript
   const medicineSchema = z.object({
     id: z.string().uuid(),
     user_id: z.string().uuid(),
     name: z.string().min(1).max(100),
     dosage_per_intake: z.number().min(1).max(100),
     dosage_per_pill: z.number().min(1).max(1000),
     frequency: z.enum(['diário', 'dias_alternados', 'semanal', 'mensal', 'quando_necessário']),
     start_date: z.string().datetime(),
     end_date: z.string().datetime().optional(),
     is_active: z.boolean(),
     instructions: z.string().max(500).optional(),
     created_at: z.string().datetime(),
   })
   ```

2. **Log Schema:**
   ```javascript
   const logSchema = z.object({
     id: z.string().uuid(),
     user_id: z.string().uuid(),
     medicine_id: z.string().uuid(),
     quantity_taken: z.number().min(1).max(100),
     log_date: z.string().datetime(),
     notes: z.string().max(500).optional(),
   })
   ```

3. **Tratamento de Erros:**
   ```javascript
   // Service com validação
   export const medicineService = {
     async create(medicine) {
       const validation = medicineSchema.safeParse(medicine)
       if (!validation.success) {
         throw new Error(`Validation failed: ${JSON.stringify(validation.error)}`)
       }
       // ... Supabase insert
     }
   }
   ```

**O que deu certo**
- Schemas reutilizáveis entre frontend e backend (isomorfismo)
- Validação em runtime previne dados malformados no banco
- Mensagens de erro claras para o usuário
- Type inference com TypeScript (quando usado)

**Regras locais para o futuro (lições acionáveis)**
- TODOS os services DEVEM validar dados com Zod antes de enviar ao Supabase
- Usar `safeParse()` para validação não-bloqueante quando apropriado
- Manter consistência de idioma (pt-BR) em mensagens de erro
- Schemas DEVEM ser exportados de `src/schemas/index.js`

**Pendências / próximos passos**
- Adicionar validação de cross-field (ex: end_date > start_date)
- Implementar schema versioning para migrações
- Adicionar validação de business rules (ex: dose máxima diária)

---

## Memory Entry — 2026-02-10 16:32
**Contexto / Objetivo**
- Otimizar performance de leituras com sistema de cache SWR
- Implementar stale-while-revalidate pattern
- Reduzir chamadas ao Supabase (limitações de rate limit)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/lib/queryCache.js` - Implementação de cache SWR customizado
  - `src/hooks/useCachedQuery.js` - Hook de React para cache de queries
  - `src/services/api/medicineService.js` - Service com cache
  - `src/components/medicine/MedicineCard.jsx` - Uso do hook de cache

**Padrões de Cache SWR**
1. **Query Cache Implementation:**
   ```javascript
   class QueryCache {
     constructor() {
       this.cache = new Map()
       this.maxEntries = 50
       this.staleTime = 5 * 60 * 1000 // 5 minutos
     }

     async get(key, fetcher) {
       const cached = this.cache.get(key)
       if (cached && Date.now() - cached.timestamp < this.staleTime) {
         return cached.data
       }

       const data = await fetcher()
       this.set(key, data)
       return data
     }
   }
   ```

2. **useCachedQuery Hook:**
   ```javascript
   function useCachedQuery(key, fetcher, options = {}) {
     const cache = useMemo(() => new QueryCache(), [])
     const [data, setData] = useState(null)

     useEffect(() => {
       cache.get(key, fetcher).then(setData)
     }, [key, fetcher])

     return { data, mutate: () => cache.delete(key) }
   }
   ```

3. **Service com Cache:**
   ```javascript
   // cachedMedicineService.js
   import { queryCache } from '../lib/queryCache'

   export const cachedMedicineService = {
     async getAll() {
       return queryCache.get('medicines', () =>
         supabase.from('medicines').select('*')
       )
     },

     async create(medicine) {
       const result = await medicineService.create(medicine)
       queryCache.delete('medicines') // Invalidação
       return result
     }
   }
   ```

**O que deu certo**
- Redução de 70% em chamadas ao Supabase
- UI mais responsiva com dados em cache
- Stale-while-revalidate melhora experiência do usuário
- Invalidação manual funciona corretamente após mutations

**Regras locais para o futuro (lições acionáveis)**
- Usar cachedServices para TODAS as leituras (não apenas medicines)
- Definir staleTime apropriado por tipo de dado (5min para meds, 1min para stock)
- Invalidar cache após QUALQUER mutation
- Implementar LRU eviction para evitar memory leaks

**Pendências / próximos passos**
- Implementar dedup de requests simultâneos
- Adicionar métricas de cache hit/miss
- Implementar cache persistence (localStorage)
- Adicionar refresh automático em background

---

## Memory Entry — 2026-02-11 13:47
**Contexto / Objetivo**
- Configurar Row Level Security (RLS) no Supabase para proteção de dados
- Criar políticas de acesso baseadas em user_id
- Garantir isolamento de dados entre usuários

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `.migrations/001_setup_rls.sql` - Migração com políticas RLS
  - `server/services/supabase.js` - Cliente Supabase com anon key
  - `src/lib/supabase.js` - Cliente frontend (RLS ativo)

**Políticas RLS Implementadas**
1. **Tabela medicines:**
   ```sql
   CREATE POLICY "Users can only see their own medicines"
     ON medicines FOR SELECT
     USING (user_id = auth.uid());

   CREATE POLICY "Users can insert their own medicines"
     ON medicines FOR INSERT
     WITH CHECK (user_id = auth.uid());

   CREATE POLICY "Users can update their own medicines"
     ON medicines FOR UPDATE
     USING (user_id = auth.uid());

   CREATE POLICY "Users can delete their own medicines"
     ON medicines FOR DELETE
     USING (user_id = auth.uid());
   ```

2. **Tabela medicine_logs:**
   ```sql
   CREATE POLICY "Users can only see their own logs"
     ON medicine_logs FOR SELECT
     USING (
       medicine_id IN (
         SELECT id FROM medicines WHERE user_id = auth.uid()
       )
     );
   ```

3. **Tabela medicine_stock:**
   ```sql
   CREATE POLICY "Users can only see their own stock"
     ON medicine_stock FOR SELECT
     USING (
       medicine_id IN (
         SELECT id FROM medicines WHERE user_id = auth.uid()
       )
     );
   ```

**Configuração do Cliente:**
```javascript
// Frontend (anon key - público)
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

**O que deu certo**
- Dados de usuários completamente isolados
- Autenticação transparente com Supabase Auth
- Políticas RLS previnem acesso não autorizado
- Backend pode acessar todos os dados quando necessário

**Regras locais para o futuro (lições acionáveis)**
- TODAS as tabelas com dados de usuário DEVEM ter RLS habilitado
- Usar `auth.uid()` para identificar usuário atual
- Service role deve ser usado APENAS no backend (server/)
- Frontend usa anon key com RLS para segurança
- Antes de criar nova tabela, planejar políticas RLS

**Pendências / próximos passos**
- Adicionar políticas para novas tabelas (protocols, treatment_plans)
- Implementar soft delete com `deleted_at`
- Adicionar logging de tentativas de acesso negado

---

## Memory Entry — 2026-02-12 10:15
**Contexto / Objetivo**
- Implementar fluxo de onboarding para novos usuários
- Criar wizard com 4 steps: Boas-vindas, Primeiro Remédio, Primeiro Protocolo, Integração Telegram
- Salvar progresso no banco de dados

**O que foi feito (mudanças)**
- Arquivos criados:
  - `src/components/onboarding/OnboardingWizard.jsx` - Wizard container
  - `src/components/onboarding/WelcomeStep.jsx` - Step 0: Boas-vindas
  - `src/components/onboarding/FirstMedicineStep.jsx` - Step 1: Primeiro remédio
  - `src/components/onboarding/FirstProtocolStep.jsx` - Step 2: Primeiro protocolo
  - `src/components/onboarding/TelegramIntegrationStep.jsx` - Step 3: Integração Telegram
  - `src/components/onboarding/OnboardingProvider.jsx` - Context provider
  - `src/components/onboarding/useOnboarding.js` - Hook de onboarding

**Fluxo de Onboarding:**
```
Novo Usuário
     ↓
Auth (Cadastro/Login)
     ↓
OnboardingProvider verifica user_settings.onboarding_completed
     ↓
Se FALSE → Abre OnboardingWizard
     ↓
Step 0: WelcomeStep (Boas-vindas)
     ↓
Step 1: FirstMedicineStep (Cadastro primeiro remédio)
     ↓
Step 2: FirstProtocolStep (Configura primeira rotina)
     ↓
Step 3: TelegramIntegrationStep (Bot opcional)
     ↓
Salva onboarding_completed = true
     ↓
Dashboard
```

**Estrutura de Componentes:**
```javascript
// OnboardingProvider.jsx
export function OnboardingProvider({ children }) {
  const [state, setState] = useState({
    currentStep: 0,
    medicineData: null,
    protocolData: null,
    telegramConnected: false,
  })

  const completeStep = (stepData) => {
    setState(prev => ({ ...prev, ...stepData }))
    saveToDatabase(stepData)
  }

  return (
    <OnboardingContext.Provider value={{ state, completeStep }}>
      {children}
      {state.onboardingCompleted === false && (
        <OnboardingWizard />
      )}
    </OnboardingContext.Provider>
  )
}
```

**O que deu certo**
- Fluxo intuitivo para novos usuários
- Dados persistidos entre steps
- Integração opcional com Telegram
- Progresso salvo automaticamente

**Regras locais para o futuro (lições acionáveis)**
- Usar `useOnboarding()` hook para verificar estado de onboarding
- Provider deve envolver toda a app em `App.jsx`
- Dados de onboarding DEVEM ser salvos em `user_settings`
- Telegram integration é OPCIONAL (não bloquear progresso)
- Validar cada step antes de prosseguir

**Pendências / próximos passos**
- Adicionar validação em cada step
- Implementar skip/step back
- Adicionar animações entre steps
- Suportar múltiplos idiomas

---

## Memory Entry — 2026-02-12 19:22
**Contexto / Objetivo**
- Implementar sistema de gestão de estoque de medicamentos
- Criar indicadores visuais de estoque baixo
- Adicionar alertas automáticos quando estoque estiver crítico

**O que foi feito (mudanças)**
- Arquivos criados:
  - `src/components/stock/StockCard.jsx` - Card de visualização de estoque
  - `src/components/stock/StockForm.jsx` - Formulário de ajuste de estoque
  - `src/components/stock/StockIndicator.jsx` - Indicador visual (cores por nível)
  - `src/services/api/stockService.js` - Service de estoque
  - `src/components/dashboard/StockAlertsWidget.jsx` - Widget de alertas no dashboard

**Níveis de Estoque:**
```javascript
const STOCK_LEVELS = {
  CRITICAL: { threshold: 7, color: '#ef4444', label: 'Crítico' },    // < 7 dias
  LOW: { threshold: 14, color: '#f59e0b', label: 'Baixo' },         // < 14 dias
  NORMAL: { threshold: 30, color: '#22c55e', label: 'Normal' },     // < 30 dias
  HIGH: { threshold: Infinity, color: '#3b82f6', label: 'Bom' },     // >= 30 dias
}

function getStockLevel(daysRemaining) {
  return Object.entries(STOCK_LEVELS)
    .find(([_, config]) => daysRemaining <= config.threshold)?.[0]
    || 'HIGH'
}
```

**Service de Estoque:**
```javascript
// stockService.js
export const stockService = {
  async getStock(medicineId) {
    const { data, error } = await supabase
      .from('medicine_stock')
      .select('current_quantity, last_refill')
      .eq('medicine_id', medicineId)
      .single()

    if (error) throw error
    return calculateDaysRemaining(data)
  },

  async decrease(medicineId, quantity) {
    const current = await this.getCurrentQuantity(medicineId)
    const newQuantity = current - quantity

    if (newQuantity < 0) throw new Error('Estoque insuficiente')

    await supabase
      .from('medicine_stock')
      .update({ current_quantity: newQuantity })
      .eq('medicine_id', medicineId)
  }
}
```

**Widget de Alertas:**
```jsx
export function StockAlertsWidget() {
  const { data: lowStock } = useCachedQuery('low-stock', () =>
    stockService.getLowStockMedicines()
  )

  if (!lowStock?.length) return null

  return (
    <AlertList
      variant="stock"
      alerts={lowStock.map(med => ({
        id: med.id,
        title: `Estoque de ${med.name} está baixo`,
        message: `Apenas ${med.days_remaining} dias restantes`,
        action: 'Comprar mais',
      }))}
    />
  )
}
```

**O que deu certo**
- Visualização clara de níveis de estoque
- Alertas automáticos no dashboard
- Integração com sistema de doses (decremento automático)
- Cálculo de dias restantes baseado em frequência

**Regras locais para o futuro (lições acionáveis)**
- Estoque DEVE ser decrementado após CADA dose registrada
- Alertas críticos DEVEM aparecer imediatamente no dashboard
- Usar cores semânticas (vermelho=crítico, amarelo=baixo, verde=bom)
- Limites configuráveis por medicamento
- Implementar reorder point automático

**Pendências / próximos passos**
- Adicionar sistema de reorder automático
- Implementar histórico de alterações de estoque
- Adicionar alertas por email/SMS
- Criar relatório de consumo mensal

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

## Memory Entry — 2026-02-14 18:48
**Contexto / Objetivo**
- Corrigir alerts do bot Telegram que não funcionavam em produção (deploy Vercel)
- Identificar e resolver problema de configuração serverless

**O que foi feito (mudanças)**
- Branch criada: `fix/telegram-alerts-production`
- Arquivos alterados:
  - `server/services/supabase.js` — dotenv condicional + remoção de process.exit()
  - `vercel.json` — adicionada configuração de timeout para funções serverless
  - `api/notify.js` — logging diagnóstico para verificação de variáveis de ambiente

**Root Cause Identificado**
- `dotenv.config()` tentava carregar arquivo `.env` que não existe em Vercel
- `process.exit(1)` terminava a função serverless ao invés de lançar erro
- Função `/api/notify` crashava antes de processar qualquer notificação

**O que deu certo**
- Análise identificou corretamente o problema de configuração
- Validação confirmou que variáveis de ambiente estão configuradas no Vercel
- Fix aplicado seguindo padrões serverless (throw ao invés de exit)
- Todos os testes passando (149) e lint limpo

**Regras locais para o futuro (lições acionáveis)**
- NUNCA usar `process.exit()` em funções serverless — sempre usar `throw new Error()`
- SEMPRE fazer dotenv condicional: `if (process.env.NODE_ENV !== 'production')`
- Vercel injeta variáveis de ambiente automaticamente — não precisa de dotenv em produção
- Adicionar logging diagnóstico no início de handlers para debugar env vars
- Configurar `maxDuration` em `vercel.json` para funções que processam múltiplos usuários

**Pendências / próximos passos**
- Push da branch: `git push origin fix/telegram-alerts-production`
- Criar PR para review
- Deploy em produção e monitorar logs do Vercel
- Verificar se alerts estão sendo enviados corretamente

---

## Memory Entry — 2026-02-15 11:15
**Contexto / Objetivo**
- Documentar o sistema de notificações refactorado do bot Telegram (PRs #19, #20, #21, #22)
- Criar documentação completa da arquitetura de 3 fases (P0/P1/P2)
- Atualizar documentação existente para refletir nova arquitetura

**O que foi feito (mudanças)**
- Branch criada: `docs/bot-notification-refactor`
- Arquivos criados:
  - `docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` - Documentação completa do sistema
  - `docs/past_deliveries/BOT_NOTIFICATION_REFACTOR_DELIVERY.md` - Resumo da entrega
- Arquivos atualizados:
  - `server/Telegram Bot Architect.md` - Adicionada seção "Notification System Architecture"
  - `server/BOT README.md` - Adicionada seção "Notification System (v3.0.0)"
  - `docs/ARQUITETURA.md` - Atualizado diagrama e features (F4.7)
  - `.roo/rules/memory.md` - Esta entrada

**Arquitetura Documentada**
- Fase P0: Result object pattern, DB status tracking, log pattern
- Fase P1: Retry Manager (1s→2s→4s), Correlation Logger (UUID), Dead Letter Queue
- Fase P2: Notification Metrics (p50/p95/p99), Health Check API, Dashboard Widget

**Diagramas Criados**
- Diagrama de 3 fases (ASCII art)
- Fluxo de dados (Mermaid)
- Ciclo de vida da notificação
- Arquitetura do sistema completo

**O que deu certo**
- Documentação consistente com padrões do projeto (português)
- Referências cruzadas entre documentos
- Diagramas claros explicando fluxo e componentes
- Troubleshooting guide incluído

**Regras locais para o futuro (lições acionáveis)**
- Sempre documentar nova arquitetura em 3 níveis: overview, detalhada, troubleshooting
- Manter consistência de linguagem (português para docs, inglês para código)
- Incluir diagramas Mermaid quando possível para fluxos complexos
- Criar arquivo de delivery em `docs/past_deliveries/` para grandes features

**Pendências / próximos passos**
- Push da branch: `git push origin docs/bot-notification-refactor`
- Criar PR usando template
- Solicitar review
- Merge para main

---

## Memory Entry — 2026-02-16 00:55
**Contexto / Objetivo**
- Corrigir falha de parsing Markdown no bot Telegram (20:30)
- Identificar root cause e implementar fixes imediatos
- Documentar arquitetura de melhorias futuras

**O que foi feito (mudanças)**
- Branch: Main (deploy direto para produção)
- Arquivos alterados:
  - `server/bot/tasks.js` — escapados 7 caracteres `!` em mensagens MarkdownV2
  - `.migrations/add_dead_letter_queue.sql` — migration idempotente com IF NOT EXISTS
  - `server/services/deadLetterQueue.js` — alterado onConflict para 'correlation_id'
  - `scripts/validate-dlq-fix.sh` — criado script de validação
- Arquivos criados:
  - `plans/telegram-notification-fixes-plan.md` — plano de fixes imediato
  - `plans/telegram-architecture-improvements.md` — arquitetura de melhorias futuras

**Root Cause Identificado**
1. Markdown escaping: Literais de template com `!` não escapados (ex: `Hora do seu remédio!`)
2. DLQ schema: Falta UNIQUE constraint para upsert com onConflict

**O que deu certo**
- Vercel logs funcionando com VERCEL_TOKEN
- Deploy automático funcionando (código já incluiu escapeMarkdown anterior)
- Notificação 21:52 enviada com sucesso após fix
- DLQ funcionando corretamente (notification enqueued to DLQ)

**O que não deu certo / riscos**
- Stale deployments: Vercel estava rodando código antigo sem o escape fix
- Múltiplos `!` em mensagens não detectados inicialmente (precisou de 3 iterações)
- Migration original sem idempotência falhou com "policy already exists"

**Regras locais para o futuro (lições acionáveis)**
- TODAS as mensagens MarkdownV2 DEVEM usar escapeMarkdown() ou telegramFormatter
- Literal `!` em templates string é caractere especial em MarkdownV2 e DEVE ser escapado como `\!`
- Migrations DEVEM usar IF NOT EXISTS para políticas RLS e constraints
- Usar `grep -n "![^}]" server/bot/*.js` para encontrar caracteres não escapados
- Commit inicial com escapeMarkdown existía mas código não foi redeployado

**Documentação Atualizada**
- `docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` - Precisa de atualização com lessons learned
- `server/BOT README.md` - Verificar seção de troubleshooting

**Pendências / próximos passos**
- Implementar Fase 1: Retry mechanism + telegramFormatter library
- Implementar Fase 2: Alerting + métricas
- Atualizar docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md com novos aprendizados
- Adicionar testes unitários para formatação de mensagens

---

*Última atualização: 2026-02-16 | Recuperação de memória -entries perdidas restauradas (Feb 9-13, 2026)*
