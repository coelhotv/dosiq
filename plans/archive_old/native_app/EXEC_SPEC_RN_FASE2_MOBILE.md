# Exec Spec: Fase 2 (Bootstrap Mobile Native App)

> **SUPERSEDIDO EM 2026-03-29:** Este exec spec foi substituído por `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`. Não executar esta fase isoladamente sem reconciliar com o documento definitivo.

## Contexto e Objetivo
Iniciar o `apps/mobile` no ecossistema Monorepo. Validar integração cross-plataformas do Supabase Auth e injeção do cache ultrarrápido (MMKV) através da abstração `StorageAdapter`. 

O robô Agent AI iniciará na raiz do projeto com o Monorepo e Workspace já estabilizado pelo framework (Fase 1 finalizada integralmente).

---

## Sprint 2.1: Expo Clean Bootstrapping
**Meta:** Um aplicativo mobile nu rodando o Expo SDK mais recente, preparado para o roteiro visual do NativeWind e limpo de boilerplate templates não escaláveis.

### 1. Inicializar Expo Pelo Root
Executar pela raiz para gerar dentro da pasta estipulada do app nativo:
```bash
npx create-expo-app apps/mobile --template blank
```
*(Remover todo código inicial HTML DOM não pertencente a um "Hello World" vazio. Sem routers nativos pré-anexados).*

### 2. Conformidade do NPM Workspace Local
Os pacotes nativos Expo serão linkados e expostos no root resolver.
No arquivo `apps/mobile/package.json`, assegurar conformidade do nome e importações em asterisco para pacotes da home (`packages`):
```json
{
  "name": "@dosiq/mobile",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "@dosiq/core": "*",
    "@dosiq/storage": "*"
  }
}
```

### 3. Blindar os Device Metadados (`App.json`)
Incluir identificadores nativos reais de bundle no arquivo `/apps/mobile/app.json` definindo as premissas de iOS e Android:
```json
{
  "expo": {
    "name": "Dosiq",
    "slug": "dosiq-app",
    "scheme": "meusremedios",
    "ios": { "bundleIdentifier": "com.coelhotv.meusremedios" },
    "android": { "package": "com.coelhotv.meusremedios" }
  }
}
```

---

## Sprint 2.2: O Motor do Supabase no Universo Nativo
**Meta:** Migrar a persistência assíncrona da sessão de "LocalStorage Web" para Segurança por Hardware Nativa através do keychain.

### 1. Injetar Provedor Crypto `expo-secure-store`
Não usaremos imports de `createClient` padrões. O Celular injetará Crypto Native:
```javascript
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => { SecureStore.setItemAsync(key, value); },
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

// Startando cliente Supabase contendo Flags rigorosamente móveis sem detectores DOM:
const supabase = createClient(SUPERBASE_URL, ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Crítico: O App usará scheme URL handlers (meusremedios://), não URL do browser.
  },
});
```

### 2. Refatorar Listeners de Interação (Event Listeners de AppState)
No Celular, eventos Web "focus" que triggam SDK failam miseravelmente em background. Agentes devem usar Componentes API Nativos:
```javascript
import { AppState } from 'react-native';

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

---

## Sprint 2.3: Storage MMKV de Alta Performance (Cache C++)
**Meta:** Acoplar e substituir inteiramente AsyncStorage pelo C++ MMKV. Realizar o Teste Final Cross-Package.

### 1. Engine de Buffer Fast (MMKV)
A instalação de um motor velocista é vital:
```bash
cd apps/mobile && npm install react-native-mmkv
```
A Engine central do App (`apps/mobile/App.js` raiz) executará obrigatoriamente na linha 1 a Injection Interface Global contida em `@dosiq/storage`:
```javascript
import { MMKV } from 'react-native-mmkv';
import { initializeStorage } from '@dosiq/storage'; // Interface vinda da Fase 1

const storage = new MMKV();
initializeStorage({
  getItem: (k) => storage.getString(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
});
```

### 2. O Teste de Integridade (Criteria de Aprovação do Coder AI)
Para o robô de deploy encerrar a Fase 2, a UI nua nativa deve performar perfeitamente lendo o repositório Zod sem perdas de compilador:
```jsx
// apps/mobile/App.js (Conteúdo final da Fase 2)
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Validando a Resolução de Symlinks Nativos do Metro Builder!
import { medicineSchema } from '@dosiq/core/schemas'; 

export default function App() {
  const [isValid, setIsValid] = useState(null);

  useEffect(() => {
    // Ping via Zod importado remotamente do Workspace:
    const res = medicineSchema.safeParse({ nome: "Losartana", unidade: "comprimido" });
    setIsValid(res.success);
  }, []);

  return (
    <View style={styles.container}>
      <Text>Ping Core (Workspace Symlinks): {isValid ? 'SUCCESSO ✅' : 'FALHOU ❌'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: "center", alignItems: "center" }});
```
*Gatilho do Orquestrador de Agentes:* Ao rodar `expo start` o App renderizou a flag de Sucesso. O Metro parseou symlinks globalmente sem colisões ou requests Web fantasma no pacote Zod. A Fase 2 Terminou com sucesso.
