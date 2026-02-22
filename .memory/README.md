# Agent Memory System

> Tool-agnostic long-term memory for AI agents working on this project.
> Works with Claude Code, Roo Code, Kilo Code, Gemini, or any AI agent.

## Directory Structure

```
.memory/
├── README.md          # This file — how the system works
├── rules.md           # Graduated rules (the "brain") — R-NNN numbered
├── knowledge.md       # Domain facts, component APIs, static patterns
├── anti-patterns.md   # Mistake prevention table — AP-NNN numbered
└── journal/           # Chronological session entries (weekly files)
    ├── 2026-WNN.md    # Current week's observations
    └── archive-*.md   # Compressed summaries of old entries
```

## Session Protocol

### Session Start (READ)

Read in this order — stop when you have enough context:

```
1. AGENTS.md                          → Project identity, routing table, commands
2. .memory/rules.md                   → Graduated rules (ALWAYS read)
3. .memory/anti-patterns.md           → What NOT to do (ALWAYS read)
4. .memory/knowledge.md               → Domain facts (read relevant sections)
5. .memory/journal/[current-week].md  → Recent context (if exists)
```

Do NOT read archived journals at session start. The graduated rules already contain their distilled wisdom.

### Session End (WRITE)

```
IF significant learnings occurred:
  1. Append entry to .memory/journal/[current-week].md
  2. Use the Journal Entry Format below
  3. Tag rule candidates explicitly with RULE: or ANTI-PATTERN:

IF a rule candidate is clearly validated (2+ occurrences OR severity=CRITICAL):
  1. Graduate directly to rules.md or anti-patterns.md
  2. Mark journal entry as [GRADUATED]

IF nothing new was learned (routine task, no surprises):
  → Skip memory write entirely. No noise entries.
```

## Entry Formats

### Journal Entry (journal/2026-WNN.md)

```markdown
### YYYY-MM-DD HH:MM — [Short Title]
**Type:** BUG-FIX | FEATURE | REFACTOR | CONFIG | DISCOVERY
**Files:** `path/file1.js`, `path/file2.jsx`
**Status:** [ACTIVE] | [GRADUATED] | [SUPERSEDED by YYYY-MM-DD]

**Context:** 1-2 sentences of what was being done and why.

**Outcome:**
- What changed (bullet per file, one line each)

**Root Cause** *(if debug)*:
- Symptom: [what was observed]
- Cause: [why it happened]
- Fix: [what was done]

**Rule Candidates:**
- RULE: [If X, then always Y]
- ANTI-PATTERN: [Never do X because Y]
- KNOWLEDGE: [Static fact about the project]
```

### Graduated Rule (rules.md)

```markdown
### R-NNN: [Title] [CRITICAL|HIGH|MEDIUM]
**Rule:** If [condition], then [action]. Never [anti-action].
**Source:** journal/2026-WNN
**Example:**
\`\`\`code
// Correct
...
// Wrong
...
\`\`\`
```

### Anti-Pattern (anti-patterns.md)

```markdown
| AP-NNN | Anti-Pattern | Consequence | Prevention | Source |
```

## Graduation Mechanism

### When to Graduate

- **Recurrence:** Same lesson appears in 2+ journal entries
- **Severity:** A CRITICAL bug was caused — graduate immediately
- **User request:** User says "graduate this" or "remember this permanently"

### Graduation Steps

1. Search `rules.md` for duplicate/conflicting rules (deduplication)
2. If new → assign next R-NNN, add to appropriate category
3. If strengthens existing → update with additional context/examples
4. If anti-pattern → add AP-NNN row to `anti-patterns.md`
5. If domain fact → update relevant section in `knowledge.md`
6. Mark journal entry status as `[GRADUATED]`

## Maintenance

### Weekly (automatic during session start)
- If previous week's journal has un-graduated RULE-CANDIDATE entries, flag them

### Monthly (when rules.md exceeds 300 lines)
- Merge duplicate rules
- Archive rules that tooling now enforces automatically (e.g., ESLint)
- Update knowledge.md for project evolution

### Quarterly (triggered by user)
- Compress old journal files into archive summaries
- Audit cross-references between rules and anti-patterns

### Size Guardrails

| File | Warning | Action |
|------|---------|--------|
| `rules.md` | > 300 lines | Merge/archive stale rules |
| `knowledge.md` | > 400 lines | Move details to docs/, link |
| `anti-patterns.md` | > 200 lines | Archive automated entries |
| `journal/[week].md` | > 300 lines | Force graduation |

## Tool-Specific Loading

### Claude Code
Add to CLAUDE.md: `Read .memory/rules.md and .memory/anti-patterns.md at session start`

### Roo Code / Kilo Code
Symlinks: `.roo/rules/memory.md` → `.memory/rules.md`

### Gemini
Reference in `.gemini/styleguide.md`: `See .memory/rules.md for project rules`
