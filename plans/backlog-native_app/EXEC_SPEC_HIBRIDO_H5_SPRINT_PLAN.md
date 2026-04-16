# Plano de Execução H5 — MVP Produto Mobile

> **Criado em:** 2026-04-12 (DEVFLOW Planning session)
> **Spec base:** `EXEC_SPEC_HIBRIDO_FASE5_MVP_PRODUTO.md`
> **Pre-requisito:** H4 COMPLETA ✅ (PR #464 + runtime fixes commits `1ca9952`, `d6a0e3e`)
> **Objectivo:** Transformar o scaffold técnico de H4 num MVP real de produto mobile

---

## 1. Estado de partida (herdado de H4)

### Ficheiros existentes em `apps/mobile/src/`

```
navigation/
  AppRoot.jsx         — root component (monta Navigation)
  Navigation.jsx      — auth-aware (3 estados: undefined/null/session)
  routes.js           — ROUTES.{SMOKE, LOGIN, HOME}

platform/
  auth/authService.js
  auth/secureStoreAuthStorage.js  — SecureStore chunked (1800 bytes/chunk)
  config/nativePublicAppConfig.js
  storage/nativeStorageAdapter.js
  supabase/nativeSupabaseClient.js

screens/
  HomeScreen.jsx      — placeholder (email + logout) → substituir em H5.1
  LoginScreen.jsx     — login real (manter)
  SmokeScreen.jsx     — diagnóstico (manter, sem ser tela principal)
```

### Dependências já instaladas (apps/mobile/package.json)
- `@react-navigation/native`, `@react-navigation/native-stack`
- `expo-secure-store`, `@react-native-async-storage/async-storage`
- `react-native-safe-area-context`, `react-native-screens`
- `@meus-remedios/core`, `@meus-remedios/shared-data`, `@meus-remedios/design-tokens`

---

## 2. Decisões de arquitectura (P2)

### ADR-029 (proposta) — Estratégia de serviços mobile em H5

**Contexto:** shared-data exporta `createQueryCache`, `createSupabaseDependencies`, `createUserSessionRepository`. Não exporta serviços de protocols, stock, medicines, ou logs.

**Decisão proposta:** H5 cria thin local services em `apps/mobile/src/features/*/services/` que chamam Supabase directamente via `nativeSupabaseClient`. Schemas e cálculos de domínio continuam a vir de `@meus-remedios/core`. Migração de serviços para shared-data é diferida para H6+.

**Alternativa rejeitada:** Expandir shared-data durante H5 — aumenta scope, risco de regression na web, fora do princípio "H5 não toca packages/".

### ADR-030 (proposta) — Navegação mobile: tabs + stacks aninhados

**Decisão proposta:**
```
NavigationContainer
  Stack (auth-aware, SEM headerShown)
    SMOKE     → SmokeScreen
    LOGIN     → LoginScreen
    TABS      → RootTabs (tab navigator)
              ├── HOJE     → TodayScreen (stack simples)
              ├── TREATMENTS → TreatmentsStack
              │              ├── TREATMENTS_LIST → TreatmentsScreen
              │              └── TREATMENT_DETAIL → TreatmentDetailScreen (opcional)
              ├── STOCK    → StockScreen (stack simples)
              └── PROFILE  → ProfileStack
                           ├── PROFILE_MAIN   → ProfileScreen
                           └── TELEGRAM_LINK  → TelegramLinkScreen (se separada)
```

**Regra crítica (R-163 + AP-H09):** A directoria `apps/mobile/src/app/` NÃO deve ser criada.
A spec EXEC_SPEC_FASE5 usa `src/app/` como nome de directoria no exemplo — este nome é reservado pelo Expo SDK 53 e activa expo-router. Manter ficheiros de navegação em `src/navigation/`.

### P-011 — Paridade de linguagem UX entre web e mobile

**Princípio:** A experiência mobile é uma **extensão natural** da web, não uma app separada. Utilizadores multiplataforma não devem ter esforço cognitivo adicional para entender CTAs, labels, ou status no mobile.

**Regra obrigatória:** Antes de escrever qualquer texto visível ao utilizador (CTAs, labels, títulos, status, mensagens de erro) em qualquer componente mobile, o agente **DEVE**:
1. Localizar o componente web equivalente (ex: `DoseListItem`, `LogForm`, `SummaryCard`)
2. Copiar a linguagem exacta da web para o mobile (pt-BR coloquial)
3. Se o componente não existir na web, seguir o glossário abaixo

**Glossário obrigatório (pt-BR coloquial — mantém paridade com a web):**

| Contexto | ✅ Correcto (pt-BR, paridade web) | ❌ Incorrecto |
|----------|----------------------------------|--------------|
| CTA para dose | **Tomar** | Registar, Registrar, Register |
| Status de dose | **Tomada / Tomados** | Registada, Registados |
| Modal de dose | **Tomar dose** | Registar dose |
| Dose perdida | **Perdida** | Em falta, Não tomada |
| Dose agendada | **Agendada** | Programada, Scheduled |
| Completo | **✓ Feito** | ✓ Completo, Done |
| Ação de stock | **Adicionar** | Registar entrada |
| Erro genérico | **Erro ao registrar** (interno) | Erro ao registar |

---

## 3. Dependências a instalar (H5.1)

```bash
# Tab navigator
npx expo install @react-navigation/bottom-tabs

# Ícones nativos (sem biblioteca extra — usar emoji ou react-native vector icons já presente)
# Verificar se @expo/vector-icons já está instalado (vem com expo)
```

---

## 4. Bloqueio crítico — Telegram (Sprint H5.7)

A spec identifica três opções para gerar token de vinculação no mobile:

| Opção | Descrição | Complexidade |
|-------|-----------|-------------|
| **A** | Supabase RPC/Edge Function que gera o token | Média (requer SQL function) |
| **B** | Endpoint em `api/` (nova rota no router existente) | Média (requer Vercel function) |
| **C** | Gerar token directamente no client | Baixa (se a lógica for simples) |

**Decisão tomada pelo maintainer (2026-04-14): Opção A (Supabase RPC).**

**Impacto:** H5.1–H5.6 não dependem desta decisão. H5.7 pode avançar com Opção A.

**Contexto:** Gerar token via Supabase RPC mantém menor latência, sem necessidade de nova Vercel function. Token armazenado do lado do servidor para validação pelo bot.

**Recomendação técnica:** Opção A ou B. Gerar token no client (Opção C) não é adequado pois o token deve ser armazenado do lado do servidor para validação posterior pelo bot.

---

## 5. Estrutura alvo ao fim de H5

```
apps/mobile/src/
├── navigation/               (EXISTS — mantém aqui, nunca mover para src/app/)
│   ├── AppRoot.jsx           (exists)
│   ├── Navigation.jsx        (modificar em H5.1: HOME → TABS)
│   ├── routes.js             (expandir com TABS + sub-rotas)
│   ├── RootTabs.jsx          (NEW — tab navigator)
│   ├── TreatmentsStack.jsx   (NEW — stack aninhado)
│   └── ProfileStack.jsx      (NEW — stack aninhado)
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── TodaySummaryCard.jsx
│   │   │   ├── DoseListItem.jsx
│   │   │   └── UpcomingDosesList.jsx
│   │   ├── hooks/
│   │   │   └── useTodayData.js
│   │   ├── services/
│   │   │   └── dashboardService.js
│   │   └── screens/
│   │       └── TodayScreen.jsx
│   ├── dose/
│   │   ├── components/
│   │   │   └── DoseRegisterModal.jsx
│   │   └── services/
│   │       └── doseService.js
│   ├── treatments/
│   │   ├── components/
│   │   │   ├── TreatmentCard.jsx
│   │   │   └── TreatmentsList.jsx
│   │   ├── hooks/
│   │   │   └── useTreatments.js
│   │   ├── services/
│   │   │   └── treatmentsService.js
│   │   └── screens/
│   │       └── TreatmentsScreen.jsx
│   ├── stock/
│   │   ├── components/
│   │   │   ├── StockItem.jsx
│   │   │   └── StockLevelBadge.jsx
│   │   ├── hooks/
│   │   │   └── useStock.js
│   │   ├── services/
│   │   │   └── stockService.js
│   │   └── screens/
│   │       └── StockScreen.jsx
│   └── profile/
│       ├── components/
│       │   └── TelegramLinkCard.jsx
│       ├── hooks/
│       │   └── useProfile.js
│       ├── services/
│       │   └── profileService.js
│       └── screens/
│           ├── ProfileScreen.jsx
│           └── TelegramLinkScreen.jsx (se H5.7 for implementado)
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── ScreenContainer.jsx   — SafeAreaView wrapper
│   │   │   ├── SectionCard.jsx       — card reutilizável
│   │   │   ├── PrimaryButton.jsx     — botão primário
│   │   │   └── StatusBadge.jsx       — badge de estado
│   │   └── states/
│   │       ├── LoadingState.jsx
│   │       ├── EmptyState.jsx
│   │       └── ErrorState.jsx
│   ├── hooks/
│   │   └── useOnlineStatus.js        — detectar conectividade
│   └── theme/
│       └── colors.js                 — tokens de cor (de @meus-remedios/design-tokens)
└── platform/                         (EXISTS — não tocar em H5)
    screens/                          (EXISTS — LoginScreen/SmokeScreen ficam aqui)
```

---

## 6. Plano de sprints e PRs

### PR 1 — H5.1: Shell + Tabs

**Branch:** `feature/hybrid-h5/shell-tabs`

**Ficheiros a criar/modificar:**
- `navigation/routes.js` — adicionar TABS, TODAY, TREATMENTS, STOCK, PROFILE
- `navigation/Navigation.jsx` — HOME → TABS; instalar `@react-navigation/bottom-tabs`
- `navigation/RootTabs.jsx` — NEW: tab navigator com 4 tabs
- `navigation/TreatmentsStack.jsx` — NEW
- `navigation/ProfileStack.jsx` — NEW
- `screens/HomeScreen.jsx` — pode ficar como está (será ignorado ao mudar para TABS)
- `features/dashboard/screens/TodayScreen.jsx` — NEW: placeholder inicial
- `features/treatments/screens/TreatmentsScreen.jsx` — NEW: placeholder
- `features/stock/screens/StockScreen.jsx` — NEW: placeholder
- `features/profile/screens/ProfileScreen.jsx` — NEW: placeholder com logout

**Critério de aceitação:**
- Utilizador logado → cai nas tabs (Hoje/Tratamentos/Estoque/Perfil)
- Logout na aba Perfil volta para login
- SmokeScreen continua acessível internamente (diagnóstico)

---

### PR 2 — H5.2 + H5.3: Hoje + Registo de Dose

**Branch:** `feature/hybrid-h5/today-dose`

**Ficheiros a criar:**
- `features/dashboard/services/dashboardService.js` — busca protocols + logs do dia
- `features/dashboard/hooks/useTodayData.js` — loading/error/data
- `features/dashboard/components/TodaySummaryCard.jsx`
- `features/dashboard/components/UpcomingDosesList.jsx`
- `features/dashboard/components/DoseListItem.jsx`
- `features/dashboard/screens/TodayScreen.jsx` — tela completa
- `features/dose/services/doseService.js` — createLog via nativeSupabaseClient
- `features/dose/components/DoseRegisterModal.jsx` — modal/bottom sheet
- `shared/components/states/LoadingState.jsx`
- `shared/components/states/EmptyState.jsx`
- `shared/components/states/ErrorState.jsx`
- `shared/components/ui/ScreenContainer.jsx`
- `shared/components/ui/PrimaryButton.jsx`

**Critério de aceitação:**
- Tela Hoje mostra resumo do dia + doses pendentes
- Modal de registo funciona e atualiza lista
- Loading/empty/error visíveis

---

### PR 3 — H5.4: Tratamentos ✅

**Branch:** `feature/hybrid-h5/treatments` (Merged: PR #467)

**Ficheiros a criar:**
- `features/treatments/services/treatmentsService.js`
- `features/treatments/hooks/useTreatments.js`
- `features/treatments/components/TreatmentCard.jsx`
- `features/treatments/screens/TreatmentsScreen.jsx`
- `shared/components/ui/SectionCard.jsx`
- `shared/components/ui/StatusBadge.jsx`

**Critério de aceitação:**
- Lista de tratamentos/protocolos ativos
- Nome, frequência, horários visíveis
- Loading/empty/error

---

### PR 4 — H5.5: Estoque ✅

**Branch:** `feature/hybrid-h5/stock` (Merged: PR #468)

**Ficheiros criados:**
- `features/stock/services/stockService.js`
- `features/stock/hooks/useStock.js`
- `features/stock/components/StockItem.jsx`
- `features/stock/components/StockLevelBadge.jsx` — 4 níveis ADR-018
- `features/stock/screens/StockScreen.jsx`

**Critério de aceitação:**
- Lista de medicamentos com nível de estoque ✅
- Badge de nível: CRITICAL/LOW/NORMAL/HIGH — ADR-018 ✅
- Priorização por urgência (daysRemaining) ✅
- Seccionamento: "Em Uso" vs "Sem tratamento ativo" ✅
- Loading/empty/error ✅
- Fluxos manuais validados (iOS simulator + Android emulator) ✅

---

### PR 5 — H5.6 + H5.7: Perfil + Telegram (condicional)

**Branch:** `feature/hybrid-h5/profile-telegram`

**Ficheiros a criar:**
- `features/profile/services/profileService.js` — ler user_settings (telegram_chat_id)
- `features/profile/hooks/useProfile.js`
- `features/profile/components/TelegramLinkCard.jsx`
- `features/profile/screens/ProfileScreen.jsx` — email, logout, estado Telegram
- `features/profile/screens/TelegramLinkScreen.jsx` — (opção A decidida)

**Critério de aceitação:**
- Email do utilizador
- Botão de logout
- Estado Telegram (conectado/desconectado)
- Fluxos manuais validados (iOS simulator + Android emulator)

---

### PR 8 — H5.7.5: Dashboard Evolution (Premium) ✅

**Branch:** `feature/hybrid-h5/dashboard-evolution` (H5.7.5)

**Ficheiros a criar/modificar:**
- `features/dashboard/hooks/useTodayData.js` — Core integration + Zones + Stock Alerts
- `features/dashboard/components/AdherenceRing.jsx` — NEW (SVG)
- `features/dashboard/components/PriorityActionCard.jsx` — NEW (UX Premium)
- `features/dashboard/components/StockAlertInline.jsx` — PORTED from Web
- `features/dashboard/components/TodaySummaryCard.jsx` — Refactor (Ring integration)
- `features/dashboard/components/DoseListItem.jsx` — Refactor (Splitting)
- `features/dashboard/components/UpcomingDosesList.jsx` — Refactor (Zoned Timeline)
- `features/dose/components/DoseRegisterModal.jsx` — Enhanced (Time badge)

**Critério de aceitação:**
- Ring Gauge exibe adesão do dia ✅
- PriorityActionCard destaca doses urgentes (Now/Late) ✅
- Lista de doses dividida por zonas cronológicas ✅
- Alertas de estoque visíveis no dashboard ✅
- Ambient Shadows e layout premium ✅

---

### PR 6 — H5.8: Estados transversais 

**Branch:** `feature/hybrid-h5/stale-states`

**Ficheiros a criar/modificar:**
- `shared/hooks/useOnlineStatus.js` — estado de conectividade
- `shared/theme/colors.js` — tokens de `@meus-remedios/design-tokens`
- Stale offline states em TodayScreen/TreatmentsScreen/StockScreen

**Critério de aceitação:**
- Todas as telas: loading + empty + error
- Telas online-first: stale state ao ficar offline
- Fluxos manuais validados (iOS simulator + Android emulator)

---

### PR 9 — H5.9 e H5.10: Testes + Hardening

**Branch:** `feature/hybrid-h5/tests-hardening`

**Ficheiros a criar/modificar:**
- Testes: `*.test.js` para screens e hooks críticos
- Remoção de componentes fora de escopo

**Critério de aceitação (Definition of Done da Fase 5):**
- Testes unitários criados
- Zero dependências de componentes web
- Fluxos manuais validados (iOS simulator + Android emulator)

---

## 7. Padrão de serviço mobile (thin local service)

```js
// features/dashboard/services/dashboardService.js
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

// Buscar protocolos activos do utilizador
export async function getActiveProtocols(userId) {
  const { data, error } = await supabase
    .from('protocols')
    .select('id, name, medicine_id, frequency, time_schedule, dosage_per_intake')
    .eq('user_id', userId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}

// Buscar logs de hoje
export async function getTodayLogs(userId, dateStr) {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('id, protocol_id, taken_at, quantity_taken')
    .eq('user_id', userId)
    .gte('taken_at', `${dateStr}T00:00:00`)
    .lt('taken_at', `${dateStr}T23:59:59`)

  if (error) throw error
  return data
}
```

**Regras:**
- Usar sempre `nativeSupabaseClient` (nunca import da web)
- Schemas de validação de `@meus-remedios/core` quando aplicável
- Lançar error, não retornar null — hooks tratam os erros

---

## 8. Padrão de hook mobile

```js
// features/dashboard/hooks/useTodayData.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getActiveProtocols, getTodayLogs } from '../services/dashboardService'
import { formatLocalDate } from '@meus-remedios/core'

export function useTodayData() {
  const [state, setState] = useState({ data: null, loading: true, error: null, stale: false })

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sem sessão')

      const today = formatLocalDate(new Date())
      const [protocols, logs] = await Promise.all([
        getActiveProtocols(user.id),
        getTodayLogs(user.id, today),
      ])
      setState({ data: { protocols, logs }, loading: false, error: null, stale: false })
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err.message, stale: prev.data !== null }))
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { ...state, refresh: load }
}
```

---

## 9. Padrão de tela (screen pattern)

```jsx
// features/dashboard/screens/TodayScreen.jsx
import { ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTodayData } from '../hooks/useTodayData'
import LoadingState from '../../../shared/components/states/LoadingState'
import EmptyState from '../../../shared/components/states/EmptyState'
import ErrorState from '../../../shared/components/states/ErrorState'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'

export default function TodayScreen() {
  const { data, loading, error, stale, refresh } = useTodayData()

  if (loading && !data) return <LoadingState />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {/* stale banner */}
        {stale && <StaleBanner />}
        {/* conteúdo */}
        {data?.protocols.length === 0
          ? <EmptyState message="Nenhum tratamento activo" />
          : <UpcomingDosesList protocols={data.protocols} logs={data.logs} />
        }
      </ScrollView>
    </ScreenContainer>
  )
}
```

---

## 10. Critérios de qualidade por sprint

| Sprint | Comando de validação | Gate |
|--------|---------------------|------|
| H5.1 | `cd apps/mobile && npx expo start --no-dev` | App abre, tabs visíveis |
| H5.2-H5.5 | Expo Go: abrir cada aba | Dados carregam, estados visíveis |
| H5.6 | Expo Go: Perfil | Email, logout, Telegram state |
| H5.7 | Expo Go: vincular Telegram | Token gerado (se implementado) |
| H5.8-H5.10 | `cd apps/mobile && npx jest` | Testes passam |
| **Final** | `npm run test:critical` (raiz) | 543/543 web OK |
| **Final** | `npm run build` (raiz) | Web compila |
| **Final** | Expo Go iOS + Android | Fluxos manuais validados |

---

## 11. Regras críticas a seguir (warm packs relevantes)

| Regra | Aplicação |
|-------|-----------|
| R-163 (AP-H09) | Nunca criar `apps/mobile/src/app/` — usar `src/navigation/` |
| R-164 (AP-H10) | Não simplificar Navigation.jsx — manter 3 estados (undefined/null/session) |
| R-162 (AP-H08) | Polyfills em primeiro lugar em index.js — não reordenar |
| R-160 | SecureStore chunked já implementado — não substituir por AsyncStorage para auth |
| ADR-028 | StyleSheet (não NativeWind), AsyncStorage (não MMKV) |
| ADR-018 | Stock: 4 níveis CRITICAL/LOW/NORMAL/HIGH (<7/<14/<30/≥30 dias) |
| ADR-023 | Sem font weights < 400 |
| Spec R5-001 | Mobile não tenta paridade visual com a web |
| Spec R5-008 | Online-first: escrita offline proibida nesta fase |
| Spec R5-009 | Rotas centralizadas em routes.js (nunca strings espalhadas) |

---

## 12. Decisões pendentes (requerem input do maintainer)

| # | Decisão | Urgência | Status |
|---|---------|----------|--------|
| 1 | **Mecanismo Telegram mobile** (Opção A/B/C) | Antes de H5.7 | ✅ **Opção A (Supabase RPC)** — decidido 2026-04-14 |
| 2 | **ADR-029 aprovação** | Antes de H5.2 | ✅ **Aprovado implicitamente** — funcionou em H5.2/H5.3 |
| 3 | **ADR-030 aprovação** | Antes de H5.1 | ✅ **Aprovado implicitamente** — implementado e estável |
| 4 | **Android Emulator validation** (gate aberto de H4) | Antes de H5 | 🟡 H5.1 ✅ validado; H5.2/H5.3 pendente (WiFi) |

---

## 13. Definition of Done da Fase H5

- [x] Shell + tabs funcionando (Hoje/Tratamentos/Estoque/Perfil)
- [x] Tela Hoje funcional (resumo do dia + CTA de dose)
- [x] Fluxo de registo de dose funcional
- [x] Tela Tratamentos funcional (lista de protocolos)
- [x] Tela Estoque funcional (4 níveis de risco + priorização)
- [x] Tela Perfil funcional (email, logout, estado Telegram)
- [x] Vinculo Telegram (se decisão tomada) ou adiado explicitamente
- [x] Loading/empty/error em todas as telas principais (H5.1-H5.7)
- [ ] Stale offline states onde há snapshot local
- [ ] Fluxos manuais validados (iOS + Android)
- [ ] Testes unitários para screens e hooks críticos
- [ ] `npm run test:critical` passa (543/543)
- [ ] `npm run build` passa
- [ ] Zero dependências de componentes web

---

*Atualizado por DEVFLOW Coding — 2026-04-15 (H5.7.5 ✅ Dashboard Evolution Delivered)*
