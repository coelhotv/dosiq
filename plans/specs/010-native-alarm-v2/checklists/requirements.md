# Requirements Checklist — Spec 010 (Alarme Nativo v2)

"Unit tests" da escrita de requisitos — validam completude/clareza/consistência/cobertura/
mensurabilidade/rastreabilidade. NÃO testam comportamento de implementação.

## Completude
- [x] Toda user story tem acceptance (Given/When/Then) — US1/US2/US3.
- [x] Todo FR tem ao menos 1 task (Traceability tasks.md).
- [x] Deliverables periféricos listados: 2 migrations (colunas), CON-024 aditivo, ADR-055/056,
      enum Zod (condicional T042), entitlement iOS.
- [x] Cenário de migração de dados explícito (default false + verificação) — §Data-Migration.

## Clareza
- [x] `critical_alarm` definido sem ambiguidade: **booleano puro**, canais nunca moram nele.
- [x] Hierarquia v1×v2 resolvida: toggle global aposentado; `native_alarm_enabled` vira capacidade.
- [x] Permissão: só SO requerida pro alarme; push in-app é camada separada (FR-006b).

## Consistência
- [x] spec ↔ plan ↔ tasks ↔ ADR sem contradição (analysis §2).
- [x] Divergência "dispatcher lê dose_instances" reconciliada **via spec 011 (ADR-057)**: reminder passa a ler dose_instances → gate lê `dose_instances.critical_alarm` (fonte única); 011 é pré-req. ADR-056 re-escopado.
- [x] R-191 (1 push/bloco) preservado p/ não-críticas (split per-dose).

## Mensurabilidade
- [x] SC-001..006 verificáveis (smoke + unit). Zero-duplicata (SC-002) é binário.
- [x] Migração tem query de verificação (100% false).

## Rastreabilidade
- [x] Traceability FR→task→SC em tasks.md.
- [x] ADR-055/056 ligados; CON-024 marcado p/ update; APs vigiados (201/206/209) citados.

## Riscos de requisito (abertos)
- [ ] Split do `partitionDoses` (novo kind vs flag) — decisão de implementação (T003), não de requisito.
- [ ] Localização da tela de toggle por-tratamento (T004).
- [ ] Aprovação Apple do entitlement Critical Alerts — externo; fallback cobre (FR-005).
