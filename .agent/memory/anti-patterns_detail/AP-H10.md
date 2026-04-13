# AP-H10: Sessão Supabase não persiste em React Native sem auth-aware navigation

**Descoberto em:** 2026-04-12 (Wave H4 — Mobile Scaffold)
**Tempo perdido:** ~30min após resolver os crashes principais
**Severidade:** HIGH — app funcional mas pede login sempre que é reaberta

---

## O Problema

Após resolver os crashes de arranque (AP-H08, AP-H09) e implementar SecureStore chunked
para guardar tokens grandes, a sessão ainda não persistia entre aberturas do app.

**Sintoma:** Login funciona, app usa a sessão, mas ao fechar e reabrir o app pede login de novo.

**Causa raiz:** O `Navigation.jsx` tinha `initialRouteName={ROUTES.SMOKE}` fixo, ou seja,
independentemente de existir uma sessão guardada no SecureStore, o app sempre começava
no ecrã de Smoke/Login.

O Supabase restaura a sessão do SecureStore de forma assíncrona — mas se o Navigator já
foi montado com `initialRouteName` fixo, essa restauração não muda a rota inicial.

---

## Por que SecureStore chunked é necessário mas não suficiente?

```
SecureStore chunked → garante que o token é guardado sem corrupção (>2048 bytes)
auth-aware navigation → garante que a sessão restaurada é usada na rota inicial

SEM chunked: token pode ser truncado/perdido ao guardar → sessão inválida ao restaurar
COM chunked MAS SEM auth-aware: token restaurado correctamente mas Navigation ignora-o
```

Os dois são necessários em conjunto.

---

## A Solução

`Navigation.jsx` deve:
1. Chamar `supabase.auth.getSession()` no mount para restaurar sessão persistida
2. Mostrar spinner enquanto resolve (evita flash de ecrã errado)
3. Usar `initialRouteName={session ? ROUTES.HOME : ROUTES.SMOKE}` dinâmico
4. Subscrever `onAuthStateChange` para actualizações em tempo real (login/logout)

```jsx
export default function Navigation() {
  // undefined = a verificar; null = sem sessão; object = sessão activa
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // Restaurar sessão persistida no SecureStore
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null)
    })

    // Actualizar em tempo real quando auth muda (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Aguarda verificação inicial — evita flash de ecrã errado
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={session ? ROUTES.HOME : ROUTES.SMOKE}>
        {/* ... */}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
```

### Estados do `session`:
- `undefined` — a verificar (spinner)
- `null` — sem sessão → ir para SmokeScreen
- `object` — sessão activa → ir para HomeScreen directamente

---

## Padrão de Três Estados (Obrigatório)

**Usar `useState(undefined)`, NUNCA `useState(null)` como valor inicial:**

```js
// CORRECTO ✅ — distingue "a verificar" de "sem sessão"
const [session, setSession] = useState(undefined)

// ERRADO ❌ — null inicial é indistinguível de "sem sessão confirmada"
const [session, setSession] = useState(null)  // sempre mostra login antes de verificar
```

O três estados previnem o "flash de login" onde o utilizador vê o ecrã de login por um
instante antes de ser redirecionado para Home.

---

## Fluxo Completo de Autenticação Persistente

```
1. App abre
2. Navigation monta → session = undefined → mostra spinner
3. getSession() → consulta SecureStore via secureStoreAuthStorage
4. SecureStore devolve token (em chunks se necessário)
5. Supabase valida token com backend
6. setSession(s ?? null) → session = objeto ou null
7. NavigationContainer monta com initialRouteName correcto
8. Utilizador vê directamente HomeScreen (se sessão válida) ✅
```

---

## Checklist de Prevenção

- [ ] `useState(undefined)` para session state — NUNCA `useState(null)` inicial
- [ ] `getSession()` no mount de Navigation — sempre, sem excepção
- [ ] Spinner enquanto `session === undefined`
- [ ] `initialRouteName` dinâmico baseado em `session`
- [ ] `onAuthStateChange` subscription para cobertura de login/logout em runtime
- [ ] `return () => subscription.unsubscribe()` no cleanup do useEffect

---

## Ficheiros Relevantes

- `apps/mobile/src/navigation/Navigation.jsx` — implementação completa
- `apps/mobile/src/platform/auth/secureStoreAuthStorage.js` — chunked storage (pré-requisito)
- `apps/mobile/src/platform/supabase/nativeSupabaseClient.js` — cliente com storage customizado

**Regra relacionada:** R-164
**Dependência:** AP-H08 (SecureStore chunked deve estar implementado primeiro)
