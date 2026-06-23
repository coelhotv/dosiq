# Dev Time-Travel — smoke de janelas cross-dia (carry-over / look-ahead)

> **Status:** receita reproduzível (não está no código — foi removida do diff da F4.3e após o smoke).
> **Quando usar:** validar manualmente comportamento dependente da virada-de-dia — "Pendências de ontem" (carry-over), "Em breve" (look-ahead), sweep de `missed`, streak cross-meia-noite — **sem esperar a meia-noite real**.
> **Criado:** 2026-06-01 (smoke F4.3e). Autor: DEVFLOW.

---

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

### 1. Core — `packages/core/src/utils/dateUtils.js`

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

Exportar `__setDevNowOffsetMs` / `__getDevNowOffsetMs` no barrel `packages/core/src/utils/index.js`.

> **Importante:** `getTodayLocal`/`getYesterdayLocal` também precisam honrar o offset — o write-path
> e o fetch do dashboard (fronteiras de dia) dependem deles; senão a janela buscada não cobre o dia
> deslocado.

### 2. Web — `apps/web/src/shared/utils/devTimeTravel.js` (+ init em `main.jsx`)

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

`main.jsx`: `import { initDevTimeTravel } from '@shared/utils/devTimeTravel'; initDevTimeTravel()` antes do `createRoot`.

**Uso (console, build dev `npm run dev`):**
```js
__devNowAt('23:30')      // pré-meia-noite → "Em breve" (look-ahead)
__devNowAt('00:30', 1)   // pós-meia-noite (amanhã 00:30) → "Pendências de ontem" (carry-over)
__devNowReset()          // tempo real
```
Sempre **reload** após cada comando.

### 3. Mobile — `apps/mobile/src/shared/utils/devTimeTravel.js` (+ init em `AppRoot` + botões no DevHub)

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

`AppRoot.jsx`: `useEffect(() => { initDevTimeTravel() }, [])`.

Botões no `DevHubScreen.jsx` (cada um chama `apply()` → set + `Alert` "reabra a aba Hoje"):
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

## Relacionados
- `AP-203` (time-travel vaza p/ escritas; nunca mexer no relógio do SO)
- `CON-024` (`splitDayTimeline` — carry-over/today/look-ahead)
- `plans/dose_instances_refactor/EXEC_PLAN_F4.3e.md` (local-only, não versionado)
