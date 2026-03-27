# Visão: Refactor de Estoque e Compras de Medicamentos

**Tipo:** Documento de Visão / Pré-PRD
**Data:** 2026-03-27
**Autor:** Sessão colaborativa produto + engenharia
**Status:** RASCUNHO — para validação antes de spec de execução

---

## 1. O Problema Raiz

O modelo atual usa uma única tabela `stock` para dois propósitos conceitualmente distintos:

| Conceito | O que é | O que o sistema faz |
|----------|---------|---------------------|
| **Compra** | Evento imutável: "em 15/03, comprei 30 comprimidos de Losartana por R$ 18,90 na Droga Raia" | Mutável: o campo `quantity` é decrementado pelo FIFO ao longo do tempo |
| **Inventário** | Estado atual: "tenho 7 comprimidos disponíveis agora" | Misturado com o registro de compra na mesma linha |

O resultado é que depois que o FIFO consome doses, você nunca mais consegue responder à pergunta: **"quantos eu comprei nessa vez?"**

### Evidências concretas do problema

**1. FIFO destrói o registro histórico**
`stockService.decrease()` faz `UPDATE stock SET quantity = newQuantity WHERE id = entry.id`. O campo `quantity` original (ex: 30 comprimidos comprados) é sobrescrito. Quando o lote zera, o que resta na tabela é apenas um registro com `quantity = 0` — sem memória do valor original.

**2. Ajustes automáticos viram "compras"**
`stockService.increase()` — chamado ao deletar um log de dose — cria uma linha real na tabela `stock` com `unit_price: 0` e `notes: "Dose excluída (ID: X)"`. Essa linha tem exatamente a mesma estrutura de uma compra real. Para distingui-las, o sistema usa uma verificação por prefixo de string nos `notes` — um hack frágil que já foi documentado como armadilha (PR #402, W12).

**3. Preço médio ponderado fica distorcido**
`costAnalysisService.calculateAvgUnitPrice()` calcula `SUM(unit_price × quantity) / SUM(quantity)` usando as quantidades **atuais** (pós-FIFO). Um lote mais caro que foi mais consumido tem seu peso subestimado no cálculo — o custo médio real do tratamento não é preciso.

**4. Laboratório atrelado ao medicamento, não à compra**
`medicines.laboratory` é capturado no cadastro e nunca muda. No Brasil, onde genéricos dominam (~70% do mercado), o paciente compra Dapagliflozina 10mg a cada mês e o fabricante pode ser EMS, Eurofarma, Medley ou Torrent dependendo do preço daquele mês na farmácia. Essa informação se perde hoje.

**5. Nenhum dado de origem da compra**
Não há campo para onde o paciente comprou (SUS, Droga Raia, Ultrafarma, Farmácia do Bairro). Isso impede qualquer inteligência de preço por canal.

---

## 2. O Que o Modelo Correto Parece

### Princípio central
> **Compras são eventos imutáveis. Inventário é estado corrente. Os dois nunca devem morar na mesma linha.**

### Novo modelo de dados (duas tabelas)

#### Tabela `purchases` — nova, append-only, imutável

```sql
CREATE TABLE purchases (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  medicine_id     uuid NOT NULL REFERENCES medicines(id),

  quantity_bought integer NOT NULL CHECK (quantity_bought > 0),  -- imutável
  unit_price      decimal(10, 2) NOT NULL DEFAULT 0,             -- imutável

  purchase_date   date NOT NULL,
  expiration_date date,

  -- Novos campos de contexto da compra
  pharmacy        text,        -- ex: "Droga Raia", "SUS", "Ultrafarma", "Amazon Farmácia"
  laboratory      text,        -- ex: "EMS", "Eurofarma", "Medley" — para genéricos
  notes           text,

  created_at      timestamptz DEFAULT now()
);
```

> `quantity_bought` é imutável. Representa o que foi comprado naquela ocasião. Nunca é alterado.

#### Tabela `stock` — refatorada, rastreia inventário corrente

```sql
-- Evolução da tabela existente (não ruptura total)
ALTER TABLE stock ADD COLUMN purchase_id        uuid REFERENCES purchases(id);
ALTER TABLE stock ADD COLUMN original_quantity  integer;  -- cópia de quantity no momento da compra
ALTER TABLE stock ADD COLUMN entry_type         text DEFAULT 'purchase';
-- 'purchase'    → veio de uma compra real (tem purchase_id)
-- 'adjustment'  → ajuste de sistema (dose excluída, correção manual)

-- quantity: continua sendo a quantidade disponível (decrementada pelo FIFO)
-- notes: mantido para compatibilidade, mas 'entry_type' é a forma canônica
```

#### Tabela `stock_adjustments` — nova, para rastreio de movimentações

```sql
CREATE TABLE stock_adjustments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL,
  medicine_id   uuid NOT NULL,
  stock_id      uuid REFERENCES stock(id),  -- qual lote foi afetado (FIFO)

  quantity_delta  integer NOT NULL,    -- positivo = entrada, negativo = saída
  reason          text NOT NULL,       -- 'dose_registrada' | 'dose_excluida' | 'ajuste_manual' | 'vencimento'
  reference_id    uuid,                -- FK para medicine_logs se aplicável

  created_at    timestamptz DEFAULT now()
);
```

> Esta tabela substitui os ajustes mágicos de `stockService.increase()`. Em vez de criar uma linha falsa de "compra", cria um evento de ajuste com semântica clara.

### Relações

```
medicines (1) ──────< purchases (N)
    └── laboratory (padrão, para referência)    └── laboratory (real, por compra)
                                                └── pharmacy (onde comprou)
                                                └── quantity_bought (imutável)

purchases (1) ──────< stock (N)    ← "lotes" do inventário
    └── via purchase_id            └── original_quantity (cópia de quantity_bought/lote)
                                   └── quantity (mutable, decrementado pelo FIFO)
                                   └── entry_type: 'purchase' | 'adjustment'

stock (1) ──────< stock_adjustments (N)    ← movimentações do lote
```

---

## 3. O Que Isso Habilita

### 3.1 Histórico real de compras (imediato)

Com `purchases`, a pergunta "quanto paguei pela última caixa de Losartana?" tem uma resposta exata — não uma estimativa baseada no que sobrou do lote.

- **Timeline de preço por medicamento**: "Losartana 50mg: Jan R$ 14,90 | Mar R$ 18,50 | Jun R$ 16,00"
- **Evolução de custo do tratamento**: gráfico mensal real, não estimado
- **Custo médio ponderado correto**: `SUM(quantity_bought × unit_price) / SUM(quantity_bought)` — usando a quantidade original, não a atual

### 3.2 Inteligência de genéricos e laboratório

Com `purchases.laboratory`:

- "Nos últimos 6 meses, você comprou Dapagliflozina 10mg de 3 laboratórios diferentes"
- "EMS: 3x, preço médio R$ 89. Eurofarma: 2x, preço médio R$ 94. Medley: 1x, R$ 78"
- Base para recomendação: "Da próxima vez, considere buscar Medley — foi o mais barato"

### 3.3 Inteligência de canal de compra

Com `purchases.pharmacy`:

- "Você comprou 70% dos seus medicamentos no SUS — dependência alta"
- "Na Droga Raia você pagou em média 12% a mais que na Ultrafarma para o mesmo item"
- Base para alertas de promoção: notificar quando preço na farmácia X estiver abaixo do seu histórico

### 3.4 Declaração de IR e controle de gastos

No Brasil, gastos com saúde (incluindo medicamentos) são dedutíveis do IRPF. Com histórico real:

- Relatório anual de gastos por medicamento, exportável como PDF
- Total gasto por período com tratamento
- Discriminação por farmácia para reembolso de plano de saúde

### 3.5 Base para robôs de preço (produto futuro)

Com estrutura de compras + farmácia + laboratório, a plataforma pode evoluir para:

- Monitoramento de preço em farmácias parceiras (Consulta Remédios API, Droga Raia parceria)
- Notificação proativa: "Losartana 50mg está R$ 5 mais barata que sua última compra na Ultrafarma"
- Compra direta via afiliado (modelo de receita: comissão por venda gerada)

---

## 4. Modelos de Negócio Habilitados

| Modelo | Pré-requisito | Potencial |
|--------|--------------|-----------|
| **Afiliado de farmácias** | `purchases.pharmacy` + integração de preço em tempo real | Alto — paciente crônico compra todo mês, ticket médio R$ 100-500 |
| **Relatório IR premium** | Histórico de compras limpo por período | Médio — freemium: 1 ano grátis, exportação histórica paga |
| **Alertas de promoção** | Preço histórico + push notification já implementada | Alto — opt-in simples, entrega valor claro |
| **Programa de fidelidade SUS** | `pharmacy = "SUS"` + geolocalização | Médio — parceria institucional |
| **Análise de custo para médicos** | Dados agregados anonimizados | Longo prazo — B2B |

---

## 5. Estratégia de Migração

O risco mais crítico é a migração de dados existentes sem quebrar a view atual de estoque (`Stock.jsx` e `StockRedesign.jsx`). A proposta é evolutiva, não disruptiva:

### Fase 1 — Preparar o terreno (sem impacto no usuário)
1. Criar tabela `purchases` no Supabase (nova, vazia)
2. Adicionar colunas `purchase_id`, `original_quantity`, `entry_type` na tabela `stock` existente (nullable — compatibilidade total)
3. Criar tabela `stock_adjustments` (nova, vazia)
4. Criar migration SQL para backfill: entradas de `stock` com `quantity > 0` e sem prefixos de sistema → criar registros correspondentes em `purchases`, popular `purchase_id` e `original_quantity`

### Fase 2 — Novo fluxo de entrada (StockForm)
1. `stockService.add()` passa a criar registro em `purchases` E entrada em `stock` com `entry_type: 'purchase'`
2. `stockService.increase()` passa a criar `stock_adjustments` em vez de linha falsa em `stock`
3. UI do `StockForm` recebe campos opcionais: farmácia, laboratório (pre-populados com último valor para facilitar)
4. Schemas Zod atualizados

### Fase 3 — Consumir o histórico na UI
1. `useStockData` passa a buscar `purchases` para histórico (em vez de filtrar `stock`)
2. `EntradaHistorico` exibe dados limpos sem necessidade de filtros de prefixo
3. `costAnalysisService` usa `purchases.quantity_bought` para cálculo correto
4. Cards de estoque exibem `purchases` mais recente como "última compra"

### Fase 4 — Features novas (produto)
1. Timeline de preço por medicamento
2. Relatório de gastos por período
3. Comparação por farmácia e laboratório

---

## 6. O Que NÃO Muda

- **FIFO**: continua como mecanismo de descarte de estoque — mas agora opera em `stock.quantity` sem afetar `purchases`
- **Cálculo de dias restantes**: mesma lógica, baseada em `SUM(stock.quantity)` por medicamento
- **`refillPredictionService`**: não precisa mudar — usa `currentStock` e `logs`, não a estrutura de compras
- **Protocolo de doses**: completamente independente desta mudança
- **RLS**: mantém política `user_id = auth.uid()` em todas as tabelas

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Backfill de dados históricos incompleto | Média | Alto | Migration idempotente + validação por contagem antes/depois |
| Quebra do cálculo de custo médio | Baixa | Médio | `original_quantity` na tabela `stock` como fallback se `purchases` vazio |
| Usuários sem dados históricos (cadastros novos) | — | Baixo | Sistema funciona sem `purchases` — `entry_type` como discriminador |
| Campos farmácia/laboratório ignorados pelos usuários | Alta | Baixo | Campos opcionais, pre-populados com último valor, nunca obrigatórios |
| Duplicidade transitória durante migração | Média | Médio | Fase 1 pura de infraestrutura sem código de produto — deploy isolado |

---

## 8. Decisões de Design ✅ ALINHADAS

1. **`StockForm` — campos de contexto da compra** ✅
   Campos opcionais colapsáveis no próprio formulário, visibilidade controlada pelo modo de complexidade:
   - `simple` (Dona Maria): seção "Detalhes da compra" colapsada por padrão, não exibida se usuário nunca interagiu
   - `complex` (Carlos): seção visível e expansível por padrão
   Nunca obrigatórios — sempre opcionais.

2. **`categoria_regulatoria` da ANVISA como sinal de contexto** ✅
   O CSV ANVISA (`public/medicamentos-ativos-anvisa.csv`) contém a coluna `CATEGORIA_REGULATORIA` com os valores relevantes: `Genérico`, `Similar`, `Novo` (e `Biológico`, `Específico`, `Fitoterápico` para casos secundários). A distribuição atual: ~3.969 genéricos, ~3.459 similares, ~1.226 novos.

   Regra de negócio derivada:
   | Categoria | Lab no cadastro do med | Lab por compra |
   |-----------|----------------------|----------------|
   | **Genérico** | Não se aplica (múltiplos fabricantes) | ★ Solicitar — campo visível e incentivado |
   | **Similar** | `medicines.laboratory` (1:1) | Não solicitar — lab do cadastro é definitivo |
   | **Novo** | `medicines.laboratory` (1:1) | Não solicitar — lab do cadastro é definitivo |
   | Outros | Opcional | Opcional |

   **Evolução necessária no cadastro de medicamentos**: ao enriquecer o JSON extraído da ANVISA, incluir `categoria_regulatoria` no objeto de medicamento. O campo `medicines.is_generic` (ou `regulatory_category`) guia o comportamento do `StockForm`. Dapagliflozina, por exemplo, aparece com 5 laboratórios diferentes no CSV — claramente genérico.

3. **Retroativo — pharmacy e laboratory** ✅
   - `pharmacy`: **Não** — dado nunca existiu, iniciar coleta prospectivamente
   - `laboratory` para Novo/Similar: **Não** — `EMPRESA_DETENTORA_REGISTRO` existe no CSV da ANVISA, mas não foi extraída para o JSON atual e não está no DB. Incluir na próxima atualização do JSON, não como backfill de compras históricas.

4. **Granularidade do `stock_adjustments`** ✅
   Apenas ajustes manuais/de sistema — funciona como **trilha de auditoria** de intervenções não-automáticas no estoque.
   - ✅ Dose excluída pelo usuário → `stock_adjustments`
   - ✅ Correção manual de quantidade → `stock_adjustments`
   - ✅ Descarte por vencimento → `stock_adjustments`
   - ❌ Consumo de dose normal (tomar remédio) → já registrado em `medicine_logs` + decrementado via FIFO em `stock`
   - ❌ Compra → registrado em `purchases`

5. **Nome da tabela** ✅
   **`purchases`** — inglês, alinhado ao padrão de código do projeto (variáveis, funções, arquivos). As tabelas do banco (`stock`, `medicines`, `protocols`) são exceções históricas da fase inicial; o padrão canônico do projeto é inglês para código.

---

## 9. Diagrama Resumido do Modelo Proposto

```
┌──────────────────┐          ┌────────────────────┐          ┌──────────────────┐
│    medicines     │          │     purchases      │          │      stock       │
│──────────────────│1        N│────────────────────│1        N│──────────────────│
│ id               │<─────────│ id                 │<─────────│ id               │
│ name             │          │ medicine_id        │          │ medicine_id      │
│ laboratory       │          │ quantity_bought ◄──IMUTÁVEL  │ purchase_id (FK) │
│ (Novo/Similar)   │          │ unit_price         │          │ original_quantity│
│ regulatory_      │          │ purchase_date      │          │ quantity ◄──FIFO │
│ category ★       │          │ laboratory ★★      │          │ entry_type       │
│ (Genérico|       │          │ (Genérico apenas)  │          └──────────────────┘
│  Similar|Novo)   │          │ notes              │                   │ 1
└──────────────────┘          └────────────────────┘                   │
        │                                                               │ N
        │ regulatory_category = 'Genérico'                  ┌──────────────────────┐
        └──────────────────────────────────►                │  stock_adjustments   │
          incentiva laboratory por compra                   │──────────────────────│
                                                            │ stock_id (FK)        │
        │ regulatory_category = 'Similar'|'Novo'            │ quantity_delta       │
        └──────────────────────────────────►                │ reason (enum)        │
          laboratory = medicines.laboratory (1:1)           │   dose_excluida      │
                                                            │   ajuste_manual      │
                                                            │   descarte_vencimento│
                                                            │ reference_id (logs)  │
                                                            └──────────────────────┘

★  campo novo em medicines — enriquecimento do JSON ANVISA (CATEGORIA_REGULATORIA)
★★ campo novo em purchases — apenas solicitado/exibido quando regulatory_category = 'Genérico'
```

---

## 10. Próximos Passos Sugeridos

1. **Validar este documento** — alinhar as perguntas em aberto (seção 8)
2. **Spec de execução (EXEC_SPEC)** — detalhar as 4 fases com sprints, contratos de API e casos de teste
3. **Spike de migração** — validar o SQL de backfill em ambiente de desenvolvimento antes de planejar o rollout

---

*Este documento captura o estado do raciocínio em 2026-03-27. Deve ser revisado antes de qualquer sprint de implementação.*
