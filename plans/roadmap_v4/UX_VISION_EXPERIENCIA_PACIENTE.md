# Experiência do Paciente — Meus Remédios

**Versão:** 1.0 (SSOT pós-entrega)
**Última atualização:** 08/03/2026
**Status:** Documento vivo — referência canônica de UX

> Este documento descreve a experiência **que o Meus Remédios já oferece**, não o que vai oferecer. É o norte criativo para qualquer desenvolvimento futuro de interface. Antes de tocar em UI, leia este documento e use a skill `.claude/skills/ui-design-brain/`.

---

## 1. O que é o Meus Remédios

Um PWA de gerenciamento pessoal de medicamentos. O paciente registra seus remédios, configura protocolos de dosagem, controla estoque e acompanha sua adesão ao tratamento. Simples de descrever. Difícil de acertar.

A interface não serve ao desenvolvedor. Serve a quem acorda todo dia e precisa tomar 2, 5 ou 12 remédios sem esquecer, sem confundir, sem desistir.

### O paciente central

Não é um técnico. Pode ser jovem ou idoso. Pode ter 1 remédio simples ou um protocolo cardiovascular complexo. O que ele quer quando abre o app:

> *"Quais remédios eu preciso tomar agora?"*

Tudo na interface deve responder a essa pergunta antes de qualquer outra coisa.

---

## 2. Princípios de Design

Estes princípios guiaram a evolução da UX e devem guiar qualquer desenvolvimento futuro.

### P1 — Transformar números em histórias visuais

Dados brutos não motivam. Histórias motivam.

| Dado bruto | História visual |
|------------|----------------|
| "85% de adesão" | Ring gauge animado com cor + trend arrow |
| "8 comprimidos (4 dias)" | Barra horizontal com cor de criticidade |
| "R$187/mês" | Mini-chart de distribuição por medicamento |
| "12 dias seguidos" | Badge de streak com animação de entrada |

### P2 — Evoluir, não acumular

Não criar views novas para cada feature. Enriquecer o que existe. O Histórico virou "Minha Saúde" — não uma tela a mais. Os remédios e protocolos viraram "Tratamento" — não uma tela a mais.

### P3 — Surpreender quem é disciplinado

Micro-animações ao registrar dose. Counter flip. Streak badge pulsante. Check mark com bounce. O paciente que toma seus remédios todo dia merece que a interface comemore isso.

### P4 — Escalar sem sobrecarregar

A UI que serve 2 medicamentos não pode ser a mesma (visualmente) que serve 10. O sistema detecta a complexidade do paciente e adapta a densidade automaticamente.

### P5 — Navegação por atividade, não por entidade

Antes: Remédios / Protocolos / Estoque / Histórico → reflete a modelagem de dados.
Hoje: **Hoje / Tratamento / Estoque / Perfil** → reflete o que o paciente faz.

---

## 3. Estrutura de Navegação

### BottomNav: 4 tabs

```
┌──────┬──────────┬────────┬────────┐
│ Hoje │Tratamento│ Estoque│  Perfil│
└──────┴──────────┴────────┴────────┘
```

| Tab | View | Propósito |
|-----|------|-----------|
| **Hoje** | `dashboard` | Ação imediata. Quais doses agora? |
| **Tratamento** | `treatment` | Gerenciar medicamentos + protocolos. Wizard de cadastro. |
| **Estoque** | `stock` | Visualizar e repor estoque. Custos. Prescrições. |
| **Perfil** | `profile` | Saúde & Histórico. Relatórios. Configurações. |

Views acessíveis por navegação interna (não pelo BottomNav): `medicines`, `protocols`, `history`, `settings`.

---

## 4. A Tab "Hoje" — O Coração do App

### 4.1 Anatomia do Dashboard

```
┌──────────────────────────────┐
│ André               ╭───╮85%│  ← RingGauge (tamanho adapta por complexidade)
│ 🔥 12d  ▁▃▅▇▅▇█    ╰───╯   │    + sparkline 7d inline
├──────────────────────────────┤
│ ⚠️ 2 alertas          [ver]  │  ← SmartAlerts (badge colapsado no modo complexo)
├──────────────────────────────┤
│ ⚠ ATRASADAS           1  🟠 │  ← Zona deslizante (now - 2h)
│  ⚠ Losartana 08:00 🫀 [reg] │    destaque visual + CTA
├──────────────────────────────┤
│ ▶ AGORA          [⏰│📋] 3/5│  ← toggle hora/plano
│  🫀 Metformina 10:00  [swp] │    swipe para registrar
│  🫀 AAS         10:00  [swp] │    badge de plano inline
│  💊 Vit. D      10:00  [swp] │
│  [LOTE: 3 pendentes]         │
├──────────────────────────────┤
│ ⏳ PRÓXIMAS (+4h)    0/2  ▼  │  ← colapsado no modo complexo
├──────────────────────────────┤
│ 📋 MAIS TARDE        0/3  ▼  │
├──────────────────────────────┤
│ ✅ 4 registradas      [ver]  │
├──────────────────────────────┤
│ EST. ░Omep.🔴 ░Losar.🟡     │  ← StockBars inline (só críticos no modo complexo)
├──────────────────────────────┤
│ [+ Manual] [👨‍⚕️ Consulta]    │
└──────────────────────────────┘
```

### 4.2 Zonas Temporais Deslizantes

O Dashboard não usa blocos fixos de período do dia. Usa **janelas relativas ao momento atual**:

| Zona | Regra | Visual | Comportamento |
|------|-------|--------|---------------|
| **ATRASADAS** | `scheduled < now AND >= now-2h` | 🟠 bg-warning, pulse | Sempre expandida. CTA "Registrar" |
| **AGORA** | `scheduled >= now AND < now+1h` | 🟢 bg-primary, bold | Sempre expandida. Swipe para registrar |
| **PRÓXIMAS** | `scheduled >= now+1h AND < now+4h` | ⚪ bg-muted | Expandida se ≤4 itens |
| **MAIS TARDE** | `scheduled >= now+4h` | ⚪ bg-subtle | Colapsada por padrão |
| **REGISTRADAS** | já registradas hoje | ✅ line-through | Seção final, colapsada |

Às 09:30 o paciente vê: Losartana 08:00 como ATRASADA, Metformina 10:00 como AGORA, Omeprazol 14:00 como PRÓXIMA. A interface faz o parsing temporal por ele.

**Implementação:** `src/features/dashboard/hooks/useDoseZones.js`

### 4.3 Modo Hora vs. Modo Plano

Dentro de cada zona, o paciente escolhe a organização:

- **Modo ⏰ Hora** (padrão): doses listadas por horário, com badge de plano ao lado do nome
- **Modo 📋 Plano**: doses agrupadas por accordion de tratamento (TreatmentAccordion)

O toggle fica visível nos modos moderado e complexo. Em modo simples (≤3 meds), o modo Hora já é suficiente e o toggle não aparece.

**Implementação:** `src/features/dashboard/components/ViewModeToggle.jsx`

### 4.4 Progressive Disclosure — Modos de Complexidade

O sistema detecta a complexidade do paciente e adapta a UI automaticamente:

| Modo | Critério | Adaptações |
|------|----------|------------|
| **Simples** | ≤3 medicamentos | RingGauge grande, cards 3 linhas, botão explícito "Registrar →", zonas sempre expandidas, toggle oculto |
| **Moderado** | 4–6 medicamentos | Cards 2 linhas, toggle disponível, zonas colapsáveis |
| **Complexo** | 7+ medicamentos | RingGauge inline (1 linha), cards 1 linha, toggle padrão = Plano, zonas futuras colapsadas, StockBars só críticos, lote como ação primária |

**Implementação:** `src/features/dashboard/hooks/useComplexityMode.js` + `src/features/dashboard/components/AdaptiveLayout.jsx`

Override manual: Perfil > Configurações > "Densidade da interface" (Confortável / Normal / Compacto).

---

## 5. Biblioteca de Componentes Visuais

Estes são os componentes de design construídos para o Meus Remédios. Todo desenvolvimento futuro de UI deve **usar esses componentes** ou **evoluí-los** — nunca criar paralelos.

Ao construir UI, use a skill **`.claude/skills/ui-design-brain/`** para tomar decisões de design intencionais antes de escrever código.

### 5.1 RingGauge — Health Score Animado

**Path:** `src/features/dashboard/components/RingGauge.jsx`

Ring gauge circular SVG com animação spring. Substitui o HealthScoreCard retangular. Existe em 3 tamanhos que correspondem aos modos de complexidade.

```
SIZE large (simples):         SIZE medium (moderado):    SIZE compact (complexo):
┌──────────────────────┐      ┌──────────────────┐       André    ╭──╮85% 🔥12
│  ╭────────╮           │      │ ╭──╮ 85%  🔥12d  │               ╰──╯
│ ╭╯  85%  ╰╮ Muito Bom│      │ ╰──╯ ▁▃▅▇▅▇█    │
│ ╰╮       ╭╯  🔥 12d  │      └──────────────────┘
│  ╰────────╯           │
│  ▁▃▅▇▅▇█▅▇           │
└──────────────────────┘
```

**Cor do ring por score:**
- `< 50` → vermelho (`--color-error`)
- `50–69` → amarelo (`--color-warning`)
- `70–84` → verde (`--color-success`)
- `≥ 85` → azul (`--color-info`)

**Animação:** SVG `stroke-dashoffset` com Framer Motion spring `{ stiffness: 60, damping: 15 }`.

**Props:** `score`, `streak`, `trend`, `trendPercentage`, `size`, `onClick`, `sparklineData`, `className`

### 5.2 StockBars — Estoque Visual

**Path:** `src/features/dashboard/components/StockBars.jsx`

Barras horizontais de criticidade de estoque. Usadas no Dashboard (widget "Estoque Rápido") e na tab Estoque (seção "Visão Geral").

```
Losart. ████░░░  4d  🟡   ← escala normalizada em 30d
Metfor. ████████ 30d  🟢   ← 100% = 30 dias ou mais
Omepra. ░░░░░░░  0d  🔴   ← pulse animation em barras críticas
Vit. D  █████████90d 🔵
```

**Cores:** critical (<7d) = vermelho, low (<14d) = amarelo, normal (<30d) = verde, high (≥30d) = azul.

**Props:** `items`, `maxItems`, `showOnlyCritical`, `onItemClick`, `className`

**Animação:** Stagger entrance com Framer Motion (`staggerChildren: 0.05`). Pulse CSS em barras critical.

### 5.3 SparklineAdesao — Trend Visual

**Path:** `src/features/dashboard/components/SparklineAdesao.jsx`

Linha de tendência de adesão. Usada inline no RingGauge (7 dias, sem labels) e na sub-view "Minha Saúde" (30 dias, com tooltip e eixo X).

**Sizes:** `'inline'` (sem labels, 20px altura), `'small'`, `'medium'`, `'large'`, `'expanded'` (30 pontos).

**Tooltip (tap num ponto):**
```
+-----------------+
| 24/02           |
| 85% · 3/4 doses |
+-----------------+
```

### 5.4 SwipeRegisterItem — Registro por Swipe

**Path:** `src/shared/components/log/SwipeRegisterItem.jsx`

O gesto principal do app. Swipe para a direita registra a dose. Inclui micro-animações:

| Momento | Animação |
|---------|----------|
| Swipe confirmado | Check mark com bounce `scale: [0, 1.3, 1]` |
| Counter atualiza | Number flip via `AnimatePresence` + `y: [20, 0]` |
| 100% do dia | Confetti (ConfettiAnimation) |
| Milestone streak | Badge scale pulse `scale: [1, 1.15, 1]` × 3 |

### 5.5 CostChart — Custo Mensal

**Path:** `src/features/stock/components/CostChart.jsx`

Distribuição de custo mensal por medicamento. Barras horizontais proporcionais ao custo, total + projeção 3 meses.

Estado vazio: "Adicione preços no estoque para ver custos" com CTA.

**Props:** `items`, `totalMonthly`, `projection3m`, `onExpand`

### 5.6 PrescriptionTimeline — Vigência de Prescrição

**Path:** `src/features/stock/components/PrescriptionTimeline.jsx`

Barra horizontal representando `start_date → today → end_date`. Segmento passado = preenchido. Segmento futuro = outline. Cor por tempo restante: verde (>30d), amarelo (≤30d), vermelho (vencida). `end_date: null` = barra infinita com label "contínuo".

### 5.7 Calendar com Heat Map

**Path:** `src/shared/components/ui/Calendar.jsx`

Calendário de adesão com cores por dia:
- 🟢 100% completo
- 🟡 1–99% parcial
- 🔴 0% (tinha doses esperadas)
- ⚪ sem doses esperadas ou dia futuro

**Prop:** `adherenceData: Object<YYYY-MM-DD, {adherence, taken, expected}>`

Click no dia → painel com status por protocolo.

### 5.8 PlanBadge — Contexto de Tratamento

**Path:** `src/features/dashboard/components/PlanBadge.jsx`

Badge com emoji + cor definidos pelo usuário ao criar o plano. Aparece ao lado do nome do medicamento no modo Hora, mantendo o contexto clínico visível.

Tap no badge → tooltip com nome do plano + objetivo + médico.

**Padrões sugeridos no wizard:** 🫀 Cardiovascular, 🩸 Diabetes, 💊 Suplementos, 🧠 Neurológico, 🦴 Ortopédico.

### 5.9 BatchRegisterButton — Registro em Lote

**Path:** `src/features/dashboard/components/BatchRegisterButton.jsx`

Registra múltiplas doses de uma vez. No modo Hora: "Registrar todos do horário 08:00". No modo Plano: "Registrar todo Cardiovascular". Ação primária no modo complexo.

### 5.10 ViewModeToggle — Alternar Organização

**Path:** `src/features/dashboard/components/ViewModeToggle.jsx`

Segmented control [⏰ Hora | 📋 Plano] que alterna a organização dentro de cada zona temporal. Visível apenas nos modos moderado e complexo. Última escolha persistida em localStorage.

### 5.11 AdaptiveLayout — Wrapper de Complexidade

**Path:** `src/features/dashboard/components/AdaptiveLayout.jsx`

Wrapper que recebe `complexityMode` e ajusta densidade. Encapsula as regras de progressive disclosure de forma declarativa.

---

## 6. CSS e Design Tokens

Todo componente usa tokens do design system. Nunca hardcodar cores ou espaçamentos.

```css
/* Cores semânticas de nível de estoque (STOCK_LEVELS) */
--color-error:   #ef4444;  /* critical  — <7 dias */
--color-warning: #f59e0b;  /* low       — <14 dias */
--color-success: #22c55e;  /* normal    — <30 dias */
--color-info:    #3b82f6;  /* high      — ≥30 dias */

/* Animação de itens críticos */
.pulse-critical {
  animation: pulse-critical 2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pulse-critical { animation: none; }
}
```

**Path das animações globais:** `src/shared/styles/animations.css`

### Acessibilidade

Todo componente visual deve ter:
- `role="img"` em SVGs informativos
- `aria-label` descritivo (ex: `"Adesão: 85%. Streak: 12 dias"`)
- `tabindex="0"` em elementos clicáveis que não são botões ou links
- Respeito a `prefers-reduced-motion` (skip springs, instant render)

---

## 7. A Tab "Tratamento"

Fusão de Remédios + Protocolos. O paciente pensa em "meu tratamento", não em "entidades separadas".

```
┌──────────────────────────────┐
│ Meu Tratamento     [+ Novo]  │
├──────────────────────────────┤
│ 📁 PLANOS                    │
│  ▶ 🫀 Cardiovascular         │
│    Losartana · 2×/dia        │
│    Metformina · 2×/dia       │
│  ▶ 💊 Suplementos            │
├──────────────────────────────┤
│ 📋 PROTOCOLOS AVULSOS        │
│  Omeprazol · diário 22:00    │
├──────────────────────────────┤
│ 💊 SEM PROTOCOLO             │
│  Dipirona                    │
│  [Criar protocolo →]         │
├──────────────────────────────┤
│ ⏸️ INATIVOS (2)       [ver]  │
└──────────────────────────────┘
```

**Wizard de Cadastro Unificado** (`TreatmentWizard.jsx`): 3 passos (Medicamento → Como tomar → Estoque atual). Substitui os `window.confirm()` nativos. Cada passo tem botão "Pular".

---

## 8. A Tab "Estoque"

```
┌──────────────────────────────┐
│ Meu Estoque          [+ Add] │
├──────────────────────────────┤
│ VISÃO GERAL (StockBars)      │  ← barras de criticidade
├──────────────────────────────┤
│ PRESCRIÇÕES (PrescTimeline)  │  ← vigência visual
├──────────────────────────────┤
│ ❌ SEM ESTOQUE               │
│ ⚠️ ACABA EM BREVE            │
│ ✅ ESTOQUE OK                │
├──────────────────────────────┤
│ 💰 CUSTO MENSAL (CostChart)  │
└──────────────────────────────┘
```

---

## 9. A Tab "Perfil" e Sub-view "Minha Saúde"

```
┌──────────────────────────────┐
│ 👤 André                     │
├──────────────────────────────┤
│ SAÚDE & HISTÓRICO            │
│ 📊 Minha Saúde →            │  ← sub-view com calendário heat map,
│                              │    sparkline 30d, insights, streak,
│ 🆘 Cartão de Emergência →   │    interações, custos detalhados
│ 👨‍⚕️ Modo Consulta →           │
├──────────────────────────────┤
│ RELATÓRIOS & DADOS           │
│ 📊 Relatório PDF →          │
│ 📤 Exportar Dados →         │
│ 🔗 Compartilhar →           │
├──────────────────────────────┤
│ CONFIGURAÇÕES                │
│ 🤖 Telegram [Conectado ✅]   │
│ 🎨 Tema (claro/escuro)       │
│ 🏋️ Densidade da interface    │  ← override do complexity mode
│ 🔒 Alterar Senha             │
└──────────────────────────────┘
```

**"Minha Saúde"** consolida o que antes estava disperso: calendário com heat map, sparkline ampliada (30d), insights de padrões, streak + melhor streak, interações medicamentosas, timeline de doses, stats do mês.

---

## 10. Fluxos Cross-Tela

```
           HOJE ←─────────── PERFIL
            │                   │
      [swipe dose]         [minha saúde →]
      [modo consulta]      [emergency]
      [estoque rápido→]         │
      [alertas→]           TRATAMENTO
            │                   │
            ├─── TRATAMENTO ────┤
            │  [wizard]         │
            │                   │
            └─── ESTOQUE ───────┘
               [prescrições]
               [custo]
```

| De | Trigger | Para |
|----|---------|------|
| Hoje | StockBars tap 🔴 | Estoque (scroll para o med) |
| Hoje | SmartAlert "Estoque Baixo" | Estoque |
| Hoje | SmartAlert "Prescrição" | Tratamento (protocolo) |
| Hoje | SmartAlert "Dose Atrasada" | LogForm pré-preenchido |
| Hoje | Ring Gauge click | DailyDoseModal |
| Estoque | Prescrição tap | Tratamento (protocolo) |
| Perfil | "Minha Saúde" | HealthHistory sub-view |
| Perfil | Calendário dia click | Detalhe por protocolo |
| Tratamento | "+Novo" | TreatmentWizard |
| Tratamento | "Sem protocolo" CTA | TreatmentWizard (step 2) |

---

## 11. Como Desenvolver UI Neste App

### Regra 1 — Usar a skill ui-design-brain

Antes de escrever qualquer linha de UI, acione a skill `.claude/skills/ui-design-brain/`:

```
1. Quem usa esta interface? → Paciente (não técnico, contexto mobile-first)
2. Emoção dominante? → Confiança + encorajamento sutil
3. O que já existe no codebase? → Componentes da seção 5 deste doc
4. O que o usuário DEVE fazer nesta tela? → Registrar a dose
```

**Preset de personalidade deste app:** Híbrido entre **B (Apple-level Minimal)** para o header/gauge e **E (Data Dashboard)** para as listas de doses e widgets de estoque. Nunca Preset D (expressive) — não é um app de marketing.

### Regra 2 — Evoluir componentes existentes

Antes de criar um componente novo, verificar se existe um na seção 5. Se existir, evoluí-lo. Se precisar criar, seguir os padrões:

- Props tipadas e documentadas
- Sem estado global (dados via props)
- CSS com tokens (`--color-*`, `--space-*`, `--font-size-*`)
- `prefers-reduced-motion` respeitado
- Empty, loading e error states incluídos

### Regra 3 — Escalar por complexidade

Qualquer novo componente na tab Hoje deve se comportar diferente nos 3 modos. Testar com 2 meds (simples) e com 10 meds (complexo) antes de considerar pronto.

### Regra 4 — Animar com significado

Cada animação deve comunicar algo. A lista de animações aprovadas neste app:

| Gatilho | Animação | Componente |
|---------|----------|------------|
| Mount do ring gauge | Spring progressivo | RingGauge |
| Score muda | Number flip (AnimatePresence) | RingGauge |
| Barras de estoque entram | Stagger entrance | StockBars |
| Barra critical | Pulse opacity | StockBars + .pulse-critical |
| Swipe confirmado | Check bounce `scale:[0,1.3,1]` | SwipeRegisterItem |
| Milestone streak | Badge pulse ×3 | SwipeRegisterItem |
| 100% do dia | Confetti | ConfettiAnimation |
| Entrada de modal/wizard | `translateY(8px)→0, opacity:0→1` | TreatmentWizard |

---

## 12. Métricas da Experiência Atual

| Aspecto | Antes da evolução | Hoje |
|---------|-------------------|------|
| Scroll para registrar 1ª dose | ~3 telas | ≤1 tela (zona "AGORA" sempre no topo) |
| Identificar estoque crítico | Navegar para Estoque | StockBars visível no Dashboard |
| Ação após alerta de prescrição | Nenhuma (Settings) | Cross-nav para Tratamento |
| Feedback ao registrar dose | Nada | Check + counter flip + streak badge |
| Entendimento de adesão mensal | Número "85%" | Ring gauge + sparkline + heat map |
| window.confirm nativo | Cascata de confirms | TreatmentWizard 3 passos |
| Tabs do BottomNav | 5 (entidades) | 4 (atividades) |
| Componentes com animação | 1 (confetti) | 10+ (ring, barras, swipe, etc.) |

---

## 13. Referência de Arquivos

### Componentes visuais (Onda 1)
| Componente | Path |
|-----------|------|
| RingGauge | `src/features/dashboard/components/RingGauge.jsx` |
| StockBars | `src/features/dashboard/components/StockBars.jsx` |
| SparklineAdesao | `src/features/dashboard/components/SparklineAdesao.jsx` |
| SwipeRegisterItem | `src/shared/components/log/SwipeRegisterItem.jsx` |
| CostChart | `src/features/stock/components/CostChart.jsx` |
| PrescriptionTimeline | `src/features/stock/components/PrescriptionTimeline.jsx` |
| Calendar (heat map) | `src/shared/components/ui/Calendar.jsx` |
| animations.css | `src/shared/styles/animations.css` |

### Hooks e lógica (Onda 2)
| Hook/Componente | Path |
|----------------|------|
| useDoseZones | `src/features/dashboard/hooks/useDoseZones.js` |
| useComplexityMode | `src/features/dashboard/hooks/useComplexityMode.js` |
| DoseZoneList | `src/features/dashboard/components/DoseZoneList.jsx` |
| ViewModeToggle | `src/features/dashboard/components/ViewModeToggle.jsx` |
| PlanBadge | `src/features/dashboard/components/PlanBadge.jsx` |
| BatchRegisterButton | `src/features/dashboard/components/BatchRegisterButton.jsx` |
| AdaptiveLayout | `src/features/dashboard/components/AdaptiveLayout.jsx` |

### Navegação (Onda 3)
| View/Componente | Path |
|----------------|------|
| BottomNav (4 tabs) | `src/shared/components/ui/BottomNav.jsx` |
| Treatment view | `src/views/Treatment.jsx` |
| Profile view | `src/views/Profile.jsx` |
| HealthHistory | `src/views/HealthHistory.jsx` |
| TreatmentWizard | `src/features/dashboard/components/TreatmentWizard.jsx` |

### Skill de UI
| Recurso | Path |
|---------|------|
| SKILL.md (ponto de entrada) | `.claude/skills/ui-design-brain/SKILL.md` |
| Componentes de navegação | `.claude/skills/ui-design-brain/references/components-navigation.md` |
| Componentes de dados | `.claude/skills/ui-design-brain/references/components-data.md` |
| Componentes de layout | `.claude/skills/ui-design-brain/references/components-layout.md` |
| Componentes de feedback | `.claude/skills/ui-design-brain/references/components-feedback.md` |
| Componentes de input | `.claude/skills/ui-design-brain/references/components-inputs.md` |
| Templates de página | `.claude/skills/ui-design-brain/references/page-templates.md` |

---

*Documento mantido pelo time. Atualizar sempre que uma evolução de UX significativa for entregue.*
*Spec de execução histórica: `plans/specs-ux-vision/EXEC_SPEC_UX_EVOLUTION.md`*
