# Wave 8 — Stock Redesign: Final Refinements & Visionary Planning

**Timeline:** 2026-03-27 (W13 — conclusão)
**Status:** ✅ DELIVERED (layout + behavior + vision document)
**Branch:** feature/redesign/wave-8-stock (final refinements)
**Previous PRs:** #402 (PR 402), ongoing from earlier sprints

---

## 📋 Delivered (Sprint 8.5+)

### Layout & Behavior Fixes (Final Round)
1. **EntradaHistorico — renderização expandida** ✅
   - Problema: Ao clicar "Ver tudo (70)", entradas não renderizavam apesar de estarem no DOM
   - Causa: `motion.ul` mantinha estado `animate="visible"` anterior — novos itens não disparavam animação
   - Fix: `key={expanded}` força remount da lista, reseta Framer Motion cascade
   - Files: `src/features/stock/components/redesign/EntradaHistorico.jsx`

2. **Filtragem de histórico de compras (PR #402 pattern)** ✅
   - Problema: Histórico "sujo" com ajustes automáticos (`"Dose excluída"`, `"Ajuste de dose"`)
   - Causa: `stockService.increase()` cria linhas reais em `stock` table (não são compras)
   - Fix: Aplicar `SYSTEM_NOTE_PREFIXES` em 2 lugares:
     - `useStockData.js` linha ~100: filtrar `lastPurchase` (já estava em fase anterior)
     - `EntradaHistorico.jsx` linha ~55: filtrar `purchases` antes de ordenar
   - Pattern reutilizado: mesmo `const SYSTEM_PREFIXES` do code original
   - Files: `src/features/stock/hooks/useStockData.js`, `src/features/stock/components/redesign/EntradaHistorico.jsx`

3. **Preço unitário + label "Grátis"** ✅
   - Mudança: Mostrar `R$ X,XX/un.` em vez de custo total do lote
   - Razão: FIFO decrementa `quantity` — custo total seria irreal (quanto restou, não quanto foi comprado)
   - Caso especial: `unitPrice < 0.01` → exibir "Grátis" (medicamentos SUS ou com preço não informado)
   - Files: `src/features/stock/components/redesign/StockCardRedesign.jsx`, `src/features/stock/components/redesign/EntradaHistorico.jsx`

### Visão Estratégica para Refactor (Futuro)

**Documento criado:** `plans/VISION_STOCK_PURCHASES_REFACTOR.md` (2026-03-27)

**Problema identificado:** Tabela `stock` confunde dois conceitos incompatíveis:
- **Compra** (evento imutável: "comprei 30 em 15/03 por R$ 18,90")
- **Inventário** (estado corrente: "tenho 7 comprimidos agora")

FIFO sobrescreve `quantity` original → destroi histórico. Ajustes automáticos viram "compras" falsas (hack de prefixo de string).

**Solução proposta:** Modelo de duas tabelas
1. `purchases` (nova) — append-only, imutável, nunca sofre FIFO
   - `quantity_bought`, `unit_price`, `purchase_date`
   - `pharmacy` (SUS, Droga Raia, etc.)
   - `laboratory` (EMS, Eurofarma, etc. — valor por compra para genéricos)

2. `stock` (refatorada) — estado corrente, ligada a purchases via FK
   - `purchase_id`, `original_quantity` (copy de quantity_bought no momento)
   - `quantity` (mutable, decrementado por FIFO)
   - `entry_type` ('purchase' | 'adjustment')

3. `stock_adjustments` (nova) — trilha de auditoria
   - Substitui hack de `stockService.increase()`
   - `quantity_delta`, `reason` (enum: dose_excluída, ajuste_manual, vencimento)

**Decisões de design alinhadas:**
- `laboratory`: solicitar apenas para genéricos (múltiplos labs por ativo); Similar/Novo usam `medicines.laboratory` (1:1)
- `regulatory_category` (Genérico|Similar|Novo) na tabela medicines — sinal de negócio para UI
- Retroativo: **não** — pharmacy e laboratory coletadas prospectivamente
- `stock_adjustments`: trilha de auditoria apenas de intervenções manuais (não consumo normal)
- Nome da tabela: `purchases` (inglês, alinhado ao padrão de código do projeto)

**Oportunidades de negócio habilitadas:**
- Histórico real de preço por medicamento (evolução de custos)
- Inteligência de genérico: qual lab foi mais barato
- Rastreio por farmácia (SUS vs e-commerce)
- Relatório de gastos anuais (IR, plano de saúde)
- Base para robôs de preço (integração com APIs de farmácia)

---

## 🎯 Padrões Aplicados (Reutilizáveis)

### R-????: Filtragem de entradas de sistema em ledgers de estoque
- **Contexto:** Tabelas de ledger (stock) que misturam compras reais + ajustes automáticos
- **Como:** Constante module-level `SYSTEM_NOTE_PREFIXES` com enumeração de prefixos conhecidos, filtro com `.some(p => entry.notes?.startsWith(p))`
- **Por que:** Reutilizável em qualquer context onde sistema injeta linhas não-reais (dose deleted, correction, etc.)
- **Referência:** PR #402 (W12), aplicado em `useStockData.js` + `EntradaHistorico.jsx`

### R-????: Key prop para forçar remount em Framer Motion cascades
- **Contexto:** Listas animadas com `motion.ul` + `variants.cascade.container`, onde items mudam dinamicamente
- **Como:** `key={stateVariable}` na `motion.ul` (ou wrapper) força React desmontar/remontar, reseta animações
- **Por que:** Framer Motion cascade só anima na primeira renderização — novos items adicionados não disparam animação sem remount
- **Referência:** `EntradaHistorico.jsx` line 65, problema "Ver tudo (70) não renderiza"

---

## 🧠 Lições Aprendidas

1. **FIFO e histórico são incompatíveis:** FIFO é operacional (descarte correto), mas destrui histórico (para análise/auditoria). Precisam de tabelas separadas.

2. **Ajustes de sistema em ledgers:** Usar `notes` com prefixos é frágil. Melhor: coluna `entry_type` enum ou tabela separada de adjustments. Documentado em visão para refactor futuro.

3. **Framer Motion + React keys:** Sempre usar `key` quando lista muda significativamente e você quer reset de animações. Sem `key`, Framer Motion assume elemento mantém identidade.

4. **Preço unitário vs custo total:** Em FIFO onde quantity é decrementada, custo total de "última compra" é valor do que RESTOU (não do que foi comprado). Pode confundir usuário. Clareza com "/un." é crítica.

---

## 📊 Commits Planejados (Semantic)

```
feat(stock): filter system adjustments from purchase history (applies PR #402 pattern)
  - Add SYSTEM_NOTE_PREFIXES filtering in useStockData.js lastPurchase calculation
  - Add SYSTEM_NOTE_PREFIXES filtering in EntradaHistorico.jsx purchases list
  - Removes automatic adjustment entries from historical view

fix(stock): display unit price instead of total lot cost
  - Change formatLastPurchase() to show unit_price/un instead of (unit_price × quantity)
  - Add "Grátis" label for unit_price < 0.01
  - Apply same pattern to EntradaHistorico.jsx formatCost()
  - Rationale: FIFO decrements quantity, making total cost misleading (shows remaining, not purchased)

fix(stock): fix EntradaHistorico rendering on expand
  - Add key={expanded} to motion.ul to force Framer Motion cascade reset
  - Fixes: "Ver tudo (N)" button expanding but items not rendering
  - Issue was: motion.ul remained in "visible" state, new items didn't animate on add

docs(stock): add VISION_STOCK_PURCHASES_REFACTOR.md
  - Strategic vision for separating purchases (immutable, append-only) from stock (mutable, FIFO)
  - Identifies problem: single `stock` table conflates buy event + inventory state
  - Proposes: purchases table + refactored stock + stock_adjustments for audit trail
  - Aligns with future revenue models (price comparison, affiliate pharmacy partnerships)
```

---

## 📁 Arquivos Afetados

| Arquivo | Tipo | Mudanças |
|---------|------|----------|
| `src/features/stock/hooks/useStockData.js` | Modified | + SYSTEM_NOTE_PREFIXES constant, updated lastPurchase filter |
| `src/features/stock/components/redesign/StockCardRedesign.jsx` | Modified | formatLastPurchase logic: unitPrice/un + Grátis label |
| `src/features/stock/components/redesign/StockCardRedesign.css` | Modified | (minor styling refinements) |
| `src/features/stock/components/redesign/EntradaHistorico.jsx` | Modified | + SYSTEM_NOTE_PREFIXES filter on purchases, + key={expanded} on motion.ul, formatCost logic |
| `src/views/redesign/StockRedesign.jsx` | Modified | (no changes this sprint) |
| `src/views/redesign/StockRedesign.css` | Modified | (no changes this sprint) |
| `plans/VISION_STOCK_PURCHASES_REFACTOR.md` | **New** | Strategic document: problem, solution, decisions, business model |

---

## ✅ Validação

- [x] 546 tests passing (npm run test:fast)
- [x] npm run lint — sem erros introduzidos
- [x] Mobile layout validado (responsive, collapsible sections)
- [x] FIFO logic não alterado (apenas filtros de exibição)
- [x] Schema Zod compatível (nenhuma mudança)

---

## 🎬 Próximo Passo

**Wave 8 status:** Completo ✅ — layout, comportamento, rule of business ajustadas

**Sequência recomendada:**
1. Merge esta entrega (Step 6 da skill)
2. Iniciar Wave 9 ou Phase 6 conforme roadmap
3. Visão de stock/purchases refactor fica backlog para futura implementação (oportunidade de negócio, não urgente)

---

*Última atualização: 2026-03-27 | Finalização de W8*
