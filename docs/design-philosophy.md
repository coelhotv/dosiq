# Design Philosophy — Linguagem Dicotômica

**Estabelecido:** 2026-03-26 (Waves 7.5–8 — Sessão de refinamento ProtocolRow + StockCard)
**Documentação canônica:** `plans/PRODUCT_STRATEGY_CONSOLIDATED.md` + `plans/DESIGN-SYSTEM.md` (Seções 0 e 5a)

---

## A Dicotomia Central

O produto serve duas personas com **intenções fundamentalmente diferentes**. O design system deve suportar ambas sem compromisso — não como variações de densidade, mas como **linguagens visuais distintas**.

### Dona Maria — "Card Deck" (modo `simple`)

- **Metáfora visual:** Pinterest / deck de cartas curado
- **Intenção:** Ação imediata. Cada card = uma decisão.
- **O que ela precisa:** Hierarquia de prioridade, não densidade de dados. Dados traduzidos em linguagem humana antes de chegarem à tela.
- **Princípio:** "Dona Maria não quer menos dados — ela quer os **dados certos** com a **hierarquia certa**."
- **Elementos visuais:**
  - Cards individuais (flex-column ou grid 2-col no desktop)
  - CTA como elemento visual dominante
  - Textos humanos em vez de métricas: "Tratamento em dia" em vez de "93%"
  - `StockPill` com ícones semânticos em vez de badges técnicos
  - Sem seções de histórico global — contexto relevante está per-card
  - Scroll vertical; sem comparação horizontal

### Carlos — "Control Panel" (modo `complex`)

- **Metáfora visual:** Dashboard clínico / planilha analítica
- **Intenção:** Gestão. Comparação entre protocolos.
- **O que ele precisa:** Precisão numérica e densidade comparável.
- **Princípio:** Dados brutos com contexto suficiente para decisões clínicas autônomas.
- **Elementos visuais:**
  - Layouts tabulares para comparação horizontal (múltiplos protocolos)
  - Grids responsivos (2-col tablet → 3-col desktop)
  - `AdherenceBar7d` com % numérico
  - `EntradaHistorico` completo com custos
  - Bar-pct% visível
  - Quantidade de unidades visível

---

## Regra da Bifurcação (`isComplex`)

```javascript
// Único ponto de decisão — sem modo "moderate"
const isComplex = mode !== 'simple'
```

**Por que não existe `moderate`:** Um terceiro modo artificial cria uma terceira persona inexistente. Carlos em 4 medicamentos não é diferente de Carlos em 8. O CSS gerencia a densidade visual por contagem (grid-2 → grid-3) sem precisar de prop de modo.

---

## Mapeamento por Tela

### Treatments (TreatmentsRedesign / TreatmentsSimple + TreatmentsComplex)

| Elemento | Dona Maria | Carlos |
|----------|-----------|--------|
| Layout | Cards em 2-col desktop (`align-items: start`) | Tabela multi-col |
| Aderência | `AdherenceLabel` — tag de linguagem ("Tratamento em dia") | `AdherenceBar7d` — barra + % |
| Estoque | `StockPill` — ícone semântico + dias | `StockPill` — idem (universal) |
| Dosagem | Badge ao lado do nome | Badge ao lado do nome (idem) |

### Dashboard (DashboardRedesign)

| Elemento | Ambas as personas |
|----------|-----------------|
| `PriorityDoseCard` | **Universal** — urgência não tem persona. Exibe até 3 medicamentos; overflow "+ N medicamentos"; CTA registra TODOS os da faixa horária (não só os visíveis) |
| `RingGaugeRedesign` | Universal |
| `CronogramaPeriodo` | `variant={isComplex ? 'complex' : 'simple'}` |
| `StockAlertInline` | Complex: topo da página. Simple: rodapé |

### Stock (StockRedesign — Wave 8)

| Elemento | Dona Maria | Carlos |
|----------|-----------|--------|
| Layout | Seções por urgência, 2-col desktop | Grid único por urgência, responsivo |
| Ícone de status | `StockPill` (reutilizado) | `StockPill` (reutilizado) |
| Bar-pct % | Oculto | Visível |
| Quantidade de unidades | Oculta | Visível |
| CTA | Apenas para urgente/atencao | Todos os status |
| Label atencao CTA | "Comprar em Breve" | "Reabastecer" |
| Histórico | "última compra: DD/MM · R$ X,XX" per-card | `EntradaHistorico` completo |

---

## Componentes Universais (Iguais Para Ambas)

Esses componentes têm **aparência idêntica** independente de persona — a semântica de urgência é universal:

- **`PriorityDoseCard`** — urgência de dose não tem persona
- **`StockPill`** — comunicação temporal de estoque via ícones semânticos (CalendarArrowUp/CalendarCheck2/CalendarSync/CalendarX2)
- **`CriticalAlertBanner`** — alerta crítico de estoque
- **`RingGaugeRedesign`** — aderência global

---

## StockPill — Referência de Ícones (W7.6)

| Status | Dias | Ícone Lucide | Cor |
|--------|------|-------------|-----|
| `alto` | 30+ | `CalendarArrowUp` | Azul |
| `normal` | 14–29 | `CalendarCheck2` | Verde |
| `low` | 7–13 | `CalendarSync` | Âmbar |
| `critical` | <7 | `CalendarX2` | Vermelho |

Fonte: `src/features/protocols/components/redesign/StockPill.jsx`
**REUTILIZAR** em qualquer tela que precise de status de estoque — não criar badge system novo.

---

## AdherenceLabel — Thresholds (W7.6)

| Threshold | Texto | Classe |
|-----------|-------|--------|
| >90% | "Tratamento em dia" | `adherence-label--good` |
| 70–90% | "Algumas doses perdidas" | `adherence-label--neutral` |
| 50–70% | "Tratamento em risco" | `adherence-label--warning` |
| <50% | "Muitas doses perdidas" | `adherence-label--critical` |
| 0% / sem histórico | — não renderiza — | — |

Fonte: `src/features/protocols/components/redesign/AdherenceLabel.jsx`

---

## Regra de Ouro das Personas

> **"Dona Maria não quer menos dados — ela quer os dados certos com a hierarquia certa."**

Ao projetar para modo `simple`:
1. ❓ Esse dado informa uma **ação** ou apenas contextualiza?
2. ❓ Existe uma **tradução em linguagem humana** mais direta?
3. ❓ O CTA está sendo o **elemento visual dominante**?
4. ❓ Estamos introduzindo **comparação horizontal** sem necessidade?
5. ❓ Esse dado já está disponível em outro lugar do card (redundância)?
