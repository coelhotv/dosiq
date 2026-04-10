# Exec Spec Hibrido - Fase 1: Workspaces sem mover a web

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 0 concluida
> **Objetivo da fase:** adicionar estrutura de monorepo e pacotes vazios sem interromper a web atual

---

## 1. Papel desta fase

Esta fase cria o invólucro de monorepo.

Ela **nao** faz ainda:

- extracao funcional de codigo
- scaffold real do app Expo
- adaptacao de Supabase
- adapters de storage
- notificacoes nativas

Ela **faz**:

- workspaces no root
- pacotes placeholders
- diretoria `apps/mobile` placeholder
- scripts retrocompativeis

---

## 2. Regras de ouro da fase

### R1-001. A web continua na raiz

Proibido:

- mover `src/`
- mover `public/`
- mover `index.html`
- mover `vite.config.js`

### R1-002. Scripts atuais nao podem quebrar

Estes comandos devem continuar funcionando exatamente como hoje:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test:critical`
- `npm run validate:agent`

### R1-003. Workspaces entram, mas sem virar "turbo first"

`turbo` pode ser adicionado, mas:

- nao deve substituir compulsoriamente os scripts atuais nesta fase
- nao deve exigir que a web seja movida
- nao deve tornar o fluxo atual mais fragil

### R1-004. `apps/mobile` nesta fase e placeholder

Nao usar `create-expo-app` ainda.

`apps/mobile` nesta fase deve conter somente:

- `package.json` minimo
- `README.md`
- estrutura vazia ou placeholders

### R1-005. Nenhuma importacao produtiva para `packages/*`

Nesta fase, os pacotes podem existir vazios.

Mas nao ha extracao real ainda.

---

## 3. Estrutura alvo obrigatoria ao fim da fase

```text
meus-remedios/
├── src/                      # permanece
├── public/                   # permanece
├── index.html                # permanece
├── vite.config.js            # permanece
├── package.json              # atualizado com workspaces
├── apps/
│   └── mobile/
│       ├── package.json
│       └── README.md
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── README.md
│   │   └── src/index.js
│   ├── shared-data/
│   │   ├── package.json
│   │   ├── README.md
│   │   └── src/index.js
│   ├── storage/
│   │   ├── package.json
│   │   ├── README.md
│   │   └── src/index.js
│   └── config/
│       ├── package.json
│       ├── README.md
│       └── src/index.js
└── turbo.json                # opcional nesta fase
```

---

## 4. Arquivos que devem ser alterados nesta fase

### Obrigatorios

- `package.json`

### Opcionais

- `turbo.json`

### Novos arquivos obrigatorios

- `apps/mobile/package.json`
- `apps/mobile/README.md`
- `packages/core/package.json`
- `packages/core/README.md`
- `packages/core/src/index.js`
- `packages/shared-data/package.json`
- `packages/shared-data/README.md`
- `packages/shared-data/src/index.js`
- `packages/storage/package.json`
- `packages/storage/README.md`
- `packages/storage/src/index.js`
- `packages/config/package.json`
- `packages/config/README.md`
- `packages/config/src/index.js`

### Proibidos

- mover qualquer arquivo da web
- editar massivamente imports da web
- tocar em `src/App.jsx` sem necessidade

---

## 5. Sprint interno 1.1 - Atualizar o root para workspaces

### Objetivo

Adicionar suporte a workspaces sem alterar a raiz da web.

### Alteracao obrigatoria em `package.json`

Adicionar:

```json
{
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### Regra importante

Os scripts existentes devem continuar apontando para a web atual na raiz.

### Exemplo correto

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "test:critical": "vitest run --config vitest.critical.config.js",
    "validate:agent": "node scripts/run-tests-with-timeout.mjs 600 npm run -- test:critical --bail=1"
  }
}
```

### Exemplo incorreto

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build"
  }
}
```

Motivo do erro:

- quebraria a web atual cedo demais
- criaria dependencia de workspaces antes de existirem apps completos

---

## 6. Sprint interno 1.2 - Criar skeleton dos pacotes

### Objetivo

Criar os workspaces com identidade clara, mas sem implementacao real ainda.

### `apps/mobile/package.json`

Usar manifest minimo:

```json
{
  "name": "@meus-remedios/mobile",
  "private": true,
  "version": "0.0.0-phase1",
  "type": "module"
}
```

### `packages/core/package.json`

```json
{
  "name": "@meus-remedios/core",
  "private": true,
  "version": "0.0.0-phase1",
  "type": "module",
  "exports": {
    ".": "./src/index.js"
  }
}
```

Replicar o mesmo padrao para:

- `@meus-remedios/shared-data`
- `@meus-remedios/storage`
- `@meus-remedios/config`

### `src/index.js` placeholder

Cada pacote deve exportar algo explicitamente neutro:

```js
export {}
```

Ou:

```js
// Placeholder intencional da Fase 1.
```

### Regra

Nao inventar contratos definitivos nesta fase.

Os contratos detalhados entram nas fases seguintes.

---

## 7. Sprint interno 1.3 - README minimo de cada workspace

### Objetivo

Evitar ambiguidade para agentes futuros olhando apenas a arvore do repo.

Cada workspace deve ter um `README.md` com:

- responsabilidade
- o que entra
- o que nao entra
- em qual fase ele sera implementado de verdade

### Exemplo para `packages/core/README.md`

```md
# @meus-remedios/core

Responsabilidade: codigo puro compartilhado.

Entra:
- schemas
- utils puros

Nao entra:
- React
- DOM
- React Native
- env
- storage

Implementacao real: Fase 2.
```

### Exemplo para `apps/mobile/README.md`

```md
# @meus-remedios/mobile

Placeholder da Fase 1.

Nao executar scaffold Expo nesta fase.
Implementacao real: Fase 4 da master spec.
```

---

## 8. Sprint interno 1.4 - Turbo opcional, sem quebrar nada

### Objetivo

Permitir orquestracao futura sem tomar o controle do fluxo atual.

### Se `turbo.json` for criado

Ele deve ser minimalista:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "lint": {},
    "test": {},
    "build": {}
  }
}
```

### Regras obrigatorias

- nao reescrever os scripts atuais para usar `turbo`
- nao criar dependencia de `apps/web`
- nao exigir pipeline workspace-completo para rodar a web

### Recomendacao

Se houver duvida, **nao adicionar turbo nesta fase**.

Workspaces primeiro, orquestracao depois.

---

## 8.1. Riscos de toolchain com workspaces

### Husky e lint-staged

O `package.json` atual tem `private: true` e usa `husky` com `lint-staged` via script `prepare`. Ao adicionar `workspaces`:

- `npm install` muda o comportamento de hoisting
- `husky install` pode falhar se o `.husky/` nao estiver na raiz correta
- `lint-staged` pode nao encontrar arquivos se o working directory mudar

**Validacao obrigatoria:** apos adicionar workspaces, confirmar que `git commit` com lint-staged continua funcionando.

### Vitest globs

Os configs Vitest (`vitest.config.js`, `vitest.critical.config.js`, `vitest.smoke.config.js`) usam globs como `src/**/*.test.js`. Com workspaces, o npm pode criar symlinks em `node_modules` que confundem a resolucao de modulos.

**Validacao obrigatoria:** confirmar que os globs de teste NAO capturam `packages/*/src/**` involuntariamente. Se necessario, adicionar `exclude: ['packages/**']` nas configs Vitest.

### Vercel deploy

Ver addendum `EXEC_SPEC_HIBRIDO_ADDENDUM_DEPLOY_VERCEL_MONOREPO.md` — seção 3.1.

---

## 9. Sprint interno 1.5 - Validacao do comportamento retrocompativel

### Objetivo

Provar que workspaces existem e a web continua inteira.

### Validacoes obrigatorias

Executar:

```bash
npm install
npm run lint
npm run test:critical
npm run build
```

### Validacao manual obrigatoria

Rodar:

```bash
npm run dev
```

E confirmar:

- a web abre normalmente
- nenhuma configuracao de Vite foi quebrada
- nenhum alias foi perdido

### Scan final do repo

Conferir que os arquivos proibidos nao foram movidos:

```bash
test -d src && echo "src OK"
test -d public && echo "public OK"
test -f index.html && echo "index.html OK"
test -f vite.config.js && echo "vite.config.js OK"
```

---

## 10. Anti-patterns desta fase

### Errado 1 - Criar Expo real cedo demais

```bash
npx create-expo-app apps/mobile
```

Erro:

- antecipa Fase 4
- cria ruido de dependencia antes do core existir

### Errado 2 - Reescrever scripts raiz

```json
"dev": "turbo dev"
```

Erro:

- muda o comportamento central do projeto sem necessidade

### Errado 3 - Mover a web nesta fase

```bash
mv src apps/web/src
```

Erro:

- contradiz a master spec
- aumenta risco antes de termos shared core estabilizado

---

## 11. Definition of Done da Fase 1

- [ ] root possui `workspaces`
- [ ] `apps/mobile` existe como placeholder
- [ ] `packages/core` existe
- [ ] `packages/shared-data` existe
- [ ] `packages/storage` existe
- [ ] `packages/config` existe
- [ ] todos os workspaces tem `package.json`, `README.md` e `src/index.js`
- [ ] `src/`, `public/`, `index.html` e `vite.config.js` permanecem na raiz
- [ ] `npm run dev` continua funcionando
- [ ] `npm run build` continua funcionando
- [ ] `npm run validate:agent` continua funcionando
- [ ] `husky` + `lint-staged` continuam funcionando em `git commit`
- [ ] globs Vitest nao capturam `packages/**` indevidamente
- [ ] deploy Vercel preview funcional (validar com PR)
- [ ] `buildCommand`, `outputDirectory` e `installCommand` confirmados em `vercel.json`

---

## 12. Handoff para a Fase 2

O proximo agente deve receber:

- o root com workspaces criados
- nenhum pacote ainda populado com codigo de negocio
- a web intacta
- os pacotes nomeados corretamente

Se a Fase 1 terminar com extracao de codigo real, ela foi executada fora de ordem.

---

## 13. Ancoragem e validacao contra a Master Spec

Checklist obrigatorio de ancoragem:

- [ ] Esta fase respeita "web na raiz primeiro"
- [ ] Esta fase cria `apps/mobile` apenas como placeholder
- [ ] Esta fase cria `packages/core`, `packages/shared-data`, `packages/storage`, `packages/config`
- [ ] Esta fase nao extrai `src/schemas/**` ainda
- [ ] Esta fase nao cria adapters reais
- [ ] Esta fase nao contradiz a Fase 1 da master spec

Se qualquer item acima falhar, este documento deve ser corrigido antes da Fase 2.

