# Plan 037 — ANVISA On-Demand via Core (cross-platform)

- **Tier:** 2 · **Guard:** MEDIUM-UP (RC3) → web Vitest + mobile Jest verdes por slice · **Platforms:** Web/PWA + Mobile + Shared/Core
- **SemVer:** web minor (feature) · mobile patch (refactor sem comportamento, R-221) · core minor
- **Spec:** [spec.md](./spec.md) · **Ceremonies:** eng-review (RC3) · **Analysis:** [analysis.md](./analysis.md)
- **ADR:** ADR-073 (proposed) — núcleo on-demand em core + storage adapter · **CON:** CON-027 (proposed) — interface `createAnvisaDatabase` + `StorageAdapter`

## Summary

Centralizar a lógica on-demand ANVISA (manifest/TTL/versão/fetch-timeout/normalize/search) em `@dosiq/core`, parametrizada por um **storage adapter** injetável. Web consome com adapter Cache Storage API (tira ~1.36 MB do build PWA); mobile refatora pra consumir o mesmo core com adapter AsyncStorage (mata triplicação). JSONs saem de `apps/web/src/.../data/` → `data/anvisa/` (raiz, fonte de upload, fora do build graph).

## Technical Context (verificado)

| Item | Evidência (file:line) |
|------|----------------------|
| Web services (API pública a preservar) | `medicineDatabaseService.js:49,73,96,111,123` (searchMedicines, getMedicineDetails, searchByActiveIngredient, getAllMedicines, findDuplicatesByIngredient) + `laboratoryDatabaseService.js:49,68,82` (searchLaboratories, getLaboratoryByName, getAllLaboratories) |
| Lógica on-demand já existente (origem do core) | mobile `useMedicineDatabase.js` — `fetchJson`(timeout/AbortController), `shouldRefreshCache`, `resolveDataUrl`, `normalizeText`, `matchesPrefix`, `persistRemote` |
| Base URL pública mobile | `useMedicineDatabase.js:19` `ANVISA_BASE_URL` = `<supabase>/storage/v1/object/public/dosiq-assets/anvisa/v1` |
| JSON output do processador | `scripts/process-anvisa.js:24` `DATA_DIR=../src/features/medications/data`; `:25,26` MEDICINE/LABORATORY_JSON_OUTPUT |
| manualChunks a remover | `vite.config.js:55` `./src/features/medications/data/medicineDatabase.json` |
| CON adjacente (NÃO é estes services) | CON-012 = cachedMedicineService (SWR wrapper) — não cobre os 2 services ANVISA; logo sem breaking |

## Architecture / Approach

```
@dosiq/core/services/anvisaDatabase.js  (NOVO — CON-027)
  createAnvisaDatabase({ baseUrl, fileKey, storageAdapter, ttlMs=7d, timeoutMs=30s })
    → { load(): Promise<normalizedDb[]>, search(q,limit), getByName(name), ... }
  helpers puros: fetchJson · shouldRefreshCache · resolveDataUrl · normalizeText · matchesPrefix

  StorageAdapter interface (injetada):
    read(fileKey)  → { manifest, data } | null
    write(fileKey, { manifest, data }) → void

apps/web   → cacheStorageAdapter.js (Cache Storage API; FR-008 guard typeof caches → fallback memória)
             2 services viram cascas: createAnvisaDatabase(fileKey='medicineDatabase'|'laboratoryDatabase')
apps/mobile→ asyncStorageAdapter.js (AsyncStorage; comportamento atual preservado)
             useMedicineDatabase.js consome o core (mesma API de retorno do hook)

data/anvisa/{medicineDatabase,laboratoryDatabase,manifest}.json  (movidos da web; fonte de upload)
scripts/process-anvisa.js: DATA_DIR → ../data/anvisa
```

**Slices (sub-entregas):**
- **Slice 1 (PR-1)** — core module + CON-027 + web cacheStorageAdapter + 2 services consomem core + remover import/manualChunks + mover JSONs p/ `data/anvisa/` + ajustar `process-anvisa.js` + FR-007 doc. **Entrega o objetivo:** JSON fora do build PWA. [PO-1, PO-2, PO-3]
- **Slice 2 (PR-2)** — mobile `useMedicineDatabase` consome o core via asyncStorageAdapter (paridade, sem mudança de comportamento; protegido por `useMedicineDatabase.test.js`). Bump mobile patch. [PO-4 novo]

## Target Files

| Path | Slice | Ação |
|------|:-:|------|
| `packages/core/src/services/anvisaDatabase.js` | 1 | NOVO — core on-demand + helpers (CON-027) |
| `packages/core/src/services/index.js` | 1 | export |
| `packages/core/src/services/__tests__/anvisaDatabase.test.js` | 1 | NOVO — fetch mock + cache + offline + timeout + failure modes |
| `apps/web/src/features/medications/services/_cacheStorageAdapter.js` | 1 | NOVO — adapter Cache Storage (FR-008 guard) |
| `apps/web/.../services/medicineDatabaseService.js` | 1 | casca sobre core (preserva 5 exports) |
| `apps/web/.../services/laboratoryDatabaseService.js` | 1 | casca sobre core (preserva 3 exports) |
| `apps/web/.../services/__tests__/*.test.js` | 1 | adaptar p/ fetch mock + cache (sem import JSON) |
| `apps/web/vite.config.js:55` | 1 | remover manualChunks medicineDatabase |
| `data/anvisa/{medicineDatabase,laboratoryDatabase,manifest}.json` | 1 | `git mv` da web |
| `scripts/process-anvisa.js:24` | 1 | DATA_DIR → `../data/anvisa` |
| `docs/operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md` | 1 | FR-007 (web consumidor + nova fonte + git-icloud→git) |
| `apps/mobile/src/shared/.../_asyncStorageAdapter.js` | 2 | NOVO — adapter AsyncStorage |
| `apps/mobile/src/shared/hooks/useMedicineDatabase.js` | 2 | consome core (preserva retorno do hook) |
| `apps/mobile/.../__tests__/useMedicineDatabase.test.js` | 2 | rede de segurança (deve continuar verde) |

## Contracts and ADRs

- **CON-027 (proposed):** `createAnvisaDatabase(config)` + `StorageAdapter{read,write}`. Aditivo (novo módulo). Os 2 web services + mobile hook consomem; API pública deles **inalterada** (FR-004).
- **ADR-073 (proposed):** núcleo on-demand platform-agnostic em core com storage adapter injetável (vs duplicar por plataforma). Justifica o upgrade Tier 2.
- **CON-012:** não afetado (SWR wrapper distinto).

## Risks + Quality Gates

- **R1 (HIGH):** refator mobile muda comportamento silencioso. **Mitig:** `useMedicineDatabase.test.js` verde + retorno do hook idêntico; Slice 2 isolado.
- **R2 (HIGH — FR-008):** `caches` undefined em vitest/jsdom/non-secure. **Mitig:** adapter guarda `typeof caches`, fallback memória; teste cobre ambos.
- **R3 (MED):** mover JSON quebra `process-anvisa.js` ou re-import acidental. **Mitig:** grep import zero + rodar processador dry; `data/anvisa/` fora do build.
- **R4 (MED — Workbox FR-009):** precache/runtimeCaching. **Mitig:** confirmar globPatterns + sem regra cross-origin.
- **R5 (LOW):** manifest local vira dep runtime. **Mitig:** core busca manifest remoto; local só upload.

**Guard MEDIUM-UP por slice:** `rtk lint` 0err + Slice 1 `test:critical` (web) + Slice 2 `npm test --workspace @dosiq/mobile` (Jest) + build web sem JSON (grep dist) + grep import JSON zero.

## Clarifications
- Q: views=wrapper? → n/a (spec 038). Q1 destino JSON → `data/anvisa/`. Q2 DRY → (A) hoist core + mobile. (ambos resolvidos na spec)
