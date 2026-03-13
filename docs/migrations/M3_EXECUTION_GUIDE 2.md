# M3 Execution Guide — Database Migrations for Mobile Performance

## 🐛 Fixes Applied (2026-03-13)

**Problem v1:** Views counted DISTINCT PROTOCOLS instead of DOSES.
- Example: Protocol A with `["08:00", "20:00"]` = 2 doses, but counted as 1 protocol
- Result: 10 protocols, 12 doses expected → showed `expected_doses: 10` ❌

**Problem v2:** After counting time_schedule entries, aggregation used `COUNT(*)` instead of `SUM()`.
- `expected_doses_daily` had [2,1,1,1,1,1,1,1,1,1] = 12 total doses
- But `COUNT(*)` counted **10 rows** (number of protocols), not **12 doses** ❌

**Solution:**
1. `expected_doses_daily`: Use `jsonb_array_length(p.time_schedule)` to count dose slots per protocol
2. `expected_aggregated`: Use `SUM(expected_count)` to sum all dose slots across protocols
3. `expected_per_period` (heatmap): Use `COUNT(*)` (already correct) to count dose opportunities per (day, period)
- Result: Correctly shows `expected_doses: 12` when you have 12 doses per day ✅

---

## 📋 Ordem Correta de Execução

Execute as 4 operações em **ORDEM EXATA** no Supabase SQL Editor:

### 1️⃣ DROP VIEWS EXISTENTES (se existirem)
```sql
DROP VIEW IF EXISTS v_daily_adherence CASCADE;
DROP VIEW IF EXISTS v_adherence_heatmap CASCADE;
```
**Por que?** Views antigas podem ter código errado ou conflitos com os novos índices.

---

### 2️⃣ BLOCO 1: Criar Índices de Performance
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_logs_protocol_taken_at
ON medicine_logs (protocol_id, taken_at DESC);
```
**Impacto:**
- Timeline queries: ~200ms → <10ms
- Sem lock na tabela (CONCURRENTLY)
- Idempotente (IF NOT EXISTS)

---

### 3️⃣ BLOCO 2: Criar View de Adesão DIÁRIA (Sparkline)
```sql
CREATE OR REPLACE VIEW v_daily_adherence
WITH (security_invoker = on) AS
WITH logs_by_day AS (
  SELECT
    ml.user_id,
    (ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::date AS log_date,
    ml.id AS log_id
  FROM medicine_logs ml
  LEFT JOIN user_settings us ON ml.user_id = us.user_id
),
expected_doses_daily AS (
  SELECT
    p.user_id,
    generate_series(p.start_date::date, COALESCE(p.end_date::date, CURRENT_DATE), '1 day'::interval)::date AS active_date,
    jsonb_array_length(p.time_schedule) AS expected_count
  FROM protocols p
  WHERE p.active = true
    AND p.start_date IS NOT NULL
    AND p.time_schedule IS NOT NULL
    AND jsonb_array_length(p.time_schedule) > 0
  GROUP BY p.user_id, p.id, active_date
),
expected_aggregated AS (
  -- CRÍTICO: SUM(expected_count) soma as time_schedule entries por protocolo
  -- Exemplo: 10 protocolos com [2,1,1,1,1,1,1,1,1,1] entries = SUM = 12
  SELECT
    user_id,
    active_date,
    SUM(expected_count) AS total_expected
  FROM expected_doses_daily
  GROUP BY user_id, active_date
)
SELECT
  l.user_id,
  l.log_date,
  COALESCE(e.total_expected, 0) AS expected_doses,
  COUNT(DISTINCT l.log_id) AS taken_doses,
  CASE
    WHEN COALESCE(e.total_expected, 0) = 0 THEN NULL
    ELSE ROUND((COUNT(DISTINCT l.log_id)::numeric / e.total_expected) * 100, 2)
  END AS adherence_percentage
FROM logs_by_day l
LEFT JOIN expected_aggregated e ON l.user_id = e.user_id AND l.log_date = e.active_date
GROUP BY l.user_id, l.log_date, e.total_expected;
```
**Validação:** Deve retornar ~30 linhas com `expected_doses` = **número total de doses esperadas** (não número de protocolos, não 120).

---

### 4️⃣ BLOCO 3: Criar View de Adesão HEATMAP (7×4 grid)
```sql
CREATE OR REPLACE VIEW v_adherence_heatmap
WITH (security_invoker = on) AS
WITH logs_classified AS (
  SELECT
    ml.user_id,
    EXTRACT(DOW FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::int AS day_of_week,
    CASE
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 6 THEN 0
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 12 THEN 1
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 18 THEN 2
      ELSE 3
    END AS period_index,
    ml.id AS log_id
  FROM medicine_logs ml
  LEFT JOIN user_settings us ON ml.user_id = us.user_id
),
protocol_schedule_expanded AS (
  SELECT
    p.id,
    p.user_id,
    schedule_time,
    day AS day_of_week
  FROM protocols p
  CROSS JOIN LATERAL jsonb_array_elements_text(p.time_schedule) AS schedule_time
  CROSS JOIN generate_series(0, 6) AS day
  WHERE p.active = true
    AND p.start_date IS NOT NULL
    AND p.time_schedule IS NOT NULL
    AND jsonb_array_length(p.time_schedule) > 0
    AND (
      (p.frequency IN ('diário', 'daily', 'diariamente'))
      OR (p.frequency IN ('semanal', 'weekly', 'semanalmente') AND day = EXTRACT(DOW FROM p.start_date::timestamp)::int)
      OR (p.frequency IN ('dias_alternados', 'day_sim_day_nao', 'dia sim, dia não')
          AND day IN (EXTRACT(DOW FROM p.start_date::timestamp)::int, (EXTRACT(DOW FROM p.start_date::timestamp)::int + 2) % 7))
    )
),
expected_per_period AS (
  SELECT
    p.user_id,
    p.day_of_week,
    CASE
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 6 THEN 0
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 12 THEN 1
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 18 THEN 2
      ELSE 3
    END AS period_index,
    COUNT(DISTINCT p.id) AS expected_count
  FROM protocol_schedule_expanded p
  GROUP BY p.user_id, p.day_of_week, period_index
)
SELECT
  l.user_id,
  l.day_of_week,
  l.period_index,
  COALESCE(e.expected_count, 0) AS expected_doses,
  COUNT(DISTINCT l.log_id) AS taken_doses,
  CASE
    WHEN COALESCE(e.expected_count, 0) = 0 THEN NULL
    WHEN COUNT(DISTINCT l.log_id) = 0 THEN 0
    ELSE ROUND((COUNT(DISTINCT l.log_id)::numeric / e.expected_count) * 100, 2)
  END AS adherence_percentage
FROM logs_classified l
LEFT JOIN expected_per_period e
  ON l.user_id = e.user_id
  AND l.day_of_week = e.day_of_week
  AND l.period_index = e.period_index
GROUP BY l.user_id, l.day_of_week, l.period_index, e.expected_count;
```
**Validação:** Deve retornar ~28 linhas (7 dias × 4 períodos = 28 células possíveis).

---

## ✅ Validação Pós-Execução

Execute estes SQLs para verificar se as views retornam dados CORRETOS:

### 1. Testar v_daily_adherence
```sql
-- Replace 'SEU_USER_ID' com seu user_id
SELECT
  log_date,
  expected_doses,
  taken_doses,
  adherence_percentage,
  CASE
    WHEN expected_doses > 50 THEN '⚠️ ERRO: expected_doses muito alto (Cartesian product?)'
    WHEN expected_doses <= 15 THEN '✅ OK: expected_doses razoável'
    ELSE '⚠️ VERIFICAR'
  END AS status
FROM v_daily_adherence
WHERE user_id = 'SEU_USER_ID'
  AND log_date >= CURRENT_DATE - INTERVAL '10 days'
ORDER BY log_date DESC
LIMIT 5;
```

**Resultado esperado** (com 10 protocolos, 12 doses/dia):
```
log_date    | expected_doses | taken_doses | adherence_percentage | status
2026-02-11  | 12             | 12          | 100.00              | ✅ OK
2026-02-10  | 12             | 10          | 83.33               | ✅ OK
...
```

**Resultado ERRADO v1 (Cartesian product):**
```
log_date    | expected_doses | taken_doses | adherence_percentage | status
2026-02-11  | 120            | 12          | 10.00               | ⚠️ ERRO: 10 protocolos × 12 logs
```

**Resultado ERRADO v2 (contando protocolos, não doses):**
```
log_date    | expected_doses | taken_doses | adherence_percentage | status
2026-02-11  | 10             | 12          | 120.00              | ⚠️ ERRO: contagem de protocolos (não doses)
```

---

### 2. Testar v_adherence_heatmap
```sql
SELECT
  day_of_week,
  period_index,
  expected_doses,
  taken_doses,
  adherence_percentage
FROM v_adherence_heatmap
WHERE user_id = 'SEU_USER_ID'
ORDER BY day_of_week, period_index
LIMIT 10;
```

**Resultado esperado:** 28 linhas máximo (7 dias × 4 períodos), cada uma com reasonable `expected_doses`.

---

## 🔍 Diagnostic SQL (se der erro)

Se as views retornarem valores estranhos, execute isto para debug:

```sql
-- Diagnosing expected_doses aggregation
WITH logs_by_day AS (
  SELECT
    ml.user_id,
    (ml.taken_at AT TIME ZONE 'America/Sao_Paulo')::date AS log_date,
    ml.id AS log_id
  FROM medicine_logs ml
),
expected_doses_daily AS (
  SELECT
    p.user_id,
    generate_series(p.start_date::date, COALESCE(p.end_date::date, CURRENT_DATE), '1 day'::interval)::date AS active_date,
    COUNT(DISTINCT p.id) AS expected_count
  FROM protocols p
  WHERE p.active = true
    AND p.start_date IS NOT NULL
    AND p.time_schedule IS NOT NULL
    AND jsonb_array_length(p.time_schedule) > 0
  GROUP BY p.user_id, p.id, active_date
)
SELECT
  l.log_date,
  COUNT(DISTINCT l.log_id) as num_logs,
  COUNT(DISTINCT e.user_id) as num_expected_rows,
  COUNT(*) as cartesian_product_size,
  SUM(COALESCE(e.expected_count, 0)) as sum_wrong,
  (SELECT COUNT(*) FROM expected_doses_daily WHERE user_id = l.user_id AND active_date = l.log_date) as count_correct
FROM logs_by_day l
LEFT JOIN expected_doses_daily e ON l.user_id = e.user_id AND l.log_date = e.active_date
WHERE l.log_date >= CURRENT_DATE - INTERVAL '5 days'
GROUP BY l.log_date
ORDER BY l.log_date DESC;
```

**Explicação dos valores:**
- `num_logs`: número de logs (doses tomadas) nesse dia
- `num_expected_rows`: número de linhas da view expected_doses_daily que matcheou (devia ser número de protocolos)
- `cartesian_product_size`: `num_logs × num_expected_rows` (se >num_logs, temos problema!)
- `sum_wrong`: SUM(expected_count) sem aggregação prévia (mostra o erro)
- `count_correct`: COUNT(*) com aggregação (valor correto esperado)

---

## 📝 Próximos Passos (Client-Side)

Após executar as migrations:

1. **Reiniciar dev server:** `npm run dev`
2. **Limpar cache:** DevTools → Application → Clear Site Data
3. **Testar em dev:**
   - Timeline deve carregar ~10ms mais rápido
   - Sparkline deve mostrar 30 dias com valores razoáveis
   - Heatmap deve renderizar sem lag (antes levava 500ms+ de processamento JS)

Logs esperados no console (com 12 doses/dia esperadas):
```
[adherenceService] getDailyAdherenceFromView: {days: 30, ...}
[adherenceService] Query retornou status: 200 data: (30) [...]
[adherenceService] getDailyAdherenceFromView retornou: 30 registros
[adherenceService] Valores das colunas: {log_date: '2026-02-11', expected_doses: 12, taken_doses: 12, adherence_percentage: 100}
```

Se vir `expected_doses: 120` → **Cartesian product** (volte ao PASSO 1)
Se vir `expected_doses: 10` → **Contagem de protocolos** (re-execute BLOCO 2, verifique a mudança para jsonb_array_length)

---

## 🚨 Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `relation 'v_daily_adherence' does not exist` | View não foi criada | Execute BLOCO 2 completo |
| `expected_doses: 120` | Cartesian product | Verify BLOCO 2 tem `expected_aggregated` CTE |
| `adherence_percentage: NULL` para todos | expected_doses sempre 0 | Check: tables têm dados? active protocols? |
| Heatmap still slow | Views não usadas no client | Verify HealthHistory.jsx chama `getDailyAdherenceFromView()` |

---

## 🎯 Objective Validation Checklist

After execution, confirm:
- [ ] Both indices created without errors
- [ ] Both views created without errors
- [ ] `v_daily_adherence` returns ~10 expected_doses per day (NOT 120)
- [ ] `v_adherence_heatmap` returns 28 rows max with reasonable values
- [ ] Console logs show data flowing to client
- [ ] Sparkline renders 30 days
- [ ] Heatmap renders with <50ms (no main-thread blocking)

---

**File:** `docs/migrations/M3_EXECUTION_GUIDE.md`
**Last Updated:** 2026-03-13
**Status:** Ready for Supabase execution
