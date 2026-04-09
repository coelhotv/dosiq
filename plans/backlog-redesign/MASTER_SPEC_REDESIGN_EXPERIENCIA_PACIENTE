# Plano de Redesign: Neon/Glass → Santuário Terapêutico

**Versão:** 2.0
**Data:** 2026-04-02
**Status:** Em execução — Foundation Waves W0-W3 entregues ✅ | W4-W8 entregues ✅ | W9 entregue ✅ | W10 (10A+10B+10C) entregues ✅ | W11 entregue ✅ | W12 entregue ✅ | W13 entregue ✅ | W14 entregue ✅ | W14.5 entregue ✅ | W15 entregue ✅ | W16 entregue ✅ (PR #448, 2026-04-08)
**Escopo:** Redesign completo de Design System, UI e UX — mobile-first + desktop responsivo


> **Norte criativo:** "Um santuário terapêutico brasileiro: calmo, editorial e legível. Um espaço em camadas e respirável onde dados clínicos sensíveis são apresentados com contraste suave, hierarquia clara e calor humano suficiente para reduzir ansiedade sem parecer infantil."

> **Princípio UX central:** O redesign não é apenas cosmético. Cada tela deve reforçar a pergunta central do paciente: **"O que preciso fazer agora?"**. Reduzir ruído cognitivo, adaptar a densidade da informação automaticamente e consolidar um design system coeso, executável e testável. Se uma decisão de design não ajuda o paciente a responder essa pergunta, ela não pertence à tela.

---

## Status das Waves

| Wave | Descrição | Spec | Status | PR/Branch |
|------|-----------|------|--------|-----------|
| Infra | RedesignContext, useRedesign, feature flag | `EXEC_SPEC_GRADUAL_ROLLOUT.md` | ✅ MERGED | — |
| W0 | Design Tokens (cores, sombras, borders) | `WAVE_0_DESIGN_TOKENS.md` | ✅ MERGED | main |
| W1 | Typography + Lucide Icons | `WAVE_1_TYPOGRAPHY_ICONS.md` | ✅ MERGED #418 | main |
| W2 | Surface & Layout System | `WAVE_2_SURFACE_LAYOUT.md` | ✅ MERGED #419 | main |
| W3 | Component Library Primitives | `WAVE_3_COMPONENT_PRIMITIVES.md` | ✅ MERGED #420 | main |
| W4 | Navigation Shell (BottomNav + Sidebar) | `WAVE_4_NAVIGATION_SHELL.md` | ✅ MERGED #422 (2026-03-25) | main |
| W5 | Motion Language | `WAVE_5_MOTION_LANGUAGE.md` | ✅ MERGED #424 (2026-03-25) | main |
| W6 | Dashboard Redesign | `WAVE_6_DASHBOARD_REDESIGN.md` | ✅ MERGED #425 (2026-03-25) | main |
| W6.5 | Dashboard Desktop Layout Fixes | `WAVE_6_5_DASHBOARD_DESKTOP_FIXES.md` | ✅ MERGED #426 (2026-03-25) | main |
| W7 | Tratamentos Redesign | `WAVE_7_TREATMENTS_REDESIGN.md` | ✅ MERGED #431 (2026-03-25) | main |
| W7.5 | Dashboard "Hoje": Card Redesign + Zonas Inteligentes | `WAVE_7_5_DASHBOARD_HOJE_IMPROVEMENTS.md` | ✅ MERGED #432 (2026-03-26) | main |
| W8 | Estoque Redesign | `WAVE_8_STOCK_REDESIGN.md` | ✅ MERGED #433 (2026-03-27) | main |
| W9 | Perfil & Saúde | `WAVE_9_PROFILE_SAUDE_REDESIGN.md` | ✅ MERGED #434 (2026-03-27) | main |
| W10 | Perfil Hub + Histórico Calendar-Driven + Settings | `WAVE_10_PERFIL_HISTORICO_SETTINGS.md` | ✅ COMPLETA (10A+10B+10C) | main |
| W10A | Settings Extraction | `WAVE_10A_SETTINGS_EXTRACTION.md` | ✅ MERGED #435 (2026-03-27) | main |
| W10B | Profile Hub + Migração de Dados | `WAVE_10B_PROFILE_HUB.md` | ✅ MERGED #436 (2026-03-27) | main |
| W10C | Histórico Calendar-Driven | `WAVE_10C_HISTORICO_CALENDAR.md` | ✅ MERGED #437 (2026-03-28) | main |
| W11 | Forms & Modals Redesign | (seção 16 abaixo) | ✅ MERGED #439 (2026-03-30) | main |
| W12 | Medicines View & Consultation Mode | (seção 17 abaixo) | ✅ MERGED #440 (2026-03-31) | main |
| W13 | Landing, Auth & Onboarding | `WAVE_13_LANDING_AUTH_ONBOARDING_REDESIGN.md` | ✅ MERGED #441 (2026-03-31) | main |
| W14 | Shared Components & Chatbot | `WAVE_14_SHARED_COMPONENTS_CHATBOT.md` | ✅ MERGED #442 (2026-04-02) | main |
| W14.5 | Tratamentos: CRUD Completo & Usabilidade | `WAVE_14_5_TREATMENTS_CRUD_USABILITY.md` | ✅ MERGED #444 (2026-04-02) | main |
| W15 | Smart Insights Integration | `WAVE_15_SMART_INSIGHTS_INTEGRATION.md` | ✅ MERGED #445 (2026-04-04) | main |
| W16 | Accessibility & Polish | `WAVE_16_ACCESSIBILITY_POLISH.md` | ✅ MERGED #448 (2026-04-08) | main |
| W17 | Rollout Promotion & Legacy Cleanup | `WAVE_17_ROLLOUT_LEGACY_CLEANUP.md` | ⏳ PENDENTE | — |

**Entregas Completas:**
- ✅ **W4** (2026-03-25): BottomNavRedesign + Sidebar + App.jsx integration + page transitions (PR #422)
- ✅ **W5** (2026-03-25): motionConstants.js + useMotion hook + CSS keyframes + AI review cycle (PR #424)
- ✅ **W6** (2026-03-25): RingGaugeRedesign + PriorityDoseCard + CronogramaPeriodo + StockAlertInline + DashboardRedesign.jsx (PR #425)
- ✅ **W6.5** (2026-03-25): CSS Responsive Doses + CronogramaPeriodo + DashboardRedesign + PriorityDoseCard Variants (PR #426)
- ✅ **W7** (2026-03-25): Treatments Redesign — 7 sprints, 2 personas (Simple/Complex), responsive layout, ANVISA search, 10 critical fixes (PR #431)
- ✅ **W7.5** (2026-03-26): Dashboard "Hoje" — dose card redesign (Pill/PillBottle icons), accordion zonas inteligentes (S7.5.1-S7.5.6), edit plan button, adherence neutra (PR #432)
- ✅ **W8** (2026-03-27): Stock Redesign — two-persona layout (Simple/Complex), CriticalAlertBanner, StockCardRedesign with Living Fill bars, EntradaHistorico history, useStockData shared hook, SYSTEM_NOTE_PREFIXES pattern, CSS var compliance, 6 refinement sprints (PR #433)
- ✅ **W9** (2026-03-27): Profile & Health History & Emergency Redesign — ProfileRedesign + 3 sub-components + wrapper strategy for Health History & Emergency, two-column desktop layout, CSS-based state management, Consultation navigation bugfix (PR #434)
- ✅ **W10A** (2026-03-27): Settings Extraction — SettingsRedesign view independente, 4 cards por função (Integrações/Preferências/Segurança/Admin), geração de token Telegram, density settings com descrição, logout + versão app (PR #435)
- ✅ **W10B** (2026-03-27): Profile Hub + Migração de Dados — ProfileRedesign rewrite como hub centralizado, 4 sub-componentes (ProfileHeader/EmergencyCard/ConsultationCard/EditProfileModal), migração localStorage → Supabase, schema Zod com validação, lucide icons, layout responsivo hub-grid (PR #436)
- ✅ **W10C** (2026-03-28): Histórico Calendar-Driven — rewrite completo HealthHistoryRedesign (calendar-driven, phase-loading), HistoryLogCard (3 linhas), HistoryDayPanel, HistoryKPICards, GlobalDoseModal compartilhado, logService expandido, mobile FAB + Sidebar "Registrar Dose", Gemini review 13 sugestões processadas, Issue #438 backlog refactor (PR #437)
- ✅ **W11** (2026-03-30): Forms & Modals Redesign — Modal base (lucide X, bottom sheet mobile, glass overlay, z-index 1200 hardcode), form utilities (form-row/form-actions/labels/error/checkbox), LogForm (Pill+Folders lucide icons, segmented control), MedicineForm, ProtocolForm, TitrationWizard, StockForm, TreatmentWizard, ExportDialog (format toggle segmented control, FileBracesCorner/FileDigit icons), ReportGenerator (legibilidade BEM over white bg), EmergencyCard, DailyDoseModal, z-index token --z-chatbot:1100, vite host:true, AP-W24 documentado (PR #439)
- ✅ **W12** (2026-03-31): Medicines View & Consultation Mode Redesign — MedicineCardRedesign + ConfirmDialog (W12.1), MedicinesRedesign view com useDashboard() context + dependency in-memory calc (W12.2), ConsultationViewRedesign presenter com design tokens + color-mix() (W12.3), ConsultationRedesign container com temporal consistency (W12.4), Gemini + Codex review 10 sugestões processadas, fix modal close on "Depois" + preserve AbortError behavior, lint 0 erros, tests críticos pass (PR #440)
- ✅ **W13** (2026-03-31): Landing, Auth & Onboarding Redesign — LandingRedesign rewrite (hero green gradient, feature cards sanctuary, CTA buttons), LoginRedesign (form-row pattern, sanctuary colors, invalid/error states), OnboardingRedesign v3.2 (4 steps, Framer Motion micro-interactions), Gemini review 8 sugestões processadas, migration from old login/auth state (PR #441)
- ✅ **W14** (2026-04-02): Shared Components & Chatbot — Loading skeleton shimmer (3 green rings), AlertList Lucide icons (AlertTriangle/AlertCircle/Info), OfflineBanner WifiOff icon, Calendar ChevronLeft/Right icons, InstallPrompt sanctuary incondicional (hardcode #006a5e), ChatWindow Trash2/X icons + ConfirmDialog + renderMessageContent() inline markdown, Gamification BadgeDisplay/MilestoneCelebration sanctuary, ConfettiAnimation SANCTUARY_COLORS paleta, DLQAdmin CSS overrides, fix btn-secondary glow (box-shadow:none), Gemini Code Assist 2 sugestões processadas (alertlist ternary clarity, ChatWindow key prop), lint 0 erros, all tests pass (PR #442)
- ✅ **W14.5** (2026-04-02): Tratamentos CRUD Completo & Usabilidade — NewTreatmentDropdown (2-3 opções por persona), deletar tratamento (card absoluto + hover tabular), deletar plano de tratamento (TreatmentPlanHeader Trash2), TreatmentPlanForm com campos emoji + color (picker + hex), redesign TreatmentPlanForm com tokens sanctuary, terminologia "protocolo"→"tratamento" em toda UI redesign, fluxo novo medicamento→novo tratamento via initialMedicineId, fix ConfirmDialog glow neon rosa (btn-primary/btn-danger overrides), Gemini review 4 sugestões processadas (PR #444)
- ✅ **W15** (2026-04-04): Smart Insights Integration — SmartAlertsRedesign (3 severidades, cascade reveal, snooze, max 2/5 por persona), InsightCardRedesign (7 tipos, Lucide icons, fade-up), ReminderSuggestionRedesign (sugestão horário ótimo + persistência localStorage 30 dias + protocolService.update), ProtocolRiskBadge (adherence14d% + trend arrow, guard hasEnoughData), CostSummaryRedesign (Living Fill bars, fonte purchases, label "Grátis" para SUS), PrescriptionTimelineRedesign (filtra contínuas, footer dias restantes colorido por status), StockCardRedesign prediction enrichment; integração em Dashboard (coluna esquerda) + Stock + Treatments; zero novas chamadas Supabase; Gemini review 6 sugestões processadas (PR #445)
- ✅ **W16** (2026-04-08): Accessibility & Polish — skip link + `id="main-content"` + `role="status"` no `ViewSkeleton`, `useReducedMotion` nas transições e widgets motion, ARIA grid no `Calendar`, `aria-describedby` nos forms críticos, `min-height: 44px` em `.btn-sm`, foco/contraste auditados, Gemini review aplicado, PR #448 merged em `main`

**Foundation (W0-W9):** 100% COMPLETO ✅
**Hub & Settings & Histórico (W10A-W10B-W10C):** 100% COMPLETO ✅
**Forms & Modals (W11):** 100% COMPLETO ✅
**Medicines & Consultation (W12):** 100% COMPLETO ✅
**Landing/Auth/Onboarding (W13):** 100% COMPLETO ✅
**Shared Components & Chatbot (W14):** 100% COMPLETO ✅
**Views (W0-W14):** 100% COMPLETO ✅ — Todas as views, forms e componentes compartilhados redesenhados
**Landing/Auth/Onboarding (W13):** 100% COMPLETO ✅
**Smart Insights (W15):** 100% COMPLETO ✅
**NEXT: Rollout Promotion & Legacy Cleanup (W17):** Feature flag removal, legacy cleanup, token consolidation
**Closure (W17):** Feature flag removal, legacy cleanup, token consolidation

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Visão de Arquitetura de UI Alvo](#2-visão-de-arquitetura-de-ui-alvo)
3. [Gap Analysis: Estado Atual vs. Futuro](#3-gap-analysis)
4. [Dependências e Pré-requisitos](#4-dependências-e-pré-requisitos)
5. [Wave 0 — Foundation: Design Tokens](#5-wave-0--foundation-design-tokens)
6. [Wave 1 — Typography & Icon System](#6-wave-1--typography--icon-system)
7. [Wave 2 — Surface & Layout System](#7-wave-2--surface--layout-system)
8. [Wave 3 — Component Library: Primitives](#8-wave-3--component-library-primitives)
9. [Wave 4 — Navigation: BottomNav + Sidebar](#9-wave-4--navigation-bottomnav--sidebar)
10. [Wave 5 — Motion Language](#10-wave-5--motion-language)
11. [Wave 6 — Dashboard (Hoje) Redesign](#11-wave-6--dashboard-hoje-redesign)
12. [Wave 7 — Tratamentos Redesign](#12-wave-7--tratamentos-redesign)
13. [Wave 8 — Estoque Redesign](#13-wave-8--estoque-redesign)
14. [Wave 9 — Perfil & Saúde Redesign](#14-wave-9--perfil--saúde-redesign)
15. [Wave 10 — Perfil Hub, Histórico Calendar-Driven & Settings](#15-wave-10--perfil-hub-histórico-calendar-driven--settings-extraction)
16. [Wave 11 — Forms & Modals Redesign](#16-wave-11--forms--modals-redesign)
17. [Wave 12 — Medicines View & Consultation Mode](#17-wave-12--medicines-view--consultation-mode)
18. [Wave 13 — Landing, Auth & Onboarding](#18-wave-13--landing-auth--onboarding)
19. [Wave 14 — Shared Components & Chatbot](#19-wave-14--shared-components--chatbot)
20. [Wave 15 — Smart Insights Integration](#20-wave-15--smart-insights-integration)
21. [Wave 16 — Accessibility & Polish](#21-wave-16--accessibility--polish)
22. [Wave 17 — Rollout Promotion & Legacy Cleanup](#22-wave-17--rollout-promotion--legacy-cleanup)
23. [Checklist de Validação por Wave](#23-checklist-de-validação-por-wave)
24. [Mapeamento de Arquivos](#24-mapeamento-de-arquivos)
25. [Riscos e Mitigações](#25-riscos-e-mitigações)
26. [Definição de Sucesso](#26-definição-de-sucesso)
- [Referências](#referências)

---

## 0. Estratégia de Rollout Gradual

> **Todo o redesign é desenvolvido e validado por trás de um feature flag — sem impacto em usuários atuais até validação completa.**
> Spec completa: `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md`

### Por que rollout gradual

O redesign Santuário Terapêutico é uma mudança visual completa (W0-W12). Para validá-lo com usuários reais em **sessões privadas de pesquisa qualitativa** antes do lançamento geral, toda a implementação é desenvolvida por trás de um feature flag baseado em `data-attribute` no root da app.

Usuários sem o flag ativado **nunca veem o redesign** — a app permanece 100% idêntica ao estado atual.

### Mecanismo: `data-redesign="true"`

```
<div class="app-container" data-redesign="true">   ← ativado pelo flag
  ...
</div>
```

Todas as regras CSS do redesign são scoped sob `[data-redesign="true"]`. Sem o atributo, nenhum token, estilo ou layout novo é aplicado.

### Como ativar o flag

| Contexto | Método |
|----------|--------|
| **Sessão de validação com usuário** | Compartilhar URL `?redesign=1` — persiste em localStorage durante toda a sessão |
| **Desativar para um usuário** | `?redesign=0` na URL — limpa o localStorage |
| **Time interno** | Toggle oculto em Configurações (visível com `mr_dev_mode=1` no localStorage) |
| **Produção (todos os usuários)** | Quando validação completa: remover o scoping, tornar tokens globais |

### Estratégia de isolamento por wave

| Wave | O que muda | Estratégia de isolamento |
|------|-----------|--------------------------|
| **W0 — Tokens** | Cores, sombras, borders, gradients | Novos tokens em `tokens.redesign.css` scoped em `[data-redesign="true"]`. **`colors.css`, `shadows.css`, `borders.css` atuais NÃO são tocados.** |
| **W1 — Typography** | Fontes Public Sans + Lexend, type scale | Tokens tipográficos adicionados ao mesmo bloco scoped. Fontes carregadas via CSS `@import` dentro do bloco scoped (não em `index.html` globalmente). |
| **W2 — Surface/Layout** | Superfícies tonais, grid system | Classes utilitárias novas (`card-sanctuary`, `grid-dashboard`) em `layout.redesign.css`. Classes que afetam `body` ou elementos globais: scoped em `[data-redesign="true"]`. |
| **W3 — Components** | Button, Card, inputs, badges | Estilos em `components.redesign.css`: `[data-redesign="true"] .btn { }`. **`Button.css` e `Card.css` NÃO são tocados.** API de props: imutável. |
| **W4+ — Views** | Dashboard, Tratamentos, Estoque, Nav | Variantes de view em `src/views/redesign/`. `useRedesign()` hook determina qual variante renderizar. Views atuais: intactas. |

### Arquivos de infraestrutura (criados antes das waves)

```
src/shared/contexts/RedesignContext.jsx     ← Provider + lógica do flag (URL param + localStorage)
src/shared/hooks/useRedesign.js             ← Hook: { isRedesignEnabled, toggleRedesign }
src/shared/styles/tokens.redesign.css       ← CSS scoped (W0 tokens + W1 typography)
src/shared/styles/layout.redesign.css       ← Classes de layout/superfície (W2)
src/shared/styles/components.redesign.css   ← Overrides de componentes (W3)
```

Todos importados em `src/shared/styles/index.css` após os arquivos atuais (ordem garante que overrides scoped ganham da cascata).

### Rollout final (pós-validação)

Quando o redesign for aprovado para todos:
1. Remover o scoping `[data-redesign="true"]` dos arquivos `.redesign.css`
2. Mesclar os tokens novos nos arquivos canônicos (`colors.css`, etc.)
3. Remover `RedesignContext`, o flag de URL e o toggle de Settings
4. Remover os arquivos `.redesign.css` (conteúdo já migrado)

---

## 1. Resumo Executivo

### O que muda

| Dimensão | Estado Atual (Neon/Glass) | Estado Futuro (Santuário Terapêutico) |
|----------|--------------------------|---------------------------------------|
| **Identidade** | Pós-moderno, cyberpunk, neon glows | Calmo, editorial, clínico premium |
| **Cor primária** | Rosa `#ec4899` | Verde Saúde `#006a5e` |
| **Cor secundária** | Cyan `#06b6d4` | Azul Clínico `#005db6` |
| **Fontes** | System UI (SF Pro Display) | Public Sans (headlines) + Lexend (body) |
| **Background** | Branco puro `#ffffff` | Off-white suave `#f8fafb` |
| **Superfícies** | Cards com borda 1px + sombra | Camadas tonais SEM bordas (Material 3) |
| **Sombras** | 5 camadas com glows neon | Ambient shadow única (`0 24px 24px rgba(25,28,29,0.04)`) |
| **Bordas** | 1px solid borders everywhere | "No-Line Rule" — separação por tom de superfície |
| **Border-radius** | Mix de xs/sm/md/lg/full | Mínimo 0.75rem; cards 2rem; botões xl/full |
| **Glassmorphism** | Global (todos os cards) | Seletivo (nav bar + overlays apenas) |
| **Gradients** | Linear pink→cyan (neon) | Sutil `135° primary→primary-container` (CTAs apenas) |
| **Botões primários** | Flat color com glow | Gradient 135° + sombra ambiente + 64px min height |
| **Touch targets** | Variável | Mínimo 56px, primários 64px |
| **Ícones** | SVG paths inline, sem labels | Lucide React icons, SEMPRE com label de texto |
| **Layout desktop** | Mobile-only (sem sidebar) | Sidebar fixa esquerda + grid 2-3 colunas |
| **Layout mobile** | Coluna única | Coluna única otimizada com zones colapsáveis |
| **Progressive Disclosure** | useComplexityMode (3 modos) | Expandido: 3 níveis + triggers automáticos + tooltips educativos |
| **Animações** | Spring physics + confetti | Cascade Reveal + Living Fill + Soft Handoff + Tactile Press |
| **Dark mode** | Suportado (neon-heavy) | NÃO suportado nesta fase (Phase 6 roadmap) |
| **Text color** | `#111827` (quase preto) | `#191c1d` (nunca `#000000`) |

### O que NÃO muda

- Stack técnico: React 19 + Vite 7 + Supabase + Zod 4 + Framer Motion 12
- Estrutura de features/views/services
- Lógica de negócio (hooks, services, schemas)
- Sistema de navegação por views (App.jsx setCurrentView)
- Lazy loading + code splitting (M2)
- API do Supabase e estrutura do banco
- Telegram bot
- PWA capabilities

---

## 2. Visão de Arquitetura de UI Alvo

Para alcançar a coesão desejada, a aplicação será implementada como uma **shell de experiência** composta por 6 camadas arquiteturais explícitas. Cada camada tem uma responsabilidade clara — agentes devem respeitar as fronteiras entre elas.

```
┌─────────────────────────────────────────────────────────┐
│  1. AppShell                                             │
│     Contêiner global da experiência autenticada.         │
│     Controla safe areas, fundo tonal (--color-surface),  │
│     espaçamentos globais e transições entre views.       │
│     Arquivo: src/App.jsx                                 │
├─────────────────────────────────────────────────────────┤
│  2. ExperienceLayout                                     │
│     Decide a composição mobile vs. desktop.              │
│     Controla largura máxima (max-w-7xl), grids por tela, │
│     e o offset do sidebar (margin-left: 256px desktop).  │
│     Arquivo: src/App.jsx + src/shared/styles/layout.redesign.css  │
├─────────────────────────────────────────────────────────┤
│  3. Navigation System                                    │
│     BottomNav (mobile) + Sidebar (desktop), operando     │
│     de forma coesa via setCurrentView().                  │
│     Arquivos: Sidebar.jsx + BottomNav.jsx                │
├─────────────────────────────────────────────────────────┤
│  4. Complexity System                                    │
│     Camada explícita que lê a complexidade do tratamento │
│     e injeta variantes visuais e de densidade.           │
│     Hook: useComplexityMode() — simples/moderado/complexo│
│     Triggers: nº meds, titulação, override manual.       │
├─────────────────────────────────────────────────────────┤
│  5. Motion System                                        │
│     Coreografia de animações: Cascade Reveal, Living     │
│     Fill, Soft Handoff, Tactile Press.                   │
│     Hook: useMotion() — respeita prefers-reduced-motion. │
│     Arquivo: motionConstants.js + useMotion.js           │
├─────────────────────────────────────────────────────────┤
│  6. Clinical Components Layer                            │
│     Biblioteca de componentes canônicos para adesão,     │
│     dose, estoque, protocolo, titulação, etc.            │
│     Responde à Complexity System para ajustar densidade. │
│     Arquivos: @features/*/components/*.jsx               │
└─────────────────────────────────────────────────────────┘
```

### Princípios Arquiteturais

1. **Cada camada tem owner claro** — não misturar responsabilidades. O AppShell não decide densidade; o Complexity System não anima.
2. **Protótipos são referência, não blueprint** — Os protótipos em `plans/redesign/references/` usam Tailwind + React Router + TypeScript como veículo de prototipagem. A app real usa CSS custom properties + view-based navigation + JavaScript. **Usar os protótipos para composição e layout, mas sempre partir da lógica e arquitetura da aplicação real.**
3. **Progressive enhancement** — Simple mode é o default. Complexidade só aparece quando o tratamento do paciente exige. A UI escala com o paciente, não antes.
4. **Tela responde uma pergunta** — Cada view tem um "job":
   - **Hoje:** "O que preciso fazer agora?"
   - **Tratamentos:** "Como estão meus tratamentos?"
   - **Estoque:** "Preciso comprar algo?"
   - **Perfil:** "Como configurar minha experiência?"

---

## 3. Gap Analysis: Estado Atual vs. Futuro

### 2.1 Design Tokens — Delta Completo

> **Contexto de rollout:** "REMOVER" e "ADICIONAR" abaixo descrevem o **target state** (estado após rollout completo).
> - **"ADICIONAR"** durante rollout = adicionar em `tokens.redesign.css` scoped em `[data-redesign="true"]`, NÃO em `colors.css`
> - **"REMOVER"** acontece apenas no pós-rollout, quando os tokens originais forem migrados/removidos dos arquivos canônicos

```
REMOVER:
├── --color-primary: #ec4899 (rosa)
├── --color-primary-light/dark/bg/hover
├── --color-secondary: #06b6d4 (cyan)
├── --color-secondary-light/dark/bg
├── --neon-* (todos: cyan, pink, magenta, green, etc.)
├── --glow-* (todos: cyan, pink, magenta, etc.)
├── --glow-hover-*, --glow-focus-*, --glow-active-*
├── --state-hover/active/focus (baseados em rosa)
├── --gradient-insight, --gradient-hero, --gradient-alert-*
├── --glass-* (light/default/heavy/hero levels)
└── --shadow-layer-1 até --shadow-layer-5

ADICIONAR:
├── --color-primary: #006a5e (verde saúde)
├── --color-primary-container: #008577
├── --color-primary-fixed: #90f4e3
├── --color-on-primary: #ffffff
├── --color-secondary: #005db6 (azul clínico)
├── --color-secondary-container: #63a1ff
├── --color-secondary-fixed: #d6e3ff
├── --color-tertiary: #7b5700
├── --color-tertiary-fixed: #ffdea8
├── --color-surface: #f8fafb
├── --color-surface-container: #eceeef
├── --color-surface-container-low: #f2f4f5
├── --color-surface-container-lowest: #ffffff
├── --color-surface-container-high: #e6e8e9
├── --color-surface-container-highest: #e1e3e4
├── --color-on-surface: #191c1d
├── --color-on-surface-variant: #3e4946
├── --color-outline: #6d7a76
├── --color-outline-variant: #bdc9c5
├── --color-error: #ba1a1a (ajuste)
├── --color-error-container: #ffdad6
├── --shadow-ambient: 0 24px 24px rgba(25, 28, 29, 0.04)
├── --shadow-editorial: 0 4px 24px -4px rgba(25, 28, 29, 0.04)
├── --gradient-primary: linear-gradient(135deg, #006a5e, #008577)
└── --gradient-primary-shadow: 0 8px 24px rgba(0, 106, 94, 0.20)
```

### 2.2 Componentes — Mapeamento Atual → Futuro

| Componente Atual | Path Atual | Ação | Componente Futuro |
|-----------------|-----------|------|-------------------|
| `RingGauge.jsx` | `@dashboard/components/` | EVOLUIR | Ring com stroke 12pt, track `#005db6`, progress `#90f4e3`, Public Sans center |
| `StockBars.jsx` | `@dashboard/components/` | EVOLUIR | Barras 8px full-radius, cores semânticas atualizadas, sem glow |
| `SparklineAdesao.jsx` | `@dashboard/components/` | EVOLUIR | Manter lógica, atualizar cores |
| `SwipeRegisterItem.jsx` | `@shared/components/log/` | EVOLUIR | Atualizar visual para sanctuary style |
| `BottomNav.jsx` | `@shared/components/ui/` | REESCREVER | Glass nav + 4 tabs com icons Lucide + labels |
| `BottomNav.css` | `@shared/components/ui/` | REESCREVER | Glass: `bg-surface/80 backdrop-blur-[12px]` |
| `Button.jsx` | `@shared/components/ui/` | CSS scoped (W3) | 64px height, gradient primary, xl radius — via `[data-redesign="true"] .btn` em `components.redesign.css`. **API de props: imutável. `Button.jsx` não é alterado.** |
| `Card.jsx` | `@shared/components/ui/` | CSS scoped (W3) | Sanctuary cards: no border, 2rem radius, ambient shadow — via `[data-redesign="true"] .card` em `components.redesign.css`. **API de props: imutável. `Card.jsx` não é alterado.** |
| `Modal.jsx` | `@shared/components/ui/` | EVOLUIR | Atualizar visual, manter lógica |
| `Loading.jsx` | `@shared/components/ui/` | EVOLUIR | Verde primary spinner |
| `DoseZoneList.jsx` | `@dashboard/components/` | EVOLUIR | Atualizar visual zones com tonal surfaces |
| `ViewModeToggle.jsx` | `@dashboard/components/` | EVOLUIR | Segmented control com novo style |
| `PlanBadge.jsx` | `@dashboard/components/` | EVOLUIR | Atualizar cores |
| `BatchRegisterButton.jsx` | `@dashboard/components/` | EVOLUIR | Gradient primary style |
| `AdaptiveLayout.jsx` | `@dashboard/components/` | EVOLUIR | Manter lógica, ajustar breakpoints |
| `SmartAlerts.jsx` | `@dashboard/components/` | REESCREVER (W15) | `SmartAlertsRedesign.jsx` — Smart alerts Sanctuary com tipos Fase 6 |
| — (novo) | — | CRIAR | `Sidebar.jsx` — Desktop navigation sidebar |
| — (novo) | — | CRIAR | `PageHeader.jsx` — Reusable page header component |
| — (novo) | — | CRIAR | `StockCard.jsx` — Card individual de estoque (complex mode) |
| — (novo) | — | CRIAR | `TreatmentCard.jsx` — Card de tratamento expandível |
| — (novo) | — | CRIAR | `ProgressiveTooltip.jsx` — Tooltip educativo para progressive disclosure |

### 2.3 Views — Delta por Tela

> **Contexto de rollout W4+:** As mudanças abaixo são implementadas em **variantes redesenhadas** (`src/views/redesign/`), NÃO nos arquivos de view originais. O hook `useRedesign()` seleciona qual versão renderizar. Views atuais permanecem intactas até o rollout completo.

| View | Mudanças Visuais | Mudanças Estruturais |
|------|-----------------|---------------------|
| **Dashboard** | Greeting editorial, ring recolor, doses por período (Manhã/Tarde/Noite), cards tonal | Grid 2-col desktop (ring+priority left, schedule right) |
| **Treatment** | Cards expandíveis com mini-ring e titulação, search bar, tabs Ativos/Pausados/Finalizados | Agrupamento por categoria (Cardiovascular, Diabetes, etc.), grid tabular desktop |
| **Stock** | Cards por medicamento com dias restantes bold, barras coloridas, status badges | Grid 3-col desktop, critical alert banner com CTA |
| **Profile** | Layout utilitário sem drama, avatar + initials, menu list sanctuary | Manter simples, flat utility layout |
| **HealthHistory** | Calendar heat map redesign, sparklines atualizadas | Manter estrutura, atualizar cores |
| **Landing** | Redesign completo para Verde Saúde identity | Hero editorial com gradient |
| **Auth** | Redesign visual | Manter lógica, atualizar aparência |

---

## 4. Dependências e Pré-requisitos

### 3.1 Pacotes NPM a Adicionar

```bash
npm install lucide-react
# (Framer Motion 12 já instalado)
# Fonts: Google Fonts via CSS @import (Public Sans + Lexend)
```

**Nota:** O projeto NÃO usa Tailwind CSS. Todo styling é feito via CSS custom properties e CSS modules. O redesign DEVE manter essa abordagem — os protótipos em `/plans/redesign/references/` usam Tailwind apenas como referência visual, NÃO como indicação de stack.

### 3.2 Fonts — Carregamento

> **⚠️ ROLLOUT GRADUAL:** As fontes NÃO devem ser adicionadas ao `index.html` globalmente. Durante a fase de rollout, o carregamento das fontes deve ser feito via `@import` dentro do arquivo `tokens.redesign.css`, garantindo que Public Sans e Lexend só carreguem para usuários com o flag ativado.

Adicionar no início de `src/shared/styles/tokens.redesign.css` (já scoped pelo flag):
```css
/* Carregamento das fontes — só ativo para usuários com data-redesign="true" */
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&display=swap');
```

**Pós-validação (rollout completo para todos):** Ao promover o redesign para todos os usuários, migrar para `<link rel="preconnect">` + `<link rel="preload">` + `<link rel="stylesheet">` no `index.html` para performance máxima:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&display=swap">
```

### 3.3 Regra Absoluta

- **NÃO instalar Tailwind CSS** — manter CSS custom properties + CSS modules
- **NÃO criar novo sistema de routing** — manter view-based navigation (App.jsx setCurrentView)
- **NÃO alterar lógica de negócio** — apenas visual/UX
- **NÃO remover dark mode toggle** — desabilitar temporariamente, preservar infraestrutura para Phase 6
- **NÃO quebrar lazy loading** — manter React.lazy + Suspense + ViewSkeleton pattern
- **MANTER** todos os path aliases existentes (@features, @shared, etc.)
- **NÃO editar arquivos de tokens originais** (`colors.css`, `shadows.css`, `borders.css`, `typography.css`) durante a fase de rollout — alterações vão em `tokens.redesign.css` scoped em `[data-redesign="true"]`
- **NÃO editar views originais** (`Dashboard.jsx`, `Treatment.jsx`, `Stock.jsx`, etc.) durante a fase de rollout — criar variantes em `src/views/redesign/` e usar `useRedesign()` para selecionar

---

## 5. Wave 0 — Foundation: Design Tokens

> **⚠️ ROLLOUT GRADUAL — LEIA ANTES DE EXECUTAR**
>
> As instruções de Sprint abaixo descrevem o **target state** do redesign (como os tokens ficam quando o redesign estiver completo). Para implementar esta wave com rollout gradual — mantendo a app atual 100% intacta para todos os usuários — **siga o arquivo `plans/redesign/WAVE_0_DESIGN_TOKENS.md`** em vez das instruções abaixo.
>
> **O que muda na implementação real:**
> - Os tokens NÃO são escritos em `colors.css`, `shadows.css` ou `borders.css` (esses arquivos NÃO são tocados)
> - Os tokens NÃO são escritos em `:root {}` global
> - Os tokens vão em `src/shared/styles/tokens.redesign.css`, scoped sob `[data-redesign="true"]`
> - `index.css`, `light.css` e `dark.css` NÃO são tocados durante esta wave
>
> As seções abaixo servem como **referência de target state** e documentação de intenção de design.

**Objetivo:** Substituir TODOS os design tokens de cor, sombra e gradiente de uma vez. Esta é a foundation sobre a qual todo o resto será construído.

**Escopo:** Apenas tokens CSS — sem alterações em componentes React.

### Sprint 0.1 — Novo arquivo de cores

**Target state (referência):** `src/shared/styles/tokens/colors.css` — estado final após rollout completo.
**Implementação real:** Adicionar ao `tokens.redesign.css` scoped em `[data-redesign="true"]` — ver `WAVE_0_DESIGN_TOKENS.md`.

**Ação (target state):** REESCREVER completamente. Remover TODAS as variáveis neon/glass/pink/cyan.

```css
/* TARGET STATE — na implementação real (rollout): [data-redesign="true"] { ... } em vez de :root {} */
/* ============================================
   BRAND COLORS — Verde Saúde (Primary)
   ============================================ */
:root {
  --color-primary: #006a5e;
  --color-primary-container: #008577;
  --color-primary-fixed: #90f4e3;
  --color-on-primary: #ffffff;
  --color-on-primary-fixed-variant: #005047;

  /* Backward compat aliases */
  --brand-primary: var(--color-primary);
  --color-primary-light: var(--color-primary-container);
  --color-primary-dark: #005047;
  --color-primary-bg: rgba(0, 106, 94, 0.05);
  --color-primary-hover: #005047;
}

/* ============================================
   BRAND COLORS — Azul Clínico (Secondary)
   ============================================ */
:root {
  --color-secondary: #005db6;
  --color-secondary-container: #63a1ff;
  --color-secondary-fixed: #d6e3ff;
  --color-on-secondary-fixed: #001b3d;

  /* Backward compat aliases */
  --brand-secondary: var(--color-secondary);
  --color-secondary-light: var(--color-secondary-container);
  --color-secondary-dark: #004490;
  --color-secondary-bg: rgba(0, 93, 182, 0.05);
}

/* ============================================
   TERTIARY — Warm Highlights
   ============================================ */
:root {
  --color-tertiary: #7b5700;
  --color-tertiary-container: #9b6e00;
  --color-tertiary-fixed: #ffdea8;
  --color-on-tertiary-fixed: #271900;
}

/* ============================================
   SURFACE HIERARCHY (Material 3 — Tonal Architecture)
   ============================================ */
:root {
  --color-surface: #f8fafb;
  --color-surface-container: #eceeef;
  --color-surface-container-low: #f2f4f5;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-high: #e6e8e9;
  --color-surface-container-highest: #e1e3e4;
}

/* ============================================
   TEXT & OUTLINE
   ============================================ */
:root {
  --color-on-surface: #191c1d;
  --color-on-surface-variant: #3e4946;
  --color-outline: #6d7a76;
  --color-outline-variant: #bdc9c5;
  /* Ghost border — accessibility only */
  --color-outline-ghost: rgba(25, 28, 29, 0.15);
}

/* ============================================
   SEMANTIC COLORS — Status
   ============================================ */
:root {
  --color-success: #22c55e;     /* estoque normal */
  --color-success-light: #4ade80;
  --color-success-bg: #ecfdf5;

  --color-warning: #f59e0b;     /* estoque baixo */
  --color-warning-light: #fbbf24;
  --color-warning-bg: #fffbeb;

  --color-error: #ba1a1a;       /* crítico, alerta */
  --color-error-light: #ff897d;
  --color-error-bg: #ffdad6;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;

  --color-info: #3b82f6;        /* high stock */
  --color-info-light: #60a5fa;
  --color-info-bg: #eff6ff;
}

/* ============================================
   BACKGROUND COLORS (backward compat)
   ============================================ */
:root {
  --bg-primary: var(--color-surface);
  --bg-secondary: var(--color-surface-container-low);
  --bg-tertiary: var(--color-surface-container);
  --bg-card: var(--color-surface-container-lowest);
  --bg-overlay: rgba(25, 28, 29, 0.5);
  --bg-glass: rgba(248, 250, 251, 0.80);

  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-tertiary: var(--bg-tertiary);
  --color-bg-card: var(--bg-card);
}

/* ============================================
   TEXT COLORS (backward compat)
   ============================================ */
:root {
  --text-primary: var(--color-on-surface);
  --text-secondary: var(--color-on-surface-variant);
  --text-tertiary: var(--color-outline);
  --text-inverse: #ffffff;
  --text-link: var(--color-primary);

  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-inverse: var(--text-inverse);
  --color-text-link: var(--text-link);
}

/* ============================================
   BORDER COLORS (backward compat)
   ============================================ */
:root {
  --border-light: var(--color-surface-container-low);
  --border-default: var(--color-outline-variant);
  --border-dark: var(--color-outline);
  --border: var(--border-default);
  --border-color: var(--border);

  --color-border-light: var(--border-light);
  --color-border-default: var(--border-default);
  --color-border-dark: var(--border-dark);
}

/* ============================================
   HEALTH SCORE COLORS
   ============================================ */
:root {
  --score-critical: var(--color-error);
  --score-low: #f97316;
  --score-medium: #eab308;
  --score-good: var(--color-success);
  --score-excellent: var(--color-primary);
}

/* ============================================
   STATE COLORS (interaction feedback)
   ============================================ */
:root {
  --state-hover: rgba(0, 106, 94, 0.08);
  --state-active: rgba(0, 106, 94, 0.15);
  --state-focus: rgba(0, 106, 94, 0.20);
  --state-disabled: rgba(25, 28, 29, 0.10);
  --state-loading: rgba(0, 106, 94, 0.5);
}

/* ============================================
   TOGGLE & THEME COLORS
   ============================================ */
:root {
  --color-toggle-track: var(--color-surface-container-high);
  --color-toggle-track-dark: #374151;
  --color-sun: #f59e0b;
  --color-moon: #93c5fd;
}

/* ============================================
   GLASSMORPHISM — Floating elements only
   ============================================ */
:root {
  --glass-bg: rgba(248, 250, 251, 0.80);
  --glass-blur: blur(12px);
  --glass-border: var(--color-outline-ghost);
}

/* ============================================
   GRADIENT — Primary actions only
   ============================================ */
:root {
  --gradient-primary: linear-gradient(135deg, #006a5e, #008577);
  --gradient-primary-shadow: 0 8px 24px rgba(0, 106, 94, 0.20);
}

/* ============================================
   OPACITY VALUES
   ============================================ */
:root {
  --opacity-disabled: 0.5;
  --opacity-hover: 0.8;
  --opacity-focus: 1;
  --opacity-overlay: 0.9;
  --opacity-backdrop: 0.75;
  --opacity-muted-text: 0.40;
}

/* ============================================
   DARK THEME — PLACEHOLDER (Phase 6)
   Mantém estrutura, NÃO é funcional nesta fase.
   ============================================ */
[data-theme='dark'] {
  /* TODO Phase 6: Redesign per surface tier
     Dark surface baseline: #0f1117 (not pure black)
     Primary may need lightness shift for AA on dark
     Glass: invert to rgba(15,17,23,0.80) */
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d24;
  --bg-tertiary: #252830;
  --bg-card: #1a1d24;
  --text-primary: #f0f2f4;
  --text-secondary: #a0a4ab;
  --text-tertiary: #6b7280;
}
```

### Sprint 0.2 — Novo arquivo de sombras

**Target state (referência):** `src/shared/styles/tokens/shadows.css`
**Implementação real:** Adicionar ao `tokens.redesign.css` scoped em `[data-redesign="true"]` — ver `WAVE_0_DESIGN_TOKENS.md`.

**Ação (target state):** REESCREVER. Remover shadow-layer-1 até 5 e todos os glows. Substituir por ambient shadow system.

```css
/* TARGET STATE — na implementação real (rollout): [data-redesign="true"] { ... } em vez de :root {} */
:root {
  /* ============================================
     AMBIENT SHADOW SYSTEM — Therapeutic Sanctuary
     Filosofia: luz natural, não digital.
     Profundidade via tom de superfície, não sombra.
     ============================================ */

  /* Shadow única padrão — ambient light */
  --shadow-ambient: 0 24px 24px rgba(25, 28, 29, 0.04);

  /* Editorial shadow — para cards e containers */
  --shadow-editorial: 0 4px 24px -4px rgba(25, 28, 29, 0.04);

  /* Primary CTA shadow */
  --shadow-primary: 0 8px 24px rgba(0, 106, 94, 0.20);

  /* Error CTA shadow */
  --shadow-error: 0 8px 24px rgba(186, 26, 26, 0.20);

  /* Floating elements (FAB, modals) */
  --shadow-floating: 0 16px 48px rgba(25, 28, 29, 0.12);

  /* None */
  --shadow-none: none;

  /* ============================================
     BACKWARD COMPAT ALIASES
     Componentes que usam o sistema antigo.
     Migrar progressivamente.
     ============================================ */
  --shadow-sm: var(--shadow-editorial);
  --shadow-md: var(--shadow-ambient);
  --shadow-lg: var(--shadow-floating);
  --shadow-xl: var(--shadow-floating);
}
```

### Sprint 0.3 — Novo arquivo de borders

**Target state (referência):** `src/shared/styles/tokens/borders.css`
**Implementação real:** Adicionar ao `tokens.redesign.css` scoped em `[data-redesign="true"]` — ver `WAVE_0_DESIGN_TOKENS.md`.

**Ação (target state):** ATUALIZAR. Manter widths, ATUALIZAR radii para mínimo 0.75rem. Remover radii xs/sm para UI components.

```css
/* TARGET STATE — na implementação real (rollout): [data-redesign="true"] { ... } em vez de :root {} */
:root {
  /* Border Radius — Mínimo 0.75rem para UI */
  --radius-none: 0;
  --radius-md: 0.75rem;     /* 12px — MÍNIMO para UI */
  --radius-lg: 1rem;        /* 16px — Standard cards */
  --radius-xl: 1.25rem;     /* 20px — Buttons, inputs */
  --radius-2xl: 2rem;       /* 32px — Sanctuary cards */
  --radius-3xl: 2.5rem;     /* 40px — Hero cards */
  --radius-full: 9999px;    /* Circular */

  /* Component-specific */
  --radius-card: var(--radius-2xl);
  --radius-card-sm: var(--radius-lg);
  --radius-button: var(--radius-xl);
  --radius-input: var(--radius-xl);
  --radius-badge: var(--radius-full);
  --radius-progress: var(--radius-full);
  --radius-icon-container: var(--radius-full);
  --radius-nav-item: var(--radius-lg);

  /* Focus ring */
  --focus-ring-width: 2px;
  --focus-ring-color: var(--color-primary);
  --focus-ring-offset: 2px;
}
```

### Sprint 0.4 — Atualizar index.css (pós-rollout)

> **⚠️ ROLLOUT:** `index.css` NÃO é modificado durante a fase de rollout gradual. As classes utilitárias abaixo são adicionadas em `tokens.redesign.css` scoped em `[data-redesign="true"]`. Ver `WAVE_0_DESIGN_TOKENS.md`.

**Target state** (executado apenas no rollout completo — quando todos os usuários receberem o redesign):

Alterações chave em `src/shared/styles/index.css`:
- Remover `.glow-*` classes (todas)
- Remover `.gradient-text` (neon)
- Atualizar `.glass-card` para usar novos tokens
- Adicionar `.surface-container-*` utilities
- Atualizar `body` background para `--color-surface`
- Adicionar `.card-sanctuary` utility class
- Adicionar `.btn-primary-gradient` utility class

### Sprint 0.5 — Limpar temas (pós-rollout)

> **⚠️ ROLLOUT:** `light.css` e `dark.css` NÃO são modificados durante a fase de rollout gradual. O dark mode placeholder de rollout é feito em `tokens.redesign.css` com selector `[data-theme='dark'] [data-redesign="true"]`.

**Target state** (executado apenas no rollout completo):

**Arquivo:** `src/shared/styles/themes/light.css` — Atualizar para refletir novo token system. Remover referências neon.

**Arquivo:** `src/shared/styles/themes/dark.css` — Simplificar para placeholder (Phase 6). Manter estrutura, marcar como TODO.

### Critério de conclusão Wave 0

- [ ] `npm run dev` roda sem erros de CSS
- [ ] `tokens.redesign.css` existe com todos os tokens scoped em `[data-redesign="true"]`
- [ ] Para usuários **com flag ativo** (`?redesign=1`): background é `#f8fafb`, textos usam `#191c1d`
- [ ] Para usuários **sem flag**: app permanece 100% idêntica ao estado anterior (sem quebras visuais)
- [ ] `colors.css`, `shadows.css`, `borders.css` NÃO foram modificados (verificar com `git diff`)
- [ ] Tokens neon/glow originais continuam funcionando para usuários sem flag (são mantidos em `colors.css`)

---

## 6. Wave 1 — Typography & Icon System

> **⚠️ ROLLOUT GRADUAL — LEIA ANTES DE EXECUTAR**
>
> As instruções de Sprint abaixo descrevem o **target state** da tipografia. Para implementar esta wave com rollout gradual, **siga o arquivo `plans/redesign/WAVE_1_TYPOGRAPHY_ICONS.md`** em vez das instruções abaixo.
>
> **O que muda na implementação real:**
> - Os tokens tipográficos NÃO são escritos em `typography.css` (esse arquivo NÃO é tocado)
> - Os tokens vão em `tokens.redesign.css`, scoped sob `[data-redesign="true"]`
> - O `@import` das fontes vai NO INÍCIO de `tokens.redesign.css` (não em `index.html`)
>
> As seções abaixo servem como **referência de target state** e documentação de intenção de design.

### Sprint 1.1 — Tipografia

**Target state (referência):** `src/shared/styles/tokens/typography.css` — estado final após rollout completo.
**Implementação real:** Adicionar ao `tokens.redesign.css` scoped em `[data-redesign="true"]` — ver `WAVE_1_TYPOGRAPHY_ICONS.md`.

**Ação (target state):** REESCREVER completamente.

```css
/* TARGET STATE — na implementação real (rollout): [data-redesign="true"] { ... } em vez de :root {} */
:root {
  /* ============================================
     FONT FAMILIES — Therapeutic Sanctuary
     ============================================ */

  /* Display & Headlines — "Clinical Authority" */
  --font-display: "Public Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* Body & UI Text — "Hyper-legibility" */
  --font-body: "Lexend", ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* System fallback */
  --font-family: var(--font-body);
  --heading-font-family: var(--font-display);

  /* ============================================
     TYPE SCALE — Editorial Health Journal
     REGRA: Nunca peso abaixo de 400.
     ============================================ */

  /* Display */
  --text-display-md: clamp(2rem, 4vw, 3rem);

  /* Headlines — Public Sans */
  --text-headline-md: 1.75rem;

  /* Titles — Lexend */
  --text-title-lg: 1.125rem;
  --text-title-sm: 0.875rem;

  /* Body */
  --text-body-lg: 1rem;

  /* Labels */
  --text-label-md: 0.75rem;
  --text-label-sm: 0.625rem;

  /* Backward compat size scale */
  --text-xs: 0.625rem;
  --text-sm: 0.75rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.75rem;
  --text-4xl: 2rem;
  --text-5xl: 3rem;

  --font-size-base: var(--text-base);
  --font-size-sm: var(--text-sm);

  /* ============================================
     FONT WEIGHTS
     REGRA: Mínimo 400 para legibilidade idosos
     ============================================ */
  --font-weight-regular: 400;  /* Body, descriptions */
  --font-weight-medium: 500;   /* UI labels, section headers */
  --font-weight-semibold: 600; /* Medication names, primary paths */
  --font-weight-bold: 700;     /* Headlines, display, ring % */

  /* Backward compat */
  --font-weight-normal: var(--font-weight-regular);

  /* ============================================
     LINE HEIGHTS
     ============================================ */
  --line-height-tight: 1.1;
  --line-height-snug: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;
  --line-height-loose: 2;

  --heading-line-height: var(--line-height-tight);
  --heading-font-weight: var(--font-weight-bold);

  /* ============================================
     LETTER SPACING
     ============================================ */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;

  /* ============================================
     MAX LINE WIDTH — readability
     ============================================ */
  --max-line-width: 65ch;
}
```

**Sobre fontes:** Durante rollout, as fontes são carregadas via `@import url(...)` no início de `tokens.redesign.css` (ver seção 3.2). `index.html` NÃO é modificado durante esta fase.

### Sprint 1.2 — Icon System (Lucide React)

**Ação:** Instalar `lucide-react` como dependência.

```bash
npm install lucide-react
```

**Convenções de uso:**

```jsx
// CORRETO — ícone SEMPRE acompanhado de label
import { Calendar, Pill, Package, User } from 'lucide-react'

<button>
  <Calendar size={20} />
  <span className="nav-label">Hoje</span>
</button>

// ERRADO — ícone sozinho sem label
<button>
  <Calendar size={20} />
</button>
```

**Mapeamento de ícones de navegação (da iconografia):**

| Uso | Ícone Lucide | Antigo |
|-----|-------------|--------|
| Hoje (Dashboard) | `Calendar` | SVG path inline |
| Tratamentos | `Pill` | SVG path inline (heart) |
| Estoque | `Package` | SVG path inline (cube) |
| Perfil | `User` | SVG path inline |
| Saúde & Portabilidade | `HeartPulse` | — (novo) |
| Adicionar | `Plus` | — |
| Registrar dose | `CheckCircle2` | — |
| Comprar | `ShoppingCart` | — |
| Alerta | `AlertTriangle` | — |
| Estoque Baixo | `AlertCircle` | — |
| Relógio/Horário | `Clock` | — |
| Filtrar | `Filter` | — |
| Buscar | `Search` | — |
| Configurações | `Settings` | — |
| Sair | `LogOut` | — |
| Info/Detalhes | `Info` | — |
| Chevron | `ChevronRight` | — |
| Notificações | `Bell` | — |

**Tamanhos padrão:**
- 24px — base
- 20px — dense lists
- 28px — primary nav
- 16px — inline com texto

### Critério de conclusão Wave 1

- [ ] `lucide-react` instalado e importável sem erros
- [ ] `tokens.redesign.css` contém o `@import` das fontes + todos os tokens tipográficos scoped
- [ ] Para usuários **com flag ativo**: fontes Public Sans (headings) e Lexend (body) renderizam corretamente
- [ ] Para usuários **sem flag**: app permanece 100% idêntica ao estado anterior (sem quebras visuais)
- [ ] `typography.css` NÃO foi modificado (verificar com `git diff`)

---

## 7. Wave 2 — Surface & Layout System

> **⚠️ ROLLOUT GRADUAL — LEIA ANTES DE EXECUTAR**
>
> As instruções de Sprint abaixo descrevem o **target state** do sistema de superfícies e layout. Para implementar esta wave com rollout gradual, **siga o arquivo `plans/redesign/WAVE_2_SURFACE_LAYOUT.md`** em vez das instruções abaixo.
>
> **O que muda na implementação real:**
> - As classes de superfície NÃO são adicionadas ao `index.css` (sem scoping = afetaria todos os usuários)
> - O grid system NÃO vai em um novo `layout.css` — vai em `layout.redesign.css`
> - Todos os seletores devem incluir `[data-redesign="true"]` como prefixo
> - Classes com conflito de nomes (ex: `.page-title`, `.section-header`) devem ser obrigatoriamente prefixadas
>
> As seções abaixo servem como **referência de target state** e documentação de intenção de design.

### Sprint 2.1 — Surface Utilities

**Target state (referência):** classes adicionadas globalmente — estado final após rollout completo.
**Implementação real:** Classes em `layout.redesign.css` scoped em `[data-redesign="true"]` — ver `WAVE_2_SURFACE_LAYOUT.md`.

Adicionar classes de superfície para o Material 3 tonal architecture:

```css
/* TARGET STATE — na implementação real (rollout): prefixar todos os seletores com [data-redesign="true"] */
/* ============================================
   SURFACE TONAL SYSTEM — "No-Line Rule"
   Profundidade por tom de background, NÃO por bordas.
   ============================================ */

.surface { background-color: var(--color-surface); }
.surface-container { background-color: var(--color-surface-container); }
.surface-container-low { background-color: var(--color-surface-container-low); }
.surface-container-lowest { background-color: var(--color-surface-container-lowest); }
.surface-container-high { background-color: var(--color-surface-container-high); }

/* Sanctuary Card — primary container */
.card-sanctuary {
  background-color: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  padding: 2rem;
  box-shadow: var(--shadow-ambient);
  border: none; /* NO-LINE RULE */
  transition: all 300ms ease-out;
}

.card-sanctuary:hover {
  box-shadow: var(--shadow-editorial);
}

/* Glassmorphism — floating elements only */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

/* Primary gradient button */
.btn-primary-gradient {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  box-shadow: var(--gradient-primary-shadow);
  border-radius: var(--radius-button);
  border: none;
  min-height: 64px;
  padding: 0 2rem;
  font-family: var(--font-body);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-title-lg);
  cursor: pointer;
  transition: all 200ms ease-out;
}

.btn-primary-gradient:hover {
  transform: scale(1.02);
}

.btn-primary-gradient:active {
  transform: scale(0.98);
}
```

### Sprint 2.2 — Layout Grid System

**Target state (referência):** ver abaixo — estado final do grid system.
**Implementação real:** Criar `src/shared/styles/layout.redesign.css` (NÃO `layout.css`) — todo o conteúdo prefixado com `[data-redesign="true"]`. Importar em `index.css` após os arquivos atuais. Ver `WAVE_2_SURFACE_LAYOUT.md`.

```css
/* ============================================
   RESPONSIVE GRID LAYOUT — Therapeutic Sanctuary
   Mobile: single column, p-4 padding
   Desktop: max-w-7xl (80rem) centered
   ============================================ */

.page-container {
  width: 100%;
  max-width: 80rem; /* 1280px */
  margin: 0 auto;
  padding: 1rem;
}

@media (min-width: 768px) {
  .page-container {
    padding: 2rem;
  }
}

/* Desktop sidebar offset */
@media (min-width: 768px) {
  .main-with-sidebar {
    padding-left: 16rem; /* 256px sidebar width */
  }
}

/* Grid patterns */
.grid-1 { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }

@media (min-width: 768px) {
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
  .grid-12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; }
}

/* Dashboard layout: left 4-col, right 8-col */
@media (min-width: 1024px) {
  .grid-dashboard {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 2rem;
  }
}

/* Spacing scale */
.space-y-3 > * + * { margin-top: 1rem; }
.space-y-4 > * + * { margin-top: 1.4rem; }
.space-y-6 > * + * { margin-top: 1.5rem; }
.space-y-8 > * + * { margin-top: 2rem; }
.space-y-10 > * + * { margin-top: 2.5rem; }
.space-y-12 > * + * { margin-top: 3rem; }
```

### Critério de conclusão Wave 2

- [ ] `layout.redesign.css` existe com todas as classes scoped em `[data-redesign="true"]`
- [ ] Para usuários **com flag ativo**: backgrounds são `#f8fafb`, cards sem borders, `.card-sanctuary` funcional
- [ ] Para usuários **sem flag**: app permanece 100% idêntica ao estado anterior
- [ ] `index.css` NÃO recebeu novas classes utilitárias não-scoped (verificar com `git diff`)
- [ ] Grid responsivo funciona em 320px, 768px e 1280px para usuários com flag

---

## 8. Wave 3 — Component Library: Primitives

> **⚠️ ROLLOUT GRADUAL — LEIA ANTES DE EXECUTAR**
>
> As instruções de Sprint abaixo descrevem o **target state** dos componentes primitivos. Para implementar esta wave com rollout gradual, **siga o arquivo `plans/redesign/WAVE_3_COMPONENT_PRIMITIVES.md`** em vez das instruções abaixo.
>
> **O que muda na implementação real:**
> - `Button.jsx`, `Card.jsx`, `Button.css`, `Card.css` **NÃO são alterados**
> - Os estilos vão em `components.redesign.css` via overrides scoped: `[data-redesign="true"] .btn { }`
> - **TODO bloco CSS abaixo deve receber o prefixo `[data-redesign="true"]` na implementação real**
> - A API de props de todos os componentes é imutável
>
> As seções abaixo servem como **referência de target state** e documentação de intenção de design.

### Sprint 3.1 — Button

**Target state (referência):** override de `Button.css` via CSS scoped — ver `WAVE_3_COMPONENT_PRIMITIVES.md`.
**Arquivo real:** `src/shared/styles/components.redesign.css`

**Redesign:**

```
Antes:                          Depois:
┌──────────────┐               ╭──────────────────────────╮
│  Rosa flat   │               │  Gradient verde 64px     │
│  border 1px  │               │  Shadow ambient          │
│  radius sm   │               │  Radius xl (1.25rem)     │
└──────────────┘               │  Hover: scale(1.02)      │
                               │  Active: scale(0.98)     │
                               ╰──────────────────────────╯
```

**Variantes:**
- `primary` — Gradient 135° verde, text white, shadow primary, 64px height
- `secondary` — bg transparent, border outline-variant, text primary
- `error` — bg error, text white, shadow error
- `ghost` — bg transparent, text primary, hover bg state-hover
- `text` — sem background, text primary, underline on hover

**Props existentes:** Manter `variant`, `size`, `disabled`, `loading`, `onClick`, `children`

**Novo CSS:**
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-weight: var(--font-weight-bold);
  border: none;
  cursor: pointer;
  transition: all 200ms ease-out;
  min-height: 56px; /* minimum motor accessibility */
}

.btn-primary {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  box-shadow: var(--gradient-primary-shadow);
  border-radius: var(--radius-button);
  min-height: 64px;
  padding: 0 2rem;
  font-size: var(--text-title-lg);
}

.btn-primary:hover { transform: scale(1.02); }
.btn-primary:active { transform: scale(0.98); }

.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-button);
  padding: 0 1.5rem;
}

.btn-secondary:hover {
  background: var(--state-hover);
}
```

### Sprint 3.2 — Card

**Arquivo:** `src/shared/components/ui/Card.jsx` + `Card.css`

**Redesign — Sanctuary Style:**
- Background: `--color-surface-container-lowest` (#ffffff)
- Shadow: `--shadow-ambient`
- Border: **NONE** (No-Line Rule)
- Border-radius: `--radius-card` (2rem / 32px)
- Padding: 2rem
- Transition: all 300ms ease-out

**Variantes:**
- `default` — sanctuary style
- `section` — bg `surface-container-low`, sem shadow (seção dentro de outra)
- `alert-critical` — bg error-container com border-left 4px error
- `alert-warning` — bg tertiary-fixed com border-left 4px tertiary
- `gradient` — bg gradient primary, text white

### Sprint 3.3 — Input & Form Elements

**Arquivos:** Componentes de form existentes

**Redesign:**
- Background: `--color-surface-container-low`
- Border: **none** em estado normal (tonal shift é suficiente)
- Border on focus: 2px solid `--color-primary`
- Border-radius: `--radius-xl` (1.25rem)
- Height: 56px mínimo
- Font: Lexend 400, `--text-body-lg`
- Placeholder: `--color-outline` at 40% opacity

### Sprint 3.4 — Badge

**Novo componente:** `src/shared/components/ui/Badge.jsx`

```
╭──────────────╮
│ ● URGENTE    │  ← badge com dot + label
╰──────────────╯
```

**Variantes:**
- `critical` — bg error/10, text error
- `warning` — bg tertiary-fixed, text tertiary
- `success` — bg primary-fixed, text primary
- `info` — bg secondary-fixed, text secondary
- `neutral` — bg surface-container, text outline

### Sprint 3.5 — Progress Bar

**Atualizar componentes existentes que usam barras de progresso.**

```css
.progress-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container-highest);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1000ms ease-out;
}

/* Cores semânticas */
.progress-fill-primary { background: var(--color-secondary); }
.progress-fill-error { background: var(--color-error); }
.progress-fill-success { background: var(--color-primary); }
.progress-fill-warning { background: var(--color-tertiary-fixed); }
```

### Sprint 3.6 — List Items (No Dividers)

Padrão de lista sem divisores — separação por espaço ou alternância tonal:

```css
.list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  transition: background 200ms ease-out;
}

.list-item:hover {
  background: var(--color-surface-container-low);
}

/* Leading icon container */
.list-item-icon {
  width: 3rem;    /* 48px */
  height: 3rem;
  border-radius: var(--radius-full);
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}
```

### Critério de conclusão Wave 3

- [ ] `components.redesign.css` existe com todos os overrides scoped em `[data-redesign="true"]`
- [ ] Para usuários **com flag ativo**: Button primary = gradient verde 64px; Cards = sanctuary style; Inputs = 56px radius xl
- [ ] Para usuários **sem flag**: Button, Card e form elements permanecem 100% idênticos ao estado anterior
- [ ] `Button.css`, `Card.css` e arquivos de form NÃO foram modificados (verificar com `git diff`)
- [ ] API de props de Button, Card e Modal: imutável (sem novas props obrigatórias)

---

## 9. Wave 4 — Navigation: BottomNav + Sidebar

> **⚠️ ROLLOUT GRADUAL — PADRÃO W4-W12**
>
> A partir desta wave, a estratégia muda: em vez de CSS scoped, usamos **variantes de componente/view** controladas pelo hook `useRedesign()`.
>
> **Regras para toda execução W4-W12:**
> - **Views atuais (Dashboard.jsx, Treatment.jsx, Stock.jsx, etc.) NÃO são modificadas**
> - Para cada view alterada, criar uma variante em `src/views/redesign/` (ex: `DashboardRedesign.jsx`)
> - `src/App.jsx` usa `useRedesign()` para selecionar qual variante renderizar:
>   ```jsx
>   const { isRedesignEnabled } = useRedesign()
>   // No renderCurrentView():
>   case 'dashboard': return isRedesignEnabled ? <DashboardRedesign /> : <Dashboard />
>   ```
> - Componentes internos de views (RingGauge, DoseZoneList, etc.) podem ser criados como novos arquivos paralelos (`RingGaugeRedesign.jsx`) e usados APENAS pelas views redesenhadas — **sem alterar os originais**
> - Componentes compartilhados (BottomNav, Modal, etc.) são renderizados condicionalmente: `{isRedesignEnabled ? <BottomNavRedesign /> : <BottomNav />}`
> - Todos os novos componentes e views redesenhadas devem ser lazy-loaded via `React.lazy()` para não aumentar o bundle para usuários sem flag
>
> **Spec completa de infraestrutura:** `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md`

### Sprint 4.1 — BottomNav Redesign

**Componente atual:** `src/shared/components/ui/BottomNav.jsx` + `BottomNav.css` — **NÃO alterar**
**Componente novo:** Criar `src/shared/components/ui/BottomNavRedesign.jsx` + `BottomNavRedesign.css`
**Renderização em App.jsx:** `{isAuthenticated && (isRedesignEnabled ? <BottomNavRedesign /> : <BottomNav />)}`

**Design futuro (mobile):**
```
╭───────────────────────────────────────╮
│  📅         💊         📦         👤  │
│ Hoje    Tratamento  Estoque    Perfil │
╰───────────────────────────────────────╯
  ↑ Glass: bg-surface/80 backdrop-blur-12px
  ↑ Fixed bottom, z-50
  ↑ Hidden on md+ screens (sidebar takes over)
```

**Implementação:**
```jsx
import { Calendar, Pill, Package, User } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Hoje', icon: Calendar },
  { id: 'treatment', label: 'Tratamento', icon: Pill },
  { id: 'stock', label: 'Estoque', icon: Package },
  { id: 'profile', label: 'Perfil', icon: User },
]
```

**CSS:**
```css
.bottom-nav-container {
  display: block;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: rgba(248, 250, 251, 0.80);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 0.75rem 1.5rem;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
}

/* Hidden on desktop — sidebar takes over */
@media (min-width: 768px) {
  .bottom-nav-container { display: none; }
}

.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  color: rgba(25, 28, 29, 0.40); /* on-surface at 40% */
  background: none;
  border: none;
  cursor: pointer;
  transition: all 200ms ease-out;
  padding: 0.5rem;
}

.nav-item.active {
  color: var(--color-primary);
  transform: scale(1.1);
}

.nav-label {
  font-family: var(--font-body);
  font-size: 0.625rem; /* label-sm */
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
}
```

### Sprint 4.2 — Desktop Sidebar (NOVO)

**Arquivo:** Criar `src/shared/components/ui/Sidebar.jsx` + `Sidebar.css`

**Design (desktop only, hidden on mobile):**
```
┌──────────────────────┐
│ Meus Remédios        │  ← Logo + wordmark, Public Sans bold, primary
│ Santuário Terapêutico│  ← subtitle, outline color, label-sm
│                      │
│ ▶ Hoje               │  ← active: bg primary, text white, shadow
│   Tratamentos        │  ← inactive: text on-surface/60
│   Estoque            │
│   Perfil             │
│                      │
│                      │
│                      │
│ ┌──────────────────┐ │
│ │ JS  João Silva   │ │  ← User card at bottom
│ │     Hoje, 08:00  │ │
│ │ [+ Medicamento]  │ │  ← Primary gradient CTA
│ └──────────────────┘ │
└──────────────────────┘
```

**CSS:**
```css
.sidebar {
  display: none; /* Hidden on mobile */
  position: fixed;
  left: 0;
  top: 0;
  width: 16rem; /* 256px */
  height: 100vh;
  background: var(--color-surface-container-low);
  padding: 2rem 1rem;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 50;
  overflow-y: auto;
}

@media (min-width: 768px) {
  .sidebar { display: flex; }
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-nav-item);
  font-family: var(--font-body);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 200ms ease-out;
  width: 100%;
  text-align: left;
}

.sidebar-nav-item:hover {
  background: var(--color-surface);
  color: var(--color-on-surface);
}

.sidebar-nav-item.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--gradient-primary-shadow);
  font-weight: var(--font-weight-semibold);
}
```

### Sprint 4.3 — App.jsx Layout Update

**Arquivo:** `src/App.jsx`

**Ação:** Adicionar suporte ao Sidebar e navegação redesenhada, **condicionados ao flag `isRedesignEnabled`**.

```jsx
import { useRedesign } from '@shared/hooks/useRedesign'

// No componente App:
const { isRedesignEnabled } = useRedesign()

// No return — tudo condicionado ao flag:
<OnboardingProvider>
  <DashboardProvider>
    <div className={`app-container ${isRedesignEnabled ? 'has-sidebar' : ''}`}
         data-redesign={isRedesignEnabled ? 'true' : undefined}>
      {/* Sidebar — APENAS para usuários com flag ativo */}
      {isAuthenticated && isRedesignEnabled && (
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      )}

      <main className={`app-main ${isAuthenticated && isRedesignEnabled ? 'main-with-sidebar' : ''}`}>
        {renderCurrentView()}
      </main>

      <OfflineBanner />

      {/* Nav: redesenhada para flag users, original para outros */}
      {isAuthenticated && (
        isRedesignEnabled
          ? <BottomNavRedesign currentView={currentView} setCurrentView={setCurrentView} />
          : <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
      )}

      {/* ... rest (chat, onboarding, install) */}
    </div>
  </DashboardProvider>
</OnboardingProvider>
```

**CSS para sidebar offset** (adicionar em `layout.redesign.css`, scoped):
```css
[data-redesign="true"] .app-main {
  min-height: 100vh;
  position: relative;
  padding-bottom: 80px; /* BottomNavRedesign height on mobile */
}

@media (min-width: 768px) {
  [data-redesign="true"] .main-with-sidebar {
    margin-left: 16rem; /* sidebar width */
    padding-bottom: 0;  /* no bottom nav on desktop */
  }
}
```

**NOTA:** O `data-redesign="true"` aplicado aqui (no `app-container`) é a âncora de CSS scoping para W0-W3. O Sprint 4.3 garante que esse atributo seja adicionado/removido dinamicamente pelo `RedesignContext`.

### Sprint 4.4 — Page Transitions (AnimatePresence)

**Arquivo:** `src/App.jsx`

Wrap `renderCurrentView()` com AnimatePresence **apenas para usuários com flag ativo**:

```jsx
import { motion, AnimatePresence } from 'framer-motion'

// No renderCurrentView() wrapper — condicionado ao flag:
{isRedesignEnabled ? (
  <AnimatePresence mode="wait">
    <motion.div
      key={currentView}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {renderCurrentView()}
    </motion.div>
  </AnimatePresence>
) : renderCurrentView()}
```

**ATENÇÃO:** Framer Motion 12 já está instalado. Usar import de `framer-motion` (não de `motion/react` como nos protótipos).

### Critério de conclusão Wave 4

- [ ] BottomNav mobile: glass, 4 tabs, Lucide icons + labels
- [ ] Sidebar desktop: visible on ≥768px, active state verde gradient
- [ ] Page transitions: soft fade + translate on view switch
- [ ] Mobile: sidebar hidden, bottom nav visible
- [ ] Desktop: sidebar visible, bottom nav hidden
- [ ] App main content offset 256px on desktop

---

## 10. Wave 5 — Motion Language

### Sprint 5.1 — Motion Constants File

**Arquivo:** Criar `src/shared/utils/motionConstants.js`

```js
/**
 * Constantes de animação — Therapeutic Sanctuary Motion Language
 *
 * Regras:
 * 1. GPU-only: transform + opacity APENAS. Nunca animar width/height/margin.
 * 2. Max 400ms para interações, 1000ms para data fills.
 * 3. Sempre respeitar useReducedMotion().
 * 4. 60fps non-negotiable.
 */

// 1. Cascade Reveal — list items entrance
export const cascadeReveal = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },
}

// 2. Living Fill — progress indicators
export const livingFill = {
  ring: {
    transition: { duration: 1, delay: 0.5, ease: 'easeOut' },
  },
  bar: {
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: 1, delay: 0.5, ease: 'easeOut' },
    style: { transformOrigin: 'left' },
  },
}

// 3. Soft Handoff — page transitions
export const softHandoff = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

// 4. Tactile Press — buttons and cards
export const tactilePress = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

// 5. Dose Registration feedback
export const doseConfirmed = {
  check: { scale: [0, 1.3, 1], transition: { duration: 0.3 } },
  counterFlip: { y: [20, 0], opacity: [0, 1], transition: { duration: 0.2 } },
  streakPulse: { scale: [1, 1.15, 1], transition: { duration: 0.5, repeat: 2 } },
}

// Static fallback for prefers-reduced-motion
export const staticFallback = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 1 },
  transition: { duration: 0 },
}
```

### Sprint 5.2 — Atualizar animations.css

> **⚠️ ROLLOUT:** `animations.css` é um arquivo global — edições afetam TODOS os usuários.
> Durante a fase de rollout gradual:
> - **NÃO remover** as animações neon/glow de `animations.css` (usuários sem flag dependem delas)
> - As **novas animações CSS** (fadeInUp, fillWidth, pulse-critical atualizado) devem ser adicionadas em `components.redesign.css` scoped em `[data-redesign="true"]`
> - A remoção das animações antigas de `animations.css` ocorre apenas no **rollout completo (pós-validação)**

**Implementação real (durante rollout):** Adicionar em `src/shared/styles/components.redesign.css`:

```css
/* TARGET STATE — implementação real: [data-redesign="true"] { ... } */

/* Pulse para estoque crítico — cor atualizada */
[data-redesign="true"] .pulse-critical {
  animation: pulse-critical-sanctuary 2s ease-in-out infinite;
}

@keyframes pulse-critical-sanctuary {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  [data-redesign="true"] .pulse-critical { animation: none; }
}

/* Cascade reveal fallback (CSS) */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Living fill fallback (CSS) */
@keyframes fillWidth {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

**Target state (pós-rollout):** Remover versões neon/glow de `animations.css` e substituir pelo conteúdo acima (sem o prefixo scoped).

### Sprint 5.3 — useMotion Hook

**Arquivo:** Criar `src/shared/hooks/useMotion.js`

```js
import { useReducedMotion } from 'framer-motion'
import { softHandoff, cascadeReveal, tactilePress, staticFallback } from '@shared/utils/motionConstants'

/**
 * Hook que retorna variantes de animação respeitando prefers-reduced-motion.
 */
export function useMotion() {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return {
      cascade: { container: {}, item: {} },
      handoff: staticFallback,
      tactile: {},
      fill: { transition: { duration: 0 } },
    }
  }

  return {
    cascade: cascadeReveal,
    handoff: softHandoff,
    tactile: tactilePress,
    fill: { transition: { duration: 1, delay: 0.5, ease: 'easeOut' } },
  }
}
```

### Critério de conclusão Wave 5

- [ ] `motionConstants.js` exporta todas as 4 motion archetypes
- [ ] `useMotion()` hook respeita `prefers-reduced-motion`
- [ ] Animações neon removidas de `animations.css`
- [ ] Cascade Reveal funciona em listas
- [ ] Living Fill funciona em progress bars/rings
- [ ] Soft Handoff funciona em page transitions

---

## 11. Wave 6 — Dashboard (Hoje) Redesign

> **⚠️ ROLLOUT GRADUAL — PADRÃO useRedesign()**
> `Dashboard.jsx` atual NÃO é modificado. Criar `src/views/redesign/DashboardRedesign.jsx` com o novo layout.
> Componentes internos novos (RingGauge com novo visual, PriorityDoseCard, etc.) são criados como arquivos separados e usados APENAS pela view redesenhada.
> App.jsx seleciona qual view renderizar via `isRedesignEnabled`. Ver banner da Wave 4 para o padrão completo.

Esta é a wave mais complexa. O Dashboard é o coração do app.

### Sprint 6.1 — Dashboard Layout

**Arquivo:** `src/views/redesign/DashboardRedesign.jsx` (NOVO — NÃO editar `src/views/Dashboard.jsx`)

**Layout futuro (mobile):**
```
┌──────────────────────────────────────┐
│  Meus Remédios            🔔   👤    │  ← TopBar (mobile only)
├──────────────────────────────────────┤
│                                      │
│     ADESÃO DIÁRIA                    │
│     ╭────────╮                       │
│     │  75%   │                       │
│     │Concluído│                      │
│     ╰────────╯                       │
│                                      │
│  Olá, Dona Maria 👋                  │
│  Faltam apenas 3 doses hoje!         │
│                                      │
├──────────────────────────────────────┤
│  ⚠ ESTOQUE CRÍTICO                   │
│  Metformina termina em 3 dias        │
│  ████░░░ 15%  [Repor Estoque]        │
├──────────────────────────────────────┤
│  PRÓXIMA DOSE • AGORA                │
│ ┌──────────────────────────────────┐ │
│ │ 💊 Losartana Potássica           │ │
│ │    50mg • 1 comprimido           │ │
│ │ ╭────────────────────────────╮   │ │
│ │ │     Tomar Agora            │   │ │  ← 64px gradient button
│ │ ╰────────────────────────────╯   │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  CRONOGRAMA DE HOJE                  │
│  ✅ 07:00  Omeprazol 20mg            │
│  ● 08:00  Losartana Potássica 50mg   │
│  ○ 13:00  Metformina 850mg           │
│  ○ 21:00  Sinvastatina 20mg          │
├──────────────────────────────────────┤
│  ✅ DOSES CONCLUÍDAS                 │
│  ▼ (colapsado)                       │
└──────────────────────────────────────┘
```

**Layout futuro (desktop):**
```
┌─────────────────┬─────────────────────────────────────────────┐
│                 │  Painel de Controle                    🔔👤 │
│   Sidebar       ├──────────────────────┬──────────────────────┤
│                 │                      │                      │
│                 │   ADESÃO DIÁRIA      │  Cronograma de Hoje  │
│                 │   ╭────────╮         │  Sex, 24 de Maio     │
│                 │   │  85%   │         │                      │
│                 │   │Concluído│        │  ☀ MANHÃ             │
│                 │   ╰────────╯         │  ┌─────┐ ┌─────┐     │
│                 │                      │  │Met. │ │Enal.│     │
│                 │  Excelente progresso!│  │TOMAR│ │TOMAR│     │
│                 │  6 de 8 doses        │  └─────┘ └─────┘     │
│                 │                      │                      │
│                 │  ┌─PRIORIDADE MAX──┐ │  ☀ TARDE             │
│                 │  │  08:00          │ │  ┌─────────────┐     │
│                 │  │  Em 15 min      │ │  │Espirono.    │     │
│                 │  │  • Losartana    │ │  └─────────────┘     │
│                 │  │  • Omeprazol    │ │                      │
│                 │  │ [Confirmar]     │ │  🌙 NOITE            │
│                 │  └─────────────────┘ │  ┌─────┐ ┌─────┐     │
│                 │                      │  │Sinv.│ │Atorv│     │
│                 │                      │  └─────┘ └─────┘     │
│                 │                      │                      │
│                 │                      │  ⚠ Estoque Crítico   │
│  [+ Med]        │                      │  Metformina: 4 doses │
└─────────────────┴──────────────────────┴──────────────────────┘
```

**Componentes do Dashboard redesenhado:**

1. **PageHeader / Greeting** — Nome do paciente + data + snapshot de adesão
2. **RingGauge** — Redesenhado (ver Sprint 6.2)
3. **Priority Dose Card** — Card gradient secondary com doses mais urgentes e CTA "Confirmar Agora"
4. **Cronograma por Período** — Agrupado por Manhã/Tarde/Noite (ícones Sun/Moon)
5. **Stock Alert Inline** — Banner error-container com progress bar e CTA
6. **Doses Concluídas** — Seção colapsável ao final

### Sprint 6.2 — RingGauge Redesign

**Arquivo:** `src/features/dashboard/components/RingGaugeRedesign.jsx` (NOVO — NÃO editar `RingGauge.jsx`; usado apenas por `DashboardRedesign.jsx`)

**Mudanças visuais:**
- Stroke width: 12pt (mais grosso, legível em tamanhos pequenos)
- Track color: `--color-secondary` (#005db6) — NÃO mais baseado em score
- Progress color: `--color-primary-fixed` (#90f4e3) — cor única para progress
- Center text: Public Sans 700 (font-display), tamanho headline-md
- Label: "Concluído" ou "adesão" em label-md uppercase tracking widest
- Animation: stroke-dashoffset 1000ms com delay 0.5s (Living Fill, não mais spring)

**Remover:**
- Cor dinâmica por score (vermelho/amarelo/verde/azul) → agora sempre primary-fixed no track
- Emoji-based streak indicators → substituir por texto
- Motivation messages → simplificar

**Tamanhos:**
- `large` (simples): 192px (w-48 h-48)
- `medium` (moderado): 128px
- `compact` (complexo): 64px inline

### Sprint 6.3 — DoseZoneList → Cronograma por Período

**Arquivo:** `src/features/dashboard/components/CronogramaPeriodo.jsx` (NOVO — NÃO editar `DoseZoneList.jsx`; usado apenas por `DashboardRedesign.jsx`)

**Mudanças:**
- Substituir zonas temporais deslizantes (ATRASADAS/AGORA/PRÓXIMAS/MAIS TARDE) por **períodos do dia** (Manhã/Tarde/Noite) como no mockup complex-hoje
- Cada período tem um ícone (Sunrise/Sun/Moon) e um divider sutil
- Cards de medicamento dentro de cada período com:
  - Icon container circular (secondary-fixed bg)
  - Nome (font-bold) + dosagem/horário (label text)
  - Botão "TOMAR" (primary bg) + "ADIAR" (ghost)
  - Status badge: taken (opacity 60%, check icon) ou pending
  - Inline stock warning badge quando stockDays < 15

**Desktop:** Grid 2-col dentro de cada período
**Mobile:** Stack vertical

### Sprint 6.4 — StockBars → Inline Stock Alert

**Arquivo:** `src/features/dashboard/components/StockAlertInline.jsx` (NOVO — NÃO editar `StockBars.jsx`; usado apenas por `DashboardRedesign.jsx`)

No dashboard, StockBars se torna um **alert inline** (não mais widget separado):

```
┌─ ⚠ ────────────────────────────────────────┐
│  Estoque Crítico: Metformina               │
│  4 doses restantes                         │
│  ████░░░░░░░ 15%                           │
│                        [Solicitar Refil →] │
└────────────────────────────────────────────┘
```

- Background: `--color-error-container` at 20% opacity
- Border: none (ou border-left 4px error para urgência)
- Progress bar: 8px full-radius, error color
- CTA: text link "Solicitar Refil" com arrow

### Sprint 6.5 — SmartAlerts Visual Update

**Arquivo:** `src/features/dashboard/components/SmartAlertsRedesign.jsx` (NOVO — NÃO editar `SmartAlerts.jsx`; usado apenas por `DashboardRedesign.jsx`)

**Mudanças visuais:**
- Remover glow/neon effects
- Critical: bg error-container, border-left error
- Warning: bg tertiary-fixed, border-left tertiary
- Info: bg secondary-fixed, border-left secondary
- Ícones: Lucide (AlertTriangle, AlertCircle, Info)
- Ambient shadow, radius xl

### Sprint 6.6 — Priority Dose Card (NOVO)

**Arquivo:** Criar `src/features/dashboard/components/PriorityDoseCard.jsx`

Card gradient (secondary → secondary-container) que destaca a próxima dose urgente:
- Background: gradient from secondary to secondary-container
- Text: white
- Badge: "Prioridade Máxima" com bg white/20
- Horário grande: headline-md (Public Sans bold)
- Subtítulo: "Em 15 minutos"
- Lista de meds do horário
- CTA: "Confirmar Agora" (bg white, text secondary)

### Critério de conclusão Wave 6 + 6.5

- [ ] Dashboard mobile: ring gauge → greeting → priority card → cronograma → stock alert
- [ ] Dashboard desktop: 2-col grid (ring+priority left, cronograma right) ← **W6.5.3**
- [ ] RingGauge: verde/azul sanctuary, não mais neon
- [ ] Label "ADESÃO DIÁRIA" visível acima do ring ← **W6.5.4**
- [ ] Mensagem motivacional contextual abaixo da saudação (4 faixas por score) ← **W6.5.4**
- [ ] Cronograma agrupado por período: **Madrugada/Manhã/Tarde/Noite** (4 períodos) ← **W6.5.5**
- [ ] Cronograma: animação Cascade Reveal nas seções (Framer Motion, prefers-reduced-motion respeitado) ← **W6.5.5**
- [ ] PriorityDoseCard adaptado por persona: simples → card branco + "Tomar Agora" verde; complexo → card azul + "Confirmar Agora" ← **W6.5.4**
- [ ] Stock alert: modo simples → fundo da coluna direita; modo complexo → topo do dashboard (acima do grid) ← **W6.5.4**
- [ ] Stock alert inline com progress bar
- [ ] Touch targets ≥ 56px em todos os botões ← **W6.5.2**
- [ ] Page transition com Soft Handoff

### Melhorias identificadas nas referências — reservadas para W7

Durante a revisão dos mocks de referência (`simple-hoje`, `complex-hoje`) e do PRODUCT_STRATEGY, foram identificados os seguintes elementos **não implementados** na W6/W6.5 por requererem mudanças de schema ou backend. Devem ser considerados na spec da W7:

| Feature | UX Goal | Bloqueador atual |
|---------|---------|-----------------|
| Botão "ADIAR" por dose | Usuário complexo adia a dose sem fechar o app | Backend snooze endpoint + campo no DoseItem |
| Ícone circular por tipo de medicamento | Escaneabilidade visual — Dona Maria identifica remédio pelo ícone | Campo `medicine_type` não exposto pelo `useDoseZones` |
| Instrução de administração ("Após o café", "Em jejum") | Contexto clínico inline na dose, sem abrir o protocolo | Campo `instructions` no schema de protocolo (não existe) |
| Streak proeminente no canto superior direito (desktop) | Reforço positivo para engajamento contínuo de Carlos | Depende de layout de header (responsabilidade do Navigation Shell W4) |

---

## 12. Wave 7 — Tratamentos Redesign

> **Spec detalhada:** `WAVE_7_TREATMENTS_REDESIGN.md`
> **⚠️ ROLLOUT GRADUAL — PADRÃO useRedesign()**
> `Protocols.jsx` atual NÃO é modificado. Criar `src/views/redesign/TreatmentsRedesign.jsx`.
> Componentes internos novos ficam em `src/features/protocols/components/redesign/` — usados APENAS pela view redesenhada.

### Modelo de dados correto

O agrupamento de protocolos segue esta hierarquia de prioridade — **sem keyword maps derivados de nomes**:

1. **`treatment_plans`** (definidos pelo usuário, ex: "Cardiomiopatia — Quarteto Fantástico") — agrupador primário
2. **`medicine.therapeutic_class`** (da base ANVISA, ex: "Antilipêmicos") — fallback para protocolos sem plano
3. **"Medicamentos Avulsos"** — último fallback quando nenhum dos dois existe

Campos relevantes:
- `treatment_plan.color` = hex (default `#6366f1`), `treatment_plan.emoji` (default `💊`)
- `protocol.active` = bool; `protocol.end_date` = YYYY-MM-DD
- `protocol.notes` = notas clínicas livres
- `protocol.titration_status` = `'estável'|'titulando'|'alvo_atingido'`

### Personas e modos de exibição

| Modo | Hook | Exibição |
|------|------|---------|
| `simple` (`isComplex=false`) | `useComplexityMode()` | Lista plana sem headers de grupo — Dona Maria |
| `complex` (`isComplex=true`) | `useComplexityMode()` | Grupos colapsáveis com headers coloridos — Carlos |

### Design futuro (mobile — modo complexo)

```
┌────────────────────────────────────────┐
│  Meus Tratamentos   5 protocolos       │
│  [🔍 Buscar na base ANVISA...]         │
│  [Ativos] [Pausados] [Finalizados]     │
├────────────────────────────────────────┤
│  💙 CARDIOMIOPATIA — QUARTETO ....  ▼  │
│  ┌──────────────────────────────────┐  │
│  │ Metoprolol     25mg              │  │
│  │ Diário · 08:00 / 20:00           │  │
│  │ ⚠ Titulação: Etapa 2/4           │  │
│  │ ██████░░ 75%    [⚠ 8 dias]       │  │
│  ├──────────────────────────────────┤  │
│  │ Dapagliflozina  10mg             │  │
│  │ Diário · 08:00                   │  │
│  │ ██████████ 100%  [● 30 dias]     │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  💊 ANTILIPÊMICOS                   ▼  │
│  ┌──────────────────────────────────┐  │
│  │ Atorvastatina  20mg              │  │
│  │ Diário · 22:00                   │  │
│  │ ██████████ 93%   [● 45 dias]     │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Design futuro (desktop — modo complexo)

```
┌──────────────────────────────────────────────────────────────────┐
│  Meus Tratamentos                          5 protocolos ativos   │
│  [🔍 Buscar na base ANVISA...]  [Ativos] [Pausados] [Finalizados]│
├──────────────────────────────────────────────────────────────────┤
│  💙 CARDIOMIOPATIA — QUARTETO FANTÁSTICO                         │
├──────────────┬────────────┬─────────┬──────────────┬─────────────┤
│  Medicamento │  Posologia │  Freq.  │  Adesão 7d   │  Estoque    │
├──────────────┼────────────┼─────────┼──────────────┼─────────────┤
│  Metoprolol  │  1cp 25mg  │  1×/dia │  ██████░ 75% │  ⚠ 8 dias   │
│  ⚠ Titulação: Etapa 2/4 · próxima etapa em 6 dias                │
├──────────────┼────────────┼─────────┼──────────────┼─────────────┤
│  Dapagliflo. │  1cp 10mg  │  1×/dia │  ██████████  │  ● 30 dias  │
├──────────────┴────────────┴─────────┴──────────────┴─────────────┤
│  💊 ANTILIPÊMICOS                                                │
├──────────────┬────────────┬─────────┬──────────────┬─────────────┤
│  Atorvastati.│  1cp 20mg  │  1×/dia │  █████████░  │  ● 45 dias  │
└──────────────┴────────────┴─────────┴──────────────┴─────────────┘
```

### Sprints (visão geral)

| Sprint | Entregável | Arquivo criado |
|--------|-----------|----------------|
| S7.1 | Hook `useTreatmentList` — busca todos os protocolos + estoque + adesão 7d + titulação | `src/features/protocols/hooks/useTreatmentList.js` |
| S7.2 | Sub-componentes: `AdherenceBar7d`, `StockPill`, `TitrationBadge`, `ProtocolRow`, `TreatmentPlanHeader` | `src/features/protocols/components/redesign/*.jsx` |
| S7.3 | Modo simples: lista plana sem grupos | `src/views/redesign/TreatmentsSimple.jsx` |
| S7.4 | Modo complexo: grupos colapsáveis com header colorido | `src/views/redesign/TreatmentsComplex.jsx` |
| S7.5 | Tab bar (Ativos/Pausados/Finalizados) + ANVISA search bar com smart routing | `src/features/protocols/components/redesign/TreatmentTabBar.jsx` + `AnvisaSearchBar.jsx` |
| S7.6 | Orquestração `TreatmentsRedesign.jsx` + wiring em `App.jsx` (lazy + Suspense + feature flag) | `src/views/redesign/TreatmentsRedesign.jsx` |
| S7.7 | CSS completo em `layout.redesign.css` + motion via `useMotion().cascade` | `src/shared/styles/layout.redesign.css` |

### Comportamento da busca ANVISA

A busca inline retorna medicamentos da base F5.6. Ao selecionar um resultado:
- **Medicamento já tem protocolo cadastrado** → navega para edição do protocolo existente (view `protocols` original)
- **Medicamento sem protocolo** → abre `TreatmentWizard` em modal com `preselectedMedicine` prop

### Indicador de adesão

Barra de preenchimento (não quadradinhos diários) baseada no score `calculateAllProtocolsAdherence('7d')`:
- ≥ 80%: verde (`#22c55e`)
- 60–79%: âmbar (`#f59e0b`)
- < 60%: vermelho (`#ef4444`)

### Derivação de tab por protocolo

```
tabStatus = end_date < hoje → 'finalizado'
          | active === false → 'pausado'
          | default         → 'ativo'
```

> **CRÍTICO:** Usar `parseLocalDate()` de `@utils/dateUtils` — NUNCA `new Date('YYYY-MM-DD')`

### Serviços utilizados (não modificar)

| Service | Função | Retorno relevante |
|---------|--------|------------------|
| `adherenceService` | `calculateAllProtocolsAdherence('7d')` | `Array<{protocolId, score}>` |
| `titrationService` | `getTitrationSummary(protocol)`, `isTitrationActive(protocol)`, `formatDose()`, `formatDaysRemaining()` | shape completo em `WAVE_7_TREATMENTS_REDESIGN.md` |
| `stockService` | `getStockSummary(medicineId)` | `{total_quantity}` via `medicine_stock_summary` view |
| `refillPredictionService` | `predictRefill({medicineId, currentStock, logs, protocols})` | `{daysRemaining}` |
| `treatmentPlanService` | `getAll()` | planos com protocolos nested |

### Critério de conclusão Wave 7

- [ ] `useTreatmentList` busca todos os protocolos (ativos + pausados + finalizados) via Supabase direto
- [ ] Agrupamento: `treatment_plans` → `therapeutic_class` → "Avulsos" (sem keyword map)
- [ ] Tabs Ativos/Pausados/Finalizados com contadores e `tabStatus` derivado corretamente
- [ ] `AdherenceBar7d` baseada em score 7d (barra, não quadradinhos)
- [ ] `StockPill` com status visual (critical/low/normal/high) e dias restantes
- [ ] `TitrationBadge` apenas quando `isTitrationActive(protocol) === true`
- [ ] Rows expandíveis (modo complex): titulação + notas clínicas
- [ ] Busca ANVISA inline: smart routing (editar protocolo existente ou abrir TreatmentWizard)
- [ ] Modo simples: lista plana — Dona Maria
- [ ] Modo complexo: grupos colapsáveis com header colorido — Carlos
- [ ] Desktop (≥1024px): layout tabular mais denso
- [ ] `TreatmentsRedesign` lazy-loaded com `React.lazy()` + `Suspense` + `ViewSkeleton`
- [ ] Touch targets ≥ 56px em todas as áreas clicáveis
- [ ] `Protocols.jsx` original intocado
- [ ] `npm run validate:agent` passa sem erros

---

## 13. Wave 8 — Estoque Redesign

> **⚠️ ROLLOUT GRADUAL — PADRÃO useRedesign()**
> `Stock.jsx` atual NÃO é modificado. Criar `src/views/redesign/StockRedesign.jsx`.
> `StockCard.jsx` é um componente novo — criado diretamente (sem arquivo original a preservar).

### Sprint 8.1 — Stock Layout

**Design futuro (mobile):**
```
┌──────────────────────────────────────┐
│  Controle de Estoque                 │
│  Prioridade de Reabastecimento       │
├──────────────────────────────────────┤
│  ⚠ CRÍTICO                           │
│  ┌──────────────────────────────────┐│
│  │ Losartana Potássica              ││
│  │ 50mg • 3 comprimidos             ││
│  │ ████░░░░ Restam 3 dias           ││
│  │ ╭──────────────────────────╮     ││
│  │ │    Reabastecer Agora     │     ││
│  │ ╰──────────────────────────╯     ││
│  └──────────────────────────────────┘│
├──────────────────────────────────────┤
│  ⚠ ATENÇÃO                           │
│  ┌──────────────────────────────────┐│
│  │ Atorvastatina 20mg               ││
│  │ 4 comprimidos • Restam 6 dias    ││
│  │ [Registrar Compra]               ││
│  └──────────────────────────────────┘│
├──────────────────────────────────────┤
│  TODOS OS ITENS          Tudo 📦     │
│  ┌──────────────────────────────────┐│
│  │ Metformina 850mg      45 un      ││
│  │ Vitamina D3            8 cáps    ││
│  └──────────────────────────────────┘│
├──────────────────────────────────────┤
│  HISTÓRICO DE ENTRADAS    Ver Tudo   │
│  • Compra Realizada  +30un  14/03    │
│  • Ajuste Manual     -2un   12/03    │
└──────────────────────────────────────┘
```

**Design futuro (desktop):**
```
┌──────────────────────────────────────────────────────────────┐
│  Estoque de Medicamentos           Relatórios | Farmácias    │
├──────────────────────────────────────────────────────────────┤
│  ⚠ 3 itens precisam de reposição imediata                    │
├─────────────────────┬────────────────────┬───────────────────┤
│  ┌─ URGENTE ─────┐  │  ┌─ ATENÇÃO ────┐  │  ┌─ SEGURO ─────┐ │
│  │ Atorvast.     │  │  │ Losartana    │  │  │ Metformina   │ │
│  │    2 DIAS     │  │  │    5 DIAS    │  │  │   24 DIAS    │ │
│  │ ████░░ 6%     │  │  │ █████░ 15%   │  │  │ ███████ 80%  │ │
│  │ [Reabastecer] │  │  │ [Registrar]  │  │  │  [Agendar]   │ │
│  └───────────────┘  │  └──────────────┘  │  └──────────────┘ │
│  ┌───────────────┐  │  ┌──────────────┐  │  ┌──────────────┐ │
│  │ Ômega 3       │  │  │ Levotirox.   │  │  │ Simeticona   │ │
│  │    1 CÁP      │  │  │    6 DIAS    │  │  │   30+ DIAS   │ │
│  │ [Registrar]   │  │  │ [Registrar]  │  │  │  [Agendar]   │ │
│  └───────────────┘  │  └──────────────┘  │  └──────────────┘ │
├─────────────────────┴────────────────────┴───────────────────┤
│  HISTÓRICO DE ENTRADAS                           Ver Tudo    │
└──────────────────────────────────────────────────────────────┘
```

### Sprint 8.2 — StockCard Component

**Arquivo:** Criar `src/features/stock/components/StockCard.jsx`

Card individual por medicamento:
- Border-left: 4px (error/tertiary/primary por status)
- Badge status: "URGENTE" (error), "ATENÇÃO" (warning), "SEGURO" (primary)
- Dias restantes: número grande (headline), "DIAS" label
- Progress bar: 8px, cor por status
- CTA: "Comprar Agora" (error), "Reabastecer" (secondary), "Agendar Compra" (ghost)

### Sprint 8.3 — Critical Alert Banner

**Arquivo:** `src/views/redesign/StockRedesign.jsx` (NÃO editar `Stock.jsx`)

Banner topo:
- Background: error-container/30
- Border-left: 8px error
- Ícone AlertTriangle
- Título: "N itens precisam de reposição imediata"
- CTA: gradient error button "Comprar Tudo Agora"

### Sprint 8.4 — Histórico de Entradas

Seção colapsável com últimas compras/ajustes:
- Lista sem dividers
- Ícone + descrição + quantidade + data
- "Ver Tudo" link

### Critério de conclusão Wave 8

- [ ] Critical alert banner no topo
- [ ] Grid de StockCards (1-col mobile, 3-col desktop)
- [ ] Cards com border-left colorido por status
- [ ] Dias restantes como número grande e legível
- [ ] Progress bars 8px full-radius
- [ ] CTAs diferenciados por urgência

---

## 14. Wave 9 — Perfil & Saúde Redesign

> **⚠️ ROLLOUT GRADUAL — PADRÃO useRedesign()**
> `Profile.jsx`, `HealthHistory.jsx` e `Emergency.jsx` atuais NÃO são modificados.
> Criar variantes em `src/views/redesign/` para cada view.

### Sprint 9.1 — Profile View

**Arquivo:** `src/views/redesign/ProfileRedesign.jsx` (NÃO editar `src/views/Profile.jsx`)

Design: "flat utility layout, no visual drama" (PRODUCT_STRATEGY)

```
┌──────────────────────────────────────┐
│        ╭────╮                        │
│        │ JS │  João da Silva         │
│        ╰────╯  Membro desde 2024     │
├──────────────────────────────────────┤
│  👤 Dados Pessoais           >       │
│  🛡 Privacidade e Segurança  >       │
│  🔔 Notificações             >       │
│  ⚙ Preferências              >       │
│  ❓ Ajuda e Suporte           >      │
├──────────────────────────────────────┤
│  [Sair da Conta]                     │
│  Versão 3.3.0 • Meus Remédios        │
└──────────────────────────────────────┘
```

- Avatar: initials em circle (secondary-fixed bg)
- Menu items: sanctuary list items (icon container + label + description + chevron)
- Hover: bg surface-container-low
- No cards, no shadows — flat utility

### Sprint 9.2 — HealthHistory Updates

**Arquivo:** `src/views/redesign/HealthHistoryRedesign.jsx` (NÃO editar `src/views/HealthHistory.jsx`)

- Calendar heat map: atualizar cores para novo palette (verde/amarelo/vermelho do novo system)
- Sparkline: atualizar cores
- Insights: atualizar cards para sanctuary style

### Sprint 9.3 — Emergency Card

**Arquivo:** `src/views/redesign/EmergencyRedesign.jsx` (NÃO editar `src/views/Emergency.jsx`)

- Atualizar visual para novo design system
- Manter funcionalidade offline

### Critério de conclusão Wave 9

- [ ] Profile: flat utility layout, sem drama visual
- [ ] Avatar com initials
- [ ] Menu items como sanctuary list items
- [ ] HealthHistory: cores atualizadas
- [ ] Emergency: visual atualizado

---

## 15. Wave 10 — Perfil Hub, Histórico Calendar-Driven & Settings Extraction

> **Escopo revisado (2026-03-27):** Wave 10 foi reformulada após avaliação de mocks de referência do designer. O escopo original (Progressive Disclosure) foi absorvido parcialmente — o controle de densidade da interface faz parte da Settings Extraction (10A), e a diferenciação Simples/Complex é aplicada no Histórico (10C). ProgressiveTooltip e Escalation Path movidos para wave futura.

**Spec completa:** `WAVE_10_PERFIL_HISTORICO_SETTINGS.md`
**Status:** ✅ COMPLETA — 10A (PR #435) + 10B (PR #436) + 10C (PR #437), todas em main

### Sub-Wave 10A — Settings Extraction ✅ ENTREGUE (PR #435, 2026-03-27)
**Spec:** `WAVE_10A_SETTINGS_EXTRACTION.md`
- [x] `SettingsRedesign.jsx` como view independente
- [x] Extraídos: Telegram, Densidade, Senha, Admin DLQ do ProfileRedesign
- [x] Ícone ⚙️ no header do Perfil → navega para Settings
- [x] Rota `settings` no App.jsx (apenas redesign)
- [x] Controle de densidade com 3 opções (Simples/Automático/Complexo) + descrição de cada modo

### Sub-Wave 10B — Profile Hub + Migração de Dados ✅ ENTREGUE (PR #436, 2026-03-27)
**Spec:** `WAVE_10B_PROFILE_HUB.md`
- [x] Rewrite do ProfileRedesign como hub centralizado
- [x] Dados do paciente (nome, idade, tipo sanguíneo, localização) em destaque
- [x] Cartão de Emergência como card visual com QR
- [x] Grid "Ferramentas de Gestão"
- [x] Migração de dados: localStorage → Supabase (novas colunas em `user_settings`)

### Sub-Wave 10C — Histórico Calendar-Driven ✅ ENTREGUE (PR #437, 2026-03-28)
**Spec:** `WAVE_10C_HISTORICO_CALENDAR.md`
- [x] KPI cards (adesão, sequência, doses/mês)
- [x] Calendário como controle principal (click dia → doses do dia)
- [x] Infinite scroll (Virtuoso) eliminado no redesign — phase-loading por mês
- [x] Modo Simples: KPI + calendário + doses do dia
- [x] Modo Complex: + gráfico adesão 30d + padrão por período
- [x] GlobalDoseModal compartilhado (App.jsx + DashboardProvider + mr:dose-saved event)
- [x] HistoryLogCard 3 linhas: medicamento+dosagem / protocolo / quantidade tomada
- [x] logService.getByMonthSlim expandido com protocol + medicine details
- [x] Backlog: Issue #438 (refactor custom hooks — useHealthHistoryData, useLogEditingModal, useFeedbackMessages)

### Critério de conclusão Wave 10 ✅ TODOS CONCLUÍDOS

- [x] Settings é view separada, acessada via ⚙️ no header do Perfil
- [x] Perfil é hub centralizado com dados do paciente e Ferramentas
- [x] Dados de perfil persistidos no Supabase
- [x] Histórico navega por calendário (click dia → doses do dia)
- [x] Modo Simples vs Complex funciona no Histórico
- [x] Scroll infinito eliminado do redesign do Histórico
- [x] Views originais intactas (fallback quando redesign desligado)

---

## 16. Wave 11 — Forms & Modals Redesign

> **Escopo:** Redesenhar TODOS os formulários, modais e wizards do produto para o design system Santuário. Estas são as superfícies de interação mais críticas — onde o usuário INSERE dados. Sem esta wave, toda view redesenhada abre modais/forms com visual neon antigo.

### Inventário de Gaps

| Componente | Arquivo | Usado em |
|-----------|---------|----------|
| Modal (base) | `src/shared/components/ui/Modal.jsx` | 12+ locais — **KEYSTONE BLOCKER** |
| LogForm | `src/shared/components/log/LogForm.jsx` | History, GlobalDoseModal, Dashboard |
| MedicineForm | `src/features/medications/components/MedicineForm.jsx` | Medicines view, Onboarding |
| ProtocolForm | `src/features/protocols/components/ProtocolForm.jsx` | Protocols view, Onboarding |
| TreatmentPlanForm | `src/features/protocols/components/TreatmentPlanForm.jsx` | Treatments view |
| TitrationWizard | `src/features/protocols/components/TitrationWizard.jsx` | ProtocolForm |
| TreatmentWizard | `src/features/protocols/components/TreatmentWizard.jsx` | Treatments view |
| StockForm | `src/features/stock/components/StockForm.jsx` | Stock view, Onboarding |
| EmergencyCardForm | `src/features/emergency/components/EmergencyCardForm.jsx` | Emergency view |
| ExportDialog | `src/features/export/components/ExportDialog.jsx` | Profile, Settings |
| ReportGenerator | `src/features/reports/components/ReportGenerator.jsx` | Profile, Settings |
| DailyDoseModal | `src/features/dashboard/components/DailyDoseModal.jsx` | Dashboard |

### Sprint 11.1 — Modal Base Redesign (KEYSTONE)

**Arquivo:** `src/shared/components/ui/Modal.jsx` + `Modal.css`

O Modal é usado por 12+ componentes. Redesenhá-lo primeiro desbloqueia todos os diálogos.

- Scoped redesign via `[data-redesign="true"]` (mesmo CSS file, seletor condicional)
- Overlay: `rgba(25,28,29,0.40)` + `backdrop-filter: blur(8px)` (glass effect)
- Container: `surface-container-lowest` (#fff), border-radius `2rem`, padding `2rem`
- Shadow: ambient only `0 24px 24px rgba(25,28,29,0.04)`
- Close button: lucide `X` icon, top-right, 56px touch target
- Title: `title-lg` (Lexend 600), `on-surface`
- Focus trap + `role="dialog"` + `aria-modal="true"` (a11y prep para W15)
- Entrance: fade + scale(0.95→1), 200ms ease-out
- Exit: fade, 150ms
- `prefers-reduced-motion`: fallback sem scale

### Sprint 11.2 — LogForm Redesign

**Arquivo:** `src/shared/components/log/LogForm.jsx` + `LogForm.css`

O formulário de registro de dose é a interação mais frequente do app.

- Inputs: 56px height, border-radius `xl` (1.25rem), `surface-container-low` background
- Labels: `label-md` (Lexend 600), `on-surface`
- Select dropdowns: sanctuary style, custom arrow icon
- Date/time pickers: styled com tokens
- CTA "Registrar Dose": primary gradient, 64px, full-width
- Feedback: success toast com `primary-fixed` background
- Validação inline: `error` color, mensagem abaixo do campo
- Layout: vertical stack, `1rem` gap entre campos

### Sprint 11.3 — MedicineForm Redesign

**Arquivo:** `src/features/medications/components/MedicineForm.jsx` + `MedicineForm.css`

- Mesmos padrões de input do Sprint 11.2
- ANVISA search input: destaque visual, ícone de busca (lucide `Search`)
- Type selector (comprimido/cápsula/líquido/etc): cards selecionáveis com ícones (lucide `Pill`, `Droplets`, `Syringe`, etc.)
- Dosage inputs: layout inline (quantidade + unidade lado a lado)
- CTA "Salvar Medicamento": primary gradient

### Sprint 11.4 — ProtocolForm + TreatmentPlanForm + TitrationWizard + TreatmentWizard

**Arquivos:**
- `src/features/protocols/components/ProtocolForm.jsx` + CSS
- `src/features/protocols/components/TreatmentPlanForm.jsx` + CSS
- `src/features/protocols/components/TitrationWizard.jsx` + CSS
- `src/features/protocols/components/TreatmentWizard.jsx` + CSS

- ProtocolForm: frequency selector como segmented control, time schedule com chips
- TreatmentPlanForm: protocol list com drag handles, add protocol inline
- TitrationWizard: step cards com progress indicator (primary-fixed dots), sanctuary card style
- TreatmentWizard: multi-step flow com back/next navigation sanctuary style

### Sprint 11.5 — StockForm Redesign

**Arquivo:** `src/features/stock/components/StockForm.jsx` + `StockForm.css`

- Medicine selector: search + dropdown sanctuary style
- Quantity + unit price: inline layout com prefixo "R$"
- Expiration date: date picker styled
- Notes: textarea com counter
- CTA "Registrar Compra": primary gradient

### Sprint 11.6 — ExportDialog + ReportGenerator

**Arquivos:**
- `src/features/export/components/ExportDialog.jsx` + CSS
- `src/features/reports/components/ReportGenerator.jsx` + CSS

- ExportDialog: opções como cards selecionáveis (JSON, CSV), preview, CTA "Exportar"
- ReportGenerator: seleção de período, preview do relatório, CTA "Gerar PDF"
- Ambos dentro de Modal redesenhado (S11.1)

### Sprint 11.7 — EmergencyCardForm + DailyDoseModal

**Arquivos:**
- `src/features/emergency/components/EmergencyCardForm.jsx`
- `src/features/dashboard/components/DailyDoseModal.jsx`

- EmergencyCardForm: campos de contato com ícones, alergias como chips
- DailyDoseModal: lista de doses pendentes, confirmação individual ou em lote

### Critério de conclusão Wave 11

- [ ] Modal.jsx renderiza sanctuary style quando `[data-redesign="true"]`
- [ ] TODOS os 10 forms/dialogs listados seguem o design system (inputs 56px, radius xl, tokens CSS)
- [ ] Nenhuma modal/form abre com visual neon quando redesign está ativo
- [ ] `npm run validate:agent` passa
- [ ] Wizards (TitrationWizard, TreatmentWizard, Onboarding) usam step indicators redesenhados

---

## 17. Wave 12 — Medicines View & Consultation Mode

> **Escopo:** Duas views que NÃO têm branching `isRedesignEnabled` no App.jsx e ainda renderizam componentes antigos para todos os usuários.

### Inventário de Gaps

| View | Arquivo | Branching em App.jsx | Status |
|------|---------|---------------------|--------|
| Medicines | `src/views/Medicines.jsx` | **NENHUM** — sempre renderiza old | Sem redesign variant |
| Consultation | `src/views/Consultation.jsx` | **NENHUM** — sempre renderiza old | Parcial — ConsultationView legacy |

### Sprint 12.1 — MedicinesRedesign View

**Arquivo:** `src/views/redesign/MedicinesRedesign.jsx` + CSS

A view de medicamentos é a interface de CRUD primária. Precisa de redesign completo:

- Page header: "Medicamentos" com ícone `Pill` (lucide), botão "Adicionar" (primary gradient)
- Lista de medicamentos: cards sanctuary style com:
  - Nome + concentração (dosage_per_pill + unit)
  - Tipo (ícone + label)
  - Protocolo(s) associado(s) se houver
  - Badge de status (ativo/inativo)
- Empty state: "Nenhum medicamento registrado. Comece adicionando seu primeiro remédio." + CTA
- Click card → abre MedicineForm redesenhado (W11) em Modal
- Delete: confirmação via Modal sanctuary (não `window.confirm()`)
- Search/filter: campo de busca top com ícone Search
- **App.jsx:** Adicionar branching `isRedesignEnabled` no `case 'medicines'`

### Sprint 12.2 — ConsultationRedesign View

**Arquivo:** `src/views/redesign/ConsultationRedesign.jsx` + CSS

O modo consulta é usado para mostrar dados ao médico. Precisa parecer profissional e editorial:

- Layout: leitura editorial — max-width `65ch`, tipografia `body-lg`
- Seções: medicamentos ativos, protocolos, adesão, histórico recente
- Print-friendly: CSS `@media print` com tokens de impressão
- Navegação: botão "Voltar ao Perfil" com ícone `ArrowLeft`
- CTA "Gerar PDF": usa ReportGenerator redesenhado (W11)
- **App.jsx:** Adicionar branching `isRedesignEnabled` no `case 'consultation'`

### Critério de conclusão Wave 12

- [ ] `MedicinesRedesign.jsx` criado e integrado no App.jsx
- [ ] `ConsultationRedesign.jsx` criado e integrado no App.jsx
- [ ] CRUD de medicamentos funciona end-to-end no redesign (add/edit/delete)
- [ ] Modo consulta renderiza dados em estilo editorial Santuário
- [ ] `window.confirm()` eliminado — todas confirmações via Modal redesign

---

## 18. Wave 13 — Landing, Auth & Onboarding

> **Escopo:** A jornada de entrada do usuário — da landing page à primeira dose registrada. Hoje essa jornada inteira está no visual antigo, incluindo 5 steps de onboarding que usam os forms legacy.
> **Exceção rollout:** Landing.jsx é pré-autenticação — pode ser redesenhada direto SE aprovada para todos os usuários simultaneamente (decisão do product owner).

### Inventário de Gaps

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Landing Page | `src/views/Landing.jsx` | Tem A/B test `?landingVariant=new` SEPARADO do `useRedesign()` |
| Auth (Login/Signup) | `src/views/Auth.jsx` | `.glass-card`, `.auth-container` — visual neon puro |
| OnboardingWizard | `src/shared/components/onboarding/OnboardingWizard.jsx` | 5 steps com forms legacy |
| WelcomeStep | `src/shared/components/onboarding/WelcomeStep.jsx` | Old CSS |
| FirstMedicineStep | `src/shared/components/onboarding/FirstMedicineStep.jsx` | Usa MedicineForm antigo |
| FirstProtocolStep | `src/shared/components/onboarding/FirstProtocolStep.jsx` | Usa ProtocolForm antigo |
| StockStep | `src/shared/components/onboarding/StockStep.jsx` | Usa StockForm antigo |
| TelegramIntegrationStep | `src/shared/components/onboarding/TelegramIntegrationStep.jsx` | Old CSS |

### Sprint 13.1 — Landing Page Redesign

**Arquivo:** `src/views/redesign/LandingRedesign.jsx` + CSS

- Hero com Verde Saúde gradient background
- Typography: Public Sans display para headline
- CTA: primary gradient button "Começar Agora", 64px
- Features: 3 sanctuary cards com ícones lucide
- Social proof: testimonials em estilo editorial
- Footer: links + versão
- **DECISÃO:** Integrar com `useRedesign()` OU substituir Landing direta (sem flag)
- **App.jsx:** Adicionar branching no `case 'landing'`

### Sprint 13.2 — Auth View Redesign

**Arquivo:** `src/views/redesign/AuthRedesign.jsx` + CSS

- Background: `surface`
- Card: sanctuary style centered, max-width 400px
- Logo: Verde Saúde identity topo
- Inputs: 56px, radius xl, surface-container-low bg
- Password toggle: eye icon (lucide `Eye`/`EyeOff`)
- CTA Login/Signup: primary gradient, 64px
- Toggle login/signup: link text, `primary` color
- Error messages: `error` color, inline
- **App.jsx:** Auth modal usa AuthRedesign quando flag ativo

### Sprint 13.3 — Onboarding Wizard Redesign

**Arquivo:** `src/shared/components/onboarding/redesign/OnboardingWizardRedesign.jsx` + CSS

- Step indicators: circles com `primary-fixed` (active) / `outline-variant` (inactive)
- Progress bar: thin line topo, `primary` fill animated
- Cards: sanctuary style, max-width 560px
- Copy: warm, encouraging, imperativo direto
- Transitions: Soft Handoff entre steps (AnimatePresence)
- Back/Skip: secondary buttons, 56px
- Next/Concluir: primary gradient, 64px

### Sprint 13.4 — Onboarding Steps Redesign

**Arquivos:** 5 steps em `src/shared/components/onboarding/redesign/`

- **WelcomeStepRedesign:** Ilustração/ícone verde, headline Public Sans, body Lexend, CTA "Vamos Começar"
- **FirstMedicineStepRedesign:** Usa MedicineForm redesenhado (W11.3) dentro de wizard
- **FirstProtocolStepRedesign:** Usa ProtocolForm redesenhado (W11.4) dentro de wizard
- **StockStepRedesign:** Usa StockForm redesenhado (W11.5) dentro de wizard
- **TelegramIntegrationStepRedesign:** QR code + token input, ícone `MessageCircle`, CTA "Conectar Telegram"

### Critério de conclusão Wave 13

- [x] Landing page transmite Verde Saúde identity em 3 segundos
- [x] Auth form usa novo design system
- [x] Onboarding wizard 5 steps visualmente Santuário
- [x] Steps de onboarding usam forms redesenhados (W11)
- [x] Transições entre steps com Soft Handoff
- [x] Jornada completa (landing → auth → onboarding → dashboard) sem visual antigo

### Entrega Wave 13 (2026-03-31, PR #441)

✅ **Sprint 13.1 — Landing:** A/B test removido, variante `new` promovida, 19+ cores azuis → verde terapêutico (#006a5e), tipografia Sanctuary

✅ **Sprint 13.2 — Auth:** Reescrita completa CSS (zero neon/glass), botão X fechar (canto superior esquerdo), submit button via `<button>` nativo (AP-W25 — Button component conflict), `data-redesign="true"` no container

✅ **Sprint 13.3 — Onboarding Shell:** `OnboardingWizard.css` com tokens Sanctuary hardcoded em `.onboarding-overlay` (isolamento total do tema neon), z-index 1200 (acima FABs), botões nav nativos (`<button>`)

✅ **Sprint 13.4 — Onboarding Steps:** Overrides neon → verde em FirstMedicineStep, FirstProtocolStep, StockStep; FirstMedicineStep com estado de confirmação (preserva medicamento ao navegar de volta); botão "Próximo" desabilitado até passo obrigatório salvo

✅ **Pós-autenticação:** `RedesignContext.enableRedesign()` chamado em `App.jsx` `onAuthSuccess` — todos os usuários da landing entram na experiência logada com redesign ativado

**Commits:** 7394f95 (fixes onboarding), 4180c93 (memory journal), 0a78d2b (design tokens via color-mix)

**Impacto:** Landing + Auth + Onboarding = 100% Sanctuary visual, zero neon residual em superfícies pré-auth, jornada de ativação redesenhada completa (W13 fecha o redesign user journey até o dashboard).

---

## 19. Wave 14 — Shared Components & Chatbot

> **Escopo:** Componentes compartilhados que aparecem DENTRO das views redesenhadas mas ainda carregam visual antigo, mais o chatbot IA que é acessado globalmente.

### Inventário de Gaps

| Componente | Arquivo | Usado em | Status |
|-----------|---------|----------|--------|
| AlertList | `src/shared/components/ui/AlertList.jsx` | SmartAlerts, StockAlerts | OLD |
| Loading | `src/shared/components/ui/Loading.jsx` | Todos os views | OLD |
| EmptyState | `src/shared/components/ui/EmptyState.jsx` | Vários views | OLD |
| Badge | `src/shared/components/ui/Badge.jsx` | Vários views | OLD |
| Card | `src/shared/components/ui/Card.jsx` | Vários views | OLD |
| Button | `src/shared/components/ui/Button.jsx` | Todos os forms | OLD |
| Calendar | `src/shared/components/ui/Calendar.jsx` | History, Dashboard | PARCIAL (overrides em .hhr-view) |
| FloatingActionButton | `src/shared/components/ui/FloatingActionButton.jsx` | Vários | OLD (substituído pelo FAB em App.jsx para redesign, mas componente persiste) |
| ThemeToggle | `src/shared/components/ui/ThemeToggle.jsx` | Nav | OLD |
| OfflineBanner | `src/shared/components/ui/OfflineBanner.jsx` | Todos | OLD |
| InstallPrompt | `src/shared/components/pwa/InstallPrompt.jsx` | Global | OLD |
| ChatWindow | `src/features/chatbot/components/ChatWindow.jsx` | Global FAB | OLD |
| BadgeDisplay | `src/shared/components/gamification/BadgeDisplay.jsx` | Dashboard | OLD |
| MilestoneCelebration | `src/shared/components/gamification/MilestoneCelebration.jsx` | Dashboard | OLD |
| ConfettiAnimation | `src/shared/components/ui/animations/ConfettiAnimation.jsx` | Onboarding | OLD |

### Sprint 14.1 — Core Primitives Redesign (Button, Card, Badge, EmptyState)

**Arquivos:**
- `src/shared/components/ui/Button.jsx` + CSS
- `src/shared/components/ui/Card.jsx` + CSS
- `src/shared/components/ui/Badge.jsx` + CSS
- `src/shared/components/ui/EmptyState.jsx` + CSS

Scoped redesign via `[data-redesign="true"]` no CSS:

- **Button:** primary gradient (64px), secondary outline (56px), ghost (text only), danger (`error`). Radius `xl`. Hover `scale(1.02)`, active `scale(0.98)`
- **Card:** `surface-container-lowest`, no borders, radius `2rem`, ambient shadow, padding `2rem`
- **Badge:** pill shape, `label-md`, variantes: success/warning/error/info/neutral
- **EmptyState:** ícone lucide muted, headline `title-lg`, body `body-lg`, CTA opcional. Copy encorajador.

### Sprint 14.2 — Feedback Components (Loading, AlertList, OfflineBanner, Toast)

**Arquivos:**
- `src/shared/components/ui/Loading.jsx` + CSS
- `src/shared/components/ui/AlertList.jsx` + CSS
- `src/shared/components/ui/OfflineBanner.jsx` + CSS

- **Loading:** spinner animado com `primary` stroke (não neon). Skeleton shimmer variant para lazy-loaded content.
- **AlertList:** cards sanctuary com ícone + label por nível (critical=`AlertTriangle`, warning=`AlertCircle`, info=`Info`). Color por semantic token.
- **OfflineBanner:** banner topo `error-container` background, ícone `WifiOff`, mensagem clara. Dismiss após reconectar.

### Sprint 14.3 — Calendar Component Redesign

**Arquivo:** `src/shared/components/ui/Calendar.jsx` + `Calendar.css`

Hoje o Calendar tem tema neon independente. As views redesenhadas (HealthHistoryRedesign) usam overrides scoped em `.hhr-view`. Nesta wave:

- Redesenhar Calendar.css com dual-theme: neon default (fallback) + sanctuary quando `[data-redesign="true"]`
- Day cells: `surface-container-lowest`, radius `lg`, hover `surface-container-low`
- Has-log indicator: `primary-fixed` dot ou ring (não neon glow)
- Selected: `primary` background, `on-primary` text
- Today: `primary-fixed` ring outline
- Navigation arrows: lucide `ChevronLeft`/`ChevronRight`, 56px targets
- **Remover** overrides scoped em HistoryRedesign.css quando Calendar nativo suporta redesign

### Sprint 14.4 — PWA & Install Prompt

**Arquivo:** `src/shared/components/pwa/InstallPrompt.jsx` + CSS

- Banner bottom: sanctuary card style, glass background
- Ícone app + "Instalar Meus Remédios"
- CTA "Instalar": primary gradient, 56px
- Dismiss: ghost button "Agora não"
- Respeitar redesign tokens

### Sprint 14.5 — Chatbot AI (ChatWindow)

**Arquivo:** `src/features/chatbot/components/ChatWindow.jsx` + `ChatWindow.module.css`

O chatbot é acessado via FAB global. Drawer com visual neon precisa migrar:

- Drawer container: `surface`, radius top `2rem`, glass effect top border
- Header: "Assistente IA" + ícone `Bot` (lucide), close button `X`
- Messages: user → `primary-container` bubble, bot → `surface-container-low` bubble
- Input: 56px, radius `xl`, send button com ícone `Send`
- Loading: 3 dots animation `primary-fixed`
- Typography: `body-lg` para mensagens, `label-md` para timestamps
- Scoped via `[data-redesign="true"]` ou `isRedesignEnabled` prop

### Sprint 14.6 — Gamification Components

**Arquivos:**
- `src/shared/components/gamification/BadgeDisplay.jsx`
- `src/shared/components/gamification/MilestoneCelebration.jsx`
- `src/shared/components/ui/animations/ConfettiAnimation.jsx`

- **BadgeDisplay:** sanctuary card com ícone + label, `primary-fixed` highlight
- **MilestoneCelebration:** Modal redesenhado (W11.1) com animação celebratória
- **ConfettiAnimation:** adaptar cores para palette Santuário (primary, primary-fixed, tertiary)

### Sprint 14.7 — DLQ Admin View

**Arquivo:** `src/views/admin/DLQAdmin.jsx`

View admin não precisa de variant separada (só admin vê). Redesign direto:

- Table: tonal rows (alternating `surface`/`surface-container-low`), no borders
- Status badges: sanctuary Badge component
- Actions: Button component redesenhado
- Modals: usa Modal redesenhado (W11.1)
- **App.jsx:** Adicionar branching `isRedesignEnabled` no `case 'admin-dlq'`

### Critério de conclusão Wave 14

- [ ] Button, Card, Badge, EmptyState respondem a `[data-redesign="true"]`
- [ ] Loading, AlertList, OfflineBanner redesenhados
- [ ] Calendar tem tema sanctuary nativo (sem overrides hacky em views)
- [ ] InstallPrompt segue design system
- [ ] ChatWindow com visual Santuário
- [ ] Gamification components atualizados
- [ ] DLQAdmin redesenhado
- [ ] ZERO componentes com visual neon visíveis quando redesign está ativo

---

## 20. Wave 15 — Smart Insights Integration

> **Spec detalhada:** `WAVE_15_SMART_INSIGHTS_INTEGRATION.md`
> **Escopo:** Integrar toda a inteligência entregue nas Fases 5-6 do Roadmap v4 no redesign Santuário Terapêutico. O produto tem services robustos de predição, risco, custo e otimização de horários — mas o redesign (W0-W14.5) não os consome. Esta wave fecha essa lacuna, trazendo o valor analítico para o novo visual.

### Motivação

O Dashboard legacy (`Dashboard.jsx`) consome 7 smart features que o `DashboardRedesign.jsx` não possui:
1. **SmartAlerts** — alertas contextuais de estoque, dose atrasada, prescrição vencendo
2. **InsightCard** — cards rotativos com insights do `insightService`
3. **ReminderSuggestion** — sugestão de ajuste de horário via `reminderOptimizerService`
4. **Protocol Risk Score** — score de risco por protocolo via `protocolRiskService` (não surfaceado em componente visual)
5. **Cost Analysis** — gráfico de custo mensal via `costAnalysisService` + `CostChart.jsx`
6. **Prescription Timeline** — timeline visual de vigência de prescrições (EV-07) via `PrescriptionTimeline.jsx`
7. **Refill Prediction** — previsão de reposição com data de esgotamento via `refillPredictionService`

O Heatmap de Adesão (`AdherenceHeatmap.jsx`) já está integrado no `HealthHistoryRedesign` — **não entra nesta wave**.

### Modelo visual: InsightCard Sanctuary

Todas as interações inteligentes desta wave reutilizam o modelo visual do `PriorityDoseCard` (já implementado em W6) como template de design. O card gradient com badge, conteúdo rico e CTA contextual é o padrão "Smart Card" do produto:

```
┌─ Smart Card Pattern ────────────────────────────┐
│  ● Badge (categoria)                  Ícone     │
│                                                  │
│  Headline (título do insight)                    │
│  Subtítulo descritivo (Lexend 400)               │
│                                                  │
│  [Conteúdo contextual: barra, lista, métrica]    │
│                                                  │
│  ╭─────────────────╮  ╭──────────────╮           │
│  │   CTA Primário   │  │  Dispensar   │           │
│  ╰─────────────────╯  ╰──────────────╯           │
└──────────────────────────────────────────────────┘
```

**Variantes por semântica:**
| Variante | Background | Badge | Uso |
|----------|-----------|-------|-----|
| `priority` | `secondary → secondary-container` gradient | "Prioridade Máxima" | Dose urgente (existente) |
| `risk` | `error-container` at 20% | "Atenção" / "Crítico" | Risk score, stock zerado |
| `suggestion` | `primary → primary-container` gradient | "Sugestão Inteligente" | Reminder optimizer |
| `insight` | `surface-container-lowest` + ambient shadow | "Dica do Dia" | InsightCard rotativo |
| `cost` | `tertiary-fixed` at 30% | "Análise de Custo" | Cost summary |

### Principios de Integração

1. **Zero new Supabase calls** — computação pura sobre dados já no `DashboardProvider` / `useDashboard()`.
2. **Progressive Disclosure respeitado** — Dona Maria vê alertas críticos como linguagem humana; Carlos vê métricas numéricas.
3. **Smart ≠ Noise** — cada insight tem threshold mínimo (14 dias de dados) e frequency capping via `insightService`.
4. **Sanctuary visual** — tonal surfaces, sem bordas 1px, Living Fill em barras, Cascade Reveal em listas.
5. **Reutilização máxima** — os services existentes (`protocolRiskService`, `refillPredictionService`, `reminderOptimizerService`, `costAnalysisService`) não são modificados.

### Sprint 15.1 — SmartAlertsRedesign (Dashboard)

**Criar:** `src/features/dashboard/components/SmartAlertsRedesign.jsx` + `.css`
**Consumido por:** `DashboardRedesign.jsx`

Traz os alertas inteligentes do `Dashboard.jsx` legacy para o redesign. Os dados são computados inline no `DashboardRedesign` (mesmo padrão do legacy: `useMemo` sobre `stockSummary`, `protocols`, `logs`).

**Tipos de alerta:**
| Tipo | Trigger | Severidade | Persona adaptação |
|------|---------|-----------|-------------------|
| Estoque zerado | `item.isZero` | `critical` | Ambas: label "Estoque Zerado" + CTA "Comprar Agora" |
| Estoque baixo | `item.isLow` | `warning` | Simple: "Estoque acabando em X dias" / Complex: barra + % |
| Dose atrasada | `delay > toleranceMin` | `warning`/`critical` | Simple: "Tome agora" / Complex: delta em minutos |
| Prescrição vencendo | `daysRemaining < 30` | `warning`/`critical` | Ambas: data + CTA "Renovar" |

**Visual Sanctuary:**
- Cada alerta é um card tonal (não lista genérica)
- `critical`: bg `color-mix(in srgb, var(--color-error) 8%, transparent)`, border-left 4px `error`
- `warning`: bg `color-mix(in srgb, var(--color-tertiary-fixed) 40%, transparent)`, border-left 4px `tertiary`
- `info`: bg `secondary-fixed` at 20%, border-left 4px `secondary`
- Ícones Lucide: `AlertTriangle` (critical), `AlertCircle` (warning), `Info` (info)
- CTA inline: texto link com seta (não botão full-width — reduzir peso visual)
- Cascade Reveal: stagger 0.1s por alerta
- Max 3 alertas visíveis; "Ver todos (N)" expand link

### Sprint 15.2 — InsightCardRedesign (Dashboard)

**Criar:** `src/features/dashboard/components/InsightCardRedesign.jsx` + `.css`
**Consumido por:** `DashboardRedesign.jsx`

Card rotativo de insights contextuais do `insightService`. Reutiliza o layout do PriorityDoseCard (padrão Smart Card):

- Background: `surface-container-lowest` + `shadow-ambient`
- Badge: tipo do insight (e.g., "Dica do Dia", "Parabéns!", "Atenção")
- Ícone temático por tipo (Lucide: `TrendingUp`, `Award`, `Clock`, `Target`)
- Texto: Lexend 400, 1-2 linhas
- CTA opcional: "Ver Detalhes" para navegar à view relevante
- Animação: fade-in suave (Living Fill pattern para métricas numéricas)
- Frequency capping: delegado ao `insightService` (já implementado)

**Persona:**
- Simple: apenas insights de alta prioridade (critical + high), tom encorajador
- Complex: todos os insights, incluindo IMPROVEMENT_OPPORTUNITY

### Sprint 15.3 — ReminderSuggestionRedesign (Dashboard)

**Criar:** `src/features/protocols/components/ReminderSuggestionRedesign.jsx` + `.css`
**Consumido por:** `DashboardRedesign.jsx`

Redesenha o `ReminderSuggestion.jsx` legacy com visual Smart Card (variante `suggestion`):

- Background: `primary → primary-container` gradient (mesma assinatura do PriorityDoseCard mas verde)
- Badge: "Sugestão Inteligente"
- Texto: "Você costuma tomar **{nome}** por volta das **{suggestedTime}**. Ajustar o lembrete de {currentTime}?"
- Subtexto: "(baseado em {sampleCount} doses)"
- CTAs: "Ajustar Horário" (branco, primary text) + "Manter Atual" (ghost) + "Não perguntar mais" (text link)
- Ícone: Lucide `Clock` ou `BellRing`
- `dismissSuggestion()` + `isSuggestionDismissed()` reutilizados do service existente
- **Persona:** Ambas veem (sugestão é acionável e simples)
- **Threshold:** `analyzeReminderTiming()` retorna `null` se <7 amostras ou delta <15min

### Sprint 15.4 — ProtocolRiskBadge (Tratamentos)

**Criar:** `src/features/adherence/components/ProtocolRiskBadge.jsx` + `.css`
**Consumido por:** `TreatmentsRedesign.jsx` (dentro de cada protocol row/card)

Surfacea o `protocolRiskService` como badge visual inline nos cards de tratamento:

- Badge pill: `RISK_LABELS[riskLevel]` (Estável / Atenção / Crítico)
- Cor: `RISK_COLORS[riskLevel]` (verde / âmbar / vermelho)
- Trend indicator: seta ↑↓→ baseada em `trend7d` (positivo = melhorando, negativo = piorando)
- Tooltip (Complex mode): "Adesão 14d: {adherence14d}% | Tendência 7d: {trend7d > 0 ? '+' : ''}{trend7d}%"
- Guard: `hasEnoughData === false` → não renderizar (princípio de dados suficientes)

**Persona:**
- Simple (Dona Maria): badge com label colorida ("Atenção"), sem número. Só aparece se `riskLevel !== 'stable'`.
- Complex (Carlos): badge + % adesão 14d + trend arrow. Sempre visível.

**Posição no layout:**
- Card mode (mobile/simple): ao lado do `StockPill`, na linha de badges
- Tabular mode (desktop/complex): coluna dedicada "Risco" entre Adesão e Estoque

### Sprint 15.5 — CostSummaryRedesign (Estoque)

**Criar:** `src/features/stock/components/CostSummaryRedesign.jsx` + `.css`
**Consumido por:** `StockRedesign.jsx`

Redesenha o `CostChart.jsx` legacy com visual Santuário:

- Card: `surface-container-lowest`, radius `2rem`, padding `2rem`
- Header: "Análise de Custo Mensal" + ícone `DollarSign` (Lucide)
- Total: número grande `headline-md` (Public Sans 700) — "R$ {totalMonthly}/mês"
- Breakdown: lista de medicamentos com barra proporcional (Living Fill)
  - Cada item: nome + "R$ {cost}/mês" + barra horizontal proporcional ao total
  - Barras: 8px, full-radius, cor `primary`; item mais caro em `tertiary`
- Guard: `costData.items.length === 0` → "Adicione dados de compra para ver a análise de custo"
- **Persona:**
  - Simple: apenas total + top 3 medicamentos mais caros
  - Complex: lista completa + barras proporcionais

**Service:** reutiliza `calculateMonthlyCosts()` de `costAnalysisService` sem modificação.

### Sprint 15.6 — PrescriptionTimelineRedesign (Estoque)

**Criar:** `src/features/stock/components/PrescriptionTimelineRedesign.jsx` + `.css`
**Consumido por:** `StockRedesign.jsx`

Redesenha o `PrescriptionTimeline.jsx` (EV-07) legacy:

- Barra horizontal de vigência: posição relativa ao período total (start_date → end_date)
- Cores semânticas: ativo = `primary`, vencendo = `tertiary`, vencido = `error`
- Label: nome do medicamento + período (DD/MM — DD/MM)
- Marcador "Hoje": linha vertical `primary-fixed` tracejada
- Border-radius: `full` nas barras
- Sem bordas 1px — separação por spacing

**Persona:**
- Simple: lista de barras empilhadas com label + status
- Complex: grid horizontal com eixo temporal compartilhado (comparação visual entre prescrições)

### Sprint 15.7 — Refill Prediction Enrichment (Estoque)

**Onde:** Enriquecer `StockCardRedesign.jsx` existente e `StockAlertInline.jsx` com dados de `refillPredictionService`.

Atualmente, `StockPill` e `StockAlertInline` usam `daysRemaining` do `stockSummary` (cálculo simplificado). A Fase 6 entregou `refillPredictionService.predictRefill()` com consumo real 30d + confiança.

**Enriquecimentos:**
- `StockCardRedesign`: exibir data prevista de esgotamento ("Acaba em ~15/04") + badge de confiança ("Alta"/"Média"/"Baixa")
- `StockAlertInline` (Dashboard): quando disponível, usar `predictedStockoutDate` em vez de `daysRemaining` genérico
- Indicador visual: ícone de confiança — `ShieldCheck` (high), `ShieldAlert` (medium), `ShieldQuestion` (low)
- Guard: dados insuficientes (`isRealData === false && confidence === 'low'`) → manter comportamento atual sem enriquecimento

### Sprint 15.8 — DashboardRedesign Integration (Orquestração)

**Onde:** `src/views/redesign/DashboardRedesign.jsx`

Sprint de integração que conecta os componentes novos (15.1-15.3) ao Dashboard redesenhado:

**Layout atualizado:**
```
Mobile:
  Ring + Greeting + Motivational
  PriorityDoseCard (doses urgentes)
  SmartAlertsRedesign (max 3 alertas)
  ReminderSuggestionRedesign (se houver)
  InsightCardRedesign (1 insight rotativo)
  CronogramaPeriodo
  StockAlertInline

Desktop (grid 1fr + 2fr):
  Left: Ring + Greeting + PriorityDoseCard + InsightCard
  Right: SmartAlerts (topo) + ReminderSuggestion + Cronograma + StockAlert
```

**Dados computados (novos `useMemo`):**
1. `smartAlerts` — replicar lógica do `Dashboard.jsx` legacy (stock + dose delay + prescription)
2. `reminderSuggestion` — chamar `analyzeReminderTiming()` para cada protocolo
3. `currentInsight` — chamar `insightService.getNextInsight()`

**Persona awareness:**
- Simple: SmartAlerts max 2 + InsightCard (se critical/high) + ReminderSuggestion
- Complex: SmartAlerts max 5 + InsightCard sempre + ReminderSuggestion + risk context

### Sprint 15.9 — StockRedesign Integration (Orquestração)

**Onde:** `src/views/redesign/StockRedesign.jsx`

Sprint de integração que adiciona CostSummary e PrescriptionTimeline ao Estoque redesenhado:

**Layout atualizado:**
```
Mobile (stack):
  CriticalAlertBanner
  Stock Cards (por prioridade)
  CostSummaryRedesign
  PrescriptionTimelineRedesign
  EntradaHistorico

Desktop (grid):
  Left: CriticalBanner + Stock Cards
  Right: CostSummary + PrescriptionTimeline + Histórico
```

**Service calls (novos):**
1. `calculateMonthlyCosts(medicines, protocols)` → via `useMemo`
2. Timeline data: mapeamento de protocolos com `start_date`, `end_date`, status

### Critério de conclusão Wave 15

- [ ] `SmartAlertsRedesign` renderiza alertas de estoque, dose atrasada e prescrição no Dashboard redesenhado
- [ ] `InsightCardRedesign` exibe insight rotativo do `insightService` com visual Smart Card
- [ ] `ReminderSuggestionRedesign` exibe sugestão de ajuste de horário com CTAs funcionais
- [ ] `ProtocolRiskBadge` exibe risk score nos cards de tratamento (com threshold de dados)
- [ ] `CostSummaryRedesign` exibe análise de custo mensal no Estoque redesenhado
- [ ] `PrescriptionTimelineRedesign` exibe timeline de vigência de prescrições no Estoque
- [ ] Refill prediction enriquece `StockCardRedesign` com data de esgotamento prevista
- [ ] Todos os componentes respeitam Progressive Disclosure (Simple vs Complex persona)
- [ ] Zero new Supabase calls — tudo computado client-side sobre cache existente
- [ ] Touch targets ≥ 56px em todos os CTAs de alerta
- [ ] Cascade Reveal + Living Fill aplicados onde relevante
- [ ] `npm run validate:agent` passa

---

## 21. Wave 16 — Accessibility & Polish

> **Escopo:** Auditoria completa de acessibilidade em TODAS as views e componentes redesenhados (W0-W16). Esta wave é de compliance — não adiciona features, apenas garante que tudo que foi construído é acessível.

> **Status da wave:** ✅ MERGED — PR #448 em `main` (2026-04-08)

### Sprint 16.1 — Semantic HTML Audit

Garantir em TODAS as views redesenhadas (`src/views/redesign/` + componentes shared):
- `<main>`, `<nav>`, `<section>`, `<header>` corretos
- Heading hierarchy: `<h1>` por page → `<h2>` sections → `<h3>` subsections
- Buttons são `<button>`, não `<div onClick>`
- Form inputs têm `<label>` visível (não apenas placeholder)
- Lists usam `<ul>`/`<ol>` + `<li>`

### Sprint 16.2 — ARIA & Screen Readers

- RingGauge: `role="img"` + `aria-label="Adesão: 85%. Streak: 12 dias"`
- Progress bars: `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax`
- Ícones decorativos: `aria-hidden="true"`
- Navigation: `aria-current="page"` no item ativo
- Modals: focus trap + `role="dialog"` + `aria-modal="true"` (já prep em W11.1)
- Calendar: `role="grid"` + `aria-label` nos dias
- Forms: `aria-describedby` para mensagens de erro
- Live regions: `aria-live="polite"` para toasts/feedback
- **SmartAlertsRedesign:** `aria-live="polite"` no container, `role="alert"` em alertas critical

### Sprint 16.3 — Focus Management

- Focus ring: 2px solid `primary` (#006a5e), visible on all backgrounds
- Tab navigation: todos os elementos interativos acessíveis via keyboard
- Modal focus trap: foco preso dentro do modal aberto
- Skip-to-content link: `<a href="#main-content">` hidden até focus
- Dropdown/select: navegação por setas
- Form validation: foco move para primeiro campo com erro

### Sprint 16.4 — Color Contrast Audit

Verificar WCAG AA compliance em TODAS as combinações:
- `on-surface` (#191c1d) on `surface` (#f8fafb) → AAA ✅
- `primary` (#006a5e) on white → AA ✅
- `error` (#ba1a1a) on white → AA ✅
- White text on primary gradient → TESTAR
- `on-surface` at 40% opacity (muted text) → TESTAR
- Badge text on badge backgrounds → TESTAR
- All text-over-gradient combinations → TESTAR
- **RiskBadge colors on surface backgrounds** → TESTAR
- **SmartAlert accent colors on tinted backgrounds** → TESTAR

### Sprint 16.5 — Touch Target Audit

- Todos os targets interativos ≥ 56px tall
- Botões primários 64px
- Gap mínimo 8px entre targets adjacentes
- Testar com large text system setting
- Verificar em Medicines, Protocols (forms com muitos inputs próximos)
- **SmartAlertsRedesign CTA links** ≥ 44px tap area

### Sprint 16.6 — Motion & Reduced Motion Audit

- Todos os Framer Motion animations checam `useReducedMotion()`
- CSS animations checam `@media (prefers-reduced-motion: reduce)`
- Nenhum content flash >3x/segundo
- Progress bars visíveis sem animação (dados não dependem de motion)
- Confetti/celebration pode ser desabilitado

### Critério de conclusão Wave 16

- [ ] Lighthouse Accessibility score ≥ 95
- [ ] Semantic HTML correto em todas as views redesenhadas
- [ ] ARIA labels em todos os widgets de dados (rings, bars, calendar, risk badges, cost bars)
- [ ] Focus ring visível em todos os backgrounds
- [ ] Touch targets ≥ 56px (primários 64px)
- [ ] `prefers-reduced-motion` respeitado universalmente
- [ ] Skip-to-content link funcional
- [ ] Keyboard navigation completa em todas as views

---

## 22. Wave 17 — Rollout Promotion & Legacy Cleanup

> **Escopo:** Com 100% de cobertura visual alcançada (W0-W16), promover o redesign como default, remover o feature flag, limpar código legacy, e consolidar tokens.

### Sprint 17.1 — Rollout Promotion

- `useRedesign()` retorna `true` por default (flag invertido)
- Período de observação: 2 semanas com flag default true
- Monitorar: erros console, métricas de uso, feedback telegram bot

### Sprint 17.2 — Token Consolidation

- Mesclar `tokens.redesign.css` → `tokens/colors.css`, `tokens/shadows.css`, `tokens/typography.css`, `tokens/borders.css`
- Remover scoping `[data-redesign="true"]` — tokens se tornam globais
- Mesclar `layout.redesign.css` → `index.css`
- Mesclar `components.redesign.css` → CSS individual de cada componente
- Remover `tokens.redesign.css`, `layout.redesign.css`, `components.redesign.css`

### Sprint 17.3 — Legacy View Removal

Remover views e componentes legacy que não são mais necessários:

- `src/views/Dashboard.jsx` → removido (DashboardRedesign é o default)
- `src/views/Treatment.jsx` → removido
- `src/views/Stock.jsx` → removido
- `src/views/Profile.jsx` → removido
- `src/views/HealthHistory.jsx` → removido
- `src/views/Emergency.jsx` → removido
- `src/views/Landing.jsx` → removido (ou mantido se Landing não teve flag)
- `src/views/Auth.jsx` → removido
- `src/views/Calendar.jsx` → removido (já deprecated)
- `src/shared/components/ui/BottomNav.jsx` → removido (BottomNavRedesign é default)
- `src/features/dashboard/components/RingGauge.jsx` → removido (RingGaugeRedesign é default)
- Componentes antigos de `SmartAlerts`, `StockBars`, `ViewModeToggle`, etc.
- CSS files antigos (neon theme): `animations.css` neon keyframes, `.glass-card`, etc.

### Sprint 17.4 — Rename & Reorganize

- Remover sufixo "Redesign" de todos os componentes e views:
  - `DashboardRedesign.jsx` → `Dashboard.jsx` (mover para `src/views/`)
  - `TreatmentsRedesign.jsx` → `Treatments.jsx`
  - `StockRedesign.jsx` → `Stock.jsx`
  - etc.
- Atualizar App.jsx: remover todas as branches `isRedesignEnabled`
- Atualizar imports em todo o codebase
- Remover `RedesignContext.jsx`, `useRedesign.js`

### Sprint 17.5 — Feature Flag Removal & Final Cleanup

- Remover `RedesignProvider` de App.jsx
- Remover `data-redesign` attribute de `app-container`
- Remover `?redesign=true` URL param handling
- Remover localStorage `mr_redesign` key handling
- Limpar `vite.config.js` se houver chunks obsoletos
- Atualizar testes: remover mocks de `useRedesign`
- Git: cleanup de branches feature/redesign/* orphanadas

### Sprint 17.6 — Onboarding Legacy Removal

- Remover `src/shared/components/onboarding/OnboardingWizard.jsx` (legacy)
- Remover 5 steps legacy (`WelcomeStep.jsx`, `FirstMedicineStep.jsx`, etc.)
- Renomear `redesign/OnboardingWizardRedesign.jsx` → `OnboardingWizard.jsx`
- Atualizar `OnboardingProvider.jsx`

### Critério de conclusão Wave 17

- [ ] Feature flag removido — redesign é o default e único visual
- [ ] Zero referências a `isRedesignEnabled`, `useRedesign`, `data-redesign`
- [ ] Zero views legacy em `src/views/` (apenas views Santuário)
- [ ] Zero sufixos "Redesign" em nomes de arquivos
- [ ] Tokens consolidados — arquivos `.redesign.css` removidos
- [ ] `npm run validate:agent` passa
- [ ] Bundle size igual ou menor que antes (dead code eliminated)
- [ ] Build de produção verifica: 0 CSS classes neon restantes

---

## 23. Checklist de Validação por Wave

Cada wave DEVE passar nestes checks antes de merge:

### Visual Checks
- [ ] First viewport comunica Verde Saúde identity em 3 segundos?
- [ ] Exatamente UMA âncora visual dominante por seção?
- [ ] Existem bordas 1px que deveriam ser tonal shifts?
- [ ] Cards são realmente necessários, ou layout + spacing bastam?
- [ ] Todos os border-radii ≥ 0.75rem?

### Motion Checks
- [ ] Cascade Reveal em list items?
- [ ] Living Fill em progress indicators?
- [ ] Soft Handoff em page transitions?
- [ ] `useReducedMotion()` respeitado?

### Copy Checks
- [ ] Todas as strings user-facing em Português BR?
- [ ] CTAs usam forma imperativa direta?
- [ ] Empty states são encorajadores e orientados a ação?

### Accessibility Checks
- [ ] Todos os targets interativos ≥ 56px?
- [ ] Todos os ícones acompanhados de text label?
- [ ] Contraste WCAG AA em todas as combinações de cor?
- [ ] Heading hierarchy lógica?

### Performance Checks
- [ ] View lazy-loaded com React.lazy + Suspense + ViewSkeleton?
- [ ] Todas as animações GPU-composited (transform + opacity only)?
- [ ] `npm run validate:agent` passa?

### Litmus Checks (PRODUCT_STRATEGY)
- [ ] A prioridade da tela é visível nos primeiros 3 segundos?
- [ ] O CTA principal é inequívoco?
- [ ] O layout continua claro sem sombras decorativas?
- [ ] A mesma tela funciona para alguém cansado, ansioso ou com leitura mais lenta?
- [ ] O produto parece cuidado de saúde confiável, e não software administrativo?
- [ ] A versão complexa continua serena mesmo com mais informação?
- [ ] A versão simples evita parecer simplória ou infantilizada?

---

## 24. Mapeamento de Arquivos

> **⚠️ NOTA DE ROLLOUT:** Durante a fase de rollout gradual (W0-W3), os arquivos originais de tokens NÃO são modificados. Os tokens e overrides vivem em arquivos `.redesign.css` scoped em `[data-redesign="true"]`. As tabelas abaixo refletem o mapeamento correto por fase.

### Arquivos a REESCREVER — Wave 4+ (diretos, sem rollout CSS scoping)

| Arquivo | Wave | Ação |
|---------|------|------|
| `src/shared/components/ui/BottomNav.jsx` | 4 | Reescrever (Lucide icons + glass) |
| `src/shared/components/ui/BottomNav.css` | 4 | Reescrever completamente |

### Arquivos a REESCREVER — pós-rollout (só após validação completa e promoção global)

| Arquivo | Wave origem | Ação pós-validação |
|---------|-------------|--------------------|
| `src/shared/styles/tokens/colors.css` | 0 | Mesclar conteúdo de `tokens.redesign.css`, remover scoping |
| `src/shared/styles/tokens/shadows.css` | 0 | Mesclar conteúdo de `tokens.redesign.css`, remover scoping |
| `src/shared/styles/tokens/typography.css` | 1 | Mesclar conteúdo de `tokens.redesign.css`, remover scoping |
| `src/shared/styles/tokens/borders.css` | 0 | Atualizar radii, remover xs/sm |
| `src/shared/styles/index.css` | 0+2 | Remover neon, adicionar surface/sanctuary utils (migrar de `layout.redesign.css`) |
| `src/shared/styles/themes/light.css` | 0 | Atualizar para novo palette |
| `src/shared/styles/themes/dark.css` | 0 | Placeholder (Phase 6) |

### Arquivos a EVOLUIR (mudanças visuais, preservar lógica) — Wave 4+

> **Nota de rollout:** Durante a fase de rollout gradual, os arquivos de views listados abaixo NÃO são editados diretamente. Em vez disso, criar variantes em `src/views/redesign/`. Apenas `src/App.jsx` e `src/shared/styles/animations.css` são editados diretamente (com isolamento adequado).

| Arquivo | Wave | Mudanças |
|---------|------|----------|
| `src/shared/styles/animations.css` | 5 | **Pós-rollout:** remover neon. Durante rollout: novas animações em `components.redesign.css` |
| `src/shared/components/ui/Modal.jsx` + CSS | 3 | Atualizar visual (via CSS scoped em W3, depois direto) |
| `src/App.jsx` | 4 | Renderização condicional via `useRedesign()` (Sidebar, BottomNavRedesign, AnimatePresence) |

### Views a CRIAR como variantes redesenhadas (NÃO editar originais durante rollout)

| Arquivo Original | Variante Redesenhada | Wave | Status |
|------------------|----------------------|------|--------|
| `src/views/Dashboard.jsx` | `src/views/redesign/DashboardRedesign.jsx` | 6 | ✅ COMPLETO |
| `src/views/Treatment.jsx` | `src/views/redesign/TreatmentsRedesign.jsx` | 7 | ✅ COMPLETO |
| `src/views/Stock.jsx` | `src/views/redesign/StockRedesign.jsx` | 8 | ✅ COMPLETO |
| `src/views/Profile.jsx` | `src/views/redesign/ProfileRedesign.jsx` | 10B | ✅ COMPLETO |
| `src/views/HealthHistory.jsx` | `src/views/redesign/HealthHistoryRedesign.jsx` | 10C | ✅ COMPLETO |
| `src/views/Emergency.jsx` | `src/views/redesign/EmergencyRedesign.jsx` | 9 | ✅ COMPLETO |
| `src/views/Settings.jsx` | `src/views/redesign/SettingsRedesign.jsx` | 10A | ✅ COMPLETO |
| `src/views/Medicines.jsx` | `src/views/redesign/MedicinesRedesign.jsx` | **12** | ⏳ PENDENTE |
| `src/views/Consultation.jsx` | `src/views/redesign/ConsultationRedesign.jsx` | **12** | ⏳ PENDENTE |
| `src/views/Landing.jsx` | `src/views/redesign/LandingRedesign.jsx` | **13** | ⏳ PENDENTE |
| `src/views/Auth.jsx` | `src/views/redesign/AuthRedesign.jsx` | **13** | ⏳ PENDENTE |
| `src/shared/components/onboarding/OnboardingWizard.jsx` | `src/shared/components/onboarding/redesign/OnboardingWizardRedesign.jsx` | **13** | ⏳ PENDENTE |

### Componentes internos a CRIAR como paralelos (usados apenas pelas views redesenhadas)

| Componente Original | Componente Redesenhado | Wave | Mudanças |
|---------------------|------------------------|------|----------|
| `RingGauge.jsx` | `RingGaugeRedesign.jsx` | 6 | Recolor, 12pt stroke, Public Sans |
| `StockBars.jsx` | `StockAlertInline.jsx` | 6 | Inline alert style |
| `SparklineAdesao.jsx` | (incorporado no DashboardRedesign) | 6 | Recolor |
| `DoseZoneList.jsx` | `CronogramaPeriodo.jsx` | 6 | Cronograma por período |
| `SmartAlerts.jsx` | `SmartAlertsRedesign.jsx` | **15** | Smart alerts Sanctuary (tonal cards, Lucide icons) |
| `InsightCard.jsx` | `InsightCardRedesign.jsx` | **15** | Insight rotativo Smart Card pattern |
| `ReminderSuggestion.jsx` | `ReminderSuggestionRedesign.jsx` | **15** | Sugestão de horário Smart Card verde |
| `CostChart.jsx` | `CostSummaryRedesign.jsx` | **15** | Análise de custo Sanctuary |
| `PrescriptionTimeline.jsx` | `PrescriptionTimelineRedesign.jsx` | **15** | Timeline prescrições Sanctuary |
| `ViewModeToggle.jsx` | (incorporado no DashboardRedesign) | 6 | Segmented control novo |
| `useComplexityMode.js` | `useComplexityModeRedesign.js` | 10 | Trigger expansion |
| `BottomNav.jsx` | `BottomNavRedesign.jsx` | 4 | Glass nav + 4 tabs Lucide |

### Arquivos NOVOS a criar — infraestrutura de rollout (ANTES das waves)

| Arquivo | Propósito |
|---------|-----------|
| `src/shared/contexts/RedesignContext.jsx` | Provider + lógica do flag (URL param + localStorage) |
| `src/shared/hooks/useRedesign.js` | Hook: { isRedesignEnabled, toggleRedesign } |
| `src/shared/styles/tokens.redesign.css` | CSS scoped W0+W1 (tokens de cor, sombra, border, tipografia) |
| `src/shared/styles/layout.redesign.css` | Classes de layout/superfície scoped (W2) |
| `src/shared/styles/components.redesign.css` | Overrides de componentes scoped (W3) |

### Arquivos NOVOS a criar — features e componentes compartilhados

| Arquivo | Wave | Propósito |
|---------|------|-----------|
| `src/shared/components/ui/Sidebar.jsx` + CSS | 4 | Desktop navigation (só renderizado com flag ativo) |
| `src/shared/components/ui/BottomNavRedesign.jsx` + CSS | 4 | Nav redesenhada (alternada via useRedesign()) |
| `src/shared/utils/motionConstants.js` | 5 | Motion language constants |
| `src/shared/hooks/useMotion.js` | 5 | Motion hook with reduced-motion |
| `src/features/dashboard/components/PriorityDoseCard.jsx` | 6 | Next dose CTA card |
| `src/features/stock/components/StockCard.jsx` | 8 | Individual stock card |
| `src/shared/components/ui/Badge.jsx` + CSS | 3 | Status badges (via components.redesign.css) |
| `src/shared/components/ui/ProgressiveTooltip.jsx` | 10 | Educational tooltips |
| `src/shared/components/ui/PageHeader.jsx` | 6 | Reusable page header |
| `src/features/dashboard/components/SmartAlertsRedesign.jsx` + CSS | **15** | Smart alerts Sanctuary |
| `src/features/dashboard/components/InsightCardRedesign.jsx` + CSS | **15** | Insight rotativo Sanctuary |
| `src/features/protocols/components/ReminderSuggestionRedesign.jsx` + CSS | **15** | Sugestão de horário Sanctuary |
| `src/features/adherence/components/ProtocolRiskBadge.jsx` + CSS | **15** | Risk score badge |
| `src/features/stock/components/CostSummaryRedesign.jsx` + CSS | **15** | Análise de custo Sanctuary |
| `src/features/stock/components/PrescriptionTimelineRedesign.jsx` + CSS | **15** | Timeline de prescrições Sanctuary |

### Arquivos que NÃO mudam (durante todo o rollout W0-W12)

| Arquivo | Razão |
|---------|-------|
| `src/shared/styles/tokens/colors.css` | Tokens novos vão em `tokens.redesign.css` |
| `src/shared/styles/tokens/shadows.css` | Tokens novos vão em `tokens.redesign.css` |
| `src/shared/styles/tokens/borders.css` | Tokens novos vão em `tokens.redesign.css` |
| `src/shared/styles/tokens/typography.css` | Tokens novos vão em `tokens.redesign.css` |
| `src/shared/styles/themes/light.css` | Dark mode placeholder no `tokens.redesign.css` |
| `src/shared/styles/themes/dark.css` | Dark mode placeholder no `tokens.redesign.css` |
| `src/shared/styles/index.css` | Apenas recebe os 3 `@import` dos arquivos `.redesign.css` |
| `src/shared/components/ui/Button.jsx` + CSS | API imutável; CSS scoped via `components.redesign.css` |
| `src/shared/components/ui/Card.jsx` + CSS | API imutável; CSS scoped via `components.redesign.css` |
| `index.html` | Fontes carregadas via @import no `tokens.redesign.css` durante rollout |
| `src/views/Dashboard.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/Treatment.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/Stock.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/Profile.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/HealthHistory.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/Emergency.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/Landing.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/views/Auth.jsx` | View original; variante redesenhada em `src/views/redesign/` |
| `src/shared/components/ui/BottomNav.jsx` + CSS | Nav original; `BottomNavRedesign.jsx` é o paralelo |
| `src/features/dashboard/hooks/useComplexityMode.js` | Hook original; `useComplexityModeRedesign.js` é o paralelo |

### Arquivos que NÃO mudam (lógica de negócio — todas as waves)

| Arquivo | Razão |
|---------|-------|
| `src/features/*/services/*.js` | Lógica de negócio intocada |
| `src/schemas/*.js` | Validação Zod intocada |
| `src/shared/utils/supabase.js` | Client intocado |
| `src/utils/dateUtils.js` | Utilitários intocados |
| `src/features/dashboard/hooks/useDoseZones.js` | Lógica temporal intocada |
| `server/bot/*` | Telegram bot intocado |
| `api/*` | Serverless functions intocadas |

---

## 25. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Wave 0 (tokens) quebra visual de TODOS os componentes (pós-rollout) | Alto | **Mitigado pelo rollout gradual:** W0-W3 são scoped em `[data-redesign="true"]` — usuários sem o flag não veem nenhuma mudança. Quando o rollout for promovido globalmente, aceitar "feio" temporário e priorizar waves 0-3 como bloco atômico. |
| Fonts Google causam FOUC (Flash of Unstyled Content) | Médio | `font-display: swap` + `<link rel="preload">` |
| Dark mode quebra com novos tokens | Médio | Desabilitar dark mode toggle; manter placeholder CSS |
| Performance degradada com Framer Motion em listas longas | Alto | `useMotion()` com fallback estático; `will-change: transform` |
| Lucide React aumenta bundle | Baixo | Tree-shaking automático (imports nomeados); ~0.5KB por ícone |
| Sidebar layout quebra em tablets (768-1024px) | Médio | Sidebar colapsável ou hidden em tablets; testar breakpoints |
| CSS custom properties têm cascade issues | Médio | Backward compat aliases em tokens; migrar progressivamente |
| Existing tests podem quebrar com mudanças visuais | Baixo | Testes focam em lógica, não visual; snapshot tests precisam update |
| **Cópia literal dos protótipos** | **Médio** | **Os protótipos usam Tailwind + React Router + TypeScript — NÃO copiar código diretamente. Usar como referência de COMPOSIÇÃO e LAYOUT, mas sempre partir da lógica e arquitetura da app real (CSS custom properties, setCurrentView, JSX). Agentes: se um componente do protótipo faz X, implementar o equivalente usando os patterns existentes do projeto, não portando o código Tailwind.** |
| FOUC (Flash of Unstyled Content) com Google Fonts | Médio | `font-display: swap` + `<link rel="preload">` + system font fallback stack |
| Regressão visual parcial entre waves | Alto | Waves 0-3 como bloco atômico. Migrar por domínio completo. Não deixar waves pela metade |

### Ordem de Execução Recomendada

```
Wave 0 → Wave 1 → Wave 2 → Wave 3  (FOUNDATION — executar como bloco)     ✅ COMPLETO
    ↓
Wave 4 (Navigation — visual backbone)                                       ✅ COMPLETO
    ↓
Wave 5 (Motion — reusable patterns)                                         ✅ COMPLETO
    ↓
Wave 6 (Dashboard — highest impact)                                         ✅ COMPLETO
    ↓
Wave 7 ─┬─ Wave 8 (podem ser paralelos)                                    ✅ COMPLETO
        │
Wave 9 ─┘                                                                  ✅ COMPLETO
    ↓
Wave 10 (Hub + Settings + Histórico)                                        ✅ COMPLETO
    ↓
Wave 11 (Forms & Modals — interação)         ← PRÓXIMA
    ↓
Wave 12 (Medicines + Consultation — views restantes)
    ↓
Wave 13 (Landing/Auth/Onboarding — jornada de entrada)
    ↓
Wave 14 (Shared Components + Chatbot — limpeza visual global)
    ↓
Wave 15 (Smart Insights — integração de inteligência Fase 6 no redesign)
    ↓
Wave 16 (Accessibility — compliance WCAG AA)
    ↓
Wave 17 (Rollout Promotion + Legacy Cleanup — flag removal)
```

**W11 é a próxima prioridade** porque Modal.jsx é o keystone blocker: 12+ componentes abrem modais com visual neon dentro de views Santuário. Redesenhar Modal primeiro desbloqueia todos os forms e dialogs.

**W12-W13 podem ser paralelas** se houver dois agentes disponíveis (Medicines/Consultation não dependem de Landing/Auth).

**W14 é sweep final** — componentes shared que aparecem em contexto redesign mas ainda carregam estilos antigos.

**W15 é valor ao paciente** — traz toda a inteligência analítica (smart alerts, risk scores, custo, otimizador de horários) para o novo visual. Sem esta wave, o redesign é mais bonito mas menos inteligente que o legacy.

**W16-W17 são sequenciais** — accessibility audit só faz sentido quando toda a UI está no novo design (incluindo insights), e legacy cleanup é o passo final.

---

## Referências

| Documento | Path | Propósito |
|-----------|------|-----------|
| Product Strategy Consolidated | `plans/redesign/references/PRODUCT_STRATEGY_CONSOLIDATED.md` | SSOT visual/narrative/motion |
| Design System Spec | `plans/redesign/references/DESIGN-SYSTEM.md` | Component philosophy |
| Feature Reference | `plans/redesign/references/REFERENCE.md` | Feature list + personas |
| Iconografia Guide | `plans/redesign/references/iconografia_meus_remedios.png` | Icon system reference |
| Design System Visual | `plans/redesign/references/design-system.png` | Color/type/component visual ref |
| Simple Dashboard (mobile) | `plans/redesign/references/simple-hoje-mobile.png` | Target: Dona Maria dashboard |
| Simple Dashboard (desktop) | `plans/redesign/references/simple-hoje-desktop.png` | Target: Dona Maria desktop |
| Complex Dashboard (mobile) | `plans/redesign/references/complex-hoje-mobile.png` | Target: Carlos dashboard |
| Complex Dashboard (desktop) | `plans/redesign/references/complex-hoje-desktop.png` | Target: Carlos desktop |
| Simple Treatments (mobile) | `plans/redesign/references/simple-tratamentos-mobile.png` | Target: simple treatments |
| Simple Treatments (desktop) | `plans/redesign/references/simple-tratamentos-desktop.png` | Target: simple treatments desktop |
| Complex Treatments (mobile) | `plans/redesign/references/complex-tratamentos-mobile.png` | Target: complex treatments |
| Complex Treatments (desktop) | `plans/redesign/references/complex-tratamentos-desktop.png` | Target: complex treatments desktop |
| Simple Stock (mobile) | `plans/redesign/references/simple-estoque-mobile.png` | Target: simple stock |
| Simple Stock (desktop) | `plans/redesign/references/simple-estoque-desktop.png` | Target: simple stock desktop |
| Complex Stock (mobile) | `plans/redesign/references/complex-estoque-mobile.png` | Target: complex stock |
| Complex Stock (desktop) | `plans/redesign/references/complex-estoque-desktop.png` | Target: complex stock desktop |
| Simple Prototype (React) | `plans/redesign/references/meus-remédios---simple-treatments/` | Code reference: Dona Maria UI |
| Complex Prototype (React) | `plans/redesign/references/meus-remédios---complex-treatments/` | Code reference: Carlos UI |
| UX Vision (current) | `plans/UX_VISION_EXPERIENCIA_PACIENTE.md` | Current UX patterns |
| Current CSS Tokens | `src/shared/styles/tokens/` | Current design system |
| Current Dashboard | `src/views/Dashboard.jsx` | Current implementation |
| Mobile Performance Spec | `docs/standards/MOBILE_PERFORMANCE.md` | Perf constraints |

---

## 21. Definição de Sucesso

O sucesso desta iniciativa será medido em 3 dimensões:

### Experiência do Paciente (Qualitativo)

| Persona | Critério de Sucesso | Como Validar |
|---------|---------------------|--------------|
| **Dona Maria** (simples, 1-3 meds, baixa literacia tech) | Sente que o app está **mais simples e mais claro**. Consegue tomar suas doses com 1-2 toques. Não se sente confusa com informação excessiva. | Litmus check: "A prioridade da tela é visível nos primeiros 3 segundos?" |
| **Carlos** (complexo, múltiplos protocolos, health-literate) | Sente que o app está **mais poderoso e melhor organizado**. Consegue acompanhar titulação, adesão por protocolo e estoque em uma única sessão. | Litmus check: "A versão complexa continua serena mesmo com mais informação?" |
| **Ambos** | A marca parece mais **premium, clínica e humana**. A experiência deixa de parecer um conjunto de telas e passa a parecer um **produto desenhado com intenção**. | Litmus check: "O produto parece cuidado de saúde confiável, e não software administrativo?" |

### Qualidade Técnica (Quantitativo)

| Métrica | Target | Baseline Atual |
|---------|--------|----------------|
| Lighthouse Accessibility | ≥ 95 | A medir |
| WCAG AA compliance | 100% text combinations | Parcial |
| Touch targets ≥ 56px | 100% interactive elements | Variável |
| Bundle size (gzip) | ≤ 110 kB (< 8% aumento) | 102.47 kB |
| FCP mobile 4G | < 2.5s | ~1.5s |
| Animations 60fps | 100% on real mobile | A medir |
| `npm run validate:agent` | Pass | Pass |

### Coesão de Design (Qualitativo — Peer Review)

Uma tela só está **pronta** quando:
1. Está visualmente alinhada aos artefatos de referência (mocks .png + protótipos).
2. Respeita o novo design system (tokens, tipografia, motion language).
3. Adapta-se ao modo de complexidade do usuário (Progressive Disclosure).
4. **Não reintroduz a estética neon/glass legada** — nenhum `--neon-*`, `--glow-*`, rosa `#ec4899` ou cyan `#06b6d4`.
5. Funciona bem em mobile (320px) e desktop (1280px+).
6. Possui um CTA principal claro e inequívoco.
7. Passa nos 7 Litmus Checks da PRODUCT_STRATEGY.
8. Respeita `prefers-reduced-motion`.
9. `npm run validate:agent` passa sem erros.

### Anti-sucesso (quando NÃO declarar sucesso)

- O app parece "genérico" — perdeu personalidade sem ganhar calma.
- A versão simples parece "simplória" ou "infantilizada".
- A versão complexa parece "SaaS dashboard" com grade genérica de cards.
- Ícones aparecem sem labels de texto.
- Bordas 1px voltaram como estrutura dominante.
- Cores neon/glass residuais no codebase.
- Dark mode está quebrado (deve estar desabilitado, mas não crashar).

---

*Documento vivo. Atualizar conforme waves são entregues.*
*Antes de codificar qualquer wave, ler CLAUDE.md, .memory/rules.md e .memory/anti-patterns.md.*
