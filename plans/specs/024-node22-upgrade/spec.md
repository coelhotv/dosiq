# 024 — Node.js 20→22 Upgrade + CI Hardening

**Feature Directory:** `plans/specs/024-node22-upgrade/`
**Created:** 2026-06-05
**Status:** IMPLEMENTED
**Tier:** 1 (Standard)
**Input:** Incidente prod AP-210/211/212 (2026-06-04), GitHub Actions Node 20 deprecation warnings

---

## Contexto

O Dosiq está ancorado no Node 20, que atingiu EOL em 30/04/2026. Em 2026-06-04, a Vercel atualizou `@supabase/supabase-js` silenciosamente e o construtor passou a exigir `WebSocket` global — feature que Node 20 não tem. 100% das funções serverless crasharam no import. O workaround (AP-210: `ws` transport) foi aplicado, mas a causa raiz é o Node desatualizado.

Simultaneamente, GitHub Actions emite warnings de deprecação: Node 20 será forçado para Node 24 em **16/06/2026 (11 dias)** e removido dos runners em 16/09/2026.

**Decisões do operador (já resolvidas):**
- Target: **Node 22** (LTS, EOL Abr/2028); upgrade para 24 no médio prazo
- Vercel: usar **CLI** (já configurada no terminal)
- PLAN_SERVER_REGRESSION: **incorporar como parte deste projeto** (smoke test)
- `tj-actions/changed-files`: **substituir por git nativo** (risco supply chain)

---

## User Story

### US1 — Ancorar runtime em Node 22 (Operador / Agente CI)

**Como** operador do Dosiq,
**quero** que o projeto declare e use Node 22 em todos os ambientes (local, Vercel, CI),
**para que** não ocorram crashes silenciosos por incompatibilidade de runtime e o projeto tenha patches de segurança por mais 22 meses.

**Acceptance Scenarios:**

```gherkin
Dado que o projeto está configurado para Node 22
Quando eu executar `node --version` no ambiente local com nvm
Então a versão deve ser v22.x

Dado que o Vercel recebe um deploy
Quando a função serverless inicializar
Então o runtime deve ser Node 22.x (verificável via logs)

Dado que package.json declara engines >=22.0.0
Quando alguém tentar rodar npm install com Node <22
Então deve receber um warning de engine mismatch
```

---

### US2 — Eliminar warnings de Node 20 no CI (Agente CI)

**Como** mantenedor do CI,
**quero** que todos os workflows usem Node 22 e actions compatíveis com Node 24,
**para que** o CI não quebre em 16/06/2026 e não emita deprecation warnings.

**Acceptance Scenarios:**

```gherkin
Dado que o workflow test.yml usa NODE_VERSION '22'
  E github-script@v8
  E tj-actions/changed-files foi substituído por git nativo
Quando um PR for aberto
Então o CI deve rodar sem nenhum warning de Node 20 deprecation

Dado que o workflow gemini-review.yml usa github-script@v8
Quando o Gemini Code Assist executar review
Então não deve haver warnings de Node 20
```

---

### US3 — Gate de cold start serverless (Prevenção AP-212)

**Como** agente de CI,
**quero** que um smoke test importe todos os módulos serverless em Node puro,
**para que** erros de import (como AP-210) sejam detectados antes do deploy.

**Acceptance Scenarios:**

```gherkin
Dado que scripts/smoke-server.mjs existe
Quando eu executar node scripts/smoke-server.mjs em Node 22
Então todos os módulos serverless críticos devem ser importados com sucesso
  E módulos com falha devem causar exit code != 0

Dado que o CI inclui o smoke test como step
Quando um PR modificar arquivos em server/ ou api/
Então o smoke test deve rodar automaticamente
```

---

## Functional Requirements

| ID | Requisito | US |
|----|-----------|:--:|
| FR-01 | Declarar `engines.node: 22.x` em `package.json` raiz | US1 |
| FR-02 | Criar `.nvmrc` com valor `22` | US1 |
| FR-03 | Setar `NODE_VERSION=22` na Vercel via CLI para prod/preview/dev | US1 |
| FR-04 | Mudar `NODE_VERSION: '20'` → `'22'` em `test.yml` e `gemini-review.yml` | US2 |
| FR-05 | Upgrade `actions/github-script@v7` → `@v8` em todos os workflows (test.yml, gemini-review.yml, setup-secrets.yml) | US2 |
| FR-06 | Substituir `tj-actions/changed-files@v44` por step nativo com `git diff` | US2 |
| FR-07 | Criar `scripts/smoke-server.mjs` que importa módulos serverless críticos e falha rápido | US3 |
| FR-08 | Adicionar script `test:smoke-server` em `package.json` | US3 |
| FR-09 | Adicionar smoke-server como step no CI (`test.yml`) | US3 |

---

## Success Criteria

| ID | Critério | Verificação | Gate |
|----|----------|-------------|:----:|
| SC-01 | `.nvmrc` contém `22` | `cat .nvmrc` | G1 |
| SC-02 | `package.json` engines == 22.x | `grep engines package.json` | G1 |
| SC-03 | Vercel NODE_VERSION = 22 | `vercel env ls` | G1 |
| SC-04 | CI: NODE_VERSION '22' em workflows | `grep NODE_VERSION .github/workflows/*.yml` | G1 |
| SC-05 | CI: zero ocorrências de `github-script@v7` | `grep 'github-script@v7' .github/workflows/*.yml` → vazio | G1 |
| SC-06 | CI: zero ocorrências de `tj-actions` | `grep 'tj-actions' .github/workflows/` → vazio | G1 |
| SC-07 | Smoke test passa em Node 22 | `node scripts/smoke-server.mjs` → exit 0 | G2 |
| SC-08 | validate:agent green em Node 22 | `rtk npm run validate:agent` | G3 |
| SC-09 | Build produção OK | `rtk npm run build` | G3 |
| SC-10 | Lint green | `rtk npm run lint` | G3 |
| SC-11 | SQP: version bump aplicado | `grep version apps/web/package.json` | G4 |
| SC-12 | SQP: CHANGELOG.md atualizado | `head -20 CHANGELOG.md` | G4 |
| SC-13 | CI run na PR: zero Node 20 warnings | GitHub Actions log | Post-merge |

---

## SQP (R-221) — Release Impact

| Campo | Valor |
|-------|-------|
| **Plataformas** | Backend/Infra, Web/PWA (CI) |
| **SemVer** | `patch` — sem mudança de API/UX, infraestrutura interna |
| **Version source** | `apps/web/package.json` |
| **CHANGELOG** | `[Unreleased]` → `### Infra` |
| **Mobile store-note** | N/A |

---

## Quality Gates com Hard Stop

Cada fase termina com um **HARD STOP** obrigatório. O agente DEVE parar, apresentar resumo estruturado das alterações, e aguardar aprovação explícita do operador antes de prosseguir.

| Gate | Após | Resumo obrigatório |
|:----:|------|---------------------|
| G1 | Fase 1 (Anchor + CI) | Lista de arquivos modificados + output de grep de validação |
| G2 | Fase 2 (Smoke test) | Arquivos criados + output do smoke test |
| G3 | Fase 3 (Validação full) | Resultado de validate:agent + build + lint |
| G4 | Fase 4 (SQP + Docs) | SQP compliance + lista de arquivos staged + branch name |

> Formato do resumo: bloco de texto estruturado com `╔══ GATE N ══╗` mostrando exatamente o que mudou, o que foi validado, e o que precisa de aprovação.

---

## Assumptions

1. O operador tem `nvm` instalado e pode alternar para Node 22
2. O operador tem Vercel CLI configurada e autenticada
3. `actions/github-script@v8` é API-compatible com `@v7` (mesma interface `github`, `core`, `context`)
4. O smoke test pode usar env vars fake (supabase-js não faz requests no construtor)
5. Node 24 será upgrade separado no médio prazo (Q3/Q4 2026)
6. `ws` transport no supabase server será mantido como defensive coding (custo zero)
