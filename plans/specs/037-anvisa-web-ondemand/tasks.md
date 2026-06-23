# Tasks — 037 ANVISA On-Demand via Core

> Tier 2, Guard MEDIUM-UP. 2 slices/PRs. Branch sync ritual (AP-169) por slice. ESM `.js` extension em core/api (AP-129/AP-184).

## Slice 1 — core + web (PR-1) [PO-1, PO-2, PO-3]
- [ ] S1-01 Branch sync → `refactor/037/slice-1-core-web`
- [ ] S1-02 [core] `packages/core/src/services/anvisaDatabase.js` — `createAnvisaDatabase({baseUrl,fileKey,storageAdapter,ttlMs,timeoutMs})` + helpers puros (fetchJson timeout, shouldRefreshCache, resolveDataUrl, normalizeText, matchesPrefix) extraídos do mobile [PO-1]
- [ ] S1-03 [core] export em `services/index.js`; CON-027 doc
- [ ] S1-04 [core] testes `anvisaDatabase.test.js` — fetch mock + cache + offline + timeout + failure modes (analysis §5) [PO-3]
- [ ] S1-05 [web] `_cacheStorageAdapter.js` — Cache Storage API + guard `typeof caches` + fallback memória (FR-008) [PO-3]
- [ ] S1-06 [web] `medicineDatabaseService.js` vira casca sobre core (preserva 5 exports) [PO-1]
- [ ] S1-07 [web] `laboratoryDatabaseService.js` casca sobre core (preserva 3 exports) [PO-1]
- [ ] S1-08 [web] adaptar testes dos 2 services (fetch mock + cache; sem import JSON) [PO-1]
- [ ] S1-09 `git mv` JSONs web → `data/anvisa/` + `process-anvisa.js:24` DATA_DIR → `../data/anvisa` [PO-2]
- [ ] S1-10 [web] remover import runtime + `vite.config.js:55` manualChunks medicineDatabase [PO-2]
- [ ] S1-11 [web] FR-009: confirmar Workbox globPatterns não precacheia JSON + fetch cross-origin não interceptada
- [ ] S1-12 doc FR-007: guia (web consumidor + nova fonte `data/anvisa/` + git-icloud→git)
- [ ] S1-13 [C4] Guard: lint + test:critical + build (grep dist sem base) + grep import JSON zero. Colar evidência → PO-1/2/3
- [ ] S1-14 PR-1 + check-review

## Slice 2 — mobile paridade (PR-2) [PO-4]
- [ ] S2-01 Branch sync → `refactor/037/slice-2-mobile`
- [ ] S2-02 [mobile] `_asyncStorageAdapter.js` (AsyncStorage, comportamento atual)
- [ ] S2-03 [mobile] `useMedicineDatabase.js` consome core via adapter (preserva retorno do hook) [PO-4]
- [ ] S2-04 [mobile] `useMedicineDatabase.test.js` continua verde (rede de segurança) [PO-4]
- [ ] S2-05 [C4] Guard: `npm test --workspace @dosiq/mobile` (Jest) verde + lint. Colar evidência → PO-4
- [ ] S2-06 PR-2 + check-review

## C5 (pós-slices)
- [ ] Z01 [C5] CON-027 + ADR-073 → accepted; CONTRACTS/DECISIONS index
- [ ] Z02 [C5] R-221 SQP: web minor + mobile patch + core minor; CHANGELOG [Unreleased]; store-note mobile (refactor, sem nota de usuário)
- [ ] Z03 [C5] journal + state.json + README 037 → in-progress/delivered
