# 🏗️ Regras de Arquitetura - Meus Remédios

> **Versão:** 2.8.1 | **Atualizado:** 2026-02-17
> Documento consolidado de padrões arquiteturais e governança técnica.

> **📚 DOCUMENTAÇÃO COMPLETA:**
> Este arquivo contém regras essenciais. Para detalhes completos, consulte:
> - **Architecture**: [`docs/ARQUITETURA.md`](../../docs/ARQUITETURA.md) *(consolidando para docs/architecture/OVERVIEW.md)*
> - **Database**: [`docs/architecture/DATABASE.md`](../../docs/architecture/DATABASE.md)
> - **CSS**: [`docs/architecture/CSS.md`](../../docs/architecture/CSS.md)
> - **Services API**: [`docs/reference/SERVICES.md`](../../docs/reference/SERVICES.md)

---

## 🎯 Visão Arquitetural

### Stack Tecnológico

| Camada | Tecnologia | Versão | Propósito |
|--------|-----------|--------|-----------|
| **Frontend** | React | 19.2.0 | UI Library (ES Modules nativo) |
| **Build Tool** | Vite | 7.2.4 | Build e Dev Server |
| **Backend** | Supabase | 2.90.1 | PostgreSQL + Auth + REST API |
| **Validação** | Zod | 4.3.6 | Runtime validation |
| **Cache** | SWR Custom | - | Stale-While-Revalidate cache |
| **Estilos** | CSS Vanilla | - | Design system customizado |
| **Testes** | Vitest | 4.0.16 | Unit testing |
| **Bot** | node-telegram-bot-api | 0.67.0 | Telegram integration |
| **Deploy** | Vercel | - | Hosting + Serverless Functions |
| **Cron** | cron-job.org | - | Free crons for Telegram bot |

### Diagrama de Arquitetura

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
               │   (Node.js + Standardized)   │
               └──────────────────────────────┘
```

---

## 🏢 Organização de Código

### Feature-Based Organization (F4.6)

```
src/
├── features/              # Domínios de negócio
│   ├── adherence/
│   │   ├── components/    # Componentes específicos do domínio
│   │   ├── hooks/         # Hooks do domínio
│   │   ├── services/      # Services específicos
│   │   └── utils/         # Utilitários do domínio
│   ├── dashboard/
│   ├── medications/
│   ├── protocols/
│   └── stock/
│
├── shared/                # Recursos compartilhados
│   ├── components/
│   │   ├── ui/           # UI atômicos (Button, Card, Modal)
│   │   ├── log/          # LogEntry, LogForm
│   │   ├── gamification/ # BadgeDisplay
│   │   ├── onboarding/   # OnboardingWizard
│   │   └── pwa/          # PushPermission
│   ├── hooks/            # Hooks customizados
│   ├── services/         # Services com cache SWR
│   ├── constants/        # Schemas Zod
│   ├── utils/            # Utilitários puros
│   └── styles/           # CSS tokens e temas
│
├── views/                 # Páginas/Views
└── [legacy folders]       # Em migração
```

### Princípios de Organização

| Princípio | Descrição | Aplicação |
|-----------|-----------|-----------|
| **Co-location** | Arquivos relacionados ficam juntos | Componente + CSS + Teste no mesmo diretório |
| **Feature-based** | Organização por domínio de negócio | `features/medications/`, `features/protocols/` |
| **Shared vs Specific** | Separar o genérico do específico | `@shared/` para reutilizáveis |
| **Path Aliases** | Imports absolutos via aliases | `@shared/`, `@features/`, etc. |

---

## 💾 Camadas da Aplicação

### 1. Presentation Layer (UI)

**Responsabilidade:** Renderização visual e interação do usuário.

```jsx
// Componente puro - sem lógica de negócio
function MedicineCard({ medicine, onEdit, onDelete }) {
  return (
    <Card className="medicine-card">
      <h3>{medicine.name}</h3>
      <Button onClick={() => onEdit(medicine)}>Editar</Button>
    </Card>
  )
}
```

**Regras:**
- Sem lógica de negócio complexa
- Props desestruturadas com defaults
- Handlers simples (delegam para services)

### 2. Business Logic Layer (Services)

**Responsabilidade:** Regras de negócio, validação e comunicação com API.

```javascript
// medicineService.js
export const medicineService = {
  async create(medicine) {
    // Validação Zod
    const validation = validateMedicineCreate(medicine)
    if (!validation.success) {
      throw new Error(`Erro de validação: ${validation.errors.map(e => e.message).join(', ')}`)
    }
    
    // Comunicação com Supabase
    const { data, error } = await supabase
      .from('medicines')
      .insert(validation.data)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}
```

**Regras:**
- SEMPRE validar com Zod antes de enviar
- Retornar dados consistentes
- Tratar erros de forma padronizada

### 3. Data Access Layer (Lib/Cache)

**Responsabilidade:** Abstração de acesso a dados e cache.

```javascript
// queryCache.js
export class QueryCache {
  constructor() {
    this.cache = new Map()
    this.pendingRequests = new Map()
  }

  async get(key, fetcher, options = {}) {
    // Stale-While-Revalidate logic
    const cached = this.cache.get(key)
    if (cached && !this.isStale(cached, options.staleTime)) {
      return cached.data
    }
    // ...
  }
}
```

**Regras:**
- Cache com TTL configurável
- Deduplicação de requests
- LRU eviction para memória

---

## 🔄 Fluxo de Dados

### Leitura com Cache SWR

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

```
1. Usuário cria medicamento
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

### Row-Level Security (RLS)

```sql
-- Exemplo de política RLS
CREATE POLICY "Users can only see their own medicines"
  ON medicines
  FOR ALL
  USING (user_id = auth.uid());
```

**Regras:**
- TODAS as tabelas devem ter RLS habilitado
- Nunca confiar em validação apenas no cliente
- Validar com Zod antes de enviar ao Supabase

### Autenticação

- JWT tokens gerenciados pelo Supabase Auth
- Refresh automático de sessão
- Sessões expiradas redirecionam para login

### Validação de Dados

| Camada | Validação | Ferramenta |
|--------|-----------|------------|
| Cliente | Form inputs | Zod schemas |
| Service | Antes de enviar | Zod schemas |
| Database | Constraints | PostgreSQL CHECK |
| API | Rate limiting | Vercel/Vercel Edge |

---

## 🚀 Pipeline de Qualidade

### Gates Obrigatórios

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUALITY GATES PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│  1. SINTAXE: node -c arquivo.js                                │
│       ↓                                                         │
│  2. LINT: npm run lint (0 erros permitidos)                    │
│       ↓                                                         │
│  3. TESTES: npm run test:critical (143 testes)                 │
│       ↓                                                         │
│  4. BUILD: npm run build (produção)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Scripts por Contexto

| Contexto | Comando | Quando Executar | Gatilho |
|----------|---------|-----------------|---------|
| **Pre-commit** | `npm run lint` | Sempre | Husky hook |
| **Pre-push** | `npm run test:critical` | Services/schemas/hooks | Husky hook |
| **Pre-PR** | `npm run validate` | Antes de abrir PR | Manual |
| **CI/CD** | `npm run test:full` | Todos os merges | GitHub Actions |

### Test Command Matrix

| Tipo de Arquivo | Comando Recomendado | Testes |
|-----------------|---------------------|--------|
| Service API | `npm run test:critical` | 143 testes |
| Schema/Validação | `npm run test:critical` | 143 testes |
| Hook reutilizável | `npm run test:critical` | 143 testes |
| Utilitário | `npm run test:light` | ~100 testes |
| Componente UI | `npx vitest --config vitest.component.config.js` | Isolados |
| CSS/Assets | `npm run test:smoke` ou nenhum | 7 testes |

---

## 🌳 Git Workflow (RIGID PROCESS)

> **⚠️ MANDATORY:** All code/doc changes MUST follow this workflow. NO direct commits to `main`.

### Complete Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GITHUB WORKFLOW (MANDATORY)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CREATE BRANCH                                                           │
│     git checkout main && git pull origin main                               │
│     git checkout -b feature/wave-X/nome-descritivo                          │
│                                                                             │
│  2. MAKE CHANGES                                                            │
│     • Edit files                                                            │
│     • Follow code standards (.roo/rules-code/rules.md)                      │
│     • Follow architecture (.roo/rules-architecture/rules.md)                │
│                                                                             │
│  3. VALIDATE LOCALLY                                                        │
│     npm run lint          # ESLint - 0 errors                               │
│     npm run test:critical # 143 tests passing                               │
│     npm run build         # Production build OK                             │
│                                                                             │
│  4. COMMIT (Atomic/Semantic)                                                │
│     git add <files>                                                         │
│     git commit -m "type(scope): description in portuguese"                  │
│                                                                             │
│  5. PUSH BRANCH                                                             │
│     git push origin feature/wave-X/nome-descritivo                          │
│                                                                             │
│  6. CREATE PULL REQUEST                                                     │
│     • Use template: docs/PULL_REQUEST_TEMPLATE.md                           │
│     • Fill all sections                                                     │
│     • Assign reviewers                                                      │
│     • Link related issues                                                   │
│                                                                             │
│  7. WAIT FOR REVIEW                                                         │
│     • Address comments promptly                                             │
│     • Make requested changes                                                │
│     • Re-request review after changes                                       │
│                                                                             │
│  8. MERGE & CLEANUP                                                         │
│     • Merge via --no-ff (Create a merge commit)                            │
│     • Delete branch after merge                                             │
│     • git branch -d feature/wave-X/nome-descritivo                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Commands

#### Step 1: Create Branch (MANDATORY)

```bash
# NEVER work on main directly!
git checkout main
git pull origin main
git checkout -b feature/wave-X/nome-descritivo

# Naming conventions:
#   feature/wave-X/name   - New features
#   fix/wave-X/name       - Bug fixes
#   docs/wave-X/name      - Documentation
#   hotfix/name           - Critical production fixes
```

#### Step 2: Make Changes

- Follow all coding standards in `.roo/rules-code/rules.md`
- Follow architecture guidelines in `.roo/rules-architecture/rules.md`
- Make focused, atomic changes

#### Step 3: Validate Locally (MANDATORY)

```bash
# ALL THREE must pass before commit:
npm run lint          # ESLint - must be 0 errors
npm run test:critical # 143 tests must pass
npm run build         # Build must succeed

# Quick validation:
npm run validate      # Runs lint + test:critical
```

**If validation fails:**
- Fix all errors before proceeding
- Do NOT commit with `--no-verify`
- Do NOT skip tests

#### Step 4: Commit (Atomic/Semantic)

```bash
# Stage files
git add src/components/MyComponent.jsx
git add src/components/MyComponent.css

# Commit with semantic message (in Portuguese)
git commit -m "feat(component): adicionar botão de ação rápida"

# Or with description:
git commit -m "fix(service): corrigir cálculo de estoque" \
           -m "O cálculo anterior não considerava unidades fracionadas."
```

**Commit Types:**
| Type | Use When | Example |
|------|----------|---------|
| `feat` | New feature | `feat(widget): adicionar score de adesão` |
| `fix` | Bug fix | `fix(bot): corrigir escape de markdown` |
| `docs` | Documentation | `docs(readme): atualizar instruções` |
| `test` | Tests only | `test(service): adicionar testes de adesão` |
| `refactor` | Code refactoring | `refac(hook): otimizar useCachedQuery` |
| `style` | Formatting only | `style(lint): corrigir erros de lint` |
| `chore` | Maintenance | `chore(deps): atualizar dependências` |

#### Step 5: Push Branch

```bash
# Push to remote
git push origin feature/wave-X/nome-descritivo
```

#### Step 6: Create Pull Request (MANDATORY)

**Using GitHub CLI:**
```bash
gh pr create --title "feat: descrição resumida" \
             --body-file docs/PULL_REQUEST_TEMPLATE.md
```

**Using GitHub Web:**
1. Go to https://github.com/coelhotv/meus-remedios/pulls
2. Click "New Pull Request"
3. Select your branch
4. **Use the template:** Copy from `docs/PULL_REQUEST_TEMPLATE.md`
5. Fill ALL sections:
   - Summary
   - Tasks implemented
   - Metrics (if applicable)
   - Files changed
   - Checklist
   - Testing instructions
6. Assign reviewers
7. Link related issues

#### Step 7: Wait for Review

**DO:**
- Respond to comments promptly
- Make requested changes
- Explain your reasoning if you disagree
- Re-request review after changes

**DON'T:**
- Merge without approval
- Ignore review comments
- Make unrelated changes during review

#### Step 8: Merge & Cleanup

```bash
# After PR is approved:

# 1. Merge on GitHub (use "Create a merge commit" / --no-ff)

# 2. Pull main locally
git checkout main
git pull origin main

# 3. Delete local branch
git branch -d feature/wave-X/nome-descritivo

# 4. Delete remote branch (if not auto-deleted)
git push origin --delete feature/wave-X/nome-descritivo
```

### Anti-Patterns (PROHIBITED)

| Anti-Pattern | Consequence | Prevention |
|--------------|-------------|------------|
| Commit directly to `main` | Unreviewed code in production | Always create branch first |
| Skip local validation | Broken builds in CI | Run `npm run validate` before push |
| Push without PR | No code review | Always create PR |
| Use `--no-verify` | Skip quality gates | Never use except emergencies |
| Merge own PR without review | No quality assurance | Wait for reviewer approval |
| Keep branches after merge | Repository clutter | Delete branch immediately after merge |

### Emergency Procedures

If you MUST bypass hooks (emergency only):

```bash
# ⚠️ USE WITH EXTREME CAUTION - Requires human approval
git commit --no-verify -m "hotfix: correção crítica de segurança"
git push --no-verify
```

**Requirements for emergency bypass:**
1. Immediate production impact
2. Human approval documented
3. Post-incident review scheduled


### Nomenclatura de Branches

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Feature | `feature/wave-X/nome-da-feature` | `feature/wave-2/adherence-widget` |
| Fix | `fix/wave-X/nome-do-fix` | `fix/wave-2/login-error` |
| Hotfix | `hotfix/nome-do-hotfix` | `hotfix/critical-security-fix` |
| Docs | `docs/wave-X/nome-da-doc` | `docs/wave-2/update-readme` |

### Commits Semânticos

```
<type>(<scope>): <subject>

<corpo opcional>

<footer opcional>
```

| Type | Quando Usar | Exemplo |
|------|-------------|---------|
| `feat` | Nova funcionalidade | `feat(widget): adicionar score de adesão` |
| `fix` | Correção de bug | `fix(bot): corrigir escape de markdown` |
| `docs` | Documentação | `docs(readme): atualizar instruções` |
| `test` | Testes | `test(service): adicionar testes de adesão` |
| `refactor` | Refatoração | `refac(hook): otimizar useCachedQuery` |
| `style` | Formatação | `style(lint): corrigir erros de lint` |
| `chore` | Manutenção | `chore(deps): atualizar dependências` |

---

## 📱 PWA Architecture

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

### Cache Strategies

| Asset Type | Strategy | TTL |
|------------|----------|-----|
| JS/CSS/Images | CacheFirst | 30 dias |
| Supabase API | StaleWhileRevalidate | 5 min |
| Write Operations | NetworkOnly | - |

### Analytics (Privacy-First)

```javascript
// analyticsService.js - F4.4
analyticsService.track('pwa_installed')
analyticsService.track('push_opted_in', { source: 'settings_page' })
```

**Características:**
- Sem PII (no email, name, userId, phone, CPF)
- localStorage apenas
- User agent truncado (primeira palavra)
- Event IDs anônimos (randomUUID)

---

## 🤖 Multi-Agent Architecture

### Hierarquia de Agentes

```
┌─────────────────────────────────────────┐
│    ORQUESTRADOR CENTRAL                 │
│    (Autorização e Coordenação)          │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┼─────────┐
    ↓         ↓         ↓
┌───────┐ ┌───────┐ ┌───────┐
│Backend│ │Frontend│ │Infra  │
│ Agent │ │ Agent  │ │ Agent │
└───┬───┘ └───┬───┘ └───┬───┘
    │         │         │
    ↓         ↓         ↓
Subagentes Subagentes Subagentes
```

### Responsabilidades por Agente

| Agente | Responsabilidade | Diretórios |
|--------|------------------|------------|
| **Backend** | Camada de dados, persistência, segurança | `.migrations/`, `src/services/api/`, `src/schemas/` |
| **Frontend** | UI/UX React, componentes, hooks | `src/components/`, `src/hooks/`, `src/views/` |
| **Infra** | Deploy, configurações, variáveis de ambiente | `.env*`, `vercel.json`, `api/` |
| **Qualidade** | Testes, cobertura, linting | `*.test.jsx`, `eslint.config.js` |
| **Documentação** | Documentação técnica, READMEs | `docs/`, `README.md` |

---

## 📊 Performance Guidelines

### Estratégias

| Estratégia | Implementação | Impacto |
|------------|---------------|---------|
| **Cache SWR** | `queryCache.js` | 95% mais rápido em re-leituras |
| **View Materializada** | `medicine_stock_summary` | 5x mais rápido consultas estoque |
| **Deduplicação** | `pendingRequests` Map | Evita requests duplicados |
| **LRU Eviction** | 50 entradas máximo | Previne memory leaks |
| **React 19** | Compiler otimizado | Menos re-renders |

### Métricas de Referência

| Métrica | Mínimo | Ideal |
|---------|--------|-------|
| **Lint errors** | 0 | 0 |
| **Test coverage** | 70% | 85% |
| **Build time** | < 30s | < 20s |
| **Testes críticos** | 100% passando | 100% passando |
| **PR review time** | < 24h | < 4h |

---

## ✅ Checklist de Code Review

Antes de aprovar qualquer PR, verificar:

- [ ] **Lint passando** - `npm run lint` sem erros
- [ ] **Testes críticos passando** - `npm run test:critical` ok
- [ ] **Build passando** - `npm run build` sem erros
- [ ] **Sem `console.log` de debug** - Apenas logs necessários
- [ ] **Sem código comentado** - Remover código morto
- [ ] **Documentação atualizada** - Se houver mudanças de API
- [ ] **Padrões de nomenclatura** - PascalCase, camelCase, etc.
- [ ] **Validação Zod aplicada** - Todos os inputs validados
- [ ] **Cache invalidado** - Após mutations em cachedServices
- [ ] **RLS considerado** - Novas tabelas com políticas

---

## 📚 Documentação Relacionada

- [ARQUITETURA.md](../../docs/ARQUITETURA.md) - Visão técnica completa
- [ARQUITETURA_FRAMEWORK.md](../../docs/ARQUITETURA_FRAMEWORK.md) - Governança multiagente
- [PADROES_CODIGO.md](../../docs/PADROES_CODIGO.md) - Convenções de código
- [API_SERVICES.md](../../docs/API_SERVICES.md) - Documentação de services
- [TESTING_GUIDE.md](../../docs/TESTING_GUIDE.md) - Guia de testes
- [OTIMIZACAO_TESTES_ESTRATEGIA.md](../../docs/OTIMIZACAO_TESTES_ESTRATEGIA.md) - Estratégia de testes

---

*Última atualização: 13/02/2026 | v2.8.0*
