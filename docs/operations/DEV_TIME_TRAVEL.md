---
title: "Dev Time-Travel"
description: "Procedimento técnico e receitas para simulação de passagens de tempo (time-travel) em ambiente de desenvolvimento sem afetar o relógio do sistema."
version: "2.0.0"
status: active
category: operation
audience:
  - dev
  - agent
tags:
  - testing
  - time-travel
  - smoke-test
created_at: "2026-06-01"
updated_at: "2026-07-18"
---

# Dev Time-Travel — simular passagem de tempo em smoke

> ## ⚠️ Leia primeiro: escolha a técnica certa
>
> Existem **duas** formas de mover uma feature no tempo, e usar a errada produz **smoke falso**.
>
> | | **Deslocar o relógio** (§1) | **Mover a âncora** (§2) |
> |---|---|---|
> | Quando usar | a feature compara "agora" com **horários do dia** | a feature faz aritmética de **dia-calendário** contra uma data **gravada** |
> | Exemplos | carry-over / look-ahead (F4.3e), tolerância de dose, Live Activity | Evolução do tratamento (029), vigência de prescrição, qualquer coisa ancorada em `started_at`/`start_date` |
> | Mexe em | `getNow`/`getTodayLocal` **no device** | uma coluna `timestamptz` **no banco** |
> | Alcança o servidor? | ❌ **não** | ✅ sim (a data é a mesma dos dois lados) |
> | Código necessário | offset injetável (§1 — **NÃO existe no repo hoje**) | nenhum: um `UPDATE` |
>
> **Regra prática:** se o cron/servidor participa do comportamento, deslocar o relógio do device
> é insuficiente **e enganoso** — o cliente avança sozinho e o servidor fica para trás. Se o
> "quando" da feature está gravado numa coluna, mova a coluna.

> ## 🚧 Estado do código (verificado 2026-07-18)
>
> A §1 abaixo é **receita, não registro**: `__setDevNowOffsetMs`, `devTimeTravel.ts` (web e mobile)
> e os botões de offset no Dev Hub **nunca foram commitados**. O commit `3d748654` (F4.3e) tocou
> `utils/index.js` e `doseZones.js`, mas **não** `dateUtils.js` — o identificador só aparece no
> texto do `AP-203`. O ferramental viveu na working tree durante aquele smoke e se perdeu; não foi
> baixa da migração 040.
>
> Ou seja: **para usar a §1 é preciso implementá-la antes** (~1h). A §2 funciona hoje, sem código.

---

# §1 — Deslocar o relógio (janelas cross-dia: carry-over / look-ahead)

> **Status: NÃO IMPLEMENTADO no repo.** Receita de como reconstruir. Use só quando a feature
> comparar "agora" com horários **dentro do dia** e o servidor não participar da decisão.

## Por que NÃO mexer no relógio do SO

Adiantar/atrasar o relógio do sistema operacional **quebra a validação do JWT do Supabase**:
o access token passa a parecer expirado (`exp`/`iat` avaliados contra um `Date.now()` deslocado),
o `supabase-js` entra em **loop de refresh** e o endpoint `/auth/v1/token` responde **429 Too Many
Requests**. A sessão nunca estabiliza → toda escrita autenticada falha (sintoma real observado:
"Pular tour" travado, dashboard sem dados). Ver `AP-203`.

**Solução:** deslocar apenas o "agora" lógico do app (`getNow`/`getRawNow`/`getTodayLocal`) via um
**offset em memória**, sem tocar `Date.now()` global nem o relógio do SO. O Supabase segue validando
contra o tempo real → auth intacta.

### Footgun conhecido (AP-203)
O offset vaza para **escritas**: `registerDose` deriva `taken_at` de `getNow()`. Registrar dose com
offset ativo grava `taken_at` no futuro real e ancora uma `dose_instance` futura como `taken`. Em DB
compartilhado isso suja dados. Mitigações:
- usar **conta de teste descartável** (raio mínimo);
- **não** clicar "Tomar"/"Confirmar" com offset ativo se só for validar render;
- limpar ao fim (ver §Cleanup).

---

## Arquitetura (3 camadas)

```
core (offset injetável, puro)  ←  plataforma seta o offset em __DEV__
     getNow/getRawNow/getTodayLocal/getYesterdayLocal lêem Date REAL + offset
```

### 1. Core — `packages/core/src/utils/dateUtils.ts`

Adicionar um offset em ms aplicado SÓ às funções de "agora". **Usar `new Date().getTime()`
(não `Date.now()`)** — senão mocks de construtor `Date` em testes (ex. `titrationUtils.test`) quebram,
pois `Date.now` estático não é mockado.

```js
// ─── Dev time-travel (apenas smoke manual) ───
let _devNowOffsetMs = 0
export function __setDevNowOffsetMs(ms) { _devNowOffsetMs = Number.isFinite(ms) ? ms : 0 }
export function __getDevNowOffsetMs() { return _devNowOffsetMs }
function _nowMs() { return new Date().getTime() + _devNowOffsetMs } // new Date(), não Date.now()

export function getNow(tz = 'America/Sao_Paulo') { return getUserTime(new Date(_nowMs()), tz) }
export function getRawNow() { return new Date(_nowMs()) }
// getTodayLocal / getYesterdayLocal idem: trocar `new Date()` por `new Date(_nowMs())`.
```

Exportar `__setDevNowOffsetMs` / `__getDevNowOffsetMs` no barrel `packages/core/src/utils/index.ts`.

> **Importante:** `getTodayLocal`/`getYesterdayLocal` também precisam honrar o offset — o write-path
> e o fetch do dashboard (fronteiras de dia) dependem deles; senão a janela buscada não cobre o dia
> deslocado.

### 2. Web — `apps/web/src/shared/utils/devTimeTravel.ts` (+ init em `main.tsx`)

Lê o offset de `localStorage` (persiste no reload), aplica no boot, expõe helpers no `window`.
Gated `import.meta.env.DEV` → NO-OP em prod.

```js
/* eslint-disable no-restricted-syntax -- dev-only: new Date() = relógio real p/ calcular offset */
import { __setDevNowOffsetMs } from '@dosiq/core'
const KEY = '__dev_now_offset_min'

export function initDevTimeTravel() {
  if (!import.meta.env.DEV) return
  const persisted = Number(localStorage.getItem(KEY))
  if (Number.isFinite(persisted) && persisted !== 0) __setDevNowOffsetMs(persisted * 60_000)

  const setOffsetMin = (min) => {
    const n = Number(min) || 0
    localStorage.setItem(KEY, String(n)); __setDevNowOffsetMs(n * 60_000)
    console.warn(`[devTimeTravel] offset = ${n}min. Recarregue a página.`)
  }
  window.__devNow = setOffsetMin
  window.__devNowReset = () => { localStorage.removeItem(KEY); __setDevNowOffsetMs(0) }
  // Ancora "agora" num HH:MM local, dayOffset dias à frente (0=hoje, 1=amanhã).
  window.__devNowAt = (hhmm, dayOffset = 0) => {
    const [h, m] = String(hhmm).split(':').map(Number)
    if (!Number.isFinite(h)) return
    const now = new Date(); const target = new Date(now)
    target.setDate(target.getDate() + dayOffset); target.setHours(h, m || 0, 0, 0)
    setOffsetMin(Math.round((target - now) / 60_000))
  }
}
```

`main.tsx`: `import { initDevTimeTravel } from '@shared/utils/devTimeTravel'; initDevTimeTravel()` antes do `createRoot`.

**Uso (console, build dev `npm run dev`):**
```js
__devNowAt('23:30')      // pré-meia-noite → "Em breve" (look-ahead)
__devNowAt('00:30', 1)   // pós-meia-noite (amanhã 00:30) → "Pendências de ontem" (carry-over)
__devNowReset()          // tempo real
```
Sempre **reload** após cada comando.

### 3. Mobile — `apps/mobile/src/shared/utils/devTimeTravel.ts` (+ init em `AppRoot.tsx` + botões no DevHub)

Igual ao web, mas offset em `AsyncStorage` e controles via Dev Hub (sem console). Gated `__DEV__`.

```js
/* eslint-disable no-restricted-syntax -- dev-only */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { __setDevNowOffsetMs, __getDevNowOffsetMs } from '@dosiq/core'
const KEY = '__dev_now_offset_min'

export async function initDevTimeTravel() {            // chamar em AppRoot useEffect([])
  if (!__DEV__) return
  const min = Number(await AsyncStorage.getItem(KEY))
  if (Number.isFinite(min) && min !== 0) __setDevNowOffsetMs(min * 60_000)
}
export async function setDevOffsetMinutes(min) {
  if (!__DEV__) return
  const n = Number(min) || 0
  __setDevNowOffsetMs(n * 60_000); await AsyncStorage.setItem(KEY, String(n))
}
export async function anchorDevNowAt(hhmm, dayOffset = 0) {
  if (!__DEV__) return
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h)) return
  const now = new Date(); const target = new Date(now)
  target.setDate(target.getDate() + dayOffset); target.setHours(h, m || 0, 0, 0)
  await setDevOffsetMinutes(Math.round((target - now) / 60_000))
}
export async function resetDevOffset() { if (__DEV__) { __setDevNowOffsetMs(0); await AsyncStorage.removeItem(KEY) } }
export function getDevOffsetMinutes() { return Math.round(__getDevNowOffsetMs() / 60_000) }
```

`AppRoot.tsx`: `useEffect(() => { initDevTimeTravel() }, [])`.

Botões no `DevHubScreen.tsx` (cada um chama `apply()` → set + `Alert` "reabra a aba Hoje"):
- 🌙 **Pré (23:30):** `anchorDevNowAt('23:30')` → valida "Em breve".
- 🌑 **Pós (amanhã 00:30):** `anchorDevNowAt('00:30', 1)` → valida "Pendências de ontem".
- ↩️ **Reset:** `resetDevOffset()`.

Após cada botão, **reabrir a aba Hoje** (o `useFocusEffect` refaz o fetch e recomputa).

---

## Semântica dos âncoras (cuidado)

- **Pré-meia-noite:** `anchorDevNowAt('23:30')` → "agora" = **hoje 23:30**. Doses de amanhã de
  madrugada dentro da tolerância caem em **look-ahead** ("Em breve").
- **Pós-meia-noite:** `anchorDevNowAt('00:30', 1)` → "agora" = **amanhã 00:30** (NÃO hoje 00:30, que
  seria o passado). As doses da noite de hoje viram **carry-over** ("Pendências de ontem") no dia
  seguinte. Sem o `dayOffset=1` o teste falha silenciosamente (carry-over vazio).

## Pré-requisito de dados

Cada cenário precisa de `dose_instance` `pending` no dia adjacente **dentro da tolerância** vs o
"agora" deslocado. Sem ela, a seção fica (corretamente) vazia. A janela de fetch precisa cobrir o dia
adjacente: web `[ontem 00:00, amanhã 23:59]`; mobile `getDoseInstancesForPeriod` vai até **fim de
amanhã** (`addDays(today, 2)`).

## Cleanup (DB de teste)

```sql
-- artefatos de time-travel (taken no futuro real)
SELECT id, taken_at FROM public.medicine_logs WHERE user_id='<UID>' AND taken_at > now();

UPDATE public.dose_instances SET status='pending', medicine_log_id=NULL
WHERE user_id='<UID>' AND status='taken' AND scheduled_for > now();
DELETE FROM public.medicine_logs WHERE user_id='<UID>' AND taken_at > now();
```

---

# §2 — Mover a âncora (features ancoradas em data gravada)

**Funciona hoje, sem código.** Use quando o "quando" da feature está numa coluna do banco.

## Princípio

Se o comportamento é decidido por `dia_local(coluna_data) + N dias`, então **a coluna É o botão de
viagem no tempo**. Retroagi-la move servidor e cliente **juntos**, porque ambos leem a mesma data.
Não há offset para vazar em escritas (o footgun do `AP-203` simplesmente não existe aqui), e o
cron continua funcionando: ele avalia a mesma aritmética.

Deslocar o relógio do device neste caso é **pior que não testar**: a UI mostraria "vencida há 12
dias" enquanto o servidor ainda acha que é dia 0 e nunca disparou o push. Verde falso.

## Caso: Evolução do tratamento (spec 029)

Vencimento: `dia_local(titration_steps.started_at) + duration_days`, avaliado pelo motor
(`resolveTitrationAdvance`, servidor) **e** pela UI (`resolvePendingSwitch`, cliente).

### Pelo Dev Hub (recomendado)

Seção **"Spec 029 F5 — Evolução do tratamento"** (`_dev/devTitrationTriggers.ts`):

| Botão | O que faz |
|---|---|
| 📊 Vencer HOJE (dia 0) | `started_at = hoje − duration_days` + próxima etapa `pending_confirmation` → card com os 2 botões |
| 📊 Dia 3 | idem, −3 dias a mais → linha neutra + frase de contexto |
| 📊 Vencida há 12 dias | idem, −12 → banner âmbar + `[Ajustar duração]` |
| 🔔 Push LOCAL com as 2 ações | notificação local com a MESMA categoria/ações do push real |
| ↩️ Resetar escada | vigente volta a começar hoje; próxima volta a `upcoming` |

Reabra a aba **Hoje** após cada botão (`useFocusEffect` refaz o fetch).

### Por SQL (equivalente, quando não houver app rodando)

```sql
-- Pendura a troca como se o cron tivesse rodado. :dias = 0 | 3 | 12
UPDATE public.titration_steps
   SET started_at = now() - ((duration_days + :dias) || ' days')::interval, status = 'current'
 WHERE id = :step_vigente;
UPDATE public.titration_steps SET status = 'pending_confirmation' WHERE id = :step_seguinte;
```

### Pré-requisitos (senão o cenário não aparece — e está CORRETO não aparecer)

1. **A escada precisa ter troca de MEDICAMENTO.** Escada same-med (só muda a quantidade) faz
   `dose_change` **automático** — o CTA não existe nela por design (Decisões §0). Confira:
   ```sql
   SELECT titration_id, count(DISTINCT medicine_id) FROM public.titration_steps GROUP BY 1;
   ```
   `1` = não serve para o smoke do F5.
2. **Conta de smoke, nunca de paciente.** Confirmar a troca **pausa um tratamento e ativa outro**
   de verdade, e o push vai para todos os devices ativos da conta (Constituição I).

## O que o Dev Hub NÃO cobre

O push **local** valida categoria, botões, handler e a chamada da RPC. Ele **não** valida:

- a montagem do payload no servidor (`buildTitrationAlertPayload` → `expoPushChannel`);
- o `interruptionLevel: 'time-sensitive'` aplicado pelo serviço do Expo.

Esses dois só o disparo real cobre — e o job de titulação roda **às 08:00 SP em ponto**
(`api/notify.ts`: `currentHour === 8 && currentMinute === 0`). Procedimento: arme a pendência na
véspera com a âncora retroagida e confira o aparelho às 08:00.

## Cleanup (§2)

`devResetLadder` (ou o SQL acima ao contrário) restaura a escada. **Não desfaz uma confirmação já
executada**: se `[Iniciar etapa]` foi tocado, a RPC pausou um tratamento e ativou/criou outro —
reverter é manual, na tela de tratamentos. É o preço de exercitar o caminho real.

---

## Relacionados
- `AP-203` (offset vaza p/ escritas; nunca mexer no relógio do SO) — vale só para a §1
- `AP-305` (capacidade declarada em contrato sem consumidor por canal)
- `CON-024` (`splitDayTimeline` — carry-over/today/look-ahead) — caso da §1
- `CON-032` (motor da Evolução do tratamento) — caso da §2
- `plans/dose_instances_refactor/EXEC_PLAN_F4.3e.md` (local-only, não versionado)
