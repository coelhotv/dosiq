# Spec 033 — Refactor: Mobile History Timeline (Service-First)

**Feature Directory**: `plans/specs/033-mobile-history-timeline-refactor/`
**Created**: 2026-06-15
**Status**: delivered (PR #671 mergeado 2026-06-16 — mobile 0.19.0)
**Tier**: 1
**Input**: Auditoria de divergência arquitetural — mobile usa pipeline custom em `useHistoryData.js`; core já provê `createTimelineService` + `biomarkersToEvents` + `buildTimeline` (usados pela web). Princípio "service-first, screen-second" (MASTER_PLAN D2) não foi respeitado nas specs 003/030.

---

## Contexto

### Por que essa spec existe

O `MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md` estabeleceu o princípio **"service-first, screen-second"**: a camada de serviço é a unidade de trabalho, e a mesma factory pode ser compartilhada entre plataformas via `@dosiq/core`.

O pipeline atual do mobile divergiu desse princípio nas entregas das specs 003 e 030:

```
Web (correto):
  createTimelineService (core)
    → fetch instances + logs (core)
    → doseInstancesToEvents (core)
    → biomarkersToEvents (core)
    → buildTimeline (core)
    → TimelineEvent[]

Mobile (divergente):
  getDoseInstancesForPeriod (dashboardService local)
  + fetchOrphanLogs (fn local em useHistoryData.js)
  + enrichInstancesWithProtocol (fn local em useHistoryData.js)
  + normalizeOrphanLog (fn local)
  → array custom sem shape de TimelineEvent, sem localDay
```

### Consequências diretas da divergência

1. **Bug fix no core não alcança mobile** — o fix de `isCoveredBySlot` (spec 030) foi em `packages/core/src/services/timelineService.js`, mas mobile nunca chama `doseInstancesToEvents`. O mobile contornou o problema de outra forma (IS NULL filter), mas as caminhos ficaram dessincronizados.

2. **Biomarkers não chegam ao mobile** — a web mergeia biomarkers na timeline via `biomarkersToEvents` + `buildTimeline` no seu adapter. Mobile precisaria duplicar toda essa lógica manualmente.

3. **Lógica de negócio no hook** — `enrichInstancesWithProtocol` e `normalizeOrphanLog` vivem dentro de um hook React, não num service testável.

4. **Ordenação inconsistente** — mobile ordena manualmente via `useMemo` sort; web usa `buildTimeline` (desempate estável por `id`).

### Benefício do alinhamento

Ao adotar `createTimelineService` do core, o mobile herda automaticamente:
- Deduplicação logs↔instâncias (AP-193) — já testada no core
- `localDay` derivado no fuso correto (sem `utcToLocalDateStr` custom)
- Suporte a biomarkers (`biomarkersToEvents`) — sem código novo no mobile
- Desempate determinístico no sort
- Todos os fixes futuros do core

---

## User Stories

### US1 — Desenvolvedor: Service Layer no lugar certo

**Como** desenvolvedor do mobile,
**quero** que a busca e normalização do histórico fiquem em `historyTimelineService.js` (service layer),
**para que** `useHistoryData` seja um hook fino de estado, sem lógica de fetch/transform embutida.

**Acceptance Scenarios:**

```
Dado que o serviço core já provê createTimelineService
Quando historyTimelineService.js for criado no mobile
Então ele deve ser um adapter thin que injeta o client nativo + enrichment de protocolo
  E useHistoryData.js deve chamar o service, não fazer fetch diretamente
  E enrichInstancesWithProtocol deve viver no service, não no hook
```

```
Dado que o core exporta doseInstancesToEvents, biomarkersToEvents, buildTimeline
Quando historyTimelineService mesclar os dados
Então o output deve ser TimelineEvent[] (com id, type, occurred_at, payload, localDay)
  E a forma deve ser idêntica ao que a web consome (FP-3/ADR-050)
```

### US2 — Usuário: Biomarcadores visíveis no histórico do dia

**Como** paciente com diabetes (biomarcadores de glicemia registrados),
**quero** ver minhas medidas de glicemia no histórico do dia selecionado, junto com as doses,
**para que** tenha visão integrada da minha jornada de saúde num único lugar.

**Acceptance Scenarios:**

```
Dado que tenho medidas de glicemia registradas em 09/jun
Quando selecionar 09/jun no calendário do histórico
Então as medidas devem aparecer na lista do dia, intercaladas com as doses (ordem por horário)
  E cada medida deve ter: ícone Ruler, tipo (ex: "Glicemia"), valor+unidade, horário
  E o chip de contagem "X doses" não deve contar as medidas (só doses — FP-3)
```

```
Dado que toco num card de medida na lista do dia
Quando pressionar editar
Então deve abrir o MeasureLogSheet existente (já implementado em features/measures/)
  E não deve navegar para MeasuresScreen (mantém contexto do dia selecionado)
```

```
Dado que a tela de Medidas (MeasuresScreen) existe com scatter plot
Quando eu acessar o histórico de doses
Então MeasuresScreen permanece intocada (coexistência, sem sobreposição)
```

### US3 — Desenvolvedor: KPIs de aderência isolados da stream de biomarkers

**Como** desenvolvedor,
**quero** que `kpis.adherence30d` e `kpis.streak` continuem usando só `dose_instances` (ADR-054),
**para que** biomarkers adicionados à stream não inflem nem distorçam KPIs de adesão.

**Acceptance Scenarios:**

```
Dado que tenho 5 dose_instances taken + 3 biomarkers no período
Quando kpis.dosesThisMonth for calculado
Então deve contar só doses taken (5), não biomarkers (3)
```

---

## Functional Requirements

### Camada de Service (service-first)

> **⚠️ Correções de planning (2026-06-15, reality-check vs repo — ver [analysis.md](./analysis.md)):**
> - **GAP-1:** o core `getTimeline` (CON-023) **não** mescla biomarkers — só `dose_instances`+`logs`.
>   O merge é replicado NO service mobile (best-effort), espelhando o wrapper web `getMonthTimeline`.
> - **GAP-2:** o `TimelineEvent` tem payload **camelCase aninhado** (`event.payload.scheduledFor`...),
>   mas a UI mobile lê **flat snake_case** (`instance.scheduled_for`...). O service expõe uma
>   **anti-corruption layer** (`mapToMobileShape`) que achata p/ o shape que a UI de 030 já consome —
>   logo `getHistoryTimeline` retorna itens flat, NÃO `TimelineEvent[]` cru (revisa FR-009).
> - **GAP-3:** o enricher core só dá `medicineName`+`dosageUnit`; `protocolsById` mobile é estendido
>   com `dosage_per_pill`/`dosage_per_intake`/`intake_unit`/`protocol_name` (hint líquido + dosagem).

**FR-001** — Criar `apps/mobile/src/features/history/services/historyTimelineService.js`:
  - Instancia `createTimelineService({ client: supabase })` do core (doses+logs+dedupe, CON-023)
  - Constrói `protocolsById` estendido (GAP-3) e enriquece cada evento `dose`
  - Mescla biomarkers NO service (GAP-1): `measuresRepo.list` + `biomarkersToEvents` + `buildTimeline`
    (best-effort try/catch — falha de bio não derruba doses)
  - Aplica `mapToMobileShape` (GAP-2) → itens flat snake_case + `localDay`
  - Expõe `getHistoryTimeline(userId, { pastDays, futureDays, tz })` → itens flat (dose | biomarker)

**FR-002** — `useHistoryData.js` refatorado para hook fino:
  - Remove `fetchOrphanLogs`, `normalizeOrphanLog`, `enrichInstancesWithProtocol` (movem para service)
  - Chama `historyTimelineService.getHistoryTimeline(...)` no `load()`
  - Mantém separação de estado `doseInstances` vs `measureItems` para KPIs (ADR-054)
    - `doseInstances` = eventos `type === 'dose'` do retorno
    - `measureItems` = eventos `type === 'biomarker'` do retorno
  - `instances` (para render) = todos os eventos combinados

**FR-003** — `instancesForDay` usa `localDay` do `TimelineEvent` (não mais `utcToLocalDateStr` custom):
  - Filter: `ev.localDay === selectedDay`
  - Sort: já garantido pelo `buildTimeline` (ordem ASC por `occurred_at`)

### Camada de UI (screen-second)

**FR-004** — Novo componente `BiomarkerHistoryCard.jsx` em `features/history/components/`:
  - Renderiza evento `type === 'biomarker'` na lista do dia
  - Exibe: ícone `Ruler`, tipo (via `BIOMARKER_TYPE_LABELS` do core), valor+unidade, horário
  - Botões inline: Editar (abre `MeasureLogSheet`) e Excluir (com confirmação)

**FR-005** — `DoseHistoryList.jsx` renderiza ambos os tipos:
  - `item.type === 'dose'` → layout atual (ícone de status, nome, dosagem, chip "avulsa")
  - `item.type === 'biomarker'` → `BiomarkerHistoryCard`
  - Chip de contagem continua contando só eventos `type === 'dose'`

**FR-006** — `HistoryScreen.jsx` passa callbacks de medida para `DoseHistoryList`:
  - `onEditMeasure(measure)` → abre `MeasureLogSheet`
  - `onDeleteMeasure(measure)` → confirma + chama `measuresRepo.remove`
  - `MeasureLogSheet` montado no `HistoryScreen` (análogo ao `DoseActionSheet`)

### Invariantes preservados

**FR-007** — `MeasuresScreen` permanece intocada (scatter plot coexiste sem sobreposição)

**FR-008** — KPIs de aderência continuam usando só `doseInstances` (ADR-054):
  - `adherence30d`, `streak` → filtrar `type === 'dose'` antes de calcular
  - `dosesThisMonth` → contar só eventos `type === 'dose'` com `status === 'taken'`

**FR-009** — Shape de retorno do service é `TimelineEvent[]` (FP-3/ADR-050):
  - Cada evento: `{ id, type, occurred_at, payload, localDay }`
  - `type: 'dose'` — payload compat com consumo atual de `DoseHistoryList`
  - `type: 'biomarker'` — payload compat com `BiomarkerEventCard` da web (referência)

---

## Success Criteria

**SC-001** — `validate:agent` 100% green após refactor (sem regressões nos 1336 testes).

**SC-002** — Biomarcador de glicemia registrado em data X aparece na lista do dia X no histórico mobile, intercalado com as doses por horário.

**SC-003** — Doses do dia não são duplicadas (instâncias taken + logs avulsos dedupados corretamente via core — AP-193).

**SC-004** — KPIs de aderência (`adherence30d`, `streak`, `dosesThisMonth`) não mudam ao adicionar um biomarcador (isolamento ADR-054).

**SC-005** — Editar medida a partir do card do histórico abre `MeasureLogSheet` sem navegar para `MeasuresScreen`.

**SC-006** — `MeasuresScreen` (scatter plot) permanece funcional e sem mudanças.

**SC-007** — `historyTimelineService.js` tem ao menos 80% de cobertura de testes unitários (service testável em isolamento, independente do hook — princípio D2 do master plan).

---

## Arquitetura Alvo

```
useHistoryData.js (hook fino — só estado + KPI split)
  └── historyTimelineService.js (adapter mobile)
        ├── createTimelineService (core) — fetch instances + logs + dedup
        │     ├── doseInstancesToEvents (core)
        │     └── buildTimeline (core)
        ├── enrichWithProtocol (local ao service — busca protocols)
        ├── measuresRepo.list (feature/measures)
        ├── biomarkersToEvents (core)
        └── buildTimeline (core) — merge final + re-order

DoseHistoryList.jsx
  ├── (type=dose) → layout dose atual
  └── (type=biomarker) → BiomarkerHistoryCard.jsx (novo)

HistoryScreen.jsx
  └── MeasureLogSheet (existente, montado aqui p/ edit inline)
```

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `features/history/services/historyTimelineService.js` | **NOVO** — adapter mobile |
| `features/history/services/__tests__/historyTimelineService.test.js` | **NOVO** — testes unit |
| `features/history/hooks/useHistoryData.js` | **REFACTOR** — hook fino |
| `features/history/components/DoseHistoryList.jsx` | **MOD** — branch biomarker |
| `features/history/components/BiomarkerHistoryCard.jsx` | **NOVO** — card medida |
| `features/history/screens/HistoryScreen.jsx` | **MOD** — MeasureLogSheet + callbacks |

---

## Assumptions / Open Questions

**A1** — `enrichWithProtocol` fica no service mobile (não sobe para o core), pois o web resolve o enriquecimento via `protocolsById` do dashboard context — abordagem diferente, não compatível com factory genérica ainda.

**A2** — `BIOMARKER_TYPE_LABELS` e `BIOMARKER_CONTEXT_LABELS` já estão exportados pelo core (usados no `BiomarkerEventCard` da web). Confirmar no início da implementação.

**A3** — A spec 030 (ainda em smoke) entregou `useHistoryData.js` com pipeline custom. Este refactor **substitui** esse pipeline. A spec 033 deve ser executada **após** merge da 030.

**A4** — `MeasureLogSheet` já existe em `features/measures/components/`. Confirmar que aceita prop `editItem` (edição) antes de integrar no `HistoryScreen`.

---

## Dependências

- Merge da spec 030 (`fix/w25/030-dose-history-orphan-logs`) **antes** de iniciar
- `createTimelineService`, `biomarkersToEvents`, `buildTimeline` já exportados pelo core ✅
- `measuresRepo` já instanciado no mobile (`features/measures/services/measuresRepo.js`) ✅
- `MeasureLogSheet` já existe no mobile ✅

---

## Ceremony: eng-review

**Date**: 2026-06-18
**Reviewer Role**: Engineering Manager / Tech Lead
**Overall Assessment**: APPROVED (Paridade de Lógica com Core + Arquitetura Service-First + Testes Robustos)

### 1. Scope Challenge & Complexity Analysis
- **Existing Code Leverage**: Excelente aproveitamento dos métodos e factories do `@dosiq/core` (`createTimelineService`, `biomarkersToEvents`, `buildTimeline`). Reduz a lógica customizada no mobile e delega a ordenação e a deduplicação de logs/instâncias (AP-193) para a camada compartilhada.
- **Minimum Change Set & Complexity**: Mudança extremamente contida e focada. Apenas 4 arquivos de código de negócio foram modificados/criados, bem abaixo do limite de 8 arquivos de complexidade do DEVFLOW.
- **TODOS Cross-Reference**: Nenhum impeditivo técnico ou TODO pendente no workspace.

### 2. Architecture & Data Flow
A arquitetura implementada respeita o princípio **"service-first, screen-second"** (MASTER_PLAN D2). O mapeamento de dados através do anti-corruption layer (`mapToMobileShape`) garante o isolamento entre o core e as especificidades da UI mobile.

```
+-------------------------------------------------------+
|                 HistoryScreen.jsx                     |
|  (Exibe timeline do dia e abre modal de edição/detalhe)|
+--------------------------+----------------------------+
                           |
                           v
+--------------------------+----------------------------+
|                 useHistoryData.js                     |
|  (Hook fino: estado da UI + cálculo isolado de KPIs)  |
+--------------------------+----------------------------+
                           |
                           v
+--------------------------+----------------------------+
|             historyTimelineService.js                  |
|  (Adapter Mobile: coordena timeline + bio + shape)   |
+----+---------------------+-----------------------+----+
     |                     |                       |
     v                     v                       v
+----+----+           +----+----+             +----+----+
|  Core   |           |  Core   |             |  Repo   |
|Timeline |           |BioEvents|             |Measures |
+---------+           +---------+             +---------+
```

### 3. Verification & Test Hygiene
- **Service Coherence**: Os testes unitários em `historyTimelineService.test.js` atingem cobertura de 100% de linhas e funções, abordando as falhas de rede de biomarcadores (try/catch best-effort), protocolos não mapeados (lookup miss com degradação graciosa) e fuso horário.
- **KPI Isolation**: Os testes validam com sucesso que a presença de biomarcadores não distorce os KPIs de adesão (`dosesThisMonth`, `adherence30d`, `streak`), preservando a regra de negócio ADR-054.

### 4. Findings & Scope Decisions
- **Finding #1 (Info)**: O fuso horário do usuário é adequadamente consultado nas configurações (`user_settings`) antes de construir a janela de filtragem UTC.
- **Finding #2 (Info)**: Degradação graciosa robusta: em caso de falha de rede ao carregar biomarcadores, as doses ainda renderizam corretamente (SC-003).

**Decisions**:
- Validar no smoke se os chips de dosagem líquida (022) exibem corretamente a unidade de tomada derivada.
- Manter o status como **delivered** e prosseguir sem novos bumps visto que a espec já estava entregue.

