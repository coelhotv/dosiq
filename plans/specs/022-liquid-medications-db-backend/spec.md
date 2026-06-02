# Feature Specification: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`  
**Created**: 2026-06-01  
**Status**: Spec Draft (Wave M2)  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`
- `docs/architecture/DOSE_INSTANCES.md`

---

## Context

Para suportar medicamentos líquidos no ecossistema Dosiq, precisamos de uma fundação de banco de dados (PostgreSQL/Supabase) extremamente robusta, escalável e 100% retrocompatível. 

Em vez de criarmos flags redundantes na interface ou complexidades matemáticas descentralizadas no frontend (Web, Mobile ou Bot do Telegram), centralizamos toda a inteligência físico-métrica no backend. A classificação de líquido passa a ser implicitamente baseada na unidade de concentração do medicamento (`medicines.dosage_unit` terminado com `'/ml'`). 

A tabela `stock` original utiliza a coluna `quantity` para pílulas sólidas. Para líquidos, a própria coluna `quantity` passará a representar o **volume fluido contínuo restante em mililitros (`ml`)** do lote comprado, inicializado de acordo com a `original_quantity`. A stored procedure `consume_stock_fifo` transacional será sobrecarregada para executar baixas decimais de forma transparente.

---

## User Scenarios & Testing

### User Story 1 — Modelagem Estrutural Segura (Priority: P1)
**Why this priority**: Permitir a persistência de metadados de medicamentos líquidos, da unidade de tomada de protocolos e do estoque físico sem quebrar dados existentes.  
**Independent Test**: Verificar que as novas colunas estruturais foram adicionadas e aceitam valores nulos (`NULL`) por padrão, garantindo imutabilidade de dados históricos legados de comprimidos.

**Acceptance Scenarios**:
1. Given que a tabela `medicines` possui novos medicamentos cadastrados,  
   When a coluna `drops_per_ml` é inspecionada,  
   Then ela deve ser um inteiro, inicializada com `20` por padrão para líquidos e aceitar `NULL` para comprimidos sólidos.
2. Given que a tabela `protocols` possui novos protocolos cadastrados,  
   When a coluna `intake_unit` é inspecionada,  
   Then ela deve ser do tipo texto (`TEXT`), aceitando `'gotas'`, `'ml'` ou `'UI'` para líquidos, e ser `NULL` para pílulas.

---

### User Story 2 — Baixa Transacional Contínua por FIFO (Priority: P1)
**Why this priority**: Garantir que as tomadas deduzam exatamente a quantidade contínua em ml de forma FIFO segura direto no banco de dados.  
**Independent Test**: Invocar a RPC `consume_stock_fifo` passando uma tomada de dose contínua decimal (ex: `2.5 ml` ou `15 gotas` com densidade 20 gotas/ml). Confirmar que a baixa em mililitros reduziu concorrentemente e com precisão decimal a coluna `quantity` na tabela `stock`.

**Acceptance Scenarios**:
1. Given que o medicamento tem unidade de concentração `'mg/ml'` e o protocolo tem unidade de tomada `'ml'`,  
   When o paciente confirma a dose tomada de `2.50` ml,  
   Then a stored procedure deduz exatamente `2.50` da coluna `stock.quantity` da linha de estoque ativa por FIFO.
2. Given que o medicamento tem unidade de concentração `'mg/ml'`, fator de conversão de `20` gotas/ml, e o protocolo tem unidade de tomada `'gotas'`,  
   When o paciente confirma a tomada de `15` gotas,  
   Then a stored procedure calcula o volume de baixa em ml como $15 \div 20 = 0.75$ ml e deduz exatamente `0.75` da coluna `stock.quantity` da linha de estoque ativa por FIFO.
3. Given que o medicamento líquido possui múltiplos lotes cadastrados em estoque com validades distintas,  
   When uma dose é confirmada e supera o volume restante do primeiro frasco ativo,  
   Then a stored procedure FIFO zera a quantidade do primeiro lote e debita o saldo restante do segundo lote de forma encadeada e atômica.

---

## Edge Cases

- **Evitar Arredondamentos e Underflow de Estoque**: Divisões matemáticas sucessivas na stored procedure (ex: dose de gotas dividida por 20) podem gerar dízimas. Toda operação matemática no banco de dados deve utilizar o tipo PostgreSQL `numeric` com arredondamento preciso para 2 casas decimais (`ROUND(..., 2)`), e uma constraint check deve impedir que `quantity` fique menor que `0` para evitar saldo negativo acidental.
- **Retrocompatibilidade de Pílulas/Comprimidos**: Se a `dosage_unit` do medicamento correspondente for sólida (ex: `'mg'`, `'g'`, `'ui'`), a stored procedure `consume_stock_fifo` deve desviar para a lógica linear legada, subtraindo o valor numérico inteiro de `quantity` de forma direta e sem divisões.

---

## Requirements

### Functional Requirements

- **FR-001**: Adicionar a coluna `drops_per_ml` (`integer`, default `20`) na tabela `public.medicines`.
- **FR-002**: Adicionar a coluna `intake_unit` (`text`, nullable) na tabela `public.protocols`.
- **FR-003**: A stored procedure `public.consume_stock_fifo` deve inferir automaticamente se o medicamento é líquido através da regra de negócio: `dosage_unit LIKE '%/ml'`.
- **FR-004**: A stored procedure deve aplicar a fórmula física de conversão baseada em `intake_unit` do protocolo e `drops_per_ml` do medicamento, deduzindo o volume em mililitros correspondente da coluna `stock.quantity` de forma atômica por FIFO.
- **FR-005**: Uma check constraint deve ser adicionada à coluna `stock.quantity` para garantir que o saldo de estoque nunca fique negativo.

### Key Entities

- **Medicine**: Tabela `medicines` enriquecida com `drops_per_ml`.
- **Protocol**: Tabela `protocols` enriquecida com `intake_unit`.
- **Stock**: Tabela `stock` atuando nativamente como mililitros (`ml`) para líquidos, onde `original_quantity` representa o volume de frasco original de compra e `quantity` o volume restante ativo.

---

## Success Criteria

- **SC-001**: A stored procedure `consume_stock_fifo` realiza baixas decimais precisas por FIFO em mililitros e em comprimidos sem nenhuma dízima ou arredondamento inconsistente.
- **SC-002**: 100% de retrocompatibilidade: queries legadas que somam a coluna `quantity` continuam a retornar o volume físico total restante perfeitamente.
- **SC-003**: 100% de cobertura de testes de integração SQL na stored procedure no Supabase local.
