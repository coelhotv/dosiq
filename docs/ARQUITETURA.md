# 🏗️ Arquitetura do Meus Remédios

Visão geral da arquitetura técnica do projeto, padrões de design e fluxo de dados.

---

## 📊 Visão Arquitetural

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (BROWSER)                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    React 19 + Vite (SPA)                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │  │
│  │  │   Views     │  │ Components  │  │      Hooks/Lib          │  │  │
│  │  │  (Pages)    │  │  (UI/Forms) │  │  (SWR, Validation)      │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │  │
│  │         │                │                     │                │  │
│  │         └────────────────┴─────────────────────┘                │  │
│  │                           │                                     │  │
│  │                    ┌──────▼──────┐                              │  │
│  │                    │  Services   │  ← Validação Zod             │  │
│  │                    │    Layer    │  ← Cache SWR                 │  │
│  │                    └──────┬──────┘                              │  │
│  │                           │                                     │  │
│  │                    ┌──────▼──────┐                              │  │
│  │                    │  Supabase   │  ← Cliente + Auth            │  │
│  │                    │   Client    │                              │  │
│  │                    └──────┬──────┘                              │  │
│  └───────────────────────────┼─────────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     SUPABASE        │
                    │  ┌───────────────┐  │
                    │  │   PostgreSQL  │  │
                    │  │    (Dados)    │  │
                    │  └───────────────┘  │
                    │  ┌───────────────┐  │
                    │  │  Auth (RLS)   │  │
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
    │ VERCEL  │          │VERCEL   │          │VERCEL   │
    │  CRON   │          │  API    │          │ STATIC  │
    │(Agend.) │          │(Webhooks│          │(Assets) │
    └─────────┘          └─────────┘          └─────────┘
                               │
                    ┌──────────▼──────────┐
                    │   TELEGRAM BOT      │
                    │   (Node.js)         │
                    │   ┌─────────────┐   │
                    │   │ Sessions    │   │
                    │   │ (TTL 30min) │   │
                    │   └─────────────┘   │
                    └─────────────────────┘
```

---

## 🧩 Camadas da Aplicação

### 1. **Presentation Layer** (UI)

Responsabilidade: Renderização visual e interação do usuário.

```
src/
├── views/           # Páginas completas (Dashboard, Auth, etc)
├── components/
│   ├── ui/          # Componentes atômicos (Button, Card, Modal, Calendar, AlertList)
│   ├── medicine/    # Domínio: Medicamentos (MedicineForm consolidado)
│   ├── protocol/    # Domínio: Protocolos (ProtocolForm com modo simple/full)
│   ├── stock/       # Domínio: Estoque
│   ├── log/         # Domínio: Registros (LogForm UX unificada)
│   ├── dashboard/   # Domínio: Dashboard (SmartAlerts, StockAlertsWidget → AlertList)
│   ├── adherence/   # Domínio: Adesão (AdherenceWidget, AdherenceProgress, StreakBadge)
│   └── onboarding/  # Wizard de primeiros passos (usa MedicineForm/ProtocolForm consolidados)
```

**Padrão:** Componentes funcionais React 19 com hooks.

**Componentes Consolidados (v2.7.0):**
- [`MedicineForm`](src/components/medicine/MedicineForm.jsx) - Unificado com FirstMedicineStep via props de onboarding
- [`ProtocolForm`](src/components/protocol/ProtocolForm.jsx) - Modo 'full'|'simple' para formulários completos e onboarding
- [`Calendar`](src/components/ui/Calendar.jsx) - Features opcionais: lazyLoad, swipe, monthPicker
- [`AlertList`](src/components/ui/AlertList.jsx) - Componente base para SmartAlerts e StockAlertsWidget
- [`LogForm`](src/components/log/LogForm.jsx) - UX padronizada entre Dashboard e History

### 2. **Business Logic Layer** (Services)

Responsabilidade: Regras de negócio, validação e comunicação com API.

```
src/services/
├── api/
│   ├── cachedServices.js      # Wrapper SWR
│   ├── medicineService.js     # CRUD Medicamentos
│   ├── protocolService.js     # CRUD Protocolos
│   ├── stockService.js        # CRUD Estoque
│   ├── logService.js          # CRUD Registros
│   └── treatmentPlanService.js # Planos de tratamento
└── api.js                     # Exportações principais
```

**Fluxo de dados:**
```
Component → Service → Zod Validation → Supabase → PostgreSQL
                ↓
         Cache SWR (leitura)
                ↓
         Invalidação (escrita)
```

### 3. **Data Access Layer** (Lib/Cache)

Responsabilidade: Abstração de acesso a dados e cache.

```
src/lib/
├── supabase.js       # Cliente Supabase configurado
└── queryCache.js     # Implementação SWR

src/hooks/
└── useCachedQuery.js # Hook React para cache

src/schemas/
├── medicineSchema.js    # Validação Zod
├── protocolSchema.js
├── stockSchema.js
└── logSchema.js
```

---

## 🔄 Fluxo de Dados

### Leitura com Cache SWR

```javascript
// Componente React
const { data, isLoading, error } = useCachedQuery(
  'medicines',
  () => medicineService.getAll(),
  { staleTime: 30000 }
)
```

```
1. Componente solicita dados
         ↓
2. useCachedQuery verifica cache
         ↓
3. Cache HIT (fresh)? → Retorna imediatamente (~0-50ms)
   Cache HIT (stale)? → Retorna + revalida background
   Cache MISS? → Executa fetcher
         ↓
4. Dados armazenados no Map
         ↓
5. Componente atualizado
```

### Escrita com Invalidação

```javascript
// No cachedMedicineService
async create(medicine) {
  const result = await medicineService.create(medicine)
  invalidateCache('medicines')  // ← Invalida lista
  return result
}
```

```
1. Usário cria medicamento
         ↓
2. Validação Zod no service
         ↓
3. POST para Supabase
         ↓
4. Sucesso? → Invalida cache 'medicines'
         ↓
5. Próxima leitura → Cache MISS → Fetch fresh
```

---

## 🛡️ Segurança

### Autenticação
- JWT tokens gerenciados pelo Supabase Auth
- Refresh automático de sessão
- RLS (Row Level Security) em todas as tabelas

### Autorização
```sql
-- Exemplo de política RLS
CREATE POLICY "Users can only see their own medicines"
  ON medicines
  FOR ALL
  USING (user_id = auth.uid());
```

### Validação de Dados
- **Zod Schemas:** Validação runtime em todos os services
- **Nenhum dado** chega ao backend sem validação
- Mensagens de erro em português

---

## 🏗️ Padrões de Componentes Consolidados

### Pattern: Mode-Based Components

Componentes que suportam múltiplos modos de operação via prop `mode`:

```jsx
// ProtocolForm suporta 'full' (padrão) e 'simple' (onboarding)
<ProtocolForm mode="full" medicines={medicines} ... />     // Formulário completo
<ProtocolForm mode="simple" preselectedMedicine={med} ... /> // Onboarding simplificado
```

**Benefícios:**
- Um único componente mantido
- Comportamento consistente entre modos
- Backward compatibility via valores padrão

### Pattern: Optional Feature Props

Features avançadas ativadas via props booleanas:

```jsx
// Calendar com features opcionais
<Calendar
  markedDates={dates}
  enableLazyLoad={true}      // Ativa lazy loading
  enableSwipe={true}         // Ativa navegação por swipe
  enableMonthPicker={true}   // Ativa seletor de mês
  onLoadMonth={fetchData}    // Callback para carregar dados
/>
```

**Benefícios:**
- Componente base leve por padrão
- Features adicionadas conforme necessidade
- 100% backward compatible

### Pattern: Base Component with Variants

Componente base genérico com wrappers específicos:

```jsx
// AlertList - componente base em src/components/ui/
<AlertList
  alerts={alerts}
  variant="smart"      // 'default' | 'smart' | 'stock' | 'dose'
  onAction={handleAction}
/>

// SmartAlerts - wrapper específico
<SmartAlerts alerts={doseAlerts} onAction={...} />

// StockAlertsWidget - wrapper específico
<StockAlertsWidget lowStockItems={...} onAddStock={...} />
```

**Benefícios:**
- Consistência visual garantida
- Manutenção centralizada no AlertList
- Fácil adicionar novos tipos de alertas

### Pattern: Onboarding Integration

Formulários que suportam fluxo de onboarding via props:

```jsx
// MedicineForm com props de onboarding
<MedicineForm
  onSave={handleSave}
  onSuccess={nextStep}           // Callback após sucesso
  autoAdvance={true}             // Avança automaticamente
  showCancelButton={false}       // Sem botão cancelar
  submitButtonLabel="Salvar e Continuar"
/>
```

---

## 🚀 Performance

### Estratégias

| Estratégia | Implementação | Impacto |
|------------|---------------|---------|
| Cache SWR | `queryCache.js` | 95% mais rápido em re-leituras |
| View Materializada | `medicine_stock_summary` | 5x mais rápido consultas estoque |
| Deduplicação | `pendingRequests` Map | Evita requests duplicados |
| LRU Eviction | 50 entradas máximo | Previne memory leaks |
| React 19 | Compiler otimizado | Menos re-renders |
| Component Consolidation | ~783 LOC removidas | Bundle menor, menos re-renders |

### Métricas de Consolidação de Componentes

| Métrica | Valor |
|---------|-------|
| Linhas de código removidas | ~783 LOC |
| Componentes consolidados | 6 grupos |
| Redução de bundle | ~5KB |
| Testes mantidos passando | 100% |
| Breaking changes | 0 |

---

## 📦 Onboarding Flow

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
Step 1: FirstMedicineStep → MedicineForm com props de onboarding
     ↓
Step 2: FirstProtocolStep → ProtocolForm mode='simple'
     ↓
Step 3: TelegramIntegrationStep (Bot opcional)
     ↓
Salva onboarding_completed = true
     ↓
Dashboard
```

**Nota:** FirstMedicineStep e FirstProtocolStep agora reutilizam os componentes consolidados MedicineForm e ProtocolForm com props específicas de onboarding (`autoAdvance`, `onSuccess`, `mode='simple'`).

---

## 🧪 Testes

```
Testes Unitários (Vitest)
├── src/lib/__tests__/        # Cache SWR
├── src/schemas/__tests__/    # Validação Zod (23 testes)
├── src/services/api/__tests__/ # Services
└── src/components/**/__tests__/ # Componentes críticos

Cobertura: 110+ testes
```

---

## 📝 Convenções Importantes

1. **Nomenclatura em português:** Todos os campos de dados em PT-BR
2. **Zod em todos os services:** Nenhuma operação sem validação
3. **Cache em leituras:** Sempre usar `cachedServices` para GETs
4. **Invalidação após escrita:** Sempre invalidar cache após POST/PUT/DELETE
5. **RLS obrigatório:** Todas as tabelas devem ter políticas de segurança

---

## 🔗 Relacionamentos

Veja também:
- [PADROES_CODIGO.md](./PADROES_CODIGO.md) - Convenções detalhadas incluindo padrões de componentes consolidados
- [API_SERVICES.md](./API_SERVICES.md) - Documentação das APIs
- [DECISOES_TECNICAS.md](./past_deliveries/DECISOES_TECNICAS.md) - Por que escolhemos cada tech
- [HOOKS.md](./HOOKS.md) - Hooks customizados
- [SCHEMAS_VALIDACAO.md](./past_deliveries/SCHEMAS_VALIDACAO.md) - Validação Zod
- [CONSOLIDACAO_COMPONENTES_FINAL.md](./past_deliveries/CONSOLIDACAO_COMPONENTES_FINAL.md) - Documentação técnica da consolidação de componentes
- [CONSOLIDACAO_COMPONENTES_PLANO.md](../plans/CONSOLIDACAO_COMPONENTES_PLANO.md) - Blueprint da consolidação
