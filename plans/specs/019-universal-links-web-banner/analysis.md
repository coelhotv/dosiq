# Artifact Coverage Analysis: Universal Links / App Links & Web Smart Banner

**Feature Directory**: `plans/specs/019-universal-links-web-banner`  
**Created**: 2026-06-01  
**Status**: PASS  

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|:---|:---|:---|
| **§0 Contexto e ponto de partida** | `plan.md` (§Technical Context e §Architecture) | Mapeado o status atual dos associated domains e a entrega realizada do Plano 1. |
| **§0.4 🔒 Segurança: placeholders** | `plan.md` (§Risks) & `spec.md` (§FR-001 / §FR-003) | Incorporadas diretrizes rígidas do protocolo de placeholders `UL-S1` para omitir chaves em commits. |
| **§1 PLANO 1: Universal/App Links** | `spec.md` (§US1, §US2) & `plan.md` (§1 Rota de Fallback) | Roteamento em duas vias mapeado para PWA/Supabase redirecionando de forma graciosa. |
| **§2 PLANO 2: Banner "abra no app"** | `spec.md` (§US3) & `plan.md` (§2, §3 Banners) | Detalhado o Smart App Banner nativo no iOS e o componente customizado reativo. |
| **§3 Sprint Breakdown** | `tasks.md` | Sprints do breakdown legado mapeados integralmente para tarefas do checklist com IDs `TNNN`. |
| **§5 Quality Gates** | `plan.md` (§Quality Gates) & `tasks.md` (Phase 3) | Cobertura do comando `validate:agent`, Lighthouse a11y audit e zero erros no linter. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|:---|:---:|:---|:---|
| **FR-001**: Supabase/Email Redirect setup | Yes | `T003`, `T007` | Configuração nas configurações do Supabase e no app nativo. |
| **FR-002**: Rota `/auth/callback` do PWA | Yes | `T004`, `T005`, `T006` | Interceptação PKCE client-side. |
| **FR-003**: Apple Smart App Banner Head Tag | Yes | `T011` | Inserção de meta tag nativa com placeholder. |
| **FR-004**: Banner Customizado Móvel | Yes | `T008`, `T009`, `T010` | Hook `useIsMobileWeb` + `MobileAppBanner` no layout raiz. |
| **FR-005**: WCAG Acessibilidade WCAG/AAA | Yes | `T009`, `T017` | Aria-labels, tags semânticas e auditoria Lighthouse. |
| **SC-001**: Teste com App instalado | Yes | `T014` | Validação de deep link no simulador nativo. |
| **SC-002**: Teste Sem App / Fallback | Yes | `T015` | Validação de fallback web de autenticação. |
| **SC-003**: Lighthouse a11y score > 95% | Yes | `T017` | Garantia de alto padrão de acessibilidade no banner. |
| **SC-004**: Workbox PWA caching bypass | Yes | `T012` | Prevenção de caching de arquivos estáticos. |

---

## Constitution Alignment

- **R-090 (Hobby serverless functions budget)**: A decisão de rotear e processar a troca de sessões do Supabase inteiramente na página SPA client-side `/auth/callback` do `apps/web` preserva perfeitamente os recursos severamente limitados (12 slots) do nosso plano gratuito Vercel Hobby.
- **R-117 (Mobile Performance)**: O componente `MobileAppBanner` é extremamente restrito e possui impacto insignificante no carregamento inicial da página na Web, graças ao carregamento dinâmico preguiçoso (`React.lazy`) integrado com o `Suspense` global do PWA.
- **R-221 (SQP)**: Tarefas de liberação e governança para bumps canônicos e português sob `CHANGELOG.md` foram rigorosamente incluídas na Tasks list (Fase 4), garantindo estabilidade e visibilidade de releases de forma robusta e rastreável.

---

## Gaps

| ID | Severity | Summary | Required Action |
|:---|:---|:---|:---|
| **GAP-01** | **LOW** | App Store ID temporariamente ausente para injetar na meta tag do Safari | O PO deverá preencher o placeholder `<APP_STORE_ID>` no `index.html` de `apps/web` após a primeira submissão de publicação do app móvel. |
| **GAP-02** | **MEDIUM** | Cache agressivo do Workbox PWA pode causar stale em associações | Atualizar as regras do `apps/web/vite.config.js` garantindo exclusão absoluta para rotas sob `/.well-known/`. |

---

## Gate Decision

> [!TIP]
> **GATE DECISION: PASS**  
> A feature `019-universal-links-web-banner` encontra-se perfeitamente reestruturada em formato atômico de especificação SDD. Todos os DoDs legados e critérios de negócio foram completamente cobertos. A especificação está pronta para ser entregue na Wave M2 e servir de base de implementação futura.
