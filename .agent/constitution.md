# Dosiq Constitution

## Core Principles

### I. Health Data Safety

Dosiq handles health-related medication, adherence, schedule, notification, and profile data. Changes MUST preserve privacy, avoid unnecessary data exposure, and never mutate production or real-user data during tests. Test and smoke flows MUST use controlled fixtures, local mocks, staging-safe accounts, or explicitly approved non-production data.

### II. Mobile-First Reliability

Dosiq decisions MUST consider mobile users and low-mid devices first. Long lists, heavy computations, synchronous parsing, and large client-side aggregations are unacceptable on critical flows unless bounded and justified. Mobile-critical experiences MUST degrade gracefully under slow network, limited memory, and app foreground/background transitions.

### III. Server-Side Aggregation for Long-Range Health Metrics

Long-range adherence, heatmaps, reports, and clinical summaries MUST preserve server-side aggregation as the default architecture. Moving long-range health metric calculation to the client is prohibited unless the dataset is explicitly bounded, justified in the plan, and validated against performance risks.

### IV. Timezone Correctness

Timezone behavior is a clinical-domain concern, not display decoration. User timezone MUST be represented by IANA identifiers, never fixed offsets. Query windows and persistence boundaries MUST use real UTC instants; timezone governs local day and wall-clock derivation for user-facing behavior.

### V. Contract and ADR Discipline

Breaking changes to service APIs, schemas, report shapes, notification payloads, date/time utilities, or shared component interfaces MUST have an accepted ADR before implementation. Stable interfaces MUST be represented in DEVFLOW contracts when they are reused, user-visible, or cross-package.

### VI. Release and SQP Discipline

Code-changing work MUST classify affected platform(s), SemVer impact, version-source changes, CHANGELOG impact in Portuguese, and mobile store-note relevance when Mobile is affected. Process-only changes should be recorded as `no-user-impact` unless product behavior changes.

### VII. Human-Controlled Delivery

Agents MUST NOT merge their own PRs. Meaningful mobile or visual changes require PO smoke validation before opening or finalizing PR flow when the active DEVFLOW rules require it. Mode transitions remain operator-controlled; agents must stop at DEVFLOW gates.

### VIII. Filesystem Memory Is Canonical

Chat is not the source of truth. Official state lives in `.agent/state.json`, `.agent/memory/`, `.agent/sessions/events.jsonl`, journal entries, ADRs, contracts, and versioned plans. Any durable process decision or learning needed by future agents MUST be written to the filesystem.

## Delivery Constraints

- Do not alter production data or real-user records in tests.
- Prefer server-side or bounded computation for health aggregates.
- Treat timezone, notifications, adherence, stock, PDF/reporting, and mobile UX as high-risk domains.
- Preserve web/mobile parity where specs or rules require it.
- Keep user-visible Portuguese copy consistent across platforms unless a plan explicitly narrows scope.
- Verify canonical paths before implementation; caller verification is not definition verification.

## Quality Gates

- DEVFLOW bootstrap MUST report whether this constitution was loaded.
- Planning and coding analysis MUST flag constitution conflicts as CRITICAL.
- Contract changes MUST pass the DEVFLOW contract gateway.
- Acceptance criteria and DoD verification MUST be independent from lint/tests.
- Mobile or visual changes MUST include explicit smoke/PO validation status when required by active rules.
- Release-impact work MUST record SQP evidence before C5 completion.

## Governance

This constitution supersedes local plans, tasks, rules, and anti-patterns when direct conflicts exist. Accepted ADRs may refine a principle for a specific context, but cannot silently weaken it.

Amendments require `/devflow planning` or an ADR with:

- reason for change
- affected principles
- migration or compatibility impact
- operator approval

**Version**: 0.1.0 | **Ratified**: 2026-05-31 | **Last Amended**: 2026-05-31
