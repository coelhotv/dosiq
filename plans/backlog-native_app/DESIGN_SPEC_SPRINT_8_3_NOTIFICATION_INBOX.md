# Design Spec — Sprint 8.3: Notification Inbox (Central de Avisos)

> **Gerado por:** `/ui-design-brain` + DEVFLOW Planning P3
> **Sprint:** 2026-W17
> **Status:** APROVADO PARA IMPLEMENTAÇÃO
> **Exec Spec base:** `plans/backlog-native_app/EXEC_SPEC_SPRINT_8_3_NOTIFICATION_INBOX.md`

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Preset | B — Apple-level Minimal | "Santuário Terapêutico" — calma, confiança |
| Icon size | 40px círculo (web + mobile) | Identidade visual consistente cross-platform |
| Type scale | Label 15/600, Preview 13/400, Time 12/400 mono, Header 20/800 web, 28/800 mobile | Hierarquia clara para idosos (R-137) |
| Status badges | Muted fills (10% opacity) + cor semântica | Nunca saturado — ADR-010 |
| Motion | Stagger 40ms web, 200ms ease-out. Mobile sem extras | Perf mid-range Android |
| Offline state | Banner âmbar sutil no topo | Não bloqueia conteúdo |
| Empty state | Ícone muted + título positivo + corpo encorajador | Sem CTAs desnecessários |
| Skeleton | Shimmer 1.4s suave — shapes idênticas ao layout real | UX profissional |
| Deep links | Apenas onde há ação clara | Sem "Ver mais" genérico |
| Acessibilidade | role="list", aria-label, accessibilityRole, focus-visible, prefers-reduced-motion | WCAG AA |

---

## Arquivos a Criar (com código completo abaixo)

| # | Arquivo | Tipo |
|---|---------|------|
| 1 | `packages/core/src/utils/notificationIconMapper.js` | Utilitário compartilhado |
| 2 | `apps/web/src/shared/hooks/useUnreadNotificationCount.js` | Hook web |
| 3 | `apps/web/src/features/notifications/components/NotificationCard.jsx` | Componente web |
| 4 | `apps/web/src/features/notifications/components/NotificationCard.css` | Estilos web |
| 5 | `apps/web/src/features/notifications/components/NotificationList.jsx` | Componente web |
| 6 | `apps/web/src/features/notifications/components/NotificationList.css` | Estilos web |
| 7 | `apps/web/src/views/redesign/NotificationInbox.jsx` | View web |
| 8 | `apps/web/src/views/redesign/NotificationInbox.css` | Estilos view web |
| 9 | `apps/mobile/src/features/notifications/components/NotificationItem.jsx` | Componente mobile |
| 10 | `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx` | Screen mobile |
| 11 | `apps/mobile/src/shared/hooks/useUnreadNotificationCount.js` | Hook mobile |

**Modificações:**
- `apps/web/src/shared/components/ui/BottomNavRedesign.jsx` — adicionar item `notifications` + Bell + badge
- `apps/web/src/shared/components/ui/Sidebar.jsx` — idem
- `apps/web/src/App.jsx` — lazy import + case `'notifications'`
- `apps/mobile/src/navigation/routes.js` — `NOTIFICATION_INBOX`
- `apps/mobile/src/navigation/ProfileStack.jsx` — registrar screen
- `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` — item "Central de Avisos" com badge
- `packages/core/src/index.js` — exportar `notificationIconMapper`

---

## Arquivo 1 — `packages/core/src/utils/notificationIconMapper.js`

```js
/**
 * Mapeia notification_type para configuração de ícone, cor e label legível.
 * Independente de plataforma — não importa lucide-react nem RN aqui.
 *
 * @param {string} type - Valor do campo notification_type no DB
 * @returns {{ iconName: string, color: string, bgColor: string, label: string, deepLinkAction: string|null }}
 */
export function getNotificationIcon(type) {
  const map = {
    dose_reminder: {
      iconName: 'Clock',
      color: 'var(--color-primary, #006a5e)',
      bgColor: 'rgba(0, 106, 94, 0.10)',
      label: 'Lembrete de dose',
      deepLinkAction: 'dashboard',
    },
    stock_alert: {
      iconName: 'Package',
      color: 'var(--color-warning, #d97706)',
      bgColor: 'rgba(217, 119, 6, 0.10)',
      label: 'Alerta de estoque',
      deepLinkAction: 'stock',
    },
    missed_dose: {
      iconName: 'AlertTriangle',
      color: 'var(--color-error, #dc2626)',
      bgColor: 'rgba(220, 38, 38, 0.10)',
      label: 'Dose perdida',
      deepLinkAction: 'history',
    },
    daily_digest: {
      iconName: 'BarChart2',
      color: 'var(--color-info, #0284c7)',
      bgColor: 'rgba(2, 132, 199, 0.10)',
      label: 'Resumo diário',
      deepLinkAction: null,
    },
    titration_update: {
      iconName: 'TrendingUp',
      color: 'var(--color-success, #16a34a)',
      bgColor: 'rgba(22, 163, 74, 0.10)',
      label: 'Atualização de titulação',
      deepLinkAction: 'treatment',
    },
  }
  return map[type] ?? {
    iconName: 'Bell',
    color: 'var(--color-text-muted, #6b7280)',
    bgColor: 'rgba(107, 114, 128, 0.10)',
    label: 'Notificação',
    deepLinkAction: null,
  }
}

/**
 * Formata uma data ISO em texto relativo legível (pt-BR).
 *
 * @param {string} isoString - Data ISO do campo sent_at
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diff = now - then

  const minute = 60 * 1000
  const hour   = 60 * minute
  const day    = 24 * hour
  const week   = 7 * day

  if (diff < minute)    return 'agora'
  if (diff < hour)      return `há ${Math.floor(diff / minute)}min`
  if (diff < 2 * hour)  return 'há 1h'
  if (diff < day)       return `há ${Math.floor(diff / hour)}h`
  if (diff < 2 * day)   return 'ontem'
  if (diff < week)      return `há ${Math.floor(diff / day)} dias`

  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  })
}
```

---

## Arquivo 2 — `apps/web/src/shared/hooks/useUnreadNotificationCount.js`

```js
/**
 * useUnreadNotificationCount — Conta notificações não lidas via localStorage (Web).
 *
 * Estratégia: compara sent_at dos logs com a última vez que o usuário abriu a inbox.
 * Zero roundtrip extra — tudo local.
 */
import { useMemo, useCallback } from 'react'

const STORAGE_KEY = 'dosiq:notif-last-seen'

/**
 * @param {Array|null} notifications - Lista retornada por useNotificationLog
 * @returns {{ unreadCount: number, markAllRead: () => void, lastSeen: string|null }}
 */
export function useUnreadNotificationCount(notifications) {
  const lastSeen = useMemo(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  }, [])

  const unreadCount = useMemo(() => {
    if (!notifications?.length) return 0
    if (!lastSeen) return notifications.length
    const lastSeenTime = new Date(lastSeen).getTime()
    return notifications.filter(n => {
      if (!n.sent_at) return false
      return new Date(n.sent_at).getTime() > lastSeenTime
    }).length
  }, [notifications, lastSeen])

  const markAllRead = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // silencioso — não crítico
    }
  }, [])

  return { unreadCount, markAllRead, lastSeen }
}
```

---

## Arquivo 3 — `apps/web/src/features/notifications/components/NotificationCard.jsx`

```jsx
/**
 * NotificationCard — Card de item de notificação para a inbox web.
 *
 * Exibe ícone semântico, label, data relativa, status e ação contextual.
 * ADR-012 (radius ≥ 0.75rem), ADR-023 (weight ≥ 400), R-138 (ícone+label).
 */
import { motion } from 'framer-motion'
import {
  Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell,
  ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import './NotificationCard.css'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

const DEEP_LINK_LABELS = {
  dashboard: 'Ver doses',
  stock:     'Ver estoque',
  history:   'Ver histórico',
  treatment: 'Ver tratamento',
}

/**
 * @param {Object} props
 * @param {Object} props.notification - Objeto notificationLog do DB
 * @param {function(string):void} props.onNavigate - Callback de navegação (recebe view id)
 * @param {number} props.index - Índice para stagger de animação
 */
export default function NotificationCard({ notification, onNavigate, index = 0 }) {
  const { notification_type, status, sent_at, provider_metadata = {} } = notification

  const { iconName, color, bgColor, label, deepLinkAction } =
    getNotificationIcon(notification_type)

  const IconComponent = ICON_MAP[iconName] ?? Bell
  const relativeTime  = formatRelativeTime(sent_at)
  const preview       = provider_metadata?.message ?? null
  const isFailed      = status === 'falhou' || status === 'failed'

  return (
    <motion.article
      className="notif-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: 'easeOut' }}
      role="listitem"
    >
      <div
        className="notif-card__icon"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        <IconComponent size={20} color={color} strokeWidth={2} />
      </div>

      <div className="notif-card__body">
        <div className="notif-card__header">
          <span className="notif-card__label">{label}</span>
          <time
            className="notif-card__time"
            dateTime={sent_at}
            title={sent_at ? new Date(sent_at).toLocaleString('pt-BR') : ''}
          >
            {relativeTime}
          </time>
        </div>

        {preview && (
          <p className="notif-card__preview">{preview}</p>
        )}

        <div className="notif-card__footer">
          <span className={`notif-card__status ${isFailed ? 'notif-card__status--failed' : 'notif-card__status--sent'}`}>
            {isFailed
              ? <><XCircle size={11} strokeWidth={2.5} aria-hidden="true" /> Falhou</>
              : <><CheckCircle2 size={11} strokeWidth={2.5} aria-hidden="true" /> Enviada</>
            }
          </span>

          {deepLinkAction && onNavigate && (
            <button
              className="notif-card__action"
              onClick={() => onNavigate(deepLinkAction)}
              aria-label={`${DEEP_LINK_LABELS[deepLinkAction]} — ${label}`}
            >
              {DEEP_LINK_LABELS[deepLinkAction]}
              <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
```

---

## Arquivo 4 — `apps/web/src/features/notifications/components/NotificationCard.css`

```css
.notif-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--color-surface-raised);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  cursor: default;
}

.notif-card:hover {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
  transform: translateY(-1px);
}

.notif-card__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.notif-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.notif-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.notif-card__label {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-card__time {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  white-space: nowrap;
  flex-shrink: 0;
}

.notif-card__preview {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--color-text-secondary, #4b5563);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.notif-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}

.notif-card__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  padding: 2px 8px;
  border-radius: 100px;
}

.notif-card__status--sent   { background: rgba(22, 163, 74, 0.10); color: var(--color-success, #16a34a); }
.notif-card__status--failed { background: rgba(220, 38, 38, 0.10); color: var(--color-error, #dc2626); }

.notif-card__action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary, #006a5e);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.15s ease, gap 0.15s ease;
}

.notif-card__action:hover        { opacity: 0.75; gap: 5px; }
.notif-card__action:focus-visible { outline: 2px solid var(--color-primary, #006a5e); outline-offset: 2px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  .notif-card, .notif-card__action { transition: none; }
}
```

---

## Arquivo 5 — `apps/web/src/features/notifications/components/NotificationList.jsx`

```jsx
/**
 * NotificationList — Lista de notificações (web).
 * R-115: react-virtuoso se > 30 itens.
 * Estados: loading (skeleton), vazio, erro, dados.
 */
import { Virtuoso } from 'react-virtuoso'
import { Bell } from 'lucide-react'
import NotificationCard from './NotificationCard'
import './NotificationList.css'

function NotificationSkeleton() {
  return (
    <div className="notif-skeleton" aria-hidden="true">
      <div className="notif-skeleton__icon" />
      <div className="notif-skeleton__body">
        <div className="notif-skeleton__line notif-skeleton__line--title" />
        <div className="notif-skeleton__line notif-skeleton__line--preview" />
        <div className="notif-skeleton__line notif-skeleton__line--short" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="notif-empty" role="status" aria-live="polite">
      <div className="notif-empty__icon-wrap" aria-hidden="true">
        <Bell size={36} strokeWidth={1.5} />
      </div>
      <h3 className="notif-empty__title">Nenhuma notificação ainda</h3>
      <p className="notif-empty__body">
        Quando você receber lembretes de doses ou alertas de estoque,
        eles aparecerão aqui.
      </p>
    </div>
  )
}

/**
 * @param {Object} props
 * @param {Array|null} props.data
 * @param {boolean} props.isLoading
 * @param {string|null} props.error
 * @param {function(string):void} props.onNavigate
 */
export default function NotificationList({ data, isLoading, error, onNavigate }) {
  if (isLoading) {
    return (
      <div className="notif-list" aria-busy="true" aria-label="Carregando notificações">
        {Array.from({ length: 3 }, (_, i) => <NotificationSkeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="notif-error" role="alert">
        <p>Erro ao carregar notificações: {error}</p>
      </div>
    )
  }

  if (!data?.length) return <EmptyState />

  if (data.length <= 30) {
    return (
      <div className="notif-list" role="list" aria-label="Notificações">
        {data.map((notif, i) => (
          <NotificationCard
            key={notif.id ?? i}
            notification={notif}
            onNavigate={onNavigate}
            index={i}
          />
        ))}
      </div>
    )
  }

  return (
    <Virtuoso
      data={data}
      className="notif-list notif-list--virtual"
      role="list"
      aria-label="Notificações"
      itemContent={(index, notif) => (
        <div style={{ paddingBottom: 10 }}>
          <NotificationCard
            key={notif.id ?? index}
            notification={notif}
            onNavigate={onNavigate}
            index={index}
          />
        </div>
      )}
    />
  )
}
```

---

## Arquivo 6 — `apps/web/src/features/notifications/components/NotificationList.css`

```css
.notif-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 24px;
}

.notif-list--virtual {
  height: calc(100vh - 140px);
}

/* Skeleton */
.notif-skeleton {
  display: flex;
  gap: 14px;
  padding: 16px;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-surface-raised);
}

.notif-skeleton__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-border, #e5e7eb);
  animation: shimmer 1.4s ease-in-out infinite;
}

.notif-skeleton__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notif-skeleton__line {
  height: 12px;
  border-radius: 6px;
  background: var(--color-border, #e5e7eb);
  animation: shimmer 1.4s ease-in-out infinite;
}

.notif-skeleton__line--title   { width: 55%; height: 14px; }
.notif-skeleton__line--preview { width: 85%; }
.notif-skeleton__line--short   { width: 30%; height: 10px; }

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}

/* Estado vazio */
.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 56px 24px;
  gap: 12px;
}

.notif-empty__icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--color-surface-raised, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #9ca3af);
  margin-bottom: 4px;
}

.notif-empty__title {
  font-family: var(--font-display, 'Public Sans', sans-serif);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.notif-empty__body {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: 0.9375rem;
  font-weight: 400;
  color: var(--color-text-muted, #6b7280);
  max-width: 280px;
  line-height: 1.6;
  margin: 0;
}

.notif-error {
  padding: 20px 16px;
  border-radius: 0.75rem;
  background: rgba(220, 38, 38, 0.06);
  color: var(--color-error, #dc2626);
  font-size: 0.9375rem;
}
```

---

## Arquivo 7 — `apps/web/src/views/redesign/NotificationInbox.jsx`

```jsx
/**
 * NotificationInbox — View da Central de Avisos (Web PWA).
 *
 * R-117: lazy-loaded via React.lazy() + Suspense em App.jsx.
 * Usa useNotificationLog (Sprint 8.2) + useUnreadNotificationCount.
 */
import { useEffect } from 'react'
import { ArrowLeft, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNotificationLog } from '@shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '@shared/hooks/useUnreadNotificationCount'
import NotificationList from '@features/notifications/components/NotificationList'
import './NotificationInbox.css'

/**
 * @param {Object} props
 * @param {string} props.userId - ID do usuário autenticado
 * @param {function(string):void} props.onNavigate - Navega para outra view
 * @param {function():void} props.onBack - Volta para a view anterior
 */
export default function NotificationInbox({ userId, onNavigate, onBack }) {
  const { data, isLoading, error } = useNotificationLog({ userId, limit: 30 })
  const { unreadCount, markAllRead } = useUnreadNotificationCount(data)

  useEffect(() => {
    if (!isLoading && data) markAllRead()
  }, [isLoading, data, markAllRead])

  return (
    <motion.div
      className="notif-inbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <header className="notif-inbox__header">
        <button
          className="notif-inbox__back"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="notif-inbox__title-group">
          <h1 className="notif-inbox__title">Central de Avisos</h1>
          {unreadCount > 0 && !isLoading && (
            <motion.span
              className="notif-inbox__badge"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={`${unreadCount} não lidas`}
            >
              {unreadCount}
            </motion.span>
          )}
        </div>

        <div className="notif-inbox__header-icon" aria-hidden="true">
          <Bell size={20} strokeWidth={1.75} />
        </div>
      </header>

      <main className="notif-inbox__content">
        <NotificationList
          data={data}
          isLoading={isLoading}
          error={error}
          onNavigate={onNavigate}
        />
      </main>
    </motion.div>
  )
}
```

---

## Arquivo 8 — `apps/web/src/views/redesign/NotificationInbox.css`

```css
.notif-inbox {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--color-surface, #f9fafb);
}

.notif-inbox__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 14px;
  background: var(--color-surface, #f9fafb);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.notif-inbox__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-surface-raised, #f3f4f6);
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, transform 0.1s ease;
}

.notif-inbox__back:hover           { background: var(--color-border, #e5e7eb); }
.notif-inbox__back:active          { transform: scale(0.93); }
.notif-inbox__back:focus-visible   { outline: 2px solid var(--color-primary, #006a5e); outline-offset: 2px; }

.notif-inbox__title-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.notif-inbox__title {
  font-family: var(--font-display, 'Public Sans', sans-serif);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text-primary, #111827);
  letter-spacing: -0.02em;
  margin: 0;
}

.notif-inbox__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 100px;
  background: var(--color-error, #dc2626);
  color: #fff;
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: 0.6875rem;
  font-weight: 700;
}

.notif-inbox__header-icon {
  color: var(--color-text-muted, #9ca3af);
  flex-shrink: 0;
}

.notif-inbox__content {
  flex: 1;
  padding: 16px 16px 0;
  overflow-y: auto;
}

@media (min-width: 640px) {
  .notif-inbox__content {
    padding: 24px 0 0;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }
  .notif-inbox__header {
    padding: 20px 24px 16px;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .notif-inbox__back { transition: none; }
}
```

---

## Arquivo 9 — `apps/mobile/src/features/notifications/components/NotificationItem.jsx`

```jsx
/**
 * NotificationItem — Item de lista da Central de Avisos (Mobile).
 *
 * Padrão Santuário: espaçamento generoso, ícone circular, tipografia forte.
 * R-167: logs em __DEV__ apenas. R-138: ícone sempre com label. ADR-023: fontWeight ≥ 400.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import {
  Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell, ChevronRight,
} from 'lucide-react-native'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import { colors } from '../../../shared/styles/tokens'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

const DEEP_LINK_LABELS = {
  dashboard: 'Ver doses',
  stock:     'Ver estoque',
  history:   'Ver histórico',
  treatment: 'Ver tratamento',
}

/**
 * @param {Object} props
 * @param {Object} props.notification
 * @param {function(string):void} [props.onNavigate]
 */
export default function NotificationItem({ notification, onNavigate }) {
  const { notification_type, status, sent_at, provider_metadata = {} } = notification

  const { iconName, color, bgColor, label, deepLinkAction } =
    getNotificationIcon(notification_type)

  const IconComponent = ICON_MAP[iconName] ?? Bell
  const relativeTime  = formatRelativeTime(sent_at)
  const preview       = provider_metadata?.message ?? null
  const isFailed      = status === 'falhou' || status === 'failed'
  const hasAction     = deepLinkAction && !!onNavigate

  const content = (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <IconComponent size={20} color={color} strokeWidth={2} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          <Text style={styles.time}>{relativeTime}</Text>
        </View>

        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
        ) : null}

        <View style={styles.footer}>
          <View style={[styles.statusBadge, isFailed ? styles.statusFailed : styles.statusSent]}>
            <Text style={[styles.statusText, isFailed ? styles.statusTextFailed : styles.statusTextSent]}>
              {isFailed ? 'Falhou' : 'Enviada'}
            </Text>
          </View>

          {hasAction && (
            <View style={styles.actionLabel}>
              <Text style={styles.actionText}>{DEEP_LINK_LABELS[deepLinkAction]}</Text>
              <ChevronRight size={13} color={colors.primary ?? '#006a5e'} strokeWidth={2.5} />
            </View>
          )}
        </View>
      </View>
    </View>
  )

  if (hasAction) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate(deepLinkAction)}
        accessibilityRole="button"
        accessibilityLabel={`${label} — ${DEEP_LINK_LABELS[deepLinkAction]}`}
        style={styles.item}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return <View style={styles.item}>{content}</View>
}

const styles = StyleSheet.create({
  item:       { paddingHorizontal: 20, paddingVertical: 14 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  body:       { flex: 1, gap: 4 },
  titleRow:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  label:      { fontSize: 15, fontWeight: '600', color: colors.text?.primary ?? '#111827', flex: 1 },
  time:       { fontSize: 12, fontWeight: '400', color: colors.text?.muted ?? '#9ca3af', flexShrink: 0, fontVariant: ['tabular-nums'] },
  preview:    { fontSize: 13, fontWeight: '400', color: colors.text?.secondary ?? '#4b5563', lineHeight: 19 },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statusBadge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  statusSent:          { backgroundColor: 'rgba(22, 163, 74, 0.10)' },
  statusFailed:        { backgroundColor: 'rgba(220, 38, 38, 0.10)' },
  statusText:          { fontSize: 11, fontWeight: '600' },
  statusTextSent:      { color: colors.success ?? '#16a34a' },
  statusTextFailed:    { color: colors.error ?? '#dc2626' },
  actionLabel:         { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText:          { fontSize: 13, fontWeight: '600', color: colors.primary ?? '#006a5e' },
})
```

---

## Arquivo 10 — `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx`

```jsx
/**
 * NotificationInboxScreen — Central de Avisos (Mobile Native).
 *
 * R-169: SafeAreaView obrigatório. R-180: header 28/800 padrão Santuário.
 * R-184: auto-refresh já no useNotificationLog. R-187: cache key por userId no hook.
 */
import { useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Bell, WifiOff } from 'lucide-react-native'
import { useNotificationLog } from '../../../shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '../../../shared/hooks/useUnreadNotificationCount'
import NotificationItem from '../components/NotificationItem'
import { colors } from '../../../shared/styles/tokens'

export default function NotificationInboxScreen({ navigation, route }) {
  const userId = route?.params?.userId

  const { data, loading, error, stale, refresh } = useNotificationLog({ userId, limit: 30 })
  const { unreadCount, markAllRead } = useUnreadNotificationCount(data, userId)

  useEffect(() => {
    if (!loading && data) markAllRead()
  }, [loading, data, markAllRead])

  const renderItem = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onNavigate={(view) => {
        const tabMap = { dashboard: 'Hoje', stock: 'Estoque', treatment: 'Tratamentos' }
        const tabName = tabMap[view]
        if (tabName) navigation.navigate(tabName)
      }}
    />
  ), [navigation])

  const renderSeparator = useCallback(() => <View style={styles.separator} />, [])

  const renderEmpty = useCallback(() => {
    if (loading) return null
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Bell size={36} color={colors.text?.muted ?? '#9ca3af'} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Nenhuma notificação ainda</Text>
        <Text style={styles.emptyBody}>
          Quando você receber lembretes ou alertas, eles aparecerão aqui.
        </Text>
      </View>
    )
  }, [loading])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header padrão Santuário */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={colors.text?.primary ?? '#111827'} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Central de Avisos</Text>
          {unreadCount > 0 && !loading && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Banner offline */}
      {stale && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color={colors.warning ?? '#d97706'} strokeWidth={2} />
          <Text style={styles.offlineText}>Exibindo dados salvos localmente</Text>
        </View>
      )}

      {/* Loading inicial */}
      {loading && !data && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary ?? '#006a5e'} size="large" />
        </View>
      )}

      {/* Erro */}
      {error && !data && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erro ao carregar: {error}</Text>
        </View>
      )}

      {/* Lista */}
      {(!loading || data) && !error && (
        <FlatList
          data={data ?? []}
          keyExtractor={(item, i) => item.id ?? String(i)}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading && !!data}
              onRefresh={refresh}
              tintColor={colors.primary ?? '#006a5e'}
            />
          }
          contentContainerStyle={data?.length === 0 ? styles.emptyList : styles.listContent}
          showsVerticalScrollIndicator={false}
          accessibilityRole="list"
          accessibilityLabel="Lista de notificações"
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.background?.default ?? '#f9fafb' },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border?.default ?? '#e5e7eb' },
  backButton:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface?.raised ?? '#f3f4f6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:           { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.text?.primary ?? '#111827' },
  unreadBadge:     { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 100, backgroundColor: colors.error ?? '#dc2626', alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  offlineBanner:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(217, 119, 6, 0.20)' },
  offlineText:     { fontSize: 13, fontWeight: '500', color: colors.warning ?? '#d97706' },
  loadingContainer:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer:  { margin: 20, padding: 16, borderRadius: 12, backgroundColor: 'rgba(220, 38, 38, 0.06)' },
  errorText:       { fontSize: 14, color: colors.error ?? '#dc2626', fontWeight: '400' },
  listContent:     { paddingTop: 8, paddingBottom: 40 },
  emptyList:       { flex: 1 },
  separator:       { height: 1, marginHorizontal: 20, backgroundColor: colors.border?.default ?? '#e5e7eb' },
  emptyContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 12 },
  emptyIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface?.raised ?? '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: colors.text?.primary ?? '#111827', textAlign: 'center' },
  emptyBody:       { fontSize: 14, fontWeight: '400', color: colors.text?.muted ?? '#6b7280', textAlign: 'center', lineHeight: 21 },
})
```

---

## Arquivo 11 — `apps/mobile/src/shared/hooks/useUnreadNotificationCount.js`

```js
/**
 * useUnreadNotificationCount — Badge de não-lidas (Mobile).
 *
 * Persiste último acesso via AsyncStorage para sobreviver reinicializações.
 * R-187: chave contém userId para evitar vazamento entre contas.
 */
import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const getStorageKey = (userId) =>
  userId ? `@dosiq/notif-last-seen:${userId}` : '@dosiq/notif-last-seen'

/**
 * @param {Array|null} notifications
 * @param {string} [userId]
 * @returns {{ unreadCount: number, markAllRead: () => void }}
 */
export function useUnreadNotificationCount(notifications, userId) {
  const [lastSeen, setLastSeen] = useState(null)

  useEffect(() => {
    AsyncStorage.getItem(getStorageKey(userId))
      .then((val) => setLastSeen(val))
      .catch(() => {})
  }, [userId])

  const unreadCount = (() => {
    if (!notifications?.length) return 0
    if (!lastSeen) return notifications.length
    const lastSeenTime = new Date(lastSeen).getTime()
    return notifications.filter((n) => {
      if (!n.sent_at) return false
      return new Date(n.sent_at).getTime() > lastSeenTime
    }).length
  })()

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString()
    AsyncStorage.setItem(getStorageKey(userId), now)
      .then(() => setLastSeen(now))
      .catch(() => {})
  }, [userId])

  return { unreadCount, markAllRead }
}
```

---

## Instruções de Integração (Modificações Necessárias)

### `apps/web/src/App.jsx`
```jsx
// 1. Adicionar lazy import (com os outros lazys no topo):
const NotificationInbox = lazy(() => import('./views/redesign/NotificationInbox'))

// 2. Adicionar case no switch de currentView:
case 'notifications':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <NotificationInbox
        userId={userId}
        onNavigate={setCurrentView}
        onBack={() => setCurrentView('dashboard')}
      />
    </Suspense>
  )
```

### `apps/web/src/shared/components/ui/BottomNavRedesign.jsx`
```jsx
// Adicionar na lista navItems:
import { Bell } from 'lucide-react'
// ...
{ id: 'notifications', label: 'Avisos', Icon: Bell },

// Adicionar badge no renderItem (cada item da nav):
// Se item.id === 'notifications' && unreadCount > 0: mostrar badge
```

### `apps/mobile/src/navigation/routes.js`
```js
// Adicionar:
NOTIFICATION_INBOX: 'NotificationInbox',
```

### `apps/mobile/src/navigation/ProfileStack.jsx`
```jsx
// Adicionar screen:
import NotificationInboxScreen from '../features/notifications/screens/NotificationInboxScreen'
// ...
<Stack.Screen
  name={ROUTES.NOTIFICATION_INBOX}
  component={NotificationInboxScreen}
  options={{ headerShown: false }}
/>
```

### `packages/core/src/index.js`
```js
// Adicionar exports:
export { getNotificationIcon, formatRelativeTime } from './utils/notificationIconMapper.js'
```

---

## DoD Checklist (verificar na implementação C4)

- [ ] DoD-1: Usuário acessa Central de Avisos pela nav web (🔔) e mobile (Perfil → "Central de Avisos")
- [ ] DoD-2: Lista exibe notificações do mais novo ao mais antigo
- [ ] DoD-3: Cards mostram ícone por tipo, label, data relativa e status
- [ ] DoD-4: Deep links funcionam (dashboard, stock, history)
- [ ] DoD-5: Badge 🔔 zera ao acessar a tela
- [ ] DoD-6: Estado vazio com mensagem amigável
- [ ] DoD-7: Mobile exibe banner âmbar quando `stale === true`
- [ ] DoD-8: `npm run validate:agent` passa sem erros
- [ ] DoD-9: Nenhuma view existente quebra
