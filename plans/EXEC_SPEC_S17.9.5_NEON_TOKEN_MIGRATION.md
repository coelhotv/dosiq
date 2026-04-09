# EXEC SPEC — Sprint 17.9.5: Neon Token Migration

> **DEVFLOW Planning Output**
> Mode: Planning
> Sprint: S17.9.5 — Neon Token Migration (CSS Token Cleanup)
> Date: 2026-04-09
> Depends on: S17.9 ✅ (CSS file consolidation complete, merged PR #454)
> Precedes: S17.10 (Onboarding & Final Polish) — que depende de zero neon tokens
> Spec Reference: `plans/EXEC_SPEC_S17.9_CSS_CLEANUP.md` §Deferred + `plans/DELIVERY_REQUIREMENTS_WAVE_17.md`

---

## Diagnóstico: Natureza dos Tokens Neon

> **Pergunta respondida:** Os tokens neon são **100% legado do design antigo (Neon/Glass)**.
> Nenhum deles deve existir no Santuário Terapêutico.

### Origem e Distribuição

O repositório tem **250 referências** a tokens `--neon-*` e `--accent-*` em **40 arquivos CSS**.

Esses tokens se dividem em dois grupos:

#### Grupo A — CSS não tocados pelas Waves de redesign
Arquivos criados antes das Waves (dez 2025 – fev 2026) que nunca foram migrados:
- Continuam usando `--neon-*` como tokens de cor base
- São o "sistema antigo" vivo side-by-side com os redesign components

#### Grupo B — CSS parcialmente migrados pelas Waves
Arquivos que as Waves redesenharam mas deixaram resíduos neon:
- Exemplo: `AlertList.css` foi redesenhado na W14 mas `--neon-pink` e `--neon-cyan` permaneceram em seletores específicos de severidade
- As Waves introduziram tokens Sanctuary para os elementos novos mas não varreram os existentes

#### Grupo C — Landing.css (orphaned + neon)
- `src/views/Landing.css` (973 linhas, 17 refs neon): CSS da landing **pré-Wave 13**
- Landing.jsx importa **apenas** `./LandingPrototype.css` (Wave 13 rewrite)
- Seletores `.landing-container`, `.hero-section`, `.hero-content` não usados em nenhum JSX
- **Ação: deletar** (AP-096: verificado com grep de className ✓ — zero matches)

---

## Audit Summary (2026-04-09)

### Token de Frequência

| Token | Refs | Mapeamento Sanctuary | Notas |
|-------|------|---------------------|-------|
| `--neon-cyan` | 62 | `--color-primary` (#006a5e) | Ciano → verde saúde |
| `--accent-primary` | 49 | `--color-primary` | Alias direto |
| `--neon-pink` | 25 | `--color-error` (#ba1a1a) | Pink crítico → error |
| `--neon-magenta` | 25 | `--color-error` | Magenta → error |
| `--accent-success` | 20 | `--color-success` (#22c55e) | Alias direto |
| `--neon-green` | 17 | `--color-success` | Verde → success |
| `--neon-blue` | 15 | `--color-secondary` (#005db6) | Azul clínico |
| `--neon-purple` | 13 | `--color-secondary` | Roxo → azul secundário |
| `--accent-warning` | 12 | `--color-warning` (#f59e0b) | Alias direto |
| `--neon-yellow` | 11 | `--color-warning` | Amarelo → warning |
| `--neon-red` | 11 | `--color-error` | Vermelho → error |
| `--neon-orange` | 10 | `--color-warning` | Laranja → warning |
| `--accent-error` | 10 | `--color-error` | Alias direto |
| `--accent-secondary` | 7 | `--color-secondary` | Alias direto |
| `--accent-danger` | 2 | `--color-error` | Danger → error |
| `--accent-info` | 1 | `--color-info` | Info direto |
| `--accent-danger-dark` | 1 | `--color-error-container` | Dark variant |
| `--accent-cyan-dark` | 1 | `--color-primary-dark` | Cyan dark variant |

### Tokens Fonte (definições a remover)

| Arquivo | Refs a remover | Ação |
|---------|----------------|------|
| `src/shared/styles/tokens/colors.css` | 18 (definições `--neon-*`) | Remover bloco neon DEPOIS de migrar todos os usos |
| `src/styles/tokens/colors.css` | 18 (duplicata) | Remover bloco neon DEPOIS de migrar todos os usos |
| `src/shared/styles/tokens.css` | 11 | Remover bloco neon DEPOIS de migrar |
| `src/styles/tokens.css` | 11 | Remover bloco neon DEPOIS de migrar |

### Arquivos Por Grupo de Trabalho (40 total)

**Grupo 0 — Deletar (orphaned, AP-096 verificado):**
- `src/views/Landing.css` — 17 refs neon, orphaned (Landing.jsx não importa este arquivo)

**Grupo 1 — Token Source Files (migrar definições, remover por último):**
- `src/shared/styles/tokens/colors.css` — 18 definições `--neon-*`
- `src/styles/tokens/colors.css` — 18 definições (cópia do shared)
- `src/shared/styles/tokens.css` — 11 definições
- `src/styles/tokens.css` — 11 definições

**Grupo 2 — Shared UI Components:**
- `src/shared/components/ui/Button.css` — 7 refs
- `src/shared/components/ui/AlertList.css` — 7 refs (W14 parcial)
- `src/shared/components/ui/Calendar.css` — 9 refs
- `src/shared/components/ui/Loading.css` — 4 refs
- `src/shared/components/ui/Modal.css` — 2 refs
- `src/shared/components/ui/animations/Animations.css` — 7 refs
- `src/shared/components/log/LogForm.css` — 2 refs
- `src/shared/components/gamification/MilestoneCelebration.css` — 2 refs

**Grupo 3 — Dashboard Components:**
- `src/features/dashboard/components/SmartAlerts.css` — 6 refs
- `src/features/dashboard/components/InsightCard.css` — 3 refs
- `src/features/dashboard/components/SwipeRegisterItem.css` — 3 refs
- `src/features/dashboard/components/StockAlertsWidget.css` — 8 refs
- `src/features/dashboard/components/TreatmentAccordion.css` — 4 refs
- `src/features/dashboard/components/HealthScoreCard.css` — n refs
- `src/features/dashboard/components/HealthScoreDetails.css` — n refs
- `src/features/dashboard/components/QuickActionsWidget.css` — n refs

**Grupo 4 — Protocol Components:**
- `src/features/protocols/components/TitrationTimeline.css` — 11 refs
- `src/features/protocols/components/TitrationStep.css` — 10 refs
- `src/features/protocols/components/TitrationWizard.css` — 1 ref
- `src/features/protocols/components/TitrationTransitionAlert.css` — n refs
- `src/features/protocols/components/ProtocolChecklistItem.css` — 6 refs
- `src/features/protocols/components/ProtocolForm.css` — 5 refs

**Grupo 5 — Feature Components:**
- `src/features/adherence/components/AdherenceWidget.css` — n refs
- `src/features/adherence/components/StreakBadge.css` — n refs
- `src/features/medications/components/MedicineForm.css` — 6 refs
- `src/features/stock/components/StockForm.css` — 3 refs

**Grupo 6 — Global & Theme Files:**
- `src/shared/styles/index.css` — 1 ref
- `src/shared/styles/themes/dark.css` — 9 refs
- `src/shared/styles/themes/light.css` — 9 refs
- `src/styles/index.css` — n refs (src/styles é provavelmente duplicata de shared/styles)
- `src/styles/themes/dark.css` — 9 refs
- `src/styles/themes/light.css` — 9 refs

**Grupo 7 — Views:**
- `src/App.css` — n refs
- `src/views/Medicines.css` — n refs
- `src/views/Protocols.css` — n refs

---

## Escopo S17.9.5

**Objetivo:** Substituir TODOS os tokens `--neon-*` e `--accent-*` por tokens Sanctuary equivalentes.
**Pré-condição:** S17.9 completo ✓ (sem `.redesign.css` pendentes)
**Meta:** `grep -r "\-\-neon-" src/` retorna zero resultados

### Deliverables

1. **Deletar `src/views/Landing.css`** — orphaned (AP-096 verificado: sem className usage)
2. **Migrar tokens em 39 arquivos CSS** — substituir `--neon-*` e `--accent-*` por Sanctuary
3. **Remover definições neon de token source files** — colors.css, tokens.css (4 arquivos)
4. **Verificar gradients e glows** — usos como `linear-gradient(135deg, var(--neon-cyan), var(--neon-magenta))` precisam de escolha contextual

### Fora do Escopo

- Mudanças de comportamento visual (objetivo: trocar tokens, manter aparência Sanctuary)
- Criação de novos tokens (usar apenas tokens existentes em sanctuary.css)
- Mudanças em arquivos JSX (CSS-only sprint)
- LandingPrototype.css (não usa neon, mantido intacto)

---

## Regras de Mapeamento Detalhadas

### Tokens de Cor Direta

```css
/* REMOVER → SUBSTITUIR */
var(--neon-cyan)          → var(--color-primary)
var(--neon-blue)          → var(--color-secondary)
var(--neon-purple)        → var(--color-secondary)
var(--neon-green)         → var(--color-success)
var(--neon-yellow)        → var(--color-warning)
var(--neon-red)           → var(--color-error)
var(--neon-pink)          → var(--color-error)
var(--neon-magenta)       → var(--color-error)
var(--neon-orange)        → var(--color-warning)
var(--accent-primary)     → var(--color-primary)
var(--accent-secondary)   → var(--color-secondary)
var(--accent-error)       → var(--color-error)
var(--accent-success)     → var(--color-success)
var(--accent-warning)     → var(--color-warning)
var(--accent-danger)      → var(--color-error)
var(--accent-danger-dark) → var(--color-error-container)
var(--accent-info)        → var(--color-info)
var(--accent-cyan-dark)   → var(--color-primary-dark)
```

### Casos Especiais — Gradients

```css
/* ANTES — design neon */
background: linear-gradient(135deg, var(--neon-cyan), var(--neon-magenta));

/* DEPOIS — Sanctuary: gradient primário → secundário */
background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));

/* ANTES — gradient ciano/azul */
background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));

/* DEPOIS — gradient primary */
background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
```

### Casos Especiais — Box Shadows / Glows

```css
/* ANTES — neon glow effect */
box-shadow: 0 0 20px var(--neon-cyan);

/* DEPOIS — shadow suave Sanctuary (sem glow) */
box-shadow: var(--shadow-md);

/* ANTES — colored glow */
box-shadow: 0 0 10px rgba(var(--neon-cyan), 0.3);

/* DEPOIS — primary bg tint */
box-shadow: var(--shadow-sm);
```

> **Nota sobre glows:** O Santuário Terapêutico usa `--shadow-*` tokens (ambient shadows) em vez de neon glows. Ao migrar, substituir glows neon por `var(--shadow-md)` ou o shadow token adequado ao contexto.

### Tokens de Tema (dark/light.css)

Os temas dark e light têm 9 refs neon cada. No dark theme, o mapeamento deve preservar a intenção de contraste:

```css
/* dark theme: --neon-cyan como cor de accent em escuro */
/* → usar --color-primary-light ou --color-primary-container para manter contraste */
var(--neon-cyan)   → var(--color-primary-container)   /* em dark theme, variant mais clara */
var(--neon-green)  → var(--color-success-light)        /* em dark theme */
var(--neon-red)    → var(--color-error-light)           /* em dark theme */
```

---

## Ordem de Execução (C3)

> **CRÍTICO: Migrar usos ANTES de remover definições.**
> Se remover `--neon-*` de colors.css antes de migrar os componentes, a build quebra.

```
Passo 1: Deletar Landing.css (orphaned) → build + grep check
Passo 2: Migrar Grupo 6 (themes/dark.css, themes/light.css, index.css) → build
Passo 3: Migrar Grupo 2 (shared UI: Button, AlertList, Calendar, Modal, Loading) → build
Passo 4: Migrar Grupo 3 (dashboard components) → build
Passo 5: Migrar Grupo 4 (protocol components) → build
Passo 6: Migrar Grupo 5 (feature components) → build
Passo 7: Migrar Grupo 7 (views: Medicines, Protocols, App.css) → build
Passo 8: Remover definições de Grupo 1 (token source files) → build final
Passo 9: grep validation — zero results
```

**Por que themes primeiro (Passo 2)?** Os arquivos dark/light.css podem sobreescrever valores. Migrá-los antes garante que o comportamento dark mode seja correto durante os testes visuais dos passos seguintes.

---

## Acceptance Criteria

- [ ] `grep -r "\-\-neon-" src/ --include="*.css"` retorna **zero resultados**
- [ ] `grep -r "\-\-accent-" src/ --include="*.css"` retorna **zero resultados** (exceto se existir custom --accent-color em sanctuary que não seja legado)
- [ ] `src/views/Landing.css` deletado (orphaned verificado)
- [ ] Definições neon removidas de `colors.css` (shared + styles)
- [ ] Definições neon removidas de `tokens.css` (shared + styles)
- [ ] `npm run build` passa (sem erros)
- [ ] `npm run validate:agent` passa (543+ tests)
- [ ] `npm run lint` passa (sem novos erros)
- [ ] Inspeção visual: Dashboard, Medicines, Protocols, Stock, Settings carregam com design correto

---

## Quality Gates (C4)

```bash
# Após cada grupo de arquivos migrado:
npm run build

# Após deletar Landing.css (Passo 1 — AP-096 check):
grep -r "landing-container\|hero-section\|hero-content" src/ --include="*.jsx"
# Deve retornar zero

# Após Passo 8 (remover definições):
grep -r "\-\-neon-" src/ --include="*.css"
# Deve retornar zero

# Antes do PR:
npm run validate:agent
npm run lint
```

---

## Risk Matrix

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Gradient visual com tokens trocados parece errado | MÉDIA | MÉDIA | Validar visualmente após cada grupo; gradients `primary→secondary` são aceitáveis Sanctuary |
| Dark theme perde contraste após migração | MÉDIA | ALTA | Usar variants claras (`--color-primary-container`) em dark overrides; testar dark mode |
| src/styles/ é duplicata de src/shared/styles — mudança duplicada | ALTA | BAIXA | Confirmar e migrar ambos (4 arquivos: 2 de cada) |
| `--accent-*` token usado em inline styles JSX | BAIXA | MÉDIA | `grep -r "\-\-accent-" src/ --include="*.jsx"` antes de começar |

---

## Pre-Sprint Checks (executar ANTES de criar branch)

```bash
# 1. Confirmar estado do S17.9 (zero .redesign refs)
grep -r "layout.redesign\|components.redesign\|tokens.redesign" src/
# Esperado: zero

# 2. Confirmar contagem atual neon (baseline para validação)
grep -r "\-\-neon-\|--accent-" src/ --include="*.css" | wc -l
# Esperado: 250

# 3. Confirmar Landing.css não tem imports (AP-096 verificado)
grep -r "Landing\.css\|landing-container\|hero-section\|hero-content" src/ --include="*.jsx"
# Esperado: zero

# 4. Confirmar que sanctuary.css tem todos os tokens necessários
grep "\-\-color-primary\|--color-secondary\|--color-error\|--color-success\|--color-warning\|--color-info" \
  src/shared/styles/tokens/sanctuary.css | head -10
# Esperado: definições presentes
```

---

## Notas para Implementação

### src/styles/ vs src/shared/styles/
Existem dois diretórios paralelos (`src/styles/` e `src/shared/styles/`). Ambos têm `tokens.css` e `tokens/colors.css` com refs neon. Migrar os dois. Verificar se existe duplicação de outros arquivos também.

### index.css (src/shared/styles/index.css)
Tem 1 ref neon (`.gradient-text` usa `var(--neon-cyan)` e `var(--neon-magenta)`):
```css
/* ANTES */
.gradient-text {
  background: linear-gradient(135deg, var(--neon-cyan), var(--neon-magenta));
}
/* DEPOIS */
.gradient-text {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
}
```

### AlertList.css — Seletores de Severidade
```css
/* ANTES */
.alert-item--critical {
  --alert-color: var(--neon-pink);
  box-shadow: var(--shadow-alert-critical);
}
.alert-item--info {
  --alert-color: var(--neon-cyan);
}
/* DEPOIS */
.alert-item--critical {
  --alert-color: var(--color-error);
  box-shadow: var(--shadow-alert-critical);
}
.alert-item--info {
  --alert-color: var(--color-primary);
}
```

---

## Conexão com Wave 17 Roadmap

Esta sprint desbloqueia S17.10:
- S17.10 (Onboarding & Final Polish) depende de "neon tokens gone"
- DELIVERY_REQUIREMENTS_WAVE_17.md: "Sprint 17.9 gate: grep `--neon-*` must return zero"
- Após S17.9.5: `grep -r "\-\-neon-" src/` → zero → gate passa → S17.10 pode iniciar

---

## Spec Cross-References

- **Deferred from:** `plans/EXEC_SPEC_S17.9_CSS_CLEANUP.md` §Deferred
- **Wave deliverable:** `plans/backlog-redesign/WAVE_17_ROLLOUT_LEGACY_CLEANUP.md`
- **Process requirements:** `plans/DELIVERY_REQUIREMENTS_WAVE_17.md`
- **Master Spec:** `plans/backlog-redesign/MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`
- **AP-096:** CSS deletion without verifying className usage (evitar nova regressão)
