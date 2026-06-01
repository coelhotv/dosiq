# Requirements Checklist: Notification Copy & Engagement Metrics (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`  
**Created**: 2026-06-01  
**Source**: Migrated Legacy Plan  

---

## Completeness

- [ ] **CHK001**: O log de notificações rastreia de forma atômica a ocorrência de dose correspondente (`dose_instance_id`), garantindo granularidade clínica e relatórios precisos?  
  *Critério: O campo `dose_instance_id` está mapeado como FK obrigatória quando aplicável.*
- [ ] **CHK002**: A refatoração do dispatcher em duas fases garante a criação do log no status pending antes de disparar o push real?  
  *Critério: Assegurar que o payload enviado aos canais sempre contenha a ID correta do log.*

---

## Clarity

- [ ] **CHK003**: Os pools de saudações horárias e mensagens de streak estão explicitamente quantificados com regras determinísticas?  
  *Critério: Lógica baseada no par (userId, dia) detalhada com hash determinístico.*
- [ ] **CHK004**: O comportamento de tracking reativo diferencia visualizações passivas (`read_at`) de cliques ativos de tomada de decisão (`opened_at`)?  
  *Critério: Definição semântica clara e sem ambiguidades.*

---

## Traceability

- [ ] **CHK005**: Todos os requisitos funcionais (FR-001 a FR-005) e critérios de sucesso (SC-001 a SC-003) do spec encontram-se cobertos por tarefas de implementação com IDs `TNNN`?  
  *Critério: Matriz de rastreabilidade 100% resolvida.*

---

## Constitution Alignment

- [ ] **CHK006**: A arquitetura do tracking de cliques e tomada evita o consumo indevido de slots no orçamento Serverless Vercel Hobby (R-090)?  
  *Critério: Chamadas diretas do client-side para a REST API do Supabase sob regras de segurança RLS.*
- [ ] **CHK007**: As tarefas de governança,bump de versão, e registro no diário DEVFLOW C5 em português estão em total conformidade com a R-221?  
  *Critério: Presença explícita das tarefas da Fase 4.*
- [ ] **CHK008**: O design do Daily Digest enriquecido obedece à performance de dados tz-aware?  
  *Critério: Os fusos horários do usuário são devidamente respeitados no agrupamento temporal de doses.*
