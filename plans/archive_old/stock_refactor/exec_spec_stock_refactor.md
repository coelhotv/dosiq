# EXEC_SPEC_STOCK_REFACTOR

**Projeto:** Dosiq  
**Tipo:** Especificação de execução detalhada  
**Data:** 2026-04-02  
**Status:** Desenvolvido no PR#443  
**Entrada base:** `plans/VISION_STOCK_PURCHASES_REFACTOR.md`

---

## 1. Objetivo

Refatorar a arquitetura de estoque para separar, de forma definitiva:

- **Compra** = evento histórico, imutável, auditável
- **Inventário** = saldo atual por lote, mutável, consumido por FIFO

Esta execução deve:

- preservar o saldo atual de estoque;
- corrigir o cálculo de histórico e custo médio;
- remover o hack de distinguir ajustes por prefixo em `notes`;
- suportar restauração exata de lotes ao excluir/editar logs;
- incluir **ANVISA** nesta mesma onda;
- incluir **Telegram bot** nesta mesma onda;
- considerar como superfície oficial de produto **somente a experiência redesign** ativada por `?redesign=1`.

### Decisões já tomadas e obrigatórias

1. **Escopo visual:** somente `src/views/redesign/` e componentes associados entram no critério de aceite de produto.
2. **ANVISA:** faz parte obrigatória desta entrega; `regulatory_category` deve ser incorporado ao fluxo.
3. **Telegram:** entra no mesmo ciclo; o bot deve escrever no novo modelo.
4. **Compatibilidade legacy:** pode existir apenas como compatibilidade técnica temporária; não é escopo de UX nem QA principal.

## 1.1 Regras mandatórias para coding agents

1. Não alterar a UX de `src/views/Stock.jsx` nem introduzir feature nova dedicada à view legacy.
2. Não criar novas tabelas além de `purchases`, `stock_adjustments` e `stock_consumptions`.
3. Não criar novos RPCs além de:
   - `create_purchase_with_stock`
   - `consume_stock_fifo`
   - `restore_stock_for_log`
   - `apply_manual_stock_adjustment`
4. Não manter nenhum fluxo que represente ajuste automático como compra real em `stock`.
5. Não usar `notes` como mecanismo canônico de classificação depois da migração.
6. Não implementar ajuste manual negativo nesta entrega.
   - se `p_quantity_delta < 0`, a função deve falhar explicitamente.
7. Não usar `stock.quantity` remanescente para calcular histórico de compra, última compra ou preço médio.
8. Não inventar enums novos fora dos listados nesta spec.
9. Não omitir testes de `logService.create`, `logService.update` e `logService.delete`.

## 1.2 Integração obrigatória com a skill `/deliver-sprint`

Esta spec foi escrita para ser executada por um agente usando a estrutura da skill `/deliver-sprint`.

O agente implementador deve seguir esta spec junto com o workflow da skill, sem reinterpretar a ordem operacional.

### Mapeamento entre esta spec e `/deliver-sprint`

#### Step 0 — Pre-Planning / Setup

Antes de escrever código, o agente deve:

1. ler:
   - `AGENTS.md`
   - `.memory/rules.md`
   - `.memory/anti-patterns.md`
   - último arquivo em `.memory/journal/`
2. criar branch de feature antes de qualquer edição;
3. explorar os arquivos listados na seção **5. Estrutura de arquivos a criar e modificar**;
4. usar a seção **20. Ordem sugerida de execução por agente implementador** como checklist técnico de trabalho.

#### Step 1 — Exploration

O agente deve validar durante a exploração:

- todos os call sites de `stockService.add`, `stockService.decrease`, `stockService.increase`;
- todos os pontos que ainda inferem compra a partir de `stock`;
- todos os flows que usam ANVISA para criação de medicamento;
- todos os pontos de escrita do bot em estoque.

#### Step 2 — Implementation

O agente deve implementar exatamente na ordem definida em:

- **15. Estratégia de implementação em fases**
- **15.1 Ordem obrigatória de execução**
- **20. Ordem sugerida de execução por agente implementador**

#### Step 3 — Validation

O agente deve executar no mínimo os comandos da seção **16.6 Comandos obrigatórios de validação**.

#### Step 4 — Git + Documentation

Antes de push/PR, o agente deve:

1. atualizar `.memory/journal/YYYY-WWW.md` com o que foi entregue;
2. registrar nova regra em `.memory/rules.md` se descobrir um padrão reutilizável;
3. registrar novo anti-pattern em `.memory/anti-patterns.md` se encontrar uma armadilha relevante;
4. atualizar:
   - `docs/architecture/DATABASE.md`
   - `docs/reference/SERVICES.md`

#### Step 5 — Push + Review

Após validação local:

1. criar commits semânticos;
2. abrir PR;
3. aguardar review automatizado;
4. tratar comentários do Gemini/AI reviewer antes de considerar a entrega pronta.

#### Step 6 — Merge

O agente **não deve** se auto-mergear.

Condição de parada correta:

- PR aberta
- comentários do reviewer tratados
- aguardando aprovação explícita do usuário

#### Step 7 — Final Documentation

Após merge humano:

1. atualizar `.memory/journal/YYYY-WWW.md` com resultado final;
2. atualizar qualquer documentação remanescente;
3. encerrar o ciclo de entrega.

---

## 2. Escopo e não escopo

## Em escopo

- banco de dados, RLS, índices, funções RPC e backfill;
- `stockService`, `logService`, novo `purchaseService`, schemas e contratos;
- redesign de estoque:
  - `src/views/redesign/StockRedesign.jsx`
  - `src/views/redesign/StockRedesign.css`
  - `src/features/stock/components/redesign/*`
  - `src/features/stock/components/StockForm.jsx`
  - `src/features/stock/hooks/useStockData.js`
- integração bot Telegram;
- ETL ANVISA e persistência de `regulatory_category`;
- testes unitários e de integração dos fluxos críticos.

## Fora de escopo

- rework visual ou UX de `src/views/Stock.jsx` e CSS legado;
- novos relatórios premium, comparativos de farmácia ou timeline de preços como feature final;
- retropreenchimento histórico de `pharmacy`;
- retropreenchimento confiável de compras antigas já destruídas pelo modelo atual;
- cleanup total do código legado de estoque nesta mesma onda.

---

## 3. Estado atual reconstruído

## 3.1 Banco atual inferido

### Tabela `stock`

Campos existentes confirmados:

- `id`
- `medicine_id`
- `quantity`
- `purchase_date`
- `expiration_date`
- `unit_price`
- `notes`
- `user_id`
- `created_at`

Problema estrutural: a mesma linha representa simultaneamente:

- a compra original;
- o lote atual remanescente;
- ajustes automáticos gerados pelo sistema.

### Tabela `medicines`

Campos relevantes confirmados:

- `id`
- `user_id`
- `name`
- `laboratory`
- `active_ingredient`
- `dosage_per_pill`
- `dosage_unit`
- `type`
- `therapeutic_class`

Limitação: não existe `regulatory_category`.

### Tabela `medicine_logs`

Campos relevantes confirmados:

- `id`
- `protocol_id`
- `medicine_id`
- `taken_at`
- `quantity_taken`
- `notes`
- `user_id`

Limitação: não existe vínculo entre o log e os lotes consumidos.

## 3.2 Código atual

### `src/features/stock/services/stockService.js`

Comportamento atual:

- `add()` faz `insert` direto em `stock`;
- `decrease()` busca lotes em `stock`, ordena por `purchase_date` e decrementa `quantity`;
- `increase()` cria nova linha em `stock` com `unit_price = 0` e `notes` textual.

Problemas:

- sobrescreve o histórico de compra ao consumir;
- usa o banco como se ajuste fosse compra;
- não preserva a origem dos lotes restaurados;
- não é transacional.

### `src/shared/services/api/logService.js`

Comportamento atual:

- cria log;
- depois decrementa estoque;
- em update/delete chama `stockService.increase()`.

Problemas:

- não existe atomicidade real;
- se o decremento falha, pode sobrar log criado sem saldo coerente;
- exclusão/edição não sabe quais lotes foram consumidos originalmente.

### `src/features/stock/hooks/useStockData.js`

Problema:

- calcula "última compra" filtrando `stock.entries`;
- usa prefixos de `notes` para tentar excluir ajustes do sistema.

### `src/features/stock/components/redesign/EntradaHistorico.jsx`

Problema:

- renderiza histórico a partir de `stock`;
- usa filtro por `notes` para separar compra real de ajuste.

### `src/features/stock/services/costAnalysisService.js`

Problema:

- calcula preço médio usando `stock.quantity` remanescente;
- o peso do preço varia conforme o lote foi consumido, o que é conceitualmente errado.

### `src/features/medications/services/medicineService.js`

Problema:

- calcula `avg_price` com base no estoque atual, não nas compras;
- não carrega `regulatory_category`.

### `server/bot/commands/adicionar_estoque.js`

Problema:

- escreve direto em `stock`;
- bypassa completamente a nova semântica de compra.

### `scripts/process-anvisa.js`

Fato confirmado:

- o script já lê `CATEGORIA_REGULATORIA`, mas descarta o campo ao gerar `medicineDatabase.json`.

---

## 4. Arquitetura alvo

## 4.1 Princípios

1. **Compra é append-only.**
2. **Saldo é derivado por lote.**
3. **Consumo de dose precisa registrar os lotes afetados.**
4. **Restauração de dose deve ser exata, não aproximada.**
5. **A UI redesign nunca deve inferir compra a partir de saldo.**

## 4.1.1 Defaults e enums canônicos

Na ausência de valor informado:

- `unit_price = 0`
- `expiration_date = null`
- `pharmacy = null`
- `laboratory = null`
- `notes = null`

### `stock.entry_type`

Valores permitidos:

- `'purchase'`
- `'adjustment'`
- `'legacy_unrecoverable'`

### `stock_adjustments.reason`

Valores permitidos nesta entrega:

- `'dose_excluida'`
- `'ajuste_de_dose'`
- `'ajuste_manual_positivo'`
- `'ajuste_manual_legacy'`
- `'backfill_system_adjustment'`

Não introduzir reasons adicionais nesta onda.

## 4.2 Novo modelo de dados

### `purchases`

Fonte canônica de histórico de compra.

```sql
id uuid primary key
user_id uuid not null
medicine_id uuid not null
quantity_bought numeric not null check (quantity_bought > 0)
unit_price numeric(10,2) not null default 0
purchase_date date not null
expiration_date date null
pharmacy text null
laboratory text null
notes text null
legacy_stock_id uuid unique null
created_at timestamptz not null default now()
```

### `stock`

Saldo corrente por lote.

Novas colunas:

```sql
purchase_id uuid null
original_quantity numeric null
entry_type text not null default 'purchase'
updated_at timestamptz not null default now()
```

Valores válidos de `entry_type`:

- `'purchase'`
- `'adjustment'`
- `'legacy_unrecoverable'`

### `stock_adjustments`

Trilha de auditoria de movimentações manuais ou de sistema.

```sql
id uuid primary key
user_id uuid not null
medicine_id uuid not null
stock_id uuid null
quantity_delta numeric not null check (quantity_delta <> 0)
reason text not null
reference_id uuid null
notes text null
created_at timestamptz not null default now()
```

### `stock_consumptions`

Registro do consumo real por lote para cada `medicine_log`.

```sql
id uuid primary key
user_id uuid not null
medicine_log_id uuid not null
medicine_id uuid not null
stock_id uuid not null
quantity_consumed numeric not null check (quantity_consumed > 0)
reversed_at timestamptz null
created_at timestamptz not null default now()
```

### `medicines.regulatory_category`

Novo campo:

```sql
regulatory_category text null
```

Valores esperados:

- `Genérico`
- `Similar`
- `Novo`
- outros valores ANVISA permitidos como fallback textual

## 4.3 Relações e invariantes

### Relações

```text
medicines 1 --- N purchases
purchases 1 --- N stock
stock 1 --- N stock_adjustments
medicine_logs 1 --- N stock_consumptions
stock 1 --- N stock_consumptions
```

### Invariantes obrigatórias

1. Toda linha `stock.entry_type = 'purchase'` deve ter `purchase_id not null`.
2. Toda `purchase` criada por fluxo novo deve criar exatamente uma linha correspondente em `stock`.
3. Todo `stock_consumptions` com `reversed_at is null` representa consumo ainda não estornado.
4. `restore_stock_for_log()` deve fechar todos os consumos abertos daquele log.

---

## 5. Estrutura de arquivos a criar e modificar

## 5.1 Criar

- `docs/migrations/20260402_stock_purchases_refactor.sql`
- `src/features/stock/services/purchaseService.js`
- `src/features/stock/services/__tests__/purchaseService.test.js`

## 5.2 Modificar

- `src/features/stock/services/stockService.js`
- `src/shared/services/api/logService.js`
- `src/shared/services/index.js`
- `src/shared/services/cachedServices.js`
- `src/schemas/stockSchema.js`
- `src/schemas/medicineSchema.js`
- `src/features/stock/hooks/useStockData.js`
- `src/features/stock/components/StockForm.jsx`
- `src/features/stock/components/StockForm.css`
- `src/features/stock/components/redesign/EntradaHistorico.jsx`
- `src/features/stock/components/redesign/StockCardRedesign.jsx`
- `src/features/stock/services/costAnalysisService.js`
- `src/features/stock/services/__tests__/stockService.test.js`
- `src/features/stock/services/__tests__/costAnalysisService.test.js`
- `src/features/stock/components/__tests__/StockForm.test.jsx`
- `src/features/medications/services/medicineService.js`
- `src/features/medications/services/medicineDatabaseService.js`
- `src/features/medications/services/__tests__/medicineDatabaseService.test.js`
- `src/features/medications/components/MedicineForm.jsx`
- `src/features/protocols/components/TreatmentWizard.jsx`
- `server/bot/commands/adicionar_estoque.js`
- `scripts/process-anvisa.js`
- `docs/architecture/DATABASE.md`
- `docs/reference/SERVICES.md`

## 5.3 Opcional para cleanup posterior, não obrigatório nesta onda

- `src/features/stock/constants.js`
- qualquer leitor legado que ainda use prefixos textuais em `notes`

Esses pontos só devem ser removidos se não quebrarem a compatibilidade temporária da UI legacy.

## 5.4 Mudança exata por arquivo

### `src/features/stock/services/stockService.js`

- substituir escrita direta em `stock` por RPCs;
- manter o nome público `add()` para compatibilidade;
- remover qualquer `insert` que represente ajuste automático como compra.

### `src/shared/services/api/logService.js`

- centralizar consumo e restauração pelo `medicine_log.id`;
- nunca recalcular retorno de estoque apenas por aproximação de delta.

### `src/features/stock/hooks/useStockData.js`

- continuar responsável por combinar medicamentos, protocolos, saldo e histórico;
- parar de deduzir compra a partir de `stock`.

### `src/features/stock/components/StockForm.jsx`

- ampliar payload de compra;
- implementar a matriz de UX por `regulatory_category`.

### `src/features/stock/components/redesign/EntradaHistorico.jsx`

- trocar fonte de dados de `stock` para `purchases`;
- trocar quantidade exibida para `quantity_bought`.

### `src/features/stock/components/redesign/StockCardRedesign.jsx`

- manter layout e copy;
- trocar apenas a origem de `lastPurchase`.

### `scripts/process-anvisa.js`

- incluir `regulatoryCategory` no JSON;
- não alterar a estratégia de deduplicação atual.

### `server/bot/commands/adicionar_estoque.js`

- trocar somente a escrita do bot;
- não redesenhar o fluxo conversacional nesta entrega.

---

## 6. Migration SQL detalhada

## 6.1 Ordem obrigatória

Executar nesta ordem dentro de `20260402_stock_purchases_refactor.sql`:

1. adicionar coluna `regulatory_category` em `medicines`;
2. criar `purchases`;
3. alterar `stock`;
4. criar `stock_adjustments`;
5. criar `stock_consumptions`;
6. criar índices;
7. habilitar RLS e policies;
8. criar RPCs;
9. executar backfill idempotente;
10. adicionar comentários de documentação.

## 6.2 Constraints obrigatórias

### `stock.entry_type`

```sql
check (entry_type in ('purchase', 'adjustment', 'legacy_unrecoverable'))
```

### FKs

- `purchases.medicine_id -> medicines.id`
- `stock.purchase_id -> purchases.id`
- `stock_adjustments.stock_id -> stock.id`
- `stock_consumptions.stock_id -> stock.id`
- `stock_consumptions.medicine_log_id -> medicine_logs.id`

## 6.3 Índices obrigatórios

```sql
create index if not exists idx_stock_fifo_lookup
on stock(user_id, medicine_id, purchase_date, created_at, id)
where quantity > 0;

create index if not exists idx_purchases_history
on purchases(user_id, medicine_id, purchase_date desc, created_at desc);

create index if not exists idx_stock_adjustments_history
on stock_adjustments(user_id, medicine_id, created_at desc);

create index if not exists idx_stock_consumptions_log
on stock_consumptions(user_id, medicine_log_id);

create index if not exists idx_stock_consumptions_open
on stock_consumptions(stock_id)
where reversed_at is null;

create index if not exists idx_medicines_regulatory_category
on medicines(user_id, regulatory_category);
```

## 6.4 Policies RLS

Aplicar em `purchases`, `stock_adjustments`, `stock_consumptions`:

- SELECT: `user_id = auth.uid()`
- INSERT: `with check (user_id = auth.uid())`
- UPDATE: `using (user_id = auth.uid()) with check (user_id = auth.uid())`
- DELETE: **não necessário** para `purchases` e `stock_consumptions`; evitar expor deleção ao cliente.

---

## 7. RPCs detalhadas

## 7.1 `create_purchase_with_stock`

### Assinatura

```sql
create_purchase_with_stock(
  p_medicine_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_purchase_date date,
  p_expiration_date date,
  p_pharmacy text,
  p_laboratory text,
  p_notes text
)
```

### Regras

- validar `p_quantity > 0`;
- criar registro em `purchases`;
- criar registro correspondente em `stock`;
- preencher:
  - `stock.purchase_id = purchases.id`
  - `stock.original_quantity = p_quantity`
  - `stock.quantity = p_quantity`
  - `stock.entry_type = 'purchase'`
- retornar payload da compra criada com metadados do lote.

### Pseudocódigo

```sql
begin
  insert into purchases (...) values (...) returning id into v_purchase_id;

  insert into stock (
    user_id, medicine_id, purchase_id, quantity, original_quantity,
    purchase_date, expiration_date, unit_price, notes, entry_type
  ) values (..., v_purchase_id, p_quantity, p_quantity, ..., 'purchase');

  return query
  select * from purchases where id = v_purchase_id;
end;
```

## 7.2 `consume_stock_fifo`

### Assinatura

```sql
consume_stock_fifo(
  p_medicine_id uuid,
  p_quantity numeric,
  p_medicine_log_id uuid
)
```

### Regras

- usar `auth.uid()` internamente como `user_id`;
- selecionar lotes com `quantity > 0`;
- ordenar por `purchase_date asc, created_at asc, id asc`;
- travar linhas com `FOR UPDATE`;
- se saldo total for insuficiente, abortar sem side effect;
- decrementar lote a lote;
- criar um `stock_consumptions` para cada lote tocado.

### Pseudocódigo

```sql
begin
  v_remaining := p_quantity;

  for v_stock in
    select *
    from stock
    where user_id = auth.uid()
      and medicine_id = p_medicine_id
      and quantity > 0
    order by purchase_date asc, created_at asc, id asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(v_stock.quantity, v_remaining);

    update stock
    set quantity = quantity - v_take,
        updated_at = now()
    where id = v_stock.id;

    insert into stock_consumptions (...)
    values (..., p_medicine_log_id, p_medicine_id, v_stock.id, v_take);

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Estoque insuficiente';
  end if;
end;
```

## 7.3 `restore_stock_for_log`

### Assinatura

```sql
restore_stock_for_log(
  p_medicine_log_id uuid,
  p_reason text default 'dose_excluida'
)
```

### Regras

- localizar `stock_consumptions` do log com `reversed_at is null`;
- se não houver registros abertos, retornar sucesso idempotente sem alterar nada;
- restaurar exatamente as quantidades nos mesmos `stock_id`;
- marcar `reversed_at = now()`;
- registrar `stock_adjustments` positivos para auditoria.

### Pseudocódigo

```sql
begin
  for v_consumption in
    select *
    from stock_consumptions
    where user_id = auth.uid()
      and medicine_log_id = p_medicine_log_id
      and reversed_at is null
    for update
  loop
    update stock
    set quantity = quantity + v_consumption.quantity_consumed,
        updated_at = now()
    where id = v_consumption.stock_id;

    update stock_consumptions
    set reversed_at = now()
    where id = v_consumption.id;

    insert into stock_adjustments (...)
    values (..., v_consumption.stock_id, v_consumption.quantity_consumed, p_reason, p_medicine_log_id, null);
  end loop;
end;
```

## 7.4 `apply_manual_stock_adjustment`

### Assinatura

```sql
apply_manual_stock_adjustment(
  p_medicine_id uuid,
  p_quantity_delta numeric,
  p_reason text,
  p_notes text default null
)
```

### Regras

- usar para correções manuais e casos de sistema sem origem em compra;
- se `p_quantity_delta > 0`, criar entrada `stock` com:
  - `entry_type = 'adjustment'`
  - `purchase_id = null`
  - `original_quantity = p_quantity_delta`
- se `p_quantity_delta < 0`, falhar explicitamente com exceção `Ajuste manual negativo não suportado nesta entrega`.

**Decisão fechada desta spec:** ajuste manual de saída não entra no fluxo de produto desta onda; implementar apenas ajustes positivos e restauração por log.

---

## 8. Backfill detalhado

## 8.1 Critério de classificação

### Linha de `stock` vira `purchase`

Quando:

- `quantity > 0`
- `notes` é `null` ou não começa com prefixo de sistema conhecido

Efeitos:

- cria `purchases`
- preenche `stock.purchase_id`
- preenche `stock.original_quantity = stock.quantity`
- define `stock.entry_type = 'purchase'`

### Linha de `stock` vira `adjustment`

Quando:

- `notes` identifica ajuste automático

Prefixos reconhecidos nesta onda:

- `Dose excluída`
- `Ajuste de dose`
- `Estorno de dose`

Regra de matching:

- usar `startsWith` no cliente e `LIKE 'prefix%'` no SQL;
- não normalizar texto;
- matching é case-sensitive.

Efeitos:

- `stock.entry_type = 'adjustment'`
- `stock.purchase_id = null`
- `stock.original_quantity = stock.quantity`
- criar `stock_adjustments` positivo quando possível

### Linha vira `legacy_unrecoverable`

Quando:

- `quantity <= 0`
- sem dados suficientes para reconstruir compra histórica

Efeitos:

- não cria `purchase`
- não entra em histórico de compras
- não entra em custo médio futuro
- permanece apenas como legado técnico e auditoria mínima

## 8.2 Idempotência

Usar `purchases.legacy_stock_id`:

- se já existir `purchase` para `legacy_stock_id = stock.id`, não recriar;
- apenas reconciliar `stock.purchase_id` se necessário.

## 8.3 Validação pós-backfill

Executar e documentar:

```sql
-- Antes e depois:
select user_id, medicine_id, sum(quantity)
from stock
group by user_id, medicine_id;
```

Critério obrigatório:

- soma por `(user_id, medicine_id)` igual antes/depois.

Checks adicionais:

- nenhuma `stock.entry_type = 'purchase'` com `purchase_id is null`
- nenhuma `purchase` duplicada por `legacy_stock_id`

---

## 9. Services e contratos

## 9.1 `purchaseService.js`

Criar com esta API:

```js
export const purchaseService = {
  async getByMedicine(medicineId) {},
  async getLatestByMedicineIds(medicineIds) {},
  async getHistoryByMedicineIds(medicineIds) {},
  async getAverageUnitPriceByMedicineIds(medicineIds) {},
  async create(input) {},
}
```

### Regras

- `getByMedicine()` retorna compras da mais recente para a mais antiga;
- `getLatestByMedicineIds()` retorna um objeto plano no formato `{ [medicineId]: latestPurchase | null }`;
- `getHistoryByMedicineIds()` retorna um objeto plano no formato `{ [medicineId]: PurchaseRecord[] }`;
- `getAverageUnitPriceByMedicineIds()` retorna um objeto plano no formato `{ [medicineId]: number }`;
- `getAverageUnitPriceByMedicineIds()` usa `quantity_bought`, nunca `stock.quantity`;
- `create()` chama a RPC `create_purchase_with_stock`.

### Shape canônico de `PurchaseRecord`

```js
{
  id,
  medicine_id,
  quantity_bought,
  unit_price,
  purchase_date,
  expiration_date,
  pharmacy,
  laboratory,
  notes,
  created_at,
}
```

## 9.2 `stockService.js`

### Manter

- `getByMedicine()`
- `getTotalQuantity()`
- `getStockSummary()`
- `getLowStockMedicines()`

### Refatorar

- `add(input)`:
  - manter nome para compatibilidade;
  - validar como `PurchaseInput`;
  - delegar para `purchaseService.create()`;
  - não usar `.from('stock').insert(...)` diretamente.

- `decrease(medicineId, quantity, medicineLogId)`:
  - passar a chamar `consume_stock_fifo`;
  - `medicineLogId` torna-se obrigatório nos novos call sites.

- `increase(...)`:
  - parar de fazer `insert` em `stock`;
  - se vier `medicine_log_id`, usar `restore_stock_for_log`;
  - para ajuste manual positivo, usar `apply_manual_stock_adjustment`.

### Compatibilidade

Se algum call site legado chamar `increase(medicineId, quantity, reasonString)`:

- converter internamente para ajuste manual positivo com `reason = 'ajuste_manual_legacy'`
- não criar compra fake.

### Assinaturas obrigatórias pós-refactor

```js
async add(input: PurchaseInput): Promise<PurchaseRecord>
async decrease(medicineId: string, quantity: number, medicineLogId: string): Promise<void>
async increase(
  medicineId: string,
  quantity: number,
  options?: {
    medicine_log_id?: string
    adjustment_reason?: string
    notes?: string | null
  } | string
): Promise<void>
```

## 9.3 `logService.js`

### `create(log)`

Nova ordem:

1. validar payload;
2. criar `medicine_logs`;
3. chamar `consume_stock_fifo(log.medicine_id, log.quantity_taken, createdLog.id)`;
4. se a RPC falhar, excluir o log recém-criado antes de propagar erro.

### `update(id, updates)`

Nova regra:

1. buscar log atual;
2. se `quantity_taken` mudou:
   - restaurar consumo anterior via `restore_stock_for_log(id, 'ajuste_de_dose')`;
   - recalcular `targetQuantityTaken` usando `updates.quantity_taken ?? oldLog.quantity_taken`;
3. reconsumir com a nova quantidade;
4. somente após reconsumo bem-sucedido, atualizar o log.

**Importante:** este fluxo é mais seguro e mais simples do que calcular delta contra lotes já misturados.

### `delete(id)`

Nova ordem:

1. buscar log;
2. `restore_stock_for_log(id, 'dose_excluida')`;
3. deletar `medicine_logs`.

---

## 10. Schemas

## 10.1 `stockSchema.js`

Transformar o schema de criação em schema de compra.

### Campos obrigatórios

- `medicine_id`
- `quantity`
- `purchase_date`

### Campos opcionais

- `unit_price`
- `expiration_date`
- `pharmacy`
- `laboratory`
- `notes`

### Regras

- `quantity > 0`
- `purchase_date <= hoje`
- `expiration_date > purchase_date` quando informada
- `unit_price >= 0`
- `pharmacy.length <= 200`
- `laboratory.length <= 200`
- `notes.length <= 500`

### Remover semântica antiga

- `reason` não é mais o contrato canônico da operação de aumento;
- `stockIncreaseSchema` deve ser remodelado como:
  - `medicine_id`
  - `quantity`
  - `medicine_log_id?`
  - `adjustment_reason?`
  - `notes?`

## 10.2 `medicineSchema.js`

Adicionar:

```js
regulatory_category: z
  .string()
  .max(100)
  .optional()
  .nullable()
  .transform((val) => val || null)
```

---

## 11. Redesign UI only

## 11.1 Princípio de escopo

O redesign é a única superfície oficial desta execução.  
Portanto:

- o comportamento final deve ser validado apenas em `src/views/redesign/StockRedesign.jsx`;
- não adaptar o produto à view legacy como requisito;
- se `useStockData()` continuar compartilhado com a legacy, isso é consequência técnica, não objetivo da spec.

## 11.2 `useStockData.js`

Refatorar para:

- continuar usando `stock` como fonte de saldo;
- buscar histórico e última compra via `purchaseService`;
- parar de filtrar prefixos em `notes`.

### Sequência obrigatória de carregamento

1. carregar `medicineService.getAll()`;
2. carregar `protocolService.getActive()`;
3. carregar saldo por medicamento via `stockService.getByMedicine()` em paralelo;
4. carregar última compra via `purchaseService.getLatestByMedicineIds()`;
5. carregar histórico completo via `purchaseService.getHistoryByMedicineIds()` apenas para consumo do modo complexo.

### Shape alvo de `item`

```js
{
  medicine,
  entries,              // stock entries para saldo/lotes ativos
  purchases,            // histórico limpo de compras
  totalQuantity,
  dailyIntake,
  daysRemaining,
  stockStatus,
  hasActiveProtocol,
  primaryProtocol,
  barPercentage,
  lastPurchase,         // derivado de purchases[0]
}
```

## 11.3 `EntradaHistorico.jsx`

Trocar contrato:

- antes: recebe `entries` e filtra compras
- depois: recebe `purchases`

### Comportamento

- ordenar por `purchase_date desc, created_at desc`;
- exibir `quantity_bought`, não `stock.quantity`;
- exibir custo unitário;
- não calcular custo total baseado em saldo remanescente.

## 11.4 `StockCardRedesign.jsx`

Atualizar:

- "última compra" deve usar `lastPurchase` derivado de `purchases`;
- não depender de `stock.entries` para histórico;
- manter layout e vocabulário atual do redesign.

## 11.5 `StockForm.jsx`

Adicionar campos:

- `pharmacy`
- `laboratory`
- `notes`

### Regra por `regulatory_category`

#### `Genérico`

- campo `laboratory` visível e incentivado;
- label sugerida: `Laboratório desta compra`;
- pré-preencher com:
  1. último `purchase.laboratory` do mesmo medicamento, se existir;
  2. senão `medicine.laboratory`, se existir;
  3. senão string vazia.

#### `Similar` ou `Novo`

- não solicitar laboratório por compra;
- mostrar laboratório fixo do medicamento como texto informativo;
- enviar `laboratory = null` no payload de compra.

#### Outros

- permitir `laboratory` opcional colapsado.

### Matriz obrigatória de visibilidade

| regulatory_category | pharmacy | laboratory | valor enviado em `laboratory` |
|---|---|---|---|
| `Genérico` | visível opcional | visível | texto preenchido |
| `Similar` | visível opcional | oculto | `null` |
| `Novo` | visível opcional | oculto | `null` |
| outro/null | visível opcional | colapsado opcional | texto se preenchido, senão `null` |

### Regras visuais

- não reestruturar a página toda;
- manter o visual do redesign;
- inserir os novos campos como expansão natural do formulário existente.

---

## 12. ANVISA

## 12.1 `scripts/process-anvisa.js`

Hoje o script lê:

- `NOME_PRODUTO`
- `CATEGORIA_REGULATORIA`
- `CLASSE_TERAPEUTICA`
- `PRINCIPIO_ATIVO`
- `EMPRESA_DETENTORA_REGISTRO`

Modificar para gerar `medicineDatabase.json` com:

```json
{
  "name": "Losartana Potássica",
  "activeIngredient": "losartana potassica",
  "therapeuticClass": "ANTI-HIPERTENSIVOS",
  "regulatoryCategory": "Genérico"
}
```

Mapeamento obrigatório:

- usar o valor bruto de `CATEGORIA_REGULATORIA` como `regulatoryCategory`;
- não converter para minúsculas;
- não traduzir;
- não colapsar categorias diferentes.

O comportamento especial da UI deve observar apenas igualdade exata com `Genérico`, `Similar` e `Novo`.

## 12.2 `medicineDatabaseService.js`

Atualizar contratos e JSDoc para expor `regulatoryCategory`.

## 12.3 Persistência em medicamento

### `MedicineForm.jsx`

Ao selecionar medicamento vindo da base ANVISA:

- persistir `regulatory_category` junto com o medicamento.

### `TreatmentWizard.jsx`

Ao criar medicamento via ANVISA no wizard:

- persistir `regulatory_category` em `medicineService.create()`.

---

## 13. Telegram bot

## 13.1 `server/bot/commands/adicionar_estoque.js`

Substituir:

- `insert` direto em `stock`

Por:

- chamada RPC `create_purchase_with_stock`

### Payload

- `medicine_id`
- `quantity`
- `purchase_date = hoje`
- `unit_price = 0`
- `expiration_date = null`
- `pharmacy = null`
- `laboratory = null`
- `notes = 'Entrada via bot Telegram'`

## 13.2 Leituras do bot

`/estoque`, alertas e contexto do bot podem continuar lendo:

- `stock.quantity`

Mas:

- não devem depender de prefixos em `notes`;
- não devem inferir compras a partir de `stock`.

Arquivos mínimos a revisar nesta entrega:

- `server/bot/commands/estoque.js`
- `server/bot/tasks.js`
- `server/bot/services/chatbotServerService.js`

---

## 14. Cálculo de custos

## 14.1 Regra nova

Preço médio ponderado deve usar:

```text
SUM(quantity_bought * unit_price) / SUM(quantity_bought)
```

Base:

- `purchases`, não `stock`

## 14.2 `costAnalysisService.js`

Atualizar para aceitar compras ou mapa pré-calculado de preço médio.

### Comportamento obrigatório

- compras com `unit_price = 0` entram como grátis;
- compras sem preço válido não devem quebrar o cálculo;
- histórico legacy sem `purchase` pode usar fallback em `stock.original_quantity` apenas durante transição técnica;
- redesign deve preferir sempre `purchases`.

Regra fechada de fallback:

1. se houver `purchases` para o medicamento, usar somente `purchases`;
2. se não houver `purchases`, usar fallback em `stock.original_quantity`;
3. nunca misturar `purchases` e fallback legacy no mesmo medicamento.

---

## 15. Estratégia de implementação em fases

## Fase A — Banco

1. Criar migration completa.
2. Revisar SQL manualmente.
3. Validar idempotência do backfill.

## Fase B — Services e contratos

1. Criar `purchaseService`.
2. Refatorar `stockService`.
3. Refatorar `logService`.
4. Refatorar schemas.
5. Atualizar exports compartilhados.

## Fase C — ANVISA

1. Atualizar ETL.
2. Atualizar `medicineDatabaseService`.
3. Atualizar `MedicineForm`.
4. Atualizar `TreatmentWizard`.

## Fase D — Redesign UI

1. Atualizar `useStockData`.
2. Atualizar `StockForm`.
3. Atualizar `EntradaHistorico`.
4. Atualizar `StockCardRedesign`.
5. Validar fluxo completo `?redesign=1`.

## Fase E — Telegram

1. Atualizar `/adicionar_estoque`.
2. Validar `/estoque`.

## Fase F — Testes e documentação

1. Testes unitários.
2. Testes de integração.
3. Atualizar docs de banco e services.

## 15.1 Ordem obrigatória de execução

Não inverter a sequência abaixo:

1. banco
2. services e schemas
3. ANVISA
4. redesign UI
5. Telegram
6. testes e documentação

Regras de dependência:

- não alterar `useStockData` antes de existir `purchaseService`;
- não alterar `StockForm` antes de `stockSchema` e `medicineSchema`;
- não alterar o bot antes de a RPC `create_purchase_with_stock` existir.

## 15.2 Entregáveis por fase no formato `/deliver-sprint`

### Fase 0 — Discovery + Setup

Entregáveis mínimos:

- branch criada
- memória e regras lidas
- lista de arquivos impactados confirmada

### Fase A — Banco

Entregáveis mínimos:

- migration criada
- SQL revisado
- backfill idempotente definido

### Fase B — Services e contratos

Entregáveis mínimos:

- `purchaseService` criado
- `stockService` refatorado
- `logService` refatorado
- schemas atualizados

### Fase C — ANVISA

Entregáveis mínimos:

- ETL atualizado
- `medicineDatabaseService` atualizado
- persistência de `regulatory_category` implementada

### Fase D — Redesign UI

Entregáveis mínimos:

- `useStockData` usando `purchaseService`
- `StockForm` com matriz regulatória
- `EntradaHistorico` lendo `purchases`
- `StockCardRedesign` usando `lastPurchase`

### Fase E — Telegram

Entregáveis mínimos:

- `/adicionar_estoque` usando RPC
- leitores do bot verificados contra dependência de `notes`

### Fase F — Validation + Docs

Entregáveis mínimos:

- testes obrigatórios verdes
- docs atualizadas
- `.memory/journal` atualizado
- PR pronta para review

## 15.3 Execução em 6 etapas sequenciais com gates obrigatórios

Esta é a trilha oficial de execução para um agente coder usando `/deliver-sprint`.

O agente deve executar **uma etapa por vez**.  
Não pode iniciar a etapa seguinte sem passar no gate da etapa atual.

### Etapa 1 — Banco

**Objetivo**

- criar a base estrutural do novo modelo;
- deixar o banco pronto para suportar compras, ajustes e consumos por lote;
- garantir backfill idempotente.

**Escopo exato**

- `docs/migrations/20260402_stock_purchases_refactor.sql`

**Saída esperada**

- novas tabelas, colunas, índices, RLS, policies e RPCs definidos;
- backfill implementado no SQL;
- invariantes do modelo cobertos pela migration.

**Gate 1 — Validação obrigatória**

O agente deve confirmar, antes de seguir:

- [ ] a migration cria `purchases`
- [ ] a migration cria `stock_adjustments`
- [ ] a migration cria `stock_consumptions`
- [ ] a migration adiciona `medicines.regulatory_category`
- [ ] a migration adiciona `stock.purchase_id`
- [ ] a migration adiciona `stock.original_quantity`
- [ ] a migration adiciona `stock.entry_type`
- [ ] a migration cria os 4 RPCs definidos na spec
- [ ] o backfill é idempotente por `legacy_stock_id`
- [ ] o SQL não introduz ajuste manual negativo

**Revalidação da spec neste gate**

O agente deve reler e confirmar coerência entre:

- seção **4. Arquitetura alvo**
- seção **6. Migration SQL detalhada**
- seção **7. RPCs detalhadas**
- seção **8. Backfill detalhado**

Se houver divergência entre SQL planejado e comportamento esperado da UI redesign, o agente deve parar e corrigir a spec antes de implementar a Etapa 2.

---

### Etapa 2 — Services e Schemas

**Objetivo**

- migrar a camada de domínio para o novo modelo semântico;
- remover a dependência de compra fake em `stock`;
- fechar os contratos de leitura e escrita.

**Escopo exato**

- `src/features/stock/services/purchaseService.js`
- `src/features/stock/services/stockService.js`
- `src/shared/services/api/logService.js`
- `src/shared/services/index.js`
- `src/shared/services/cachedServices.js`
- `src/schemas/stockSchema.js`
- `src/schemas/medicineSchema.js`
- testes unitários diretos desses módulos

**Saída esperada**

- `purchaseService` criado e exportado;
- `stockService.add()` escrevendo compra via RPC;
- `stockService.increase()` sem `insert` fake em `stock`;
- `logService.create/update/delete()` usando consumo/restauração por log;
- schemas refletindo os novos contratos.

**Gate 2 — Validação obrigatória**

- [ ] `purchaseService` existe com as 5 funções previstas
- [ ] `stockService.add()` delega para compra, não para `stock.insert`
- [ ] `stockService.decrease()` chama `consume_stock_fifo`
- [ ] `stockService.increase()` usa `restore_stock_for_log` ou `apply_manual_stock_adjustment`
- [ ] `logService.create()` não deixa log persistido com estoque inconsistente
- [ ] `logService.update()` segue a ordem da spec
- [ ] `logService.delete()` restaura antes de deletar
- [ ] `stockSchema` aceita `pharmacy`, `laboratory`, `notes`
- [ ] `medicineSchema` aceita `regulatory_category`

**Revalidação da spec neste gate**

O agente deve reler:

- seção **9. Services e contratos**
- seção **10. Schemas**
- seção **18. Critérios de aceite**

Pergunta obrigatória de revalidação:

> Se a redesign pedisse “última compra” agora, os services já conseguem responder isso sem olhar para `stock.quantity` remanescente?

Se a resposta for “não”, a Etapa 2 não passou.

---

### Etapa 3 — ANVISA

**Objetivo**

- propagar `regulatory_category` desde o ETL até a persistência do medicamento;
- garantir que o redesign consiga usar a categoria regulatória para decidir o comportamento do formulário.

**Escopo exato**

- `scripts/process-anvisa.js`
- `src/features/medications/services/medicineDatabaseService.js`
- `src/features/medications/components/MedicineForm.jsx`
- `src/features/protocols/components/TreatmentWizard.jsx`

**Saída esperada**

- `medicineDatabase.json` passa a incluir `regulatoryCategory`;
- `medicineDatabaseService` expõe o campo;
- `MedicineForm` e `TreatmentWizard` persistem `regulatory_category`.

**Gate 3 — Validação obrigatória**

- [ ] ETL gera `regulatoryCategory`
- [ ] serviço ANVISA expõe `regulatoryCategory`
- [ ] `MedicineForm` persiste `regulatory_category`
- [ ] `TreatmentWizard` persiste `regulatory_category`
- [ ] nenhum campo ANVISA antigo foi removido acidentalmente

**Revalidação da spec neste gate**

O agente deve reler:

- seção **11.5 `StockForm.jsx`**
- seção **12. ANVISA**

Pergunta obrigatória de revalidação:

> A UI redesign terá informação suficiente para decidir, sem heurística extra, quando mostrar ou ocultar o campo de laboratório por compra?

Se a resposta for “não”, a Etapa 3 não passou.

---

### Etapa 4 — Redesign UI

**Objetivo**

- migrar somente a experiência redesign para o novo modelo;
- fazer a redesign consumir histórico real de compras e última compra correta.

**Escopo exato**

- `src/features/stock/hooks/useStockData.js`
- `src/features/stock/components/StockForm.jsx`
- `src/features/stock/components/StockForm.css`
- `src/features/stock/components/redesign/EntradaHistorico.jsx`
- `src/features/stock/components/redesign/StockCardRedesign.jsx`
- qualquer ajuste mínimo em `src/views/redesign/StockRedesign.jsx` estritamente necessário ao wiring

**Saída esperada**

- redesign calcula saldo por `stock`;
- redesign lê histórico e última compra por `purchaseService`;
- `EntradaHistorico` renderiza `purchases`;
- `StockForm` segue a matriz regulatória;
- não existe inferência de compra real a partir de `notes`.

**Gate 4 — Validação obrigatória**

- [ ] `useStockData()` carrega `lastPurchase` a partir de `purchaseService`
- [ ] `useStockData()` carrega histórico completo apenas para o modo complexo
- [ ] `EntradaHistorico.jsx` não usa mais `entries` de `stock` como histórico
- [ ] `StockCardRedesign.jsx` usa `lastPurchase` derivado de compra real
- [ ] `StockForm.jsx` implementa a matriz de visibilidade por categoria regulatória
- [ ] nenhuma regra visual da redesign foi regressada desnecessariamente

**Revalidação da spec neste gate**

O agente deve reler:

- seção **11. Redesign UI only**
- seção **14. Cálculo de custos**

Pergunta obrigatória de revalidação:

> O fluxo `?redesign=1` já entrega o objetivo final do projeto, mesmo que a UI legacy continue tecnicamente funcionando do jeito antigo?

Se a resposta for “não”, a Etapa 4 não passou.

---

### Etapa 5 — Telegram

**Objetivo**

- garantir que o bot escreva no novo modelo;
- garantir que leituras continuem corretas sem depender da arquitetura antiga.

**Escopo exato**

- `server/bot/commands/adicionar_estoque.js`
- revisão mínima de:
  - `server/bot/commands/estoque.js`
  - `server/bot/tasks.js`
  - `server/bot/services/chatbotServerService.js`

**Saída esperada**

- bot deixa de inserir direto em `stock`;
- bot continua lendo saldo por soma de `stock.quantity`;
- bot não depende de `notes` para separar compras.

**Gate 5 — Validação obrigatória**

- [ ] `/adicionar_estoque` usa `create_purchase_with_stock`
- [ ] `/adicionar_estoque` não usa `.from('stock').insert(...)`
- [ ] `/estoque` continua somando saldo corretamente
- [ ] tasks/alertas não dependem de prefixos em `notes`

**Revalidação da spec neste gate**

O agente deve reler:

- seção **13. Telegram bot**
- seção **18. Critérios de aceite**

Pergunta obrigatória de revalidação:

> Depois desta etapa, ainda existe algum writer importante fora do app web que continue alimentando o modelo antigo diretamente?

Se a resposta for “sim”, a Etapa 5 não passou.

---

### Etapa 6 — Validação final, documentação e PR readiness

**Objetivo**

- provar que a entrega está consistente;
- preparar o pacote final para PR, review Gemini e aprovação humana.

**Escopo exato**

- testes unitários
- testes de integração
- docs
- `.memory/`
- revisão final da spec vs implementação

**Saída esperada**

- validações verdes;
- docs atualizadas;
- memória atualizada;
- branch pronta para PR.

**Gate 6 — Validação obrigatória**

- [ ] comandos da seção **16.6** passaram
- [ ] `docs/architecture/DATABASE.md` foi atualizada
- [ ] `docs/reference/SERVICES.md` foi atualizada
- [ ] `.memory/journal/YYYY-WWW.md` foi atualizada
- [ ] checklist da seção **18.1** está todo marcado

**Revalidação final da spec**

O agente deve reler integralmente:

- seção **1. Objetivo**
- seção **11. Redesign UI only**
- seção **13. Telegram bot**
- seção **18. Critérios de aceite**

Pergunta final obrigatória:

> O resultado implementado ainda cumpre simultaneamente os três compromissos centrais desta entrega: redesign-only rollout, ANVISA obrigatório e Telegram no mesmo ciclo?

Se a resposta for “não”, a entrega não deve seguir para PR.

---

## 16. Testes obrigatórios

## 16.1 Unitários

### `stockService`

- cria compra via RPC;
- consome FIFO na ordem correta;
- restaura por `medicine_log_id`;
- não cria mais compra fake ao aumentar estoque.

### `purchaseService`

- retorna histórico ordenado corretamente;
- retorna última compra por medicamento;
- calcula preço médio usando `quantity_bought`.

### `costAnalysisService`

- usa `purchases` corretamente;
- ignora ausência de preço sem quebrar o total;
- não depende de saldo remanescente.

### `medicineDatabaseService`

- expõe `regulatoryCategory`.

### Schemas

- validam `pharmacy`, `laboratory`, `notes`, `regulatory_category`.

## 16.2 Integração

- `create_purchase_with_stock`
- `consume_stock_fifo`
- `restore_stock_for_log`
- backfill idempotente
- `logService.create()`
- `logService.update()`
- `logService.delete()`

## 16.3 UI redesign

- `StockForm` mostra/oculta laboratório conforme categoria regulatória;
- `EntradaHistorico` renderiza `purchases`;
- `StockRedesign` mostra última compra correta;
- fluxo `?redesign=1` permite adicionar estoque e ver histórico limpo.

## 16.4 Telegram

- `/adicionar_estoque` gera `purchase + stock`;
- `/estoque` continua mostrando saldo correto.

## 16.5 Casos de borda

- consumo atravessando múltiplos lotes;
- exclusão de log já restaurado;
- lote zerado;
- compra sem preço;
- compra sem farmácia;
- genérico sem laboratório informado;
- similar/novo sem campo de laboratório por compra;
- linhas `legacy_unrecoverable`.

## 16.6 Comandos obrigatórios de validação

Executar exatamente estes comandos ao final:

```bash
npm run lint
npm run test:critical -- src/features/stock/services/__tests__/stockService.test.js src/features/stock/services/__tests__/purchaseService.test.js src/features/stock/services/__tests__/costAnalysisService.test.js src/features/medications/services/__tests__/medicineDatabaseService.test.js
npm run test:components -- src/features/stock/components/__tests__/StockForm.test.jsx
npm run validate:agent
```

Se algum comando falhar, a implementação não está pronta.

---

## 17. Rollback e mitigação

## 17.1 Estratégia

Adotar modelo **expand-first**:

- primeiro criar tabelas/colunas/funções;
- depois mudar serviços;
- por último mudar leituras da redesign.

## 17.2 Rollback de código

Se houver regressão:

- manter schema novo no banco;
- reverter apenas a leitura da redesign para fallback temporário;
- bot pode continuar somando `stock.quantity`.

## 17.3 Rollback de dados

Não deletar:

- `stock` legado
- `legacy_unrecoverable`
- `purchases` backfillados

Nesta fase, rollback é via código, não via destruição de dados.

## 17.4 Safeguards obrigatórios

- migration idempotente;
- validação de soma de estoque antes/depois;
- smoke test no redesign antes de merge;
- smoke test no bot `/adicionar_estoque` antes de merge.

---

## 18. Critérios de aceite

Esta spec está corretamente implementada quando:

1. compras novas são gravadas em `purchases` e refletidas em `stock`;
2. `stock` deixa de ser fonte de histórico de compra;
3. exclusão/edição de dose restaura exatamente os lotes consumidos;
4. `avg_price` e análises de custo deixam de depender de saldo remanescente;
5. redesign (`?redesign=1`) exibe histórico e última compra corretos;
6. `regulatory_category` percorre ETL -> serviço -> persistência -> `StockForm`;
7. o bot Telegram deixa de inserir direto em `stock`;
8. o saldo atual por medicamento é preservado após backfill;
9. nenhum fluxo principal depende mais de prefixos textuais em `notes` para distinguir compra real.

## 18.1 Checklist binário de aceite

- [ ] existe migration `20260402_stock_purchases_refactor.sql`
- [ ] `purchases` existe
- [ ] `stock_adjustments` existe
- [ ] `stock_consumptions` existe
- [ ] `medicines.regulatory_category` existe
- [ ] `purchaseService` existe e está exportado
- [ ] `stockService.add()` usa RPC de compra
- [ ] `stockService.increase()` não faz mais `insert` direto em `stock`
- [ ] `logService.create/update/delete()` usa consumo/restauração por log
- [ ] `useStockData()` monta `lastPurchase` a partir de `purchaseService`
- [ ] `EntradaHistorico.jsx` usa `purchases`
- [ ] `StockCardRedesign.jsx` usa `lastPurchase` derivado de `purchases`
- [ ] `StockForm.jsx` implementa a matriz por `regulatory_category`
- [ ] `process-anvisa.js` gera `regulatoryCategory`
- [ ] `server/bot/commands/adicionar_estoque.js` usa RPC
- [ ] testes obrigatórios estão verdes

---

## 19. Assunções explícitas

- `quantity` permanece `numeric`, não `integer`, para preservar compatibilidade.
- Histórico retroativo é best-effort; compras antigas já destruídas pelo modelo atual não podem ser plenamente recuperadas.
- Compatibilidade com a UI legacy pode continuar por compartilhamento de service/hook, mas não entra no QA principal.
- O redesign segue em rollout gradual via `?redesign=1`; por isso esta spec trata apenas a variante em `src/views/redesign/` como superfície oficial de produto.

---

## 20. Ordem sugerida de execução por agente implementador

1. `docs/migrations/20260402_stock_purchases_refactor.sql`
2. `src/schemas/stockSchema.js`
3. `src/schemas/medicineSchema.js`
4. `src/features/stock/services/purchaseService.js`
5. `src/features/stock/services/stockService.js`
6. `src/shared/services/api/logService.js`
7. `src/features/medications/services/medicineService.js`
8. `scripts/process-anvisa.js`
9. `src/features/medications/services/medicineDatabaseService.js`
10. `src/features/medications/components/MedicineForm.jsx`
11. `src/features/protocols/components/TreatmentWizard.jsx`
12. `src/features/stock/hooks/useStockData.js`
13. `src/features/stock/components/StockForm.jsx`
14. `src/features/stock/components/redesign/EntradaHistorico.jsx`
15. `src/features/stock/components/redesign/StockCardRedesign.jsx`
16. `server/bot/commands/adicionar_estoque.js`
17. testes
18. documentação final

## 20.1 O que o agente implementador não deve fazer

- não reescrever `StockRedesign.jsx` sem necessidade;
- não introduzir novo hook para separar redesign de legacy nesta entrega;
- não migrar a UI legacy como objetivo principal;
- não adicionar comparação por farmácia;
- não adicionar gráfico/timeline novo de compras;
- não criar coleta de farmácia/laboratório no bot;
- não alterar a estrutura de `medicineDatabase.json` além de `regulatoryCategory`;
- não trocar `numeric` por `integer`;
- não remover colunas legadas de `stock` nesta mesma onda.
