# 037 — Tasks

> Tier 1. Planning dobrado no gate C2 (sem plan.md, salvo decisão não-óbvia). POs do spec.md.

- [ ] T001 [US1] Criar helper web compartilhado de base ANVISA on-demand (Cache Storage API + manifest version + TTL 7d + fetch com timeout/AbortController + degradação graciosa). Parametrizado por chave de arquivo (`medicineDatabase`|`laboratoryDatabase`) e baseUrl derivada de `VITE_SUPABASE_URL`. Espelha a lógica de [useMedicineDatabase.js](../../../apps/mobile/src/shared/hooks/useMedicineDatabase.js) (sem React/AsyncStorage). [PO-1][PO-3]
- [ ] T002 [US1] Reescrever `loadDatabase()` em [medicineDatabaseService.js](../../../apps/web/src/features/medications/services/medicineDatabaseService.js) para usar o helper (T001); remover `import('@medications/data/medicineDatabase.json')`. API pública intacta. [PO-1]
- [ ] T003 [US1] Reescrever `loadDatabase()` em [laboratoryDatabaseService.js](../../../apps/web/src/features/medications/services/laboratoryDatabaseService.js) idem. [PO-1]
- [ ] T004 [US2] Remover entrada `manualChunks` de `medicineDatabase` em [vite.config.js](../../../apps/web/vite.config.js). [PO-2]
- [ ] T004b [US2] **(BLOQUEADA pela decisão do `[NEEDS CLARIFICATION]` A4)** Realocar `medicineDatabase.json` + `laboratoryDatabase.json` de `apps/web/src/features/medications/data/` para fora de `apps/web/` (destino a definir); ajustar `scripts/process-anvisa.js` (paths de saída) e o guia (FR-007). Garantir que nenhuma referência em `apps/web/src` aponte mais para os arquivos. [PO-2]
- [ ] T005 [C4] Testes: atualizar/criar suites dos services com fetch+manifest+cache mockados — caminhos: cold (download), warm cache (sem re-download), versão mudou (re-download), offline sem cache (vazio, sem throw), timeout. [PO-1][PO-3]
- [ ] T006 [C4] Validação: `rtk lint`, `rtk npm run test:critical`, build web (PO-2 manual — inspecionar dist sem a base). Fechar PO-1/PO-2/PO-3 com evidência colada.
- [ ] T007 [docs] Atualizar [GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md](../../../docs/operations/GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md) (FR-007): web também consome on-demand; JSONs do repo = fonte de upload, fora do build PWA; fluxo de atualização reflete web (Cache Storage/TTL) + mobile sem redeploy; corrigir caminho `git-icloud`→`git`.
- [ ] T008 [C4] R-221 SQP: plataforma=Web/PWA; impacto SemVer (patch — sem feature visível, mudança interna de carregamento/build); atualizar versão web se aplicável; CHANGELOG [Unreleased] em PT; sem store-note (mobile intocado).
- [ ] T009 [C5] Registrar: ADR (decisão on-demand+CacheStorage para web) se elevar a arquitetural; journal YYYY-WWW.jsonl; events.jsonl; atualizar state.json; specs README status delivered.
