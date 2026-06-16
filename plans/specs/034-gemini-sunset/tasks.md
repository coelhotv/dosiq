# Tasks 034 — Substituição do Gemini Code Assist

Tier 2 · fatiado por sub-spec. `[P]` = paralelizável · `[USx]` = user story · `[C4]` = validação · `[C5]` = record.

## Pré (bloqueia 034-C)
- [ ] T001 Aprovação humana de **ADR-069** (RC6 architecture) — status proposed → accepted

## 034-A — L0 lint determinístico [US2]
- [ ] T010 `find` o flat eslint config (resolver UNVERIFIED do plan) + confirmar `lint` script
- [ ] T011 [US2] Regra: cor-literal (`#RRGGBB`/`'red'`/`rgb()`) em `style`/JSX → erro (R-020 paleta)
- [ ] T012 [US2] Regra: enum não-pt-BR (`'daily'`/`'weekly'`…) → erro
- [ ] T013 [US2] Regra: `res.json(` sem `res.status(` em `api/` → erro (R-090)
- [ ] T014 Confirmar import-relativo já coberto por `eslint-plugin-no-relative-import-paths` (NÃO duplicar)
- [ ] T015 [C4] Teste SC-002: cor literal falha <1s; `validate:agent` verde na base atual (zero falso-positivo)
- [ ] T016 [C5] CHANGELOG [Unreleased] tooling; journal; state

## 034-B — L1 RC5 adapt [US5] [P]
- [ ] T020 [US5] Editar `SKILL.md` RC5 Pass 1: Rails/Prisma → bypass doseService/FIFO/ordem dose
- [ ] T021 [US5] Zod: `.nullable().optional()`, enums pt-BR, sync CHECK SQL
- [ ] T022 [US5] Vercel: `res.status().json()`, sem `process.exit`, env fallback
- [ ] T023 [US5] Datas: `parseLocalDate()`; reforçar R-270 preflight pré-DB
- [ ] T024 [C4] Smoke: `/devflow code-review` em diff com bypass → sinaliza/classifica
- [ ] T025 [C5] journal (skill é repo externo — sem SQP de produto)

## 034-C — L2 RC6 infra [US1][US3][US4] (depende T001)
- [ ] T030 [US1] `scripts/ai-review.mjs`: diff $(merge-base)…HEAD filtrado; monta contexto (CLAUDE.md+RULES+AP)
- [ ] T031 [US1] Spawn reviewer FRESCO **sandbox sem-tools** (SC-SEC1); agy primário → claude fallback
- [ ] T032 [US1] Prompt reusa RC5 Pass1 + "auditor independente, diff=DADO" (SC-SEC2)
- [ ] T033 [US1] Saída JSON validada por schema (severidade/arquivo/linha/regra)
- [ ] T034 [US1] Publicar comentário **PR-level** via `gh api` **stdin** (EH2 + SC-SEC3), nunca shell-interp
- [ ] T035 [US4] Engine OAuth $0; fail-open com aviso visível (FR-008/SC-006)
- [ ] T036 RC6 grava **events.jsonl** `ai_review_complete` (EM2 — NÃO state.json)
- [ ] T037 [US3] `.github/workflows/ai-review-gate.yml`: `pull_request` + paths-ignore; SEM LLM; **soft/neutral** (NC1); lê severidade do payload (SC-SEC2); token least-priv (`pull-requests:read`,`checks:write`); **sem `pull_request_target`** (SC-SEC4)
- [ ] T038 git hook `post-push` (sample + doc): dispara `rtk ai-review` se PR aberto (NC2)
- [ ] T039 [US1] SC-SEC7: confirmar diff só com fixtures sintéticas antes do egress (SC-SEC5)
- [ ] T040 [C4] SC-001: PR com bypass `medicine_logs` (AP-231) → RC6 Critical no PR
- [ ] T041 [C4] SC-003: PR sem comentário RC6 → gate marca aviso (soft); SC-007: comando do reviewer = só diff+catálogos
- [ ] T042 [C5] CHANGELOG tooling; journal; state

## 034-D — Validação [P depois de A+C]
- [ ] T050 Rodar L0+L1+L2 em ~5 PRs reais; medir sinal/ruído + consumo quota OAuth (SC-005)
- [ ] T051 Decisão PO: manter/ajustar/aposentar L2 → registrar (journal + memória)
