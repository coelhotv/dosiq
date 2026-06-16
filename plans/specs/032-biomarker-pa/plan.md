# Plano Técnico — 032 Biomarcador Pressão Arterial

**Feature Directory**: `plans/specs/032-biomarker-pa`
**Spec**: spec.md
**Tier**: 1 (UI sobre schema-ready; zero migração DB)
**Created**: 2026-06-15
**Status**: planned
**Branch**: feature/sprint-W25/032-biomarker-pa

---

## Clarifications

- **Contexto PA**: chips opcionais — `ao_acordar`, `em_repouso`, `apos_exercicio`, `ao_dormir`, `pos_medicacao`. Enum `BIOMARKER_PA_CONTEXTS` + `BIOMARKER_PA_CONTEXT_LABELS` em core (separado do `BIOMARKER_CONTEXTS` de glicemia). Exibido nos cards quando presente.
- **2 séries na tendência**: 2 séries independentes no scatter (sistólica e diastólica); cores neutras — `colors.status.info` (sistólica) e `colors.neutral[400]` (diastólica). Cor = identidade de série, nunca qualidade (SaMD preservado).
- **Formato composto**: `"120 por 80 mmHg"` — helper `formatBiomarkerDisplay(item)` no core (substitui as 4 cópias locais de `formatMeasure` que hoje usam `/`). Nome PT-BR adotado por decisão de PO (spec FR-003).

---

## Technical Context (evidências repo)

| Artefato | Arquivo | Linha verificada |
|----------|---------|-----------------|
| `BIOMARKER_TYPES` inclui `pressao_arterial` | `packages/core/src/schemas/biomarkerLogSchema.js:16` | ✅ |
| `applyPaRefine` exige `value_secondary` p/ PA | `packages/core/src/schemas/biomarkerLogSchema.js:86-89` | ✅ |
| `createBiomarkerRepository` seleciona `value_secondary` | `packages/core/src/repositories/createBiomarkerRepository.js:15` | ✅ |
| Mobile `MeasureLogSheet` tem `UI_TYPES = ['glicemia', 'peso']` | `apps/mobile/src/features/measures/components/MeasureLogSheet.jsx:28` | ✅ (PA fora) |
| Mobile `MeasuresScreen` tem `HUB_TYPES = ['glicemia', 'peso']` | `apps/mobile/src/features/measures/screens/MeasuresScreen.jsx:21` | ✅ (PA fora) |
| Mobile `MeasureCard` tem `formatMeasure` local (usa `/`) | `apps/mobile/src/features/measures/components/MeasureCard.jsx:13-17` | ✅ (precisa mudar p/ "por") |
| Mobile `MeasureDetailSheet` tem `formatMeasure` local (usa `/`) | `apps/mobile/src/features/measures/components/MeasureDetailSheet.jsx:12-14` | ✅ (precisa mudar) |
| Mobile `ScatterTrend` usa `item.value` (uma série) | `apps/mobile/src/features/measures/components/ScatterTrend.jsx:55` | ✅ (precisa dual) |
| Web `MeasuresHub` tem `HUB_TYPES = ['glicemia', 'peso']` | `apps/web/src/features/measures/components/MeasuresHub.jsx:5` | ✅ (PA fora) |
| Web `ScatterTrend` usa `item.value` (uma série) | `apps/web/src/features/measures/components/ScatterTrend.jsx` | ✅ (precisa dual) |
| Web `BiomarkerEventCard` tem `formatMeasure` local (usa `/`) | `apps/web/src/views/redesign/history/BiomarkerEventCard.jsx:27-33` | ✅ (precisa mudar) |
| Web `LastMeasureCard` tem `formatMeasure` local | `apps/web/src/features/measures/components/LastMeasureCard.jsx` | ✅ (precisa mudar) |
| `packages/core/src/utils/` aceita novos exports via `utils/index.js` | `packages/core/src/utils/index.js:10` | ✅ |

---

## Architecture / Approach

### Camada 0 — Core enums + helper (shared web↔mobile)

Adicionar em `packages/core/src/schemas/biomarkerLogSchema.js`:

```js
export const BIOMARKER_PA_CONTEXTS = ['ao_acordar', 'em_repouso', 'apos_exercicio', 'ao_dormir', 'pos_medicacao']
export const BIOMARKER_PA_CONTEXT_LABELS = {
  ao_acordar: 'Ao acordar',
  em_repouso: 'Em repouso',
  apos_exercicio: 'Após exercício',
  ao_dormir: 'Ao dormir',
  pos_medicacao: 'Após medicação',
}
```

Exportar via `packages/core/src/schemas/index.js` (já re-exportado em `core/index.js`).

### Camada 0b — Core helper (shared web↔mobile)

Criar `packages/core/src/utils/biomarkerDisplay.js`:

```js
// formatBiomarkerDisplay(item) → string PT-BR
// PA: "120 por 80 mmHg" | outros: "120 mg/dL"
export function formatBiomarkerDisplay(item) {
  const v = String(item.value).replace('.', ',')
  if (item.value_secondary != null) {
    return `${v} por ${String(item.value_secondary).replace('.', ',')} ${item.unit}`
  }
  return `${v} ${item.unit}`
}
```

Exportar via `packages/core/src/utils/index.js`. Após isso:
- **4 arquivos** que têm `formatMeasure` local trocam para `import { formatBiomarkerDisplay } from '@dosiq/core'` e removem a função local.

### Camada 1 — Fast-log mobile (MeasureLogSheet)

- Adicionar `'pressao_arterial'` a `UI_TYPES`
- Adicionar estado `valueSec` (diastólica)
- Renderizar 2º `TextInput` (`valueSec`) **apenas quando `type === 'pressao_arterial'`**, com label "Diastólica" e mesmo estilo do 1º
- `handleSave`: incluir `value_secondary: coerceDecimal(valueSec)` no payload quando PA; validar ambos (NaN → erro específico)
- `reset()`: limpar `valueSec`

### Camada 2 — Chips de tipo (HUB_TYPES)

- Mobile `MeasuresScreen.jsx`: `HUB_TYPES` → `['glicemia', 'peso', 'pressao_arterial']`
- Web `MeasuresHub.jsx`: `HUB_TYPES` → `['glicemia', 'peso', 'pressao_arterial']`

### Camada 3 — Tendência dual (ScatterTrend)

Ambos os `ScatterTrend` (mobile + web) recebem prop `isPa = type === 'pressao_arterial'`:

- Quando `isPa`:
  - `days[i].values` → `{ sys: number[], dia: number[] }` (separa `item.value` e `item.value_secondary`)
  - Scale unificada sobre todas as leituras (sys + dia)
  - Renderiza 2 pontos por leitura em cores diferentes
  - Média descritiva: "Sistólica: 122 / Diastólica: 81 mmHg" (2 médias separadas)
  - Label "TENDÊNCIA · PRESSÃO ARTERIAL"
- Quando `!isPa`: comportamento inalterado (backward-compat)

### Camada 4 — Exibição composta (cards)

Todos os cards substituem `formatMeasure` local por `formatBiomarkerDisplay` do core:
- `MeasureCard.jsx` (mobile) — timeline/histórico
- `MeasureDetailSheet.jsx` (mobile) — detalhe
- `BiomarkerEventCard.jsx` (web) — timeline
- `LastMeasureCard.jsx` (web) — card "última medida"

### Testes

- `packages/core/src/utils/__tests__/biomarkerDisplay.test.js` — happy path + PA sem `value_secondary` (não deve ocorrer pós-refine, mas importa testar)
- `apps/web/src/features/measures/components/__tests__/ScatterTrend.test.jsx` (novo ou update) — dual series PA
- Mobile: test existente `biomarkerLogSchema.test.js` já cobre schema; `MeasureLogSheet` testável com RTL mas não é crítico neste sprint

---

## Target Files

| Arquivo | Ação | Verificado |
|---------|------|-----------|
| `packages/core/src/schemas/biomarkerLogSchema.js` | EDITAR — add `BIOMARKER_PA_CONTEXTS` + labels | ✅ |
| `packages/core/src/utils/biomarkerDisplay.js` | CRIAR | — (novo) |
| `packages/core/src/utils/index.js` | EDITAR — add export | ✅ |
| `apps/mobile/src/features/measures/components/MeasureLogSheet.jsx` | EDITAR — UI_TYPES + valueSec | ✅ |
| `apps/mobile/src/features/measures/screens/MeasuresScreen.jsx` | EDITAR — HUB_TYPES | ✅ |
| `apps/mobile/src/features/measures/components/MeasureCard.jsx` | EDITAR — trocar formatMeasure | ✅ |
| `apps/mobile/src/features/measures/components/MeasureDetailSheet.jsx` | EDITAR — trocar formatMeasure | ✅ |
| `apps/mobile/src/features/measures/components/ScatterTrend.jsx` | EDITAR — dual series PA | ✅ |
| `apps/web/src/features/measures/components/MeasuresHub.jsx` | EDITAR — HUB_TYPES | ✅ |
| `apps/web/src/features/measures/components/ScatterTrend.jsx` | EDITAR — dual series PA | ✅ |
| `apps/web/src/views/redesign/history/BiomarkerEventCard.jsx` | EDITAR — trocar formatMeasure | ✅ |
| `apps/web/src/features/measures/components/LastMeasureCard.jsx` | EDITAR — trocar formatMeasure | ✅ |
| `packages/core/src/utils/__tests__/biomarkerDisplay.test.js` | CRIAR — testes helper | — (novo) |

---

## Contracts / ADRs

- **CON-025** (biomarkers_log CRUD) — sem mudança breaking; `value_secondary` já no select e no schema.
- **ADR-060** (genérico-first biomarkers_log) — respeitado; PA é tipo existente no enum.
- **ADR-062** (SaMD) — respeitado; sem zona/meta/cor-qualidade.

---

## SQP (R-221)

| Campo | Valor |
|-------|-------|
| Plataformas | Mobile + Web + Shared/Core |
| Impacto SemVer | minor (feature nova para usuário) |
| Versão web | 4.8.0 → **4.9.0** |
| Versão mobile | manter 0.17.0 (Fase C do 012 já foi minor); **0.17.1** (patch dentro do mesmo épico) |
| CHANGELOG seção | `[Unreleased] > Adicionado` |
| Store note | sim (mobile: nova medida registrável) |

---

## Risks / Notes

- `ScatterTrend` usa `item.value` diretamente na média — PA dupla muda a API interna; deve ser backward-compat com prop `isPa` (não quebrar glicemia/peso).
- `MeasureLogSheet` auto-foca no 1º TextInput; com 2 campos o auto-focus deve ir para sistólica, e o usuário navega manualmente para diastólica (próximo campo no teclado).
- PR split: mobile (PR A) → web (PR B), mesmo padrão 012 Fase C.
