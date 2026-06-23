# Feature Specification: Chatbot IA — Core + Contexto Cross-Device + Port Mobile

**Feature Directory**: `plans/specs/015-ai-chatbot-mobile`
**Created**: 2026-06-01 · **Rewritten**: 2026-06-23 (escopo ampliado, draft→specified)
**Status**: specified
**Tier**: 2 (Epic — cross-platform web+mobile+server/core; ADR de centralização; multi-PR fatiável)
**Input**: PO (2026-06-23) — "ampliar 015 para não só portar o bot pro mobile, mas melhorar o contexto dos prompts; levar o chatbot IA pro core, em 3 ondas como o port dos CRUDs (MASTER_PLAN G1→G2→G3)"

---

## Context

O Chatbot IA do Dosiq já roda em produção no **PWA** e no **Telegram**. Mas a lógica de
**construção de contexto do paciente** (o "prontuário em memória" enviado ao LLM) está
**duplicada em dois forks**:

- **Web/PWA:** `apps/web/src/features/chatbot/services/contextBuilder.js::buildPatientContext` — roda
  client-side (dados já no browser), monta a string e envia ao serverless `api/chatbot.js`.
- **Telegram:** `server/bot/services/chatbotServerService.js::buildServerContext` — implementação
  **separada** ("adaptado de contextBuilder.js"), server-side, busca dados próprios no Supabase.

Dois problemas se somam, e esta spec ataca os três eixos de uma vez (daí Tier 2):

1. **Duplicação → drift.** Toda melhoria de contexto precisa ser feita 2× (web + server), com risco
   de divergência clínica entre superfícies (já visto em R-278, que teve de ser aplicado nos dois).
2. **Contexto pobre.** O builder lista medicamentos de forma **flat**, sem agrupar pelo **plano
   terapêutico** que o usuário criou (`treatment_plans.name` — ex. "quarteto fantástico",
   "dislipidemia"). Sem esse agrupamento, o bot infere a "intenção" por classe terapêutica e erra o
   enquadramento (output real do PO: listou 10 meds soltos ao perguntar "quais sintomas o conjunto
   trata", em vez de responder pelos planos nomeados).
3. **Mobile sem chat.** O app nativo não tem o chatbot (gap 🔴 no MASTER_PLAN, Fase 6).

A solução segue a filosofia **Service-First** do MASTER_PLAN: centralizar o builder em `@dosiq/core`
(fonte única), melhorar o contexto **uma vez** lá, e fazer web/Telegram/mobile **consumirem** o core.

---

## User Scenarios & Testing

### User Story 1 — Contexto ciente de plano terapêutico (Priority: P1)
**Why**: o bot responde pela **intenção** do usuário (os planos que ele nomeou), não por inferência
de classe. Melhoria de qualidade que vale para web, Telegram e mobile de uma vez.
**Independent Test**: usuário com ≥2 planos nomeados pergunta "quais sintomas o conjunto dos meus
tratamentos trata?"; o contexto enviado ao LLM agrupa os medicamentos sob o nome de cada plano.

**Acceptance Scenarios**:
1. Given um usuário com protocolos vinculados a `treatment_plans` nomeados ("dislipidemia",
   "quarteto fantástico"), When o contexto do paciente é montado, Then os medicamentos aparecem
   **agrupados pelo nome do plano**, e protocolos sem plano caem num grupo "Sem plano".
2. Given o contexto agrupado, When enviado ao LLM, Then a resposta referencia os planos pelo nome.

```po PO-1
ac:     contexto agrupa medicamentos por treatment_plans.name; protocolos órfãos → grupo "Sem plano"
proof:  npm run test --workspace @dosiq/core -- chatbotContext
expect: testes de agrupamento por plano (com/sem plano nomeado) verdes
guard:  full — suíte @dosiq/core verde; contexto sem plano nomeado mantém formato legado (compat)
status: [ ] open
```

### User Story 2 — Builder de contexto único no core (Priority: P1)
**Why**: mata o fork web↔server; melhoria de contexto deixa de ser feita 2×; paridade clínica
garantida por construção (uma fonte).
**Independent Test**: web (`chatbotService`) e Telegram (`chatbotServerService`) importam o builder
de `@dosiq/core`; os forks locais são deletados; suítes de ambos passam sem alteração de saída
(exceto o agrupamento novo da US1).

**Acceptance Scenarios**:
1. Given o builder canônico em `@dosiq/core`, When web e Telegram montam contexto, Then ambos usam
   a **mesma** função e produzem a mesma string para os mesmos dados.
2. Given os forks `contextBuilder.js` (web) e `buildServerContext` (server), When a onda 1 fecha,
   Then ambos foram removidos / viram cascas finas que só injetam os dados da plataforma.

```po PO-2
ac:     web e server consomem o builder de @dosiq/core; forks locais removidos (0 refs)
proof:  rtk grep -rn "buildServerContext\|function buildPatientContext" apps/web/src server/bot
expect: definições residem só em @dosiq/core; web/server apenas importam
guard:  full — validate:agent (web) verde + testes do bot verdes; CON-028 honrado
status: [ ] open
```

### User Story 3 — Chat nativo no mobile com paridade de contexto (Priority: P1)
**Why**: fecha o gap de paridade (MASTER_PLAN); o mobile herda o contexto melhorado de graça por
consumir o core.
**Independent Test**: abrir o chat no app nativo, perguntar "qual meu próximo remédio?"; o app monta
o contexto via core (fuso GMT-3), envia ao `api/chatbot.js` e renderiza a resposta em markdown.

**Acceptance Scenarios**:
1. Given o chat nativo aberto, When o paciente envia uma mensagem, Then o app monta o `patientContext`
   via `@dosiq/core` e chama `api/chatbot.js` (mesma rota do PWA).
2. Given a resposta recebida, Then a tela renderiza markdown (**negrito**, listas `-`/`*`/`+`,
   itálico) com paridade ao render web (ver #681) + disclaimer clínico.
3. Given offline, Then o envio é desabilitado com aviso de conexão; histórico limitado a 20 msgs
   (`CHATBOT_MAX_HISTORY`) no AsyncStorage.

```po PO-3
ac:     chat mobile monta contexto via core + chama api/chatbot.js + renderiza markdown com disclaimer
proof:  MANUAL — smoke iOS+Android: enviar pergunta, conferir resposta markdown + grupos de plano + disclaimer
expect: resposta renderizada (negrito/listas/itálico), agrupada por plano, com disclaimer; offline desabilita envio
guard:  full — npx expo export OK; jest mobile verde; validate:agent web inalterado
status: [ ] open
```

### User Story 4 — Disclaimer & Safety Guard preservados (Priority: P1)
**Why**: não regredir a proteção clínica (SaMD) ao mexer no contexto.
**Acceptance Scenarios**:
1. Given qualquer superfície, When o usuário pede diagnóstico/prescrição, Then o disclaimer clínico
   padrão é exibido e o `safetyGuard` server-side atua (AP-237 — guard no servidor, não no cliente).

```po PO-4
ac:     disclaimer + safetyGuard server-side inalterados após centralização do contexto
proof:  npm run test:critical (web) + testes do bot — casos de safety/disclaimer
expect: testes de safetyGuard/disclaimer verdes nas 3 superfícies
guard:  full — nenhuma regra ABSOLUTA (systemPrompt server-side) movida para o cliente (AP-237)
status: [ ] open
```

---

## Edge Cases

- **Protocolo sem `treatment_plan_id`** → grupo "Sem plano" (não quebra; compat com usuários que não
  nomeiam planos).
- **`treatment_plans.name` ausente/nulo** → fallback para "Plano sem nome" ou agrupa em "Sem plano".
- **Offline (mobile)** → envio desabilitado + aviso; leitura do histórico via AsyncStorage.
- **Histórico gigante** → teto 20 msgs (`CHATBOT_MAX_HISTORY`).
- **Plano com 1 só medicamento** → ainda agrupa (header do plano + 1 item), não vira flat.

---

## Requirements

### Functional Requirements

- **FR-001 (core):** Criar builder canônico de contexto do paciente em `@dosiq/core` (ex.
  `packages/core/src/chatbot/`), consolidando `buildPatientContext` (web) + `buildServerContext`
  (server) numa única função pura. Entrada: dados já normalizados (medicines, protocols, logs,
  stockSummary, stats, doseInstances, **treatmentPlans**).
- **FR-002 (contexto):** Agrupar medicamentos por `treatment_plans.name`; protocolos sem plano →
  grupo "Sem plano". Manter os demais blocos (alertas de estoque, doses pendentes/atrasadas).
- **FR-003 (web G3):** `chatbotService.js` (web) passa a importar o builder do core; `contextBuilder.js`
  local removido; passar `treatmentPlans` no fetch.
- **FR-004 (server G3):** `chatbotServerService.js` (Telegram) passa a usar o builder do core;
  `buildServerContext` local removido (mantém só o fetch server-side dos dados); passar planos.
- **FR-005 (mobile G1):** Tela de chat nativa (`FlatList` invertido, `TextInput`, chips "digitando")
  + `chatbotService` mobile que monta contexto via core e chama `api/chatbot.js`.
- **FR-006 (mobile):** Render markdown nativo com paridade ao web #681 (negrito, listas `-`/`*`/`+`,
  itálico, quebras) + disclaimer clínico obrigatório.
- **FR-007 (mobile):** Histórico local em AsyncStorage, teto `CHATBOT_MAX_HISTORY` (20).
- **FR-008 (segurança):** `safetyGuard` + systemPrompt permanecem **server-side** (AP-237); o cliente
  só envia `patientContext`. Centralizar o contexto NÃO move guardrails para o cliente.
- **FR-009 (contrato):** Registrar **CON-028** (interface do builder de contexto do core) e **ADR-074**
  (decisão de centralização web↔server↔mobile).

### Key Entities
- **PatientContext (string):** prontuário compacto enviado ao LLM; agora seccionado por plano.
- **TreatmentPlan:** `{ id, name }` — agrupa protocolos (já existe; `treatment_plan_id` em protocol).
- **ChatMessage / ChatHistorySnapshot (mobile):** remetente, timestamp, corpo; snapshot AsyncStorage.

---

## Ondas de Entrega (modelo MASTER_PLAN G1→G2→G3, adaptado)

> Adaptação: como **já existem dois forks** (web client + Telegram server), a extração para o core
> (G2) e a migração dos consumidores existentes (G3) acontecem juntas na Onda 1; o mobile é o
> consumidor **novo** (G1-style: consome o core já pronto).

```
Onda 1 (PR-1) — Core + contexto melhorado + adoção web/server   [G2-extract + G3-migrate]
  → @dosiq/core builder canônico + plan-grouping (FR-001/002/009)
  → web (FR-003) e Telegram (FR-004) adotam; forks deletados
  → CON-028 + ADR-074; testes de paridade (mesma saída p/ mesmos dados, exceto grupos)

Onda 2 (PR-2) — Chat mobile consumindo o core                    [G1-copy/consume]
  → tela nativa + chatbotService mobile (FR-005) + markdown (FR-006) + AsyncStorage (FR-007)
  → bump mobile (R-221); smoke iOS+Android

Onda 3 (PR-3) — Paridade & polish
  → SC-002 (fps), paridade de disclaimer/markdown, edge cases offline, store notes
```

---

## Success Criteria

- **SC-001:** Builder de contexto **único** em `@dosiq/core`; 0 referências a `buildServerContext`/
  `buildPatientContext` fora do core (forks removidos).
- **SC-002:** Contexto agrupado por plano nas 3 superfícies (web, Telegram, mobile) com mesma fonte.
- **SC-003:** Chat nativo funcional (envio, resposta markdown, disclaimer, offline) iOS+Android.
- **SC-004:** Rolagem mobile ≥ 55fps; histórico teto 20.
- **SC-005:** 100% dos ACs com PO fechado (status [x]) ao fim de cada onda.
- **SC-006:** `safetyGuard`/systemPrompt permanecem server-side (AP-237 não regride).

---

## Assumptions / Open Questions

- **[ASSUMPTION]** Mobile espelha o web: monta contexto **client-side** e chama o serverless
  `api/chatbot.js` (Groq via Vercel) — NÃO cria um 3º builder server-side. (Confirmado pela arquitetura
  atual: web é client-side; api só monta systemPrompt + chama Groq.)
- **[ASSUMPTION]** `treatment_plans` já expõe `name` consultável por `treatment_plan_id` via
  `treatmentPlanService`; o fetch de cada superfície passa a incluí-lo (additivo, sem migração DB).
- **[NEEDS CLARIFICATION]** Localização canônica no core: `packages/core/src/chatbot/` (novo módulo)
  vs `packages/core/src/utils/` — resolver no eng-review/planning (afeta CON-028 e o index do core).
- **[NEEDS CLARIFICATION]** O builder do core deve receber dados **já buscados** (puro, sem Supabase)
  ou um adapter de fetch? Preferência: **puro** (cada plataforma busca e injeta — igual hoje), p/
  manter o core sem dependência de plataforma (alinha ADR-045/repos). Confirmar no planning.

---

## Ceremony / ADR

- **ADR-074 (proposed):** Centralizar o builder de contexto do chatbot em `@dosiq/core` (fonte única
  web↔Telegram↔mobile), builder **puro** (recebe dados, não busca). Mata o fork e o drift (R-278).
- **CON-028 (proposed):** interface do builder `buildPatientContext({ medicines, protocols, logs,
  stockSummary, stats, doseInstances, treatmentPlans }) → string`.
- Sugerido rodar `/devflow eng-review 015` (RC3 — Tier 2) antes do planning para fechar as 2
  clarifications e calibrar guard.
