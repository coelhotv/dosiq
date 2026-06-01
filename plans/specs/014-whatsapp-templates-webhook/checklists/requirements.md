# Requirements Checklist: WhatsApp Templates & Webhook

**Feature Directory**: `plans/specs/014-whatsapp-templates-webhook`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the serverless router physical endpoint file path (`api/webhooks.js`) specified? [Completeness]
- [ ] **CHK003** Are all 4 required Meta templates (delay, stock, digest, expiration) mapped? [Completeness]

## Clarity

- [ ] **CHK004** Is the sha256 cryptographic webhook signature validation logic detailed? [Clarity]
- [ ] **CHK005** Are rollback plans and transitional feature toggles documented? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone parsing, Vercel serverless safety) reflected? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirements of local development builds stated? [Consistency]
