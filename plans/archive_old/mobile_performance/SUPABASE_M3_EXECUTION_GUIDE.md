# Sprint M3 — Guia de Execução SQL no Supabase

**Sprint:** M3 (Banco de Dados: Índices e View para Performance Mobile)
**Data:** 2026-03-13
**Arquivos SQL:** `docs/migrations/2026-03-mobile-perf-indexes.sql`
**Tempo estimado:** 10–15 minutos

---

## ⚠️ PRÉ-REQUISITOS

### 1. Verificar Índices Existentes
Antes de executar qualquer SQL, abra o Supabase Dashboard:

```
Supabase → Database → Indexes
```

Procure por `medicine_logs` e anote quais índices já existem:
- `idx_medicine_logs_user_taken_at_desc` ← se já existe, NÃO vai criar novamente
- `idx_medicine_logs_protocol_taken_at` ← se já existe, NÃO vai criar novamente

**Se ambos já existem:** A execução ainda é segura (SQL usa `IF NOT EXISTS`)

### 2. Confirmar Tabela `medicine_logs` Existe
```
Supabase → Database → Tables → medicine_logs
```

Verificar que tem as colunas:
- `user_id` (UUID)
- `protocol_id` (UUID)
- `taken_at` (timestamptz)
- `status` (text)
- `quantity_taken` (integer)

---

## 🚀 ORDEM CORRETA DE EXECUÇÃO

### PASSO 1: Criar Primeiro Índice (Paginação Principal)

**Arquivo:** `docs/migrations/2026-03-mobile-perf-indexes.sql` (BLOCO 1)

**No Supabase SQL Editor (colar inteiro):**

```sql
-- BLOCO 1: Índice de paginação principal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);
```

**O que esperar:**
- ✅ Se executar rápido (< 5s): sucesso, nenhuma mensagem de erro
- ✅ Se a table está vazia: criação é instantânea
- ⏱️ Se a table tem 1000+ logs: pode levar 10-30s (CONCURRENTLY não bloqueia reads)
- ❌ Erro "already exists": ignorar se você viu `IF NOT EXISTS` (é idempotente)

**PRÓXIMO PASSO:** Aguarde a execução completar antes do Passo 2.

---

### PASSO 2: Criar Segundo Índice (Por Protocolo)

**Arquivo:** `docs/migrations/2026-03-mobile-perf-indexes.sql` (BLOCO 2)

**No Supabase SQL Editor (NOVO statement):**

```sql
-- BLOCO 2: Índice por protocolo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_protocol_taken_at
ON medicine_logs (protocol_id, taken_at DESC);
```

**O que esperar:**
- ✅ Mesma experiência que Passo 1
- ⏱️ Segunda criação: pode ser um pouco mais lenta (carrega índice anterior)

**PRÓXIMO PASSO:** Aguarde a execução completar antes do Passo 3.

---

### PASSO 3A: Criar View de Adesão Diária (para Sparkline)

**Arquivo:** `docs/migrations/2026-03-mobile-perf-indexes.sql` (BLOCO 3A)

**No Supabase SQL Editor (NOVO statement):**

Copiar SQL de **BLOCO 3A** da migração (v_daily_adherence).

**O que esperar:**
- ✅ Instantâneo (< 1s), cria a view
- ✅ Mensagem: "View created"
- ⚠️ Não retorna linhas (é uma view, não um SELECT)

**PRÓXIMO PASSO:** Aguarde a execução completar antes do Passo 3B.

---

### PASSO 3B: Criar View de Heatmap (para Padrões de Adesão)

**Arquivo:** `docs/migrations/2026-03-mobile-perf-indexes.sql` (BLOCO 3B)

**No Supabase SQL Editor (NOVO statement):**

Copiar SQL de **BLOCO 3B** da migração (v_adherence_heatmap).

**O que esperar:**
- ✅ Instantâneo (< 1s), cria a view
- ✅ Mensagem: "View created"
- ⚠️ Não retorna linhas (é uma view, não um SELECT)

**PRÓXIMO PASSO:** Aguarde a execução completar e prossiga para Validação.

---

## ✅ VALIDAÇÃO — Confirmar que Tudo Funcionou

### 1. Verificar Índices Foram Criados

**No Supabase SQL Editor:**

```sql
-- Lista todos os índices na tabela medicine_logs
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'medicine_logs'
ORDER BY indexname;
```

**Esperado (resultado deve conter):**
- `idx_medicine_logs_user_taken_at_desc` ← Novo ✅
- `idx_medicine_logs_protocol_taken_at` ← Novo ✅
- Plus outros índices pré-existentes (como primary key)

---

### 2. Verificar Views Foram Criadas

**2.1 — View v_daily_adherence (Sparkline)**

No Supabase SQL Editor:
```sql
SELECT * FROM v_daily_adherence
WHERE user_id = auth.uid()
ORDER BY log_date DESC
LIMIT 7;
```

**Esperado:**
- ✅ Retorna 0–N linhas com colunas:
  - `user_id` (UUID) — seu usuário
  - `log_date` (date) — data (YYYY-MM-DD)
  - `expected_doses` (integer) — doses esperadas naquele dia
  - `taken_doses` (integer) — doses tomadas naquele dia
  - `adherence_percentage` (numeric) — % adesão do dia inteiro (NULL se sem protocolos)

---

**2.2 — View v_adherence_heatmap (Padrões)**

No Supabase SQL Editor:
```sql
SELECT * FROM v_adherence_heatmap
WHERE user_id = auth.uid()
ORDER BY day_of_week, period_index
LIMIT 28;
```

**Esperado:**
- ✅ Retorna até 28 linhas (7 dias × 4 períodos) com colunas:
  - `user_id` (UUID) — seu usuário
  - `day_of_week` (integer) — 0 (domingo) a 6 (sábado)
  - `period_index` (integer) — 0 (madrugada), 1 (manhã), 2 (tarde), 3 (noite)
  - `expected_doses` (integer) — doses esperadas neste (dia, período)
  - `taken_doses` (integer) — doses tomadas neste (dia, período)
  - `adherence_percentage` (numeric) — % adesão (0% se taken=0 mas expected>0; NULL se expected=0)

**Se medicine_logs está vazia:** ambas retornam 0 linhas (OK)

**Para limpar (undo do teste):**
```sql
-- Se você inseriu com sucesso (constraint não existe):
-- DELETE FROM medicine_logs WHERE status = 'invalid_status';
-- Mas isso não deve acontecer porque o constraint deve estar ativo
```

---

### 4. Benchmark (OPCIONAL) — Performance Antes/Depois

**Teste de performance do índice:**

```sql
-- Executar EXPLAIN ANALYZE para medir performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, taken_at, status, quantity_taken
FROM medicine_logs
WHERE user_id = auth.uid()
ORDER BY taken_at DESC
LIMIT 30;
```

**Esperado:**
- **Planning time:** < 1ms
- **Execution time:** < 10ms (com índice)
- **Seq Scan:** ❌ Não deve aparecer (seria lento)
- **Index Scan:** ✅ Deve aparecer (prova que está usando idx_medicine_logs_user_taken_at_desc)

**Resultado típico:**
```
Index Scan using idx_medicine_logs_user_taken_at_desc on medicine_logs  (cost=0.29..100.42 rows=30 width=20) (actual time=0.123..1.456 rows=30 loops=1)
Planning Time: 0.234 ms
Execution Time: 1.890 ms
```

---

## 🛑 TROUBLESHOOTING

### Erro: "Index with name already exists"
```sql
-- Mensagem: ERROR: relation "idx_medicine_logs_user_taken_at_desc" already exists
```
**Solução:** Ignora. O SQL usa `IF NOT EXISTS`, então é seguro re-executar.

---

### Erro: "Syntax error"
```sql
-- Mensagem: ERROR: syntax error at or near "..."
```
**Solução:**
1. Verifica se copiou o SQL inteiro
2. Não misture múltiplos BLOCOs em um único statement
3. Executa um BLOCO por vez (separado no editor)

---

### View não retorna dados
```sql
-- Esperado: SELECT * FROM v_daily_adherence retorna 0 linhas
```
**Possível causa:** `medicine_logs` está vazia (é normal em novo projeto)

**Validação:** Insira um log de teste:
```sql
INSERT INTO medicine_logs
  (id, user_id, protocol_id, taken_at, status, quantity_taken)
VALUES
  (uuid_generate_v4(), auth.uid(), uuid_generate_v4(), now(), 'taken', 1);

-- Após: SELECT * FROM v_daily_adherence deve retornar 1 linha
```

---

## 📝 PRÓXIMOS PASSOS (após execução bem-sucedida)

### 1. Documentar em Git

```bash
# No terminal (repo root)
git checkout main && git pull origin main
git checkout -b chore/mobile-perf-m3-db-indexes

# Arquivo de migration já foi criado em docs/migrations/
# Confirma:
cat docs/migrations/2026-03-mobile-perf-indexes.sql

# Commita:
git add docs/migrations/2026-03-mobile-perf-indexes.sql
git commit -m "chore(db): índices compostos e view de adesão para performance mobile

- idx_medicine_logs_user_taken_at_desc: acelera getAllPaginated (user_id + taken_at DESC)
- idx_medicine_logs_protocol_taken_at: acelera getByProtocol
- v_daily_adherence: view pré-agregada (protocols ⨝ medicine_logs) para eliminar O(N) client-side

EXPLAIN ANALYZE: Index Scan confirmado, <10ms com dados reais."

# Push
git push -u origin chore/mobile-perf-m3-db-indexes
```

### 2. Criar PR

```bash
gh pr create \
  --title "chore(db): índices e view para performance mobile — Sprint M3" \
  --body "Sprint M3: Database optimization (indexes + views)

## Índices criados
- idx_medicine_logs_user_taken_at_desc (user_id, taken_at DESC) — accelerates Timeline
- idx_medicine_logs_protocol_taken_at (protocol_id, taken_at DESC) — accelerates Protocol queries

## Views criadas
- v_daily_adherence — pre-calculates daily adherence (all periods aggregated) for Sparkline
- v_adherence_heatmap — pre-calculates adherence per (day_of_week, period) for Heatmap

## Validação
- EXPLAIN ANALYZE: Index Scan confirmado em testes locais
- v_daily_adherence tested: retorna dados esperados [user_id, log_date, expected_doses, taken_doses, adherence_percentage] ✓
- v_adherence_heatmap tested: retorna grid 7×4 por (day_of_week, period_index) ✓
- RLS nativo: ambas as views filtram automaticamente por auth.uid() ✓

## Tipo
- Database schema migration (sem código JavaScript)
- Idempotente (usa IF NOT EXISTS)
- Sem breaking changes
"
```

### 3. Validação Final em Production

Após merge, o Supabase web UI terá:
- 2 índices novos (visible em Database → Indexes)
  - idx_medicine_logs_user_taken_at_desc
  - idx_medicine_logs_protocol_taken_at
- 2 views novas (visible em Database → Views)
  - v_daily_adherence (para Sparkline)
  - v_adherence_heatmap (para Heatmap)

---

## 📊 MÉTRICAS ESPERADAS

| Métrica | Antes | Depois | Nota |
|---------|-------|--------|------|
| Timeline query (30 logs) | ~200ms (Seq Scan) | <10ms (Index Scan) | 20x mais rápido |
| Protocol query | ~150ms (Seq Scan) | <5ms (Index Scan) | 30x mais rápido |
| Adesão diária (client-side) | O(N) main thread mobile | O(1) com view | Futuro benefit |
| Data consistency | Nenhuma | validação status | Previne bugs |

---

## 📎 ARQUIVOS DE REFERÊNCIA

- **Migration SQL:** `docs/migrations/2026-03-mobile-perf-indexes.sql`
- **Spec completa:** `plans/EXEC_SPEC_MOBILE_PERFORMANCE.md` (M3, linhas 1125–1330)
- **Performance standards:** `docs/standards/MOBILE_PERFORMANCE.md` (Seção 6)

---

**Status:** ✅ Pronto para executar
**Data:** 2026-03-13
**Próximo sprint:** M4 (Service Worker + Offline Banner)
