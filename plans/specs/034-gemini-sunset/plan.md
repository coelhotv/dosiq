# Plan 034 — Substituição do Gemini Code Assist

**Spec**: `spec.md` · **Tier**: 2 · **Created**: 2026-06-15 · **Status**: planned
**Ceremonies**: eng-review (RC3) + security-review (RC-SEC) — findings incorporados abaixo.

---

## Summary

Implementar defesa em 4 camadas substituindo o `gemini-code-assist[bot]` (sunset ~07/2026):
L0 lint determinístico · L1 RC5 self-check (skill) · L2 RC6 revisor IA independente (script + CI gate) · L3 humano (R-060). Epic fatiado em sub-specs 034-A/B/C/D, cada um PR independente.

## Clarifications (P1.5)

- Q: Força do enforcement (`ai-review-gate.yml`)? → **A: Soft warning** (não bloqueia merge; humano R-060 decide). Enforcement = disciplina de processo, alinhado a `project_review_gate_post_gemini`.
- Q: Gatilho do RC6? → **A: Manual (`rtk ai-review <PR#>`) + git hook `post-push`** (auto após push; mitigar quota rodando só com PR aberto).
- Q: Obrigatoriedade do L2/RC6? → **A: Obrigatório em todo PR Tier 1+** (sustentado por disciplina, já que o gate é soft).
- (ceremony) EM2 → RC6 escreve **só `events.jsonl`** (append-only), nunca `state.json` do projeto.
- (ceremony) SC-SEC1 → RC6 reviewer roda **sandbox texto→JSON, sem ferramentas**; `--dangerously-skip-permissions` só aceitável porque não há tool-access.

## Technical Context (evidência real)

- ESLint v9 flat config; `package.json:16` `"lint": "eslint ."`; plugins instalados: `eslint-plugin-no-relative-import-paths`, `eslint-plugin-import-x`, `@eslint/js` (`package.json:64-79`).
- `R-020` (timezone) marcado `[AUTOMATED via ESLint]` no RULES_INDEX → **não re-implementar**.
- `eslint-plugin-no-relative-import-paths` já cobre import-relativo da FR-005 → config, não código novo.
- `.github/workflows/gemini-review.yml` apenas **lê/parseia** review-comments (`Buscar comentários inline`, linhas 217/268) — **não posta**. Postar = capacidade nova.
- `.github/workflows/test.yml` — padrão `paths-ignore` (docs/.agent/md) a replicar no gate.
- RC6 já especificado no `SKILL.md` do devflow (modo Reviewing).
- ⚠️ **UNVERIFIED**: caminho do arquivo flat-config (`eslint.config.js`?) não localizado no scan inicial — 034-A deve `find` antes de editar.

## Constitution Check

- **I Health Data Safety** → SC-SEC5: diffs enviados a LLM externo só com fixtures sintéticas; sem dado real de paciente. ✅ endereçado.
- **VI SQP** → impacto **no-user-impact** (tooling/processo); sem bump de versão de produto. CHANGELOG `[Unreleased]` seção tooling.
- **VII Human-Controlled** → RC6 não auto-corrige, não auto-merge; gate soft + R-060. ✅
- **VIII Filesystem canonical** → RC6 grava `events.jsonl` (decisão EM2). ✅
- **IX Radical Transparency** → fail-open com aviso **visível** (FR-008), nunca bypass silencioso. ✅
Sem conflito constitucional.

## Architecture / Approach

```
L0  eslint flat config (apps/web ou raiz)  ── 3 regras novas: cor-literal, enum-não-pt-BR, res.json()-guard
                                              (import + timezone JÁ automatizados — leverage)
L1  SKILL.md RC5 checklist  ── adaptar Rails/Prisma → Supabase/Zod/FIFO/datas
L2  scripts/ai-review.* (rtk ai-review)  ── processo fresco, sandbox no-tools, agy→claude fallback,
        diff+catálogos→JSON validado→gh api (stdin, PR-level), events.jsonl, fail-open
    .github/workflows/ai-review-gate.yml  ── pull_request, SEM LLM, lê severidade do payload,
        SOFT (neutral check, não bloqueia), least-priv token, sem pull_request_target
    git hook post-push (opcional local)  ── dispara rtk ai-review se PR aberto
L3  humano (R-060) — inalterado
```

**Decisão arquitetural → ADR-069** (proposed): arquitetura do revisor independente (RC6) — fresco/sandbox/sem-tools, no-autofix, PR-level, events-only, fail-open, agy-primário. Resolve EH1/EH2/EM2/SC-SEC1-4.

## Target Files (canonical — verificar no C1 de cada sub-PR)

| Sub | Arquivo | Estado |
|-----|---------|--------|
| 034-A | flat eslint config (`eslint.config.js`?) | UNVERIFIED — `find` antes |
| 034-A | `apps/web/**/*.test` regra de lint | a criar |
| 034-B | `SKILL.md` devflow (R1/RC5 Pass 1) | verificado (repo externo SKILLS/devflow) |
| 034-C | `scripts/ai-review.mjs` (ou `.sh`) | a criar |
| 034-C | `.github/workflows/ai-review-gate.yml` | a criar |
| 034-C | git hook `post-push` (doc + sample) | a criar |
| 034-D | — (medição, sem arquivo) | — |

## Contracts and ADRs

- **ADR-069** (proposed) — RC6 independent reviewer architecture. **Aguarda aprovação humana antes de codar 034-C.**
- Sem CON novo (tooling, não interface de produto reutilizável).

## Risks + Quality Gates

- **R1 (sec):** prompt-injection no diff → reviewer no-tools + prompt trata diff como dado + gate lê severidade (SC-SEC1/2).
- **R2 (sec):** command-injection via output→gh api → stdin/JSON, nunca shell-interp (SC-SEC3).
- **R3:** falso-positivo L0 quebra lint da base → validar contra base atual (SC-002).
- **R4:** quota OAuth → RC6 só com PR aberto, diff-scoped; medir na 034-D.
- **R5:** path eslint UNVERIFIED → `find` no C1 da 034-A.
- Gates por sub-PR: `rtk lint` + `rtk npm run validate:agent` + teste do critério (SC-001/002/003 automatizados).

## Sequência

034-A (piso, $0) → 034-C (RC6, depende ADR-069) · 034-B paralelo (low-risk) · 034-D ao final (medição → decisão PO).
