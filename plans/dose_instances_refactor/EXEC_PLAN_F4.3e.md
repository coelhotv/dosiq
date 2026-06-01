# EXEC PLAN — F4.3e: "Pendências de ontem" (carry-over cross-dia) — web + mobile

> **Origem:** MASTER Fase 4 (ln 204-211) — *"janela deslizante cross-dia … seção fixa 'Pendências de ontem' no topo … Simple: carry-over no topo + listão de hoje; Complex: carry-over acima dos períodos"*. Escorregou na F3.2b (web `useDoseZones` ficou day-bound) e foi herdado pela F4.3b (mobile copiou o day-bound).
> **Spec-mãe:** `EXEC_PLAN_F4.3.md` §F4.3e (ln 84-94). Este doc é o plano técnico (P3).
> **Plataforma:** Shared/Core + Web/PWA + Mobile · **SemVer:** Minor (web + mobile — comportamento visível novo) · mobile → **v0.7.1**.
> **ADRs:** ADR-050 (FP-3) · ADR-054 (fonte única `dose_instances`). **Sem ADR novo.**
> **Contrato:** CON-024 (aditivo — novo export `splitDayTimeline`). Não-breaking.

---

## Clarifications (P1.5)

- **Q:** Quão atrás a janela de fetch do **web** precisa ir? → **A:** Hoje o web só busca o dia atual (`useDashboardContext.jsx:72-76` → `getStartOfDayISO(today)`/`getEndOfDayISO(today)`). Carry-over exige ocorrências de **ontem**. Alargar o limite inferior para `getStartOfDayISO(addDays(today,-1))` (1 dia atrás cobre qualquer `pending` de ontem ainda dentro da tolerância — tolerância típica ≤ poucas horas). Mobile já busca 14d → sem mudança de fetch no mobile.
- **Q:** Critério de "actionável" do carry-over? → **A:** ocorrência de dia local ANTERIOR, `status === 'pending'` E `classifyDose(...) ∈ {late, now}` (dentro da tolerância). `taken`→`done`, `missed`/pós-tolerância→`null` ⇒ excluídos (não viram ruído). Mesmo helper core nas duas plataformas (R-231) p/ não divergir.
- **Q:** A seção carry-over reabre o bug do slot-fantasma? → **A:** Não. Carry-over é **seção própria** (não slot de hoje); a janela de HOJE segue day-bound idêntica à F3.2b/F4.3b. O slot-fantasma (dose de ontem 22:30 registrada 00:05) continua fora da janela de hoje.

---

## Design — core `splitDayTimeline` (CON-024 aditivo)

**Arquivo:** `packages/core/src/utils/doseZones.js` (DEFINIÇÃO — verificado: `classifyDose`/`buildDoseItemsFromInstances` vivem aqui).
**Barrel:** `packages/core/src/utils/index.js` (export).

Helper PURO, tz-injetável, deriva o "hoje" do `now` injetado (não usa `new Date()` — `getTodayLocal` é impuro, ln 68-70):

```js
/**
 * Particiona ocorrências em { carryOver, today }:
 *  - today    = janela do dia local atual (comportamento F3.2b/F4.3b).
 *  - carryOver = ocorrências de dia(s) local(is) ANTERIOR(es) ainda actionáveis
 *                (status 'pending' E classifyDose ∈ {late, now} — dentro da tolerância).
 *                Doses de ontem já taken/missed/pós-tolerância NÃO entram.
 * @param {Array} instances
 * @param {Array} protocols
 * @param {{ now: Date, tz?: string }} opts
 * @returns {{ carryOver: DoseItem[], today: DoseItem[] }}
 */
export function splitDayTimeline(instances, protocols, { now, tz = DEFAULT_TZ }) {
  const list = Array.isArray(instances) ? instances : []
  const todayStr = formatLocalDate(getUserTime(now, tz))      // puro: deriva do now
  const dayStart = parseISO(getStartOfDayISO(todayStr, tz)).getTime()
  const dayEnd = parseISO(getEndOfDayISO(todayStr, tz)).getTime()
  const carry = []
  const today = []
  for (const inst of list) {
    if (!inst?.scheduled_for) continue
    const t = parseISO(inst.scheduled_for).getTime()
    if (Number.isNaN(t)) continue
    if (t >= dayStart && t <= dayEnd) { today.push(inst); continue }
    if (t < dayStart && inst.status === 'pending') {
      const zone = classifyDose(inst.scheduled_for, now, 120, 60, 240, false, inst.tolerance_minutes)
      if (zone === 'late' || zone === 'now') carry.push(inst)
    }
  }
  return {
    carryOver: buildDoseItemsFromInstances(carry, protocols, tz),
    today: buildDoseItemsFromInstances(today, protocols, tz),
  }
}
```

Imports adicionais no doseZones.js: `formatLocalDate, getStartOfDayISO, getEndOfDayISO` de `./dateUtils.js` (`getUserTime`/`parseISO` já importados).

**Observação:** o filtro de HOJE no `_useTodayDerived.js` (ln 56-62) e a ausência de carry-over no web `useDoseZones` passam a delegar a este helper — remove a duplicação de fronteiras (R-231).

---

## Deliverables (caminhos canônicos verificados)

### CORE
| # | Arquivo | Ação |
|---|---------|------|
| 1 | `packages/core/src/utils/doseZones.js` | ADD `splitDayTimeline` + imports `formatLocalDate/getStartOfDayISO/getEndOfDayISO` |
| 2 | `packages/core/src/utils/index.js` | export `splitDayTimeline` |
| 3 | `packages/core/src/utils/__tests__/doseZones.test.js` (vitest) | casos: carry actionável (late/now) entra; taken/missed/pós-tolerância de ontem fora; hoje inalterado; tz; vazio |

### WEB (Minor — comportamento novo)
| # | Arquivo | Ação |
|---|---------|------|
| 4 | `apps/web/src/features/dashboard/hooks/useDashboardContext.jsx` (ln 71-76) | alargar fetch: limite inferior `getStartOfDayISO(addDays(today,-1))`; bump da chave de cache `DOSE_INSTANCES_TODAY` (janela mudou) p/ não servir cache stale |
| 5 | `apps/web/src/features/dashboard/hooks/useDoseZones.js` | expor `carryOver` via `splitDayTimeline(doseInstances, protocols, { now: nowRaw, tz: DEFAULT_TZ })`; HOJE = `today` particionado (zones derivam de `today`, não de `allDoses`) |
| 6 | `apps/web/src/views/redesign/Dashboard.jsx` | renderizar seção "Pendências de ontem" no TOPO da lista de hoje, só se `carryOver.length > 0` (reusa `DoseZoneList`/`CronogramaDoseItem`) |
| 7 | `apps/web/src/features/dashboard/hooks/__tests__/useDoseZones.test.js` (vitest) | asserts de `carryOver` (ontem pending dentro da tolerância aparece; sem carry → vazio; hoje inalterado) |

### MOBILE (Minor — v0.7.1)
| # | Arquivo | Ação |
|---|---------|------|
| 8 | `apps/mobile/src/features/dashboard/hooks/_useTodayDerived.js` | trocar o filtro day-bound manual (ln 56-64) por `splitDayTimeline(instances, protocols, { now: nowRaw, tz: DEFAULT_TZ })`; expor `carryOver` (mapeado a timeline-items via `toTimelineStatus`) além de `timeline` (=today) |
| 9 | `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx` | renderizar seção "Pendências de ontem" — **Simple:** acima do listão; **Complex:** acima dos períodos (períodos de hoje inalterados, day-bound) |
| 10 | `apps/mobile/src/features/dashboard/hooks/__tests__/_useTodayDerived.test.js` (jest) | asserts de `carryOver` |
| 11 | `apps/mobile/app.config.js` | APP_VERSION → **0.7.1** |

### SQP / DOCS
| # | Arquivo | Ação |
|---|---------|------|
| 12 | `CHANGELOG.md` [Unreleased] | entradas web Minor + mobile Minor (PT) + store-note mobile |
| 13 | `.agent/memory/contracts/data_and_schema/CON-024.md` + `CONTRACTS_INDEX.md` | aditivo `splitDayTimeline` (C5) |

---

## Aceite (SC)
- [ ] Dose de ontem 22:30 ainda `pending`/`late` dentro da tolerância aparece em "Pendências de ontem" (web + mobile, Simple + Complex).
- [ ] Sem carry-over → render idêntico ao atual (zero regressão visual).
- [ ] Períodos Complex (mobile) inalterados; janela de HOJE segue day-bound.
- [ ] Bug do slot-fantasma segue resolvido (carry-over é seção própria, não slot de hoje).
- [ ] Web e mobile usam o MESMO helper core `splitDayTimeline` (R-231 — sem duplicata de fronteiras).
- [ ] Doses de ontem `taken`/`missed`/pós-tolerância NÃO entram no carry-over.

## Risk flags
- **R1 — fetch web alargado:** mudar a janela exige bump da chave de cache (`DOSE_INSTANCES_TODAY`), senão SWR serve dados sem ontem. Mitigação: nova chave (ex. `_v2` ou range no key).
- **R2 — divergência web↔mobile:** mitigado por helper core único (R-231).
- **R3 — corte da janela de ontem:** usar `classifyDose != null` (∈ {late,now}) + `status==='pending'` como critério; não puxar ontem já `missed`.
- **R4 — texto da UI:** "Pendências de ontem" — conferir paridade web↔mobile (R-166); UI proíbe "protocolo" → usar "tratamento" se houver rótulo.
- **R5 — meia-noite no smoke:** carry-over só visível quando há `pending` actionável de ontem; smoke precisa de dose recente de ontem dentro da tolerância (ou seed controlado, nunca mutar prod — constituição).

## Quality gates
- `rtk lint` (0) ANTES de cada commit.
- `rtk npm run test:critical` (vitest web) + vitest core + `npm test --workspace @dosiq/mobile` (jest).
- `rtk npm run validate:agent` (kill switch 600s) — nunca paralelo (feedback_no_parallel_vitest).
- Build web.
- SQP R-221: versões + CHANGELOG + store-note mobile.
- Smoke PO web + mobile ANTES do PR (R-234, constituição VII).

## Ordem (C3)
core helper + teste → web (fetch → hook → render → teste) → mobile (hook → screen → teste → version) → SQP/CHANGELOG → C5 (CON-024).

## Tasks
- [ ] T001 [core] ADD `splitDayTimeline` em doseZones.js + imports
- [ ] T002 [core] export no barrel index.js
- [ ] T003 [core][C4] teste vitest doseZones (carry/today/tz/vazio)
- [ ] T004 [web] alargar fetch + bump chave cache (useDashboardContext.jsx)
- [ ] T005 [web] expor carryOver via splitDayTimeline (useDoseZones.js)
- [ ] T006 [web] seção "Pendências de ontem" (Dashboard.jsx)
- [ ] T007 [web][C4] teste vitest useDoseZones (carryOver)
- [ ] T008 [mobile] splitDayTimeline + carryOver (_useTodayDerived.js)
- [ ] T009 [mobile] seção carry-over Simple+Complex (TodayScreen.jsx)
- [ ] T010 [mobile][C4] teste jest _useTodayDerived (carryOver)
- [ ] T011 [mobile] APP_VERSION 0.7.1 (app.config.js)
- [ ] T012 [C4] lint 0 + vitest web/core + jest mobile + build web
- [ ] T013 [C4] SQP: CHANGELOG web+mobile Minor + store-note
- [ ] T014 [C5] CON-024 aditivo (splitDayTimeline) + índice + journal + state.json
