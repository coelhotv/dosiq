# Plano — Refatoração para `dose_instances` (Schedule-Anchored Doses)

> **Status:** Em execução — **Fase 1 quase completa** (PR-F1.1 merged #597; PR-F1.2 em smoke PO).
> **Origem:** bug reportado pós-lançamento App Store — dose das 22:30 deixa de ser registrável após meia-noite.
> **Decisão arquitetural-mãe:** **ADR-048** (proposed — promover a accepted no planning da Fase 2) — tabela `dose_instances` materializada, modelo híbrido. **ADR-049** (accepted) — core tz-aware, fundação da Fase 1.
>
> **Progresso (2026-05-28):**
> - ✅ **Fase 1 / PR-F1.1** — core tz-aware (`getUserTime` + param tz default SP, non-breaking ~250 callers) · `user_settings.timezone` (migration em prod) · CON-022. Merged #597.
> - 🔄 **Fase 1 / PR-F1.2** — seletor de fuso UI web+mobile + revalidação no launch mobile. Código verde, em smoke PO.
> - ⬜ **Fase 2** — bloqueada por: promover ADR-048→accepted + planning próprio.
>
> **Gaps abertos** (detalhe em EXEC_SPECS §Gaps): **G1** plumbing de injeção de tz (Fase 3, ~250 callers em SP default até lá) · **G2** consistência tz geração↔leitura (mitigado por `timestamptz` absoluto) · **G3** frequência DB usa acento (`quando_necessário`/`diário`) — gerador deve casar exato.

---

## 1. Problema

`medicine_logs` não tem âncora de schedule. Colunas: `taken_at`, `quantity_taken`, `protocol_id`, `medicine_id`, `notes`. Todo o sistema de adesão **infere** a qual slot uma dose pertence, casando `taken_at` contra `protocol.time_schedule` via janela ±2h.

Sintoma reportado: a dose das 22:30 some do dashboard e dos botões `<Tomar>` (web + mobile + PriorityCard) por volta da meia-noite.

Causa raiz: `classifyDose` (`useDoseZones.js:100`) e `expandProtocolsToDoses` constroem a dose ancorada em `getTodayLocal()` via `setHours`, sem cruzar meia-noite. A janela ±2h só existe no calendário (`adherenceLogic.evaluateDoseTimelineState`), não no dashboard. `isDoseInToleranceWindow` e `isProtocolFollowed` também quebram cross-day.

O bug é o sintoma mais visível de um modelo de dados que reconstrói intenção a partir do efeito.

---

## 2. Decisão arquitetural

**Tabela `dose_instances`** (materializa cada ocorrência agendada como linha, exista log ou não) — escolhida sobre coluna simples em `medicine_logs` pelo upside médio/longo prazo:

- Dose perdida vira **dado real** (`status='missed'`) — adesão é query, não cálculo.
- Notificação aponta `dose_instance.id` → **idempotente** (resolve acoplamento notificação↔dose).
- Estado por-ocorrência: pausada, pulada-de-propósito, notificada.
- `expected_dose` congelado por instância = versionamento de schedule **de graça** (instância passada é o snapshot histórico — dispensa audit table de protocolo para fins de adesão).

Trade-off aceito: maior raio de impacto e necessidade de motor de geração (mitigado por high-water-mark + geração JIT).

---

## 3. Schema

```sql
CREATE TABLE dose_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  protocol_id     uuid NOT NULL,
  scheduled_for   timestamptz NOT NULL,   -- instante absoluto (depende do tz do usuário)
  expected_dose   numeric NOT NULL,       -- dosagem esperada no momento (congela schedule)
  status          text NOT NULL DEFAULT 'pending',
                  -- pending | taken | missed | skipped_paused | skipped_user
  medicine_log_id uuid,                   -- FK p/ medicine_logs quando tomada
  tolerance_minutes int NOT NULL DEFAULT 120,  -- janela dinâmica (§6), computada na geração
  notified_at     timestamptz,            -- idempotência notificação
  snoozed_until   timestamptz,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT uq_instance UNIQUE (protocol_id, scheduled_for)  -- habilita upsert idempotente
);

-- Grants obrigatórios (CLAUDE.md — pós 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_instances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_instances TO service_role;
ALTER TABLE public.dose_instances ENABLE ROW LEVEL SECURITY;
-- + policy user_id = auth.uid()

-- medicine_logs ganha o elo (nullable p/ avulsas/PRN)
ALTER TABLE medicine_logs ADD COLUMN dose_instance_id uuid;

-- Rollup mensal (cold) — construído desde a v1, podar raw depois é não-destrutivo
CREATE TABLE dose_adherence_monthly (
  user_id      uuid NOT NULL,
  protocol_id  uuid NOT NULL,
  month        date NOT NULL,            -- 1º dia do mês
  expected     int NOT NULL,
  taken        int NOT NULL,
  missed       int NOT NULL,
  PRIMARY KEY (user_id, protocol_id, month)
);
```

**Status semântico para adesão:**
- `taken` → numerador + denominador
- `missed` → denominador
- `skipped_paused` → **neutro** (fora do denominador — pausa não penaliza)
- `skipped_user` → **neutro** (pulei de propósito ≠ esqueci)
- `pending` futuro → ainda não conta

---

## 4. Motor de geração (`server/bot/scheduler.js`)

Roda fora do Vercel — não consome o budget de 12 functions (R-090). Reusa `isProtocolActiveOnDate` + `FREQUENCY_MATCHERS` do core (já tratam `diario/dias_alternados/semanal/personalizado` — `personalizado` = weekday setting sobre `semanal`, PR #592). **Sem caso especial de frequência.**

Cada protocolo guarda `generated_through timestamptz` (high-water-mark).

| Gatilho | Ação |
|---------|------|
| Criar protocolo c/ `end_date` | Gera todas instâncias até `end_date` |
| Criar protocolo contínuo | Gera até `now+30d`; seta `generated_through` |
| Cron diário | Varre ativos cujo `generated_through` se aproxima do fim; **renova** a janela de 30d (upsert `ON CONFLICT DO NOTHING`). **Não** regera 30d pra todos todo dia |
| Editar protocolo (`time_schedule`, `dosage`, `frequency`) | Wipe `status='pending' AND scheduled_for > now()` → regera |
| Pausar (toggle `active=false`) | Marca pendentes próximas 24h como `skipped_paused`; grava `paused_at`. **Toggle não faz trabalho pesado.** |
| Pausado > 1 dia (detectado pelo cron) | Wipe future pending restante |
| Religar | High-water-mark regenera JIT na próxima leitura |
| Leitura crítica (dashboard / scheduler notif) | Se `generated_through < now` → gera o gap on-the-fly (**rede de segurança v1**) |
| Backfill (one-shot, só o usuário-histórico) | Gera instâncias passadas dos protocolos ativos/pausados/finalizados + casa logs ±2h; órfão sem schedule = round-down (21:58→21:00) |
| Rollup mensal (cron mensal) | Agrega mês fechado em `dose_adherence_monthly` |

**Regras invioláveis do wipe:**
```sql
DELETE FROM dose_instances
WHERE protocol_id = $1
  AND status = 'pending'        -- nunca toca taken/missed/skipped
  AND scheduled_for > now();    -- nunca toca passado
```

---

## 5. Política de timezone (pré-requisito — Fase 1)

`scheduled_for` é instante absoluto → depende do fuso do usuário. Adicionar `user_settings.timezone` (Brasil multi-fuso: 2-3 zonas). **Tem que entrar antes de gerar qualquer instância** — senão grava no fuso errado e tudo precisa regerar. Substitui o hardcode `America/Sao_Paulo` (`dateUtils.js:165,201`).

---

## 6. Janela de tolerância dinâmica (recomendação clínica — Q-G)

Pesquisa valida: ±2h é o padrão de pesquisa clínica (MEMS). Adotar janela **derivada do intervalo de dosagem** (regra metade-do-intervalo, FDA), **teto em 2h**.

`tolerance_minutes = min(metade_do_menor_intervalo_adjacente, 120)` para protocolos diários multi-dose; janela fixa de 120min para não-diários (semanal/dias_alternados) e dose única.

| Frequência | Intervalo | Janela final (cap 2h) |
|-----------|-----------|----------------------|
| 1-4x/dia (≥4h entre doses) | ≥4h | **2h** (inalterado) |
| 3/3h | 3h | 1h30 |
| 2/2h | 2h | 1h |

**Ganho real não é afrouxar** — pra 99% dos casos (1-4x/dia) segue 2h. O dinâmico **impede sobreposição de janelas** entre doses adjacentes (hoje fixo ±2h com doses a cada 3h faz uma tomada casar com 2 slots — ambiguidade). Metade-intervalo elimina por construção.

**Complexidade baixa:** função pura sobre `time_schedule` ordenado. **Computa na geração e grava `tolerance_minutes` na própria `dose_instance`** — zero custo em runtime. Adicionar coluna:

```sql
ALTER TABLE dose_instances ADD COLUMN tolerance_minutes int NOT NULL DEFAULT 120;
```

Entra na fase de adesão (Fase 3); não bloqueia as anteriores.

### Follow-up (fora de escopo v1) — Strict tier por classe terapêutica
Adiado: aguarda opinião médica (usuário buscando contato na rede pessoal). Base ANVISA tem `therapeuticClass` (6807 meds, 410 classes, texto livre) — sinal **ruidoso**: `Antiretroviral` vem limpo (28 meds), mas imunossupressor espalhado em ~6 variantes e **insulina não é separável por classe** (enterrada em `Antidiabeticos`, misturada com orais flexíveis). Quando houver validação clínica: seed curado pequeno (allowlist por classe + princípio ativo) → janela estrita ±30-60min, **override por medicamento**, classe como sugestão nunca aplicação silenciosa.

---

## 7. Retenção / Archiving

Volume por usuário é **linear e pequeno** (~16k linhas em 3 anos). Eixo de escala real = usuários × tempo.

- **Hot:** `dose_instances` raw — **18 meses** (folga sobre os 365d que o streak exige, `adherenceLogic.js:137`).
- **Cold (rollup):** `dose_adherence_monthly` — agregados, **pra sempre** (linhas minúsculas), powers tendência longa + PDF médico.
- **Construir o rollup desde a v1** mesmo sem podar — poda futura de raw vira non-destructive.
- **Não deletar histórico** em app de medicação (risco clínico/legal). Particionamento por mês quando virar problema de escala.

---

## 8. Faseamento (4 PRs sequenciais)

### Fase 1 — Timezone (fundação)
- `user_settings.timezone` + UI de seleção
- Refatorar `dateUtils` para usar tz do usuário em vez de SP hardcoded
- **Revalidar tz a cada app launch:** lê tz do device → compara com setting. Mudou (ex: viagem Manaus↔SP) → atualiza + dispara wipe/regen das instâncias `pending` futuras (mecânica do edit de protocolo). Passadas/tomadas intactas.
- `taken_at` permanece instante absoluto (UTC); tz só dá referência de interpretação — não grava offset no log
- Sem mudança de comportamento visível ainda; pré-req de tudo
- **Entregável/testável isolado**

### Fase 2 — Tabela `dose_instances` + motor
- Migration: `dose_instances`, `dose_adherence_monthly`, `medicine_logs.dose_instance_id`, `protocols.generated_through`, `protocols.paused_at`
- Motor de geração em `server/bot/scheduler.js` (gatilhos da §4)
- Rede de segurança lazy (high-water-mark JIT)
- Backfill one-shot (script, só usuário-histórico)
- Escrita de log popula `dose_instance_id` (web LogForm, mobile, bot `doseActions.js`, FAB web, bulk)
- FAB flexível: snap em runtime → null se fora da janela (avulsa)

### Fase 3 — Adesão / streak por scheduled-time
- `isProtocolFollowed`, `calculateAdherenceStats`, `getCurrentStreak`, `isDoseInToleranceWindow` passam a ler `dose_instances`
- Janela clínica dinâmica derivada do intervalo (§6)
- Recálculo histórico muda scores já vistos — **risco baixo**: adesão já é dinâmica (muda ao longo do dia em multi-protocolo) e base é mínima (app recém-lançada). Sem necessidade de freeze/comunicação elaborada
- Rollup mensal ligado

### Fase 4 — UI timeline contínua (mata o bug visível)
- `useDoseZones` (web) + `_useTodayDerived` (mobile) → janela deslizante cross-dia
- Doses passam a ordenar/agrupar por `scheduled_for` (instante absoluto), não por string HH:mm
- **Padrão único nos dois modos:** seção fixa **"Pendências de ontem"** no topo da lista quando o relógio vira 0h, com as doses de ontem ainda dentro da janela
  - **Simple** (listão): seção carry-over no topo, depois o listão de hoje ordenado por `scheduled_for`
  - **Complex** (períodos Madrugada/Manhã/Tarde/Noite, day-bound): seção carry-over acima dos períodos; períodos de hoje inalterados
- Seção só aparece se houver dose de ontem na janela — caso comum (sem carry-over) renderiza idêntico ao dashboard de hoje
- Bug da meia-noite resolvido por construção

---

## 9. Questões resolvidas no design

| # | Tema | Resolução |
|---|------|-----------|
| Q-A | Timezone | `user_settings.timezone`, pré-req Fase 1 |
| Q-B | Backfill histórico | One-shot, só usuário-histórico; órfão = round-down |
| Q-C | PRN (`quando_necessario`) | Não gera instância; log `dose_instance_id=null` |
| Q-D | Doses extras/avulsas | `dose_instance_id=null`; timeline renderiza sem quebrar |
| Q-E | Registro retroativo/manual | **Âncora original sempre travada** — editar `taken_at` não re-ancora. Reavalia status (fora da janela → `missed`). Alerta inline antes de salvar |
| Q-F | Versionamento schedule | `expected_dose` congelado por instância — sem audit table |
| Q-G | Janela tolerância | **v1:** dinâmica metade-intervalo (cap 2h), `tolerance_minutes` por instância. **Strict tier por classe adiado** (aguarda médico) |
| Q-H | Idempotência notificação | `dose_instances.id` + `notified_at` |
| Q-I | Offline / clock skew / tz | Revalidar tz no app launch (Fase 1); tz change → regen futuras. Server timestamp confiável a validar na Fase 2 |
| Q-J | Performance rollover | High-water-mark + query por janela; refetch à meia-noite |

---

## 10. Riscos / pontos de atenção

- **Motor de geração** vira infra com responsabilidade clínica — rede lazy é obrigatória, não opcional.
- **Wipe amplo demais** destrói histórico — regra `pending AND > now()` é inviolável.
- **Pausa** não pode gerar "missed" falsa — `skipped_paused` neutro desde a v1.
- **tz antes de gerar** — ordem não-negociável.
