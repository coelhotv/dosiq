# Requirements Checklist: Public Emergency QR Card

**Feature Directory**: `plans/specs/006-public-emergency-qr-card`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the public emergency route Next.js/Vite bundle size constraint (< 50kB) explicitly detailed? [Completeness]
- [ ] **CHK003** Is the schema validation in the core package defined with Zod 4? [Completeness]

## Clarity

- [ ] **CHK004** Is the visual layout for responders detailed to avoid critical mistakes in stressful scenarios? [Clarity]
- [ ] **CHK005** Are security RLS rules and instant token revocation constraints clearly defined? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone UTC timestamps, RLS data safety) reflected? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirements of local development builds stated? [Consistency]
