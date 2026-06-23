# Artifact Coverage Analysis — 015 Chatbot IA (Tier 2)

**Status:** STUB — gerado por ONDA no C1.5 (não no planning).

O `analysis.md` (Reality Check com evidence table + behavioral failure modes) é produzido **antes de
codar cada onda** (C1.5), validado contra o repo real — não como narrativa de planning. O draft legado
("PASS" sobre port-de-UI) foi invalidado pela reescrita Tier 2.

Quando entrar em coding da Onda 1a, gerar aqui:
- **Evidence table** dos símbolos do fetcher/builder (selects reais web/server, join treatment_plan,
  exports do core já existentes — splitDayTimeline/isProtocolActiveOnDate/formatDoseItem).
- **Behavioral failure modes** do `buildPatientContext`/`fetchChatbotContextData`: protocolo sem
  treatment_plan (NULL), treatment_plan.name nulo, doseInstances vazio, stockSummary ausente,
  medicines/protocols vazios, plano 1-item.
- **Cross-file consistency** spec↔plan↔tasks↔CON-028.
- **Migração:** nenhuma (additivo).

Referências de planning: plan.md (Technical Context com file:line), CON-028, ADR-074.
