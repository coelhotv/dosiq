# 024 — Node.js 20→22 Upgrade — Plan

**Spec:** [spec.md](./spec.md)
**Tasks:** [tasks.md](./tasks.md)
**Tier:** 1 (Standard)

---

## Technical Context

### Current State (verified via grep/find)

| Item | Valor atual | Arquivo:Linha |
|------|------------|:-------------:|
| `NODE_VERSION` env (test) | `'20'` | [test.yml:29](file:///Users/coelhotv/git/dosiq/.github/workflows/test.yml#L29) |
| `NODE_VERSION` env (review) | `'20'` | [gemini-review.yml:38](file:///Users/coelhotv/git/dosiq/.github/workflows/gemini-review.yml#L38) |
| `github-script` (review) | `@v7` × 11 | [gemini-review.yml](file:///Users/coelhotv/git/dosiq/.github/workflows/gemini-review.yml) (L57,116,207,248,348,486,540,715,772,815,874) |
| `github-script` (secrets) | `@v7` × 1 | [setup-secrets.yml:31](file:///Users/coelhotv/git/dosiq/.github/workflows/setup-secrets.yml#L31) |
| `tj-actions/changed-files` | `@v44` × 1 | [test.yml:55](file:///Users/coelhotv/git/dosiq/.github/workflows/test.yml#L55) |
| `package.json` engines | *(não existe)* | [package.json](file:///Users/coelhotv/git/dosiq/package.json) |
| `.nvmrc` | *(não existe)* | raiz do projeto |
| `apps/web/package.json` version | `4.1.3` | [apps/web/package.json:3](file:///Users/coelhotv/git/dosiq/apps/web/package.json#L3) |
| `gemini-review.yml` L815 | `@v7` (em bloco **comentado**) | Manter como está — não alterar código comentado |

### Nota sobre L815 (gemini-review.yml)

A ocorrência na linha 815 está dentro de um bloco totalmente comentado (`# trigger-rereview`). Decisão: **alterar para v8 mesmo comentado**, para que se alguém descomentar no futuro, já esteja correto. Total: 11 ocorrências (10 ativas + 1 comentada).

---

## Target Files Table

| # | Arquivo | Ação | FR | Verificação |
|---|---------|------|:--:|:-----------:|
| 1 | [package.json](file:///Users/coelhotv/git/dosiq/package.json) | MODIFY — add `engines`, add `test:smoke-server` script | FR-01, FR-08 | `grep engines package.json` |
| 2 | [.nvmrc](file:///Users/coelhotv/git/dosiq/.nvmrc) | **NEW** | FR-02 | `cat .nvmrc` |
| 3 | [test.yml](file:///Users/coelhotv/git/dosiq/.github/workflows/test.yml) | MODIFY — NODE_VERSION, replace tj-actions, add smoke step | FR-04, FR-06, FR-09 | grep |
| 4 | [gemini-review.yml](file:///Users/coelhotv/git/dosiq/.github/workflows/gemini-review.yml) | MODIFY — NODE_VERSION, 11× github-script v7→v8 | FR-05, FR-06 | grep |
| 5 | [setup-secrets.yml](file:///Users/coelhotv/git/dosiq/.github/workflows/setup-secrets.yml) | MODIFY — 1× github-script v7→v8 | FR-05 | grep |
| 6 | [scripts/smoke-server.mjs](file:///Users/coelhotv/git/dosiq/scripts/smoke-server.mjs) | **NEW** | FR-07 | `node scripts/smoke-server.mjs` |
| 7 | [apps/web/package.json](file:///Users/coelhotv/git/dosiq/apps/web/package.json) | MODIFY — version bump | SQP | `grep version` |
| 8 | [CHANGELOG.md](file:///Users/coelhotv/git/dosiq/CHANGELOG.md) | MODIFY — add entry | SQP | `head -20` |

### Files NOT in target (no changes needed)

- `vercel.json` — não declara runtime version
- `server/package.json` — herda engines do monorepo
- `cache-cleanup.yml` — não usa Node / setup-node / github-script

---

## Implementation Details

### T005 — Substituir tj-actions/changed-files por git nativo

O uso atual (test.yml L53-58):
```yaml
- name: Get changed files
  id: changed-files
  uses: tj-actions/changed-files@v44
  with:
    files: |
      **/*.{js,jsx}
```

Consumido em L61-62:
```yaml
if: ... && steps.changed-files.outputs.any_changed == 'true'
run: npx eslint ${{ steps.changed-files.outputs.all_changed_files }}
```

**Replacement nativo:**
```yaml
- name: Get changed files
  id: changed-files
  run: |
    FILES=$(git diff --name-only --diff-filter=ACMRT origin/${{ github.event.pull_request.base.ref || 'main' }}...HEAD -- '*.js' '*.jsx' | tr '\n' ' ')
    echo "all_changed_files=$FILES" >> $GITHUB_OUTPUT
    if [ -n "$FILES" ]; then
      echo "any_changed=true" >> $GITHUB_OUTPUT
    else
      echo "any_changed=false" >> $GITHUB_OUTPUT
    fi
```

**Considerações:**
- `--diff-filter=ACMRT` — Added, Copied, Modified, Renamed, Type-changed (exclui Deleted — não faz sentido lintar arquivo deletado)
- `origin/${{ github.event.pull_request.base.ref || 'main' }}` — funciona em PR e em push
- Requer `fetch-depth: 0` no checkout (já presente no job lint? verificar)

### T007 — github-script v7→v8 (gemini-review.yml)

**11 ocorrências** — todas usam a mesma interface (`github`, `core`, `context`, `require()`). A v8 é backward-compatible com a v7 para esses usos.

Método: `AllowMultiple=true` no replace tool com `actions/github-script@v7` → `actions/github-script@v8`.

### T011 — smoke-server.mjs

**Módulos a importar (cold start):**

| Módulo | Path | Criticidade |
|--------|------|:-----------:|
| Supabase client | `server/services/supabase.js` | CRÍTICA (root cause AP-210) |
| Bot factory | `server/bot/bot-factory.js` | ALTA |
| Notification dispatcher | `server/notifications/dispatcher/` | ALTA |
| Notification payloads | `server/notifications/payloads/` | MÉDIA |
| Dead letter queue | `server/services/deadLetterQueue.js` | MÉDIA |

**Approach:**
- `import()` dinâmico com try/catch por módulo
- Set env vars mínimas antes do import (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` com valores fake)
- Console output com ✅/❌ por módulo
- `process.exit(1)` se qualquer CRÍTICA falhar

### Vercel CLI (T003)

```bash
vercel env add NODE_VERSION 22 --environment production preview development
```

Nota: pode exigir confirmação interativa. Se falhar, fallback para 3 comandos separados:
```bash
vercel env add NODE_VERSION 22 --environment production
vercel env add NODE_VERSION 22 --environment preview
vercel env add NODE_VERSION 22 --environment development
```

---

## Risks & Mitigations

| Risco | Probabilidade | Mitigação |
|-------|:------------:|-----------|
| `github-script@v8` tem breaking change na API | Baixa | Verificado: mesma interface `github`/`core`/`context`; v8 apenas muda runtime Node |
| git nativo não replica exatamente o glob pattern `**/*.{js,jsx}` | Baixa | Git `-- '*.js' '*.jsx'` faz match em qualquer profundidade por default |
| Smoke test falha por env var faltante | Média | Set env vars fake antes do import; supabase-js não faz request no construtor |
| Vercel CLI não aceita o valor | Muito baixa | Fallback: 3 comandos separados por environment |

---

## C2 Gate Preview

```
╔══ DEVFLOW C2 GATE ══════════════════════════════════╗
║ Tier              : 1                                ║
║ Spec dir          : plans/specs/024-node22-upgrade    ║
║ Artifact analysis : n/a (Tier 1)                     ║
║ Reality check     : evidence table ✅ (grep verified) ║
║ Files to modify   : 8 (5 MODIFY, 2 NEW, 1 CLI)      ║
║ Contracts touched : none                             ║
║ Rules to apply    : R-221, R-262, R-263, R-264       ║
║ Watch-for AP-NNN  : AP-210, AP-211, AP-212           ║
║ Tasks source      : tasks.md (27 tasks)              ║
║ C3 order          : F1(config)→F2(smoke)→F3(val)→F4  ║
║ C4 quality gates  : lint, validate:agent, build      ║
╚═════════════════════════════════════════════════════╝
```

---

## Fetch-depth Verification

```
test.yml lint job checkout (L41-42):
  uses: actions/checkout@v4
  (NO fetch-depth specified — default is 1)
```

> [!WARNING]
> O job `lint` usa `fetch-depth: 1` (default). O replacement nativo com `git diff origin/main...HEAD` **requer** `fetch-depth: 0` para ter acesso ao base branch. **AÇÃO NECESSÁRIA:** adicionar `fetch-depth: 0` ao checkout do job lint.
