# Requirements Checklist: Caregiver Links & RLS

**Feature Directory**: `plans/specs/010-caregiver-links-rls`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Are PostgreSQL table constraints for invitation rate limits (attempts <= 5) specified? [Completeness]
- [ ] **CHK003** Is the schema validation in the core package defined with Zod 4? [Completeness]

## Clarity

- [ ] **CHK004** Are the RLS security policies for both 'manager' and 'observer' roles explicitly detailed? [Clarity]
- [ ] **CHK005** Are security constraints of instant link revocation detailed? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone UTC timestamps, RLS data safety) reflected? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirements of local development builds stated? [Consistency]
