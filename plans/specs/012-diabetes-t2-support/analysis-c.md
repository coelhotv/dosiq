# Analysis — 012 Fase C (biomarkers_log + fast-logging + timeline híbrida)

**Spec**: `spec.md` (FR-009..012b) · **Plan**: `plan.md` §Fase C · **ADR**: ADR-060 (accepted)
**Tier**: 2 · **Gerado**: Planning 2026-06-14
**Entrega**: SPLIT — PR 3a (mobile + core + migração) → PR 3b (web espelha)
**Escopo UI v1**: glicemia + peso (PA = schema-ready, sem UI 2-campos)

> ⚠️ Este é o **skeleton de Planning**. A Evidence Table de mobile está **UNVERIFIED** por decisão
> do próprio plan (fast-logging/FAB/nav mobile não localizados por grep — T013). O **C1.5 reality-check
> definitivo roda no Coding** (antes do C2 de cada PR), quando T013 confirmar os caminhos reais no
> device. Nenhum PASS é declarado aqui sobre claim não-verificado (anti-rubber-stamp).

---

## 1. Evidence Table

| Spec claim | Real repo (file:line) | Verified? | Note |
|---|---|---|---|
| `biomarkers_log` não existe | MCP list_tables (Planning) | ✅ | net-new; migração T014 cria do zero |
| Timeline builder PURO event-agnóstico | `packages/core/src/services/timeline.js` (builder) | ✅ | adapter entra ao lado; **não tocar** builder (R-252) |
| Adapter de instâncias existe | `timelineService.js:118` `doseInstancesToEvents` | ✅ | `biomarkersToEvents` espelha esse padrão (T016) |
| Registry de cards web | `apps/web/src/views/redesign/history/eventCardRegistry.js` | ✅ | registrar `biomarker` (T017) |
| Formatters de dose (não usados aqui, mas confirmam core) | `packages/core/src/utils/doseUnit.js` | ✅ | irrelevante p/ biomarcador (sem dose) |
| `CON-024 doseZones` = zonas de HORÁRIO (não corporais) | CONTRACTS_INDEX CON-024 | ✅ | períodos madrugada/manhã/tarde/noite p/ agrupar timeline híbrida |
| FAB do Hoje **mobile** | `TodayScreen.jsx:300-309` Pressable única → `handleOpenBulkDose`; modais em `TodayModals` (`:310`) | ✅ T013 | converter p/ speed-dial (2 ações); add modal fast-log medida |
| Timeline "Hoje" **mobile** | `_useTodayDerived.js:8` core `splitDayTimeline`/`buildDoseItemsFromInstances` (**CON-024 doseZones, dose-only**) | ✅ T013 | **NÃO** é o path do adapter R-252; biomarcador "Última medida" via wiring no hook (card no FIM) |
| History **mobile** | `HistoryScreen.jsx` → `useHistoryData` (instâncias) | ✅ T013 | instance-based, **não** consome `getTimeline` |
| **Adapter R-252 `getTimeline`/`eventCardRegistry`** | consumido **só em `apps/web`** (`apps/web/src/services/api/timelineService.js:118`, `views/redesign/history/eventCardRegistry.js`, `HistoryDayPanel.jsx`) — **zero consumer mobile** | ✅ T013 | 🔴 **T016/T017 = path WEB (PR3b)**; mobile não tem registry de eventos |
| Sheet detalhe (espelhar) | `history/components/DoseActionSheet.jsx` (21KB, Modal R-233) | ✅ T013 | padrão p/ sheet detalhe de medida |
| `WeekNav` reusável | `history/components/WeekCalendar.jsx:75` `{selectedDay,onDaySelect,instances,minDay,maxDay,timezone}`; clamp `canGoPrev/canGoNext` (`:82-83`) | ✅ T013 | **reusar padrão** p/ hub 7d (clamp presente=`canGoNext`); R-231 não duplicar |
| Nav Perfil › Ferramentas | `ProfileScreen.jsx:159-170` seção FERRAMENTAS; "Histórico de Doses"→`ROUTES.DOSE_HISTORY` | ✅ T013 | add row "Medidas" após Histórico; **`ROUTES.MEASURES` net-new** (sem rota CONSULTA mobile) |
| Bottom sheet genérico mobile | **não existe** `DosiqBottomSheet`; sheets per-feature via `Modal` (R-233) | ✅ T013 | fast-log sheet = novo Modal R-233; reusar `EmptyState`/`Toast` de `shared/components` |
| Fast-logging/FAB/nav **web** | adapter+registry web existem | ⏭️ PR3b | C1 do PR3b detalha |

**Gate resolvido (T013):** caminhos mobile do PR3a confirmados com file:line — C2 liberado.
**Refinamento material:** adapter R-252 (T016/T017) é **web-only**; mobile não tem registry de timeline.
No PR3a o biomarcador na Agenda de Hoje entra como **card "Última medida" no FIM** via wiring em
`_useTodayDerived` (não interleave no doseZones). Adapter core `biomarkersToEvents` pode entrar no PR3a
(core), mas o consumer é web (PR3b).

---

## 2. Cross-file consistency

spec.md (FR-009..012b) ↔ plan.md §Fase C ↔ tasks.md (T013..T019) ↔ este analysis: **concordam** após
o ajuste de Planning 2026-06-14 (escopo glicemia+peso, PA schema-ready, split mobile→web, mock=visão).
Sem contradição de fluxo. ADR-060 (accepted) é a fonte do shape da tabela e do adapter.

---

## 3. Data-migration completeness

`biomarkers_log` = tabela **nova vazia** (sem dado legado). Migração T014 deve trazer: colunas
(`id,user_id,type,value,value_secondary,unit,measured_at,context,source,notes,created_at`) +
GRANTs (authenticated/service_role) + `ENABLE ROW LEVEL SECURITY` + policy `user_id=auth.uid()` +
REVOKE anon (template CLAUDE.md). CHECK de `type`/`context`/`source`/`unit` sincronizados com Zod
(R-082/R-271). Verificação pós-migração: grants + RLS ativos; insert anon falha.

---

## 4. Coverage (FR → task → SC)

| FR | Task(s) | SC | Cobertura |
|---|---|---|---|
| FR-009 (tabela genérica + value_secondary) | T014, T015 | SC-003 | ✅ |
| FR-010 (fast-logging layout B) | T018 | SC-003 | ✅ (glicemia+peso v1) |
| FR-010b (FAB speed-dial) | T018b | — | ✅ |
| FR-011 (timeline adapter + MeasureCardC) | T016, T017, T017b | SC-003 | ✅ (não toca builder) |
| FR-011b (Área de Medidas + hub scatter) | T018c | SC-003 | ✅ |
| FR-012 (biomarkerLogSchema) | T015 | SC-006 | ✅ (R-082/R-274) |
| FR-012b (estado-zero + transparência erro) | T018, T018c | SC-006 | ✅ |

PA (value_secondary): regra **no schema** (T015 superRefine) + teste (T019) **sem UI** — schema-ready.

---

## 5. Behavioral failure modes (gate de robustez)

### `biomarkerLogSchema` (T015)
| Input / condição | Degenerado | Esperado | Coberto (T019)? |
|---|---|---|---|
| `value` vazio (`''`) | coerção | `z.preprocess('' => null)`; nunca `0` passar `.positive()` | a cobrir |
| `value` vírgula PT-BR (`'110,5'`) | `Number('110,5')=NaN` | normalizar `,`→`.` (R-270/R-276) | a cobrir |
| `type='pressao_arterial'` sem `value_secondary` | NULL | superRefine ERRO (obrigatório p/ PA) | a cobrir |
| `type='glicemia'` com `value_secondary` preenchido | extra | superRefine ERRO (deve ser NULL) | a cobrir |
| update parcial | `.partial()` sobre schema c/ refine | `BaseSchema.partial()` (R-274) — refine só no full | a cobrir |
| `measured_at` futuro | data > now | aceitar (registro retroativo/agora); sem trava | a cobrir |
| `context` valor fora do enum | wrong-case | CHECK + enum Zod rejeitam (R-271) | a cobrir |

### `biomarkersToEvents` adapter (T016)
| Input | Degenerado | Esperado | Coberto? |
|---|---|---|---|
| lista vazia | `[]` | `[]` (sem crash) | a cobrir |
| `measured_at` NULL | sem instante | descartar/log (não ordenar NaN) | a cobrir |
| `value_secondary` NULL (glicemia) | normal | render 1 valor; PA renderiza 2 | a cobrir |
| ordenação cross-meia-noite | instantes | builder ordena por instante absoluto, dia local no tz (R-252) | a cobrir |

### RLS (T014)
| Cenário | Esperado | Coberto? |
|---|---|---|
| user A lê biomarcador de user B | bloqueado (`user_id=auth.uid()`) | a cobrir (fixture 2 users) |
| anon insert | REVOKE → falha | a cobrir |

---

## 6. SaMD checklist (ADR-062 — fronteira legal, não estética)

Mock = visão direcional; estas travas permanecem **independente** da latitude visual:
- [ ] Cor diferencia **tipo** de evento (teal=dose · azul-info=medida), **nunca qualidade** do valor.
- [ ] **Sem** meta/zona/alvo/semáforo/faixa-normal em qualquer superfície (sheet/card/hub).
- [ ] Scatter: pontos/dia, **1 cor**, **sem linha de média** (média = número descritivo).
- [ ] Nenhuma sugestão/cálculo de dose derivado de biomarcador.
- [ ] Sub-agente de UI clínica **não adiciona** elemento clínico ausente do mock (revisão main pré-PR).

---

## 7. Severidade / Gate

- **Sem CRITICAL/HIGH de Planning** (ADR accepted; tabela nova; sem contrato quebrado).
- **Bloqueio operacional:** Evidence Table mobile UNVERIFIED → resolver em T013 antes do C2 do PR3a
  (idem web no PR3b). Reportar `[DEVFLOW: ARTIFACT ANALYSIS BLOCKED]` se codar UI sem path confirmado.
- MEDIUM: reuso de `WeekNav` (investigar p/ não duplicar — R-231).
