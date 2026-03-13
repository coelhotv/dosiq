# GitHub CLI (gh) — Code Review Guide

> Commands and workflows for managing Gemini Code Assist reviews using `gh` CLI.
> Compiled from Sprint 5.B/5.C debugging and troubleshooting.

---

## Quick Commands Reference

### Check PR Status
```bash
# View PR state and all status checks
gh pr view PR_NUMBER --json state,statusCheckRollup

# Example output:
# {"state":"MERGED","statusCheckRollup":[...]}
# state can be: OPEN, DRAFT, MERGED, CLOSED
```

### View PR Comments
```bash
# List all comments (Gemini suggestions appear here)
gh pr comments PR_NUMBER

# View raw API response with full details
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments

# Filter to specific reviewer (Gemini Code Assist)
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews
```

### View Inline Comments (Most Important)
```bash
# Get all inline review comments (these are the Gemini suggestions)
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments \
  --paginate \
  --jq '.[] | {path: .path, line: .line, body: .body, author: .user.login}'

# Example output:
# path: src/features/protocols/components/TreatmentWizard.jsx
# line: 305
# body: "Para manter a consistência... sugiro mover este estilo..."
# author: coelhotv-gemini-assist
```

### List Review Suggestions Clearly
```bash
# Get clean list of all comments with context
gh pr comments PR_NUMBER \
  --json author,body,createdAt \
  --template '{{range .}}
Author: {{.author.login}}
Date: {{.createdAt}}
Comment: {{.body}}
---
{{end}}'
```

### Check Which Checks are Passing/Failing
```bash
# View status of all checks (lint, tests, Gemini review, etc)
gh pr checks PR_NUMBER

# Example output:
# Lint               PASSED
# Smoke Tests        PASSED
# Detect Gemini Review    PASSED
# Gemini Code Review Parser  PASSED (with review suggestions posted)
```

### Get PR Details as JSON (Debugging)
```bash
# Full PR object (very verbose)
gh pr view PR_NUMBER --json

# Specific fields only
gh pr view PR_NUMBER --json \
  --jq '.title, .body, .state, .author, .createdAt, .updatedAt'
```

---

## Step 5 Workflow: From PR Creation to Merge

### 1️⃣ Create PR and Wait for Gemini

```bash
# Push branch
git push -u origin feature/fase-N/...

# Create PR
gh pr create \
  --title "feat(scope): clear title" \
  --body "Description of changes..."

# Get PR number (will be printed)
# Example: Created pull request #287

# Optionally view it
gh pr view 287 --web  # Opens in browser
```

### 2️⃣ Wait for Gemini to Post Suggestions (5–15 min)

Gemini Code Assist runs automatically. To check if review is complete:

```bash
# Check if Gemini has posted suggestions yet
gh pr comments 287

# Or check status checks
gh pr checks 287
# Look for: "Gemini Code Review Parser" status
```

### 3️⃣ Read Suggestions Clearly

When Gemini posts suggestions, they appear as comments. To read them:

```bash
# Method 1: View in browser (easiest)
gh pr view 287 --web
# Scroll down to read comments

# Method 2: CLI (structured output)
gh api repos/coelhotv/meus-remedios/pulls/287/comments \
  --jq '.[] | {
    line: .line,
    file: .path,
    author: .user.login,
    body: .body,
    severity: (if .body | contains("CRITICAL") then "CRITICAL" else "MEDIUM" end)
  }'

# Method 3: Simple text view
gh pr comments 287 --template '{{range .}}File: {{.body}}{{"\n---\n"}}{{end}}'
```

### 4️⃣ Evaluate Each Suggestion

Gemini typically posts 0–5 suggestions. Example from Sprint 5.B:

```
[Medium] Para manter a consistência do código...
sugiro mover este estilo para o arquivo TreatmentWizard.css

File: src/features/protocols/components/TreatmentWizard.jsx
Line: 305

Issue: Inline style <small style={{ color: '...', fontSize: '...' }}>
```

**Decision matrix:**
- **CRITICAL** (security, types, patterns) → Always apply
- **HIGH** (performance, accessibility) → Usually apply
- **MEDIUM** (style consistency, refactor suggestions) → Evaluate:
  - Makes sense for this project? → Apply
  - Unnecessary refactoring? → Skip
- **LOW** (comments, docs) → Optional

### 5️⃣ Apply Suggestions

For each suggestion you accept:

```bash
# 1. Make the change
# (Edit file, fix the issue, save)

# 2. Create NEW commit (don't amend if pushed!)
git add src/features/protocols/components/TreatmentWizard.jsx
git add src/features/protocols/components/TreatmentWizard.css
git commit -m "style(protocols): move inline styles to CSS class"

# 3. Push
git push

# This adds a new commit to the PR (visible to reviewers)
```

### 6️⃣ Request Re-Review

After applying suggestions, Gemini can re-review to confirm fixes:

```bash
# Comment on PR to trigger re-review
gh pr comment 287 --body "/gemini review"

# Wait for Gemini to re-check (another 5–15 min)

# Check if all issues resolved
gh pr comments 287
```

### 7️⃣ Wait for Human Approval

```bash
# Check if there are any blocks
gh pr checks 287

# Monitor PR status
gh pr view 287 --json state
# Should show: "state":"OPEN" with all checks passing

# Once human approves and you run `merge`, it's done!
```

---

## Common Debugging Scenarios

### Scenario 1: "Are There New Comments?"

```bash
# Check for comments after waiting
gh pr comments PR_NUMBER

# Count them
gh pr comments PR_NUMBER | wc -l

# Just show bodies (what Gemini actually said)
gh api repos/coelhotv/meus-remedios/pulls/PR_NUMBER/comments \
  --jq '.[] | .body'
```

### Scenario 2: "I Can't Find a Specific Comment"

```bash
# Search for comment by keyword (e.g., "inline style")
gh api repos/coelhotv/meus-remedios/pulls/PR_NUMBER/comments \
  --jq '.[] | select(.body | contains("inline")) | {path, line, body}'

# Or search in all PR reviews (including review comments vs PR comments)
gh api repos/coelhotv/meus-remedios/pulls/PR_NUMBER/reviews \
  --jq '.[] | {state: .state, body: .body}'
```

### Scenario 3: "Need to See File Changes"

```bash
# View all files changed in PR
gh pr view PR_NUMBER --json files --jq '.files[].path'

# View diff of specific file
gh pr diff PR_NUMBER -- src/features/x/file.jsx

# Count lines changed
gh pr diff PR_NUMBER | diffstat
```

### Scenario 4: "Check if Specific Check Passed"

```bash
# Get all checks
gh pr checks PR_NUMBER

# Filter to specific check (e.g., Lint)
gh pr checks PR_NUMBER | grep -i lint

# Parse as JSON
gh api repos/coelhotv/meus-remedios/pulls/PR_NUMBER \
  --jq '.statusCheckRollup[] | select(.name | contains("Lint")) | {name, conclusion}'
```

### Scenario 5: "When Did Gemini Comment?"

```bash
# Get comments with timestamps
gh api repos/coelhotv/meus-remedios/pulls/PR_NUMBER/comments \
  --jq '.[] | {
    author: .user.login,
    createdAt: .created_at,
    updatedAt: .updated_at,
    bodyPreview: (.body | .[0:100])
  }'

# Show in human-readable format
gh api repos/coelhotv/meus-remedios/pulls/PR_NUMBER/comments \
  --jq '.[] | "\(.user.login) @ \(.created_at): \(.body | .[0:50])"'
```

---

## Real Example: Sprint 5.B Review Process

```bash
# Created PR #287
gh pr create --title "fix(medications): encoding + autocomplete" \
  --body "..."

# Waited 10 min, then checked comments
gh pr comments 287
# Result: 1 Gemini comment (inline style suggestion)

# Viewed the suggestion clearly
gh api repos/coelhotv/meus-remedios/pulls/287/comments \
  --jq '.[] | {file: .path, line: .line, severity: "MEDIUM", body: .body}'

# Evaluated: style consistency → apply
# Made the fix
git add src/features/protocols/components/TreatmentWizard.jsx
git add src/features/protocols/components/TreatmentWizard.css
git commit -m "style(protocols): remove inline styles for CSS class"
git push

# Requested re-review
gh pr comment 287 --body "/gemini review"

# Checked status after 5 min
gh pr checks 287
# All passing: Lint ✅, Tests ✅, Gemini Review ✅

# Approved by user
# Merged
gh pr merge 287 --squash --delete-branch
```

---

## Useful Aliases (Add to .zshrc or .bashrc)

```bash
# PR comments (Gemini suggestions)
alias ghcomments='gh pr comments'

# PR checks status
alias ghchecks='gh pr checks'

# View PR in browser
alias ghweb='gh pr view --web'

# Get all PR comments as JSON
alias ghcommentsjson='gh api repos/coelhotv/meus-remedios/pulls/$(gh pr view --json number --jq .number)/comments'

# Usage:
# ghcomments 287
# ghchecks 287
# ghweb 287
```

---

## Troubleshooting

| Problem | Diagnosis | Solution |
|---------|-----------|----------|
| Can't see Gemini comments | Gemini might not have run yet | Wait 5–15 min, then `gh pr comments` |
| Comments seem old/stale | Might be from previous commits | Check `createdAt` timestamps with `--jq` |
| Don't know which file a comment refers to | Comments include `path` field | Use `--jq '.[] | {path, line, body}'` |
| Need to know if check passed or failed | Run `gh pr checks` | Look for ✅ PASSED or ❌ FAILED |
| Lost track of re-review | Gemini posts new comments on re-check | Compare timestamps before/after `/gemini review` |

---

## Working with gh in Scripts

```bash
# Get PR number from current branch
PR_NUM=$(gh pr view --json number --jq .number)

# Check if all checks passed
ALL_PASSED=$(gh pr checks $PR_NUM | grep -c PASSED)
if [ "$ALL_PASSED" -eq 7 ]; then echo "Ready to merge"; fi

# List all Gemini comments
gh api repos/coelhotv/meus-remedios/pulls/$PR_NUM/comments \
  --jq '.[] | select(.user.login | contains("gemini")) | .body'

# Auto-merge after all checks pass
if gh pr checks $PR_NUM | grep -q "FAILED"; then
  echo "Checks failed, cannot merge"
else
  gh pr merge $PR_NUM --squash --delete-branch
fi
```

---

## Key Learnings from Sprints 5.B & 5.C

1. **Always use `--jq` for parsing**: Makes output readable and scriptable
2. **`gh pr comments` vs `gh api .../comments`**: Former is human-readable, latter is scriptable
3. **Check timestamps**: When you push new commits, new comments appear. Use `createdAt` to distinguish batches.
4. **Gemini takes 5–15 min**: Don't poll every 30 seconds. Check after each push + 10 min wait.
5. **"All checks passing" includes Gemini**: Once Gemini review is posted, it's part of status checks.
6. **Re-review comment format**: Simple `/gemini review` comment triggers new scan (not a new PR, not a new comment).
7. **Commit messages matter**: After applying suggestions, make commit messages specific (`style(...): fix inline styles`), not vague (`fix`).

---

## Reference for Next Agent

When using deliver-sprint skill, Step 5 (Push & Code Review):

1. **After PR creation**: Wait 10 min, then `gh pr comments PR_NUMBER` to see if Gemini has posted
2. **To read suggestions clearly**: Use `gh api repos/.../pulls/PR_NUMBER/comments --jq` for structured output
3. **After applying each suggestion**: New commit, push, comment `/gemini review`
4. **Before merging**: `gh pr checks PR_NUMBER` must show all ✅
5. **After merge**: Use `git log --oneline` to confirm squashed commit on main

---

**Last Updated**: 2026-W11 (compiled from Sprint 5.B/5.C PR review cycles)
**Tested**: PR #287 (Sprint 5.B), PR #283 (Sprint 5.C)
**Status**: Reliable, documented workflow
