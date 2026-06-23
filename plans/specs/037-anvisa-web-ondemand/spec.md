# 037 — ANVISA Web On-Demand (paridade mobile)

**Feature Directory:** plans/specs/037-anvisa-web-ondemand
**Created:** 2026-06-22
**Status:** specified
**Tier:** 2 (upgraded de 1 em 2026-06-22 via RC3 — escopo cresceu p/ cross-platform: hoist do núcleo on-demand p/ `@dosiq/core` + refatorar mobile, matando a triplicação na origem)
**Input:** Adequar a solução web da base ANVISA para carregar on-demand do Supabase Storage público (igual mobile), tirando o peso dos JSONs (~1.36 MB) do build PWA. Inclui base de medicamentos E de laboratórios. **+ centralizar a lógica on-demand em `@dosiq/core` (web + mobile consomem).**

---

## Context

Hoje a web embute os JSONs ANVISA no build (`import('@medications/data/medicineDatabase.json')` — 1.35 MB — e `laboratoryDatabase.json` — 13 KB), servidos como assets pelo Vercel. O mobile já resolve isso melhor: baixa on-demand do bucket público `dosiq-assets/anvisa/v1/` com cache versionado por `manifest.json` + TTL 7d, degradando graciosamente offline ([useMedicineDatabase.js](../../../apps/mobile/src/shared/hooks/useMedicineDatabase.js)).

O bucket **já contém ambos** os arquivos (manifest 1.1.2 lista `medicineDatabase` + `laboratoryDatabase`), então a web só precisa passar a consumir — sem mudança de backend, sem migração de dados, sem novo bucket.

**Por quê:** remover ~1.36 MB do build/deploy PWA; fonte única de dados ANVISA compartilhada web↔mobile; atualização da base sem redeploy da web.

**Decisão de cache (operador):** Cache Storage API (`caches`) — persistente, quota grande, integra PWA, funciona offline após 1ª carga.

---

## Out of Scope

- Mobile (intocado — já é on-demand).
- Pipeline de geração/processamento dos JSONs (`scripts/process-anvisa.js`, fonte CSV ANVISA) e o ato de upload em si — processo manual existente do PO que já serve o mobile. **Apenas a doc desse processo é atualizada** (ver FR-007), não o processo.
- Mudança na API pública dos services (`searchMedicines`, `searchByActiveIngredient`, `getMedicineDetails`, `findDuplicatesByIngredient`, lab equivalente) — permanecem assíncronas e estáveis (CON-012 não-breaking).
- Normalização de categoria regulatória (já entregue fora deste spec).

---

## User Stories

### US1 — Autocomplete continua funcionando, agora servido do Storage (P1)

Como paciente cadastrando um medicamento, ao digitar ≥3 caracteres no autocomplete eu vejo resultados da base ANVISA, sem perceber que os dados agora vêm do Supabase Storage em vez do bundle.

**Acceptance Scenarios:**
- Given base nunca cacheada e online, When abro o MedicineForm e busco "dipi", Then o service baixa do Storage e retorna resultados; buscas seguintes na mesma sessão não rebaixam.
- Given base já cacheada (Cache Storage) e versão do manifest inalterada, When recarrego a app e busco, Then resultados vêm do cache sem novo download da base completa.
- Given laboratório, When busco no LaboratoryAutocomplete, Then funciona pelo mesmo mecanismo on-demand.

```po PO-1
ac:     services ANVISA web buscam dados do Supabase Storage (não mais do import do bundle) e o autocomplete retorna resultados
proof:  rtk npm run test:critical -- medicineDatabaseService laboratoryDatabaseService
expect: testes dos services passam exercitando fetch mockado do Storage + cache (sem import do JSON)
guard:  rtk grep -rn "import('@medications/data/medicineDatabase.json')\|import('@medications/data/laboratoryDatabase.json')" apps/web/src  → zero ocorrências em runtime (services)
status: [ ] open
```

### US2 — JSON sai do build PWA (P1)

Como mantenedor, quero que o `medicineDatabase.json` (1.35 MB) e o `laboratoryDatabase.json` deixem de ser empacotados/servidos pelo build da web.

**Acceptance Scenarios:**
- Given o build de produção, When inspeciono o output do `dist`, Then não há chunk/asset contendo a base ANVISA (nem o chunk manual `medicineDatabase` em [vite.config.js](../../../apps/web/vite.config.js)).

```po PO-2
ac:     build web não contém os JSONs ANVISA nem o chunk manual correspondente
proof:  MANUAL — rtk npm run build --workspace @dosiq/web && rtk grep -rl "regulatoryCategory\|activeIngredient" apps/web/dist/assets | head
expect: nenhum asset do dist contém a base (grep sem resultados relevantes); manualChunks de medicineDatabase removido do vite.config.js
guard:  build conclui sem erro; app sobe e autocomplete funciona online
status: [ ] open
```

### US3 — Degradação graciosa offline (P2)

Como paciente offline sem cache prévio, ao abrir o form o autocomplete fica vazio mas o cadastro manual continua 100% funcional (sem crash, sem bloqueio).

**Acceptance Scenarios:**
- Given offline e sem cache, When busco no autocomplete, Then retorna vazio e o form segue utilizável (erro de rede silencioso, fetch com timeout R-168).
- Given offline com cache prévio válido, When busco, Then resultados vêm do cache.

```po PO-3
ac:     falha de rede sem cache não quebra o form (autocomplete vazio, degradação graciosa) e o fetch tem timeout
proof:  rtk npm run test:critical -- medicineDatabaseService
expect: teste de "fetch rejeita / offline sem cache" retorna [] sem lançar; teste de timeout (AbortController) presente
guard:  caminho com cache válido continua retornando resultados no mesmo suite
status: [ ] open
```

---

## Ceremony: eng-review (RC3) — 2026-06-22

**Achado 1 (HIGH — DRY/triplicação com mobile):** a lógica on-demand já existe em `apps/mobile/src/shared/hooks/useMedicineDatabase.js` (`fetchJson` timeout, `shouldRefreshCache` manifest+TTL, `resolveDataUrl`, `normalizeText`, `matchesPrefix`). `normalizeText` já triplicado (mobile + 2 web services). FR-006 só deduplica DENTRO da web. O núcleo (manifest/TTL/versão/normalize/match) é platform-agnostic; só o storage difere (AsyncStorage vs Cache Storage). → **decisão necessária** (ver Open Questions Q1): hoist p/ `@dosiq/core` com storage adapter (web consome agora, mobile migra em follow-up) vs aceitar duplicação consciente.

**Achado 2 (MEDIUM — behavioral):** `caches` é undefined em jsdom/vitest e contexto não-seguro. PO-1/PO-3 quebram se chamarem `caches` cru. → **FR-008** (guard `typeof caches` + fallback in-memory).

**Achado 3 (MEDIUM — Workbox):** sem `runtimeCaching` p/ storage hoje. Remover import tira JSON do precache (bom). Confirmar `globPatterns` não precacheia JSON pós-remoção + fetch cross-origin não interceptada → **FR-009**.

**Achado 4 (LOW):** `data/manifest.json` local (397B) — garantir que `loadDatabase` não dependa do manifest local pós-mudança (busca o remoto).

**Guard override (RC3): light → MEDIUM-UP.** POs dos 2 services com fetch mockado + cache + offline + timeout; build sem JSON; grep import zero. Não FULL (sem colisão clínica). Razão: cross-origin + cache + offline + PWA; autocomplete alimenta cadastro de medicamento.

## Functional Requirements

- **FR-001** — `loadDatabase()` de `medicineDatabaseService` e `laboratoryDatabaseService` DEVEM buscar do Storage público derivado de `VITE_SUPABASE_URL` + `/storage/v1/object/public/dosiq-assets/anvisa/v1`, não mais via `import` do JSON.
- **FR-002** — Cache via Cache Storage API, versionado por `manifest.json` (`files.<key>.path`) + TTL 7 dias (igual mobile): cache-first com revalidação em background; re-download quando `version` difere ou TTL expira.
- **FR-003** — Fetch com timeout (R-168, AbortController) e degradação graciosa: erro de rede sem cache ⇒ base vazia, sem throw para o caller; com cache ⇒ usa cache.
- **FR-004** — A API pública dos services permanece inalterada (assinaturas/contratos atuais; CON-012 não-breaking).
- **FR-005** — Remover o `import` dos JSONs do runtime e a entrada `manualChunks` de `medicineDatabase` em `vite.config.js`.
- **FR-006** — Lógica de cache/fetch compartilhada entre os dois services (sem duplicar manifest/TTL/timeout), parametrizada por chave de arquivo (`medicineDatabase` | `laboratoryDatabase`).
- **FR-008** (RC3) — Service guarda `typeof caches !== 'undefined'`; quando ausente (jsdom/teste/contexto não-seguro) usa fallback in-memory (módulo-level `_database`), sem throw. Garante PO-1/PO-3 verdes em vitest.
- **FR-009** (RC3) — Pós-remoção do import, confirmar que Workbox `globPatterns` não tenta precachear o JSON e que a fetch cross-origin ao Supabase Storage não é interceptada por `runtimeCaching` (nenhuma regra hoje — manter assim ou allowlist explícita).
- **FR-007** — Atualizar [GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md](../../../docs/operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md): documentar que a **web também** passa a consumir o bucket on-demand (não só mobile); que os JSONs do repo (`apps/web/src/features/medications/data/*`) são a **fonte de upload** e deixaram de ser empacotados no build PWA; e que atualizar a base em `anvisa/v1/` (substituir arquivos + bump `manifest.version`) reflete em web (Cache Storage, TTL 7d) e mobile sem redeploy. Corrigir caminho legado `git-icloud` → `git` na seção 3.3.

### US4 — Mobile consome o mesmo core, sem mudança de comportamento (P1, Slice 2)

Como mantenedor, quero `useMedicineDatabase` (mobile) consumindo o núcleo `@dosiq/core` via adapter AsyncStorage, matando a triplicação, sem que o usuário note diferença.

```po PO-4
ac:     mobile useMedicineDatabase consome createAnvisaDatabase do core (adapter AsyncStorage); comportamento idêntico
proof:  rtk npm test --workspace @dosiq/mobile -- useMedicineDatabase
expect: suite existente verde (busca/cache/offline/TTL) sem alterar asserts de comportamento
guard:  retorno do hook (database/manifest/isLoading/error/search/getByName) inalterado; lint 0 err
status: [ ] open
```

## Success Criteria

- **SC-001** — Autocomplete de medicamentos e de laboratórios funciona online consumindo do Storage.
- **SC-002** — Build web não empacota os JSONs ANVISA (≥1.36 MB a menos no deploy).
- **SC-003** — Offline sem cache não quebra o form; offline com cache serve resultados.
- **SC-004** — 100% dos ACs com PO fechado (status [x]) ao fim do C-mode.
- **SC-005** — `test:critical` verde; lint 0 erros.
- **SC-006** — Guia de operações reflete web como consumidor + JSONs fora do build (FR-007).

## Assumptions / Open Questions

- **A1** — O bucket `dosiq-assets/anvisa/v1/` é a fonte autoritativa e já está populado/versionado (manifest 1.1.2) pelo mesmo processo que serve o mobile. Este spec **consome**; não cria/gerencia o pipeline de upload.
- **A2** — Os arquivos JSON **permanecem no repo** como fonte de upload ao bucket (confirmado: o [guia de operações](../../../docs/operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md) referencia os JSONs locais como origem do upload, processados via `scripts/process-anvisa.js`), mas deixam de ser importados em runtime (logo não entram no bundle). Resolve o antigo `[NEEDS CLARIFICATION]` sobre manter-vs-remover.
- **A3** — Bucket é público (sem auth header — contrasta R-084, que vale para storage privado). Confirmado pelo guia: `dosiq-assets` é bucket público com leitura anônima; objeto `anvisa/v1/*` acessível sem auth (mesmo bucket do mobile).
- **A4** — Hoje os JSONs vivem em `apps/web/src/features/medications/data/`. Remover só o `import` impede o bundling, mas deixá-los dentro de `apps/web/src/` mantém o peso no workspace e arrisca re-import acidental no futuro. Devem ser **realocados para fora de `apps/web/`** (fonte de upload, não código de app).
- **[RESOLVED — NC1] (2026-06-22):** destino = **`data/anvisa/` na raiz** (fora do grafo de build, co-locado com upload). Atualizar paths em `scripts/process-anvisa.js` + guia (FR-007).
- **[RESOLVED — NC2] (2026-06-22):** **(A) — hoist p/ `@dosiq/core`** com storage adapter injetável. Web consome (Cache Storage adapter) E mobile refatora (`useMedicineDatabase` → AsyncStorage adapter). Mata triplicação na origem. **→ Tier 2 (cross-platform)**, bump mobile (patch, R-221). Fatiar: Slice 1 = core+adapters+web (tira JSON do build); Slice 2 = migrar mobile pro core (paridade, sem mudança de comportamento, protegido por `useMedicineDatabase.test.js`). FR-006 reescrito em torno do core.
