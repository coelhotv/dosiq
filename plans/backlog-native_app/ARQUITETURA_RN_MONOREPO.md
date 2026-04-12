# Arquitetura de Referência: Monorepo React Native + Web PWA

> **SUPERSEDIDO EM 2026-03-29:** Este documento foi substituído por `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`. Consultar este arquivo apenas como referência histórica complementar.

> **Contexto:** Este manual arquitetural é a a **Única Fonte da Verdade** para como a aplicação Meus Remédios lidará com o desenvolvimento simultâneo de Dual Stack (Web e Mobile Nativo).
> **Atenção Agentes IA:** É mandatório ler este guia antes de qualquer decisão de arquitetura sobre onde alocar novos arquivos de negócio ou UI.

---

## 1. Topologia de Diretórios (NPM Workspaces)

O projeto fará uso nativo do **npm workspaces** e do orquestrador **Turborepo** para cacheamento de builds.

```ascii
meus-remedios/ 
├── package.json               # Root manifest (workspaces: ["apps/*", "packages/*"])
├── turbo.json                 # Orquestração de tarefas (build, lint, test)
│
├── apps/
│   ├── web/                   # A PWA Atual
│   │   ├── package.json       # { "name": "@meus-remedios/web" }
│   │   ├── vite.config.js     # Configuração nativa PWA (CSS Modules)
│   │   └── src/               # UI restrita à Web
│   │
│   └── mobile/                # Novo app React Native
│       ├── package.json       # { "name": "@meus-remedios/mobile" }
│       ├── app.json           # Manifesto Expo / App Stores
│       ├── metro.config.js    # Bundler resolverá pacotes Symlink (CRITICAL!)
│       └── app/               # UI restrita ao Mobile (NativeWind + Primitivos)
│
├── packages/
│   ├── core/                  # Cérebro da aplicação (Livre de UI/DOM)
│   │   ├── package.json       # { "name": "@meus-remedios/core" }
│   │   ├── src/schemas/       # Zod Rulesets
│   │   ├── src/services/      # Conexões Supabase Genéricas
│   │   └── src/utils/         # Logicas puras de negócio (adherenceLogic)
│   │
│   ├── storage/               # O adaptador de cache
│   │   ├── package.json       # { "name": "@meus-remedios/storage" }
│   │   └── src/index.js       # Export da Storage Interface
│   │
│   └── config/                # Centralização de Tooling
│       └── package.json       # eslint-config customizados para as stacks
│
├── api/                       # Vercel Serverless (Sem Workspaces)
└── server/bot/                # Node Telegram Bot (Inalterado)
```

---

## 2. Regras de Ouro: Acoplamento e Injeção

### 2.1. O que vive em `@meus-remedios/core`?
O pacote **Core** tem proibições agressivas. O package.json dele **NÃO PODE CONTER**:
- `react`, `react-dom`, `react-native`
- Qualquer dependência baseada em Web APIs intrínsecas (`window`, `document`) (Salvo testes Mocks).
É puramente Javascript/Typescript.

### 2.2. A Interface StorageAdapter (Strategy Pattern)
O PWA atual abusa de `localStorage` para caching do Supabase (`useCachedQuery`). O React Native quebra com `localStorage`.

**Solução Exigida - Criação do Adapter Abstracto em `packages/storage/src/index.js`:**
```javascript
// packages/storage/src/index.js
export class StorageAdapter {
  constructor(provider) {
    if (!provider || typeof provider.getItem !== 'function') {
      throw new Error('A valid storage provider must be injected');
    }
    this.provider = provider;
  }

  getItem(key) { return this.provider.getItem(key); }
  setItem(key, value) { return this.provider.setItem(key, value); }
  removeItem(key) { return this.provider.removeItem(key); }
}

// Uma instância global que deve ser bootada pela aplicação hospedeira
export const storageInstance = { current: null };

export function initializeStorage(provider) {
  storageInstance.current = new StorageAdapter(provider);
}

export function getStorage() {
  if (!storageInstance.current) {
    throw new Error('Storage invoked before initialization');
  }
  return storageInstance.current;
}
```

**Como a Web PWA Boota o Storage (`apps/web/src/main.jsx`):**
```javascript
import { initializeStorage } from '@meus-remedios/storage';

// Injeta Native browser localStorage
initializeStorage({
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
  removeItem: (k) => window.localStorage.removeItem(k)
});
```

**Como o Mobile Boota o Storage (`apps/mobile/app/_layout.jsx`):**
```javascript
import { initializeStorage } from '@meus-remedios/storage';
import { MMKV } from 'react-native-mmkv';

const mmkvStore = new MMKV();

// Injeta Native C++ Storage de altíssima performance
initializeStorage({
  getItem: (k) => mmkvStore.getString(k) || null,
  setItem: (k, v) => mmkvStore.set(k, v),
  removeItem: (k) => mmkvStore.delete(k)
});
```

*(Todos os serviços dentro de `packages/core` utilizarão `getStorage().getItem('key')` com total ignorância se rodam no navegador ou celular).*

---

## 3. Configurações de Compilação Críticas (Vite vs Metro)

A maior dor estrutural num Monorepo RN é fazer o empacotador nativo entender links simbólicos (symlinks) gerados pelo npm. 

### 3.1. Metro Config (Mobile)
Os Agentes IA deverão explicitamente instruir o `metro.config.js` no raiz do `apps/mobile` a "observar" a pasta `packages/`.
```javascript
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Critico: Permitir resolução na raiz do Monorepo
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Previniendo Metro de cachear múltiplas versões de sub dependências de React
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

### 3.2. Vite Config (Web)
O Vite nativamente tem menos dificuldade com Monorepos, mas precisa ser assegurado que resolverá corretamente o alias interno, sem poluir a main branch original.
```javascript
// apps/web/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite fará resolução automática se packages/core estiver linkado no package.json via workspaces "*"
    // Quaisquer alias de path do tsconfig/jsconfig antigos devem mapear para os packages
  }
});
```

---

## 4. O Fluxo de Estado das UIs Híbridas (State)

Recomendação: O estado visual permanecerá nas suas próprias camadas (`useState`, `useReducer`, `Zustand` ou SWR atrelado).
O `useCachedQuery` original será reescrito dentro do `packages/core` para importar o novo `StorageAdapter` abstrato, suportando chamadas síncronas/assíncronas depedendo do Adapter.

## 5. Próximos Passos Invariaveis
Quaisquer atualizações que violem essas primitivas de separação e purismo do `@meus-remedios/core` causarão falhas instantâneas de Build nativo no Metro Bundler (que não tolera APIs HTML). Todos os agentes estão incumbidos de blindar este Core Component.
