# Plan 038 — Refatorar Estrutura Web/PWA

- **Tier:** 1 (refactor) · **Guard:** FULL (RC3 override) · **Platform:** Web/PWA · **SemVer:** no-user-impact
- **Spec:** [spec.md](./spec.md) · **Ceremonies:** eng-review (RC3)
- **ADR:** nenhum formal. Decisão "views/ = camada de composição legítima" (A + carve-out) registrada na spec + FR-009 R-NNN. Não quebra contrato (CON-NNN não cobre paths internos de view).

## Summary

Refator puro de estrutura, sem mudança de comportamento. Aposenta naming `redesign` (pastas + sufixos), remove dead code irmão, extrai 1 vazamento de domínio, alinha doc. Entregue em **3 slices/PRs** (strangler-fig).

## Decisão-chave: collision matrix (verificada no repo 2026-06-22)

Cada componente tem par `Base.jsx` (pré-redesign) + `BaseRedesign.jsx` (atual). Importers reais:

| Componente | Base importers | Redesign importers | Veredito |
|-----------|:-:|:-:|----------|
| InsightCard | **0** | 2 | base morto → deletar, renomear Redesign→base |
| RingGauge | **0** | 2 | idem |
| SmartAlerts | **0** | 2 | idem |
| CostSummary | **0** | 2 | idem |
| StockCard | **0** | 4 | idem |
| MedicineCard | **0** | 3 | idem |
| ConsultationView | **0** | 4 | idem |
| ReminderSuggestion | **0** | 2 | idem |
| BottomNav | **0** | 5 | idem |
| **PrescriptionTimeline** | **1** | 2 | ⚠️ **AMBOS vivos** — investigar o importer da base em Slice B antes de mexer |

**Padrão:** 9/10 bases são dead code → delete seguro + rename. **1 exceção** (`PrescriptionTimeline`) exige investigar quem importa a versão antiga (legítimo? stale? consolidar). NÃO renomear cego.

## Arquitetura / Slices

```
Slice A (PR-A)  →  views/redesign/* ──git mv──> views/*          [rename + imports]
                   Landing* ──git mv──> views/landing/*
                   refs: AppViewRouter (12 lazy) · vite.config (@settings + 3 manualChunks) · 3 test paths

Slice B (PR-B)  →  features/*/components/redesign/ ──flatten──> components/   [4 pastas]
                   *Redesign sufixos: deletar 9 bases mortas + rename→base
                   PrescriptionTimeline: investigar + decidir (não cego)

Slice C (PR-C)  →  deriveProtocolStatus (Stock.jsx) ──extract──> @dosiq/core + teste
                   R-NNN anti-incho (FR-009) · CLAUDE.md (measures + views/)
```

## Target Files (verificados)

**Slice A:**
| Path | Ação |
|------|------|
| `apps/web/src/views/redesign/*` (Dashboard, Stock, Treatments, Medicines, HealthHistory, Settings, Emergency, Profile, Consultation, NotificationInbox + subpastas history/ profile/ settings/) | `git mv` → `views/` |
| `apps/web/src/views/{Landing,LandingHero,LandingIcons,LandingSections,LandingPrototype.css}` | `git mv` → `views/landing/` |
| `apps/web/src/AppViewRouter.jsx:9-21` | 12 lazy imports `./views/redesign/X`→`./views/X`; Landing→`./views/landing/Landing` |
| `apps/web/vite.config.js:25` | alias `@settings`→`./src/views/settings` |
| `apps/web/vite.config.js:46,50,51` | manualChunks: HealthHistory, Stock, Landing paths |
| `apps/web/src/views/__tests__/{Treatment,HealthHistory,Profile}.test.jsx` | paths de import |

**Slice B:**
| Path | Ação |
|------|------|
| `features/{consultation,medications,protocols,stock}/components/redesign/` | flatten → `components/` |
| 9 bases mortas (`{InsightCard,RingGauge,SmartAlerts,CostSummary,StockCard,MedicineCard,ConsultationView,ReminderSuggestion,BottomNav}.jsx` + `.css`) | deletar (confirmar imp==0 no momento) |
| 9 `*Redesign.jsx` correspondentes | rename → base + atualizar importers |
| `PrescriptionTimeline*` | investigar importer base → decidir |

**Slice C:**
| Path | Ação |
|------|------|
| `views/Stock.jsx` (`deriveProtocolStatus`) | extrair → `packages/core/src/utils/` + teste |
| `RULES_INDEX.md` + `rules/react_and_ui/R-NNN.md` | FR-009 |
| `CLAUDE.md` (raiz) + `apps/web/src/CLAUDE.md` | measures + estrutura views/ |

## Risks + Quality Gates

- **R1 (CRITICAL):** rename cego sobrescreve componente clínico. **Mitigação:** collision matrix acima + re-grep `imp==0` por arquivo no momento do delete (AP-164).
- **R2 (HIGH):** `git mv` quebra import relativo/teste silencioso (AP-H27). **Mitigação:** guard `grep redesign` vazio + build + test:critical por slice.
- **R3 (MEDIUM):** `PrescriptionTimeline` dual-live — consolidação errada. **Mitigação:** investigar antes; se ambíguo, ASK operador.
- **R4 (LOW):** bundle chunk muda nome → cache-bust. Aceitável (refator). **Mitigação:** gzip ±5%.

**Guard FULL por slice (RC3):** `rtk lint` (0 err) + `rtk npm run build` (gzip ±5% de 102 kB) + `rtk npm run test:critical` (1388 verde) + audit collision (grep imp==0 antes de delete).

## Clarifications
- Q: views = wrapper ou composição? → A: **composição legítima** (A), corrige doc. (NC1 resolvido)
- Q: FR-002 rename só ou reorg? → A: **rename simples**. (NC2 resolvido)
