# Meus Remédios - AI Agent Guide

> **Aplicativo de gerenciamento de medicamentos em português brasileiro**  
> Versão: 2.6.0 | React 19 + Vite + Supabase

---

## 📋 Project Overview

**Meus Remédios** is a comprehensive medication management application that only uses free tier services, featuring:

- **Multi-user authentication** via Supabase Auth with Row-Level Security (RLS)
- **Treatment protocols** with complex scheduling and dose titration support
- **Stock management** with automatic tracking and alerts
- **Telegram Bot integration** for reminders and conversational interactions
- **Dashboard** with insights, adherence tracking, and gamification
- **Onboarding wizard** (4 steps) for new users

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (BROWSER)                              │
│                        React 19 + Vite (SPA)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐ │
│  │   Views     │  │ Components  │  │   Services Layer (Zod + SWR Cache)  │ │
│  │  (Pages)    │  │  (UI/Forms) │  │   ├─ medicineService.js             │ │
│  └─────────────┘  └─────────────┘  │   ├─ protocolService.js             │ │
│                                    │   ├─ stockService.js                │ │
│                                    │   └─ logService.js                  │ │
│                                    └─────────────────┬───────────────────┘ │
│                                                      │                      │
│                                           ┌──────────▼──────────┐          │
│                                           │   Supabase Client   │          │
│                                           └──────────┬──────────┘          │
└──────────────────────────────────────────────────────┼──────────────────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    │                  │                  │
                              ┌─────▼─────┐     ┌─────▼─────┐     ┌──────▼──────┐
                              │  VERCEL   │     │  VERCEL   │     │  TELEGRAM   │
                              │  STATIC   │     │   API     │     │    BOT      │
                              │  (SPA)    │     │ (Webhooks)│     │ (Node.js)   │
                              └───────────┘     └─────┬─────┘     └─────────────┘
                                                      │
                                               ┌──────▼───────┐
                                               │  SUPABASE    │
                                               │ ┌──────────┐ │
                                               │ │PostgreSQL│ │
                                               │ │  + RLS   │ │
                                               │ └──────────┘ │
                                               │ ┌──────────┐ │
                                               │ │  Auth    │ │
                                               │ └──────────┘ │
                                               └──────────────┘
```

---

## 🏗️ Technology Stack

### Core Technologies

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

### Key Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.90.1",
    "framer-motion": "^12.33.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zod": "^4.3.6"
  }
}
```

---

## 📁 Project Structure

```
meus-remedios/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes atômicos (Button, Card, Modal, Loading)
│   │   ├── medicine/        # Domínio: Medicamentos (MedicineCard, MedicineForm)
│   │   ├── protocol/        # Domínio: Protocolos (ProtocolCard, ProtocolForm, TitrationWizard)
│   │   ├── stock/           # Domínio: Estoque (StockCard, StockForm, StockIndicator)
│   │   ├── log/             # Domínio: Registros (LogEntry, LogForm)
│   │   ├── dashboard/       # Domínio: Dashboard (InsightCard, HealthScoreCard, etc)
│   │   ├── adherence/       # Domínio: Adesão (AdherenceWidget, StreakBadge)
│   │   ├── onboarding/      # Wizard de primeiros passos (4 steps)
│   │   └── animations/      # Efeitos visuais (Confetti, Pulse, Shake)
│   ├── hooks/
│   │   ├── useCachedQuery.js    # Hook SWR para cache de queries
│   │   ├── useDashboardContext.jsx
│   │   ├── useInsights.js
│   │   └── useAdherenceTrend.js
│   ├── lib/
│   │   ├── supabase.js      # Cliente Supabase configurado
│   │   └── queryCache.js    # Implementação SWR customizada
│   ├── schemas/             # Validação Zod (23+ testes)
│   │   ├── index.js         # Exportações centralizadas
│   │   ├── medicineSchema.js
│   │   ├── protocolSchema.js
│   │   ├── stockSchema.js
│   │   ├── logSchema.js
│   │   └── validationHelper.js
│   ├── services/
│   │   ├── api/             # Serviços da API
│   │   │   ├── cachedServices.js   # Wrappers com cache SWR
│   │   │   ├── medicineService.js
│   │   │   ├── protocolService.js
│   │   │   ├── stockService.js
│   │   │   ├── logService.js
│   │   │   ├── treatmentPlanService.js
│   │   │   ├── adherenceService.js
│   │   │   └── titrationService.js
│   │   ├── api.js           # Exportações principais
│   │   ├── insightService.js
│   │   ├── analyticsService.js
│   │   ├── milestoneService.js
│   │   └── paginationService.js
│   ├── utils/
│   │   ├── adherenceLogic.js
│   │   └── titrationUtils.js
│   ├── styles/
│   │   ├── tokens.css       # Design tokens (cores, espaçamentos)
│   │   └── index.css        # Estilos globais
│   ├── views/               # Páginas principais
│   │   ├── Auth.jsx
│   │   ├── Dashboard.jsx
│   │   ├── History.jsx
│   │   ├── Landing.jsx
│   │   ├── Medicines.jsx
│   │   ├── Protocols.jsx
│   │   ├── Settings.jsx
│   │   └── Stock.jsx
│   ├── App.jsx              # Componente principal com roteamento
│   ├── main.jsx             # Entry point
│   └── test/
│       └── setup.js         # Configuração Vitest
├── server/                  # Bot do Telegram (Node.js independente)
│   ├── bot/
│   │   ├── commands/        # Comandos Telegram (/start, /hoje, /registrar, etc)
│   │   ├── callbacks/       # Handlers de callback queries
│   │   ├── middleware/      # Middlewares (auth, logging)
│   │   ├── alerts.js        # Sistema de alertas inteligentes
│   │   ├── scheduler.js     # Agendador de tarefas
│   │   ├── tasks.js         # Tarefas do cron
│   │   ├── logger.js        # Logger estruturado
│   │   └── health-check.js  # Health checks
│   ├── services/
│   │   └── supabase.js      # Cliente Supabase para o bot
│   └── index.js             # Entry point do bot
├── api/                     # Serverless Functions (Vercel)
│   ├── telegram.js          # Webhook para bot (POST)
│   └── notify.js            # Cron job endpoint (GET/POST)
├── .migrations/             # Migrações SQL
│   └── *.sql
├── docs/                    # Documentação técnica
│   ├── ARQUITETURA.md
│   ├── PADROES_CODIGO.md
│   ├── API_SERVICES.md
│   ├── HOOKS.md
│   └── ...
├── package.json
├── vite.config.js
├── vitest.config.js         # Configurações múltiplas de teste
├── eslint.config.js
└── vercel.json              # Configuração de rotas Vercel
```

---

## 🚀 Build and Development Commands

### Development

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento (Vite)
npm run dev
# Acesse: http://localhost:5173

# Iniciar bot do Telegram localmente (em outro terminal)
npm run bot
# ou: cd server && npm run dev
```

### Build and Deploy

```bash
# Build de produção
npm run build

# Preview do build local
npm run preview

# Deploy na Vercel
vercel --prod
```

### Linting

```bash
# ESLint - verificação de código
npm run lint
```

---

## 🧪 Testing Commands

O projeto possui 110+ testes unitários com Vitest e múltiplas configurações otimizadas:

### Testes Base

```bash
# Todos os testes (CI/CD completo)
npm run test

# Modo watch para desenvolvimento
npm run test:watch
```

### Testes Otimizados (Fase 1)

```bash
# Apenas arquivos modificados desde main
npm run test:changed

# Testes relacionados aos arquivos staged
npm run test:related

# Testes críticos (services, utils, schemas, hooks)
npm run test:critical

# Exclui testes de integração
npm run test:unit

# Saída resumida (30 primeiras linhas)
npm run test:quick
```

### Testes Fase 2 (Seleção Inteligente)

```bash
# Script customizado baseado em git diff
npm run test:smart

# Alias para test:changed
npm run test:git

# Alias para test:related
npm run test:affected

# Suite mínima de smoke tests
npm run test:smoke

# Configuração light de testes
npm run test:light
```

### Validação Completa

```bash
# Lint + testes críticos (pre-push)
npm run validate

# Lint + testes relacionados (pre-commit rápido)
npm run validate:quick
```

### Configurações de Teste

| Arquivo | Propósito |
|---------|-----------|
| `vitest.config.js` | Configuração padrão (threads otimizadas) |
| `vitest.critical.config.js` | Apenas testes essenciais (exclui UI) |
| `vitest.smoke.config.js` | Suite mínima para health check |
| `vitest.light.config.js` | Configuração leve para desenvolvimento rápido |

---

## 🎨 Code Style Guidelines

### Nomenclatura Obrigatória

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Componentes | PascalCase | `MedicineCard.jsx` |
| Funções/Variáveis | camelCase | `calculateAdherence`, `medicineName` |
| Constantes | SCREAMING_SNAKE | `CACHE_STALE_TIME`, `MAX_RETRIES` |
| Arquivos | kebab-case ou PascalCase | `medicine-service.js`, `MedicineCard.jsx` |
| Hooks | use + PascalCase | `useCachedQuery`, `useDashboardContext` |
| Branches | kebab-case | `feature/wave-2/fix-login` |

### Idiomas

| Contexto | Idioma | Exemplo |
|----------|--------|---------|
| Código (variáveis, funções) | Inglês | `const medicineName = ''` |
| Mensagens de erro | Português | `'Nome é obrigatório'` |
| UI (labels, botões) | Português | `Salvar Medicamento` |
| Documentação | Português | Este arquivo |
| Commits | Português | `feat: adiciona validação Zod` |
| Nomes de arquivos | Inglês | `medicineService.js` |
| Tabelas/Colunas DB | Português | `medicamentos.nome` |

### Estrutura de Imports

```jsx
// 1. React e bibliotecas externas
import { useState, useEffect } from 'react'
import { z } from 'zod'

// 2. Componentes internos
import Button from '../ui/Button'
import Card from '../ui/Card'

// 3. Hooks e utils
import { useCachedQuery } from '../../hooks/useCachedQuery'
import { formatDate } from '../../utils/date'

// 4. Services e schemas
import { medicineService } from '../../services/api/medicineService'
import { validateMedicine } from '../../schemas/medicineSchema'

// 5. CSS (sempre por último)
import './MedicineForm.css'
```

### Regras de Validação Zod (Obrigatório)

Todo service DEVE validar dados com Zod antes de enviar ao Supabase:

```javascript
// medicineService.js
import { validateMedicineCreate } from '../schemas/medicineSchema'

export const medicineService = {
  async create(medicine) {
    // ✅ SEMPRE validar antes de enviar
    const validation = validateMedicineCreate(medicine)
    if (!validation.success) {
      throw new Error(`Erro de validação: ${validation.errors.map(e => e.message).join(', ')}`)
    }
    
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

### Cache SWR (Obrigatório para Leituras)

```javascript
// ✅ SEMPRE usar cachedServices para leituras
import { cachedMedicineService } from '../services/api/cachedServices'

// Em componentes:
const { data, isLoading } = useCachedQuery(
  'medicines',
  () => cachedMedicineService.getAll(),
  { staleTime: 30000 }
)

// ✅ Invalidar cache após mutations
async function handleCreate(medicine) {
  await cachedMedicineService.create(medicine)
  // Cache é invalidado automaticamente no service
}
```

---

## 🔄 Git Workflow

### ⚠️ NUNCA commite diretamente na `main`

```bash
# 1. Criar branch ANTES de alterações
git checkout main
git pull origin main
git checkout -b feature/wave-X/nome-descritivo

# 2. Desenvolver com commits semânticos

# 3. Validar localmente
npm run lint
npm run test:critical
npm run build

# 4. Criar PR para main

# 5. Aguardar review

# 6. Merge via --no-ff apenas
```

---

## 🛡️ Security Considerations

### Autenticação
- JWT tokens gerenciados pelo Supabase Auth
- Refresh automático de sessão
- RLS (Row Level Security) em todas as tabelas

### Autorização (RLS)
```sql
-- Exemplo de política RLS
CREATE POLICY "Users can only see their own medicines"
  ON medicines
  FOR ALL
  USING (user_id = auth.uid());
```

### Variáveis de Ambiente

Arquivo `.env` obrigatório:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-aqui

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=seu-token-do-botfather

# External Cron Secret (for cron-job.org)
CRON_SECRET=chave-secreta-aleatoria
```

⚠️ **NUNCA** commite o arquivo `.env` - já está no `.gitignore`.

### Validação de Dados
- **Zod Schemas:** Validação runtime em todos os services
- **Nenhum dado** chega ao backend sem validação
- Mensagens de erro em português

---

## 📚 Key Documentation

### Documentação Técnica (docs/)

| Arquivo | Conteúdo |
|---------|----------|
| `ARQUITETURA.md` | Visão arquitetural completa e fluxo de dados |
| `PADROES_CODIGO.md` | Convenções detalhadas de código e anti-patterns |
| `API_SERVICES.md` | Documentação das APIs internas dos services |
| `HOOKS.md` | Documentação dos hooks customizados |
| `SETUP.md` | Guia completo de configuração do ambiente |
| `QUICKSTART.md` | Início rápido para desenvolvedores |
| `database-schema.md` | Esquema completo do banco de dados |

### Documentação de Funcionalidades

| Arquivo | Conteúdo |
|---------|----------|
| `GUIA_TITULACAO.md` | Tutorial de protocolos em titulação |
| `TRANSICAO_AUTOMATICA.md` | Sistema de transição automática de doses |
| `user-guide.md` | Guia do usuário final |

---

## 🔧 Development Tips

### Fluxo de Dados com Cache SWR

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

### Estratégias de Performance

| Estratégia | Implementação | Impacto |
|------------|---------------|---------|
| Cache SWR | `queryCache.js` | 95% mais rápido em re-leituras |
| View Materializada | `medicine_stock_summary` | 5x mais rápido consultas estoque |
| Deduplicação | `pendingRequests` Map | Evita requests duplicados |
| LRU Eviction | 50 entradas máximo | Previne memory leaks |
| React 19 | Compiler otimizado | Menos re-renders |

### Onboarding Flow

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

---

## 🚨 Common Issues

### ESLint e React Refresh
- **Problema:** Fast Refresh quebrado
- **Causa:** Exportar componentes e hooks do mesmo arquivo
- **Solução:** Separar em arquivos dedicados

### Cache SWR
- **Problema:** Dados desatualizados após mutation
- **Causa:** Esquecer de invalidar cache
- **Solução:** Usar sempre `cachedServices` que invalidam automaticamente

### Supabase RLS
- **Problema:** "Nenhum dado retornado"
- **Causa:** Política RLS bloqueando acesso
- **Solução:** Verificar se usuário está autenticado e políticas estão corretas

### Bot Telegram
- **Problema:** Bot não responde no webhook
- **Causa:** Token inválido ou webhook não configurado
- **Solução:** Verificar `TELEGRAM_BOT_TOKEN` e configurar webhook apontando para `/api/telegram`

---

## 📞 Resources

- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vitejs.dev/guide/
- **Vitest Docs:** https://vitest.dev/
- **Zod Docs:** https://zod.dev/
- **Telegram Bot API:** https://core.telegram.org/bots/api

---

*Última atualização: 11/02/2026*  
*Versão do projeto: 2.6.0*
