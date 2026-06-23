# Plano Técnico — 015 Chatbot IA: Core + Contexto Cross-Device + Port Mobile

**Tier:** 2 · **Spec:** spec.md · **ADR:** ADR-074 (proposed) · **Contrato:** CON-028 (proposed)
**Ceremony:** RC3 eng-review (2026-06-23) — ver `## Ceremony` na spec.

## Summary
Centralizar fetcher + builder de contexto do chatbot em `@dosiq/core/chatbot` (fonte única
web↔Telegram↔mobile), melhorar o contexto agrupando por plano terapêutico, e portar o chat para o
mobile (greenfield e2e). Paridade por construção (fetcher único + builder puro + seam Zod + teste de
paridade).

## Clarifications (resolvidas — RC3 + PO)
- Q: onde montar o contexto? → **(A) client-build** (Telegram=server inerente; web/mobile client).
- Q: local no core? → **`packages/core/src/chatbot/`** (módulo novo).
- Q: builder puro vs adapter? → **PURO** (cada runtime busca via fetcher e injeta).
- Q: paridade dos inputs? → **fetcher canônico no core** (não CRUD repos full); latência mascarada
  por fetch-on-open + loading branded (FR-012).

## Technical Context (evidência real, file:line)
- Web builder: `apps/web/src/features/chatbot/services/contextBuilder.js:36` `buildPatientContext({medicines,protocols,logs,stockSummary,stats,doseInstances})` — recebe do DashboardContext (`ChatWindow.jsx:83`); NÃO busca.
- Server builder: `server/bot/services/chatbotServerService.js:269` `buildServerContext({medicines,protocols,logs,stockSummary,stats})` — **sem doseInstances**; fetch próprio à mão (`:138-153`).
- **Plano já embutido nos protocols** (leverage): web `protocolService.js:5` listSelect inclui `treatment_plan(id,name,emoji,color)`; mobile `dashboardService.js:24` idem → grouping lê `protocol.treatment_plan.name`.
- Derivação já no core: `splitDayTimeline`, `isProtocolActiveOnDate`, `formatDoseItem` (importados em `contextBuilder.js:2`).
- Repo de planos já existe: `packages/core/src/repositories/createTreatmentPlanRepository.js`.
- Endpoint: `api/chatbot.js:91/130/142` recebe `patientContext` string + monta systemPrompt server-side (não muda — não-breaking).
- Mobile: **0 chatbot** (`find apps/mobile/src -iname "*chat*"` vazio); fonte = `dashboardService.js`/`useProtocols`.
- Render markdown web: PR #681 (`ChatMessageList.jsx`) — mobile precisa equivalente nativo.

## Constitution Check
- AP-237 (guard server-side): systemPrompt + safetyGuard ficam no servidor; centralizar contexto NÃO move guardrails p/ cliente. ✓
- R-278 (escopo ativos): builder mantém `p.active && isProtocolActiveOnDate`. ✓
- R-020 (sem `new Date()` no core): builder usa dateUtils do core. ✓
- R-117/R-221: mobile lazy + bump na Onda 2.

## Arquitetura
```
                       @dosiq/core/chatbot/
   ┌──────────────────────────────────────────────────────┐
   │ fetchChatbotContextData({supabase,getUserId})         │ ← selects únicos
   │   → ChatbotContextData (Zod)                          │
   │ buildPatientContext(data) → string                    │ ← puro: filtro ativos +
   │   (grouping por protocol.treatment_plan.name)         │   dias-restantes + grouping
   └──────────┬────────────┬─────────────┬────────────────┘
   web client │  mobile    │ Telegram bot │ (server runtime)
  chatbotSvc  │ chatbotSvc │ chatbotServerService
        → api/chatbot.js (systemPrompt + safetyGuard + Groq, inalterado)
```

## Slicing (ondas — RC3/F3)
- **Onda 1a (PR-1):** core `fetchChatbotContextData` + `buildPatientContext` (consolida lógica atual,
  SEM grouping) + Zod CON-028; web + Telegram adotam; forks deletados; server passa `doseInstances`.
  Teste de paridade web↔server. **Refactor puro** (Beck "make the change easy").
- **Onda 1b (PR-2):** plan-grouping (`protocol.treatment_plan.name`, grupo "Sem plano") + join nos
  selects do fetcher + `treatmentPlans`. Atualiza paridade + grouping. ("make the easy change.")
- **Onda 2 (PR-3):** chat mobile e2e — tela (`FlatList` invertido), `chatbotService` mobile (fetcher
  core + `api/chatbot.js`), markdown nativo (paridade #681), AsyncStorage (teto 20), FR-012
  (fetch-on-open + loading "Iniciando IA do dosiq…"). Bump mobile (R-221).
- **Onda 3 (PR-4):** paridade & polish — SC-002 fps, edge offline, disclaimer parity, store notes.

## Target Files (verificados)
| Path | Onda | Ação |
|------|------|------|
| `packages/core/src/chatbot/fetchChatbotContextData.js` | 1a | criar (fetcher) |
| `packages/core/src/chatbot/buildPatientContext.js` | 1a→1b | criar (builder; grouping em 1b) |
| `packages/core/src/chatbot/index.js` + `packages/core/src/index.js` | 1a | export |
| `packages/core/src/chatbot/__tests__/buildPatientContext.test.js` | 1a→1b | testes builder + grouping |
| `packages/core/src/chatbot/__tests__/parity.test.js` | 1a | teste paridade (FR-011/PO-5) |
| `apps/web/src/features/chatbot/services/chatbotService.js` | 1a | adota core |
| `apps/web/src/features/chatbot/services/contextBuilder.js` | 1a | deletar fork (preservar reexports de config se houver) |
| `apps/web/src/features/chatbot/components/ChatWindow.jsx` | 2 | fetch-on-open + loading (FR-012) |
| `server/bot/services/chatbotServerService.js` | 1a | adota core; remove `buildServerContext`; passa doseInstances |
| `apps/mobile/src/features/chatbot/**` | 2 | criar (tela + service + histórico) |
| `CHANGELOG.md` + mobile version | 2 | SQP (R-221) |

> READ-PATH (R-267): Zod CON-028 + selects do fetcher cobrem medicines/protocols(+treatment_plan)/logs/
> stock/doseInstances/treatmentPlans. Reconfirmar no C1.5 de cada onda.

## Risks + Quality Gates
- **R1 (HIGH):** input divergente (server sem doseInstances). Mitig: CON-028 completo + paridade FR-011 bloqueante.
- **R2 (MED):** web perde reuso DashboardContext → fetch extra. Mitig: fetch-on-open + cache sessão (FR-012).
- **R3 (MED):** deletar forks quebra imports/tests. Mitig: onda 1a refactor puro + validate:agent + testes bot.
- **R4 (LOW):** grouping com plano nulo. Mitig: grupo "Sem plano".
- Guard por onda: **full** (Tier 2 floor) — suíte verde + CON-028 honrado + paridade verde.
