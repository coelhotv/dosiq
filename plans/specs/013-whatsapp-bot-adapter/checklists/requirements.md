# Requirements Checklist: WhatsApp Bot Adapter

**Feature Directory**: `plans/specs/013-whatsapp-bot-adapter`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the reliance on the common `INotificationChannel` interface for all adaptors explicit? [Completeness]
- [ ] **CHK003** Are the Meta API 1,000 conversational message limits and the 24-hour customer window handled? [Completeness]

## Clarity

- [ ] **CHK004** Is the fallback protocol to Telegram on network failures or quota exhaustion quantified? [Clarity]
- [ ] **CHK005** Are sandbox development setups and test environments specified? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone local chron, metadata security) reflected? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirements of local development builds stated? [Consistency]
