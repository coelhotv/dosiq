# MetaSwarm Agent Instructions — Dosiq Project

This repository is configured for **MetaSwarm agent orchestration** integrated with **RTK (Rust Token Killer)** and project quality gates.

---

## 🛠️ Project Stack Summary

- **Core Framework:** React 19 + Vite 7 + TypeScript 5.9 (Monorepo)
- **State & Backend:** Supabase + Zod 4
- **Test Runner:** Vitest 4 (`@vitest/coverage-v8`)
- **Linter:** ESLint 9 (Flat config)
- **CI/CD:** GitHub Actions (`.github/workflows/test.yml`)
- **Package Manager:** `npm` (Node.js 22.x)

---

## 🚨 Essential Agent Constraints

1. **RTK Command Prefix:** Every terminal command **MUST** be prefixed with `rtk` (e.g. `rtk npm test`, `rtk eslint .`).
2. **No Self-Merge:** Agents do not self-merge PRs. Follow self-review → PR creation → AI review gate → User Approval.
3. **Mandatory Checklist:** Before modifying code or executing commands, provide a markdown checklist `[ ]`.
4. **Validation Required:** After code edits, always run validation via `rtk npm run validate:agent` or `rtk npm run test:critical`.
5. **Path Aliases & Imports:** Use proper `@shared`, `@features`, `@utils`, `@schemas` aliases. Ensure ESM extensions (`.js`) on relative server/api package exports where required by R-282.

---

## ⚡ Key Commands Quick Reference

| Command | Purpose |
|---------|---------|
| `rtk npm run validate:agent` | Critical test suite + quick check (10-min timeout safety) |
| `rtk npm run test:critical` | Runs critical services, schemas, and hooks tests |
| `rtk npm run test:coverage` | Runs full Vitest suite with V8 coverage report |
| `rtk npm run lint` | ESLint check and unit-label gate |
| `rtk bash .metaswarm/shims/run-swarm-check.sh` | MetaSwarm complete verification shim |

---

## 📁 MetaSwarm Architecture

- Configuration: `.metaswarm/config.json`
- Command Shims: `.metaswarm/shims/`
- Instructions: `METASWARM.md`
