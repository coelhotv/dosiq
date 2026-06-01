# Requirements Checklist: AI Chatbot Mobile

**Feature Directory**: `plans/specs/015-ai-chatbot-mobile`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the maximum chatbot local history (20 messages) limit documented? [Completeness]
- [ ] **CHK003** Are contextBuilder and safetyGuard clinical rules re-used? [Completeness]

## Clarity

- [ ] **CHK004** Is the visual layout for messages (FlatList invert, typing indicators) specified? [Clarity]
- [ ] **CHK005** Are connectivity loss exceptions handled gracefully in the mobile UI? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone parsing, offline security) reflected? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirements of local development builds stated? [Consistency]
