# Requirements Checklist: Native Alarm Persistent

**Feature Directory**: `plans/specs/001-native-alarm-persistent`  
**Created**: 2026-06-01  
**Source**: migrated legacy plan

---

## Completeness

- [ ] **CHK001** Are all legacy DoD items represented as requirements, tasks, or validation criteria? [Completeness]
- [ ] **CHK002** Is the 500 exact alarms limit of Android 12+ explicitly handled? [Completeness]
- [ ] **CHK003** Is the time-sensitive fallback for iOS (before critical alert entitlement) mapped? [Completeness]

## Clarity

- [ ] **CHK004** Are the exact file paths for Notifee implementation verified and defined? [Clarity]
- [ ] **CHK005** Are vague terms like "continuous alarm" quantified (nagging at 5 min, max 3 times)? [Clarity]

## Traceability

- [ ] **CHK006** Does each FR/SC map to at least one task in `tasks.md`? [Traceability]
- [ ] **CHK007** Are legacy sources explicitly cited and traced? [Traceability]

## Constitution Alignment

- [ ] **CHK008** Are Dosiq constitution constraints (timezone local date parsing, offline safety) reflected in the plan? [Consistency]
- [ ] **CHK009** Is the decommission of Expo Go and requirement of development builds clearly stated? [Consistency]
