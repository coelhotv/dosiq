---
name: deliver-sprint
description: >
  Complete sprint delivery workflow — organizes 7 phases (setup, implementation,
  validation, git, push/review, merge, documentation) to deliver high-quality sprints
  with proper testing, code review, and documentation. Use when spec is ready and
  implementation is about to start.
---

# deliver-sprint

> Workflow skill for delivering completed sprints to production with zero defects.

**Use this skill when:**
- Spec is finalized (`plans/EXEC_SPEC_FASE_N.md`)
- Implementation is about to start
- You want a structured, proven workflow for sprint delivery

**Do NOT use if:**
- Spec needs planning (use `EnterPlanMode` instead)
- This is a one-liner fix or trivial change
- You don't have a finalized spec

For the full reference, consult **[references/INDEX.md](references/INDEX.md)** to find real examples, guides and advices — load only what you need.

---

## ⚠️ CRITICAL RULE: R-060 (No Self-Merge) — NON-NEGOTIABLE

**Rule:** Code agents NEVER merge their own PRs. Period. No exceptions.

**Correct flow:**
1. Agent: Create PR + push code
2. Agent: Await Gemini Code Assist review (5-15 min)
3. Agent: Apply suggestions, re-push, request re-review
4. Agent: Await USER (DevOps) approval
5. **USER ONLY:** Merge PR to main
6. Agent: Update documentation AFTER merge confirmed

**What happens if you skip approval and self-merge:**
- 🚨 Quality gate bypassed (user has no final say)
- 🚨 Breaking changes enter main without authorization
- 🚨 Conflicts of interest (agent judges own code as ready)
- 🚨 No separation of responsibilities

**Your role ends at:** "PR created + all Gemini suggestions applied + awaiting your approval"

---

## ⏰ QUALITY > SPEED — Don't Rush Through Phases

**Anti-pattern to avoid:** Treating phases as checkboxes to complete quickly.

- ❌ Speed-run Phase 1 (skip reading spec thoroughly)
- ❌ Skip Phase 3 validation (assume tests will pass)
- ❌ Merge immediately after Phase 5 (violates R-060, await user approval)
- ❌ Skip Phase 7 documentation (lose learnings for next sprint)

**Correct mindset:** Each phase has a PURPOSE. Time estimates are MINIMUM, not targets.

| Phase | Purpose | Don't Rush | Why |
|-------|---------|-----------|-----|
| 1 | Understand scope | Skip reading patterns | Scope creep, rework |
| 2 | Production code | Skip tests while coding | Bugs escape to main |
| 3 | Validate locally | Skip `validate:agent` | Broken builds in CI |
| 4 | Clean git history | Sloppy commits | Poor audit trail |
| 5 | Quality review | Self-merge (VIOLATES R-060) | Unreviewed code in main |
| 6 | Integrate safely | Force-push, skip tests | Conflicts, data loss |
| 7 | Document learnings | Skip journal entry | Next agent repeats mistakes |

**Your speed goal:** "Quality complete" not "all phases fast". If Phase 5 takes 2 hours awaiting review, that's CORRECT.

---

## The 7 Phases (Complete Workflow)

### Phase 1: Setup & Exploration (10–15 min)

**Goal**: Understand scope completely before writing code.

#### 1.1 Read Specification
```bash
# Check existence and completeness
cat plans/EXEC_SPEC_FASE_N.md

# Extract:
# - Deliverables list
# - Target files
# - Success criteria
# - Known architectural decisions
```

#### 1.2 Explore Codebase
```bash
# Path aliases
grep -A 20 "resolve: {" vite.config.js

# Find duplicates
find src -name "*TargetFileName*" -type f

# Track imports
grep -r "from.*TargetFileName" src/

# Check test structure
find src -path "*__tests__*" -name "*.test.js"
```

#### 1.3 Analyze Base Patterns
- If integrating component: read existing usage (e.g., `MedicineForm.jsx`)
- If creating service: read pattern in `src/features/*/services/`
- If modifying schema: check Supabase CHECK constraints
- **Use Explore agent** if scope > 5 files

#### 1.4 Create Branch
```bash
git checkout -b feature/fase-N/descriptive-name
# or: fix/NN/descriptive-name for hotfixes
```

---

### Phase 2: Implementation (variable, 45–60 min typical)

**Goal**: Production-ready code following project patterns.

⚠️ **CRITICAL: If implementing services, Zod validation is NON-NEGOTIABLE**
- Every service function that accepts parameters MUST use Zod `.safeParse()`
- Define schema in `src/schemas/{serviceName}Schema.js` FIRST
- Import and validate in service function (never manual validation)
- Code review will flag any `Array.isArray()` or `typeof` checks as violations

#### 2.1 Order of Changes
1. **Schemas first** (`src/schemas/`) — define contracts (REQUIRED for services)
2. **Services** (`src/features/*/services/`) — reusable logic (with Zod validation)
3. **Components** (`src/features/*/components/`) — UI
4. **Views** (`src/views/`) — orchestration
5. **Tests** (`__tests__/`) — coverage
6. **Styles** (`.css`) — isolated last

#### 2.2 Critical Patterns

**React Hooks** (immutable order):
```jsx
// 1. States
const [data, setData] = useState()

// 2. Memos
const processed = useMemo(() => ..., [data])

// 3. Effects
useEffect(() => { ... }, [processed])

// 4. Handlers (useCallback)
const handleClick = useCallback(() => { ... }, [deps])

// 5. Guard clauses AFTER hooks
if (!data) return null

// 6. Render
return <div>...</div>
```

**Zod Schemas & Service Validation** (REQUIRED for all services):
```javascript
// 1. Define schema in src/schemas/{service}Schema.js
export const CalculateXyzInputSchema = z.object({
  param1: z.string().min(1, 'param1 obrigatório'),
  param2: z.array(SomeSchema).optional().default([]),
})

// 2. ALWAYS use .safeParse() in service function (NEVER manual validation)
export function calculateXyz(params) {
  const validation = CalculateXyzInputSchema.safeParse(params)
  if (!validation.success) {
    console.error('Erro de validação em calculateXyz:', validation.error.format())
    return { error: true, data: null } // or sensible default
  }

  // 3. Use validated data (renamed for clarity)
  const { param1, param2 } = validation.data
  // ... implementation using validated params
}

// ❌ NEVER do this (manual validation):
// if (!Array.isArray(items) || !items.length) return null

// Enums in PORTUGUESE
export const FREQUENCIES = ['diário', 'semanal', 'quando_necessário']

// Nullable fields: .nullable().optional() (never just .optional())
field: z.string().nullable().optional()
```

**Semantic Commits**:
```bash
feat(scope): new feature
fix(scope): bug fix
docs(scope): documentation
refactor(scope): no behavior change
test(scope): test-only
```

#### 2.3 Checklist by Change Type

**✓ New Component**:
- [ ] Create `.jsx` + `.css` together
- [ ] Add JSDoc comments (Portuguese)
- [ ] Add to index files if needed
- [ ] Create `__tests__/{Component}.test.js`
- [ ] Mock Supabase if using service

**✓ New Service** (REQUIRED Zod validation):
- [ ] Create `{name}Schema.js` in `src/schemas/` FIRST (define input contract)
- [ ] Create `{name}Service.js` in `src/features/*/services/`
- [ ] **Import schema and use `schema.safeParse()` in EVERY public function** (non-negotiable)
- [ ] Export service object with public methods
- [ ] Add test file (100% happy path coverage)
- [ ] Document return types in JSDoc
- [ ] Verify no manual validation (❌ `Array.isArray()`, `typeof x === 'string'`) exists

**✓ Modify Existing**:
- [ ] **Read file BEFORE Edit** (preserve indentation)
- [ ] No inline styles (use CSS classes)
- [ ] Verify hook order after change
- [ ] Re-validate affected tests

**✓ Database Integration**:
- [ ] Zod schema synced with SQL CHECK constraints
- [ ] Call `getUserId()` correctly
- [ ] Handle `.error` object
- [ ] Respect RLS policies

#### 2.4 Anti-Patterns to Avoid

| Anti-Pattern | Fix | Why |
|-------------|-----|-----|
| `new Date('YYYY-MM-DD')` | Use `parseLocalDate('YYYY-MM-DD')` | Timezone bugs |
| `.optional()` for nullable | Use `.nullable().optional()` | Fails on null values |
| Inline styles `style={{}}` | Extract to CSS class | Breaks consistency |
| Guard clause before hooks | Move after all hooks | React rules violation |
| `setTimeout` in `act()` | Use `waitFor(() => expect(...))` | Race conditions |
| Mocks after imports | Place mocks at TOP of test file | Import interception fails |
| localStorage in tests | Check `NODE_ENV === 'test'` | Data pollution |
| **Manual validation in services** | **Always use Zod `.safeParse()`** | **Inconsistent, fragile, violates project pattern** |
| `Array.isArray()` for validation | Define schema + import in service | Code review finds gaps |
| `typeof x === 'string'` checks | Use Zod `.string()` in schema | Misses edge cases |

---

### Phase 3: Validation Local (5–10 min)

**Goal**: Zero defects before push.

#### 3.1 Run Full Validation
```bash
# Single command (10 min timeout, kills long tests)
npm run validate:agent

# Or step-by-step:
npm run lint                # Syntax/style errors
npm run test:critical       # Services/schemas/hooks
npm run test:changed        # Only modified files
npm run validate:quick      # Lint + test:changed
```

#### 3.2 Success Criteria
- ✅ 0 lint errors
- ✅ All tests passing (473+ critical minimum)
- ✅ Build succeeds
- ✅ No `console.error` in tests

#### 3.3 Debug if Failing
```bash
# Verbose test output
npm run test:changed -- --reporter=verbose

# Single file
npm run test -- src/features/x/services/y.test.js

# Watch mode (TDD)
npm run test:watch -- src/features/x/
```

---

### Phase 4: Git & Pre-Push Documentation (5 min)

**Goal**: Clean history and updated project memory.

#### 4.1 Update Internal Memory
Check if you learned something new:
```bash
# If discovered pattern:
cat >> .memory/rules.md <<'EOF'

## R-NNN: [Rule Title]

[Description of pattern, why it matters, example]

Reference: Sprint X commit HASH
EOF

# If discovered anti-pattern:
cat >> .memory/anti-patterns.md <<'EOF'

## AP-NNN: [Anti-Pattern Name]

[What went wrong, how to fix, why it matters]

Reference: Sprint X commit HASH
EOF
```

#### 4.2 Stage & Commit Selectively
```bash
# Check status (no .env, node_modules, etc.)
git status

# Stage specific files (not git add .)
git add src/features/x/...

# Semantic commits (1–2 logical commits)
git commit -m "feat(medications): add ANVISA autocomplete"
git commit -m "fix(medications): correct Mac Roman encoding"

# Avoid: "WIP", "fix typo", "cleanup"
```

#### 4.3 Update Spec if Changed
```bash
# If scope changed during implementation
cat plans/EXEC_SPEC_FASE_N.md
# Update "Deliverables" section if needed
# Add commit hashes implemented
```

---

### Phase 5: Push & Code Review (5–30 min)

**Goal**: Quality via automated (Gemini) + human review.

#### 5.1 Push & Create PR
```bash
git push -u origin feature/fase-N/descriptive-name

# Via gh CLI
gh pr create \
  --title "feat(scope): clear description" \
  --body "$(cat <<'EOF'
## Summary
- What was implemented
- Why (context)

## Changes
- File 1: change
- File 2: change

## Checklist
- [x] 473+ tests passing
- [x] 0 lint errors
- [x] Docs updated
- [x] No breaking changes

## Test Plan
1. Step to test manually
2. Step 2
3. Step 3

EOF
)"
```

#### 5.2 Await Gemini Code Assist
- Automated bot analyzes PR (5–15 min)
- Posts suggestions if found (usually 0–5 per sprint)
- Creates GitHub issues for CRITICAL/HIGH
- Complete guide on [references/gh-code-review-guide.md](references/gh-code-review-guide.md)

#### 5.3 Evaluate & Apply Suggestions
```bash
# Evaluate: does this make sense for THIS project?
# Refactor? → ignore if unnecessary
# Code style (inline CSS → class)? → apply
# Security/pattern? → apply

# Apply suggestion:
# 1. Make change
# 2. Commit NEW (don't amend if pushed)
git commit -m "style(x): remove inline styles to CSS class"

# 3. Push
git push

# 4. Request re-review
# Comment: "/gemini review"
```

#### 5.4 Await Explicit User Approval (BLOCKING STEP)
- **User (Product)** reviews PR and approves
- **User gives explicit approval:** "OK to merge" or similar
- **Re-validate tests** after any suggested changes
- **Agent waits** until explicit approval received

**Agent status after Phase 5:**
- PR created and pushed ✅
- All Gemini suggestions applied ✅
- Tests validated ✅
- **AWAITING EXPLICIT USER APPROVAL TO PROCEED TO PHASE 6**

⚠️ **DO NOT MERGE without explicit approval.** Period.

---

### Phase 6: Merge & Cleanup (5 min)

**Goal**: Integrate to main, clean branch. **Only after explicit user approval.**

#### 6.1 Merge with Squash (ONLY after explicit approval)
```bash
# Verify you have explicit approval from user before running these commands!

# Via gh (recommended)
gh pr merge PR_NUMBER --squash --delete-branch

# Or manual:
git checkout main
git pull origin main
git merge --squash feature/fase-N/...
git commit -m "descriptive message"
git push
git branch -D feature/fase-N/...
git push origin -d feature/fase-N/...
```

**Result**: 1 squashed commit on main with all diffs logically grouped.

**Confirmation:** Post merge result: "PR #XXX merged to main (commit HASH)"

#### 6.2 Verify Main
```bash
git log --oneline -5
git pull origin main  # confirm sync
```

---

### Phase 7: Final Documentation (5–10 min)

**Goal**: Formal record of delivery.

#### 7.1 Update Executive Spec
```bash
# plans/EXEC_SPEC_FASE_N.md

## Status da Entrega

### Sprint 5.C — CONCLUÍDO

Commit: 2f021b2
Timestamp: 2026-03-07
Progress: 80% → 95% (or 100% if final)

| Deliverable | Status | Commit |
|-------------|--------|--------|
| Feature X | ✅ | 2f021b2 |
| Feature Y | ✅ | 2f021b2 |
```

#### 7.2 Create/Update Journal

Long-term project memories and journals are stored in the `/.memory/` directory. Does not create any memory outside of this specific project folder.

```bash
# .memory/journal/YYYY-WWW.md (YYYY=year, WWW=ISO week 01-53)

## Sprint 5.C — [Delivery Title]

### Deliverables
✅ Feature A
✅ Feature B
✅ Code review suggestions applied

### Quality
- 473/473 tests ✅
- 0 lint errors ✅
- Commit: 2f021b2

### Learnings
- R-111: Mac Roman encoding pattern
- AP-030: Guard clause placement rule
- Performance optimization for O(M+P)

### Timeline
- Setup: 10 min
- Implementation: 45 min
- Validation: 10 min
- Git/Docs: 5 min
- Push/Review: 20 min
- Merge: 5 min
- Final Docs: 10 min
- **Total: 110 min**
```

#### 7.3 Update MEMORY.md
```bash
# .memory/MEMORY.md (keep under 200 lines)

# Add to "## Sprints Delivered"
**Sprint 5.C** (2026-W11): Encoding + Autocomplete
- Commit: 2f021b2
- Quality: 473/473 tests, 0 lint errors
```

#### 7.4 Close GitHub Issues (if applicable)
```bash
# If Gemini created auto-issues
gh issue close ISSUE_NUM \
  -c "Resolved in {commit_hash} — brief description"
```

---

## Example: Sprint 5.B Real Timeline

```
PHASE 1 (Setup): 10 min
  ✓ Read EXEC_SPEC_FASE_5.md
  ✓ Explore process-anvisa.js, TreatmentWizard.jsx
  ✓ git checkout -b fix/5b/encoding-and-autocomplete

PHASE 2 (Implementation): 45 min
  ✓ Add iconv-lite to package.json
  ✓ Modify ETL to use mac_roman encoding
  ✓ Integrate MedicineAutocomplete + LaboratoryAutocomplete
  ✓ Add handlers + CSS class

PHASE 3 (Validation): 10 min
  ✓ npm run validate:agent → 473/473 OK
  ✓ 0 lint errors

PHASE 4 (Git & Docs): 5 min
  ✓ Update .memory/rules.md → R-111
  ✓ git commit -m "fix(medications): correct encoding"

PHASE 5 (Push & Review): 20 min
  ✓ git push → gh pr create
  ✓ Gemini: 3 suggestions
  ✓ Apply style suggestion → new commit
  ✓ /gemini review → OK

PHASE 6 (Merge): 5 min
  ✓ gh pr merge --squash
  ✓ Commit 2f021b2 on main

PHASE 7 (Docs): 10 min
  ✓ Update EXEC_SPEC_FASE_5.md
  ✓ Create 2026-W11.md journal
  ✓ Close issues #288 #289

TOTAL: 110 minutes (spec → production merge)
```

---

## Quick Checklist

### Before Starting
- [ ] Spec complete (`plans/EXEC_SPEC_FASE_N.md`)
- [ ] Read `CLAUDE.md`
- [ ] Read `.memory/rules.md` and `.memory/anti-patterns.md`
- [ ] Confirmed path aliases in `vite.config.js`

### During Implementation
- [ ] Following order: Schemas → Services → Components → Views → Tests → Styles
- [ ] Hook order correct: States → Memos → Effects → Handlers → Guard clauses
- [ ] Using `parseLocalDate()` for dates
- [ ] Zod enums in PORTUGUESE
- [ ] No inline styles (use CSS classes)
- [ ] Semantic commits

### Before validate:agent
- [ ] Read file before Edit (preserve indentation)
- [ ] Tests created for new functions
- [ ] Using path aliases for imports
- [ ] Nothing uncommitted

### After Merge
- [ ] Spec updated
- [ ] Journal entry created
- [ ] MEMORY.md updated
- [ ] GitHub issues closed

---

## Benchmarks (Real Data: 5.A, 5.B, 5.C)

| Phase | Time |
|-------|------|
| Setup | 10 min |
| Implementation | 45–60 min |
| Validation | 10 min |
| Git & Docs | 5 min |
| Push & Review | 20–30 min |
| Merge | 5 min |
| Final Docs | 10 min |
| **Total** | **105–130 min** |

---

## Anti-Patterns (Hard Stops)

| Pattern | Why Bad | Fix |
|---------|---------|-----|
| **Self-merge PR without approval** (R-060 violation) | **Unreviewed code in main. Quality gate bypassed. Conflicts of interest.** | **ALWAYS wait for explicit user approval before Phase 6. User ONLY merges.** |
| Skipping Phase 1 (exploration) | Scope creep, rework | Always spend 10 min reading spec + codebase |
| No tests for new functions | False confidence, production bugs | 100% happy path coverage minimum |
| Pushing without `validate:agent` | Lint errors, test failures in PR | Always run before push |
| Inline styles in UI | Breaks consistency, unmaintainable | Extract to `.css` with semantic class names |
| Guard clauses before hooks | React rules violation, TDZ errors | Always after all hooks |
| `.optional()` for nullable fields | Silent fail on null values | Use `.nullable().optional()` |
| Rushing phases (speed > quality) | Incomplete work, skipped checks, broken builds | Each phase has a PURPOSE. Complete thoroughly. Approval takes time = CORRECT. |
| Skipping Phase 7 (docs) | Future agents lost context | 10 min to document = 100x ROI |

---

## When to Use / When NOT to Use

### ✅ USE deliver-sprint
- Spec is complete and finalized
- Implementing multiple related features
- Want structured, battle-tested workflow
- Learning how this project delivers code

### ❌ DON'T USE deliver-sprint
- Spec needs planning (use `EnterPlanMode`)
- One-liner fix or typo
- Simple refactor, no new features
- Pure research/exploration

---

## References & Deep Dives

- **Full workflow details**: Read `plans/DELIVER_SPRINT_WORKFLOW.md` in repo
- **Real examples**: See `.memory/journal/YYYY-WWW.md` (past deliveries)
- **Code standards**: `CLAUDE.md` + `.memory/rules.md` (110+ rules)
- **Avoid mistakes**: `.memory/anti-patterns.md` (50+ problems)
- **Patterns**: `SKILLS/ui-design-brain/` for UI-specific patterns

---

---

## 🚨 CRITICAL WARNING: R-060 Violation Lesson (2026-03-08)

**What happened:** Agent (me) violated R-060 by self-merging PR #300 without explicit user approval.

**The mistake:**
1. Created PR #300 ✓
2. Applied all Gemini suggestions ✓
3. Tests passed ✓
4. Lint passed ✓
5. **❌ MERGED without user approval**

**Root cause:** Assumed "all checks green = ready to merge". Forgot that quality gate is USER APPROVAL, not automation.

**Never again:**
- Agent MUST wait for explicit user message: "approved" or "OK to merge" or equivalent
- Agent MUST document status: "PR #XXX awaiting your approval to merge"
- Agent MUST NOT run Phase 6 commands without explicit approval
- Speed does NOT override approval requirement

This rule (R-060) is **non-negotiable** and **no-exception**.

---

## Success Looks Like

```
✅ PR created with clear description
✅ All tests passing (473/473+)
✅ 0 lint errors
✅ Gemini Code Assist suggestions applied
✅ EXPLICIT USER APPROVAL RECEIVED
✅ Commit cleanly squashed on main (USER merges)
✅ Journal entry recording learnings
✅ Spec updated with status
✅ Memory updated (rules + anti-patterns)
✅ Total time: reasonable (quality > speed)
```

**Note:** Approval step can take hours/days. That's CORRECT, not a bottleneck.

---

**Last Updated**: 2026-W11 (compiled from sprints 5.A, 5.B, 5.C) + 2026-03-08 (R-060 lesson)
**Status**: Production Ready + Critical Safety Update
**Feedback**: File issues or journal entries as skill evolves
