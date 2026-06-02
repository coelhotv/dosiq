# Tasks: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`  
**Input**: `spec.md`, `plan.md`  
**Status**: Spec Draft (Wave M2)  

---

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Verificar o estado e a saúde do projeto `"kwqjtdsqkkbebfiaxubb"` no Supabase através das ferramentas MCP e certificar-se da integridade das tabelas `medicines`, `protocols`, `stock` e `medicine_logs`.

---

## Phase 2: Implementation (SQL & Migrations)

- [ ] T002 [US1] Criar o arquivo de migração `/docs/migrations/20260601_liquid_meds_db.sql` contendo os comandos `ALTER TABLE` para as tabelas `medicines` e `protocols`, adicionando a check constraint de integridade de saldo na tabela `stock`.
- [ ] T003 [US2] Adicionar no script de migração a stored procedure `consume_stock_fifo` reescrita com suporte atômico ao FIFO de volumes decimais para líquidos e desvio linear para sólidos.
- [ ] T004 [US2] Aplicar a migração no banco de dados local/teste e homologação Supabase utilizando a ferramenta `apply_migration` ou `execute_sql`.

---

## Phase 3: Validation (Quality Gates)

- [ ] T005 [C4] Criar um script SQL de teste para executar simulações de tomada no banco de dados, validando que tomadas decimais em `ml` e gotas (`gotas`) reduzem de forma correta e sem arredondamentos imperfeitos o estoque do lote ativo.
- [ ] T006 [C4] Validar que o comportamento de tomada para comprimidos sólidos legados continua operando perfeitamente e sem qualquer quebra de fluxo.
- [ ] T007 [C4] Rodar `rtk npm run validate:agent` na raiz do Dosiq para atestar que o backend e os testes críticos continuam estáveis e com linter zero.

---

## Phase 4: DEVFLOW Record

- [ ] T008 [C5] Realizar o checkpoint SQP (R-221) e atualizar os índices do DEVFLOW.
- [ ] T009 [C5] Submeter as alterações físicas de banco em PR para revisão do Gemini e aprovação final do operador humano ("Never self-merge" R-060).
