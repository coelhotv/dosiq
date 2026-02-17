# Git Workflow - Meus Remédios

**Versão:** 1.0  
**Última Atualização:** 2026-02-17  
**Status:** Documento Oficial de Workflow

---

## ⚠️ Processo Obrigatório

**ALL code/documentation changes MUST follow this workflow exactly. NO exceptions.**

---

## 📋 Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANDATORY GITHUB WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣  CREATE BRANCH      (Never work on main!)                              │
│  2️⃣  MAKE CHANGES       (Follow all coding standards)                      │
│  3️⃣  VALIDATE LOCALLY   (Lint + Tests + Build)                             │
│  4️⃣  COMMIT             (Atomic commits, semantic messages)                │
│  5️⃣  PUSH BRANCH        (To origin)                                        │
│  6️⃣  CREATE PULL REQUEST (Use PR template)                                 │
│  7️⃣  WAIT FOR REVIEW    (Address all comments)                             │
│  8️⃣  MERGE & CLEANUP    (--no-ff, delete branch)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Steps

### 1. CREATE BRANCH (MANDATORY)

```bash
# Step 1: Always start from updated main
git checkout main
git pull origin main

# Step 2: Create branch with proper naming
git checkout -b feature/wave-X/nome-descritivo

# Naming conventions:
#   feature/wave-2/add-login          - New features
#   fix/wave-2/fix-login-error        - Bug fixes
#   docs/wave-2/update-api-docs       - Documentation
#   hotfix/security-patch             - Critical fixes
```

**⚠️ NEVER:**
- Work directly on `main`
- Commit to `main`
- Push to `main` without PR

---

### 2. MAKE CHANGES

- Edit files following:
  - [`docs/standards/CODE_PATTERNS.md`](./CODE_PATTERNS.md) - Coding standards
  - [`docs/architecture/OVERVIEW.md`](../architecture/OVERVIEW.md) - Architecture
- Keep changes focused and atomic
- One logical change per commit

---

### 3. VALIDATE LOCALLY (MANDATORY - ALL MUST PASS)

```bash
# Run ALL validations:
npm run lint          # Must have 0 errors
npm run test:critical # Essential tests must pass
npm run build         # Production build must succeed

# Or use the combined command:
npm run validate      # Runs lint + test
```

**If any validation fails:**
```bash
# 1. Fix all errors
# 2. Re-run validation
# 3. Only proceed when all pass
```

**⚠️ NEVER:**
- Skip validation
- Use `--no-verify` to bypass
- Commit with failing tests

---

### 4. COMMIT (Atomic / Semantic)

```bash
# Stage related files
git add src/components/MedicineForm.jsx
git add src/components/MedicineForm.css

# Commit with semantic message (in Portuguese)
git commit -m "feat(medicine): adicionar validação de dosagem"

# Format: type(scope): description
type = feat|fix|docs|test|refactor|style|chore
scope = component|service|api|test|docs|config
description = em português, minúsculas
```

#### Commit Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(dashboard): adicionar widget de adesão` |
| `fix` | Bug fix | `fix(service): corrigir cálculo de estoque` |
| `docs` | Documentation | `docs(api): atualizar documentação de endpoints` |
| `test` | Tests only | `test(service): adicionar testes de protocolo` |
| `refactor` | Refactoring | `refactor(hook): simplificar useCachedQuery` |
| `style` | Formatting | `style(lint): corrigir formatação` |
| `chore` | Maintenance | `chore(deps): atualizar dependências` |

---

### 5. PUSH BRANCH

```bash
git push origin feature/wave-X/nome-descritivo
```

---

### 6. CREATE PULL REQUEST (MANDATORY)

#### Using GitHub CLI

```bash
gh pr create --repo coelhotv/meus-remedios \
             --head feature/wave-X/nome-descritivo \
             --title "feat: descrição resumida" \
             --body-file docs/standards/PULL_REQUEST_TEMPLATE.md
```

#### Using GitHub Web

1. Go to: https://github.com/coelhotv/meus-remedios/pulls
2. Click "New Pull Request"
3. Select: `main` ← `feature/wave-X/nome-descritivo`
4. **USE TEMPLATE:** Copy from [`docs/standards/PULL_REQUEST_TEMPLATE.md`](./PULL_REQUEST_TEMPLATE.md)
5. Fill ALL sections:
   - **Summary:** What this PR does
   - **Tasks:** Checklist of completed items
   - **Metrics:** Performance/quality improvements
   - **Files:** List of changed files
   - **Checklist:** Code quality verifications
   - **Testing:** How to test
6. Assign reviewers
7. Link related issues (Closes #123)
8. Add appropriate labels

#### PR Title Format

```
feat(scope): brief description
fix(scope): brief description
docs(scope): brief description
```

---

### 7. WAIT FOR REVIEW

**During Review:**
- Respond to comments within 24 hours
- Make requested changes promptly
- Explain reasoning if you disagree (respectfully)
- Re-request review after making changes
- Address ALL comments before merging

**Review Checklist for Reviewers:**
- [ ] Code follows naming conventions
- [ ] Zod validation applied
- [ ] Tests added/updated
- [ ] No console.log debug statements
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Documentation updated (if needed)

---

### 8. MERGE & CLEANUP

**After PR Approval:**

```bash
# On GitHub:
# 1. Click "Merge pull request"
# 2. Select "Create a merge commit" (--no-ff)
# 3. Confirm merge

# Locally:
git checkout main
git pull origin main

# Delete branch
git branch -d feature/wave-X/nome-descritivo
git push origin --delete feature/wave-X/nome-descritivo
```

**⚠️ Merge Requirements:**
- All status checks pass (CI/CD)
- At least 1 approval from reviewer
- No unresolved comments
- Branch is up to date with main

---

## 🚫 Anti-Patterns (STRICTLY PROHIBITED)

| Anti-Pattern | Consequence | What To Do Instead |
|--------------|-------------|-------------------|
| Commit directly to `main` | Unreviewed code in production | Always create feature branch |
| Skip local validation | Broken builds in CI/CD | Run `npm run validate` before every push |
| Push without PR | No code review | Create PR using template |
| Use `--no-verify` | Bypass quality gates | Fix errors, don't bypass |
| Merge own PR | No quality assurance | Wait for reviewer approval |
| Large PRs (>500 lines) | Difficult review | Split into smaller PRs |
| Keep merged branches | Repository clutter | Delete immediately after merge |

---

## 🚨 Emergency Procedures

**Only for critical production issues:**

```bash
# ⚠️ REQUIRES human approval documented

# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-fix

# 2. Make minimal fix

# 3. Validate quickly
npm run lint && npm run test:critical

# 4. Commit with [HOTFIX] tag
git commit -m "hotfix: descrição da correção crítica"

# 5. Push and create PR with URGENT label
gh pr create --title "[HOTFIX] fix: descrição" --label urgent

# 6. Request immediate review

# 7. After merge, schedule post-incident review
```

**Post-Incident Requirements:**
1. Document what happened
2. Explain why normal process was bypassed
3. Schedule follow-up to prevent recurrence

---

## 📊 Workflow Summary Card

```
┌─────────────────────────────────────────────┐
│  BEFORE ANY CODE CHANGE:                    │
│  1. git checkout -b feature/wave-X/name     │
│                                             │
│  BEFORE COMMIT:                             │
│  2. npm run validate                        │
│                                             │
│  AFTER PUSH:                                │
│  3. Create PR with template                 │
│  4. Wait for review                         │
│  5. Merge with --no-ff                      │
│  6. Delete branch                           │
└─────────────────────────────────────────────┘
```

---

## 🔧 Git Commands Reference

### Common Operations

```bash
# Check current branch
git branch

# Check status
git status

# View uncommitted changes
git diff

# View commit history
git log --oneline -10

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes
git restore .
```

### Branch Management

```bash
# List all branches
git branch -a

# Delete local branch
git branch -d feature/my-branch

# Delete remote branch
git push origin --delete feature/my-branch

# Rename current branch
git branch -m new-name
```

---

## 🤝 Code Review Guidelines

### For PR Authors

1. **Self-review first** - Review your own diff before requesting review
2. **Write clear descriptions** - Explain what, why, and how
3. **Keep PRs focused** - One logical change per PR
4. **Respond promptly** - Address feedback within 24 hours
5. **Test locally** - Ensure all validations pass

### For Reviewers

1. **Be respectful** - Constructive feedback only
2. **Be specific** - Point to exact lines and suggest improvements
3. **Ask questions** - Don't assume, clarify intent
4. **Approve promptly** - Don't block unnecessarily
5. **Check thoroughly** - Lint, tests, logic, security

---

## 📚 Referências

- [Conventional Commits](https://www.conventionalcommits.org/)
- [`docs/standards/PULL_REQUEST_TEMPLATE.md`](./PULL_REQUEST_TEMPLATE.md) - Template de PR
- [`docs/standards/CODE_PATTERNS.md`](./CODE_PATTERNS.md) - Padrões de código
- [`docs/standards/TESTING.md`](./TESTING.md) - Guia de testes

---

*Última atualização: 2026-02-17 | v1.0*
