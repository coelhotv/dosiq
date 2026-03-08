# 🏗️ Arquitetura do Meus Remédios

**Versão:** 2.8.0
**Data:** 2026-02-13
**Status:** Ativo (Phase 4: PWA + Feature Organization)

Visão geral da arquitetura técnica do projeto, padrões de design e fluxo de dados.

> **⚠️ AUTORIDADE:** Este documento deve ser usado em conjunto com:
> - **[`.roo/rules-code/rules.md`](../.roo/rules-code/rules.md)** - Regras consolidadas de código para agentes
> - **[`.roo/rules-architecture/rules.md`](../.roo/rules-architecture/rules.md)** - Governança arquitetural
> - **[`PADROES_CODIGO.md`](./PADROES_CODIGO.md)** - Convenções de código detalhadas
> - **[`AGENTS.md`](../AGENTS.md)** - Guia completo para agentes

---

## 📚 Referências Rápidas

| Documento | Conteúdo | Público |
|-----------|----------|---------|
| [`.roo/rules-code/rules.md`](../.roo/rules-code/rules.md) | Padrões de código, nomenclatura, React, Zod | Agentes de código |
| [`.roo/rules-architecture/rules.md`](../.roo/rules-architecture/rules.md) | Arquitetura, organização, fluxo de dados | Agentes de arquitetura |
| [`AGENTS.md`](../AGENTS.md) | Guia completo do projeto | Todos os agentes |
| [`PADROES_CODIGO.md`](./PADROES_CODIGO.md) | Convenções detalhadas de código | Desenvolvedores |

---

## 📊 Visão Arquitetural (v2.8.0)

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

### Novidades da v2.8.0 (Phase 4)

| Feature | Componente | Descrição |
|---------|------------|-----------|
| **F4.1** | Hash Router | Navegação SPA com 9 rotas e deep linking |
| **F4.2** | PWA Layer | Service Worker, manifest, install prompt |
| **F4.3** | Push Manager | Notificações push com VAPID |
| **F4.4** | Analytics | Tracking privacy-first em localStorage |
| **F4.5** | Bot Standardized | Utilities com 49 testes |
| **F4.6** | Feature Org | `src/features/` + `src/shared/` + path aliases |
| **F4.7** | **Bot Resilient v3.0** | Sistema de notificações com retry/DLQ/métricas |

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
src/
├── features/              # 🆕 NOVO: Organização por domínio (F4.6)
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
├── shared/                # 🆕 NOVO: Recursos compartilhados (F4.6)
│   ├── components/
│   │   ├── ui/            # Button, Card, Modal, Loading, AlertList
│   │   ├── log/           # LogEntry, LogForm
│   │   ├── gamification/  # BadgeDisplay, MilestoneCelebration
│   │   ├── onboarding/    # OnboardingWizard, FirstMedicineStep, etc
│   │   └── pwa/           # 🆕 PushPermission, InstallPrompt (F4.2/F4.3)
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
// vite.config.js
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

### 2. **Business Logic Layer** (Services) - v2.8.0

```
src/shared/services/
├── cachedServices.js        # Wrappers SWR com invalidação automática
├── api/
│   ├── medicineService.js
│   ├── protocolService.js
│   ├── stockService.js
│   ├── logService.js
│   ├── treatmentPlanService.js
│   └── index.js
└── analyticsService.js      # 🆕 Analytics privacy-first (F4.4)

// Feature-specific services
src/features/{domain}/services/
├── adherenceService.js
└── ...
```

### 3. **Data Access Layer** (Lib/Cache)

Responsabilidade: Abstração de acesso a dados e cache.

```
src/shared/utils/
├── supabase.js       # Cliente Supabase configurado
└── queryCache.js     # Implementação SWR

src/shared/hooks/
└── useCachedQuery.js # Hook React para cache

src/shared/constants/
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

src/shared/components/pwa/
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

## 🧪 Testes (v2.8.0)

```
Testes Unitários (Vitest)
├── src/shared/lib/__tests__/        # Cache SWR
├── src/shared/constants/__tests__/  # Validação Zod (23 testes)
├── src/shared/services/__tests__/   # Services
├── src/features/**/__tests__/       # Feature tests
└── src/shared/components/**/__tests__/ # Componentes

Cobertura: 140+ testes
├── 93 testes críticos
├── 11 smoke tests
└── 36+ component tests
```

### Test Command Matrix

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `npm run test:critical` | Testes essenciais (services, utils, schemas) | Pre-push |
| `npm run test:smoke` | Suite mínima | Health check |
| `npm run test:changed` | Arquivos modificados desde main | CI/CD rápido |
| `npm run test:git` | Alias para test:changed | Compatibilidade |
| `npm run test:light` | Configuração leve (exclui componentes) | Dev rápido |
| `npm run validate` | Lint + testes críticos | Pre-commit |

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
> **Authoridade:** Veja também [`.roo/rules-code/rules.md`](../.roo/rules-code/rules.md) e [`.roo/rules-architecture/rules.md`](../.roo/rules-architecture/rules.md)

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

# BEFORE COMMIT:
npm run validate  # Lint + testes críticos

# AFTER PUSH:
# 1. Create PR using template: docs/PULL_REQUEST_TEMPLATE.md
# 2. Wait for review
# 3. Merge with --no-ff
# 4. Delete branch
```

### Detailed Instructions

See full workflow in [`AGENTS.md`](../AGENTS.md) or [`.roo/rules-code/rules.md`](../.roo/rules-code/rules.md).

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

- **[`.roo/rules-code/rules.md`](../.roo/rules-code/rules.md)** - Regras consolidadas de código (agentes)
- **[`.roo/rules-architecture/rules.md`](../.roo/rules-architecture/rules.md)** - Governança arquitetural (agentes)
- **[`AGENTS.md`](../AGENTS.md)** - Guia completo para agentes
- **[`PADROES_CODIGO.md`](./PADROES_CODIGO.md)** - Convenções detalhadas incluindo padrões de componentes consolidados

### Documentação Técnica

- [ARQUITETURA_FRAMEWORK.md](./archive/ARQUITETURA_FRAMEWORK.md) - Framework arquitetural completo
- [SERVICES.md](./reference/SERVICES.md) - Documentação das APIs
- [LINT_COVERAGE.md](./archive/LINT_COVERAGE.md) - Configurações ESLint e boas práticas
- [OTIMIZACAO_TESTES_ESTRATEGIA.md](./archive/OTIMIZACAO_TESTES_ESTRATEGIA.md) - Estratégia completa de testes
- [HOOKS.md](./reference/HOOKS.md) - Hooks customizados

### Templates

- [PULL_REQUEST_TEMPLATE.md](./PULL_REQUEST_TEMPLATE.md) - Template obrigatório para PRs

### Documentação Histórica

- [DECISOES_TECNICAS.md](./archive/past_deliveries/DECISOES_TECNICAS_ONDA_1.md) - Por que escolhemos cada tech
- [SCHEMAS_VALIDACAO.md](./archive/past_deliveries/SCHEMAS_VALIDACAO.md) - Validação Zod
- [CONSOLIDACAO_COMPONENTES_FINAL.md](./archive/past_deliveries/CONSOLIDACAO_COMPONENTES_FINAL.md) - Documentação técnica da consolidação de componentes
- [CONSOLIDACAO_COMPONENTES_PLANO.md](../plans/archive_old/roadmap_v3/CONSOLIDACAO_COMPONENTES_PLANO.md) - Blueprint da consolidação

---

*Última atualização: 13/02/2026 - Atualizado com rigid GitHub workflow e referências aos arquivos de regras consolidadas*
