# DEVFLOW Memory Index

**Last Updated:** 2026-04-12  
**Total Entries:** 78 Anti-patterns + 108 Rules + 25 Decisions + 70 Knowledge items

---

## Recent Additions (Wave H4)

### AP-H04 — Monorepo workspace peer dependency mismatch
- **Path:** `anti-patterns_detail/AP-H04.md`
- **Incident:** 2026-04-12 — Vercel ERESOLVE failure on `apps/mobile` due to `react@19.0.0` vs `react-test-renderer@^19.2.5` conflict
- **Solution:** Update to `react@^19.2.5` (semver range, not exact version)
- **Applicable To:** Any new workspace package creation (npm monorepo)
- **Keywords:** ERESOLVE, dependency conflict, workspace, npm, mobile
- **Related Rule:** R-158

### R-158 — Monorepo workspace packages: use dependency ranges
- **Path:** `rules_detail/R-158.md`
- **Pattern:** Use semver ranges (`^X.Y.Z`) for shared libs, not exact versions (`X.Y.Z`)
- **Why:** Satisfies peer dependencies of dev tools without ERESOLVE conflicts
- **Introduced:** H4 Phase 4 (Mobile Scaffold)
- **Keywords:** dependency ranges, peer deps, workspace packages, npm
- **Related Anti-Pattern:** AP-H04

---

## Accessing Memory by Context

### 🏗️ **Building a New Workspace Package**
Start with:
1. Load R-158 (`rules_detail/R-158.md`) — dependency ranges best practice
2. Load AP-H04 (`anti-patterns_detail/AP-H04.md`) — what can go wrong
3. Check: `npm view <package> peerDependencies` before committing

### 🚀 **Vercel Deployment Failure on npm install**
If you see `ERESOLVE unable to resolve dependency tree`:
1. Load AP-H04 immediately
2. Check `package.json` in the workspace package that was just added
3. Identify exact versions of shared libs (`react`, `react-native`, etc.)
4. Bump to ranges to satisfy peer deps
5. Test: `npm install` locally before pushing

### 📱 **H4 Mobile Scaffold Context**
- Wave: H4 Phase 4
- Focus: Expo scaffold, platform bootstrap, minimal screens
- Key files: `apps/mobile/`, `metro.config.js`, `app.config.js`, `eas.json`
- Related memory: R-158 (dependency ranges), AP-H04 (ERESOLVE incident)

---

## File Locations

```
.agent/
├── memory/
│   ├── anti-patterns.json                      (index, compact)
│   ├── anti-patterns_detail/
│   │   ├── AP-H04.md                           (NEW — ERESOLVE conflict)
│   │   └── [AP-001 through AP-97, AP-W01-W25]
│   │
│   ├── rules.json                              (index, compact)
│   ├── rules_detail/
│   │   ├── R-158.md                            (NEW — dependency ranges)
│   │   └── [R-001 through R-157]
│   │
│   ├── decisions.json                          (ADRs — 25 entries)
│   ├── decisions_detail/
│   │   └── [ADR-001 through ADR-025]
│   │
│   ├── knowledge.json                          (domain facts — 70 entries)
│   ├── knowledge_detail/
│   │   └── [K-001 through K-070]
│   │
│   ├── journal/
│   │   └── 2026-W15.jsonl                      (current sprint)
│   └── MEMORY.md                               (this file — quick reference)
```

---

## Bootstrap Load Order (for Agents)

When `/devflow` is invoked:

1. **Always load (hot):** R-001 to R-050, AP-001 to AP-050 (universal guardrails)
2. **Load by context (warm):**
   - If goal contains "mobile" or "workspace": load R-158 + AP-H04
   - If goal contains "dependency": load R-158 + AP-H04 + related AP-NNNs
   - If stack includes "npm": load R-158 + AP-H04 + related rules
3. **Load on-demand (cold):** AP-001-057 (historical, archived patterns)

---

## For DEVFLOW Agents

When planning/implementing a new workspace package (like `apps/mobile`):

✅ **Pre-Code Checklist:**
- [ ] Read R-158 (dependency ranges best practice)
- [ ] Check AP-H04 (incident example)
- [ ] Verify `npm view <dev-tool> peerDependencies` for all test tools
- [ ] Use ranges for shared libs in package.json

✅ **Pre-Push Checklist:**
- [ ] `npm install` succeeds locally (ERESOLVE caught early)
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Vercel deployment preview URL accessible (no npm ERESOLVE)

---

## Keywords for Searching This Memory

- **ERESOLVE:** AP-H04 (unable to resolve dependency tree)
- **Peer deps:** R-158 (dependency ranges), AP-H04 (conflict example)
- **Workspace package:** R-158 (new packages), AP-H04 (common mistake)
- **npm conflict:** AP-H04 (incident on 2026-04-12)
- **Vercel failure:** AP-H04 (deployment ERESOLVE)
- **Mobile scaffold:** R-158 + AP-H04 (H4 context)

---

**Status:** Active  
**Last Distillation:** (pending journal compression)  
**Wave Context:** H0 (complete) → H1 (complete) → H2 (complete) → H3 (complete) → **H4 (in progress)**
