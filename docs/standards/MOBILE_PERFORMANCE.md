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

### 6.3 Views de Agregação Server-Side

**Padrão:** VIEW substitui processamento client-side

```sql
-- ✅ CORRETO — Pré-agregação simples (elimina O(N) no client)
-- Retorna: doses tomadas por dia (agrupado por user + data)
-- Cliente calcula % comparando com doses esperadas de protocols
CREATE OR REPLACE VIEW v_daily_adherence AS
SELECT
    user_id,
    (taken_at AT TIME ZONE 'UTC')::date AS log_date,
    COUNT(*) AS taken_doses,
    SUM(quantity_taken) AS total_quantity_taken
FROM medicine_logs
GROUP BY user_id, (taken_at AT TIME ZONE 'UTC')::date;
```

**Retorna (pré-agregado no servidor, < 10ms):**
- `user_id` — Usuário
- `log_date` — Data
- `taken_doses` — Quantidade de doses registradas naquele dia
- `total_quantity_taken` — Total de comprimidos tomados

**Benefício:** getDailyAdherence() no client: O(N) agregação → O(1) lookup na view. Elimina travamento da main-thread no mobile mid-low tier.

**Quando migrar client-side para server-side:**
- [ ] getDailyAdherence() — atualmente JavaScript, pode ficar em view
- [ ] calculateStreaks() — futuro, alta complexidade com O(N²)
- [ ] getAdherenceSummary() — resumo mensal agregado

**Vantagem de view vs. função:**
- View é read-only (sem state side effects)
- Acesso natural via `SELECT * FROM v_daily_adherence WHERE user_id = ?`
- Sem controle de função serverless (Vercel R-090)

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

## Próximas Seções (M4–M6)

| Sprint | Seção | Tópicos |
|--------|-------|---------|
| M2 ✅ | 1–2 | Princípios, Lazy Loading, Code Splitting |
| M3 ✅ | 6 | DB: Índices, Views de Agregação |
| M4 | 7 (parcial) | Offline UX, OfflineBanner Pattern |
| M5 | 3–4 | CSS Animações, Assets, Favicons |
| M6 | 7 (completo), 8 | Touch UX, Universal Checklist |

---

**Source:** Sprint M3 — Database Optimization
**Last Updated:** 2026-03-13
