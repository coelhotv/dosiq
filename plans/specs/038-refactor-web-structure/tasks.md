# Tasks — 038 Refatorar Estrutura Web

> Tier 1, Guard FULL (RC3). 3 slices/PRs. Cada slice: branch sync ritual (AP-169) → mover → atualizar refs → guard FULL → PR.
> Guard FULL = `lint` 0err + `build` gzip ±5% + `test:critical` verde + audit collision (grep imp==0 antes de delete).

- [x] T001 Resolver NC1+NC2 — ✅ A + carve-out; rename simples [PO-1]

## Slice A — views/redesign → views/ + Landing (PR-A) [PO-1, PO-2]
- [ ] A01 Branch sync ritual (`git fetch` + status) → branch `refactor/038/slice-a-views`
- [ ] A02 `git mv apps/web/src/views/redesign/*` → `apps/web/src/views/` (inclui subpastas history/ profile/ settings/) [PO-1]
- [ ] A03 `AppViewRouter.jsx:9-21` — 12 lazy imports `./views/redesign/X`→`./views/X` [PO-1]
- [ ] A04 `vite.config.js` — alias `@settings` (l.25) + manualChunks HealthHistory/Stock (l.46,50) [PO-1]
- [ ] A05 Atualizar test paths `views/__tests__/{Treatment,HealthHistory,Profile}.test.jsx` [PO-1]
- [ ] A06 `git mv Landing*` → `views/landing/` + import lazy AppViewRouter + manualChunks Landing (l.51) [PO-2]
- [ ] A07 [C4] Guard FULL: lint + build (gzip ±5%) + test:critical + `grep views/redesign` vazio. Colar evidência → fecha PO-1/PO-2
- [ ] A08 PR-A + check-review

## Slice B — dissolver redesign/ + sufixos *Redesign (PR-B) [PO-1]
- [ ] B01 Branch sync → branch `refactor/038/slice-b-redesign-suffix`
- [ ] B02 Investigar importer da base `PrescriptionTimeline.jsx` (1 imp) — decidir consolidar/manter; se ambíguo → ASK operador
- [ ] B03 Para cada base morta (re-confirmar imp==0 AGORA): deletar `{InsightCard,RingGauge,SmartAlerts,CostSummary,StockCard,MedicineCard,ConsultationView,ReminderSuggestion,BottomNav}.jsx`+`.css`
- [ ] B04 Renomear 9 `*Redesign.jsx`→base + atualizar todos importers (`grep ${name}Redesign`)
- [ ] B05 Flatten 4 pastas `features/{consultation,medications,protocols,stock}/components/redesign/` → `components/`
- [ ] B06 [C4] Guard FULL: lint + build (gzip ±5%) + test:critical + `grep -r "Redesign\|components/redesign"` só resolvido. Colar evidência [PO-1]
- [ ] B07 PR-B + check-review

## Slice C — carve-out + doc (PR-C) [PO-3]
- [ ] C01 Branch sync → branch `refactor/038/slice-c-carveout`
- [ ] C02 Extrair `deriveProtocolStatus` de `Stock.jsx` → `packages/core/src/utils/` + teste unit
- [ ] C03 [C5] FR-009: R-NNN "lógica de domínio não nasce em views/; desce p/ feature/core" (RULES_INDEX + detalhe)
- [ ] C04 Atualizar `CLAUDE.md` (raiz + apps/web/src) — `features/measures` + estrutura `views/` sem redesign [PO-3]
- [ ] C05 [C4] Guard FULL: lint + build + test:critical. Colar evidência [PO-3]
- [ ] C06 PR-C + check-review

## C5 (pós-slices)
- [ ] Z01 [C5] R-221 SQP: no-user-impact (refator) — CHANGELOG [Unreleased]; sem bump
- [ ] Z02 [C5] AP se `git mv` quebrar import (reforço AP-H27/AP-164) + journal + state.json
- [ ] Z03 [C5] README specs 038 → delivered
