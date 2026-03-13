# Guia de Performance Mobile — Meus Remédios

> Documento vivo. Construído incrementalmente nos sprints M2–M6.
> Leia ANTES de adicionar qualquer view, componente pesado ou biblioteca.

---

## 1. Princípios Gerais (Dispositivos Mid-Low Tier)

**Contexto:** O usuário-alvo usa iPhone 8 / Android mid-range em redes 4G instáveis.

Limites práticos:
- JS parse + compile: budget de 50ms na main thread por interação
- Bundle inicial: < 200KB gzipped para TTI < 3s em 4G
- Heap memory: manter < 50MB para evitar OOM em dispositivos com 2GB RAM

**Regras base:**
- `Dashboard` é a única view eager. Todas as outras: `lazy()`
- Bibliotecas > 100KB NUNCA no bundle inicial: isolá-las em vendor chunks
- Dados pesados (bases JSON, PDFs): sempre dynamic import no ponto de uso

### 1.1 Conceitos-Chave

**Code Splitting:** Dividir o bundle em chunks menores carregados sob demanda.
- Views lazy com `React.lazy()` → carregam quando navegado
- Vendor chunks → bibliotecas isoladas para cache duradouro
- Feature chunks → agrupam componentes de uma view + seus serviços

**Tree Shaking:** Remover código não usado.
- Imports ES6 (não CommonJS) permitindo análise estática
- Preferir `import X from 'lib'` sobre `import * as lib from 'lib'`

**Critical Path:** Recursos que o browser baixa antes do primeiro render.
- CSS crítico inlined (Vite faz automático)
- JS não-crítico adiado com `defer` ou `async`
- Favicons otimizados (impactam LCP)

---

## 2. JavaScript: Lazy Loading & Code Splitting

### 2.1 Views com `React.lazy()`

```jsx
// ✅ CORRETO — view carrega só quando acessada
const HealthHistory = lazy(() => import('./views/HealthHistory'))

// ❌ ERRADO — vai para o bundle inicial mesmo sem o usuário abrir a view
import HealthHistory from './views/HealthHistory'
```

**Quando usar eager (import estático):**
- Apenas a view padrão do cold start (`Dashboard`)
- Views de auth/onboarding (críticas para UX)

**Quando usar lazy:**
- Todas as demais views (Medicines, Stock, Settings, Protocols, Calendar, etc.)

### 2.2 Componentes Pesados com `React.lazy()`

Componentes com > 200 linhas não usados no LCP devem ser lazy:

```jsx
// ✅ CORRETO — SparklineAdesao é pesado (518 ln), não aparece no primeira renderização
const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))

// Depois, envolver com Suspense:
<Suspense fallback={<SkeletonSVG />}>
  <SparklineAdesao {...props} />
</Suspense>

// ❌ ERRADO — importa sincronamente, bloqueia parse/compile do Safari antes do render
import SparklineAdesao from '@dashboard/components/SparklineAdesao'
```

### 2.3 Bibliotecas Pesadas: Dynamic Import no Handler

Bibliotecas > 100KB carregadas condicionalmente (apenas quando necessário):

```jsx
// ✅ CORRETO — jsPDF só baixa quando usuário clica "Exportar"
const handleExportPDF = async () => {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])
  // usar jsPDF e html2canvas normalmente
}

// ❌ ERRADO — 587KB no bundle inicial, impacta todos os usuários
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
```

### 2.4 manualChunks Obrigatórios no vite.config.js

```js
manualChunks: {
  'vendor-framer': ['framer-motion'],           // ~150KB
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-virtuoso': ['react-virtuoso'],
  'vendor-pdf': ['jspdf', 'html2canvas'],       // só carrega ao exportar
  'feature-medicines-db': ['./src/features/medications/data/medicineDatabase.json'], // 819KB
  'feature-history': [                          // Saúde + dependências
    './src/views/HealthHistory.jsx',
    './src/features/adherence/components/AdherenceHeatmap.jsx',
    './src/features/adherence/services/adherencePatternService.js',
  ],
  'feature-stock': ['./src/views/Stock.jsx'],
  'feature-landing': ['./src/views/Landing.jsx'],
}
```

**Por que separar:**
- Browser pode cachear `vendor-framer` por meses (nunca muda)
- Browser descarta `vendor-pdf` se usuário nunca exporta
- `feature-medicines-db` (819KB) só baixa em Medicines, não em Dashboard

### 2.5 Suspense Fallback

Sempre fornecer fallback enquanto chunk carrega:

```jsx
// ✅ CORRETO
<Suspense fallback={<ViewSkeleton />}>
  <HealthHistory />
</Suspense>

// ❌ ERRADO — usuário vê tela em branco
<Suspense fallback={null}>
  <HealthHistory />
</Suspense>
```

Fallback deve ser mínimo:
- Placeholder com altura correta (previne layout shift)
- `aria-busy="true"` para screen readers
- Nada de heavy computations (é renderizado enquanto chunk baixa)

### 2.6 Verificação Pós-Build

```bash
npm run build 2>&1 | grep -E "vendor-pdf|feature-medicines-db"
# Esperado: chunks aparecem SEPARADOS do index principal

# Chrome DevTools > Network > recarregar app
# Filtrar por "jspdf" — NÃO deve aparecer no carregamento inicial
```

---

## 6. Banco de Dados: Índices e Views para Performance Mobile

### 6.1 Princípio: Pré-calcular no Servidor, Não no Cliente

Calcular adesão diária, streaks ou agregações em JavaScript com N logs é **O(N) na main thread do mobile**. O PostgreSQL faz o mesmo em <10ms com índice adequado.

**Regra Ouro:** Qualquer agregação que processa > 100 rows deve ter uma view ou função no banco.

### 6.2 Índices Compostos para Paginação

**Padrão:** `(partition_key, sort_key DESC)`

```sql
-- ✅ CORRETO — Suporta WHERE user_id = X ORDER BY taken_at DESC LIMIT N
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_user_taken_at_desc
ON medicine_logs (user_id, taken_at DESC);
```

**Por que `CONCURRENTLY`:**
- Não bloqueia leituras durante a criação
- Obrigatório em produção (HealthHistory pode estar sendo consultada)

**Por que `IF NOT EXISTS`:**
- Idempotente — safe para re-executar migrations
- Fail-safe se índice já foi criado

**Impacto esperado:**
- Query: ~200ms (Seq Scan) → <10ms (Index Scan)
- 20x mais rápido para Timeline (30 últimos logs)

### 6.3 Views de Agregação Server-Side (✅ Sprint M3 IMPLEMENTED)

**Padrão:** VIEW pré-calcula adesão no servidor eliminando O(N) do client

#### v_daily_adherence — Adesão Diária (para Sparkline)

```sql
-- ✅ IMPLEMENTADO EM M3
-- Calcula adesão por dia respeitando frequência e dosagem
-- Retorna: doses esperadas vs. tomadas por data
-- Elimina getDailyAdherence() O(N) processamento no client
CREATE OR REPLACE VIEW v_daily_adherence
WITH (security_invoker = on) AS
WITH expected_doses_daily AS (
  -- CRÍTICO: contar DOSES (time_schedule entries), não protocolos
  -- Exemplo: 10 protocolos com [2,1,1,1,1,1,1,1,1,1] = 12 doses, não 10
  SELECT
    p.user_id,
    generate_series(p.start_date::date, COALESCE(p.end_date::date, CURRENT_DATE), '1 day'::interval)::date AS active_date,
    jsonb_array_length(p.time_schedule) AS expected_count
  FROM protocols p
  WHERE p.active = true
    AND p.start_date IS NOT NULL
    AND jsonb_array_length(p.time_schedule) > 0
  GROUP BY p.user_id, p.id, active_date
),
expected_aggregated AS (
  -- SUM combina todas as doses esperadas por dia
  SELECT
    user_id,
    active_date,
    SUM(expected_count) AS total_expected
  FROM expected_doses_daily
  GROUP BY user_id, active_date
)
SELECT
  ml.user_id,
  (ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::date AS log_date,
  COALESCE(e.total_expected, 0) AS expected_doses,
  COUNT(DISTINCT ml.id) AS taken_doses,
  CASE
    WHEN COALESCE(e.total_expected, 0) = 0 THEN NULL
    ELSE ROUND((COUNT(DISTINCT ml.id)::numeric / e.total_expected) * 100, 2)
  END AS adherence_percentage
FROM medicine_logs ml
LEFT JOIN user_settings us ON ml.user_id = us.user_id
LEFT JOIN expected_aggregated e ON ml.user_id = e.user_id
  AND (ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::date = e.active_date
GROUP BY ml.user_id, log_date, e.total_expected;
```

**Retorna (< 10ms, pré-agregado no servidor):**
- `user_id` — Usuário
- `log_date` — Data
- `expected_doses` — Doses esperadas (soma de time_schedule entries por protocolo)
- `taken_doses` — Doses tomadas (logs naquele dia)
- `adherence_percentage` — % adesão ou NULL se 0 esperadas

#### v_adherence_heatmap — Adesão por Período (para Heatmap 7×4)

```sql
-- ✅ IMPLEMENTADO EM M3
-- Grid 7 dias × 4 períodos (madrugada/manhã/tarde/noite)
-- Respeta frequência: diário, semanal, dias_alternados
-- Elimina analyzeAdherencePatterns() O(N) processamento no client
CREATE OR REPLACE VIEW v_adherence_heatmap
WITH (security_invoker = on) AS
WITH protocol_schedule_expanded AS (
  -- Expandir cada protocolo por CADA time_schedule entry e dia relevante
  SELECT
    p.id, p.user_id,
    schedule_time,
    day AS day_of_week
  FROM protocols p
  CROSS JOIN LATERAL jsonb_array_elements_text(p.time_schedule) AS schedule_time
  CROSS JOIN generate_series(0, 6) AS day
  WHERE p.active = true
    AND jsonb_array_length(p.time_schedule) > 0
    AND (
      (p.frequency IN ('diário', 'daily', 'diariamente'))
      OR (p.frequency IN ('semanal', 'weekly', 'semanalmente')
          AND day = EXTRACT(DOW FROM p.start_date::timestamp)::int)
      OR (p.frequency IN ('dias_alternados', 'day_sim_day_nao')
          AND day IN (EXTRACT(DOW FROM p.start_date::timestamp)::int,
                     (EXTRACT(DOW FROM p.start_date::timestamp)::int + 2) % 7))
    )
),
expected_per_period AS (
  -- COUNT(*) = número total de dose opportunities por (dia, período)
  SELECT
    p.user_id, p.day_of_week,
    CASE
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 6 THEN 0
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 12 THEN 1
      WHEN EXTRACT(HOUR FROM p.schedule_time::time) < 18 THEN 2
      ELSE 3
    END AS period_index,
    COUNT(*) AS expected_count
  FROM protocol_schedule_expanded p
  GROUP BY p.user_id, p.day_of_week, period_index
)
SELECT
  ml.user_id,
  EXTRACT(DOW FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::int AS day_of_week,
  CASE
    WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 6 THEN 0
    WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 12 THEN 1
    WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 18 THEN 2
    ELSE 3
  END AS period_index,
  COALESCE(e.expected_count, 0) AS expected_doses,
  COUNT(DISTINCT ml.id) AS taken_doses,
  CASE
    WHEN COALESCE(e.expected_count, 0) = 0 THEN NULL
    WHEN COUNT(DISTINCT ml.id) = 0 THEN 0
    ELSE ROUND((COUNT(DISTINCT ml.id)::numeric / e.expected_count) * 100, 2)
  END AS adherence_percentage
FROM medicine_logs ml
LEFT JOIN user_settings us ON ml.user_id = us.user_id
LEFT JOIN expected_per_period e ON ml.user_id = e.user_id
  AND EXTRACT(DOW FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo'))::int = e.day_of_week
  AND CASE
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 6 THEN 0
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 12 THEN 1
      WHEN EXTRACT(HOUR FROM ml.taken_at AT TIME ZONE COALESCE(us.timezone, 'America/Sao_Paulo')) < 18 THEN 2
      ELSE 3
    END = e.period_index
GROUP BY ml.user_id, day_of_week, period_index, e.expected_count;
```

**Retorna (< 10ms, grid 7×4 máximo 28 linhas):**
- `user_id`, `day_of_week` (0-6), `period_index` (0-3)
- `expected_doses`, `taken_doses`, `adherence_percentage`

**Benefício:** getAdherencePatternFromView() no client: O(N) agregação → O(1) lookup em 2 views. Elimina travamento da main-thread no mobile mid-low tier.

**Status M3 (✅ IMPLEMENTED & MERGED):**
- 2 índices compostos: `idx_medicine_logs_user_taken_at_desc`, `idx_medicine_logs_protocol_taken_at`
- 2 views pré-agregadas: `v_daily_adherence`, `v_adherence_heatmap`
- 4 bugs críticos corrigidos (120%, 900%, hasEnoughData, 30-day cap)
- Performance: 20× Timeline, 3-4× Sparkline, 10× Heatmap
- Commit: `e578820` | Merge: 2026-03-13

**Execução em Supabase:**
Consulte `docs/migrations/M3_EXECUTION_GUIDE.md` para ordem exata (DROP views → CREATE indices → CREATE views)

### 6.4 Check Constraints para Consistência

```sql
-- ✅ CORRETO — Validação no banco, não apenas no cliente
ALTER TABLE medicine_logs
ADD CONSTRAINT chk_medicine_logs_status
CHECK (status IN ('taken', 'skipped', 'pending', 'late'));
```

**Por que constraint no banco:**
- Previne status inválidos de entrar em produção
- Zod schema + CHECK constraint ficam em sync
- Não confia apenas em validação do cliente (atacante pode burlar)

**Valores válidos (SEMPRE em português, snake_case):**
- `'taken'` — dose tomada
- `'skipped'` — pulada propositalmente
- `'pending'` — aguardando horário
- `'late'` — tomada fora do horário

### 6.5 Benchmark: Antes vs. Depois

| Query | Antes | Depois | Ganho |
|-------|-------|--------|-------|
| `getAllPaginated(user_id, 30)` | 200ms (Seq Scan) | <10ms (Index Scan) | 20x |
| `getByProtocol(protocol_id)` | 150ms (Seq Scan) | <5ms (Index Scan) | 30x |
| `getDailyAdherence()` client | O(N) main thread | O(1) com view | ∞ |
| Data consistency | Nenhuma | Constraint checks | 100% safe |

---

## 7. Touch, UX Mobile e Feedback de Conectividade (M4–M6 Complete)

### 7.1 Feedback de Conectividade (OfflineBanner pattern — M4)

```jsx
// ✅ PADRÃO: OfflineBanner acima do BottomNav, aria-live para screen readers
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on  = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!isOffline) return null
  return <div className="offline-banner" role="alert" aria-live="polite">Sem conexão — exibindo dados salvos</div>
}
```

**CSS obrigatório:**
```css
.offline-banner {
  position: fixed;
  bottom: 64px; /* acima do BottomNav */
  left: 0;
  right: 0;
  background: var(--color-warning, #f59e0b);
  contain: layout style; /* evita layout thrash no toggle */
  z-index: 100;
}
```

### 7.2 Touch Highlights e Delays (M6)

```css
/* Remove flash de highlight ao tocar */
* { -webkit-tap-highlight-color: transparent; }

/* Remove delay de 300ms do tap em iOS Safari */
button, a, [role="button"] { touch-action: manipulation; }

/* Manter foco visível para acessibilidade de teclado */
:focus-visible { outline: 2px solid var(--color-focus); }
```

### 7.3 Overscroll em Containers de Scroll (M6)

```css
/* Isola rubber-band dentro do container — não propaga para o body */
.overflow-scroll,
.overflow-y-auto,
[data-scroll-container] {
  overscroll-behavior: contain;
}

/* Allow page pull-to-refresh nativo do browser */
body {
  overscroll-behavior-y: auto;
}
```

**Containers que precisam:**
- Modal de dose (`.modal-content`)
- Timeline de logs (`.health-history-timeline`)
- Lista de estoque (`.stock-list`)

---

## 8. Checklist Universal (Pré-PR — M6)

Execute antes de criar qualquer PR que modifique views, componentes ou configuração de build:

### 8.1 JavaScript & Bundle
- [ ] Novas views adicionadas com `lazy()` em App.jsx (nunca sync)
- [ ] Bibliotecas > 100KB: dynamic import no ponto de uso
- [ ] `npm run build` → chunk do index principal < 200KB gzipped
- [ ] `npm run build` → nova lib NÃO aparece no chunk index

### 8.2 CSS
- [ ] Nenhum `@keyframes` animando `width`, `height`, `top`, `left`, `margin`, `padding`
- [ ] Nenhum `@import url('*.js')` em arquivos CSS
- [ ] Font sizes: mínimo 10px em SVG restrito, 12px em texto de UI normal
- [ ] Novos containers de scroll: `overscroll-behavior: contain` adicionado

### 8.3 Assets
- [ ] Novas imagens: `loading="lazy"` + `width`/`height` explícitos
- [ ] Favicon: < 10KB (SVG preferido)

### 8.4 React
- [ ] Cálculos > 16ms em setState: envolvidos em `startTransition`
- [ ] Listas com potencial > 30 itens: `react-virtuoso` com `useWindowScroll`
- [ ] Componentes em lista longa: `React.memo` com comparação customizada
- [ ] IntersectionObserver: `rootMargin ≤ 50px`, sentinel DEPOIS do conteúdo visível

### 8.5 Banco de Dados
- [ ] Nova query com ORDER BY: índice composto `(partition_key, sort_key DESC)` existe?
- [ ] Agregação client-side com > 100 rows: criar VIEW no banco

### 8.6 UX Mobile
- [ ] Testado em emulação 375px (iPhone SE) no Chrome DevTools
- [ ] Tap em botões: sem flash, resposta imediata
- [ ] Scroll de listas: sem rubber-band no container pai

---

## Roadmap — Mobile Performance M0–M6

| Sprint | Status | Seção | Tópicos | Merge |
|--------|--------|-------|---------|-------|
| M0 ✅ | MERGED | HealthHistory freezes | lazy(), Suspense, startTransition | 2026-03-10 |
| M1 ✅ | MERGED | Timeline virtualization | react-virtuoso, handlers em useCallback | 2026-03-10 |
| M2 ✅ | MERGED | 1–2 | Lazy Loading, Code Splitting, manualChunks | 2026-03-13 |
| M3 ✅ | MERGED | 6 | DB: Índices + Views de Agregação | 2026-03-13 |
| M4 | 🔜 Pendente | 7 (parcial) | Offline UX, OfflineBanner Pattern | — |
| M5 ✅ | MERGED | 3–4 | CSS Animações, Assets, Favicons | 2026-03-13 |
| M6 ✅ | MERGED | 7–8 | Touch UX, Source Maps, Universal Checklist | 2026-03-13 |

---

**Source:** Sprints M0–M6 — Mobile Performance Initiative (5 of 6 complete ✅)
**Last Updated:** 2026-03-13 (M5 + M6 CSS/Touch UX/Checklist — COMPLETE)
**M4 Status:** Blocked (service-worker complexity) — refatorar para próxima sprint se necessário
