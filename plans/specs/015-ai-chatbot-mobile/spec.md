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
3. **Mobile sem chat — zero hoje.** O app nativo **não tem nada** do chatbot (gap 🔴 total no
   MASTER_PLAN). Não é "port de UI": é implementação **end-to-end na superfície mobile** — tela,
   `chatbotService` nativo, persistência AsyncStorage, wiring de contexto via core e chamada ao
   serverless. O único reuso é o `api/chatbot.js` (Groq/Vercel, já em prod) e o builder do core
   (criado na Onda 1). Tudo o mais é novo no mobile.

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

### User Story 3 — Chat nativo no mobile, end-to-end (Priority: P1)
**Why**: fecha o gap de paridade (MASTER_PLAN); o chat **não existe no mobile hoje** — esta onda o
constrói inteiro nessa superfície (UI + service + histórico + wiring), herdando o contexto melhorado
de graça por consumir o core.
**Independent Test**: abrir o chat no app nativo (tela inexistente hoje), perguntar "qual meu próximo
remédio?"; o app monta o contexto via core (fuso GMT-3), envia ao `api/chatbot.js` e renderiza a
resposta em markdown.

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
  (server) numa única **função pura, agnóstica de runtime**. Entrada: dados já buscados/normalizados
  (medicines, protocols, logs, stockSummary, stats, doseInstances, **treatmentPlans**). O builder NÃO
  busca dados nem conhece browser/app/server — quem busca é o runtime e injeta. (Por isso a dicotomia
  "client vs server" não se aplica ao builder: ela é só sobre ONDE o runtime roda o fetch.)
- **FR-002 (contexto):** Agrupar medicamentos por `treatment_plans.name`; protocolos sem plano →
  grupo "Sem plano". Manter os demais blocos (alertas de estoque, doses pendentes/atrasadas).
- **FR-003 (web G3):** `chatbotService.js` (web) passa a importar o builder do core; `contextBuilder.js`
  local removido; passar `treatmentPlans` no fetch.
- **FR-004 (server G3):** `chatbotServerService.js` (Telegram) passa a usar o builder do core;
  `buildServerContext` local removido (mantém só o fetch server-side dos dados); passar planos.
- **FR-005 (mobile G1 — greenfield e2e):** Implementar a superfície de chat inteira no mobile (não
  existe hoje): tela nativa (`FlatList` invertido, `TextInput`, chips "digitando") + `chatbotService`
  mobile (monta contexto via core, chama `api/chatbot.js`) + wiring de navegação/entry-point. Reusa
  apenas `api/chatbot.js` (prod) e o builder do core.
- **FR-006 (mobile):** Render markdown nativo com paridade ao web #681 (negrito, listas `-`/`*`/`+`,
  itálico, quebras) + disclaimer clínico obrigatório.
- **FR-007 (mobile):** Histórico local em AsyncStorage, teto `CHATBOT_MAX_HISTORY` (20).
- **FR-008 (segurança):** `safetyGuard` + systemPrompt permanecem **server-side** (AP-237); o cliente
  só envia `patientContext`. Centralizar o contexto NÃO move guardrails para o cliente.
- **FR-009 (contrato):** Registrar **CON-028** (interface do builder do core) e **ADR-074**
  (centralização web↔server↔mobile). **CON-028 define o input COMPLETO** (reconciliado pela RC3 — F1):
  `{ medicines, protocols, logs, stockSummary, stats, doseInstances, treatmentPlans }`. Hoje Telegram
  passa só 5 (sem `doseInstances`) e ninguém passa `treatmentPlans` — cada superfície passa a suprir o
  conjunto completo (é onde a divergência real mora).
- **FR-010 (consistência cross-surface — chave; reescrita pela RC3/F2):** Garantir que as 3 superfícies
  enviem o **mesmo contexto** para o mesmo usuário. Centralizar o builder é necessário mas
  **insuficiente** — a divergência mora a montante (no input). **Duas camadas obrigatórias** (a 3ª
  — "inputs via core repos" — foi DESCOPADA pela RC3: nenhuma superfície usa repos hoje; forçar é
  blast radius grande e desnecessário p/ paridade. Vira nice-to-have futuro, não requisito):
  1. **Builder dono de TODA derivação** (puro, core): runtime injeta só entidades **cruas**; o core
     faz filtro de ativos (R-278/`isProtocolActiveOnDate`), dias-restantes, agrupamento por plano,
     ordenação (reusa `splitDayTimeline`/`formatDoseItem` já no core). Mínima lógica no runtime.
  2. **Input tipado + validado por Zod (CON-028):** runtime que injeta dado faltando/errado **falha
     alto**, nunca gera contexto silenciosamente divergente. O input completo da FR-009 é o contrato.
- **FR-011 (guard de paridade):** Teste de paridade cross-surface — fixture de paciente "golden" →
  asserta que os caminhos web, mobile e Telegram produzem a **string de contexto idêntica**. É o
  trava-drift permanente da FR-010.

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
- **SC-007 (paridade — chave):** Para um mesmo usuário/fixture, as 3 superfícies produzem **string de
  contexto idêntica** (teste de paridade FR-011 verde). Divergência = falha de release.

```po PO-5
ac:     web, mobile e Telegram produzem string de contexto idêntica p/ a mesma fixture de paciente
proof:  npm run test --workspace @dosiq/core -- chatbotContext.parity
expect: teste de paridade cross-surface verde (golden fixture → 3 caminhos → mesma string)
guard:  full — builder dono da derivação (runtime injeta cru); input completo CON-028 Zod-validado nas 3 superfícies
status: [ ] open
```

---

## Assumptions / Open Questions

- **[ASSUMPTION] Onde cada runtime monta o contexto** (o builder é o mesmo do core nos 3 — só muda
  ONDE roda o fetch+injeção):
  - **Web/PWA:** no browser (client) — dados já carregados → injeta no builder → POST `api/chatbot.js`.
  - **Mobile:** no app nativo (client) — espelha o web; busca dados no device → injeta → POST
    `api/chatbot.js`. **NÃO** cria builder server-side novo.
  - **Telegram:** **não tem client — o bot server É o runtime**; já busca os dados server-side e
    chamará o builder do core ali mesmo. (Foi a imprecisão da versão anterior: falar em "client" do
    Telegram não faz sentido — o server é o runtime.)
  - **Invariante:** nenhuma superfície cria um 2º builder; todas chamam a função pura do core. A
    construção do systemPrompt + safetyGuard continua server-side (AP-237), independente disso.
- **[ASSUMPTION]** `treatment_plans` já expõe `name` consultável por `treatment_plan_id` via
  `treatmentPlanService`; o fetch de cada superfície passa a incluí-lo (additivo, sem migração DB).
- **[NEEDS CLARIFICATION — CHAVE: onde montar o contexto]** Decide os processos seguintes do DEVFLOW:
  - **(A) Client-build (atual, recomendado):** cada runtime monta+envia o contexto. Menor latência
    (web reusa dados já carregados; sem refetch). Consistência garantida pelas 3 camadas da FR-010 +
    teste de paridade FR-011. Divergência fica estruturalmente difícil, não impossível.
  - **(B) Server-build:** client envia só `userId`; `api/chatbot.js` monta o contexto via core (1
    fetch único p/ web+mobile). Consistência **máxima por construção** (web+mobile idênticos), mas
    adiciona round-trip/refetch ao Supabase e muda mais a web (que hoje monta client-side).
  - Recomendação: **(A)**. Trade-off latência×consistência — **RC3 bate o martelo**. A escolha muda
    radicalmente o plano (B move lógica de fetch p/ o serverless; A reforça repos+paridade nos clients).
- **[NEEDS CLARIFICATION]** Localização canônica no core: `packages/core/src/chatbot/` (novo módulo)
  vs `packages/core/src/utils/` — resolver no eng-review/planning (afeta CON-028 e o index do core).
- **[NEEDS CLARIFICATION]** O builder do core deve receber dados **já buscados** (puro, sem Supabase)
  ou um adapter de fetch? Preferência: **puro** — cada runtime (browser, app, bot server) busca no
  seu ambiente e injeta os dados, igual hoje; o core fica sem dependência de plataforma (alinha
  ADR-045/repos). Confirmar no planning.

---

## Ceremony / ADR

- **ADR-074 (proposed):** Centralizar o builder de contexto do chatbot em `@dosiq/core` (fonte única
  web↔Telegram↔mobile), builder **puro** (recebe dados, não busca). Mata o fork e o drift (R-278).
- **CON-028 (proposed):** interface do builder `buildPatientContext({ medicines, protocols, logs,
  stockSummary, stats, doseInstances, treatmentPlans }) → string`.
- Sugerido rodar `/devflow eng-review 015` (RC3 — Tier 2) antes do planning para fechar as 2
  clarifications e calibrar guard.

---

## Ceremony: eng-review (RC3) — 2026-06-23

### Reality check (código real, não a narrativa)
| Superfície | Como obtém inputs | Campos passados ao builder | Usa core repos? |
|---|---|---|---|
| Web | `DashboardContext` (já no browser) → `ChatWindow.jsx:83` | `{medicines, protocols, logs, stockSummary, stats, doseInstances}` (6) | ❌ (DashboardContext) |
| Telegram | fetch próprio com selects à mão (`chatbotServerService.js:138-153`) | `{medicines, protocols, logs, stockSummary, stats}` (5 — **sem doseInstances**) | ❌ (selects manuais) |
| Mobile | inexistente (tem `dashboardService.js`/`useProtocols` como fonte potencial) | — (greenfield) | ❌ |

**Conclusão:** a divergência cross-surface **já existe hoje** e mora **no input**, não no builder.
Web manda 6 campos, Telegram manda 5 (sem `doseInstances` → Telegram não tem seção de doses
pendentes/atrasadas). Nenhum carrega `treatment_plans`. `splitDayTimeline`/`isProtocolActiveOnDate`
(a derivação) **já vivem em `@dosiq/core`** — o builder centralizado só os chama.

### Findings

- **F1 (HIGH) — o input é o eixo da consistência, não o builder.** Centralizar a função (US2) é
  limpo e necessário, mas SC-007 (paridade) só fecha se as 3 superfícies passarem o **mesmo conjunto
  cru**. Hoje Telegram não passa `doseInstances`; ninguém passa `treatmentPlans`. **CON-028 deve
  definir o input completo** = `{medicines, protocols, logs, stockSummary, stats, doseInstances,
  treatmentPlans}` e cada superfície passa a supri-lo (Telegram ganha `doseInstances` + planos).
  Esse é o verdadeiro lift da Onda 1.

- **F2 (HIGH) — descope FR-010 camada 2 ("inputs via core repos").** Nenhuma superfície usa core
  repos hoje (web=DashboardContext é a espinha de dados; server=selects à mão; mobile=dashboardService).
  Forçar as 3 para `createXRepository` é **blast radius grande** (mexe na espinha de dados da web) e
  **desnecessário para paridade**. Minimum change set (RC3 §0): a garantia de consistência vem do
  **builder ser dono de TODA a derivação a partir de entidades cruas** + **input Zod-validado
  (CON-028)** + **teste de paridade (FR-011)**. "Mesmo input cru → mesma saída" já basta; COMO cada
  runtime busca segue sendo problema dele, desde que entregue o conjunto cru completo. → **Reescrever
  FR-010**: cair de 3 camadas para 2 (builder-dono-da-derivação + input-Zod). Camada repos vira
  *nice-to-have futuro*, não requisito de paridade.

- **F3 (MEDIUM) — Onda 1 concentra o risco.** Onda 1 = core builder + plan-grouping + reconciliar
  input + adoção web + adoção server. É a maior. Sugiro sub-fatiar:
  - **1a:** core builder (consolida lógica atual, SEM plan-grouping ainda) + web adota + server adota,
    com input reconciliado (server passa `doseInstances`) + teste de paridade web↔server. (Refactor
    puro de paridade — Beck: "make the change easy".)
  - **1b:** plan-grouping (`treatment_plans.name`) no builder do core + as 3 superfícies passam
    `treatmentPlans` (web/server; mobile vem na Onda 2). ("Then make the easy change.")
  Nunca estrutural + comportamental no mesmo PR.

- **F4 (LOW) — leverage.** O builder no core reusa `splitDayTimeline`, `isProtocolActiveOnDate`,
  `formatDoseItem` (já exportados). Zero reimplementação de derivação.

### Clarifications resolvidas (RC3 bate o martelo — operador confirma)

1. **[onde montar o contexto — CHAVE] → (A) Client-build.** Telegram é inerentemente server (não
   tem client); web+mobile mantêm client-build (reusam dados já carregados, sem refetch). Com o
   builder dono da derivação, (A) é seguro. (B) server-build forçaria a web a abandonar o
   DashboardContext + refetch no serverless — mais mudança, zero ganho de paridade depois que o
   builder normaliza. **Decisão: (A).**
2. **[local no core] → `packages/core/src/chatbot/`** (módulo coeso: builder + grouping + constantes),
   não `utils/` (genérico). CON-028 mora aí.
3. **[puro vs adapter] → PURO.** É o padrão de-facto já (web passa dados pré-buscados; server busca e
   passa). Builder sem dependência de plataforma; cada runtime busca+injeta.

### Guard calibration
Tier 2 floor = **full** (mantido, sem override down). RC3 **eleva** o gate com o **teste de paridade
cross-surface (FR-011/PO-5) como bloqueante de release** — é o trava-drift que protege a consolidação.
Cada onda: suíte relevante verde + CON-028 honrado + paridade verde.

### Recomendação de saída
Spec sólida após reescrever FR-010 (F2) e detalhar CON-028 input completo (F1). Próximo: **planning**
(plan.md + tasks.md + analysis.md + checklists — Tier 2 full bundle), fatiando Onda 1 em 1a/1b (F3).
