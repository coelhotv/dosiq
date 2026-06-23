# Analysis 037 — Artifact Coverage (C1.5 pré-coding)

> Tier 2. Verificado contra o repo real (find/grep/read), não contra a narrativa da spec.

## 1. Evidence Table

| Spec claim | Real repo (file:line) | Verified? | Note |
|-----------|----------------------|:-:|------|
| Web services com API pública estável (8 fns) | `medicineDatabaseService.js:49,73,96,111,123` + `laboratoryDatabaseService.js:49,68,82` | ✅ | preservar assinaturas (FR-004) |
| Lógica on-demand existe no mobile (origem do core) | `useMedicineDatabase.js` fetchJson/shouldRefreshCache/resolveDataUrl/normalizeText/matchesPrefix | ✅ | extrair p/ core sem reinventar |
| Base URL pública (sem auth) | `useMedicineDatabase.js:19` + guia operações (bucket público) | ✅ | A3 confirmado; sem R-084 |
| manualChunks medicineDatabase existe | `vite.config.js:55` | ✅ | remover (FR-005) |
| Processador escreve em `src/features/medications/data` | `process-anvisa.js:24` DATA_DIR | ✅ | mover p/ `data/anvisa/` (FR + Q1) |
| JSON importadores | services web (2) + `process-anvisa.js` + `data/manifest.json`; **mobile NÃO** | ✅ | mobile busca bucket; relocação não afeta mobile |
| CON-012 cobre estes services? | CONTRACTS_INDEX `CON-012` = cachedMedicineService (SWR) | ✅ | **NÃO** cobre → sem breaking; novo CON-027 |
| `caches` disponível em vitest | jsdom NÃO expõe `caches` | ✅ | FR-008 obrigatório (guard + fallback) |
| Workbox runtimeCaching p/ storage | nenhuma regra hoje | ✅ | FR-009 só confirma globPatterns pós-remoção |
| Next free ADR / CON | ADR max 072 / CON max 026 | ✅ | ADR-073 / CON-027 |

## 2. Cross-file Consistency
spec.md ↔ plan.md ↔ tasks.md concordam: 2 slices, core+adapters, JSON→data/anvisa, API preservada. Sem contradição.

## 3. Data-migration completeness
Sem schema/enum/DB. "Migração" = mover arquivos JSON (git mv) + repontar `process-anvisa.js`. Não há linhas de banco órfãs. N/A formal.

## 4. Coverage
- FR-001→T(core+web services) · FR-002→T(shouldRefreshCache+TTL) · FR-003→T(fetchJson timeout+offline) · FR-004→PO-1 guard (assinaturas) · FR-005→T(vite) · FR-006→T(core único) · FR-007→T(doc) · FR-008→T(adapter guard)+PO-3 · FR-009→T(workbox check).
- SC-001..006 → POs 1-3 + build grep. US3→teste offline. Slice 2→PO-4 (paridade mobile).

## 5. Behavioral Failure Modes — `createAnvisaDatabase` / adapters

| Input / condição | Valor degenerado | Comportamento esperado | Coberto (teste)? |
|-----------------|------------------|------------------------|:-:|
| `fetch` manifest rejeita, sem cache | network error | `load()` → `[]`, sem throw (degradação) | T-core offline |
| `fetch` data rejeita, com cache válido | network error | usa cache | T-core cache-hit |
| timeout estourado | AbortController abort | rejeita interno → `[]` (sem cache) | T-core timeout |
| `caches` undefined (jsdom/non-secure) | `typeof caches==='undefined'` | adapter usa fallback memória, sem throw | T-web adapter (FR-008) |
| manifest remoto sem `files.<key>` | key ausente | resolveDataUrl → null → `[]` sem throw | T-core resolve |
| `query` < 3 chars / vazio | `''` | `search` → `[]` (igual hoje) | T-core search |
| `query` com acento/caixa | `'Diví'` | normalizeText casa (NFD+strip) | T-core normalize |
| TTL expirado + offline | sem rede | serve cache stale (não apaga) | T-core stale |
| versão manifest difere | bump | re-download + repersiste | T-core refresh |
| storage write falha (quota) | reject | engole erro, mantém memória, não quebra busca | T-adapter |

Cada linha → teste de caminho-negativo no Slice 1 (core) / adapter web. Mobile (Slice 2): `useMedicineDatabase.test.js` existente cobre o comportamento de ponta-a-ponta (rede de segurança da refatoração).

## Gate
Sem CRITICAL/HIGH não-mitigado. Riscos R1/R2 mitigados por testes-rede. **PASS condicional** → prosseguir a tasks/coding por slice. (Honestidade: não declaro "100% perfeito"; PrescriptionTimeline n/a aqui; o risco vivo é a paridade mobile no Slice 2 — gate = Jest verde.)
