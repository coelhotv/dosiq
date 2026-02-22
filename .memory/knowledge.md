# Domain Knowledge

> Static facts, component APIs, and patterns specific to this project.
> Updated when the project evolves. Not for chronological entries (use journal/).

---

## Project Identity

- **Meus Remedios** — Medication management PWA in Portuguese Brazilian
- **Version:** 3.0.0 | React 19 + Vite 7 + Supabase + Zod + Framer Motion 12 + Vitest
- **Code language:** English | **UI/docs/errors:** Portuguese

---

## Canonical File Locations (Wave 9 Final)

| Domain | Canonical Location | Notes |
|--------|-------------------|-------|
| API Services (adherence/dlq) | `src/services/api/` | Only 2 services without feature equivalent |
| Feature Services | `src/features/*/services/*.js` | e.g., `@medications/services/medicineService` |
| Shared Services | `src/shared/services/*.js` | cachedServices, migrationService |
| Log Service | `src/shared/services/api/logService.js` | Canonical for logs |
| Schemas | `src/schemas/*.js` | **Single location** for Zod schemas |
| Utils | `src/utils/*.js` | adherenceLogic, dateUtils, titrationUtils |
| Hooks | `src/shared/hooks/*.js` | useCachedQuery, useTheme, useHapticFeedback, useShake |
| Shared Components | `src/shared/components/**/*.jsx` | ui/, gamification/, log/, onboarding/, pwa/ |
| Feature Components | `src/features/*/components/*.jsx` | Domain-specific components |
| Supabase Client | `@shared/utils/supabase` | Was `src/lib/supabase.js` (deleted) |
| Cache Util | `@shared/utils/queryCache` | Was `src/lib/queryCache.js` (deleted) |

> Wave 9 completed: `src/lib/`, `src/hooks/`, `src/components/`, `src/shared/constants/`, `src/features/*/constants/` were deleted. ESLint `no-restricted-imports` blocks legacy paths.

---

## Path Aliases (vite.config.js)

| Alias | Resolves To |
|-------|-------------|
| `@` | `src/` |
| `@features` | `src/features` |
| `@shared` | `src/shared` |
| `@services` | `src/services` |
| `@dashboard` | `src/features/dashboard` |
| `@medications` | `src/features/medications` |
| `@protocols` | `src/features/protocols` |
| `@stock` | `src/features/stock` |
| `@adherence` | `src/features/adherence` |
| `@schemas` | `src/schemas` |
| `@utils` | `src/utils` |

---

## Component APIs

| Component | Location | Key Props |
|-----------|----------|-----------|
| MedicineForm | `src/components/medicine/` | `onSuccess`, `autoAdvance=false`, `showCancelButton=true` |
| ProtocolForm | `src/features/protocols/components/` | `mode='full'|'simple'`, `preselectedMedicine` |
| Calendar | `src/components/ui/` | `enableLazyLoad`, `enableSwipe`, `enableMonthPicker` |
| AlertList | `src/components/ui/` | `variant='smart'|'stock'` |
| LogForm | `src/components/log/` | Always pass `treatmentPlans` for bulk registration |

---

## Schema Constants (Portuguese)

```javascript
const FREQUENCIES = ['diario', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessario']
const MEDICINE_TYPES = ['comprimido', 'capsula', 'liquido', 'injecao', 'pomada', 'spray', 'outro']
const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
```

---

## CSS Tokens

**Glassmorphism:**
```css
--glass-light: rgba(255, 255, 255, 0.03);
--glass-standard: rgba(255, 255, 255, 0.08);
--glass-heavy: rgba(255, 255, 255, 0.15);
--glass-hero: rgba(255, 255, 255, 0.2);
```

**Mobile Modals:**
```css
.modal {
  max-height: 85vh;      /* Never 100vh — consider BottomNav */
  padding-bottom: 60px;  /* Space for scroll */
}
```

**JSX Arrows:** Use `{'<'}` and `{'>'}` to avoid parsing errors.

---

## Stock Levels

```javascript
const STOCK_LEVELS = {
  CRITICAL: { threshold: 7, color: '#ef4444', label: 'Critico' },   // < 7 days
  LOW:      { threshold: 14, color: '#f59e0b', label: 'Baixo' },    // < 14 days
  NORMAL:   { threshold: 30, color: '#22c55e', label: 'Normal' },   // < 30 days
  HIGH:     { threshold: Infinity, color: '#3b82f6', label: 'Bom' } // >= 30 days
}
```

---

## Dosage Model

```
dosage_per_intake = pills per dose (e.g., 4)
dosage_per_pill = mg per pill (e.g., 500)
dosage_real = 4 * 500 = 2000mg
quantity_taken = always in PILLS (not mg)
```

---

## SWR Cache Pattern

```javascript
import { cachedMedicineService } from '@services/api/cachedServices'

// Read with cache
const medicines = await cachedMedicineService.getAll()

// Cache automatically invalidated after mutation
await cachedMedicineService.create(medicine)

// Manual invalidation if needed
queryCache.delete('medicines')
```

---

## RLS (Row Level Security)

- All user data tables MUST have RLS enabled
- Frontend uses `anon key` (public) — RLS enforces access
- Backend uses `service_role` (privileged) — only in `server/`
- Policy pattern: `USING (user_id = auth.uid())`

---

## Vercel Serverless

- Conditional dotenv: `if (process.env.NODE_ENV !== 'production')`
- Vercel injects env vars automatically — no dotenv needed in production
- Rewrites syntax: `{ "source": "/api/dlq/:id/retry", "destination": "/api/dlq/[id]/retry.js" }`
- Catch-all `/(.*) -> /index.html` must be LAST rewrite

---

## MarkdownV2 Escape Function

```javascript
const escapeMarkdownV2 = (text) => {
  return text
    .replace(/\\/g, '\\\\')     // Backslash FIRST
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    .replace(/~/g, '\\~').replace(/`/g, '\\`')
    .replace(/>/g, '\\>').replace(/#/g, '\\#')
    .replace(/\+/g, '\\+').replace(/-/g, '\\-')
    .replace(/=/g, '\\=').replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{').replace(/\}/g, '\\}')
    .replace(/\./g, '\\.').replace(/!/g, '\\!')
}
```

---

## Framer Motion + ESLint

```javascript
// In eslint.config.js:
varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])'
```

---

## Template: Code Mode Task Instructions

Every delegation to Code mode MUST include:

### Preâmbulo Obrigatório (OBRIGATÓRIO)
```markdown
### Antes de Começar (OBRIGATÓRIO)
1. Ler `.memory/rules.md` - todas as regras R-NNN
2. Ler `.memory/anti-patterns.md` - todos os anti-patterns AP-NNN
3. Verificar arquivos duplicados: `find src -name "*TargetFile*" -type f`
```

### Sequência de Validação Explícita
```markdown
### Validação por Fase
- **Durante desenvolvimento:** `npm run validate:quick` (R-051)
- **Antes do commit:** `npm run validate:quick`
- **Antes do push:** `npm run test:critical`
- **Após commit:** Criar PR imediatamente com `gh pr create`
```

### Checklist de Conformidade
```markdown
### Checklist de Conformidade
- [ ] Li `.memory/rules.md` (sim/não)
- [ ] Li `.memory/anti-patterns.md` (sim/não)
- [ ] Verifiquei regras específicas: R-001, R-051, R-060, etc.
- [ ] Validei com `validate:quick` durante dev
- [ ] Criei PR imediatamente após commit
```

---

*Last updated: 2026-02-22*
