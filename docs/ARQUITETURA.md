# 🏗️ Arquitetura do Dosiq

**Versão:** 4.0.0
**Data:** 2026-04-02
**Status:** Ativo (v4.0.0 — Refactor de estoque/purchases + rollout redesign-first + Mobile Performance Initiative M0-M8, P1-P4, D0-D3)

Visão geral da arquitetura técnica do projeto, padrões de design e fluxo de dados.

> **⚠️ AUTORIDADE:** Este documento deve ser usado em conjunto com:
> - **[`CLAUDE.md`](../CLAUDE.md)** - Regras canônicas para agentes
> - **[`.agent/memory/`](../.agent/memory/)** - Memória canônica DEVFLOW (rules.json, anti-patterns.json, K-NNN)
> - **[`PADROES_CODIGO.md`](./PADROES_CODIGO.md)** - Convenções de código detalhadas

---

## 📚 Referências Rápidas

| Documento | Conteúdo | Público |
|-----------|----------|---------|
| [`CLAUDE.md`](../CLAUDE.md) | Regras canônicas do projeto, checklist pré/pós-código | Todos os agentes |
| [`.agent/memory/rules.json`](../.agent/memory/rules.json) | Regras positivas (R-NNN) — padrões que funcionam | Agentes de código |
| [`.agent/memory/anti-patterns.json`](../.agent/memory/anti-patterns.json) | Anti-patterns (AP-NNN) — erros a evitar | Agentes de código |
| [`PADROES_CODIGO.md`](./PADROES_CODIGO.md) | Convenções detalhadas de código | Desenvolvedores |
| [`standards/MOBILE_PERFORMANCE.md`](./standards/MOBILE_PERFORMANCE.md) | Standards de performance mobile (lazy, code-split, auth cache) | Agentes de performance |

---

## 📊 Visão Arquitetural (v4.0.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (BROWSER)                              │
│                    React 19 + Vite (PWA/SPA)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      FEATURES + SHARED LAYERS                        │  │
│  │  ┌─────────────────────┐  ┌──────────────────────────────────────┐  │  │
│  │  │   src/features/     │  │         src/shared/                  │  │  │
│  │  │  ┌───────────────┐  │  │  ┌──────────┐ ┌──────────┐          │  │  │
│  │  │  │  Dashboard    │  │  │  │Components│ │  Hooks   │          │  │  │
│  │  │  │  Medications  │  │  │  │  (UI)    │ │(use*)    │          │  │  │
│  │  │  │  Protocols    │  │  │  └────┬─────┘ └────┬─────┘          │  │  │
│  │  │  │  Stock        │  │  │       │            │                │  │  │
│  │  │  │  Adherence    │  │  │  ┌────┴────────────┴────┐           │  │  │
│  │  │  └───────┬───────┘  │  │  │      Services        │           │  │  │
│  │  └──────────┼───────────┘  │  │  (SWR + Zod + API)   │           │  │  │
│  │             │              │  └──────────┬───────────┘           │  │  │
│  │             └──────────────┴─────────────┘                       │  │  │
│  │                            │                                     │  │  │
│  │                     ┌──────▼──────┐                              │  │  │
│  │                     │  Supabase   │  ← Cliente + Auth            │  │  │
│  │                     │   Client    │                              │  │  │
│  │                     └──────┬──────┘                              │  │  │
│  └────────────────────────────┼──────────────────────────────────────┘  │
│                               │                                          │
│  ┌────────────────────────────┼──────────────────────────────────────┐   │
│  │         PWA LAYER          │                                      │   │
│  │  ┌───────────┐  ┌──────────▼────────┐  ┌─────────────────────┐  │   │
│  │  │  SW       │  │  Push Manager     │  │  Analytics (Local)  │  │   │
│  │  │(Workbox)  │  │  (VAPID + Web)    │  │  (Privacy-First)    │  │   │
│  │  └───────────┘  └───────────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
              ┌──────▼──────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │  SUPABASE   │   │  VERCEL   │   │  VERCEL   │
              │ ┌─────────┐ │   │    API    │   │   CRON    │
              │ │PostgreSQL│ │   │(Webhooks)│   │(Agend.)   │
              │ │+ RLS     │ │   └───────────┘   └───────────┘
              │ └─────────┘ │         │
              │ ┌─────────┐ │         │
              │ │  Auth   │ │         │
              │ └─────────┘ │         │
              └──────┬──────┘         │
                     │                │
              ┌──────▼────────────────▼──────┐
              │      TELEGRAM BOT            │
              │   (Node.js + Resilient)      │
              │   ┌─────────────────────┐    │
              │   │ messageFormatter    │    │
              │   │ errorHandler        │    │
              │   │ retryManager        │    │
              │   │ deadLetterQueue     │    │
              │   │ notificationMetrics │    │
              │   └─────────────────────┘    │
              └──────────────────────────────┘
```

### Histórico de Entregas Principais

| Marco | Componente | Descrição |
|-------|------------|-----------|
| **F4.6** | Feature Org | `apps/web/src/features/` + `apps/web/src/shared/` + path aliases |
| **F4.7** | Bot Resilient v3.0 | Sistema de notificações com retry/DLQ/métricas |
| **F5.6** | ANVISA Base | Database de medicamentos + busca fuzzy |
| **F5.10** | Cost Analysis | Dashboard de custo de tratamento |
| **F5.C** | Onboarding v3.2 | Wizard repaginado |
| **F5.D** | Landing Redesign | Nova landing page |
| **M2** | Bundle Split | 13 views lazy + manualChunks: **989KB → 102kB gzip** (89% redução) |
| **P1-P4** | HealthHistory Perf | requestIdleCallback + SWR cache + slim select (76% payload reduction) |
| **D0-D3** | Dashboard Perf | Lazy loading fixes + auth cache (13 → 1 roundtrip) + slim selects |
| **F6.1-F6.5** | Fase 6 (4/5) | Refill Prediction, Risk Score, Dose Insights, Export PDF, Smart Alerts |
| **F6.6** | Stock Refactor v4.0 | `purchases` + `stock_consumptions` + ANVISA + Telegram parity |

### Refactor de Estoque v4.0.0

O domínio de estoque passou a operar com separação explícita entre:

- `purchases`: histórico imutável de compras
- `stock`: saldo corrente por lote
- `stock_adjustments`: trilha de auditoria para correções e restaurações
- `stock_consumptions`: vínculo exato entre `medicine_logs` e os lotes consumidos

Consequências arquiteturais:

- histórico de compras e última compra deixam de ser inferidos a partir de `stock.notes`
- consumo e restauração de estoque passam por RPCs transacionais FIFO
- o redesign `?redesign=1` é a superfície oficial desta onda
- o bot Telegram usa os mesmos RPCs da aplicação web para compra e consumo
- `medicines.regulatory_category` passa a suportar a UX de laboratório por compra

### Sistema de Notificações v3.0.0

Arquitetura resiliente implementada em 3 fases:

**Fase P0 - Fundamentos:**
- Result object pattern (nunca silencia falhas)
- Database status tracking (`status_ultima_notificacao`)
- Structured logging (`logger.js`)

**Fase P1 - Confiabilidade:**
- `retryManager.js` - Exponential backoff (1s→2s→4s) com jitter
- `correlationLogger.js` - UUID tracing end-to-end
- `deadLetterQueue.js` - PostgreSQL DLQ com RLS
- Categorização automática de erros

**Fase P2 - Observabilidade:**
- `notificationMetrics.js` - Métricas em memória (p50/p95/p99)
- `api/health/notifications.js` - Health check endpoint
- `NotificationStatsWidget.jsx` - Widget no Dashboard

```
Cron Job
    ↓
Deduplication Check
    ↓
sendWithRetry
    ↓
├─ Tentativa 1 → Sucesso → Métricas
├─ Tentativa 1 → Falha → Retry 1s
├─ Tentativa 2 → Sucesso → Métricas
├─ Tentativa 2 → Falha → Retry 2s
├─ Tentativa 3 → Sucesso → Métricas
└─ Tentativa 3 → Falha → DLQ
```

**Documentação completa:** [`TELEGRAM_BOT_NOTIFICATION_SYSTEM.md`](./TELEGRAM_BOT_NOTIFICATION_SYSTEM.md)

---

## 🧩 Camadas da Aplicação

### 1. **Presentation Layer** (UI) - v2.8.0 Feature-Based

Responsabilidade: Renderização visual e interação do usuário.

#### Nova Estrutura (F4.6)

```
apps/web/src/
├── features/              # Organização por domínio (F4.6)
│   ├── adherence/
│   │   ├── components/    # AdherenceWidget, AdherenceProgress, StreakBadge
│   │   ├── hooks/         # useAdherenceTrend
│   │   ├── services/      # adherenceService
│   │   └── utils/         # adherenceLogic, adherenceStats
│   ├── dashboard/
│   │   ├── components/    # DashboardWidgets, InsightCard, SparklineAdesao
│   │   └── utils/         # dashboardHelpers
│   ├── medications/
│   │   ├── components/    # MedicineCard, MedicineForm
│   │   └── services/      # medicineService
│   ├── protocols/
│   │   ├── components/    # ProtocolCard, ProtocolForm, TitrationWizard
│   │   ├── services/      # protocolService, titrationService
│   │   └── utils/         # titrationUtils
│   └── stock/
│       ├── components/    # StockCard, StockForm, StockIndicator
│       └── services/      # stockService
│
├── shared/                # Recursos compartilhados (F4.6)
│   ├── components/
│   │   ├── ui/            # Button, Card, Modal, Loading, AlertList
│   │   ├── log/           # LogEntry, LogForm
│   │   ├── gamification/  # BadgeDisplay, MilestoneCelebration
│   │   ├── onboarding/    # OnboardingWizard, FirstMedicineStep, etc
│   │   └── pwa/           # PushPermission, InstallPrompt (F4.2/F4.3)
│   ├── hooks/             # useCachedQuery, useTheme, usePushSubscription
│   ├── services/          # cachedServices, analyticsService
│   ├── constants/         # Schemas Zod (medicine, protocol, stock, log)
│   ├── utils/             # queryCache, supabase client
│   └── styles/            # CSS tokens, temas
│
└── views/                 # Páginas completas (Dashboard, Auth, etc)
```

#### Path Aliases (Vite Config)

```javascript
// apps/web/vite.config.js  (__dirname = apps/web/)
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@features': path.resolve(__dirname, './src/features'),
    '@shared': path.resolve(__dirname, './src/shared'),
    '@dashboard': path.resolve(__dirname, './src/features/dashboard'),
    '@medications': path.resolve(__dirname, './src/features/medications'),
    '@protocols': path.resolve(__dirname, './src/features/protocols'),
    '@stock': path.resolve(__dirname, './src/features/stock'),
    '@adherence': path.resolve(__dirname, './src/features/adherence'),
    '@design-tokens': path.resolve(__dirname, '../../packages/design-tokens/src'),
  }
}
```

**Uso recomendado:**
```javascript
// ✅ BOM - Path alias
import { Button } from '@shared/components/ui/Button'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'

// ❌ EVITAR - Imports relativos longos
import { Button } from '../../../shared/components/ui/Button'
```

**Padrão:** Componentes funcionais React 19 com hooks.

**Componentes Consolidados (v2.7.0):**
- `MedicineForm` - Unificado com FirstMedicineStep via props de onboarding
- `ProtocolForm` - Modo 'full'|'simple' para formulários completos e onboarding
- `Calendar` - Features opcionais: lazyLoad, swipe, monthPicker
- `AlertList` - Componente base para SmartAlerts e StockAlertsWidget
- `LogForm` - UX padronizada entre Dashboard e History

#### PWA Components (F4.2/F4.3)

```
src/shared/components/pwa/
├── InstallPrompt.jsx      # Prompt de instalação PWA (iOS/Android)
├── PushPermission.jsx     # Gerenciamento de permissões push
└── pwaUtils.js           # Detecção de plataforma e utilitários
```

### 2. **Business Logic Layer** (Services)

Responsabilidade: Regras de negócio, validação e comunicação com API.

```
apps/web/src/services/
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

### 2. **Business Logic Layer** (Services) - v2.8.0

```
apps/web/src/shared/services/
├── cachedServices.js        # Wrappers SWR com invalidação automática
├── api/
│   ├── medicineService.js
│   ├── protocolService.js
│   ├── stockService.js
│   ├── logService.js
│   ├── treatmentPlanService.js
│   └── index.js
└── analyticsService.js      # Analytics privacy-first (F4.4)

// Feature-specific services
apps/web/src/features/{domain}/services/
├── adherenceService.js
└── ...
```

### 3. **Data Access Layer** (Lib/Cache)

Responsabilidade: Abstração de acesso a dados e cache.

```
apps/web/src/shared/utils/
├── supabase.js       # Cliente Supabase configurado
└── queryCache.js     # Implementação SWR

apps/web/src/shared/hooks/
└── useCachedQuery.js # Hook React para cache

apps/web/src/schemas/
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

## 📱 PWA Architecture (F4.2 - F4.4)

### Service Worker (Workbox)

```
public/
├── manifest.json          # PWA manifest
└── icons/                 # Ícones em 8 tamanhos (72x72 a 512x512)

apps/web/src/shared/components/pwa/
├── InstallPrompt.jsx      # Custom install prompt
├── PushPermission.jsx     # Permission UI
└── pwaUtils.js           # Platform detection
```

**Cache Strategies:**

| Asset Type | Strategy | TTL |
|------------|----------|-----|
| JS/CSS/Images | CacheFirst | 30 dias |
| Supabase API | StaleWhileRevalidate | 5 min |
| Write Operations | NetworkOnly | - |

### Push Notifications (F4.3)

```
api/
├── push-subscribe.js      # POST - Subscribe/unsubscribe
└── push-send.js          # POST - Send push (cron/vercel)

server/services/
└── pushService.js        # VAPID + rate limiting
```

**Notification Types:**
1. **Lembrete de dose** - Scheduled reminder
2. **Dose atrasada** - Late dose alert (t+15min)
3. **Estoque baixo** - Low stock (<= 3 dias)

### Analytics (F4.4)

**Privacy-First Design:**
- Sem PII (no email, name, userId, phone, CPF)
- localStorage apenas
- User agent truncado (primeira palavra)
- Event IDs anônimos (randomUUID)

**Tracked Events:**
- `pwa_installed`, `pwa_install_prompt_*`
- `push_opted_in/out`, `push_permission_*`
- `offline_session`, `deep_link_accessed`

---

## � Performance

### Métricas Atuais (v4.0.0)

| Métrica | Antes | Depois | Sprint |
|---------|-------|--------|--------|
| Bundle size (gzip) | 989 KB | **102.47 kB** | M2 |
| First load JS | 1435 KB | **678 KB** | D0 |
| Auth roundtrips (Dashboard) | 13 | **1** | D3 |
| Queries simultâneas (HealthHistory) | 12+ | **2** | P2 |
| Timeline payload | ~40KB | **~10KB** (76% ↓) | P3 |
| Testes unitários | 140+ | **539+** | — |

### Estratégias de Performance

| Estratégia | Implementação | Impacto |
|------------|---------------|---------|
| Lazy Loading Views | `React.lazy()` + `Suspense` + `ViewSkeleton` | FCP ~500ms mais rápido mobile (M2) |
| Code Splitting | Vite `manualChunks` — 8 chunks vendor/feature | 89% bundle reduction (M2) |
| Auth Cache | `getUserId()` com promise coalescence | 13 → 1 auth roundtrip por sessão (D3) |
| SWR Cache | `queryCache.js` + `useCachedQuery` | 95% mais rápido em re-leituras |
| requestIdleCallback | Serialização de queries background | Sem freeze no scroll mobile (P2) |
| Slim Selects | Colunas específicas em todos os GETs | 76% payload reduction em timeline (P3) |
| View Materializada | `medicine_stock_summary` | 5x mais rápido consultas estoque |

### Lazy Loading Pattern (Obrigatório — M2, R-117)

```jsx
// ✅ CORRETO — todas as views (exceto Dashboard) são lazy-loaded
const Medicines = lazy(() => import('./views/Medicines'))

// Suspense com ViewSkeleton (NUNCA null ou spinner genérico)
<Suspense fallback={<ViewSkeleton />}>
  <Medicines {...props} />
</Suspense>
```

**Vite manualChunks (8 chunks):** `vendor-pdf` (jsPDF, 174KB), `vendor-framer`,
`vendor-supabase`, `vendor-virtuoso`, `feature-medicines-db` (ANVISA, 105KB),
`feature-history`, `feature-stock`, `feature-landing`.

### Auth Cache Pattern (Obrigatório — D3, R-128)

```javascript
// ✅ CORRETO — usa cache com promise coalescence
import { getUserId } from '@shared/utils/supabase'
const userId = await getUserId()

// ❌ ERRADO — bypassa cache, gera roundtrip extra
const { data } = await supabase.auth.getUser()
```

### Barrel Exports — Risco de Code-Splitting (AP-B04)

```javascript
// ❌ NUNCA re-exportar services pesados em barrels
// src/shared/services/index.js
export { refillPredictionService } from './refillPredictionService' // puxa chunk eager

// ✅ Importar diretamente do arquivo
import { refillPredictionService } from '@shared/services/refillPredictionService'
```

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

## 🧪 Testes (v4.0.0)

```
Testes Unitários (Vitest 4)
├── apps/web/src/shared/lib/__tests__/        # Cache SWR
├── apps/web/src/schemas/__tests__/           # Validação Zod
├── apps/web/src/shared/services/__tests__/   # Services
├── apps/web/src/features/**/__tests__/       # Feature tests
├── apps/web/src/shared/components/**/__tests__/ # Componentes
└── server/**/__tests__/                      # Bot/server tests

Cobertura: 543+ testes
```

### Test Command Matrix

| Comando | Descrição | Uso |
|---------|-----------|-----|
| **`npm run validate:agent`** | **Lint + testes + build (10-min kill switch)** | **Obrigatório pré-push** |
| `npm run test:critical` | Testes essenciais (services, utils, schemas) | Dev rápido |
| `npm run test:fast` | 1 thread, todos os testes | Quando RAM é limitada |
| `npm run test:changed` | Arquivos modificados desde main | CI/CD rápido |
| `npm run test:lowram` | Sequencial (8GB RAM) | Ambientes restritos |
| `npm run validate:quick` | Lint + testes alterados | Pre-commit |
| `npm run validate:full` | Lint + cobertura + build | CI completo |

---

## 📝 Convenções Importantes

1. **Nomenclatura em português:** Todos os campos de dados em PT-BR
2. **Zod em todos os services:** Nenhuma operação sem validação
3. **Cache em leituras:** Sempre usar `cachedServices` para GETs
4. **Invalidação após escrita:** Sempre invalidar cache após POST/PUT/DELETE
5. **RLS obrigatório:** Todas as tabelas devem ter políticas de segurança
6. **Path Aliases:** Usar `@shared/`, `@features/` em vez de imports relativos longos
7. **Git Workflow:** Nunca commitar diretamente na `main`

---

## 🔄 Git Workflow (RIGID PROCESS - MANDATORY)

> **⚠️ CRITICAL:** ALL code/documentation changes MUST follow this workflow exactly. NO exceptions.
> **Autoridade:** Veja [`CLAUDE.md`](../CLAUDE.md) (regras canônicas) e [`.memory/rules.md`](../.memory/rules.md)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANDATORY GITHUB WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣  CREATE BRANCH      (Never work on main!)                              │
│  2️⃣  MAKE CHANGES       (Follow all coding standards)                      │
│  3️⃣  VALIDATE LOCALLY   (Lint + Tests + Build)                             │
│  4️⃣  COMMIT             (Atomic commits, semantic messages)                │
│  5️⃣  PUSH BRANCH        (To origin)                                        │
│  6️⃣  CREATE PULL REQUEST (Use PR template)                                 │
│  7️⃣  WAIT FOR REVIEW    (Address all comments)                             │
│  8️⃣  MERGE & CLEANUP    (--no-ff, delete branch)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Quick Reference

```bash
# BEFORE ANY CODE CHANGE:
git checkout main && git pull origin main
git checkout -b feature/wave-X/nome-descritivo

# BEFORE COMMIT/PUSH:
npm run validate:agent  # Lint + testes + build (10-min kill switch)

# AFTER PUSH:
# 1. Create PR using template: docs/PULL_REQUEST_TEMPLATE.md
# 2. Wait for review
# 3. Merge with --no-ff
# 4. Delete branch
```

### Detailed Instructions

Ver workflow completo em [`CLAUDE.md`](../CLAUDE.md) (seção Git Workflow).

### Anti-Patterns (STRICTLY PROHIBITED)

| Anti-Pattern | Consequence | What To Do Instead |
|--------------|-------------|-------------------|
| Commit directly to `main` | Unreviewed code in production | Always create feature branch |
| Skip local validation | Broken builds in CI/CD | Run `npm run validate` before every push |
| Push without PR | No code review | Create PR using template |
| Use `--no-verify` | Bypass quality gates | Fix errors, don't bypass |
| Merge own PR | No quality assurance | Wait for reviewer approval |
| Large PRs (>500 lines) | Difficult review | Split into smaller PRs |
| Keep merged branches | Repository clutter | Delete immediately after merge |

---

## 🔗 Relacionamentos

### Documentação de Governança

- **[`CLAUDE.md`](../CLAUDE.md)** - Regras canônicas para agentes (fonte da verdade)
- **[`.agent/memory/rules.json`](../.agent/memory/rules.json)** - Regras positivas R-NNN (DEVFLOW)
- **[`.agent/memory/anti-patterns.json`](../.agent/memory/anti-patterns.json)** - Anti-patterns AP-NNN (DEVFLOW)
- **[`PADROES_CODIGO.md`](./PADROES_CODIGO.md)** - Convenções detalhadas de código
- **[`standards/MOBILE_PERFORMANCE.md`](./standards/MOBILE_PERFORMANCE.md)** - Standards de performance mobile

### Documentação Técnica

- [ARQUITETURA_FRAMEWORK.md](./archive/ARQUITETURA_FRAMEWORK.md) - Framework arquitetural completo
- [SERVICES.md](./reference/SERVICES.md) - Documentação das APIs
- [LINT_COVERAGE.md](./archive/LINT_COVERAGE.md) - Configurações ESLint e boas práticas
- [OTIMIZACAO_TESTES_ESTRATEGIA.md](./archive/OTIMIZACAO_TESTES_ESTRATEGIA.md) - Estratégia completa de testes
- [PWA_WEB_PUSH.md](./architecture/PWA_WEB_PUSH.md) - Arquitetura e Fluxos do Web Push Nativo e Service Workers
- [HOOKS.md](./reference/HOOKS.md) - Hooks customizados

### Templates

- [PULL_REQUEST_TEMPLATE.md](./PULL_REQUEST_TEMPLATE.md) - Template obrigatório para PRs

### Documentação Histórica

- [DECISOES_TECNICAS.md](./archive/past_deliveries/DECISOES_TECNICAS_ONDA_1.md) - Por que escolhemos cada tech
- [SCHEMAS_VALIDACAO.md](./archive/past_deliveries/SCHEMAS_VALIDACAO.md) - Validação Zod
- [CONSOLIDACAO_COMPONENTES_FINAL.md](./archive/past_deliveries/CONSOLIDACAO_COMPONENTES_FINAL.md) - Documentação técnica da consolidação de componentes
- [CONSOLIDACAO_COMPONENTES_PLANO.md](../plans/archive_old/roadmap_v3/CONSOLIDACAO_COMPONENTES_PLANO.md) - Blueprint da consolidação

---

*Última atualização: 19/04/2026 — v4.0.0 + Fase 7 (monorepo): web app movido para `apps/web/`, paths atualizados, workspaces npm configurados. Histórico anterior: refactor de estoque/purchases, redesign, ANVISA, Telegram RPCs.*
