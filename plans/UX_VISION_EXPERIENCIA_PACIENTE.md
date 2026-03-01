# Visão de Experiência Unificada — Meus Remédios

**Data:** 27/02/2026
**Status:** Em evolução
**Versão:** 0.3

---

## 1. Diagnóstico: Onde Estamos

### O que está maduro
- Infraestrutura sólida (Supabase, Vercel, Telegram bot)
- Qualidade de código (89 regras, 32 anti-patterns, CI com Gemini review)
- Documentação abrangente (.memory, CLAUDE.md, post-mortems)
- Funcionalidades core entregues (CRUD, protocolos, estoque, logs, adesão)

### O que falta
A **experiência visual** não acompanhou a evolução da infra. Os dados existem, mas são apresentados como **listas e números**, não como **visualizações que contam uma história**.

### Problemas específicos

**P1: Dashboard sobrecarregado**
~8 blocos competindo por atenção: saudação, health score (card grande), sparkline, insight card, smart alerts, tratamentos (accordion), próximas doses, últimas doses, 2 FABs. O paciente que quer "tomar seus remédios da manhã" faz scroll e parsing visual.

**P2: Navegação por entidade, não por atividade**
BottomNav (Início, Remédios, Protocolos, Estoque, Histórico) reflete a modelagem de dados. "Protocolos" é jargão técnico. Remédios e Protocolos são steps de um mesmo processo (gerenciar tratamento).

**P3: Features de valor clínico escondidas**
Emergency Card, Modo Consulta, Exportação, Relatórios PDF — tudo no fundo de Settings. São features de alto valor tratadas como configurações.

**P4: Falta de visualização gráfica**
Estoque é uma lista textual com números. Não existe representação visual que identifique criticidade de relance. O sparkline de adesão é o único gráfico real.

**P5: Dead-ends e window.confirm**
Stock e History não têm navegação contextual (só BottomNav). Cascade creation (Med→Prot→Stock) usa `window.confirm()` nativo — quebra a experiência PWA.

**P6: Nenhuma surpresa ou deleite**
Fora o confetti de 100%, não há micro-interações que incentivem o uso diário. Nenhuma animação de progresso, nenhum badge, nenhum "parabéns pelo 7º dia de streak".

---

## 2. Filosofia da Evolução

### Princípio 1: Evoluir, não adicionar
Não criar views novas. Enriquecer as existentes com gráficos, animações, dados comparativos. O Histórico já tem calendário — dar cores de adesão a ele, não criar outro.

### Princípio 2: O accordion funciona — evoluir os gráficos
O TreatmentAccordion serve bem para registrar múltiplos protocolos no mesmo horário. Manter. A evolução é nos componentes visuais ao redor dele.

### Princípio 3: Transformar números em histórias visuais
"8 comprimidos (4 dias)" → barra horizontal com cor e projeção.
"85% de adesão" → ring gauge animado com tendência.
"R$187/mês" → mini-chart de distribuição por medicamento.

### Princípio 4: Surpreender e incentivar
Micro-animações ao registrar dose. Counter animado. Streak badges. Pulse em itens críticos. Gamificação sutil que recompensa disciplina.

---

## 3. Estrutura de Navegação Proposta

### BottomNav: 5 → 4 tabs

```
ATUAL (5 tabs):              PROPOSTA (4 tabs):
┌────┬────┬────┬────┬────┐   ┌──────┬──────┬──────┬──────┐
│Home│Rem.│Prot│Est.│Hist│   │ Hoje │Trat. │Est.  │Perfil│
└────┴────┴────┴────┴────┘   └──────┴──────┴──────┴──────┘
```

| Tab atual | → Tab nova | Justificativa |
|-----------|-----------|---------------|
| Início (Dashboard) | **Hoje** | Foco no dia-a-dia, ação imediata |
| Remédios + Protocolos | **Tratamento** | Fusão: paciente pensa em "tratamento", não em "entidade + regra" |
| Estoque | **Estoque** | Mantém, evolui visualmente + prescrições + custos |
| Histórico | → absorvido | Calendário/timeline vão para Perfil>Saúde. Últimas doses ficam em Hoje |
| Settings | **Perfil** | Evolui: agrupa saúde, dados, configurações. Ganha Emergency Card e Consulta |

---

## 4. Evolução de Cada Tela

### 4.1 TAB "HOJE" — Dashboard Evoluído

**Mantém intacto:** accordion, swipe, lote, FABs, SmartAlerts
**Evolui visualmente:**

```
┌──────────────────────────────┐
│ Bom dia, André         🌙 👤 │
├──────────────────────────────┤
│  ┌─────────────────────────┐ │
│  │  HEALTH SCORE      85%  │ │  ← EV-01: ring gauge animado
│  │      ╭───╮              │ │    Framer Motion spring animation
│  │    ╭╯ 85 ╰╮   🔥 12d   │ │    Cor: vermelho→amarelo→verde→azul
│  │    ╰╮    ╭╯   streak   │ │    Click → detalhe (DailyDoseModal)
│  │      ╰───╯              │ │
│  │  ▁▂▃▅▇▅▇█▅▇▅▃▅▇▅▇█▅▇  │ │  ← EV-04: sparkline 7d inline
│  │  S  T  Q  Q  S  S  D   │ │    com tooltip on tap
│  └─────────────────────────┘ │
├──────────────────────────────┤
│ ⚠️ 2 alertas                 │  ← SmartAlerts (mantém)
│  🔴 Estoque zerado: Omep.   │
│  🟡 Prescrição vence: 12d   │
├──────────────────────────────┤
│ TRATAMENTO              2/3 │  ← MANTÉM accordion
│  ▶ Cardiovascular (3 meds)  │    SwipeRegisterItem intacto
│    → Losartana 08:00 [swipe]│    EV-05: micro-animação ao registrar
│    ✓ Metformina 08:00       │
│    → Losartana 22:00 [swipe]│
│  ▶ Suplementos (1 med)      │
│    ✓ Vitamina D 08:00       │
├──────────────────────────────┤
│ PRÓXIMAS DOSES               │  ← mantém
│  → Omeprazol 22:00   [swipe]│
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │ ESTOQUE RÁPIDO         │   │  ← EV-02: NOVO widget gráfico
│ │ Losart. ████░░░ 4d  🟡│   │    barras horizontais com cores
│ │ Metfor. ████████ 30d 🟢│   │    por nível de criticidade
│ │ Omepra. ░░░░░░░ 0d  🔴│   │    tap → navega para Estoque
│ │ Vit. D  ████████ 90d 🟢│   │    pulse em barras vermelhas
│ └────────────────────────┘   │
├──────────────────────────────┤
│ ÚLTIMAS DOSES                │  ← mantém (colapsável)
│  Losartana · há 3h           │
│  Vitamina D · há 3h          │
├──────────────────────────────┤
│  [+ Registro Manual]         │
│  [👨‍⚕️ Modo Consulta]          │
└──────────────────────────────┘
```

**Mudanças vs. Dashboard atual:**
| Elemento | Antes | Depois |
|----------|-------|--------|
| HealthScore | Card retangular grande | Ring gauge animado (EV-01) |
| Sparkline | Widget separado | Inline dentro do ring gauge card |
| InsightCard | Widget no Dashboard | Move para Perfil > Saúde |
| Accordion + Swipe | ✅ mantém | + micro-animações (EV-05) |
| "Estoque Rápido" | ❌ não existia | NOVO widget com barras (EV-02) |
| Últimas doses | Sempre visível | Colapsável |

### 4.2 TAB "TRATAMENTO" — Fusão Remédios + Protocolos

```
┌──────────────────────────────┐
│ Meu Tratamento     [+ Novo]  │
├──────────────────────────────┤
│ 📁 PLANOS                    │
│  ▶ Cardiovascular            │  ← EXISTENTE: plans accordion
│    Losartana · 2x/dia       │    mantém cards de protocolo
│    Metformina · 2x/dia      │    com edit/delete/pause
│  ▶ Suplementos               │
│    Vitamina D · 1x/dia      │
├──────────────────────────────┤
│ 📋 PROTOCOLOS AVULSOS        │  ← EXISTENTE: standalone protocols
│  Omeprazol · diário 22:00   │
│  [✏️] [⏸️]                    │
├──────────────────────────────┤
│ 💊 SEM PROTOCOLO             │  ← NOVO: meds sem protocolo
│  Dipirona                    │    com CTA "Criar protocolo →"
│  [Criar protocolo →]         │    (resolve P5: dead-end de meds)
├──────────────────────────────┤
│ ⏸️ INATIVOS (2)       [ver]  │  ← colapsado por padrão
└──────────────────────────────┘
```

**Wizard unificado de cadastro** (substitui window.confirm):
```
┌──────────────────────────────┐
│ Novo Tratamento        1/3   │
│ ●○○                         │
├──────────────────────────────┤
│ MEDICAMENTO                  │
│                              │
│ Nome: [Losartana           ] │
│ Tipo: [Comprimido        ▼] │
│ Dosagem: [50] [mg        ▼] │
│                              │
│        [Próximo →]           │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Novo Tratamento        2/3   │
│ ●●○                         │
├──────────────────────────────┤
│ COMO TOMAR                   │
│                              │
│ Frequência: [Diário      ▼] │
│ Horários: [08:00] [22:00]   │
│ Dose: [1] comprimido(s)     │
│ Início: [27/02/2026]        │
│                              │
│  [← Voltar] [Próximo →]     │
│             [Pular]          │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Novo Tratamento        3/3   │
│ ●●●                         │
├──────────────────────────────┤
│ ESTOQUE ATUAL                │
│                              │
│ Quantidade: [60] comprimidos │
│ Compra: [27/02/2026]        │
│ Preço unitário: [R$ 0,75]   │
│ Validade: [     ] (opcional) │
│                              │
│  [← Voltar] [Concluir]      │
│             [Pular]          │
└──────────────────────────────┘

┌──────────────────────────────┐
│ ✅ Pronto!                    │
│                              │
│ Losartana cadastrada com     │
│ protocolo diário (08:00,     │
│ 22:00) e 60 comprimidos      │
│ em estoque.                  │
│                              │
│ [Ir para Hoje]               │
│ [Cadastrar outro]            │
└──────────────────────────────┘
```

### 4.3 TAB "ESTOQUE" — Evolução Visual

```
┌──────────────────────────────┐
│ Meu Estoque          [+ Add] │
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │ VISÃO GERAL            │   │  ← EV-02: barras de estoque
│ │                        │   │
│ │  Losart. ████░░░  4d 🟡│   │  ← barra dupla:
│ │  Metfor. ████████ 30d🟢│   │    escuro = atual
│ │  Omepra. ░░░░░░░  0d 🔴│   │    claro = projeção consumo
│ │  Vit. D  █████████90d🔵│   │    pulse no vermelho
│ │                        │   │
│ └────────────────────────┘   │
├──────────────────────────────┤
│ 📋 PRESCRIÇÕES (F5.9)        │  ← EV-07: timeline visual
│ ┌────────────────────────┐   │
│ │ Losart. ████████░░ 22d │   │  ← barra: início→hoje→fim
│ │ Omepra. ██████████ 12d │   │    verde>30d, amarelo≤30d,
│ │ Metfor. ─── contínuo ──│   │    vermelho=vencida
│ └────────────────────────┘   │
├──────────────────────────────┤
│ ❌ SEM ESTOQUE               │  ← EXISTENTE (mantém cards)
│  Omeprazol · 0 comprimidos  │
│  [+ Adicionar]               │
├──────────────────────────────┤
│ ⚠️ ACABA EM BREVE            │  ← EXISTENTE
│  Losartana · 8 cp (4 dias)  │
├──────────────────────────────┤
│ ✅ ESTOQUE OK                │  ← EXISTENTE
│  Metformina · 60 cp (30d)   │
│  Vitamina D · 90 cp (90d)   │
├──────────────────────────────┤
│ 💰 CUSTO MENSAL (F5.10)      │  ← EV-06: mini-chart de custo
│ ┌────────────────────────┐   │
│ │ Total: R$187/mês       │   │
│ │                        │   │
│ │ Losart.  ████████ R$45 │   │  ← barras horizontais
│ │ Metfor.  ██████   R$32 │   │    de distribuição
│ │ Omepra.  ████████ R$48 │   │
│ │ Vit. D   ████     R$22 │   │
│ │ Outros   ██████   R$40 │   │
│ │                        │   │
│ │ Projeção 3m:     R$561 │   │
│ └────────────────────────┘   │
└──────────────────────────────┘
```

### 4.4 TAB "PERFIL" — Evolução do Settings

```
┌──────────────────────────────┐
│ 👤 André                     │
│ andre@email.com              │
├──────────────────────────────┤
│ SAÚDE & HISTÓRICO            │
│ 📊 Minha Saúde →            │  ← sub-view com calendário,
│                              │    timeline, sparkline, insights,
│                              │    interações, custos detalhados
│ 🆘 Cartão de Emergência →   │  ← F5.8 (ganha destaque)
│ 👨‍⚕️ Modo Consulta →           │  ← F5.7 (ganha destaque)
├──────────────────────────────┤
│ RELATÓRIOS & DADOS           │
│ 📊 Relatório PDF →          │  ← F5.1
│ 📤 Exportar Dados →         │  ← F5.2
│ 🔗 Compartilhar →           │  ← F5.3
├──────────────────────────────┤
│ CONFIGURAÇÕES                │
│ 🤖 Telegram [Conectado ✅]   │
│ 🎨 Tema (claro/escuro)      │
│ 🔒 Alterar Senha            │
│ 🛠️ Admin DLQ                │
├──────────────────────────────┤
│ [Sair da Conta]              │
└──────────────────────────────┘
```

**"Minha Saúde"** (sub-view de Perfil — evolução do History):
```
┌──────────────────────────────┐
│ ← Minha Saúde               │
├──────────────────────────────┤
│ ADESÃO 30D       85% (+3%)  │
│ ▓▓▓▓▓▓▓▓░░                  │
│ 🔥 12d streak · Melhor: 28d │
├──────────────────────────────┤
│ ← Fev 2026 →                │
│ D  S  T  Q  Q  S  S         │  ← EV-03: heat map de adesão
│        🟢 🟢 🟡 🟢          │    (evolução do calendar existente)
│ 🟢 🟢 🔴 🟢 🟢 🟡 🟢        │    click → detalhe por protocolo
│ 🟢 ●  ·  ·  ·  ·  ·        │
├──────────────────────────────┤
│ SPARKLINE 30D                │  ← EV-04: sparkline ampliada
│ ▁▂▃▅▇▅▇█▅▇▅▃▅▇▅▇█▅▇▅▁▃▅▇  │    com tooltip on tap
│ 28/01─────────────────27/02  │
├──────────────────────────────┤
│ INSIGHTS                     │
│ 💡 Quartas: -15% vs média   │
│ 💡 Horário noturno: +8%     │
├──────────────────────────────┤
│ ⚠️ INTERAÇÕES (F5.6)        │
│ Losartana × AINEs: moderada │
│ [Ver detalhes →]             │
├──────────────────────────────┤
│ 💰 CUSTO DETALHADO (F5.10)  │
│ R$187/mês · Projeção: R$561 │
│ [Ver breakdown →]            │
├──────────────────────────────┤
│ TIMELINE DE DOSES            │  ← EXISTENTE: do History
│ 27/02 ─── 3 doses           │    edit/delete mantidos
│  Losartana 08:00 ✓ [✏️][🗑️] │
│  Metformina 08:00 ✓         │
│  Losartana 22:00 ✓          │
│ 26/02 ─── 2 doses           │
│ [ver mais...]                │
├──────────────────────────────┤
│ STATS DO MÊS                │  ← EXISTENTE: do History
│ 📊 68 doses · 24 dias · 136cp│
├──────────────────────────────┤
│ [✅ Registrar Dose]           │
└──────────────────────────────┘
```

---

## 5. Catálogo de Evoluções Visuais (Design System)

### EV-01: Ring Gauge de Health Score
- **Onde:** Hoje (Dashboard)
- **Substitui:** HealthScoreCard retangular
- **Técnica:** SVG `<circle>` com `stroke-dasharray` + Framer Motion `animate={{ pathLength }}`
- **Cor:** Gradiente por score (vermelho <50 → amarelo 50-69 → verde 70-84 → azul 85+)
- **Dados internos:** Score %, streak count, trend arrow
- **Interação:** Click → expande detalhe com DailyDoseModal
- **Animação:** Spring on mount (`{ type: "spring", stiffness: 60 }`)

### EV-02: Barras de Estoque com Projeção
- **Onde:** Hoje ("Estoque Rápido") + Estoque ("Visão Geral")
- **Substitui:** Nada (é adição)
- **Técnica:** `<div>` com `width: ${percent}%` + 2 tons via `opacity`
  - Tom escuro (opacity 1.0) = estoque atual
  - Tom claro (opacity 0.3) = projeção de consumo (quando zera)
- **Escala:** Normalizado em 30 dias (30d = 100%)
- **Cores:** `--color-critical` (<7d), `--color-warning` (7-14d), `--color-success` (14-30d), `--color-info` (>30d)
- **Interação:** Tap → navega para Estoque com medicamento focado
- **Animação:** Stagger entrance (Framer Motion `staggerChildren: 0.05`)
- **Extra:** Pulse CSS animation em barras vermelhas (`@keyframes pulse { 50% { opacity: 0.7 } }`)

### EV-03: Calendário com Heat Map de Adesão
- **Onde:** Perfil > Minha Saúde (evolução do Calendar existente)
- **Substitui:** Calendar com dots simples
- **Técnica:** Background-color dos dias baseado em adesão%
  - 🟢 100% completo
  - 🟡 1-99% parcial
  - 🔴 0% perdido (tinha doses esperadas)
  - ⚪ sem doses esperadas
  - Cinza: futuro
- **Dados:** `doseCalendarService.calculateMonthlyDoseMap()`
- **Interação:** Click no dia → painel inferior com status por protocolo
- **Animação:** Fade-in dos dias com stagger

### EV-04: Sparkline Interativa
- **Onde:** Hoje (inline no ring gauge card) + Saúde (sparkline 30d ampliada)
- **Evolui:** SparklineAdesao existente
- **Técnica:** SVG `<polyline>` com gradient fill
- **Interação:** Tap num ponto → tooltip com data + % adesão + doses tomadas/esperadas
- **Variante Hoje:** Compacta (7 dias, sem tooltip)
- **Variante Saúde:** Ampliada (30 dias, com tooltip, com eixo X de datas)

### EV-05: Micro-animações de Dose
- **Onde:** Hoje (SwipeRegisterItem, HealthScore)
- **O que adiciona:** Feedback visual ao registrar dose

| Momento | Animação | Técnica |
|---------|----------|---------|
| Swipe confirmado | Check mark com bounce | Framer Motion `scale: [0, 1.2, 1]` |
| Counter atualiza | Number flip | Framer Motion `AnimatePresence` + slide up |
| Ring gauge atualiza | Score sobe com spring | Framer Motion `animate={{ pathLength }}` |
| 100% do dia | Confetti (já existe) | Mantém |
| Milestone streak | Badge pulsante | `scale: [1, 1.15, 1]` loop 3x |

### EV-06: Custo como Mini-Chart
- **Onde:** Estoque (seção "Custo Mensal")
- **Técnica:** Barras horizontais com label e valor
- **Dados:** `unit_price × daily_intake × 30` por medicamento
- **Interação:** Tap → expande com projeção 3/6/12 meses e histórico de compras
- **Estado vazio:** "Adicione preços no estoque para ver custos" com CTA

### EV-07: Prescrições como Timeline Visual
- **Onde:** Estoque (seção "Prescrições")
- **Técnica:** Barra horizontal representando `start_date → end_date`
  - Posição do "hoje" marcada com linha vertical
  - Segmento antes de hoje = preenchido
  - Segmento depois de hoje = outline/claro
- **Cores:** Verde (>30d restantes), Amarelo (≤30d), Vermelho (vencida)
- **Caso especial:** `end_date: null` = barra infinita com label "contínuo"
- **Interação:** Tap → navega para protocolo

### EV-08: Pulse em Itens Críticos
- **Onde:** SmartAlerts, Estoque (itens sem estoque), Prescrições (vencidas)
- **Técnica:** `@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.7 } }` 2s infinite
- **Alternativa:** Framer Motion `scale: [1, 1.02, 1]` com `repeat: Infinity`
- **Objetivo:** Chamar atenção sem ser invasivo

---

## 6. Mapa de Conexões Entre Telas

```
           HOJE ←─────────── PERFIL
            │                   │
      [swipe dose]         [minha saúde →]
      [modo consulta]      [emergency]
      [estoque rápido→]    [tratamento →]
      [alertas→]           [relatórios]
            │                   │
            ├── TRATAMENTO ─────┤
            │  [wizard]         │
            │  [edit prot.]     │
            │                   │
            └── ESTOQUE ────────┘
               [prescrições]
               [custo]
               [add estoque]
```

**Fluxos cross-tela:**
- Hoje > "Estoque Rápido" tap na barra 🔴 → Estoque (scroll para aquele med)
- Hoje > SmartAlert "Estoque Baixo" → Estoque
- Hoje > SmartAlert "Prescrição" → Tratamento (protocolo específico)
- Hoje > SmartAlert "Dose Atrasada" → LogForm pré-preenchido
- Hoje > Ring Gauge click → DailyDoseModal
- Estoque > "Custo" tap → expande seção com detalhe
- Estoque > Prescrição tap → Tratamento (protocolo)
- Perfil > "Minha Saúde" → sub-view completa
- Perfil > Calendário dia click → detalhe por protocolo
- Tratamento > "+Novo" → Wizard 3 passos
- Tratamento > "Sem protocolo" CTA → Wizard step 2

---

## 7. Features da Fase 5 — Onde Moram

| Feature | Tela | Tipo de evolução |
|---------|------|-----------------|
| F5.4 Calendário Visual | **Saúde** (ex-History) | EV-03: heat map no calendar existente |
| F5.8 Emergency Card | **Perfil** | Destaque visual (sai do fundo de Settings) |
| F5.9 Prescrições | **Estoque** | EV-07: timeline visual como nova seção |
| F5.2 Export CSV/JSON | **Perfil** | Seção "Relatórios & Dados" |
| F5.1 PDF Reports | **Perfil** | Seção "Relatórios & Dados" |
| F5.3 Compartilhar | **Perfil** + Consulta | Integrado ao fluxo PDF/Consulta |
| F5.7 Modo Consulta | **Perfil** + FAB Hoje | Destaque em Perfil, mantém FAB |
| F5.5 Bot Proativo | Background | Sem mudança visual |
| F5.10 Custos | **Estoque** + **Saúde** | EV-06: mini-chart em ambas |
| F5.6 Interações | **Saúde** + Wizard | Alertas severity-coded em Saúde |

**Evoluções visuais (não features, mas design):**
| Evolução | Tela | Impacto |
|----------|------|---------|
| EV-01 Ring Gauge | Hoje | Substitui HealthScoreCard |
| EV-02 Barras Estoque | Hoje + Estoque | Widget gráfico de criticidade |
| EV-04 Sparkline interativa | Hoje + Saúde | Tooltip + dados comparativos |
| EV-05 Micro-animações | Hoje | Check, counter flip, streak badge |
| EV-08 Pulse | Hoje + Estoque | Atenção em itens críticos |

---

## 8. Métricas de Sucesso

| Métrica | Antes | Depois esperado |
|---------|-------|----------------|
| Scroll para registrar primeira dose | ~3 telas | ≤1 tela |
| Tempo para identificar estoque crítico | Navegar para Estoque | Visível no Dashboard |
| Ação após alerta de prescrição | Nenhuma (Settings) | Navega para Tratamento |
| Motivação visual ao registrar dose | Confetti em 100% apenas | Check + counter + streak + confetti |
| Entendimento de adesão mensal | Número (85%) | Ring gauge + sparkline + heat map |

---

## 9. Próximos Passos

1. Validar com o usuário: essa visão atende ao que imaginava?
2. Se sim: traduzir em spec de execução com tarefas atômicas
3. Priorizar: quais evoluções visuais implementar primeiro?
4. Decisão pendente: order de implementação (EV primeiro, ou Features primeiro?)

---

*Documento em evolução — última atualização: 27/02/2026*
