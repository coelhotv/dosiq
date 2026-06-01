# Requirements Checklist: Caregiver Demand Teaser

**Feature Directory**: `plans/specs/002-caregiver-demand-teaser`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the unique constraint migration (`rename_beta_signups_platform_to_feature.sql`) explicitly mapped as a preflight task? [Completeness]

## Clarity

- [ ] **CHK003** Are the exact layouts for the bottom sheet (mobile) and modal (PWA) specified? [Clarity]
- [ ] **CHK004** Is the handling of database uniqueness errors (idempotency 23505) clearly defined? [Clarity]

## Traceability

- [ ] **CHK005** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK006** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK007** Are Dosiq constitution constraints (data safety waitlist isolation, mobile keyboard reliability) reflected in the plan? [Consistency]
- [ ] **CHK008** Is the decommission of Expo Go and requirement of development builds clearly stated in mobile tasks? [Consistency]
