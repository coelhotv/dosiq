# EXEC SPEC FASE 1: Monorepo, NPM Packages & Tooling

> **Branch:** `refactor/dosiq-migration-fase-1`
> **Pré-requisito:** Nenhum (primeira fase executável)
> **Duração estimada:** 45–60 min
> **Impacto:** Fundação do monorepo — DEVE ser merged antes das Fases 2, 3 e 4

---

## 0. Bootstrap Obrigatório

```bash
# 1. Verificar baseline limpo
git checkout main && git pull
git checkout -b refactor/dosiq-migration-fase-1
npm run lint              # Deve passar com zero erros — se falhar, PARE e corrija antes

# 2. Confirmar escopo inicial
grep -rn "@meus-remedios/" --include="*.js" --include="*.jsx" . \
  | grep -v node_modules | grep -v dist/ | grep -v ios/Pods
# Anotar a contagem inicial para confrontar com zero ao final
```

---

## 1. Arquivos a Modificar (lista exaustiva e verificada)

### 1.1 Package.json — Raiz do Monorepo
**Arquivo:** `package.json`

Alterações obrigatórias:
- Campo `"name"`: `"meus-remedios"` → `"dosiq"`
- Em `"scripts"`, substituir TODAS as ocorrências de `@meus-remedios/web` por `@dosiq/web`:
  - `"dev"`, `"build"`, `"preview"`, `"dev:web"`, `"build:web"`, `"preview:web"`, `"test:web"`, `"test"`, `"test:watch"`, `"test:smoke"`, `"test:critical"`, `"test:unit"`, `"test:changed"`, `"test:coverage"`, `"test:components"`, `"test:services"`, `"test:fast"`, `"test:lowram"`, `"validate:quick"`, `"validate:agent"`, `"validate:full"`

### 1.2 Package.json — Workspace Apps
| Arquivo | Campo `name` atual | Novo valor |
|---|---|---|
| `apps/web/package.json` | `@meus-remedios/web` | `@dosiq/web` |
| `apps/mobile/package.json` | `@meus-remedios/mobile` | `@dosiq/mobile` |

Para `apps/mobile/package.json`, atualizar também:
- `"version"`: pode manter `0.1.0` (usuário já alterou no app.config.js)

### 1.3 Package.json — Packages Internos
| Arquivo | Campo `name` atual | Novo valor | Campo `author`/`description` |
|---|---|---|---|
| `packages/core/package.json` | `@meus-remedios/core` | `@dosiq/core` | Não tem — sem alteração adicional |
| `packages/design-tokens/package.json` | `@meus-remedios/design-tokens` | `@dosiq/design-tokens` | `"author": "Dosiq Team"`, `"description": "Design system tokens for Dosiq"` |
| `packages/config/package.json` | `@meus-remedios/config` | `@dosiq/config` | Não tem |
| `packages/shared-data/package.json` | `@meus-remedios/shared-data` | `@dosiq/shared-data` | Não tem |
| `packages/storage/package.json` | `@meus-remedios/storage` | `@dosiq/storage` | Não tem |

### 1.4 Imports em Arquivos JS/JSX (referências ao scope antigo)

**Estes arquivos possuem imports funcionais `from '@meus-remedios/*'` que QUEBRAM o bundle se não forem atualizados:**

| Arquivo | Linha / Import atual | Novo import |
|---|---|---|
| `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx` | `import { getPeriodFromTime } from '@meus-remedios/core'` | `@dosiq/core` |
| `apps/mobile/src/platform/config/nativePublicAppConfig.js` | `import { createPublicAppConfig } from '@meus-remedios/config'` | `@dosiq/config` |
| `packages/shared-data/src/query-cache/createQueryCache.js` | `import { setJSON, getJSON } from '@meus-remedios/storage'` | `@dosiq/storage` |

**Estes arquivos possuem referências em comentários JSDoc (`@meus-remedios/*`) e de documentação inline — atualizar para `@dosiq/*`:**

| Arquivo | Tipo de referência |
|---|---|
| `packages/core/src/index.js` | Comentário de módulo |
| `packages/core/src/utils/index.js` | Comentário de módulo |
| `packages/core/src/schemas/index.js` | Comentário de módulo |
| `packages/config/src/index.js` | Comentário de módulo + exemplo de import |
| `packages/storage/src/index.js` | Comentário de módulo + exemplo de import |
| `packages/shared-data/src/index.js` | Comentário de módulo |
| `packages/shared-data/src/query-cache/cacheKeys.js` | Exemplo de import no comentário |
| `packages/shared-data/src/query-cache/createQueryCache.js` | JSDoc `@param {import('@meus-remedios/storage')...}` + `persistKey = 'meus_remedios_query_cache'` |
| `packages/design-tokens/src/index.js` | Comentário de módulo + exemplos de import |
| `packages/design-tokens/src/colors.js` | `@module @meus-remedios/design-tokens/colors` |
| `packages/design-tokens/src/radii.js` | `@module @meus-remedios/design-tokens/radii` |
| `packages/design-tokens/src/spacing.js` | `@module @meus-remedios/design-tokens/spacing` |
| `packages/design-tokens/src/typography.js` | `@module @meus-remedios/design-tokens/typography` |

> [!IMPORTANT]
> Em `packages/shared-data/src/query-cache/createQueryCache.js`, além do import e JSDoc, há a cache key padrão hardcodada: `persistKey = 'meus_remedios_query_cache'`. Deve ser alterada para `persistKey = 'dosiq_query_cache'`. Esta key é usada para persistência em localStorage/AsyncStorage — a mudança faz novos installs começarem com cache limpo (comportamento esperado e seguro).

### 1.5 Vite Config (Alias do Pacote Core)
**Arquivo:** `apps/web/vite.config.js`

Linha atual:
```js
'@meus-remedios/core': path.resolve(__dirname, '../../packages/core/src'),
```
Nova linha:
```js
'@dosiq/core': path.resolve(__dirname, '../../packages/core/src'),
```

> [!WARNING]
> Verificar se existe algum arquivo em `apps/web/src/` que importa via `@meus-remedios/core`. Executar: `grep -rn "@meus-remedios/core" apps/web/src/`. Se encontrado, atualizar também.

### 1.6 Metro Config (Comentário)
**Arquivo:** `apps/mobile/metro.config.js`

Linha 2 — comentário atual:
```js
// Sem esta configuração, @meus-remedios/* não é encontrado pelo bundler
```
Novo:
```js
// Sem esta configuração, @dosiq/* não é encontrado pelo bundler
```

### 1.7 Turbo Config (verificar)
**Arquivo:** `turbo.json`

Verificar se contém referências a `@meus-remedios/` nos tasks ou pipelines. Se sim, atualizar.

### 1.8 ESLint Config (verificar)
**Arquivo:** `eslint.config.js`

Verificar se `no-restricted-imports` menciona caminhos `@meus-remedios/*`. Se sim, atualizar ou adicionar `@dosiq/*` conforme necessário.

---

## 2. Ordem de Execução das Sub-tarefas

```
2.1 Editar todos os package.json (raiz + apps + packages)  →  npm install
2.2 Atualizar imports funcionais (@meus-remedios/* → @dosiq/*)
2.3 Atualizar comentários JSDoc e exemplos de import
2.4 Atualizar cache key em createQueryCache.js
2.5 Atualizar alias em vite.config.js
2.6 Atualizar comentário em metro.config.js
2.7 Verificar turbo.json e eslint.config.js
```

---

## 3. Quality Gates

### Gate 1: Após sub-tarefa 2.1 (package.json)
```bash
npm install --legacy-peer-deps   # Deve recriar package-lock.json sem erros
npm run lint                      # Zero erros — se quebrar, bug nos package.json
```

### Gate 2: Após sub-tarefas 2.2 a 2.7
```bash
npm run lint                      # Zero erros

# Confirmar zero imports @meus-remedios/ restantes:
grep -rn "@meus-remedios/" --include="*.js" --include="*.jsx" . \
  | grep -v node_modules | grep -v dist/ | grep -v ios/Pods
# Resultado esperado: 0 linhas
```

### Gate Final da Fase
```bash
npm run test:changed
npm run validate:agent

# Verificar escopo da fase limpo:
grep -rn "meus.remedios\|meusremedios\|@meus-remedios" \
  --include="*.js" --include="*.jsx" --include="*.json" \
  package.json apps/ packages/ turbo.json eslint.config.js \
  | grep -v node_modules | grep -v dist/ | grep -v ios/Pods
# Resultado esperado: 0 linhas

# Tag de conclusão semântica:
git add -A
git commit -m "refactor(monorepo): renomear scope @meus-remedios → @dosiq em todos os packages e imports"
```

---

## 4. Critérios de Aceitação do PR

- [ ] Todos os 7 `package.json` de packages internos renomeados
- [ ] `package.json` raiz renomeado + scripts atualizados
- [ ] `npm install` executado com sucesso e `package-lock.json` regenerado
- [ ] Zero imports `@meus-remedios/*` funcionais na codebase
- [ ] Zero comentários JSDoc `@meus-remedios/*` na codebase
- [ ] Cache key `meus_remedios_query_cache` → `dosiq_query_cache`
- [ ] `npm run lint` passando
- [ ] `npm run validate:agent` passando

