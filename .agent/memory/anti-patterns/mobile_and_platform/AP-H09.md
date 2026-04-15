---
id: AP-H09
title: registerRootComponent do Expo SDK 53 activa expo-router quando src/app/ existe
summary: registerRootComponent detecta transform.routerRoot=app no URL do bundle (Expo Go) e tenta inicializar expo-router. Fix: usar AppRegistry.registerComponent('main', () => App) directamente do react-native.
applies_to:
  - mobile
  - expo
  - expo-go
tags:
  - mobile
  - expo
  - expo-router
  - app-registry
trigger_count: 1
last_triggered: 2026-04-12
expiry_date: 2027-04-12
status: active
related_rule: R-163
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-H09: registerRootComponent do Expo SDK 53 activa expo-router automaticamente

**Descoberto em:** 2026-04-12 (Wave H4 — Mobile Scaffold)
**Tempo perdido:** ~1h — erro enigmático sem mensagem clara de "expo-router"
**Severidade:** CRÍTICO — crash total ao arranque

---

## O Problema

`registerRootComponent` do Expo SDK 53 detecta a presença de expo-router através de dois
mecanismos e tenta inicializá-lo mesmo que não esteja instalado:

### Mecanismo 1: `transform.routerRoot=app` no URL do bundle
O Expo Go envia o parâmetro `transform.routerRoot=app` no URL de carregamento do bundle.
`registerRootComponent` lê este parâmetro e assume que o projecto usa expo-router.

### Mecanismo 2: Directório `src/app/`
Se o directório `src/app/` existe, o Expo CLI e o `registerRootComponent` assumem
automaticamente que é um projecto expo-router.

### Erro resultante
```
TypeError: Cannot read property 'get' of undefined
```
(sem qualquer menção a "expo-router" na stack trace — muito difícil de diagnosticar)

A stack trace aponta para `NativeModules`, `AppRegistry`, depois para o entrypoint,
mas o erro real é a tentativa de importar `expo-router` que não está instalado.

---

## A Solução

### 1. Renomear `src/app/` para `src/navigation/`

```bash
# ANTES — activava expo-router automaticamente
apps/mobile/src/app/AppRoot.jsx
apps/mobile/src/app/Navigation.jsx
apps/mobile/src/app/routes.js

# DEPOIS — directório sem significado especial para o Expo
apps/mobile/src/navigation/AppRoot.jsx
apps/mobile/src/navigation/Navigation.jsx
apps/mobile/src/navigation/routes.js
```

Actualizar todos os imports em ficheiros que referenciam `../app/`:
- `App.js` — `import AppRoot from './src/navigation/AppRoot'`
- `SmokeScreen.jsx` — `import { ROUTES } from '../navigation/routes'`
- etc.

### 2. Usar `AppRegistry` directamente em vez de `registerRootComponent`

```js
// index.js — CORRECTO ✅
import './polyfills'
// AppRegistry direto do RN: bypass do registerRootComponent do Expo SDK 53
// O registerRootComponent detecta transform.routerRoot=app do Expo Go e tenta
// inicializar expo-router — que não está instalado — causando crash (AP-H09)
import { AppRegistry } from 'react-native'
import App from './App'

AppRegistry.registerComponent('main', () => App)
```

```js
// index.js — ERRADO ❌ (com Expo SDK 53 + Expo Go + sem expo-router)
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)  // CRASH em Expo Go se não tiver expo-router instalado
```

---

## Por que `AppRegistry` directamente é seguro?

- `AppRegistry.registerComponent('main', () => App)` é a API nativa do React Native
- Não tem hooks de expo-router, não lê `transform.routerRoot`, não detecta directórios
- O nome `'main'` é o nome registado que o Expo Go procura (configurado em `app.json`)
- Funciona tanto em Expo Go como em builds nativas (EAS Build)

---

## Jornada de Debugging

1. **Erro:** `Cannot read property 'get' of undefined` desde o arranque
2. **Hipótese 1:** Supabase a causar o crash → removemos Supabase → ainda crash
3. **Hipótese 2:** react-native-url-polyfill → removemos → ainda crash
4. **Hipótese 3:** expo-dev-client → removemos → erro mudou ligeiramente
5. **Teste de isolamento Layer 0:** App.js retorna só `<View><Text>OK</Text></View>` → ainda crash
6. **Insight:** se um `<View>` simples crasha, o problema é no entrypoint/bootstrap
7. **Descoberta:** `registerRootComponent` em Expo Go SDK 53 → crash confirmado
8. **Fix:** `AppRegistry.registerComponent('main', () => App)` → Layer 0 funciona ✅
9. **Fix adicional:** renomear `src/app/` → `src/navigation/` para eliminar detecção por directório

---

## Directórios Reservados pelo Expo SDK 53

Não usar estes nomes de directório em projectos sem expo-router:
- `src/app/` — detectado como root do expo-router
- `app/` (na raiz) — idem

Nomes seguros: `src/navigation/`, `src/screens/`, `src/router/`

---

## Checklist de Prevenção

- [ ] NUNCA usar `src/app/` em projectos Expo sem expo-router instalado
- [ ] NUNCA usar `registerRootComponent` em Expo Go SDK 53 sem expo-router
- [ ] Usar `AppRegistry.registerComponent('main', () => App)` como entrypoint
- [ ] Se migrar de expo-router → remover o directório `src/app/` ou renomear

---

## Ficheiros Relevantes

- `apps/mobile/index.js` — entrypoint com AppRegistry
- `apps/mobile/src/navigation/` — directório renomeado de `src/app/`

**Regra relacionada:** R-163
