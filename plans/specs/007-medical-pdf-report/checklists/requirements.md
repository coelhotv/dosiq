# Requirements Checklist: Medical PDF Report

**Feature Directory**: `plans/specs/007-medical-pdf-report`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the differentiation between `expo-print` (Mobile) and `jsPDF` (PWA) explicit? [Completeness]
- [ ] **CHK003** Are all required clinical sections (Medicines, Adherence, History) present in the PDF output? [Completeness]

## Clarity

- [ ] **CHK004** Is the visual style and CSS inline safety of the HTML generation specified? [Clarity]
- [ ] **CHK005** Are dynamic imports and lazy-loading of PWA library assets defined to prevent bundle bloat (AP-B03)? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone parsing, offline security) reflected? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirements of local development builds stated? [Consistency]
