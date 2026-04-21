# Exec Spec Hibrido - Addendum: Deploy Vercel e Monorepo

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 1, Fase 4 e Fase 7
> **Objetivo:** congelar como o deploy Vercel coexiste com a estrutura monorepo em cada fase, evitando quebra de serverless functions, rewrites e variáveis de ambiente

---

## 1. Papel deste addendum

O projeto usa Vercel Hobby (gratuito) com:

- `api/` na raiz para serverless functions (maximo 12 no plano Hobby)
- `vercel.json` com rewrites (SPA catch-all, rotas de API)
- `vite build` como build command
- env vars configuradas no dashboard Vercel (`VITE_*`, `SUPABASE_*`, etc.)

A transicao para monorepo pode quebrar:

- a resolucao de serverless functions (`api/` deve permanecer na raiz)
- o build command (se Vercel nao encontrar `vite.config.js`)
- os rewrites (se o output muda de diretorio)
- env vars (se o root framework detection mudar)

Este addendum define o comportamento correto em cada fase.

---

## 2. Decisoes congeladas

### VD-001. `api/` SEMPRE permanece na raiz do repositorio

Em TODAS as fases (incluindo Fase 7), o diretorio `api/` nao pode ser movido.

Motivo: Vercel resolve serverless functions a partir de `api/` na raiz do repositorio (ou do root configurado). Mover `api/` para `apps/web/api/` exigiria configuracao de Root Directory no Vercel, o que pode conflitar com o monorepo.

### VD-002. `vercel.json` permanece na raiz

O arquivo `vercel.json` com rewrites e configuracoes continua na raiz em todas as fases.

### VD-003. Sem Root Directory Change ate a Fase 7

Nas Fases 0-6, o Root Directory no Vercel fica como `.` (raiz).

Na Fase 7, se a web mover para `apps/web`, avaliar:

- opcao A: Root Directory = `apps/web` + mover `api/` de volta com symlink ou Vercel config
- opcao B: Root Directory = `.` + ajustar build command para `cd apps/web && vite build`

A decisao final exige ADR propria na Fase 7.

### VD-004. Build command explicito no `vercel.json`

Para evitar que Vercel autodetecte incorretamente apos workspaces:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

Se esses campos ja existirem em `vercel.json`, mante-los. Se nao existirem, adicionar na Fase 1.

### VD-005. `VERCEL_FORCE_NO_BUILD_CACHE=1` como safety net

Apos mudancas estruturais (Fase 1, 7), ativar temporariamente no dashboard Vercel para evitar cache stale.

---

## 3. Comportamento por fase

### 3.1. Fase 1 — Workspaces

Riscos:

- `npm install` muda de comportamento com workspaces (hoisting)
- Vercel pode detectar monorepo e mudar build heuristics

Acoes obrigatorias:

- Adicionar/confirmar `buildCommand`, `outputDirectory` e `installCommand` em `vercel.json`
- Validar que `npm run build` na raiz ainda produz `dist/` com a web
- Validar deploy preview de PR antes de mergear
- Se `turbo` for adicionado, NAO usar `turbo build` como build command do Vercel nesta fase

Validacao:

```bash
npm run build && ls dist/index.html
```

### 3.2. Fase 4 — EAS + Vercel env

Riscos:

- EAS precisa de env vars de Supabase para builds
- Env vars do Vercel nao propagam para EAS

Acoes obrigatorias:

- Env vars do mobile vao para EAS Secrets (separado do Vercel)
- Documentar quais env vars sao compartilhadas vs exclusivas:
  - `VITE_SUPABASE_URL` → Vercel only (prefixo `VITE_`)
  - `SUPABASE_URL` → EAS secrets (sem prefixo)
  - `SUPABASE_SERVICE_ROLE_KEY` → Vercel + EAS (se necessario no mobile backend)
- NAO criar dependencia circular entre Vercel e EAS

### 3.3. Fase 7 — Migracao da web

Riscos:

- Mover web para `apps/web` muda o caminho de `vite.config.js`, `index.html`, `dist/`
- `api/` precisa continuar resolvendo
- Rewrites precisam continuar funcionando
- CI workflows podem ter paths hardcoded

Acoes obrigatorias:

- Antes de mergear, testar com Vercel preview deploy
- Preparar `vercel.json` ajustado:

```json
{
  "buildCommand": "cd apps/web && npx vite build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "npm install"
}
```

- Validar que `api/*.js` continua resolvendo como serverless functions
- Validar rewrites SPA
- Validar que env vars continuam acessiveis

Gate de aprovacao:

- Deploy preview funcional ANTES de mergear
- Rollback plan documentado (reverter Root Directory + build command)

---

## 4. Matriz de env vars por plataforma

| Variavel | Vercel (web) | EAS (mobile) | `server/bot` | `api/` serverless |
|----------|-------------|-------------|-------------|-------------------|
| `VITE_SUPABASE_URL` | sim | nao | nao | nao |
| `VITE_SUPABASE_ANON_KEY` | sim | nao | nao | nao |
| `SUPABASE_URL` | sim (fallback) | sim | sim | sim |
| `SUPABASE_ANON_KEY` | sim (fallback) | sim | nao | nao |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | nao | sim | sim |
| `TELEGRAM_BOT_TOKEN` | sim | nao | sim | sim |
| `EXPO_ACCESS_TOKEN` | nao | sim (EAS) | nao | nao |

---

## 5. Anti-patterns

### Errado 1 — Mover `api/` junto com a web

```bash
mv api apps/web/api
```

Erro: quebra resolucao de serverless functions do Vercel.

### Errado 2 — Usar Root Directory = `apps/web` sem ajustar `api/`

Erro: Vercel procura `api/` dentro de `apps/web/api/`, nao encontra as functions.

### Errado 3 — Confiar no autodetect do Vercel apos workspaces

Erro: Vercel pode detectar Turbo e mudar build heuristics, quebrando o build command.

---

## 6. Ancoragem e validacao contra a master spec

- Este addendum preserva o deploy funcional da web em TODAS as fases
- Este addendum nao antecipa a migracao da web para `apps/web`
- Este addendum protege o limite de 12 serverless functions
- Este addendum garante que o bot Telegram e `api/notify.js` continuam operacionais
