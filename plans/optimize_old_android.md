# 🐛 Fix Android 7 Crash — Runbook Prescritivo

## Contexto
Build `0.2.1` em Android 7 (API 24). Crash ao navegar: **Settings → Inbox → Profile**.
3 fixes independentes, cada um com gate de qualidade. Executar em ordem.

---

## Fix 1: Intl.DateTimeFormat sem try/catch (🔴 CRÍTICO)

**Problema:** Linha 40 de `NotificationPreferencesScreen.jsx` executa `new Intl.DateTimeFormat()` no module scope. Hermes no Android 7 pode não ter Intl completo → exceção não capturada → crash nativo.

**Arquivo:** `apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx`

**Ação:** Substituir linhas 39-42 (o bloco `IS_24H_FORMAT`).

```diff
- // Detecta formato 12/24h do dispositivo (simplificado e memoizado globalmente)
- const IS_24H_FORMAT = !new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
-   .format(new Date(2024, 0, 1, 13))
-   .match(/am|pm/i)
+ // Detecta formato 12/24h com fallback seguro para Hermes/Android antigo
+ let IS_24H_FORMAT = true // fallback: Brasil usa 24h
+ try {
+   IS_24H_FORMAT = !new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
+     .format(new Date(2024, 0, 1, 13))
+     .match(/am|pm/i)
+ } catch {
+   // Hermes sem Intl completo em Android ≤ 7 — fallback 24h (padrão BR)
+   if (__DEV__) console.warn('[NotificationPreferences] Intl.DateTimeFormat indisponível, usando 24h')
+ }
```

**Regras:**
- NÃO alterar nenhum outro código no arquivo
- NÃO alterar a função `formatTimeFriendly` que consome `IS_24H_FORMAT`
- NÃO adicionar imports

### Gate 1
```bash
cd apps/mobile && npx expo export --platform android --dump-sourcemap 2>&1 | tail -5
# Esperado: sem erros de sintaxe
```
Verificação manual: abrir o arquivo e confirmar que `IS_24H_FORMAT` é declarado com `let`, envolvido por `try/catch`, e que o `formatTimeFriendly` abaixo continua inalterado.

**Conhecimento gerado:** `Intl.DateTimeFormat` não é seguro no module scope em Hermes para Android ≤ 7. Sempre usar try/catch. Registrar como `AP-NEW` no DEVFLOW.

---

## Fix 2: `useNotificationLog` não respeita `enabled` (🟡 ALTO)

**Problema:** `ProfileScreen` chama `useNotificationLog({ userId, limit: 30, enabled: !!user?.id })` mas o hook **ignora o parâmetro `enabled`** — sempre faz fetch + registra AppState listener + timer de meia-noite. Resultado: 2 instâncias do hook (Profile + Inbox) executam em paralelo no navigation stack, ~8 queries Supabase concorrentes.

**Arquivo:** `apps/mobile/src/shared/hooks/useNotificationLog.js`

**Ação 1:** Adicionar `enabled` ao destructuring na linha 97.

```diff
  export function useNotificationLog(options = {}) {
-   const { userId, limit = 20, offset = 0 } = options
+   const { userId, limit = 20, offset = 0, enabled = true } = options
```

**Ação 2:** Condicionar o `load` na linha 107-111 para respeitar `enabled`.

```diff
    const load = useCallback(async () => {
-     if (!userId) {
+     if (!userId || !enabled) {
        setLoading(false)
        return
      }
```

**Ação 3:** Condicionar o effect de AppState + midnight (linhas 169-204) para só ativar quando `enabled`.

```diff
    useEffect(() => {
+     if (!enabled) return
+
      let midnightTimer
  
      const scheduleMidnightRefresh = () => {
```

**Ação 4:** Adicionar `enabled` ao array de deps do `load` callback (linha 157).

```diff
-   }, [userId, limit, offset])
+   }, [userId, limit, offset, enabled])
```

**Regras:**
- NÃO alterar a função `enrichWithDoses`
- NÃO alterar o repositório singleton `repo`
- NÃO alterar a lógica de cache/AsyncStorage dentro de `load`
- Manter o JSDoc do hook — adicionar `@param {boolean} [options.enabled=true]`

### Gate 2
```bash
# Verificar que o hook aceita enabled
grep -n "enabled" apps/mobile/src/shared/hooks/useNotificationLog.js
# Esperado: 4 ocorrências (destructuring, load guard, effect guard, deps array)
```
Verificação lógica: Quando `enabled=false`, o hook DEVE retornar `{ data: null, loading: false, error: null, stale: false }` e NÃO registrar nenhum listener de AppState nem timer.

**Conhecimento gerado:** Hooks com side effects (timers, listeners, network) DEVEM aceitar `enabled` flag para serem usáveis em contextos condicionais. Padrão SWR/TanStack Query.

---

## Fix 3: Substituir `useNotificationLog` no ProfileScreen por badge leve (🟡 MÉDIO)

**Problema:** `ProfileScreen` usa `useNotificationLog` (4+ queries Supabase + enrichment + AppState listener) **apenas para exibir um badge numérico**. Isso é desproporcionalmente caro. O hook `useUnreadNotificationCount` já faz `AsyncStorage.getItem` para calcular o count — podemos usar o count do AsyncStorage diretamente sem carregar todos os logs.

**Arquivo:** `apps/mobile/src/features/profile/screens/ProfileScreen.jsx`

**Ação 1:** Criar hook leve. Criar arquivo `apps/mobile/src/shared/hooks/useUnreadBadgeCount.js`:

```js
/**
 * useUnreadBadgeCount — Badge leve de não-lidas (sem fetch de logs).
 *
 * Lê apenas o AsyncStorage para comparar last-seen com um count RPC simples.
 * Alternativa leve ao useNotificationLog para contextos que só precisam do badge.
 */
import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../platform/supabase/nativeSupabaseClient'

const getStorageKey = (userId) =>
  userId ? `@dosiq/notif-last-seen:${userId}` : '@dosiq/notif-last-seen'

/**
 * @param {string|null} userId
 * @returns {{ unreadCount: number, refreshBadge: () => Promise<void> }}
 */
export function useUnreadBadgeCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshBadge = useCallback(async () => {
    if (!userId) return
    try {
      const lastSeen = await AsyncStorage.getItem(getStorageKey(userId))
      const query = supabase
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (lastSeen) {
        query.gt('sent_at', lastSeen)
      }
      const { count, error } = await query
      if (!error) setUnreadCount(count ?? 0)
    } catch {
      // Silencioso — badge é cosmético
    }
  }, [userId])

  useEffect(() => { refreshBadge() }, [refreshBadge])

  return { unreadCount, refreshBadge }
}
```

**Ação 2:** Atualizar `ProfileScreen.jsx` — substituir imports e hook calls (linhas 12-13 e 23-24):

```diff
- import { useNotificationLog } from '../../../shared/hooks/useNotificationLog'
- import { useUnreadNotificationCount } from '../../../shared/hooks/useUnreadNotificationCount'
+ import { useUnreadBadgeCount } from '../../../shared/hooks/useUnreadBadgeCount'
```

```diff
    const { user, loading, error, refresh } = useProfile()
  
-   const { data: notifData } = useNotificationLog({ userId: user?.id, limit: 30, enabled: !!user?.id })
-   const { unreadCount } = useUnreadNotificationCount(notifData, user?.id)
+   const { unreadCount } = useUnreadBadgeCount(user?.id)
```

**Regras:**
- NÃO alterar o restante do JSX do `ProfileScreen`
- NÃO deletar `useNotificationLog` nem `useUnreadNotificationCount` — eles ainda são usados pelo `NotificationInboxScreen`
- O novo hook `useUnreadBadgeCount` faz exatamente **1 query** (count com head:true) vs as 4+ anteriores
- O badge é cosmético — erros silenciados é aceitável

### Gate 3
```bash
# Verificar que ProfileScreen não importa mais useNotificationLog
grep -c "useNotificationLog" apps/mobile/src/features/profile/screens/ProfileScreen.jsx
# Esperado: 0

# Verificar que o novo hook existe
test -f apps/mobile/src/shared/hooks/useUnreadBadgeCount.js && echo "OK" || echo "MISSING"
# Esperado: OK

# Verificar que InboxScreen ainda usa o hook original
grep -c "useNotificationLog" apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx
# Esperado: 1
```

**Conhecimento gerado:** Para badges/contadores, usar `select('id', { count: 'exact', head: true })` — retorna apenas o count sem payload. Nunca carregar N registros inteiros para calcular `.length`.

---

## Verificação Final Integrada

Após os 3 fixes:

```bash
cd apps/mobile

# 1. Lint (se configurado)
npx eslint src/features/profile/screens/NotificationPreferencesScreen.jsx \
           src/features/profile/screens/ProfileScreen.jsx \
           src/shared/hooks/useNotificationLog.js \
           src/shared/hooks/useUnreadBadgeCount.js \
  --no-eslintrc --rule '{"no-unused-vars":"warn"}' 2>&1 | head -20

# 2. Build de produção Android
eas build --platform android --profile production --non-interactive

# 3. Instalar no Android 7 e testar o fluxo exato:
#    Profile → Inbox → ⚙️ Settings → alterar algo → voltar → voltar → Profile
#    Resultado esperado: sem crash
```

---

## Resumo para Delegação

| Fix | Arquivo(s) | Complexidade | Pode delegar a Haiku/Flash? |
|-----|-----------|-------------|---------------------------|
| 1 | `NotificationPreferencesScreen.jsx` | Trivial (4 linhas) | ✅ Sim — diff exato fornecido |
| 2 | `useNotificationLog.js` | Baixa (4 edits pontuais) | ✅ Sim — cada edit é independente |
| 3 | `ProfileScreen.jsx` + novo `useUnreadBadgeCount.js` | Média (novo arquivo) | ✅ Sim — código completo fornecido |

> [!IMPORTANT]
> **Ordem de execução:** Fix 1 → Gate 1 → Fix 2 → Gate 2 → Fix 3 → Gate 3 → Verificação Final.
> Cada fix é um commit separado. Não agrupar.
