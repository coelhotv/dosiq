# Exec Spec Hibrido - Addendum: Deep Links e Routing Native

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 5 e Fase 6
> **Objetivo:** congelar como o app mobile representa rotas, trata deep links e encaminha taps em notificacoes sem improviso

---

## 1. Papel deste addendum

Este documento existe para impedir que agentes diferentes:

- inventem nomes de rotas inconsistentes
- tratem notificacao por string solta
- ignorem o estado autenticado do usuario
- abram telas erradas quando o app vem de background ou cold start

Ele define:

- scheme canonicamente aceito
- tabela minima de rotas
- contrato de deep link
- fluxo de pending intent
- comportamento por estado do app

---

## 2. Decisoes congeladas

### DL-001. Scheme canonico

O scheme nativo do projeto e:

- `meusremedios://`

### DL-002. Rotas devem nascer de um registro central

Nao criar strings de rota espalhadas pelo app.

Deve existir um modulo canonico, por exemplo:

- `apps/mobile/src/app/routes.js`

### DL-003. Taps em notificacao navegam por contrato

O payload de notificacao deve carregar informacao suficiente para gerar navegacao segura.

Minimo recomendado:

```js
{
  kind: 'dose_reminder',
  deeplink: 'meusremedios://today?protocolId=123',
  navigation: {
    screen: 'Today',
    params: { protocolId: '123' }
  }
}
```

### DL-004. Navegacao autenticada e obrigatoria

Se o usuario tocar numa notificacao ou deep link e nao estiver autenticado:

- o app nao perde o intent
- o app leva para login
- o app conclui a navegacao apos login

### DL-005. Universal Links e App Links ficam adiados

Nesta etapa, o contrato obrigatorio e apenas de scheme nativo.

Nao implementar:

- universal links
- Android app links

Sem decisao explicita posterior.

---

## 3. Tabela minima de rotas canonicamente suportadas

```js
export const ROUTES = {
  TODAY: 'Today',
  TREATMENTS: 'Treatments',
  STOCK: 'Stock',
  PROFILE: 'Profile',
  DOSE_REGISTER: 'DoseRegister',
  NOTIFICATION_PREFERENCES: 'NotificationPreferences',
  TELEGRAM_CONNECT: 'TelegramConnect',
  LOGIN: 'Login',
}
```

### Regra

Nomes podem mudar, mas precisam ser:

- unicos
- estaveis
- centralizados

---

## 4. Formato canonico dos deep links

## 4.1. Rotas obrigatorias

- `meusremedios://today`
- `meusremedios://today?protocolId=<id>`
- `meusremedios://treatments`
- `meusremedios://stock`
- `meusremedios://profile`
- `meusremedios://notifications/preferences`
- `meusremedios://telegram/connect?token=<token>`

## 4.2. Regra

Nao criar path arbitrario por feature sem registrar no modulo central.

## 4.3. Builder canonico

Exemplo:

```js
export function buildDeepLink(path, params = {}) {
  const search = new URLSearchParams(params).toString()
  return search ? `meusremedios://${path}?${search}` : `meusremedios://${path}`
}
```

---

## 5. Linking config obrigatorio

Exemplo base:

```js
export const linking = {
  prefixes: ['meusremedios://'],
  config: {
    screens: {
      Today: 'today',
      Treatments: 'treatments',
      Stock: 'stock',
      Profile: 'profile',
      NotificationPreferences: 'notifications/preferences',
      TelegramConnect: 'telegram/connect',
    },
  },
}
```

### Regra

O app deve ter uma unica configuracao de linking.

Nao criar parse manual em varios componentes.

---

## 6. Pending intent obrigatorio

## 6.1. Problema

Notificacao ou deep link pode chegar quando:

- o usuario esta deslogado
- a navegacao ainda nao foi montada
- a sessao ainda esta restaurando

## 6.2. Comportamento obrigatorio

Nesses casos:

1. salvar intent em storage aprovado (nao apenas memoria)
2. levar o usuario ao login/bootstrap correto
3. apos sessao valida, consumir intent uma unica vez

### Distincao por estado do app

**Background (app em memoria):** variavel em memoria e suficiente.

**Cold start (app foi terminado):** a variavel em memoria nao existe. O intent deve ser:

- capturado via `expo-notifications` `getLastNotificationResponseAsync()` no bootstrap
- ou persistido em `AsyncStorage` com chave efemera (`pending_intent`) e TTL curto (5 min)

**Cold start deslogado:** o intent deve ser persistido em `AsyncStorage` antes de mostrar login, e consumido apos autenticacao bem-sucedida.

### Implementacao correta

```js
import AsyncStorage from '@react-native-async-storage/async-storage'

const PENDING_INTENT_KEY = 'pending_intent'
const INTENT_TTL_MS = 5 * 60 * 1000 // 5 minutos

// In-memory fallback para o caso background
let memoryIntent = null

export async function setPendingIntent(intent) {
  memoryIntent = intent
  await AsyncStorage.setItem(PENDING_INTENT_KEY, JSON.stringify({
    intent,
    savedAt: Date.now(),
  }))
}

export async function consumePendingIntent() {
  // Tentar memoria primeiro (background case)
  if (memoryIntent) {
    const intent = memoryIntent
    memoryIntent = null
    await AsyncStorage.removeItem(PENDING_INTENT_KEY)
    return intent
  }

  // Fallback para storage (cold start case)
  const raw = await AsyncStorage.getItem(PENDING_INTENT_KEY)
  if (!raw) return null

  await AsyncStorage.removeItem(PENDING_INTENT_KEY)

  try {
    const { intent, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > INTENT_TTL_MS) return null // expirado
    return intent
  } catch {
    return null
  }
}
```

### Regra

Se o intent nao puder ser resolvido, o app deve cair para uma rota segura.

Fallback canonico:

- `Today`

---

## 7. Comportamento por estado do app

## 7.1. Cold start

Ao abrir o app por notificacao ou deep link:

- montar bootstrap
- restaurar sessao
- resolver pending intent
- navegar para tela final

## 7.2. Background

Se o app ja estiver em background:

- ao tocar na notificacao, navegar para a rota alvo
- preservar estado minimo quando possivel

## 7.3. Foreground

Se a notificacao chegar com o app aberto:

- nao navegar automaticamente sem interacao do usuario
- exibir UI adequada de foreground ou deixar notificacao tratavel

### Regra

Foreground nao deve arrancar o usuario da tela atual por conta propria.

---

## 8. Routing por notificacao

## 8.1. Payload minimo recomendado

```js
{
  kind: 'dose_reminder',
  deeplink: 'meusremedios://today?protocolId=abc',
  navigation: {
    screen: 'Today',
    params: { protocolId: 'abc' }
  },
  metadata: {
    protocolId: 'abc',
    medicineId: 'xyz'
  }
}
```

## 8.2. Resolver de notificacao

Deve existir uma funcao unica, por exemplo:

- `resolveNotificationNavigation(payload)`

Exemplo:

```js
export function resolveNotificationNavigation(payload) {
  if (payload?.navigation?.screen) {
    return payload.navigation
  }

  return { screen: 'Today', params: {} }
}
```

---

## 9. Regras de fallback

Se qualquer dado estiver invalido:

- tela inexistente
- params invalidos
- entidade ausente

Entao:

1. logar erro sanitizado
2. navegar para `Today`
3. opcionalmente exibir toast curto

### Proibido

- crashar o app
- deixar o usuario em tela branca
- prender a navegacao num loop de redirect

---

## 10. Ownership por fase

## 10.1. Fase 5 deve sair com

- registro central de rotas
- linking config minima
- deep links internos coerentes para rotas do MVP
- suporte a pending intent para login/roteamento interno quando necessario

## 10.2. Fase 6 deve sair com

- tap em notificacao roteando corretamente
- comportamento definido para foreground/background/cold start
- payloads de notificacao gerando navigacao segura

---

## 11. Testes obrigatorios

- parse de deep link valido
- fallback para rota segura
- pending intent consumido uma unica vez
- notificacao tocada com usuario autenticado
- notificacao tocada com usuario deslogado

### Teste manual obrigatorio

1. abrir app via `meusremedios://today`
2. abrir app via `meusremedios://telegram/connect?token=abc`
3. tocar notificacao com app fechado
4. tocar notificacao com app em background
5. receber notificacao em foreground e validar que nao houve redirecionamento abrupto

---

## 12. Ancoragem e validacao contra a master spec

- Este addendum nao antecipa universal links nem app links.
- Este addendum respeita o shell MVP definido para o mobile.
- Este addendum fecha a lacuna entre payload de notificacao e navegacao real.
- Este addendum evita rotas improvisadas ou strings espalhadas.

Se qualquer implementacao derivada quebrar estes pontos, ela esta desalinhada com a estrategia hibrida do projeto.
