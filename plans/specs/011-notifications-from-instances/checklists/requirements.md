# Requirements Checklist — Spec 011 (Notif ← dose_instances)

"Unit tests" da escrita de requisitos — validam completude/clareza/consistência/cobertura/
mensurabilidade/rastreabilidade. NÃO testam comportamento de implementação.

## Completude
- [x] Toda user story tem acceptance (Given/When/Then) — US1/US2/US3.
- [x] Todo FR tem ao menos 1 task (Traceability tasks.md).
- [x] Deliverables periféricos listados: feature flag (`REMINDER_SOURCE`), ADR-057, doc update
      (`DOSE_INSTANCES.md` notified_at em uso), CHANGELOG.
- [x] Cenário de "migração": **sem schema change** (colunas já existem); backfill nulo explícito.

## Clareza
- [x] `notified_at` definido sem ambiguidade: setado **após sucesso ≥1 canal**, **por-ocorrência**.
- [x] Escopo separado da 010: `critical_alarm`/roteamento crítico **fora** (Out of Scope).
- [x] Dedup heurística aposentada **só** p/ kinds de dose; digest/stock e `notification_log` ficam.

## Consistência
- [x] spec ↔ plan ↔ tasks ↔ ADR-057 sem contradição (analysis §2).
- [x] Reconciliação com 010: gate crítico migra p/ `dose_instances.critical_alarm` (insumo re-escopo ADR-056).
- [x] Agrupamento (R-191/AP-112) preservado — mesmo modelo, troca o input.

## Mensurabilidade
- [x] SC-001 (paridade) verificável por teste com fixture compartilhada.
- [x] SC-002 (zero-duplicata) binário — cron 2× → 1 lembrete.
- [x] SC-004 (rollback) verificável — flag env volta comportamento sem deploy.

## Rastreabilidade
- [x] Traceability FR→task→SC em tasks.md.
- [x] ADR-057 ligado; CON-019/021 marcados inalterados; APs relevantes (AP-186 paginação, AP-194 tz) citados.

## Riscos de requisito (abertos)
- [ ] **Paridade no cutover** (frequência semanal/alternada/weekday já materializada nas instâncias
      vs `isProtocolActiveOnWeekday`) — HIGH; SC-001/T040 é o gate, não requisito ambíguo.
- [ ] Janela do minuto / borda de cron / clamp — decisão de implementação (T005), não de requisito.
- [ ] Localização do arquivo de teste do reminder (T004).
