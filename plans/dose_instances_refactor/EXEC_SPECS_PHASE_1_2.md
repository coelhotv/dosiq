# Exec Specs — Fases 1 & 2 (`dose_instances` refactor)

> Companion do [MASTER_PLAN_REFACTOR_DOSE_INSTANCE.md](./MASTER_PLAN_REFACTOR_DOSE_INSTANCE.md).
> Specs executáveis por sub-agents orquestrados pelo main thread.

---

## 📊 Status de execução (atualizado 2026-05-28)

| PR | Sprints | Status | Ref |
|----|---------|--------|-----|
| **PR-F1.1** tz core | S1.0, S1.1, S1.2, S1.3, S1.6 | ✅ **MERGED** | PR #597 (squash `6816ee99`) · migration aplicada em prod · ADR-049 accepted · CON-022 |
| **PR-F1.2** tz UI | S1.4, S1.5 | ✅ **MERGED** | PR #598 |
| **PR-F2.1** schema+lógica | S2.0–S2.3 | ✅ **MERGED** | PR #599 (`b7d26b3f`) · migration aplicada em prod · ADR-048 accepted · review Gemini (1 High wrap-around + 2 Medium) aplicado · AP-181 (FREQUENCY_MATCHERS stale) · 25 testes |
| PR-F2.2 motor+lifecycle | S2.4, S2.5 | ⬜ pendente | |
| PR-F2.3 âncora log | S2.6 | ⬜ pendente | |
| PR-F2.4 backfill | S2.7 | ⬜ pendente | |

**Aprendizados que afetam fases futuras:**
- Blast radius tz confirmado: **~250 callers** de `getNow`/`getSaoPauloTime`/`getTodayLocal` seguem em **default SP**. A capacidade tz existe (`getUserTime`/param `tz`), mas o valor real só aparece quando consumidores **injetam** o tz do usuário. → ver **Gap G1** abaixo.
- `getStartOfDayISO` migrado de `toLocaleString` para `getUserTime` (Hermes-safe) via review Gemini — padrão a seguir em qualquer extração de hora local.
- Mobile reusa `FormSelect` (Modal+FlatList Android-safe) e `profileService.updateTimezone` (enum BR). Web persiste via `useSettingsState` (god-hook — já com warnings max-lines/complexity, candidato a refactor isolado futuro).
- Edge multi-tz: device tz estrangeiro **não** é persistido (guard `TIMEZONES_BR.includes`) — usuário viajando mantém fuso BR salvo.

## ⚠️ Gaps identificados (endereçados aqui)

**G1 — Plumbing de injeção de tz (cross-cutting, entra na Fase 3).**
Fase 1 deixou o core tz-capable, mas ninguém injeta `user_settings.timezone` ainda. Para o benefício multi-fuso materializar de ponta-a-ponta, é preciso um acessor consistente do tz do usuário:
- **Web/Mobile:** hook/contexto `useUserTimezone()` (lê `user_settings.timezone` 1x, memoiza) que dashboards/adesão passam a `getNow(tz)`/`getTodayLocal(tz)`.
- **Server (motor Fase 2 / bot):** o motor de geração e o `server/bot` leem `user_settings.timezone` por usuário ao gerar `scheduled_for` / computar lembretes.
- **Sequenciamento:** enquanto não migrado, tudo opera em SP (default) — **consistente** (99% dos usuários são SP). Risco só aparece se a Fase 2 gerar `scheduled_for` com tz real do usuário enquanto o dashboard lê em SP → **mismatch**. **Regra:** Fase 2 motor e Fase 4 UI DEVEM injetar o mesmo tz; não misturar (ver G2).

**G2 — Consistência tz entre geração (F2) e leitura (F4).**
`scheduled_for` gerado no tz do usuário (F2) precisa ser lido/renderizado no mesmo tz (F4). A timeline cross-dia (F4) já planeja ordenar por `scheduled_for` absoluto — alinhado. Adicionar à DoD de S2.2/S2.4: documentar explicitamente em qual tz `scheduled_for` é gravado (instante absoluto UTC; o tz só governa o wall-clock de origem). Como é `timestamptz` (UTC absoluto), leitura é tz-agnóstica para ordenação — o tz só importa na geração e na exibição de "que horas são". Risco G1 mitigado por usar instante absoluto.

**G3 — `quando_necessario` no DB usa acento (`quando_necessário`).**
A migration `dose_instances` (S2.1) e o gerador (S2.2) devem casar com o CHECK real do DB: `frequency IN ('diário','dias_alternados','semanal','personalizado','quando_necessário')` — **com acentos** (confirmado via list_tables na F1.1). O gerador pula `quando_necessário` (PRN). Atualizar S2.2 para usar a string acentuada exata. ✅ Resolvido em PR-F2.1.

**G4 — Recorrência stale (AP-181, descoberto em PR-F2.1).**
`FREQUENCY_MATCHERS` (em `adherenceLogic.isProtocolActiveOnDate`) está desatualizado vs o CHECK do DB: falta `dias_alternados` (cai no default → vira diário) e mapeia `personalizado` → `false` (nunca ativo). **Latente** (0 protocolos em prod usam essas frequências — 26 diário, 1 semanal, 1 PRN). O gerador reusa a função as-is → consistente com a adesão atual. **Fix na Fase 3** (muda comportamento de adesão = fora do zero-behavior-change da Fase 2). Ver `AP-181`.

## 🩺 Future-proofing diabetes (ADR-050) — afeta Fases 2-4

O refactor já constrói o esqueleto planned/applied que insulina exige. 4 decisões baratas deixam a arquitetura preparada **sem construir diabetes aqui**. Detalhe em [ADR-050](../../.agent/memory/decisions/data_and_schema/ADR-050.md) e §11 do MASTER_PLAN.

- **FP-1 (planned↔applied)** — toca **S2.6**: ao popular `dose_instance_id`, `quantity_taken` é a dose *aplicada* (pode divergir de `expected_dose`); o link `status='taken'` não exige `aplicada == planejada`. Não introduzir validação que force igualdade.
- **FP-4 (unidade)** — toca **S2.6**: preservar o fluxo de estoque atual (pill-cêntrico) **sem** cravar novas suposições que dificultem o caminho UI/volume futuro. Decremento continua na unidade do medicamento.
- **FP-2 (tolerância por instância)** e **FP-3 (timeline event-agnóstica)** — entram nas Fases 3 e 4 (fora do escopo deste spec); registrados no MASTER_PLAN §8/§11 para não serem esquecidos no planning dessas fases.

---

## Modelo de orquestração

**Main thread (eu) orquestra. Sub-agents executam. Quality gate é meu.**

Regras invioláveis (memória do projeto):
- Sub-agent **NUNCA** commita na main — sempre branch + PR + aprovação humana (R-060, `feedback_subagents_never_commit_main`).
- **`rtk lint` antes de TODO commit** — bloqueante. Não introduz regressão nem quebra CI remoto (`feedback_lint_before_commit`).
- 1 branch por **PR** (não por sprint) — ver agrupamento abaixo. Naming: `feature/wave-X/dose-instances-f{N}-{slug}`.

**Touchpoints cavecrew:**
- `cavecrew-investigator` — preflight de cada sprint que toca código existente (mapeia call sites). Output comprimido.
- `cavecrew-builder` — **só tarefas ≤2 arquivos, escopo óbvio** (migration SQL, campo Zod, constante). Recusa 3+.
- ~~`cavecrew-reviewer`~~ — **removido do gate** (decisão 2026-05-28): revisor oficial é `@gemini-code-assist` no PR (GitHub, budget de tokens separado). G1 = lint + testes; revisão de código fica no Gemini. Gates ficam com o humano no formato SQP. Evita gasto duplicado de tokens Claude.
- Tarefas multi-arquivo / novo módulo / lógica crítica → agente `claude` (general-purpose) com `model` override (builder retornaria `too-big`).

**Heurística de modelo:**
| Modelo | Quando |
|--------|--------|
| **haiku** | Mecânico, 1 arquivo, spec fechada (add coluna SQL, add campo Zod, constante) |
| **sonnet** | Feature padrão, novo módulo com spec clara, testes, wiring |
| **opus** | Correção crítica, cross-cutting, lógica sutil (refactor tz multi-callsite, motor de geração, wipe, snap, recorrência) |

**Sequência geral:** Fase 1 inteira (merge) → Fase 2. Dentro da fase, sprints respeitam `deps`.

---

## Gates de qualidade — 3 níveis (não tudo no fim)

| Nível | Quando | Checks | Bloqueia |
|-------|--------|--------|----------|
| **G1 — por sprint** | ao fim de cada sprint, antes de empilhar o próximo | `rtk lint` + testes-alvo do sprint (`npm run test:changed`) → corrijo 🔴/🟡 | empilhar próximo sprint |
| **G2 — por PR** | antes de abrir cada PR | SQP (R-221): classificação de impacto/SemVer + version bump + CHANGELOG + `rtk lint` + `rtk npm run validate:agent` + **Hard Stop p/ validação humana** + PO smoke se UI | abrir PR |
| **G3 — pós-merge** | após humano mergear | C5 (registrar ADR/R/AP) + `/devflow distill` se journal≥15 | encerrar fase |

**Lint roda em G1 e G2** — nunca commito sem `rtk lint` verde (evita regressão e quebra de CI remoto). G1 pega cedo; G2 confirma o conjunto.

## Agrupamento de PRs

Sprint ≠ PR. Consolido por entregável coeso e testável:

| PR | Sprints | Racional | Branch slug |
|----|---------|----------|-------------|
| **PR-F1.1** tz foundation | S1.0 + S1.1 + S1.2 + S1.3 + S1.6 | migration+schema+core+testes = a capacidade tz completa; dateUtils sem schema/migration é inútil | `f1-tz-core` |
| **PR-F1.2** tz UI | S1.4 + S1.5 | camada UI web+mobile; depende de F1.1 mergeada | `f1-tz-ui` |
| **PR-F2.1** schema+lógica | S2.0 + S2.1 + S2.2 + S2.3 (+ testes unit) | dados+gerador+repo; **sem mudança de comportamento** (nada chama ainda) — merge seguro | `f2-schema-engine` |
| **PR-F2.2** motor+lifecycle | S2.4 + S2.5 (+ testes) | geração passa a rodar de fato | `f2-motor` |
| **PR-F2.3** âncora de log | S2.6 (+ testes) | wiring que muda comportamento de escrita | `f2-log-anchor` |
| **PR-F2.4** backfill | S2.7 | script one-shot isolado; roda manual pós-merge | `f2-backfill` |

Testes (S1.6/S2.8) **viajam dentro do PR do código que cobrem** — não viram PR separado.

## Migrations — quem, quando, ordem

- **Autoria:** sub-agent escreve o `.sql` em `docs/migrations/` dentro do PR (revisado normalmente).
- **Aplicação:** **humano operador aplica** (via MCP `apply_migration` ou dashboard Supabase) — **nunca** sub-agent, nunca auto-aplicada.
- **Ordem crítica:** migration aplicada **antes** do merge do código que lê as colunas novas. Sequência por PR:
  1. PR revisado e aprovado.
  2. Humano aplica migration num **branch/preview Supabase** (MCP `create_branch`) → valida.
  3. Aplica em prod.
  4. **Só então** mergeia o código do PR.
- Migrations envolvidas: **PR-F1.1** (`timezone` em user_settings) e **PR-F2.1** (`dose_instances`, `dose_adherence_monthly`, alters em `medicine_logs`/`protocols`). As demais PRs não têm DDL.
- Default das colunas preserva comportamento → migration pode preceder o código sem quebrar o que está em prod.

---

# FASE 1 — Timezone (fundação)

**Objetivo:** `user_settings.timezone` + `dateUtils` tz-aware (substitui hardcode `America/Sao_Paulo`) + revalidação no app launch. O *trigger de regen* na troca de tz fica stubado aqui (depende de `dose_instances` da Fase 2) — Fase 1 só persiste tz e detecta mudança.

**Pré-flight global:** mapear superfície do hardcode.

### S1.0 — Preflight (investigator)
- **Agent:** `cavecrew-investigator` · **Model:** default
- **Prompt:** "Liste todos os call sites de `getSaoPauloTime`, `getNow`, e literais `'America/Sao_Paulo'` em packages/core, apps/web/src, apps/mobile/src, server/bot. Para cada: path:line e símbolo chamador. Separe definição de uso."
- **Saída esperada:** tabela path:line. Alimenta S1.3.

### S1.1 — Migration: coluna timezone
- **Agent:** `cavecrew-builder` · **Model:** haiku
- **Files:** `docs/migrations/0XX_add_timezone_to_user_settings.sql` (novo)
- **Spec:** `ALTER TABLE user_settings ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo';`. Sem grants novos (tabela já existe). Seguir convenção de nome dos arquivos em `docs/migrations/`.
- **Aceite:** SQL válido, default preserva comportamento atual.
- **Deps:** —

### S1.2 — Schema: campo timezone
- **Agent:** `cavecrew-builder` · **Model:** haiku
- **Files:** `packages/core/src/schemas/userSettingsSchema.js`
- **Spec:** adicionar `timezone: z.string().default('America/Sao_Paulo')` (validar formato IANA básico via regex `Continent/City` ou lista BR: `America/Sao_Paulo`, `America/Manaus`, `America/Belem`, `America/Rio_Branco`, `America/Fortaleza`, `America/Recife`, `America/Bahia`, `America/Cuiaba`, `America/Campo_Grande`, `America/Boa_Vista`, `America/Porto_Velho`, `America/Maceio`). Enum BR-only é mais seguro que regex livre.
- **Aceite:** `.nullable().optional()` se aplicável ao padrão do schema; default não quebra parse existente.
- **Deps:** —

### S1.3 — Core: dateUtils tz-aware ⚠️ crítico
- **Agent:** `claude` (general) · **Model:** **opus**
- **Files:** `packages/core/src/utils/dateUtils.js` + propagação aos callers mapeados em S1.0 (pode exceder 2 arquivos → não-builder)
- **Spec:**
  - `getSaoPauloTime(date)` → `getUserTime(date, tz)` com tz parametrizado; manter wrapper retrocompatível `getSaoPauloTime` que usa default `'America/Sao_Paulo'` até callers migrarem.
  - `getNow(tz)`, `getTodayLocal(tz)`, `getYesterdayLocal(tz)`, `getStartOfDayISO(dateStr, tz)`, `getEndOfDayISO(dateStr, tz)` passam a aceitar tz.
  - tz vem de `user_settings.timezone` (caller injeta — core não lê DB).
  - **NÃO** quebrar `parseLocalDate`/`formatLocalDate` (já local-machine-agnostic).
- **Aceite:** suite `dateUtils` existente passa; novos testes (S1.6) cobrem 2+ fusos; `rtk npm run test:critical` verde.
- **Deps:** S1.0
- **Nota:** correção mais delicada da fase — double-shift em ambiente UTK/CI (ver AP-005/R-020). Reviewer obrigatório.

### S1.4 — Settings UI web: seletor de timezone
- **Agent:** `claude` · **Model:** sonnet
- **Files:** componente de settings (redesign) + service wiring (≤2-3 arquivos)
- **Spec:** dropdown de fuso BR no settings, persiste `timezone` via settings service. Default = detectado do device (`Intl.DateTimeFormat().resolvedOptions().timeZone`) se não setado.
- **Aceite:** persiste e relê; UI em português.
- **Deps:** S1.1, S1.2

### S1.5 — Mobile: revalidação tz no launch
- **Agent:** `claude` · **Model:** sonnet
- **Files:** bootstrap do app mobile + settings service mobile (≤2-3)
- **Spec:** no launch, lê tz do device, compara com setting. Diferente → atualiza setting. **Hook de regen fica stubado** com TODO apontando Fase 2 (S2.5). Seletor manual no settings mobile (espelha S1.4).
- **Aceite:** detecta troca de fuso; persiste; stub documentado.
- **Deps:** S1.1, S1.2

### S1.6 — Testes dateUtils tz-aware
- **Agent:** `claude` · **Model:** sonnet
- **Files:** `packages/core/src/utils/__tests__/dateUtils.*.test.js`
- **Spec:** casos multi-fuso (SP vs Manaus), cruzamento de meia-noite, midnight boundary em `getStartOfDayISO`. Arquivo ≤300 linhas, `afterEach` cleanup.
- **Aceite:** verde isolado e em `validate:agent`.
- **Deps:** S1.3

**Gates Fase 1:** G1 por sprint (lint + test:changed + reviewer do diff). G2 ao fechar **PR-F1.1** (S1.0-S1.3+S1.6) e **PR-F1.2** (S1.4+S1.5). Migration tz aplicada por humano antes do merge de F1.1.

**Ordem Fase 1:** S1.0 ✅ → (S1.1 ✅ ∥ S1.2 ✅) → S1.3 ✅ → **[G2 → PR-F1.1 ✅ MERGED #597]** → (S1.4 ✅ ∥ S1.5 ✅) [S1.6 ✅ em F1.1] → **[G2 → PR-F1.2 🔄 smoke PO]** → G3
> Migration tz aplicada em prod (2026-05-28). S1.4/S1.5 código verde, aguardando smoke antes do commit.

---

# FASE 2 — Tabela `dose_instances` + motor

**Objetivo:** materializar ocorrências, motor de geração no `server/bot/scheduler.js`, rede lazy, backfill, wiring de escrita de log. **Depende da Fase 1 mergeada** (tz fresco antes de gerar `scheduled_for`).

### S2.0 — Preflight (investigator)
- **Agent:** `cavecrew-investigator` · **Model:** default
- **Prompt:** "Mapeie: (1) toda escrita em `medicine_logs` (insert) em apps/web, apps/mobile, server/bot; (2) `protocolService` create/update/delete/pause em web e mobile; (3) onde `scheduler.js`/`tasks.js` registram crons. path:line + símbolo."
- **Deps:** —

### S2.1 — Migration: tabelas + colunas + grants/RLS ⚠️
- **Agent:** `claude` · **Model:** sonnet
- **Files:** `docs/migrations/0XX_create_dose_instances.sql` (+ possível 2º arquivo p/ rollup)
- **Spec:** conforme §3 do MASTER_PLAN:
  - `CREATE TABLE dose_instances` (com `tolerance_minutes int NOT NULL DEFAULT 120`, `UNIQUE(protocol_id, scheduled_for)`).
  - `CREATE TABLE dose_adherence_monthly`.
  - `ALTER medicine_logs ADD dose_instance_id uuid`.
  - `ALTER protocols ADD generated_through timestamptz`, `ADD paused_at timestamptz`.
  - Índices: `(user_id, scheduled_for)`, `(protocol_id, status)`.
  - **Grants obrigatórios** (CLAUDE.md): `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated, service_role` + `ENABLE ROW LEVEL SECURITY` + policy `user_id = auth.uid()`. Idem rollup.
- **Aceite:** grants + RLS presentes (checklist CLAUDE.md); enum status documentado em comentário.
- **Deps:** —

### S2.2 — Core: motor de geração (funções puras) ⚠️ crítico
- **Agent:** `claude` · **Model:** **opus**
- **Files:** `packages/core/src/utils/doseInstanceGenerator.js` (novo) + teste
- **Spec:**
  - `generateInstances(protocol, fromTs, toTs, tz)` → `[{ scheduled_for, expected_dose, tolerance_minutes }]`.
  - **Reusa** `isProtocolActiveOnDate` + `FREQUENCY_MATCHERS` (não reimplementa recorrência). Trata `diário/dias_alternados/semanal/personalizado(weekdays)`.
  - ⚠️ **G3:** o CHECK real do DB usa **acentos** — `frequency IN ('diário','dias_alternados','semanal','personalizado','quando_necessário')`. Casar exato (não `quando_necessario`/`diario` sem acento).
  - `quando_necessário` → retorna `[]` (PRN não gera).
  - ⚠️ **G2:** `scheduled_for` é `timestamptz` (instante absoluto UTC) — tz só governa o wall-clock de origem na geração; leitura/ordenação é tz-agnóstica. Documentar isso na DoD.
  - `tolerance_minutes = min(metade_menor_intervalo_adjacente_no_dia, 120)`; não-diário/dose-única → 120 (§6 MASTER_PLAN).
  - `scheduled_for` = instante absoluto computado no `tz` recebido.
- **Aceite:** tabela §6 reproduzida em teste; sem sobreposição de janelas entre slots adjacentes; PRN vazio; multi-fuso.
- **Deps:** S2.1 (forma do registro), Fase 1 (tz)

### S2.3 — Repository de instâncias
- **Agent:** `claude` · **Model:** sonnet
- **Files:** `apps/web/src/shared/services/api/doseInstanceService.js` (novo) — ou local compartilhável; espelhar acesso server/bot se necessário
- **Spec:**
  - `upsertMany(instances)` → `INSERT ... ON CONFLICT (protocol_id, scheduled_for) DO NOTHING` (idempotente).
  - `wipeFuturePending(protocolId)` → `DELETE WHERE protocol_id=$ AND status='pending' AND scheduled_for > now()`.
  - `getWindow(userId, fromTs, toTs)`, `getGeneratedThrough(protocolId)`, `setGeneratedThrough(protocolId, ts)`.
  - `markSkippedPaused(protocolId, untilTs)`.
- **Aceite:** wipe nunca toca taken/missed/passado (teste explícito); upsert idempotente.
- **Deps:** S2.1

### S2.4 — Motor no scheduler + rede lazy ⚠️ crítico
- **Agent:** `claude` · **Model:** **opus**
- **Files:** `server/bot/tasks.js` (+ registro em `server/bot/scheduler.js`) + helper de geração compartilhado
- **Spec:**
  - Cron diário `generateDoseInstances`: varre protocolos ativos cujo `generated_through` se aproxima do fim → renova janela 30d via `upsertMany`; atualiza `generated_through`. **Não** regera 30d pra todos.
  - Detecta `paused_at > 1 dia` → `wipeFuturePending`.
  - **Rede lazy:** helper `ensureInstancesUpTo(protocolId, ts, tz)` reusável por leituras críticas (dashboard, scheduler de notificação) — se `generated_through < ts`, gera o gap.
  - Registrar cron via `scheduleTask` (padrão existente).
- **Aceite:** cron idempotente (roda 2x = mesmo estado); gap-fill funciona com cron desligado; protocolo com `end_date` não passa do fim.
- **Deps:** S2.2, S2.3

### S2.5 — Lifecycle hooks de protocolo
- **Agent:** `claude` · **Model:** sonnet
- ⚠️ **P1 finding (verificar antes):** o write-path de protocolo pode estar no **factory `createProtocolRepository` (`@dosiq/core/repositories/`)** (ADR-045/R-231), não em `protocolService.js` de feature. C1 da S2.5 DEVE localizar o caminho canônico de create/update/delete/pause (grep `from('protocols')` + `createProtocolRepository`) antes de editar — pode ser 1 ponto no core (compartilhado web+mobile) em vez de 2 espelhados.
- **Files:** ponto(s) de escrita de protocolo (a confirmar: core repository factory OU `protocolService` web+mobile)
- **Spec:**
  - create c/ `end_date` → gera tudo até fim; contínuo → até `now+30d` + set `generated_through`.
  - update (time_schedule/dosage/frequency) → `wipeFuturePending` + regenera.
  - pause (`active=false`) → grava `paused_at` + `markSkippedPaused` próximas 24h. **Toggle não faz trabalho pesado** (cron limpa resto após 1d).
  - resume → limpa `paused_at`; rede lazy regenera JIT.
  - **Conecta o stub de regen-on-tz-change** de S1.5.
- **Aceite:** toggle rápido (pausa <1d + religa) não perde instâncias; pausa não vira `missed`.
- **Deps:** S2.3, S2.4

### S2.6 — Wiring de escrita de log (âncora) ⚠️ crítico
- **Agent:** `claude` · **Model:** **opus**
- **Files:** `apps/web/src/shared/services/api/logService.js`, `server/bot/callbacks/doseActions.js`, LogForm web, FAB web (multi-superfície — splitável em 2 sub-tarefas se reviewer pedir)
- **Spec:**
  - `logService.create` popula `dose_instance_id`: recebe o id da instância do botão `<Tomar>` (chave oculta), ou faz **snap** (casa `taken_at` ao slot na janela). Fora da janela → `dose_instance_id = null` (avulsa).
  - Ao linkar, marca instância `status='taken'` + `medicine_log_id`.
  - Bot `doseActions.js`: mesma âncora via `getServerTimestamp()`.
  - FAB web (data/hora flexível): snap em runtime → null se fora.
  - Preserva fluxo de estoque (decremento pós-log) e rollback existente.
- **Aceite:** `<Tomar>` da dose de ontem 22:30 às 00:05 ancora na instância de ontem (não cria slot de hoje); avulsa = null; estoque intacto.
- **Deps:** S2.3
- **Nota:** AP do `res.json()`/Vercel não se aplica (não é serverless), mas validar Zod antes do insert.
- **Future-proofing (ADR-050):** **FP-1** — `quantity_taken` é a dose *aplicada* e pode divergir de `expected_dose`; o link `status='taken'` não deve exigir igualdade (habilita bolus variável futuro). **FP-4** — manter o decremento de estoque na unidade do medicamento, sem cravar suposições novas que dificultem o caminho UI/volume.

### S2.7 — Backfill one-shot
- **Agent:** `claude` · **Model:** sonnet
- **Files:** `scripts/backfill_dose_instances.mjs` (novo, fora do bundle)
- **Spec:** gera instâncias passadas dos protocolos ativos/pausados/finalizados (via S2.2) + casa logs existentes por ±tolerância → `taken`/`missed`; log órfão sem schedule → round-down (21:58→21:00) com `dose_instance_id=null`. Idempotente (rerun seguro via upsert). Escopo: só o usuário-histórico.
- **Aceite:** dry-run reporta contagem antes de escrever; rerun não duplica.
- **Deps:** S2.2, S2.3

### S2.8 — Testes Fase 2
- **Agent:** `claude` · **Model:** sonnet
- **Files:** testes de `doseInstanceGenerator`, `doseInstanceService` (wipe/upsert), lifecycle hooks
- **Spec:** cobre wipe cirúrgico, idempotência, PRN, pausa neutra, snap cross-meia-noite. ≤300 linhas/arquivo, cleanup obrigatório, sem paralelismo vitest (`feedback_no_parallel_vitest`).
- **Aceite:** `rtk npm run validate:agent` verde.
- **Deps:** S2.2, S2.3, S2.5, S2.6

**Gates Fase 2:** G1 por sprint. G2 ao fechar **PR-F2.1** (S2.0-S2.3), **PR-F2.2** (S2.4+S2.5), **PR-F2.3** (S2.6), **PR-F2.4** (S2.7). Migration `dose_instances` aplicada por humano (preview→prod) antes do merge de F2.1. G3 pós-merge final: C5 (ADR-048, R-NNN do motor, AP se surgir) → `/devflow distill` se journal≥15.

**Ordem Fase 2:** S2.0 → S2.1 → S2.2 → S2.3 → **[G2 → PR-F2.1 → merge]** → S2.4 → S2.5 → **[G2 → PR-F2.2 → merge]** → S2.6 → **[G2 → PR-F2.3 → merge]** → S2.7 → **[PR-F2.4 → merge → roda backfill]** → G3
> S2.8 testes distribuídos dentro de F2.1/F2.2/F2.3 conforme cobertura.

---

## Mapa de modelos (resumo)

| Sprint | Agent | Modelo | Por quê |
|--------|-------|--------|---------|
| S1.0 / S2.0 | investigator | default | locate comprimido |
| S1.1, S1.2 | builder | haiku | 1 arquivo mecânico |
| S1.3 | claude | **opus** | tz cross-callsite, double-shift sutil |
| S1.4, S1.5, S1.6 | claude | sonnet | UI/wiring/testes |
| S2.1 | claude | sonnet | SQL + grants/RLS (cuidado) |
| S2.2 | claude | **opus** | recorrência + tolerância, correção |
| S2.3 | claude | sonnet | repo CRUD/upsert/wipe |
| S2.4 | claude | **opus** | motor + rede lazy, idempotência |
| S2.5 | claude | sonnet | hooks espelhados web/mobile |
| S2.6 | claude | **opus** | âncora/snap multi-superfície |
| S2.7 | claude | sonnet | script backfill |
| S2.8 | claude | sonnet | testes |
| S1.R / S2.R | reviewer | default | audit diff |

## Loop operacional (resumo dos 3 gates)
- **G1 (cada sprint):** agent edita na branch → `rtk lint` → `npm run test:changed` → `cavecrew-reviewer` no diff do sprint → corrijo → empilho próximo.
- **G2 (cada PR):** `rtk lint` → `rtk npm run validate:agent` → `cavecrew-reviewer` no agregado → PO smoke se UI (`feedback_po_smoke_before_pr`, `feedback_dev_validate_before_commit`) → migration aplicada por humano se houver DDL → PR → Gemini review → aplico → **humano merge** (R-060).
- **G3 (pós-merge fase):** C5 (ADR/R/AP) → `/devflow distill` se journal≥15.
- **Commit:** `rtk lint` verde é pré-requisito de todo commit.
