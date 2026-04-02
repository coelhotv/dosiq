# Exec Spec Hibrido - Fase 4: Mobile Scaffold

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 3 concluida
> **Objetivo da fase:** subir o app Expo com auth, sessao, navegacao minima e tela de smoke consumindo o compartilhado

---

## 1. Papel desta fase

Esta fase cria o primeiro app mobile realmente executavel.

Esta fase **faz**:

- scaffold Expo real
- configuracao de iOS/Android package IDs
- React Navigation basico
- bootstrap native de config
- bootstrap native de Supabase
- persistencia de sessao com `expo-secure-store`
- persistencia geral com `AsyncStorage`
- tela de smoke usando schema/core real

Esta fase **nao faz**:

- notificacoes nativas ainda
- tabela `notification_devices`
- biometria
- HealthKit/Google Fit
- telas completas de produto do MVP

### Leituras complementares obrigatorias

Antes de executar esta fase, o agente deve ler tambem:

- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

---

## 2. Regras de ouro da fase

### R4-001. Usar Expo, nao improvisar base native

Proibido:

- criar projeto RN puro sem Expo
- usar stack fora do padrao definido na master spec

### R4-002. `StyleSheet`, nao `NativeWind`

Esta fase deve usar:

- `StyleSheet`
- `View`
- `Text`
- `Pressable`
- primitives nativas

`NativeWind` continua proibido.

### R4-003. `SecureStore` para auth, `AsyncStorage` para nao sensivel

Separacao obrigatoria:

- auth/session -> `expo-secure-store`
- persistencia geral -> `@react-native-async-storage/async-storage`

### R4-004. Mobile le shared packages; shared packages nao leem mobile

O app mobile pode importar:

- `@meus-remedios/core`
- `@meus-remedios/shared-data`
- `@meus-remedios/storage`
- `@meus-remedios/config`

Mas esses pacotes nao podem importar nada de:

- `apps/mobile`
- `react-native`
- `expo-*`

### R4-005. App de smoke primeiro, produto depois

O objetivo desta fase nao e construir as telas finais.

O objetivo e provar:

- bundling
- resolucao de workspaces
- auth
- sessao
- navegacao
- consumo de shared packages

### R4-006. Identidade, ambientes e build profiles ja fazem parte do scaffold

Mesmo sem beta operacional nesta fase, o app mobile ja deve nascer pronto para:

- `app.config.js`
- `eas.json`
- `development`, `preview` e `production`

### R4-007. Safe area, teclado e scheme nativo ja precisam nascer corretos

Esta fase ainda nao entrega produto final, mas o app precisa nascer com:

- safe area correta
- tela de auth utilizavel com teclado aberto
- `scheme` nativo coerente com o contrato de deep links

---

## 3. Estrutura alvo obrigatoria ao fim da fase

```text
apps/mobile/
├── package.json
├── app.config.js
├── eas.json
├── babel.config.js
├── metro.config.js
├── App.js
├── src/
│   ├── app/
│   │   ├── AppRoot.jsx
│   │   └── Navigation.jsx
│   ├── platform/
│   │   ├── config/nativePublicAppConfig.js
│   │   ├── storage/nativeStorageAdapter.js
│   │   ├── auth/secureStoreAuthStorage.js
│   │   └── supabase/nativeSupabaseClient.js
│   ├── screens/
│   │   ├── SmokeScreen.jsx
│   │   ├── LoginScreen.jsx
│   │   └── HomeScreen.jsx
│   └── theme/
│       └── tokens.js
└── README.md
```

O nome das subpastas pode variar, mas estas responsabilidades nao podem variar.

---

## 4. Dependencias obrigatorias da fase

## 4.1. Dependencias obrigatorias

- `expo`
- `react-native`
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `react-native-screens`
- `react-native-safe-area-context`
- `expo-secure-store`
- `@react-native-async-storage/async-storage`
- `@supabase/supabase-js`

## 4.2. Dependencias proibidas nesta fase

- `react-native-mmkv`
- `nativewind`
- `expo-router`
- libs de HealthKit
- libs de biometria
- libs de push

---

## 5. Sprint interno 4.1 - Scaffold Expo real

### Objetivo

Criar a base executavel do app mobile.

### Comando recomendado

```bash
npx create-expo-app apps/mobile --template blank
```

### Apos gerar

Limpar boilerplate ate ficar somente o necessario.

### `apps/mobile/package.json` - requisitos

Deve conter:

- nome do workspace
- scripts minimos
- dependencias do Expo

Exemplo:

```json
{
  "name": "@meus-remedios/mobile",
  "private": true,
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios"
  }
}
```

### Regra obrigatoria

Nao adicionar dezenas de bibliotecas agora.

Scaffold minimo e controlado.

Mas o scaffold nao pode sair sem:

- `app.config.js`
- `eas.json`
- `scheme` `meusremedios`

---

## 6. Sprint interno 4.2 - Configurar `app.config.js` e identidade do app

### Objetivo

Definir identidade minima, environment matrix e package IDs.

### Exemplo prescritivo

```js
const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'development'

const variants = {
  development: {
    name: 'Meus Remedios Dev',
    slug: 'meus-remedios-dev',
    iosBundleIdentifier: 'com.coelhotv.meusremedios.dev',
    androidPackage: 'com.coelhotv.meusremedios.dev',
  },
  preview: {
    name: 'Meus Remedios Preview',
    slug: 'meus-remedios-preview',
    iosBundleIdentifier: 'com.coelhotv.meusremedios.preview',
    androidPackage: 'com.coelhotv.meusremedios.preview',
  },
  production: {
    name: 'Meus Remedios',
    slug: 'meus-remedios',
    iosBundleIdentifier: 'com.coelhotv.meusremedios',
    androidPackage: 'com.coelhotv.meusremedios',
  }
}

const current = variants[BUILD_PROFILE] || variants.development

module.exports = {
  expo: {
    name: current.name,
    slug: current.slug,
    scheme: 'meusremedios',
    ios: {
      bundleIdentifier: current.iosBundleIdentifier,
    },
    android: {
      package: current.androidPackage,
    },
  },
}
```

### Regra obrigatoria

Se os identificadores ainda nao estiverem validados pelo owner, documentar placeholders claramente.

Nao inventar IDs aleatorios sem registrar.

### `eas.json` minimo obrigatorio

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### Regra complementar

Mesmo sem push nativo nesta fase, o scaffold ja deve sair preparado para:

- segregacao de env publico e segredo
- strings centralizadas de permissao
- build profiles reproduziveis

---

## 7. Sprint interno 4.3 - Configurar Metro para workspace

### Objetivo

Fazer o bundler mobile enxergar `packages/*`.

### Arquivo obrigatorio

- `apps/mobile/metro.config.js`

### Exemplo prescritivo

```js
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
```

### Regra obrigatoria

Sem resolver workspace, a fase falha, porque o smoke test precisa ler os pacotes compartilhados.

---

## 8. Sprint interno 4.4 - Bootstrap native de config

### Objetivo

Consumir `packages/config` no mobile sem quebrar a regra de injecao.

### Arquivo sugerido

- `apps/mobile/src/platform/config/nativePublicAppConfig.js`

### Exemplo

```js
import { createPublicAppConfig } from '@meus-remedios/config'

export const nativePublicAppConfig = createPublicAppConfig({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  detectSessionInUrl: false,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
})
```

### Regra obrigatoria

O mobile pode ler `process.env.EXPO_PUBLIC_*` na camada de app.

Pacotes compartilhados continuam proibidos de ler env diretamente.

---

## 9. Sprint interno 4.5 - Bootstrap native de storage e auth storage

### Objetivo

Separar claramente persistencia geral de persistencia sensivel.

### Arquivos obrigatorios

- `apps/mobile/src/platform/storage/nativeStorageAdapter.js`
- `apps/mobile/src/platform/auth/secureStoreAuthStorage.js`

### `nativeStorageAdapter.js`

```js
import AsyncStorage from '@react-native-async-storage/async-storage'

export const nativeStorageAdapter = {
  async getItem(key) {
    return AsyncStorage.getItem(key)
  },
  async setItem(key, value) {
    return AsyncStorage.setItem(key, value)
  },
  async removeItem(key) {
    return AsyncStorage.removeItem(key)
  },
}
```

### `secureStoreAuthStorage.js`

```js
import * as SecureStore from 'expo-secure-store'

export const secureStoreAuthStorage = {
  async getItem(key) {
    return SecureStore.getItemAsync(key)
  },
  async setItem(key, value) {
    return SecureStore.setItemAsync(key, value)
  },
  async removeItem(key) {
    return SecureStore.deleteItemAsync(key)
  },
}
```

### Regra obrigatoria

Nao usar `AsyncStorage` para sessao auth.

Nao usar `SecureStore` para cache geral.

---

## 10. Sprint interno 4.6 - Bootstrap native de Supabase

### Objetivo

Criar cliente Supabase native coerente com os contratos da Fase 3.

### Arquivo obrigatorio

- `apps/mobile/src/platform/supabase/nativeSupabaseClient.js`

### Exemplo prescritivo

```js
import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import { nativePublicAppConfig } from '@mobile/platform/config/nativePublicAppConfig'
import { secureStoreAuthStorage } from '@mobile/platform/auth/secureStoreAuthStorage'

export function createNativeSupabaseClient() {
  const supabase = createClient(
    nativePublicAppConfig.supabaseUrl,
    nativePublicAppConfig.supabaseAnonKey,
    {
      auth: {
        storage: secureStoreAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  )

  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })

  return supabase
}
```

### Regra obrigatoria

O client pode ser singleton no app mobile, mas nao em pacote compartilhado.

---

## 11. Sprint interno 4.7 - React Navigation minima

### Objetivo

Subir navegacao minima suficiente para smoke/login/home.

### Arquivos obrigatorios

- `apps/mobile/src/app/Navigation.jsx`
- `apps/mobile/src/app/AppRoot.jsx`

### Estrutura minima recomendada

- `LoginScreen`
- `SmokeScreen`
- `HomeScreen`

### Exemplo

```js
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginScreen from '../screens/LoginScreen'
import SmokeScreen from '../screens/SmokeScreen'
import HomeScreen from '../screens/HomeScreen'

const Stack = createNativeStackNavigator()

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Smoke" component={SmokeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
```

### Regra obrigatoria

Nao construir tabs do produto ainda.

Navegacao minima primeiro.

---

## 12. Sprint interno 4.8 - Smoke screen consumindo o compartilhado

### Objetivo

Provar que Metro resolve workspaces, que o app abre e que o `core` esta acessivel.

### Arquivo obrigatorio

- `apps/mobile/src/screens/SmokeScreen.jsx`

### Exemplo prescritivo

```js
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { medicineSchema } from '@meus-remedios/core/schemas'

export default function SmokeScreen() {
  const [result, setResult] = useState('loading')

  useEffect(() => {
    const parsed = medicineSchema.safeParse({
      name: 'Losartana',
      dosage_per_pill: 50,
      dosage_unit: 'mg',
      type: 'medicamento',
    })

    setResult(parsed.success ? 'success' : 'error')
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smoke Core</Text>
      <Text>{result === 'success' ? 'SUCCESS' : result}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
})
```

### Criterio de sucesso

O app abre e renderiza `SUCCESS`.

---

## 13. Sprint interno 4.9 - Login real e persistencia de sessao

### Objetivo

Provar que auth native funciona de ponta a ponta.

### Arquivos obrigatorios

- `apps/mobile/src/screens/LoginScreen.jsx`
- `apps/mobile/src/screens/HomeScreen.jsx`

### Fluxo obrigatorio

1. usuario informa email/senha
2. app usa cliente Supabase native
3. login funciona
4. home exibe email ou id do usuario
5. fechar/reabrir o app preserva sessao

### Exemplo de login

```js
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

### Regra obrigatoria

Nao criar abstrações complexas de auth nesta fase.

Fluxo simples, validado e real.

---

## 14. Sprint interno 4.10 - Validacao operacional da fase

### Objetivo

Fechar a fase com prova de bundling, auth e sessao.

### Validacoes obrigatorias

#### iOS

- app abre no simulator
- smoke screen renderiza sucesso
- login funciona
- sessao persiste

#### Android

- app abre no emulator
- smoke screen renderiza sucesso
- login funciona
- sessao persiste

### Validacoes adicionais na web

Executar:

```bash
npm run lint
npm run test:critical
npm run build
```

Motivo:

O scaffold mobile nao pode quebrar a web.

### Validacoes adicionais do scaffold mobile

- `scheme` `meusremedios://` esta configurado
- tela de login respeita safe area
- tela de login continua utilizavel com teclado aberto
- `development` e `preview` existem no `eas.json`

---

## 15. Anti-patterns desta fase

### Errado 1 - Adicionar `NativeWind`

Erro:

- contradiz stack congelada do MVP
- aumenta fragilidade para agentes menores

### Errado 2 - Usar `react-native-mmkv`

Erro:

- adianta complexidade desnecessaria
- contradiz ordem da master spec

### Errado 3 - Construir telas finais do produto agora

Erro:

- mistura scaffold com MVP

### Errado 4 - Pular smoke screen e ir direto para dashboard

Erro:

- elimina diagnostico minimo de workspace/shared packages

### Errado 5 - Ler env dentro de `packages/*`

Erro:

- quebra o contrato definido na Fase 3

---

## 16. Definition of Done da Fase 4

- [ ] `apps/mobile` foi scaffoldado com Expo real
- [ ] `metro.config.js` resolve workspaces
- [ ] config native usa `packages/config`
- [ ] auth storage usa `expo-secure-store`
- [ ] persistencia geral usa `AsyncStorage`
- [ ] cliente Supabase native foi criado corretamente
- [ ] React Navigation minima esta funcionando
- [ ] smoke screen consome `@meus-remedios/core`
- [ ] login real funciona
- [ ] sessao persiste ao reabrir
- [ ] `app.config.js` esta presente e coerente
- [ ] `eas.json` esta presente com profiles minimos
- [ ] web continua compilando

---

## 17. Handoff para a Fase 5

O proximo agente deve receber:

- app Expo funcional
- boot e bundling validados
- auth e sessao validados
- smoke screen verde
- base pronta para shell de produto

Sem isso, a Fase 5 vira tentativa de construir produto em cima de scaffold instavel.

---

## 18. Ancoragem e validacao contra a Master Spec

Checklist obrigatorio de ancoragem:

- [ ] Esta fase cria `apps/mobile` funcional
- [ ] Esta fase usa Expo
- [ ] Esta fase usa React Navigation
- [ ] Esta fase usa `expo-secure-store` para auth
- [ ] Esta fase usa `AsyncStorage` para persistencia nao sensivel
- [ ] Esta fase nao usa `NativeWind`
- [ ] Esta fase nao usa `MMKV`
- [ ] Esta fase nao implementa push native ainda
- [ ] Esta fase ja nasce alinhada ao addendum de release engineering
- [ ] Esta fase ja nasce alinhada ao addendum de privacy/permissoes
- [ ] Esta fase respeita a Fase 4 da master spec

Se qualquer item acima falhar, este documento deve ser corrigido antes da Fase 5.
