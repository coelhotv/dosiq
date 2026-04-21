# Exec Spec Hibrido - Addendum: Estrategia de Testes Mobile

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 4, Fase 5 e Fase 6
> **Objetivo:** definir framework, configuracao e estrategia de testes para o app mobile native, separando-os dos testes web (Vitest)

---

## 1. Papel deste addendum

O projeto web usa **Vitest 4** com 543+ testes. Vitest nao roda em React Native.

O mobile precisa de stack de testes propria. Este addendum congela:

- framework de testes mobile
- configuracao base
- estrategia de cobertura por fase
- como testes de pacotes compartilhados coexistem com ambas as plataformas

---

## 2. Decisoes congeladas

### TM-001. Jest + @testing-library/react-native para o mobile

Stack obrigatoria:

- `jest` (runtime de testes)
- `@testing-library/react-native` (testes de componentes)
- `jest-expo` (preset do Expo para Jest)

### TM-002. Vitest continua exclusivo da web

Os testes web em Vitest nao mudam. Nenhum teste mobile roda em Vitest.

### TM-003. Pacotes compartilhados usam Vitest (curto prazo)

`packages/core`, `packages/shared-data`, `packages/storage`, `packages/config` e `packages/design-tokens` usam Vitest para seus testes unitarios, porque:

- sao JavaScript puro (sem React Native)
- Vitest ja esta configurado no projeto
- permite rodar com `npm run test:critical` sem mudanca

Se no futuro houver necessidade de rodar testes de pacotes compartilhados no contexto Metro/RN, criar ADR dedicada.

### TM-004. Testes mobile ficam em `apps/mobile`

Estrutura:

```text
apps/mobile/
├── __tests__/
│   ├── components/
│   ├── screens/
│   ├── hooks/
│   └── utils/
├── jest.config.js
└── jest.setup.js
```

### TM-005. Mocks de dependencias nativas

Criar mocks explicitos para:

- `expo-secure-store`
- `@react-native-async-storage/async-storage`
- `expo-notifications` (Fase 6)
- `@react-navigation/native`

Exemplo de `jest.setup.js`:

```js
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}))
```

---

## 3. Configuracao base obrigatoria

### `jest.config.js`

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@dosiq/.*)',
  ],
  moduleNameMapper: {
    '^@dosiq/core(.*)$': '<rootDir>/../../packages/core/src$1',
    '^@dosiq/shared-data(.*)$': '<rootDir>/../../packages/shared-data/src$1',
    '^@dosiq/storage(.*)$': '<rootDir>/../../packages/storage/src$1',
    '^@dosiq/config(.*)$': '<rootDir>/../../packages/config/src$1',
    '^@dosiq/design-tokens(.*)$': '<rootDir>/../../packages/design-tokens/src$1',
  },
}
```

### Dependencias obrigatorias (em `apps/mobile/package.json`)

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.4.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 4. Estrategia de cobertura por fase

### 4.1. Fase 4 (Scaffold)

Cobertura minima:

- jest roda sem erro (`npm test -- --passWithNoTests`)
- 1 teste smoke de componente basico (ex: SmokeScreen renderiza)
- mocks de SecureStore e AsyncStorage funcionando

### 4.2. Fase 5 (MVP Produto)

Cobertura obrigatoria:

- componentes criticos: DoseRegisterSheet, TodayScreen, TreatmentCard
- hooks compartilhados que o mobile usa (wrappers nativos)
- fluxo de login/logout (mock de Supabase)
- logica de vinculo Telegram (geracao e validacao de token)

Cobertura recomendada:

- snapshot tests das telas principais (estabilidade visual)
- testes de estado de erro/vazio/loading para cada tela

### 4.3. Fase 6 (Push + Beta)

Cobertura obrigatoria:

- dispatcher multicanal (testes no servidor, via Vitest)
- registro de device token (mock de expo-notifications)
- resolveNotificationNavigation (todos os `kind` de payload)
- pending intent (autenticado vs deslogado)
- fluxo de permissao (granted, denied, undetermined)

---

## 5. Scripts no root package.json

Adicionar na Fase 4:

```json
{
  "scripts": {
    "test:mobile": "npm test --workspace=@dosiq/mobile",
    "test:all": "npm run test:critical && npm run test:mobile"
  }
}
```

### Regra

`npm run validate:agent` continua rodando apenas testes web (Vitest). Testes mobile sao adicionais e NAO bloqueiam o CI web.

`npm run test:all` e o comando que valida ambas as plataformas (usar manualmente quando tocar em pacotes compartilhados).

---

## 6. Testes de pacotes compartilhados — regra de dupla validacao

Quando um pacote compartilhado e modificado, o agente deve rodar:

1. `npm run test:critical` (valida web)
2. `npm run test:mobile` (valida mobile, se existir)

Se ambos passarem, a mudanca e segura para ambas as plataformas.

---

## 7. Anti-patterns

### Errado 1 — Tentar rodar testes React Native no Vitest

```js
// vitest.config.js
test: { environment: 'react-native' } // NAO EXISTE
```

### Errado 2 — Instalar Jest na raiz para substituir Vitest

Erro: coexistencia de Jest e Vitest na raiz causa conflitos de globals.

### Errado 3 — Pular testes mobile porque "funciona no simulador"

Teste manual e complementar, nao substituto. Componentes e logica devem ter testes automatizados.

---

## 8. Ancoragem e validacao contra a master spec

- Este addendum respeita a separacao de plataformas (testes separados por stack)
- Este addendum nao modifica testes web existentes
- Este addendum nao exige TypeScript
- Este addendum define Jest + RNTL como stack congelada para o MVP
