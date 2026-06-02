# Feature Specification: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`  
**Created**: 2026-06-01  
**Status**: Spec Draft (Wave M2)  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Context

Com a fundação de banco de dados modelada e pronta, a camada de **Core, Validações e APIs do Dosiq** precisa ser adaptada para suportar decimais, validar coeficientes e gerenciar a lógica de escrita do inventário de líquidos.

As principais responsabilidades desta especificação atômica de middle-tier são:
1. **Validadores Zod Flexíveis**: Adaptar os schemas Zod de medicamentos e protocolos para aceitar dosagens decimais precisas, flexibilizar limites herdados (ex: permitir até `1000 gotas` ou `100 ml` de dose em líquidos, contra o teto de 100 comprimidos herdado de R-022) e exigir as propriedades do líquido com segurança.
2. **Lógica de Desmembramento de Compras de Estoque**: Quando o usuário lança uma compra contendo múltiplos frascos (ex: 2 frascos de 50 ml), o serviço de estoque (`stockService`) deve desmembrar essa transação de forma transparente e realizar o insert de 2 linhas independentes na tabela `stock` no Supabase, garantindo que o FIFO do banco funcione frasco por frasco.
3. **Formatadores Universais de Dosagem**: Fornecer helpers unificados no core (`formatDose`) que decodifiquem e renderizem a dose de forma amigável para gotas, ml ou UI em todas as telas (Web, Mobile) e no Bot do Telegram.

---

## User Scenarios & Testing

### User Story 1 — Validação Zod Inteligente (Priority: P1)
**Why this priority**: Evitar que cadastros inválidos ou incompletos de líquidos entrem no banco e permitir dosagens decimais contínuas válidas.  
**Independent Test**: Tentar submeter o cadastro de um medicamento líquido (ex: dipirona `mg/ml`) sem informar as gotas por ml e verificar se o schema Zod rejeita e exige os coeficientes. Validar também que doses decimais (ex: `2.5` ml) passam na validação do protocolo.

**Acceptance Scenarios**:
1. Given que o usuário cadastra um medicamento com a unidade `'mg/ml'` ou `'ui/ml'`,  
   When o schema Zod `medicineSchema` valida o payload,  
   Then ele exige a presença de `drops_per_ml` (inteiro, default 20).
2. Given que o usuário cadastra um protocolo associado a um medicamento líquido,  
   When a dosagem é informada em decimal (ex: `2.50` ml) com unidade de tomada `'ml'` ou `'gotas'`,  
   Then o schema Zod `protocolSchema` valida e aceita a dosagem sem aplicar o limite legado de 100 unidades inteiras.

---

### User Story 2 — Desmembramento Transacional de Estoque e Cálculo de Custo por mL (Priority: P1)
**Why this priority**: Oferecer uma UX de cadastro de múltiplos frascos e preço total do frasco em tela única, convertendo de forma silenciosa para custo por ml a fim de alimentar os rollup de custo mensal de forma perfeita.  
**Independent Test**: Chamar o serviço de estoque (`stockService.createPurchase`) simulando a compra de `2 frascos de 50 ml` pelo valor total de `R$ 50,00`. Verificar que foram disparados dois inserts separados e isolados para a tabela `stock` com `original_quantity = 50.00`, `quantity = 50.00` e o custo unitário por ml `unit_price = 0.50` (calculado como $50 \div 2 \div 50$).

**Acceptance Scenarios**:
1. Given que o usuário insere uma compra de `3 frascos` de `100 ml` cada por R$ 30,00 no total,  
   When o `stockService` processa o payload,  
   Then o custo unitário por ml de cada frasco é calculado como $(30 \div 3) \div 100 = 0.10$ reais, e o sistema insere 3 linhas independentes de estoque com `original_quantity = 100.00`, `quantity = 100.00` e `unit_price = 0.10`.

---

### User Story 3 — Formatação de Dosagem Premium (Priority: P2)
**Why this priority**: Exibir as tomadas e doses de forma elegante, legível e na unidade real receitada para o paciente.  
**Independent Test**: Executar o helper `formatDose` passando os parâmetros de gotas, ml e UI e verificar se a string retornada é renderizada com a respectiva unidade em português.

**Acceptance Scenarios**:
1. Given que a dose é `15` e a unidade de tomada é `'gotas'`,  
   When o helper `formatDose` renderiza a tomada,  
   Then o texto retornado deve ser exatamente `"15 gotas"`.
2. Given que a dose é `2.5` e a unidade de tomada é `'ml'`,  
   When o helper `formatDose` renderiza a tomada,  
   Then o texto retornado deve ser exatamente `"2,5 ml"` (com vírgula decimal para português brasileiro).

---

## Edge Cases

- **Divisão de Centavos de Preço Unitário por mL**: Se o usuário comprar 3 frascos por um valor total ímpar (ex: R$ 10,00) de 100 ml cada, a divisão do custo unitário por frasco ($10 \div 3 = 3.3333...$) pode gerar imprecisões no preço por ml ($3.33 \div 100 = 0.0333...$). O serviço deve calcular o custo por frasco com precisão centava aplicando arredondamento por frasco, definir o custo unitário por ml como `ROUND(custo_frasco / volume, 4)` e aplicar a compensação de centavos restante no preço total da última linha de estoque criada.

---

## Requirements

### Functional Requirements

- **FR-001**: Sincronizar os validadores do Zod no core (`src/schemas/medicineSchema.js` e `protocolSchema.js`) para aceitar valores decimais nas dosagens e validar coeficientes.
- **FR-002**: O serviço `stockService.js` deve implementar a lógica de desmembramento transacional, convertendo a entrada `"N frascos de X ml"` e preço de compra total em N inserts individuais na tabela `stock` do Supabase.
- **FR-003**: A API do core deve converter o valor financeiro do frasco para custo unitário por ml antes de persistir em `stock.unit_price`, garantindo consistência com o motor de custos de tratamentos mensais.
- **FR-004**: Implementar o helper de formatação `formatDose` em `packages/core/src/utils/doseUnit.js` com suporte a representações em português brasileiro.
- **FR-005**: Garantir que as APIs de listagem e leitura de saldo em estoque calculem de forma transparente as frações de frascos remanescentes através da conta $\frac{quantity}{original\_quantity}$ para cada linha individual antes de retornar à UI.

### Key Entities

- **Core Validations**: Schemas Zod de Medicines e Protocols atualizados.
- **Stock Service API**: O orchestrator de compras, desmembramento e conversão de custo em ml no middle-tier.
- **Helper formatDose**: Centralizador de formatação de string de tomada.


---

## Success Criteria

- **SC-001**: O Zod valida cadastros decimais e bloqueia líquidos com coeficientes incompletos com taxa de erro zero.
- **SC-002**: A API do core insere múltiplas linhas de frascos em lote com consistência atômica no Supabase.
- **SC-003**: 100% de cobertura de testes unitários no helper `formatDose` e no serviço de desmembramento `stockService`.
