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

## Próximas Seções (M3–M6)

| Sprint | Seção | Tópicos |
|--------|-------|---------|
| M2 ✅ | 1–2 | Princípios, Lazy Loading, Code Splitting |
| M3 | 6 | DB: Índices, Views de Agregação |
| M4 | 7 (parcial) | Offline UX, OfflineBanner Pattern |
| M5 | 3–4 | CSS Animações, Assets, Favicons |
| M6 | 7 (completo), 8 | Touch UX, Universal Checklist |

---

**Source:** Sprint M2 — Code Splitting v1.0
**Last Updated:** 2026-03-12
