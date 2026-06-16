# Tasks — 032 Biomarcador Pressão Arterial

**Spec**: plans/specs/032-biomarker-pa/spec.md
**Plan**: plans/specs/032-biomarker-pa/plan.md
**Tier**: 2 (eng-review + ADR-070) | **Status**: ✅ ENTREGUE (PR #669 + #670 mergeados 2026-06-16)

---

## PR A — Mobile + Core

### Setup
- [ ] T001 — git branch `feature/sprint-W25/032-biomarker-pa` a partir de main atualizado
- [ ] T002 — SQP: registrar plataformas (Mobile + Core), impacto minor, versão mobile 0.17.0→0.17.1

### Migração DB (ADR-070)
- [ ] T005 — Confirmar nome real da constraint: `SELECT conname FROM pg_constraint WHERE conrelid='public.biomarkers_log'::regclass AND contype='c'`
- [ ] T006 — Criar `docs/migrations/20260616_drop_biomarker_context_check.sql` (`ALTER TABLE ... DROP CONSTRAINT`); aplicar via mcp__supabase__apply_migration; verificar com `\d biomarkers_log` que CHECK sumiu
- [ ] T007 — Smoke pós-migração: INSERT de `context='em_repouso'` aceito pelo DB (antes era rejeitado)

### Core — enums PA + refine (shared)
- [ ] T008 — `biomarkerLogSchema.js`: adicionar `BIOMARKER_PA_CONTEXTS` + `BIOMARKER_PA_CONTEXT_LABELS` (5 valores); `context` valida união `z.enum([...BIOMARKER_CONTEXTS, ...BIOMARKER_PA_CONTEXTS])`; exportar via `schemas/index.js`
- [ ] T008b — `applyPaRefine`: guard `type ↔ família de contexto` (PA→só PA contexts; glicemia→só glicemia contexts; peso/batimentos→sem contexto) (achado #3)
- [ ] T009 — Testar em `biomarkerLogSchema.test.js`: 5 valores PA; contexto PA aceito p/ tipo PA; contexto PA rejeitado p/ glicemia; contexto glicemia rejeitado p/ PA (negative-path)

### Core helper (shared)
- [ ] T010 — Criar `packages/core/src/utils/biomarkerDisplay.js` com `formatBiomarkerDisplay(item)` → `"S por D mmHg"` (PA) ou `"V unit"` (outros)
- [ ] T011 — Exportar `formatBiomarkerDisplay` via `packages/core/src/utils/index.js`
- [ ] T011b — Helper `formatBiomarkerContext(context)`: resolve label via `BIOMARKER_CONTEXT_LABELS`/`BIOMARKER_PA_CONTEXT_LABELS`; degrada em valor desconhecido (DB livre pós-ADR-070 → fallback ocultar, nunca crash); exportar
- [ ] T012 — Criar `packages/core/src/utils/__tests__/biomarkerDisplay.test.js`: PA happy path, não-PA, `value_secondary=null` em tipo não-PA (deve usar 1 componente)

### Mobile — fast-log
- [ ] T020 — `MeasureLogSheet.jsx`: adicionar `'pressao_arterial'` a `UI_TYPES`
- [ ] T021 — `MeasureLogSheet.jsx`: estado `valueSec` + reset + auto-clear quando tipo muda para não-PA
- [ ] T022 — `MeasureLogSheet.jsx`: renderizar 2º TextInput (diastólica) visível somente quando `type === 'pressao_arterial'`; label "Diastólica", unidade `mmHg`, keyboardType `decimal-pad`; 1º campo `returnKeyType="next"` p/ navegar à diastólica (achado #6)
- [ ] T023 — `MeasureLogSheet.jsx`: `handleSave` inclui `value_secondary: coerceDecimal(valueSec)` para PA; valida ambos NaN (erro específico: "Digite sistólica e diastólica válidas")
- [ ] T024 — `MeasureLogSheet.jsx`: chips de contexto PA com `BIOMARKER_PA_CONTEXTS`/`BIOMARKER_PA_CONTEXT_LABELS` visíveis quando `type === 'pressao_arterial'` (estado `paContext`, reset ao trocar tipo)

### Mobile — chips e hub
- [ ] T030 — `MeasuresScreen.jsx`: `HUB_TYPES` → `['glicemia', 'peso', 'pressao_arterial']`

### Mobile — exibição composta
- [ ] T040 — `MeasureCard.jsx`: remover `formatMeasure` local; importar `formatBiomarkerDisplay` de `@dosiq/core`
- [ ] T041 — `MeasureDetailSheet.jsx`: remover `formatMeasure` local; importar `formatBiomarkerDisplay` de `@dosiq/core`

### Mobile — tendência dual
- [ ] T050 — `ScatterTrend.jsx` (mobile): aceitar prop `isPa` (default `false`)
- [ ] T051 — `ScatterTrend.jsx` (mobile): quando `isPa`, separar `days[i].values` em `{ sys, dia }`; escala unificada sobre todas as leituras
- [ ] T052 — `ScatterTrend.jsx` (mobile): renderizar círculo sistólica (cor info) e losango/círculo menor diastólica (cor neutral[400]) por leitura — 2 pontos visualmente distintos, sem linha/zona
- [ ] T053 — `ScatterTrend.jsx` (mobile): média descritiva quando PA: "Sistólica: X · Diastólica: Y mmHg"
- [ ] T054 — `MeasuresScreen.jsx`: passar `isPa={type === 'pressao_arterial'}` para `ScatterTrend`

### [C4] Validação Mobile
- [ ] T060 [C4] — `rtk npm run test:critical` passa (core tests + schema)
- [ ] T061 [C4] — Smoke mobile: registrar PA "120 / 80", ver card com "120 por 80 mmHg", ver tendência com 2 pontos por leitura
- [ ] T062 [C4] — Smoke mobile: registrar glicemia após — chip troca, tendência volta para 1 série; PA não afetada
- [ ] T063 [C4] — Smoke mobile: PA sem diastólica → erro de validação (não grava)
- [ ] T064 [C4] — Smoke mobile: vírgula PT-BR `120,5` funciona em ambos os campos
- [ ] T065 [C4] — SC-002 verificado: nenhuma cor de qualidade, nenhuma meta, nenhuma classificação visível

### Commit PR A
- [ ] T070 — Lint antes do commit (`rtk lint`)
- [ ] T071 — `rtk npm run validate:agent`
- [ ] T072 — bump `APP_VERSION` mobile para 0.17.1 em `app.config.js`
- [ ] T073 — CHANGELOG.md `[Unreleased] > Adicionado`: "Pressão arterial como tipo de medida (registro 2 campos + tendência dual) — mobile"
- [ ] T074 — commit semântico: `feat(measures): PA dual-field fast-log + scatter 2 séries — mobile 0.17.1`
- [ ] T075 — push + PR

---

## PR B — Web (após merge PR A ou em paralelo a partir do mesmo branch base)

### Mobile — exibição de contexto PA nos cards
- [ ] T045 — `MeasureCard.jsx`: exibir contexto PA quando `item.context` presente, usando `BIOMARKER_PA_CONTEXT_LABELS` (ou `BIOMARKER_CONTEXT_LABELS` se compartilhado — verificar no Coding)
- [ ] T046 — `MeasureDetailSheet.jsx`: idem

### Web — chips e hub
- [ ] T100 — `MeasuresHub.jsx`: `HUB_TYPES` → `['glicemia', 'peso', 'pressao_arterial']`

### Web — exibição composta
- [ ] T110 — `BiomarkerEventCard.jsx`: remover `formatMeasure` local; importar `formatBiomarkerDisplay` de `@dosiq/core`
- [ ] T111 — `LastMeasureCard.jsx`: remover `formatMeasure` local; importar `formatBiomarkerDisplay` de `@dosiq/core`

### Web — tendência dual
- [ ] T120 — `ScatterTrend.jsx` (web): aceitar prop `isPa` (default `false`)
- [ ] T121 — `ScatterTrend.jsx` (web): quando `isPa`, separar `days[i].values` em `{ sys, dia }`; escala unificada
- [ ] T122 — `ScatterTrend.jsx` (web): renderizar 2 classes de SVG `circle` distintas (`.scatter__point--sys` e `.scatter__point--dia`) — CSS: cor info e neutral-400
- [ ] T123 — `ScatterTrend.jsx` (web): média descritiva dupla quando PA
- [ ] T124 — `MeasuresHub.jsx`: passar `isPa={type === 'pressao_arterial'}` para `ScatterTrend`

### Web — exibição de contexto PA nos cards
- [ ] T115 — `BiomarkerEventCard.jsx`: exibir contexto PA quando `p.context` presente + tipo PA, usando `BIOMARKER_PA_CONTEXT_LABELS`
- [ ] T116 — `LastMeasureCard.jsx`: idem

### Web — fast-log (MedicineCreate / RegisterSpeedDial)
- [ ] T130 — Verificar se RegisterSpeedDial web chama o modal de medida; se sim, confirmar que `pressao_arterial` aparece como opção (deve fluir de `UI_TYPES`/`HUB_TYPES`); smoke rápido

### [C4] Validação Web
- [ ] T140 [C4] — `rtk npm run validate:agent`
- [ ] T141 [C4] — Smoke web: registrar PA, ver "120 por 80 mmHg" no card do histórico e em LastMeasureCard
- [ ] T142 [C4] — Smoke web: tendência com chip "Pressão arterial" mostra 2 pontos p/ leitura, sem zona/meta
- [ ] T143 [C4] — SC-002 e SC-003 verificados

### Commit PR B
- [ ] T150 — Lint + validate:agent
- [ ] T151 — bump `package.json` web: 4.8.0 → 4.9.0
- [ ] T152 — CHANGELOG.md: "Pressão arterial — espelho web (tendência dual + exibição composta)"
- [ ] T153 — commit: `feat(measures): PA dual-field + scatter 2 séries — web 4.9.0`
- [ ] T154 — push + PR

---

## [C5] DEVFLOW Post-Code

- [ ] T200 [C5] — Novo R-NNN se padrão "prop `isPa` para dual-series" merecer (avaliar no Coding)
- [ ] T201 [C5] — Registrar `formatBiomarkerDisplay` como helper core canônico (consolidação de 4 cópias locais)
- [ ] T202 [C5] — Journal entry W25 + SQP release log (web 4.9.0, mobile 0.17.1, migração ADR-070, store note)
- [ ] T203 [C5] — ADR-070 já accepted no DECISIONS_INDEX; confirmar `decisions_count` no state.json (+1)
- [ ] T204 [C5] — `state.json`: status → completed, journal_entries_since_distillation++
