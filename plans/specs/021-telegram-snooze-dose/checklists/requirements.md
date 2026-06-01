# Requirements Checklist: Telegram Dose Snooze (Telegram Only)

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`  
**Created**: 2026-06-01  
**Source**: Migrated Legacy Plan  

---

## Completeness

- [ ] **CHK001**: O Snooze do Telegram opera diretamente sobre a tabela canônica `dose_instances` (`snoozed_until`), descartando tabelas redundantes?  
  *Critério: O plan.md e a tasks.md mapeiam e atestam o uso da tabela materializada.*
- [ ] **CHK002**: A lógica de cron runner a cada minuto realiza o envio e atualiza de forma idempotente a coluna `snoozed_until` para `null` pós-disparo?  
  *Critério: Prevenção de loop infinito de disparos.*

---

## Clarity

- [ ] **CHK003**: Os critérios de elegibilidade clínica (gaps entre doses adjacentes >2h e janela máxima de fuso local <120 min) estão especificados com exatidão matemática?  
  *Critério: Algoritmo de elegibilidade claramente quantificado.*
- [ ] **CHK004**: O tratamento de strings curtas no callback do Telegram está explicitamente quantificado em bytes para evitar estouros de limite de API?  
  *Critério: String com UUID garantida abaixo de 64 bytes.*

---

## Traceability

- [ ] **CHK005**: Cada um dos requisitos funcionais (FR-001 a FR-007) e critérios de sucesso (SC-001 a SC-003) do spec encontra-se mapeado para pelo menos uma tarefa de tasks.md?  
  *Critério: Traceability matrix 100% resolvida com IDs `TNNN`.*

---

## Constitution Alignment

- [ ] **CHK006**: A orquestração do loop cron otimiza a cota de orçamentos serverless da Vercel Hobby (R-090)?  
  *Critério: O runner do Snooze é agregado dentro do cron unificado existente `api/notify.js` (sem novos slots de funções).*
- [ ] **CHK007**: O andamento e bumpers canônicos da liberação técnica seguem rigorosamente a governança de SemVer e português da R-221?  
  *Critério: Presença explícita de bumps e log de release em Tasks list.*
- [ ] **CHK008**: O design tz-aware garante precisão contra double-shift de fuso (R-020)?  
  *Critério: O cálculo de `snoozed_until` é feito em timestamp absoluto (UTC) e a tradução para hora local ocorre apenas textual no Telegram.*
