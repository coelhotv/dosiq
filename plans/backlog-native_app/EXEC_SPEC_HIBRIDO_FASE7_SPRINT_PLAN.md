# Exec Spec Hibrido — Fase 7: Sprint Plan de Execução

> **Status:** APROVADO para execução (ADR-032 `approved`, 2026-04-19)
> **Spec base:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE7_MIGRACAO_WEB_APPS_WEB.md`
> **Addendum obrigatório:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEPLOY_VERCEL_MONOREPO.md`
> **ADR de referência:** `.agent/memory/decisions/infra_and_deploy/ADR-032.md`
> **Propósito deste documento:** Spec prescritiva por sprint, self-contained para agentes IA coders. Cada sprint pode ser executada de forma independente por uma sessão de coding, com contexto suficiente para não depender da janela de contexto de sessões anteriores.

---

## Regras Absolutas (ler antes de qualquer sprint)

Estas regras se aplicam a TODOS os sprints da Fase 7 sem exceção:

| # | Regra |
|---|-------|
| R7-ABS-01 | **NUNCA mover `api/` ou `server/`** — permanecem na raiz em todas as fases |
| R7-ABS-02 | **`vercel.json` permanece na raiz** |
| R7-ABS-03 | **`apps/mobile/` não pode quebrar** — validar após cada sprint |
| R7-ABS-04 | **Migração física ≠ refactor** — se um arquivo não precisa mudar de comportamento, não mude |
| R7-ABS-05 | **Build local verde antes de qualquer commit** |
| R7-ABS-06 | **Deploy preview funcional antes de mergear** (Sprint 7.5) |
| R7-ABS-07 | **Não desabilitar testes para destravar a migração** — corrija os paths |
| R7-ABS-08 | **Root `package.json` mantém scripts retrocompatíveis** (`npm run dev`, `npm run build`) |

---

## Estado inicial assumido (pré-condições verificadas)

O agente executor DEVE verificar estas pré-condições antes de iniciar Sprint 7.1:

```bash
# 1. Confirmar estrutura atual da web na raiz
ls src/ public/ index.html vite.config.js package.json

# 2. Confirmar packages/ existe
ls packages/

# 3. Confirmar mobile intacto
ls apps/mobile/app.config.js apps/mobile/eas.json

# 4. Confirmar build atual verde
npm run build && ls dist/index.html

# 5. Confirmar testes atuais verdes
npm run validate:agent
```

Se qualquer item falhar → **PARAR e reportar ao maintainer antes de prosseguir**.

---

## Estrutura alvo ao final da Fase 7

```
meus-remedios/              ← root do monorepo (sem mudança de localização)
  apps/
    web/                    ← NOVO — web migrada para cá
      src/                  ← movido de ./src/
      public/               ← movido de ./public/
      index.html            ← movido de ./index.html
      vite.config.js        ← movido de ./vite.config.js (com paths atualizados)
      vitest.config.js      ← movido ou criado (se separado)
      package.json          ← NOVO — workspace package da web
    mobile/                 ← sem mudança
  packages/                 ← sem mudança
  api/                      ← sem mudança (serverless Vercel)
  server/                   ← sem mudança (bot Telegram)
  package.json              ← raiz — scripts agregadores atualizados
  vercel.json               ← raiz — buildCommand e outputDirectory atualizados
  .env.example              ← raiz — sem mudança
```

---

## Sprint 7.1 — Preparação e Freeze de Escopo

### Objetivo

Inventariar o que pertence exclusivamente à web, identificar dependências cruzadas e congelar o escopo do move. Nenhum arquivo de código é movido neste sprint.

### Contexto para o agente

Este sprint é de **análise e documentação apenas**. O produto deste sprint é uma lista de arquivos verificados e um checklist assinado pelo agente. Nenhum arquivo de `src/` ou `public/` deve ser tocado.

### Arquivos em escopo (apenas leitura)

```
package.json              ← identificar scripts impactados
vite.config.js            ← mapear aliases, plugins, manualChunks
vitest.config.js (se separado) ← identificar includes/excludes
.eslintrc* / eslint.config* ← identificar globs
vercel.json               ← capturar buildCommand, outputDirectory atuais
.github/workflows/*.yml   ← identificar paths hardcoded
src/                      ← inventariar (não modificar)
public/                   ← inventariar (não modificar)
```

### Tarefas obrigatórias

- [ ] **T7.1.1** — Listar todos os scripts em `package.json` raiz que referenciam `src/`, `dist/`, `vite` ou `vitest` diretamente
- [ ] **T7.1.2** — Extrair todos os aliases de `vite.config.js` (mapa `alias → path atual`)
- [ ] **T7.1.3** — Verificar se `vitest.config.js` é separado ou embutido no `vite.config.js`
- [ ] **T7.1.4** — Verificar se existe `eslint.config.js` ou `.eslintrc` com globs apontando para `src/`
- [ ] **T7.1.5** — Verificar se `vercel.json` tem `buildCommand`, `outputDirectory`, `installCommand` explícitos
- [ ] **T7.1.6** — Verificar se `.github/workflows/` tem paths hardcoded para `src/` ou `dist/`
- [ ] **T7.1.7** — Confirmar que `apps/mobile/` resolve corretamente antes do move (rodar `cd apps/mobile && npx expo export --platform android 2>&1 | head -5` ou equivalente leve)
- [ ] **T7.1.8** — Produzir o mapa de movimentação: `{ arquivo_atual → destino_alvo }` para todos os arquivos a mover

### DoD (Definition of Done) do Sprint 7.1

- [ ] Inventário completo documentado no output do agente (ou em arquivo de notas)
- [ ] Mapa de movimentação produzido e sem ambiguidades
- [ ] Scripts impactados identificados com o ajuste necessário para cada um
- [ ] Nenhum arquivo de `src/` ou `public/` foi modificado
- [ ] `apps/mobile/` está funcionando (build ou dry-run sem erro)

### Gates de validação

```bash
# Gate 1 — Nada foi movido (estrutura raiz intacta)
ls src/ public/ index.html vite.config.js

# Gate 2 — Mobile intacto
ls apps/mobile/app.config.js apps/mobile/eas.json
```

### Handoff para Sprint 7.2

O agente deve deixar registrado:
- Lista de scripts que precisam de ajuste em `package.json` raiz
- Aliases atuais de `vite.config.js` (para o agente 7.3 reconfigurar corretamente)
- Se `vitest.config.js` está separado ou embutido
- Se `eslint.config.js` tem globs para ajustar

---

## Sprint 7.2 — Criação de `apps/web` e Package Local

### Objetivo

Criar a estrutura do workspace `apps/web` **sem mover nenhum arquivo de código ainda**. Ao fim deste sprint, o repositório tem dois estados funcionais: a web ainda na raiz (funcionando) e a casca de `apps/web` pronta para receber os arquivos.

### Contexto para o agente

Este sprint cria arquivos **novos** em `apps/web/`. Não apaga nem move nada da raiz ainda. O build da web na raiz deve continuar verde ao fim deste sprint.

### Arquivos a criar

```
apps/web/package.json
```

### Conteúdo de `apps/web/package.json`

```json
{
  "name": "@meus-remedios/web",
  "version": "3.3.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

> **Regra:** As dependências permanecem hoistadas no root. Não duplicar `react`, `vite`, `vitest` nem nenhuma outra dependência em `apps/web/package.json` neste sprint. O workspace do npm resolverá via hoisting.

### Ajuste em `package.json` raiz

Adicionar ao `scripts`:

```json
{
  "dev:web": "npm run dev --workspace @meus-remedios/web",
  "build:web": "npm run build --workspace @meus-remedios/web",
  "preview:web": "npm run preview --workspace @meus-remedios/web",
  "test:web": "npm run test --workspace @meus-remedios/web"
}
```

Verificar se `workspaces` já inclui `"apps/*"`. Se não incluir, adicionar:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

> **Atenção:** Se `workspaces` já existe e contém `packages/*` mas não `apps/*`, adicionar `"apps/*"` sem remover os existentes.

### Tarefas obrigatórias

- [ ] **T7.2.1** — Criar `apps/web/` (mkdir)
- [ ] **T7.2.2** — Criar `apps/web/package.json` com o conteúdo acima
- [ ] **T7.2.3** — Adicionar scripts `dev:web`, `build:web`, `preview:web`, `test:web` ao root `package.json`
- [ ] **T7.2.4** — Garantir que root `workspaces` inclui `"apps/*"`
- [ ] **T7.2.5** — Rodar `npm install` para registrar o novo workspace
- [ ] **T7.2.6** — Verificar que `npm run build` (raiz) ainda produz `dist/index.html`

### DoD do Sprint 7.2

- [ ] `apps/web/package.json` existe com name `@meus-remedios/web`
- [ ] `npm install` roda sem ERESOLVE
- [ ] `npm run build` na raiz ainda gera `dist/` corretamente
- [ ] `npm run build:web` falha com mensagem inteligível (esperado — ainda não há `vite.config.js` em `apps/web/`)
- [ ] `apps/mobile/` continua intacto (`ls apps/mobile/app.config.js`)
- [ ] Nenhum arquivo de `src/`, `public/` ou `index.html` foi movido

### Gates de validação

```bash
# Gate 1 — Workspace criado
cat apps/web/package.json | grep '"name"'
# esperado: "@meus-remedios/web"

# Gate 2 — npm install sem conflito
npm install

# Gate 3 — Build da raiz ainda verde
npm run build && ls dist/index.html

# Gate 4 — Mobile intacto
ls apps/mobile/app.config.js
```

### Handoff para Sprint 7.3

O agente deve garantir que Sprint 7.3 receba:
- Workspace registrado e `npm install` verde
- Build raiz verde (web ainda em `src/` da raiz)
- Mapa de aliases (produzido em 7.1) disponível para reconfigurar `vite.config.js`

---

## Sprint 7.3 — Move Físico e Reparo de Tooling

### Objetivo

Mover os arquivos da web para `apps/web/` e reparar todo o tooling (aliases Vite, Vitest, ESLint) para que o build e os testes voltem a passar a partir do novo local.

### Contexto para o agente

Este é o sprint de maior risco. O agente deve:
1. Fazer o move físico dos arquivos
2. Reparar tooling imediatamente
3. Não commitar até o build e testes estarem verdes no novo local

**Ordem obrigatória de execução: prepare → move → repair → validate.** Não inverter.

### Pré-requisito antes de começar

```bash
# Confirmar que Sprint 7.2 está concluído
cat apps/web/package.json | grep '"name"'
npm run build && ls dist/index.html
```

### Arquivos a mover (git mv para preservar histórico)

```bash
git mv src             apps/web/src
git mv public          apps/web/public
git mv index.html      apps/web/index.html
git mv vite.config.js  apps/web/vite.config.js
```

Se `vitest.config.js` existir como arquivo separado:

```bash
git mv vitest.config.js apps/web/vitest.config.js
```

> **Usar `git mv` e não `mv`** — preserva histórico de git e facilita blame/log futuro.

### Arquivos que NÃO devem ser movidos

```
api/              ← serverless Vercel (regra absoluta R7-ABS-01)
server/           ← bot Telegram (regra absoluta R7-ABS-01)
package.json      ← root (modificar, não mover)
vercel.json       ← root (modificar no Sprint 7.4/7.5, não mover)
.env              ← root
.env.example      ← root
.gitignore        ← root
CLAUDE.md         ← root
```

### Reparo de `apps/web/vite.config.js`

Após o move, os aliases precisam ser reconfigurados porque `__dirname` agora aponta para `apps/web/`:

```js
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: __dirname,           // apps/web/ — explícito
  resolve: {
    alias: {
      '@':            resolve(__dirname, 'src'),
      '@features':    resolve(__dirname, 'src/features'),
      '@shared':      resolve(__dirname, 'src/shared'),
      '@services':    resolve(__dirname, 'src/services'),
      '@dashboard':   resolve(__dirname, 'src/features/dashboard'),
      '@medications': resolve(__dirname, 'src/features/medications'),
      '@protocols':   resolve(__dirname, 'src/features/protocols'),
      '@stock':       resolve(__dirname, 'src/features/stock'),
      '@adherence':   resolve(__dirname, 'src/features/adherence'),
      '@schemas':     resolve(__dirname, 'src/schemas'),
      '@utils':       resolve(__dirname, 'src/utils'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),   // apps/web/dist
    emptyOutDir: true,
  },
  // preservar manualChunks e demais configurações existentes
  plugins: [react()],
})
```

> **Regra:** Copiar todas as configurações existentes do vite.config.js original (manualChunks, plugins, server, etc.) — apenas atualizar os paths de alias e outDir.

### Reparo de `apps/web/vitest.config.js` (se separado)

```js
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    root: resolve(__dirname, 'src'),
    include: ['**/*.test.{js,jsx,ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    // preservar configurações existentes
  },
  resolve: {
    alias: {
      // mesmos aliases do vite.config.js acima
    },
  },
})
```

Se vitest estiver embutido no `vite.config.js`, o bloco `test:` já estará ajustado com os aliases corretos acima.

### Reparo do root `package.json` — scripts

Atualizar os scripts que ainda apontam para raiz:

```json
{
  "scripts": {
    "dev":          "npm run dev --workspace @meus-remedios/web",
    "build":        "npm run build --workspace @meus-remedios/web",
    "preview":      "npm run preview --workspace @meus-remedios/web",
    "validate:agent": "npm run validate:agent --workspace @meus-remedios/web",
    "lint":         "npm run lint --workspace @meus-remedios/web"
  }
}
```

> **Regra:** Scripts `dev:web`, `build:web` criados em 7.2 continuam existindo. Os scripts `dev` e `build` devem continuar funcionando como wrappers retrocompatíveis.

### Reparo de ESLint

Se `eslint.config.js` ou `.eslintrc` na raiz tem globs apontando para `src/`:

```js
// antes
{ files: ['src/**/*.{js,jsx}'] }

// depois
{ files: ['apps/web/src/**/*.{js,jsx}'] }
```

### Tarefas obrigatórias

- [ ] **T7.3.1** — `git mv src apps/web/src`
- [ ] **T7.3.2** — `git mv public apps/web/public`
- [ ] **T7.3.3** — `git mv index.html apps/web/index.html`
- [ ] **T7.3.4** — `git mv vite.config.js apps/web/vite.config.js`
- [ ] **T7.3.5** — Se `vitest.config.js` separado: `git mv vitest.config.js apps/web/vitest.config.js`
- [ ] **T7.3.6** — Atualizar aliases em `apps/web/vite.config.js` (todos os `resolve(__dirname, ...)`)
- [ ] **T7.3.7** — Atualizar `outDir` em `apps/web/vite.config.js`
- [ ] **T7.3.8** — Atualizar scripts retrocompatíveis no root `package.json`
- [ ] **T7.3.9** — Atualizar globs do ESLint se necessário
- [ ] **T7.3.10** — `npm run build:web` verde
- [ ] **T7.3.11** — `npm run build` (raiz) verde
- [ ] **T7.3.12** — `npm run lint` verde
- [ ] **T7.3.13** — Testes web verdes (`npm run test:web` ou equivalente)

### DoD do Sprint 7.3

- [ ] `apps/web/src/` existe e contém os arquivos movidos
- [ ] `apps/web/public/` existe
- [ ] `apps/web/index.html` existe
- [ ] `apps/web/vite.config.js` existe com aliases apontando para `apps/web/src/`
- [ ] `npm run build:web` gera `apps/web/dist/index.html`
- [ ] `npm run build` (raiz) gera `apps/web/dist/index.html` (via workspace wrapper)
- [ ] `npm run lint` verde (sem erros de globs)
- [ ] `npm run test:web` (ou `npm run validate:agent`) verde
- [ ] `apps/mobile/` continua intacto e sem erros de resolução
- [ ] Não existe mais `src/` na raiz do repositório

### Gates de validação

```bash
# Gate 1 — Estrutura alvo
ls apps/web/src apps/web/public apps/web/index.html apps/web/vite.config.js

# Gate 2 — Build via workspace
npm run build:web && ls apps/web/dist/index.html

# Gate 3 — Build raiz retrocompatível
npm run build && ls apps/web/dist/index.html

# Gate 4 — Testes verdes
npm run validate:agent

# Gate 5 — Mobile intacto
ls apps/mobile/app.config.js
cd apps/mobile && npx expo export --platform android --output-dir /tmp/expo-check 2>&1 | tail -3
```

---

## Sprint 7.4 — Compatibilidade Root e Automações

### Objetivo

Garantir que todas as automações do repositório (CI, scripts de qualidade, docs) apontam para os novos caminhos. Ao fim deste sprint, um colaborador novo consegue subir e testar a web e o mobile sem adivinhação.

### Contexto para o agente

Este sprint toca apenas arquivos de configuração, CI e documentação. Nenhum arquivo de `apps/web/src/` deve ser modificado.

### Arquivos em escopo

```
.github/workflows/*.yml           ← atualizar paths se hardcoded
package.json (raiz)               ← validar scripts agregadores
docs/standards/*.md               ← atualizar referências a src/
docs/architecture/*.md            ← idem
CLAUDE.md                         ← atualizar Estrutura do Projeto
plans/                            ← não modificar specs (são histórico)
```

### Tarefas obrigatórias

- [ ] **T7.4.1** — Auditar `.github/workflows/*.yml`: substituir paths `src/` hardcoded por `apps/web/src/`
- [ ] **T7.4.2** — Auditar `package.json` raiz: confirmar que `validate:agent`, `test:changed`, `test:critical` funcionam via workspace ou apontam para `apps/web/`
- [ ] **T7.4.3** — Atualizar seção "Estrutura do Projeto" no `CLAUDE.md`:
  - `src/` → `apps/web/src/`
  - `public/` → `apps/web/public/`
  - `index.html` → `apps/web/index.html`
  - `vite.config.js` → `apps/web/vite.config.js`
- [ ] **T7.4.4** — Atualizar Path Aliases em `CLAUDE.md` para mencionar que estão em `apps/web/vite.config.js`
- [ ] **T7.4.5** — Verificar `docs/standards/MOBILE_PERFORMANCE.md`: corrigir referências a `src/App.jsx` → `apps/web/src/App.jsx`
- [ ] **T7.4.6** — Verificar `docs/INDEX.md`: corrigir paths se existirem referências absolutas
- [ ] **T7.4.7** — Confirmar que `npm run validate:agent` ainda funciona end-to-end (lint + testes + build)

### DoD do Sprint 7.4

- [ ] Nenhum workflow de CI tem path `src/` hardcoded que aponte para a raiz do repo
- [ ] `npm run validate:agent` verde end-to-end
- [ ] `CLAUDE.md` reflete a estrutura atual (web em `apps/web/`)
- [ ] Um agente novo consegue seguir `CLAUDE.md` sem ambiguidade de paths
- [ ] `apps/mobile/` continua intacto

### Gates de validação

```bash
# Gate 1 — CI paths atualizados
grep -r '"src/' .github/workflows/ 2>/dev/null | grep -v apps/web | wc -l
# esperado: 0

# Gate 2 — Validate agent verde
npm run validate:agent

# Gate 3 — Mobile intacto
ls apps/mobile/app.config.js
```

---

## Sprint 7.5 — Deploy e Validação Final

### Objetivo

Configurar e validar o deploy da web a partir de `apps/web/` no Vercel, garantir que `api/` continua resolvendo como serverless functions, e fazer o smoke test completo antes do merge final.

### Contexto para o agente

Este é o sprint de **validação e deploy**. Nenhuma feature é adicionada. O foco é:
1. Configurar `vercel.json` para o novo layout
2. Validar deploy preview antes de mergear
3. Executar o checklist de smoke test
4. Documentar o rollback plan

**Este sprint exige que o agente ou o maintainer tenha acesso ao dashboard Vercel para validar o preview deploy.**

### Configuração obrigatória de `vercel.json`

O `vercel.json` na raiz deve ser atualizado com:

```json
{
  "buildCommand": "cd apps/web && npx vite build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> **Crítico:** `api/` continua na raiz. O Vercel resolve serverless functions a partir do root do repositório, não do `outputDirectory`. Manter `api/` onde está é suficiente — o Vercel encontrará as functions em `api/*.js`.

> **Se houver dúvida sobre a resolução de `api/`:** criar um PR de teste e verificar no deploy preview se os endpoints `/api/health` respondem antes de mergear.

### Tarefas obrigatórias

- [ ] **T7.5.1** — Atualizar `vercel.json` com `buildCommand`, `outputDirectory` conforme acima
- [ ] **T7.5.2** — Confirmar que `vercel.json` ainda tem todos os rewrites necessários (SPA catch-all + API routes)
- [ ] **T7.5.3** — Verificar que env vars no dashboard Vercel não dependem de caminhos (`src/`) — apenas de nomes de variável
- [ ] **T7.5.4** — Criar branch `feature/fase7-web-migration` se ainda não existir, abrir PR
- [ ] **T7.5.5** — Aguardar deploy preview do Vercel CI
- [ ] **T7.5.6** — Executar checklist de smoke test manual (ver abaixo)
- [ ] **T7.5.7** — Testar endpoint `api/health` no preview deploy
- [ ] **T7.5.8** — Testar endpoint `api/telegram` (ping) no preview deploy
- [ ] **T7.5.9** — Documentar rollback plan (ver abaixo)

### Checklist de smoke test obrigatório

Executar no deploy preview antes do merge:

- [ ] Landing page abre sem crash (`/` anônimo)
- [ ] Login com Supabase funciona
- [ ] Dashboard carrega após login
- [ ] Navegação view-based funciona (Medicines, Stock, Protocols, History)
- [ ] Assets públicos carregam (favicon, ícones PWA)
- [ ] Build de produção serve localmente (`npm run preview:web`)
- [ ] Endpoint `GET /api/health` responde 200
- [ ] Endpoint `POST /api/telegram` responde (mesmo que sem token válido, deve dar 4xx não 5xx de infra)
- [ ] `apps/mobile/app.config.js` ainda resolve (verificar com `cat apps/mobile/app.config.js`)
- [ ] `apps/mobile` ainda inicializa via workspace (`npm run start --workspace @meus-remedios/mobile`)

### Rollback plan

Se o deploy preview falhar ou a produção quebrar após merge:

```bash
# Opção 1 — Reverter vercel.json
git revert HEAD~1 --no-edit   # se só vercel.json mudou no último commit

# Opção 2 — Reconfigurar Vercel dashboard
# Dashboard Vercel → Settings → Build & Development Settings
# buildCommand: vite build  (volta ao padrão raiz)
# outputDirectory: dist
# Fazer redeploy manual

# Opção 3 — Reverter branch completa
git revert -m 1 <merge-commit-hash>
```

> **Manter este rollback plan documentado até pelo menos 2 semanas após o merge de produção.**

### DoD do Sprint 7.5

- [ ] `vercel.json` atualizado com `buildCommand` e `outputDirectory` corretos
- [ ] Deploy preview do PR funcional e smoke test completo passado
- [ ] `api/` serverless functions respondendo no preview
- [ ] Rollback plan documentado no PR description
- [ ] PR criado, revisado e aprovado pelo maintainer
- [ ] `npm run validate:agent` verde no branch
- [ ] `apps/mobile/` intacto

### Gates de validação

```bash
# Gate 1 — vercel.json correto
cat vercel.json | grep '"outputDirectory"'
# esperado: "apps/web/dist"

# Gate 2 — Validate agent final
npm run validate:agent

# Gate 3 — Build de produção local
npm run build:web && npm run preview:web
# validar manualmente no browser: http://localhost:4173

# Gate 4 — Mobile intacto
ls apps/mobile/app.config.js
```

---

## Checklist de Conclusão da Fase 7

O mantenedor deve verificar todos os itens abaixo antes de considerar a Fase 7 encerrada:

### Estrutura
- [ ] Web está em `apps/web/`
- [ ] `api/` permanece na raiz
- [ ] `server/` permanece na raiz
- [ ] `packages/` sem mudanças
- [ ] `apps/mobile/` intacto

### Tooling
- [ ] `npm run dev` funciona (raiz, retrocompatível)
- [ ] `npm run build` funciona (raiz, retrocompatível)
- [ ] `npm run dev:web` funciona (workspace direto)
- [ ] `npm run build:web` funciona (workspace direto)
- [ ] `npm run validate:agent` verde

### Deploy
- [ ] `vercel.json` com `buildCommand` e `outputDirectory` corretos
- [ ] Deploy de produção funcional
- [ ] `api/` serverless functions funcionais em produção

### Documentação
- [ ] `CLAUDE.md` reflete estrutura atualizada
- [ ] ADR-032 atualizado para `accepted` (ou já está)
- [ ] Rollback plan documentado

---

## Mapa de Dependências entre Sprints

```
Sprint 7.1 (inventário)
    ↓
Sprint 7.2 (casca apps/web)
    ↓
Sprint 7.3 (move físico + tooling)  ← risco máximo — gate rigoroso
    ↓
Sprint 7.4 (CI + docs)
    ↓
Sprint 7.5 (deploy + smoke test + PR merge)
```

Cada sprint deve ser executado **em ordem**. Não pular sprints.

Um agente pode executar múltiplos sprints em sequência na mesma sessão se os gates passarem, **mas deve parar se qualquer gate falhar** e reportar ao maintainer antes de prosseguir.

---

## Referências

- Spec base: `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE7_MIGRACAO_WEB_APPS_WEB.md`
- Addendum deploy: `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEPLOY_VERCEL_MONOREPO.md`
- ADR-026: `.agent/memory/decisions/infra_and_deploy/ADR-026.md`
- ADR-032: `.agent/memory/decisions/infra_and_deploy/ADR-032.md` (approved)
- Regras relevantes: R-090 (Vercel function budget), R-002 (path aliases), R-001 (duplicatas), R-003 (imports)
- Anti-patterns relevantes: AP-H04 (ERESOLVE), AP-H05 (lock file)
