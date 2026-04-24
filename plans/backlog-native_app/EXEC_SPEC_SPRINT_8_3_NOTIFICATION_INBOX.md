# Exec Spec — Sprint 8.3: Notification Inbox UX (Web & Mobile)

> **Status:** APROVADO — Design Spec gerada (`plans/backlog-native_app/DESIGN_SPEC_SPRINT_8_3_NOTIFICATION_INBOX.md`) 
> **Sprint:** 2026-W17
> **Meta doc:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE8_POS_MVP.md` — Epic 1, Sprint 8.3
> **Design Spec:** `plans/backlog-native_app/DESIGN_SPEC_SPRINT_8_3_NOTIFICATION_INBOX.md`
> **Pré-requisito:** Sprint 8.1 ✅ (migration + dispatcher) | Sprint 8.2 ✅ (hook + repositório)

---

## 1. Objetivo

Implementar a tela/view "Notification Inbox" (Central de Avisos) em ambas as plataformas, expondo o histórico de notificações enviadas ao usuário. A tela é acessível pelo ícone 🔔 na barra de navegação. Inclui badge de não-lidas e deep links contextuais.

---

## 2. Inventário do Sprint 8.2 (Entregue — base disponível)

| Artefato | Local | Status |
|----------|-------|--------|
| `notificationLogSchema` | `packages/core/src/schemas/notificationLogSchema.js` | ✅ |
| `createNotificationLogRepository` | `packages/shared-data/src/services/createNotificationLogRepository.js` | ✅ |
| `CACHE_KEYS.NOTIFICATIONS_PAGINATED` | `packages/shared-data/src/query-cache/cacheKeys.js` | ✅ |
| `useNotificationLog` (web) | `apps/web/src/shared/hooks/useNotificationLog.js` | ✅ |
| `useNotificationLog` (mobile) | `apps/mobile/src/shared/hooks/useNotificationLog.js` | ✅ |

---

## 3. Escopo de Entrega

### 3.1 Utilitários Compartilhados

**Arquivo:** `packages/core/src/utils/notificationIconMapper.js` *(NOVO)*

Mapeamento de `notification_type` → ícone + cor + label legível:

| type | ícone (lucide) | cor semântica | label |
|------|----------------|---------------|-------|
| `dose_reminder` | `Clock` | `--color-primary` | Lembrete de dose |
| `stock_alert` | `Package` | `--color-warning` | Alerta de estoque |
| `daily_digest` | `BarChart2` | `--color-info` | Resumo diário |
| `missed_dose` | `AlertTriangle` | `--color-error` | Dose perdida |
| `titration_update` | `TrendingUp` | `--color-success` | Atualização de titulação |
| `_default` | `Bell` | `--color-text-muted` | Notificação |

Exporta: `getNotificationIcon(type)` → `{ icon, color, label }`

---

### 3.2 Web PWA

#### 3.2.1 View: `NotificationInbox.jsx` *(NOVA)*
**Local:** `apps/web/src/views/redesign/NotificationInbox.jsx`

- Usa `useNotificationLog({ userId, limit: 20 })`
- Renderiza `NotificationList` (componente abaixo)
- Header com título "Central de Avisos" + botão Voltar
- Suspense com `ViewSkeleton` (R-117)

#### 3.2.2 Componente: `NotificationList.jsx` *(NOVO)*
**Local:** `apps/web/src/features/notifications/components/NotificationList.jsx`

- Lista paginada usando `react-virtuoso` se `items.length > 30` (R-115)
- Fallback simples para listas curtas
- Renderiza `NotificationCard` por item
- Estado vazio: ilustração + texto "Nenhuma notificação ainda"
- Estado de erro: `AlertList` component existente

#### 3.2.3 Componente: `NotificationCard.jsx` *(NOVO)*
**Local:** `apps/web/src/features/notifications/components/NotificationCard.jsx`

Exibe por item:
- Ícone (via `getNotificationIcon`) + cor semântica
- `notification_type` como label legível
- `sent_at` formatado: "há 2h", "ontem", "2 jan"
- Mensagem do `provider_metadata.message` se disponível
- Badge de status: `enviada` (verde) / `falhou` (vermelho)
- Botão de ação contextual (deep link) se aplicável

**Deep links por tipo:**
| type | ação | view destino |
|------|------|-------------|
| `dose_reminder` | "Ver doses" | `dashboard` |
| `stock_alert` | "Ver estoque" | `stock` |
| `missed_dose` | "Ver histórico" | `history` |

#### 3.2.4 Badge 🔔 na navegação web

**Modificar:** `apps/web/src/shared/components/ui/BottomNavRedesign.jsx`
**Modificar:** `apps/web/src/shared/components/ui/Sidebar.jsx`

- Adicionar item `{ id: 'notifications', label: 'Avisos', Icon: Bell }` na lista `navItems`
- Badge de não-lidas: número vermelho sobre o ícone se `unreadCount > 0`
- `unreadCount` via `useUnreadNotificationCount` hook (item 3.3)

#### 3.2.5 Hook: `useUnreadNotificationCount.js` *(NOVO)*
**Local:** `apps/web/src/shared/hooks/useUnreadNotificationCount.js`

- Lê `localStorage.getItem('dosiq:notif-last-seen')` (timestamp ISO)
- Conta itens em `useNotificationLog` com `sent_at > lastSeen`
- Retorna `{ unreadCount, markAllRead }`
- `markAllRead` grava `new Date().toISOString()` no localStorage

**Registrar view em App.jsx:**
```jsx
const NotificationInbox = lazy(() => import('./views/redesign/NotificationInbox'))
// case 'notifications': → <NotificationInbox onBack={() => setCurrentView('dashboard')} />
```

---

### 3.3 Mobile (React Native)

#### 3.3.1 Screen: `NotificationInboxScreen.jsx` *(NOVA)*
**Local:** `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx`

- Usa `useNotificationLog({ userId, limit: 20 })`
- Header padrão Santuário: `fontSize: 28, fontWeight: '800'` (R-180)
- Botão "← Voltar" (ADR-025, padrão Telegram)
- `FlatList` (ou `FlashList` se disponível) para a lista
- Pull-to-refresh → `refresh()`
- Estado de `stale`: banner sutil "Exibindo dados offline"

#### 3.3.2 Componente: `NotificationItem.jsx` *(NOVO)*
**Local:** `apps/mobile/src/features/notifications/components/NotificationItem.jsx`

- Ícone + label via `getNotificationIcon(type)` (do `@dosiq/core`)
- `sent_at` formatado (via `formatRelativeTime` de `@dosiq/core`)
- Separador `View` com `borderBottom` entre itens
- Sem `TouchableOpacity` para itens sem deep link (dose_reminder mobile ativa a tab Hoje)

#### 3.3.3 Badge 🔔 no header do `ProfileScreen`

O acesso à Inbox no mobile será via **ProfileScreen** (não nova tab — para evitar exceder 5 tabs, manter coerência com Sprint 8.3 UX simplificado).

**Modificar:** `apps/mobile/src/features/profile/screens/ProfileScreen.jsx`
- Adicionar item "Central de Avisos" com ícone `Bell` na lista de ações
- Badge numérico de não-lidas: `AsyncStorage.getItem('@dosiq/notif-last-seen')` → contagem

**Modificar:** `apps/mobile/src/navigation/routes.js`
- Adicionar `NOTIFICATION_INBOX: 'NotificationInbox'`

**Modificar:** `apps/mobile/src/navigation/ProfileStack.jsx` (ou criar se não existir)
- Adicionar `<Stack.Screen name={ROUTES.NOTIFICATION_INBOX} component={NotificationInboxScreen} />`

#### 3.3.4 Hook: `useUnreadNotificationCount` (mobile)
**Local:** `apps/mobile/src/shared/hooks/useUnreadNotificationCount.js` *(NOVO)*

- Lê `AsyncStorage.getItem('@dosiq/notif-last-seen')`
- Conta itens com `sent_at > lastSeen`
- Retorna `{ unreadCount, markAllRead }` (assíncrono via useState)

---

## 4. Arquivos a Criar / Modificar

| Operação | Arquivo | Plataforma |
|----------|---------|-----------|
| **CRIAR** | `packages/core/src/utils/notificationIconMapper.js` | Shared |
| **CRIAR** | `apps/web/src/features/notifications/components/NotificationList.jsx` | Web |
| **CRIAR** | `apps/web/src/features/notifications/components/NotificationList.css` | Web |
| **CRIAR** | `apps/web/src/features/notifications/components/NotificationCard.jsx` | Web |
| **CRIAR** | `apps/web/src/features/notifications/components/NotificationCard.css` | Web |
| **CRIAR** | `apps/web/src/views/redesign/NotificationInbox.jsx` | Web |
| **CRIAR** | `apps/web/src/views/redesign/NotificationInbox.css` | Web |
| **CRIAR** | `apps/web/src/shared/hooks/useUnreadNotificationCount.js` | Web |
| **CRIAR** | `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx` | Mobile |
| **CRIAR** | `apps/mobile/src/features/notifications/components/NotificationItem.jsx` | Mobile |
| **CRIAR** | `apps/mobile/src/shared/hooks/useUnreadNotificationCount.js` | Mobile |
| **MODIFICAR** | `apps/web/src/shared/components/ui/BottomNavRedesign.jsx` + `.css` | Web |
| **MODIFICAR** | `apps/web/src/shared/components/ui/Sidebar.jsx` | Web |
| **MODIFICAR** | `apps/web/src/App.jsx` (lazy import + case 'notifications') | Web |
| **MODIFICAR** | `apps/mobile/src/navigation/routes.js` (NOTIFICATION_INBOX) | Mobile |
| **MODIFICAR** | `apps/mobile/src/navigation/ProfileStack.jsx` (ou criar) | Mobile |
| **MODIFICAR** | `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | Mobile |
| **EXPORTAR** | `packages/core/src/index.js` (notificationIconMapper) | Shared |

---

## 5. Contratos Tocados

| Contrato | Impacto |
|----------|---------|
| `CON-006` `useCachedQuery` | Consumido por `useNotificationLog` web — não-breaking |
| `CON-009` `useTheme()` | Consumido por `NotificationCard` para cores — não-breaking |
| `CON-013` `queryCache.delete(key)` | Usado em `markAllRead` para invalidar cache — não-breaking |

---

## 6. ADRs Verificados

| ADR | Relevância |
|-----|-----------|
| ADR-010 | Status badges com fills muted (10% opacity) — nunca saturados ✅ |
| ADR-012 | border-radius mínimo 0.75rem em todos os cards/componentes ✅ |
| ADR-023 | Sem font-weight < 400 nos componentes ✅ |
| ADR-024 | Ícones SEMPRE acompanhados de texto label ✅ |
| ADR-029 | Dispatcher Multicanal — dados já persistidos na `notification_log` ✅ |
| ADR-030 | Feature flag não necessária para UI read-only ✅ |
| ADR-033 | Resiliência de cache post-load aplicada no hook mobile ✅ |

**Novo ADR necessário?** NÃO — a decisão de acesso via ProfileScreen no mobile (em vez de nova tab) é uma escolha de UX de baixo impacto, não arquitetural.

---

## 7. Regras Críticas Aplicáveis

| Regra | Aplicação |
|-------|-----------|
| R-010 | Hook order: States → useMemo → useEffect → handlers |
| R-065 | Bootstrap DEVFLOW completo antes de codificar |
| R-115 | `react-virtuoso` se lista > 30 itens |
| R-117 | View web com React.lazy() + Suspense + ViewSkeleton |
| R-126 | ≤ 4 requests simultâneos (a inbox faz apenas 1) |
| R-138 | Ícones SEMPRE acompanhados de texto label |
| R-151 | Usar Modal compartilhado se necessário |
| R-167 | `if (__DEV__)` nos console.log mobile |
| R-169 | Screens mobile DEVEM ter SafeAreaView |
| R-180 | Header mobile padrão Santuário: fontSize 28, fontWeight 800, letterSpacing -0.5 |
| R-187 | Cache keys dinâmicas por userId (já implementado no hook) |
| R-188 | Fetcher memoizado (já implementado no hook web) |
| AP-056 | Unstable fetcher loop — mitigado com `useCallback` memoizado |

---

## 8. DoD (Definition of Done) Verificável

- [ ] **DoD-1:** Usuário acessa Central de Avisos pela nav (web: ícone 🔔 / mobile: ProfileScreen → "Central de Avisos")
- [ ] **DoD-2:** Lista exibe notificações ordenadas do mais novo para o mais antigo
- [ ] **DoD-3:** Cards mostram ícone por tipo, label, data relativa e status
- [ ] **DoD-4:** Deep links funcionam: "Ver doses" → dashboard, "Ver estoque" → stock, "Ver histórico" → history
- [ ] **DoD-5:** Badge 🔔 exibe contagem de não-lidas; ao acessar a tela, a contagem é zerada
- [ ] **DoD-6:** Estado vazio com mensagem amigável quando não há notificações
- [ ] **DoD-7:** Mobile exibe banner "dados offline" quando `stale === true`
- [ ] **DoD-8:** `npm run validate:agent` passa sem erros (lint + testes críticos + build)
- [ ] **DoD-9:** Nenhuma view web existente quebra (smoke test no navegador)

---

## 9. Quality Gate Commands

```bash
# Lint (web)
cd apps/web && npm run lint

# Testes críticos
npm run test:critical

# Build web
cd apps/web && npm run build

# Validate completo (agente — 10min kill)
npm run validate:agent
```

---

## 10. Riscos e Flags

| Risco | Mitigação |
|-------|-----------|
| `ProfileStack.jsx` pode não existir no mobile | Verificar com `find` antes de modificar; criar se necessário |
| `packages/core/src/index.js` pode não exportar `utils/` | Verificar e atualizar barrel export |
| `BottomNavRedesign` pode ter testes que verificam quantidade de itens | Atualizar teste em `__tests__/BottomNav.test.jsx` |
| Badge web pode conflitar com z-index de Modal | AP-W24: testar sobreposição |

---

## 11. Design das Telas

> **NOTA:** As telas serão desenhadas com `/ui-design-brain` antes da implementação.
> O design deve respeitar:
> - Design System tokens CSS (`--color-*`, `--radius-*`, `--shadow-*`)
> - Linguagem de motion: `motionConstants.js` (6 archetypes) para web
> - ADR-012: border-radius mínimo 0.75rem
> - ADR-023: font-weight mínimo 400
> - R-137: sem font-weight < 400 (acessibilidade idosos)
> - R-138: ícones sempre com label
