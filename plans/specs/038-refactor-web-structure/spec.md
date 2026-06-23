# Spec 038 — Refatorar Estrutura de Pastas Web/PWA

- **Feature Directory:** `plans/specs/038-refactor-web-structure`
- **Created:** 2026-06-22
- **Status:** delivered (A #677 · B1 #678 · B2 #679 · C #680) — naming "redesign" aposentado em arquivos/pastas/identificadores + carve-out `derivePrescriptionStatus`→core (R-279). Resta só CSS BEM `*-redesign__*` (cosmético, opcional).
- **Tier:** 1 (Standard — 1 plataforma, sem DB/contrato/ADR; blast radius mecânico amplo → eng-review sugerido)
- **Input:** Auditoria pós-sprint chatbot (2026-06-22) da estrutura `apps/web/src`. Naming `redesign/` legado (redesign entregue), UI de feature dividida entre `views/` e `features/`, Landing solto, `measures/` não documentada.

---

## Context

O redesign da experiência do paciente **acabou e foi entregue**. A pasta de produção das views ainda se chama `views/redesign/` — qualificador transiente que perdeu significado e se repete dentro de `features/medications/components/redesign/`. Isso polui imports (26 arquivos referenciam `views/redesign`), o `vite.config.js` (alias `@settings` + 3 entradas `manualChunks`) e a navegação lazy (`AppViewRouter`). Custo: leitura confusa, onboarding mais lento, naming que sugere obra inacabada.

Objetivo: aposentar o naming `redesign`, agrupar artefatos soltos e alinhar doc — **sem mudar comportamento** da app. Refator puro de estrutura.

Risco principal: `git mv` em monorepo quebra imports relativos/cross-boundary silenciosamente (AP-H27/AP-127), `export *` em barris colide (AP-164), e nomes de `manualChunks` no Vite afetam o bundle (R-117). Guard = build + suíte verde + bundle gzip estável.

---

## User Stories

### US1 — Dev lê estrutura sem ruído de naming legado (P1)
Como desenvolvedor, quero que a pasta de views se chame `views/` (não `views/redesign/`) e que não haja `redesign/` aninhado em features, para que a estrutura reflita o estado entregue da app.

**Acceptance Scenarios:**
- **Given** o app em produção, **When** abro `apps/web/src/views/`, **Then** as views (Dashboard, Stock, Treatments, Medicines, etc.) estão diretamente sob `views/` sem subpasta `redesign/`.
- **Given** o build, **When** rodo `npm run build`, **Then** compila sem erro de import e o bundle gzip permanece ~102 kB (R-117, sem regressão > 5%).
- **Given** a suíte, **When** rodo `test:critical`, **Then** 100% verde (nenhum import quebrado).

```po PO-1
ac:     views movidas para views/ sem subpasta redesign; zero referência a 'views/redesign' ou 'components/redesign' no código
proof:  rtk grep -rn "views/redesign\|components/redesign\|/redesign'" apps/web/src apps/web/vite.config.js
expect: nenhuma ocorrência (saída vazia)
guard:  rtk npm run build && rtk npm run test:critical → build ok + 1388 testes verdes; bundle gzip dentro de ±5% de 102 kB
status: [x] done  # Slice A: grep redesign=0, build ok, 1388 testes verdes, lint 0
```

### US2 — Landing agrupado (P2)
Como desenvolvedor, quero os arquivos de Landing (`Landing`, `LandingHero`, `LandingIcons`, `LandingSections`, `LandingPrototype.css`) agrupados em `views/landing/`, para reduzir poluição na raiz de `views/`.

**Acceptance Scenarios:**
- **Given** `views/`, **When** listo a raiz, **Then** os 5 artefatos Landing estão em `views/landing/` e o lazy import + `manualChunks` da landing apontam para o novo caminho.

```po PO-2
ac:     artefatos Landing agrupados em views/landing/; imports e manualChunks atualizados
proof:  rtk ls apps/web/src/views/landing && rtk grep -rn "Landing" apps/web/src/AppViewRouter.jsx apps/web/vite.config.js
expect: 5 arquivos em views/landing/; refs apontam para views/landing/
guard:  rtk npm run build → landing chunk gerado, sem erro
status: [x] done  # Slice A: views/landing/ (5 arquivos), vite chunk Landing ok, build verde
```

### US3 — Doc alinhada (P3)
Como agente/dev futuro, quero `CLAUDE.md` listando `features/measures/` e a nova estrutura `views/`, para que o mapa mental case com o disco.

```po PO-3
ac:     CLAUDE.md (raiz + apps/web/src/CLAUDE.md se aplicável) reflete features/measures e views/ sem 'redesign'
proof:  rtk grep -n "measures\|views/redesign" CLAUDE.md apps/web/src/CLAUDE.md
expect: 'measures' presente; 'views/redesign' ausente
guard:  N/A (doc)
status: [ ] open
```

---

## Ceremony: eng-review (RC3) — 2026-06-22

**Achado 1 (HIGH — blast radius subestimado):** além das pastas `redesign/` (views + 4 em features), existem **10+ arquivos com sufixo `*Redesign`** — vários FORA de pasta `redesign/` (`dashboard/components/{InsightCard,RingGauge,SmartAlerts}Redesign.jsx`, `stock/components/{PrescriptionTimeline,CostSummary}Redesign.jsx`, `shared/components/ui/BottomNavRedesign.jsx`). FR-002 (só pastas) não os cobre → novo **FR-010**.

**Achado 2 (CRITICAL — collision na renomeação):** remover sufixo `*Redesign` colide com a versão pré-redesign quando ela ainda existe no disco (ex: `MedicineCardRedesign.jsx` vs `MedicineCard.jsx` vivo). Rename cego = sobrescrita do componente errado (clínico). Cada rename DEVE: (1) checar se base-name existe, (2) se existe, confirmar `importers==0` (é o morto), (3) deletar o morto, (4) só então renomear o vivo. Sistêmico (não só `CostSummary`).

**Achado 3 (scope/process):** ~40+ arquivos. Diff único irreviewável → **fatiar em 3 slices/PRs** (A: views move; B: dissolver redesign/ + sufixos com collision-check; C: carve-out + doc). Strangler-fig, nunca estrutural+comportamental na mesma passada (Beck).

**Guard override (UP, RC3):** Tier 1 floor = light → **promovido para FULL** (build + test:critical + bundle gzip ±5% R-117 + audit de collision por rename). Razão: colisão com componentes clínicos vivos (MedicineCard/StockCard) + AP-164/AP-H27. Aplica a TODAS as POs.

## Functional Requirements

- **FR-001** Mover `apps/web/src/views/redesign/*` → `apps/web/src/views/` via `git mv` (preserva história).
- **FR-002** Dissolver `apps/web/src/features/*/components/redesign/` — achatar conteúdo em `components/` (ou subpasta semântica, não-`redesign`).
- **FR-003** Atualizar TODOS os 26 importers + `AppViewRouter` lazy imports + alias `@settings` e `manualChunks` em `vite.config.js`.
- **FR-004** Agrupar artefatos Landing em `views/landing/`.
- **FR-005** Documentar `features/measures/` e a estrutura `views/` em `CLAUDE.md`.
- **FR-006** Resolver `[NEEDS CLARIFICATION]` sobre camada de views ANTES de mexer em código. ✅ Resolvido (A + carve-out).
- **FR-007 (carve-out)** Extrair lógica de domínio vazada das views para feature/core — começar por `deriveProtocolStatus` (hoje em `Stock.jsx`) → `@dosiq/core` ou `features/stock`, com teste unitário.
- **FR-008 (carve-out)** Remover dead code de naming legado: `CostSummary.jsx` (0 importers) e reconciliar pares `*Redesign`/não-`Redesign` (renomear o vivo, deletar o morto) — confirmar importer-count == 0 antes de deletar.
- **FR-009 (carve-out)** Registrar R-NNN leve no C5: "lógica de domínio não nasce em `views/`; desce para feature/core" (disciplina anti-inchaço).
- **FR-010 (RC3)** Remover sufixos `*Redesign` dos arquivos (não só pastas) com **collision-check obrigatório por arquivo**: se o base-name já existe, confirmar `importers==0` (versão morta), deletar, então renomear o vivo. Cobre `dashboard/components/*Redesign`, `stock/components/*Redesign`, `shared/components/ui/BottomNavRedesign`, etc.

## Entrega (RC3) — fatiar em 3 slices/PRs

- **Slice A:** `git mv views/redesign/* → views/` + 26 importers + `@settings` + 3 `manualChunks` + 3 test paths + Landing → `views/landing/` (FR-001/003/004).
- **Slice B:** dissolver 4 pastas `features/*/components/redesign/` + remover sufixos `*Redesign` com collision-check (FR-002/008/010).
- **Slice C:** carve-out `deriveProtocolStatus`→core + FR-009 R-NNN + doc CLAUDE.md (FR-005/007/009).

**Guard (FULL, RC3 override):** todas as POs rodam `build` + `test:critical` + bundle gzip ±5% + audit de collision por rename.

## Success Criteria

- **SC-001** Zero referência a `redesign` em caminhos de import/config (`grep` vazio).
- **SC-002** `npm run build` verde; bundle gzip dentro de ±5% do baseline 102 kB (R-117 preservado).
- **SC-003** `test:critical` 100% verde; `lint` 0 errors.
- **SC-004** 100% dos ACs com PO fechada (`[x]`) ao fim do C-mode.
- **SC-005** Zero mudança de comportamento observável na app (refator puro).

## Assumptions / Open Questions

- **Assumção:** schemas/utils raiz são shims `export *` para `@dosiq/core` (R-129) — fora de escopo, mantidos.
- **Assumção:** `views/admin/` já bem isolado — fora de escopo.
- **[RESOLVED — NC1] (2026-06-22):** Decisão **A + carve-out**. `views/` é camada de composição legítima → corrigir CLAUDE.md (não baixar lógica em massa, evita risco em lógica clínica testada — strangler-fig, RC3). Acréscimos baratos que capturam o benefício de B sem o risco: extrair vazamentos de domínio + matar dead code (ver FR-007/FR-008). B puro descartado (big-bang sobre dose/stock testado, ganho marginal — AP-190/191/193 no histórico).
- **[RESOLVED — NC2] (2026-06-22):** FR-002 = **rename simples** de `features/*/components/redesign/` → achatar em `components/` (sem reorganização por seção).
- **Open:** entregar em 1 PR ou fatiar (views → landing → carve-out → doc)? Sugestão: 1 branch, commits semânticos separados por FR (mesmo modelo do sprint anterior).
