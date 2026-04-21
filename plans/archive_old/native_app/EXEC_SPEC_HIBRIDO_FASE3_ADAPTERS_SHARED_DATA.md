# Exec Spec Hibrido - Fase 3: Adapters e Shared Data

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 2 concluida
> **Objetivo da fase:** criar contratos compartilhados e extrair a camada de dados adaptada por injecao, sem ainda construir o app mobile funcional

---

## 1. Papel desta fase

Esta fase e a ponte entre:

- o `packages/core` puro da Fase 2
- o futuro app mobile da Fase 4

O objetivo desta fase e retirar da web o que **nao e UI**, mas que hoje ainda esta acoplado a browser, env e singleton da aplicacao.

Esta fase **faz**:

- `packages/storage` real
- `packages/config` real
- `packages/shared-data` real
- nova arquitetura de query cache por injecao
- factories/repositorios por injecao de dependencias
- bootstrap web adaptado aos novos contratos

Esta fase **nao faz**:

- app Expo real ainda
- React Navigation
- `expo-secure-store`
- `AsyncStorage` real em execucao no mobile
- notificacoes nativas
- migracao de banco

---

## 2. Resultado esperado da fase

Ao final desta fase, a aplicacao web deve:

- continuar compilando normalmente
- continuar funcionando normalmente
- deixar de depender estruturalmente de `window.localStorage` dentro da camada compartilhada
- deixar de depender estruturalmente de `import.meta.env` dentro da camada compartilhada

Ao final desta fase, o projeto deve ter:

- contrato de storage async
- contrato de config
- construtor/factory de Supabase por plataforma
- query cache compartilhado sem hidratacao em import
- hook web consumindo a nova camada, mas permanecendo no app web

---

## 3. Regras de ouro da fase

### R3-001. `packages/shared-data` nao pode conhecer plataforma

`packages/shared-data` pode conhecer:

- interfaces
- factories
- dependencias injetadas

`packages/shared-data` nao pode conhecer:

- `window`
- `document`
- `navigator`
- `localStorage`
- `import.meta.env`
- `process.env`
- `expo-*`
- `react-native`

### R3-002. Nenhum singleton global no compartilhado

Esta proibido em `packages/shared-data`:

- criar `supabase` singleton no import
- inicializar cache no import
- ler config no import

Tudo deve ser criado por funcao `create*()` ou `init*()`.

### R3-003. Hook React continua na plataforma

`useCachedQuery` e hooks similares **nao** entram no pacote compartilhado como hook React.

Separacao obrigatoria:

- `packages/shared-data`: engine/query cache sem React
- app web: hook React que consome essa engine
- app mobile: hook proprio depois, se necessario

### R3-004. Storage shared e async-first

O contrato e obrigatoriamente assincorno, mesmo na web.

### R3-005. Config shared e sempre injetada

Nenhum modulo compartilhado pode ler:

- `import.meta.env`
- `process.env`

O app web le do ambiente e injeta.

O app mobile le do ambiente native e injeta.

### R3-006. A web continua sendo o canario

Toda mudanca desta fase deve ser validada na web primeiro.

Se a web nao conseguir usar a nova camada sem regressao, a fase falhou.

---

## 4. Estrutura alvo obrigatoria ao fim da fase

```text
packages/
├── core/
├── storage/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── contracts.js
│       ├── json.js
│       ├── webStorage.js
│       └── memoryStorage.js
├── config/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── contracts.js
│       ├── validateConfig.js
│       └── createPublicAppConfig.js
└── shared-data/
    ├── package.json
    └── src/
        ├── index.js
        ├── query-cache/
        │   ├── createQueryCache.js
        │   └── cacheKeys.js
        ├── supabase/
        │   ├── createSupabaseClient.js
        │   └── createSupabaseDependencies.js
        ├── repositories/
        │   └── ...
        └── services/
            └── ...
```

Na web, devem existir bootstrap/adapters locais, por exemplo:

```text
src/shared/platform/
├── config/
│   └── publicAppConfig.js
├── storage/
│   └── webStorageAdapter.js
├── supabase/
│   └── webSupabaseClient.js
└── query-cache/
    └── webQueryCache.js
```

O nome exato das pastas pode variar, mas a separacao de responsabilidade nao pode variar.

---

## 5. Contratos obrigatorios da fase

## 5.1. Storage contract obrigatorio

Criar em `packages/storage/src/contracts.js`:

```js
export function assertStorageAdapter(adapter) {
  if (!adapter) throw new Error('Storage adapter is required')

  const required = ['getItem', 'setItem', 'removeItem']

  for (const method of required) {
    if (typeof adapter[method] !== 'function') {
      throw new Error(`Storage adapter missing method: ${method}`)
    }
  }
}
```

Interface operacional:

```js
export async function getItem(key) {}
export async function setItem(key, value) {}
export async function removeItem(key) {}
export async function getJSON(key, fallback = null) {}
export async function setJSON(key, value) {}
```

## 5.2. Config contract obrigatorio

Criar em `packages/config/src/contracts.js` um validador para config publica:

```js
export function assertPublicAppConfig(config) {
  if (!config?.supabaseUrl) throw new Error('Missing supabaseUrl')
  if (!config?.supabaseAnonKey) throw new Error('Missing supabaseAnonKey')
}
```

Shape minimo:

```js
{
  supabaseUrl,
  supabaseAnonKey,
  detectSessionInUrl,
  appEnv,
}
```

## 5.3. Supabase dependency factory obrigatoria

`packages/shared-data` nao cria cliente no topo do modulo.

Obrigatorio criar factory do tipo:

```js
export function createSupabaseDependencies({
  url,
  anonKey,
  authStorage,
  detectSessionInUrl,
  createClientImpl,
}) {
  return {
    supabase: createClientImpl(url, anonKey, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl,
      },
    }),
  }
}
```

### Regra importante

`createClientImpl` deve ser injetado.

Nao importar diretamente `createClient` dentro do core puro, mas pode ser usado em `shared-data` desde que por factory e sem ler env.

---

## 6. Sprint interno 3.1 - Implementar `packages/storage`

### Objetivo

Criar camada de storage compartilhavel, assincorna e segura para web/native.

### Arquivos obrigatorios

- `packages/storage/src/contracts.js`
- `packages/storage/src/index.js`
- `packages/storage/src/json.js`
- `packages/storage/src/webStorage.js`
- `packages/storage/src/memoryStorage.js`

### `webStorage.js` - exemplo prescritivo

```js
import { assertStorageAdapter } from './contracts.js'

export function createWebStorageAdapter(storage) {
  if (!storage) throw new Error('Web storage provider is required')

  const adapter = {
    async getItem(key) {
      return storage.getItem(key)
    },
    async setItem(key, value) {
      storage.setItem(key, value)
    },
    async removeItem(key) {
      storage.removeItem(key)
    },
  }

  assertStorageAdapter(adapter)
  return adapter
}
```

### `memoryStorage.js`

Usar para testes e fallback:

```js
export function createMemoryStorageAdapter() {
  const store = new Map()

  return {
    async getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    async setItem(key, value) {
      store.set(key, value)
    },
    async removeItem(key) {
      store.delete(key)
    },
  }
}
```

### `json.js`

```js
export async function getJSON(adapter, key, fallback = null) {
  const raw = await adapter.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function setJSON(adapter, key, value) {
  await adapter.setItem(key, JSON.stringify(value))
}
```

### Proibicoes

- nao criar singleton global de storage nesta fase
- nao inicializar storage em import
- nao depender de `window` dentro do pacote, exceto no adapter web explicitamente isolado

---

## 7. Sprint interno 3.2 - Implementar `packages/config`

### Objetivo

Padronizar config publica por injecao.

### Arquivos obrigatorios

- `packages/config/src/contracts.js`
- `packages/config/src/validateConfig.js`
- `packages/config/src/createPublicAppConfig.js`
- `packages/config/src/index.js`

### Exemplo `createPublicAppConfig.js`

```js
import { assertPublicAppConfig } from './contracts.js'

export function createPublicAppConfig(input) {
  const config = {
    supabaseUrl: input.supabaseUrl,
    supabaseAnonKey: input.supabaseAnonKey,
    detectSessionInUrl: Boolean(input.detectSessionInUrl),
    appEnv: input.appEnv ?? 'development',
  }

  assertPublicAppConfig(config)
  return config
}
```

### Regra obrigatoria

Leitura de `import.meta.env` deve ficar no app web, por exemplo:

```js
// src/shared/platform/config/publicAppConfig.js
import { createPublicAppConfig } from '@dosiq/config'

export const publicAppConfig = createPublicAppConfig({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  detectSessionInUrl: true,
  appEnv: import.meta.env.MODE,
})
```

### Proibicao

Nao criar arquivo dentro de `packages/config` que leia `import.meta.env` diretamente.

---

## 8. Sprint interno 3.3 - Reescrever o query cache como engine compartilhada

### Objetivo

Remover a dependencia estrutural de `window.localStorage` e da hidratacao em import.

### Problemas do cache atual que precisam sumir

O cache atual:

- persiste com `localStorage`
- hidrata no import do modulo
- depende de `window`

Esses comportamentos estao proibidos na camada compartilhada.

### Arquivos obrigatorios

- `packages/shared-data/src/query-cache/createQueryCache.js`
- `packages/shared-data/src/query-cache/cacheKeys.js`

### Contrato obrigatorio

O cache deve nascer por factory:

```js
export function createQueryCache({
  storage,
  logger,
  staleTime = 30_000,
  maxEntries = 200,
  persistKey = 'meus_remedios_query_cache',
}) {}
```

### Metodos obrigatorios

- `init()`
- `cachedQuery(key, fetcher, options)`
- `invalidate(key)`
- `clear()`
- `generateKey(baseKey, params)`

### Regra obrigatoria

`init()` deve ser chamada explicitamente no bootstrap da plataforma.

Proibido:

```js
// errado
if (typeof window !== 'undefined') {
  hydrateCache()
}
```

### Exemplo de fluxo correto

```js
const queryCache = createQueryCache({
  storage: webStorageAdapter,
  logger,
})

await queryCache.init()
```

### Persistencia

Persistencia deve usar o adapter recebido:

```js
await setJSON(storage, persistKey, entries)
```

Nao pode usar:

```js
localStorage.setItem(...)
```

---

## 9. Sprint interno 3.4 - Separar engine de cache do hook React

### Objetivo

Garantir que React continue na app web e a engine fique compartilhada.

### Decisao obrigatoria

`useCachedQuery` **nao** vai para `packages/shared-data` como hook.

Fica assim:

- `packages/shared-data`: `createQueryCache`
- web: `useCachedQueryWeb` ou manutencao do nome `useCachedQuery`

### Exemplo de adaptacao web

```js
// src/shared/hooks/useCachedQuery.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { webQueryCache } from '@shared/platform/query-cache/webQueryCache'

export function useCachedQuery(key, fetcher, options = {}) {
  // hook continua React-specific
  // engine vem de webQueryCache
}
```

### Regra

O nome do hook pode continuar o mesmo para reduzir churn, mas a engine deve ter sido extraida.

---

## 10. Sprint interno 3.5 - Criar bootstrap web de storage, config e supabase

### Objetivo

Fazer a web usar os novos contratos antes do mobile existir.

### Arquivos sugeridos obrigatorios

- `src/shared/platform/storage/webStorageAdapter.js`
- `src/shared/platform/config/publicAppConfig.js`
- `src/shared/platform/supabase/webSupabaseClient.js`
- `src/shared/platform/query-cache/webQueryCache.js`

### `webStorageAdapter.js`

```js
import { createWebStorageAdapter } from '@dosiq/storage'

export const webStorageAdapter = createWebStorageAdapter(window.localStorage)
```

### `webSupabaseClient.js`

```js
import { createClient } from '@supabase/supabase-js'
import { publicAppConfig } from '@shared/platform/config/publicAppConfig'

export function createWebSupabaseClient() {
  return createClient(publicAppConfig.supabaseUrl, publicAppConfig.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: (key) => window.localStorage.removeItem(key),
      },
    },
  })
}
```

### Regra importante

O singleton que antes vivia em `src/shared/utils/supabase.js` pode continuar existindo na web nesta fase, mas deve passar a ser criado a partir do bootstrap novo, nao mais diretamente de `import.meta.env` dentro de camada compartilhada.

---

## 11. Sprint interno 3.6 - Refatorar services selecionados para factories por injecao

### Objetivo

Preparar a camada compartilhada para web e mobile sem mover todos os services de uma vez.

### Escopo recomendado

Comecar por 1 ou 2 services pequenos e de menor risco.

Exemplo de estrategia:

- manter service legado web funcionando
- criar novo repository/factory em `packages/shared-data`
- adaptar a web a consumir o novo repository gradualmente

### Exemplo correto

```js
export function createUserSessionRepository({ supabase }) {
  return {
    async getCurrentUser() {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  }
}
```

### Exemplo incorreto

```js
import { supabase } from '@shared/utils/supabase'

export const userSessionRepository = {
  async getCurrentUser() {
    return supabase.auth.getUser()
  }
}
```

Erro:

- acoplamento com singleton web
- nao compartilhavel

### Regra obrigatoria

Nesta fase, mover apenas o que:

- for simples
- tiver testes
- nao envolver DOM

Se um service for complexo demais, ele fica para outra fase.

---

## 12. Sprint interno 3.7 - Validacao da web apos adapters

### Objetivo

Provar que a web consegue rodar sobre os novos contratos.

### Validacao obrigatoria

Executar:

```bash
npm run lint
npm run test:critical
npm run build
```

### Validacao estrutural obrigatoria

Executar scans:

```bash
rg -n "\\b(window|document|navigator|localStorage|import\\.meta\\.env|process\\.env)\\b" packages/shared-data packages/config packages/storage --glob '!**/webStorage.js'
rg -n "hydrateCache\\(" packages/shared-data src/shared
```

Resultado esperado:

- `packages/shared-data` nao depende de browser/env diretamente
- `hydrateCache` nao roda mais no import da engine compartilhada

### Validacao manual recomendada

- abrir web
- navegar para telas com cache
- confirmar que nao houve regressao de fetch

---

## 13. Anti-patterns desta fase

### Errado 1 - Levar `useCachedQuery` inteiro para o pacote compartilhado

Erro:

- mistura React com engine de dados
- acopla shared-data a runtime de UI

### Errado 2 - Criar storage singleton global no pacote

Erro:

- dificulta bootstrap por plataforma
- quebra testabilidade

### Errado 3 - Continuar lendo `import.meta.env` dentro do compartilhado

Erro:

- torna o pacote web-dependent

### Errado 4 - Tentar adaptar todos os services do projeto de uma vez

Erro:

- aumenta demais o risco
- mistura refactor estrutural com mudanca funcional

### Errado 5 - Iniciar Expo nesta fase

Erro:

- antecipa Fase 4

---

## 14. Definition of Done da Fase 3

- [ ] `packages/storage` implementado com contrato async
- [ ] `packages/config` implementado com validacao por injecao
- [ ] `packages/shared-data` implementado ao menos com query cache e factories basicas
- [ ] query cache nao hidrata no import
- [ ] web usa bootstrap novo de config/storage/supabase
- [ ] nenhum pacote compartilhado le `import.meta.env` diretamente
- [ ] nenhum pacote compartilhado depende de `window.localStorage` diretamente
- [ ] `npm run lint` passa
- [ ] `npm run test:critical` passa
- [ ] `npm run build` passa

---

## 15. Handoff para a Fase 4

O proximo agente deve receber:

- `packages/core` puro
- `packages/storage` pronto
- `packages/config` pronto
- `packages/shared-data` com engine de dados pronta
- web validada usando esses contratos

Sem isso, o scaffold mobile vira experimento em terreno instavel.

---

## 16. Ancoragem e validacao contra a Master Spec

Checklist obrigatorio de ancoragem:

- [ ] Esta fase implementa `packages/storage`
- [ ] Esta fase implementa `packages/config`
- [ ] Esta fase implementa nova versao do query cache sem hidratacao em import
- [ ] Esta fase usa injecao de `supabase`, `storage`, `logger`, `clock` quando aplicavel
- [ ] Esta fase nao cria app mobile funcional ainda
- [ ] Esta fase nao move a web para `apps/web`
- [ ] Esta fase respeita a Fase 3 da master spec

Se qualquer item acima falhar, este documento deve ser corrigido antes da Fase 4.

