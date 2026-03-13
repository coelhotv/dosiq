# deliver-sprint Quick Checklist

**Print this or bookmark. Check off as you progress.**

---

## Step 1: Setup & Exploration (10–15 min)

- [ ] Read `plans/EXEC_SPEC_FASE_N.md` completely
- [ ] Extracted: deliverables, target files, success criteria
- [ ] Ran: `find src -name "*TargetFile*"` (check for duplicates)
- [ ] Ran: `grep -r "from.*TargetFile" src/` (check imports)
- [ ] Explored base patterns (existing component/service)
- [ ] Created branch: `git checkout -b feature/fase-N/...` or `fix/NN/...`
- [ ] Confirmed path aliases in `vite.config.js`

---

## Step 2: Implementation (45–60 min)

**Order of changes:**
- [ ] Schemas first (`src/schemas/`)
- [ ] Services (`src/features/*/services/`)
- [ ] Components (`src/features/*/components/`)
- [ ] Views (`src/views/`)
- [ ] Tests (`__tests__/`)
- [ ] Styles (`.css`)

**During implementation:**
- [ ] Hook order correct: States → Memos → Effects → Handlers → Guard clauses
- [ ] Using `parseLocalDate()` for dates (NEVER `new Date('YYYY-MM-DD')`)
- [ ] Zod enums in PORTUGUESE
- [ ] Nullable fields: `.nullable().optional()` (NOT just `.optional()`)
- [ ] No inline styles: extract to CSS classes
- [ ] No `console.error` left in code
- [ ] Imports using path aliases (`@features`, not `../../../`)

---

## Step 3: Validation (10 min)

- [ ] Ran: `npm run validate:agent` (10 min timeout)
- [ ] Result: ✅ All tests passing (473+ critical)
- [ ] Result: ✅ 0 lint errors
- [ ] Result: ✅ Build succeeds

**If failed:**
- [ ] Ran detailed debug: `npm run test:changed -- --reporter=verbose`
- [ ] Fixed issues
- [ ] Re-ran `validate:agent`

---

## Step 4: Git & Documentation (5 min)

- [ ] Checked for new learning: `echo "Did I discover a pattern or anti-pattern?"`
- [ ] Updated `.memory/rules.md` if new pattern (added R-NNN entry)
- [ ] Updated `.memory/anti-patterns.md` if new anti-pattern (added AP-NNN entry)
- [ ] Ran: `git status` (no .env, node_modules, or temp files)
- [ ] Staged selectively: `git add src/features/x/...` (NOT `git add .`)
- [ ] Made 1–2 semantic commits:
  - [ ] `git commit -m "feat(scope): description"` OR
  - [ ] `git commit -m "fix(scope): description"`
- [ ] Updated `plans/EXEC_SPEC_FASE_N.md` if scope changed

---

## Step 5: Push & Code Review (20–30 min)

- [ ] Ran: `git push -u origin feature/fase-N/...`
- [ ] Created PR via: `gh pr create --title "..." --body "..."`
- [ ] PR includes: summary, changes, checklist, test plan
- [ ] Awaited Gemini Code Assist bot (5–15 min)
- [ ] **Evaluated suggestions**: Does each make sense?
  - [ ] If refactor-only: ❌ ignore
  - [ ] If style (inline CSS → class): ✅ apply
  - [ ] If security/pattern: ✅ apply
- [ ] Applied approved suggestions: `git commit -m "style(...):"` + `git push`
- [ ] Re-requested review if changed: commented `/gemini review`
- [ ] Awaited human approval

---

## Step 6: Merge (5 min)

- [ ] Approved by user (human review done)
- [ ] Ran: `gh pr merge PR_NUMBER --squash --delete-branch`
  - OR did manual merge (see SKILL.md Step 6)
- [ ] Verified: `git log --oneline -5` shows squashed commit on main
- [ ] Verified: `git pull origin main` (main in sync)

---

## Step 7: Final Documentation (10 min)

- [ ] Updated `plans/EXEC_SPEC_FASE_N.md`:
  - [ ] Marked deliverables as ✅
  - [ ] Added commit hash
  - [ ] Updated progress % (or marked 100% if final)
- [ ] Created `.memory/journal/YYYY-WWW.md` with:
  - [ ] Deliverables list
  - [ ] Quality metrics (473/473 tests, 0 lint errors)
  - [ ] Commit hash
  - [ ] Key learnings (rules + anti-patterns discovered)
  - [ ] Timeline breakdown (setup, impl, validation, etc)
- [ ] Updated `.memory/MEMORY.md`:
  - [ ] Added "## Sprint N.X — [Title]" entry
  - [ ] Listed key facts (commit, quality gate, date)
- [ ] Closed GitHub issues (if any created by Gemini):
  - [ ] `gh issue close ISSUE_NUM -c "Resolved in {hash} — brief note"`

---

## Success Criteria ✅

- [ ] PR approved (< 5 suggestions, all addressed)
- [ ] Tests: 473/473+ passing
- [ ] Lint: 0 errors
- [ ] Commit: cleanly squashed on main
- [ ] Docs: spec + journal + memory updated
- [ ] Time: < 2 hours (start to merge)

---

## Timeline Benchmark

| Step | Time |
|-------|------|
| 1. Setup | 10–15 min |
| 2. Implementation | 45–60 min |
| 3. Validation | 10 min |
| 4. Git & Docs | 5 min |
| 5. Push & Review | 20–30 min |
| 6. Merge | 5 min |
| 7. Final Docs | 10 min |
| **TOTAL** | **105–135 min** |

---

## Anti-Patterns to Avoid (Hard Stops)

- ❌ `new Date('YYYY-MM-DD')` → Use `parseLocalDate()`
- ❌ `.optional()` for nullable → Use `.nullable().optional()`
- ❌ Inline styles `style={{}}` → Use CSS classes
- ❌ Guard clauses before hooks → Move after all hooks
- ❌ Mocks after imports → Mocks at TOP of test file
- ❌ `setTimeout` in `act()` → Use `waitFor()`
- ❌ `git add .` → Stage selectively: `git add src/...`
- ❌ Push without `validate:agent` → Always run before push

---

## Getting Unstuck

| Issue | Command |
|-------|---------|
| "Which files changed?" | `git diff --name-only` |
| "Test failing, need details" | `npm run test:changed -- --reporter=verbose` |
| "Lint says what?" | `npm run lint` (then read message) |
| "Need to unstage file" | `git restore --staged src/file.js` |
| "Oops, wrong commit message" | DON'T amend; make new commit |
| "PR has conflicts" | `git pull origin feature-branch --rebase` |

---

**Compiled from**: Sprints 5.A, 5.B, 5.C (2026-W10, 2026-W11)
**Last Updated**: 2026-W11
**Status**: Battle-tested, production ready
