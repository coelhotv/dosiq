# Requirements Checklist — 037

> "Testes unitários da escrita de requisitos" — completude/clareza/consistência/cobertura/mensurabilidade/rastreabilidade. NÃO testam implementação.

## Completude
- [x] Todo FR tem task vinculada (FR-001..009 → tasks.md)
- [x] Todo PO tem proof+expect+guard+status
- [x] Peripheral coberto: novo CON-027, ADR-073, mover JSON, ajustar process-anvisa, doc FR-007
- [x] Slice 2 (mobile) tem PO próprio (PO-4)

## Clareza
- [x] "on-demand" definido (manifest+TTL+fetch, não import)
- [x] storage adapter interface explícita (read/write)
- [x] destino JSON concreto (`data/anvisa/`)

## Consistência
- [x] spec ↔ plan ↔ analysis concordam (2 slices, core, API preservada)
- [x] Tier 2 refletido em header + README + state

## Cobertura
- [x] Caminhos-sombra: offline sem cache, offline com cache, timeout, caches undefined, manifest sem key
- [x] API pública preservada (FR-004) é guard de PO-1
- [x] Mobile paridade = Jest verde

## Mensurabilidade
- [x] SC-002 quantificado (≥1.36 MB fora do build; grep dist)
- [x] PO-1/3 = test:critical; PO-2 = build+grep; PO-4 = jest mobile

## Rastreabilidade
- [x] CON-027/ADR-073 ligados ao plan
- [x] Origem do código (mobile useMedicineDatabase) citada com file:line

## Aberto
- [ ] Confirmar no Slice 1 que `data/manifest.json` local não é dep de runtime (R5)
- [ ] Confirmar Workbox globPatterns pós-remoção (FR-009)
