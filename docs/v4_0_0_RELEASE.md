# Meus Remédios v4.0.0 Release Guide

> **Santuário Terapêutico Complete — Healthcare Redesign + Accessibility + Performance**
>
> Release Date: **2026-04-09**  
> Status: **Production Ready** ✅

---

## 🎯 What's New in v4.0.0?

### The Redesign is Complete
After 17 waves of iterative design and development, the **Santuário Terapêutico** design system is now the default UI for 100% of screens. This is a major visual and experiential overhaul from v3.x.

### Key Improvements

#### 🎨 Design System
- **Color Palette:** Health Green (#006a5e) + Clinical Blue (#005db6) for warmth and trust
- **Typography:** Public Sans (headings) + Lexend (body) — optimized for readability
- **Spacing & Radius:** Minimum 0.75rem border radius, 1rem base spacing
- **Shadows:** Material Design 3 ambient shadows (no harsh glows)
- **Touch:** All interactive elements ≥44px (WCAG AAA)

#### ♿ Accessibility (WCAG 2.1 AA)
- Font weights ≥400pt (better readability for elderly users)
- All icons paired with text labels
- Color contrast ratios ≥4.5:1 (AA standard)
- Motion preferences respected (`prefers-reduced-motion`)
- Keyboard navigation on all views
- Screen reader support (ARIA labels, landmarks)

#### 📱 Performance (89% Bundle Reduction)
- Main bundle: **102.47kB gzip** (from 989kB — 89% smaller)
- Dashboard first load: **<5s on 4G mobile**
- Code splitting: 8 vendor/feature chunks
- Lazy loading: 13+ views load on-demand
- Cache coalescence: Dashboard queries reduced from 13+ to 1

#### 🤖 AI Chatbot
- **Groq API** with prompt caching
- **Multi-channel:** Web + Telegram
- **Context-aware:** Medicines, protocols, health history
- **Safe:** Hallucination mitigations + active ingredient grounding

#### 🎛️ Navigation Redesign
- **Mobile:** Bottom navigation with 5 main routes
- **Desktop:** Sidebar with collapsible sections
- **Transitions:** Framer Motion page animations
- **Responsive:** Adapts at 768px breakpoint

---

## 🔄 Migration from v3.x to v4.0.0

### For Users

#### What Changed?
1. **Visual Design** — Complete redesign. Colors, fonts, spacing, and animations are different
2. **Navigation** — Mobile has bottom nav (was top nav). Desktop has sidebar (was menu)
3. **Feature Flag Removed** — No more "redesign toggle." Everyone gets v4.0.0 design
4. **Clinical Features** — New "Consultation Mode" for read-only access in clinical settings

#### Will My Data Transfer?
**Yes.** All user data (medicines, protocols, stock, logs) transfers automatically. No action needed.

#### What If I Liked the Old Design?
Sorry — v3.x is deprecated. We recommend exploring v4.0.0 for a few days. The new design is:
- More accessible for elderly users
- Better on mobile (89% faster)
- More polished (18 months of iteration)

### For Developers

#### Breaking Changes
1. **Feature Flag Infrastructure Removed**
   - `src/shared/contexts/RedesignContext.jsx` deleted
   - `useRedesign()` hook deleted
   - `data-redesign` attribute removed from all views
   - Feature flag no longer checked anywhere

2. **Neon Colors Removed**
   - All `--neon-*` CSS variables deleted
   - Replaced with Sanctuary tokens: `--color-primary`, `--color-secondary`, etc.
   - Migration: see `.agent/memory/knowledge.json` K-078 (token mapping)

3. **Legacy Views Deleted**
   - `Dashboard.jsx`, `Stock.jsx`, `HealthHistory.jsx`, `Profile.jsx`, etc.
   - Replaced by redesigned versions in `src/views/redesign/`
   - Views renamed (e.g., `DashboardRedesign.jsx` → `Dashboard.jsx`)

4. **BottomNav Component Changed**
   - Old `BottomNav.jsx` deleted
   - New `BottomNavRedesign.jsx` (now the only version)
   - Responsive at ≤768px

5. **CSS Token Files Consolidated**
   - `tokens.redesign.css` deleted (tokens merged to sanctuary.css)
   - `layout.redesign.css` renamed to `layout.css`
   - `components.redesign.css` renamed to `components.css`
   - Import paths updated in `index.css`

#### Code Migration Steps

**1. Update Imports (if you import views)**
```js
// ❌ OLD (v3.x)
import Dashboard from 'src/views/Dashboard'
import HealthHistory from 'src/views/HealthHistory'

// ✅ NEW (v4.0.0)
import Dashboard from 'src/views/redesign/Dashboard'
import HealthHistory from 'src/views/redesign/HealthHistory'
```

**2. Remove Feature Flag Checks**
```js
// ❌ OLD (v3.x)
import { useRedesign } from '@shared/hooks/useRedesign'
const { isRedesignEnabled } = useRedesign()
if (isRedesignEnabled) { /* render new UI */ } else { /* render old UI */ }

// ✅ NEW (v4.0.0)
// Just render the new UI directly — no flag check needed
```

**3. Update CSS Tokens**
```css
/* ❌ OLD (v3.x) */
.button {
  background: var(--neon-cyan);
  color: var(--neon-pink);
}

/* ✅ NEW (v4.0.0) */
.button {
  background: var(--color-primary);
  color: var(--color-secondary);
}
```

#### Token Mapping Reference
| Old Token | New Sanctuary Token |
|-----------|-------------------|
| `--neon-cyan` | `--color-primary` |
| `--neon-magenta` | `--color-secondary` |
| `--neon-green` | `--color-success` |
| `--neon-yellow` | `--color-warning` |
| `--neon-red` / `--neon-pink` | `--color-error` |
| `--accent-primary` | `--color-primary` |
| `--accent-success` | `--color-success` |

#### Affected Files (by frequency)
- **Component CSS:** 40+ files updated to use sanctuary tokens
- **Theme files:** `light.css`, `dark.css` — now use sanctuary palette
- **App.jsx:** Feature flag checks removed
- **vite.config.js:** Chunk names updated (no more "Redesign" suffix)
- **Views:** 9 files renamed, imports updated

#### Testing After Migration
```bash
# Run full validation
npm run validate:agent     # All 32 tests pass?
npm run build             # Any build errors?
npm run lint              # Any linting issues?

# Grep checks (should all return 0)
grep -r "isRedesignEnabled" src/
grep -r "useRedesign" src/
grep -r "data-redesign" src/
grep -r "--neon-" src/
```

---

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- npm 9+
- Vercel CLI (optional, for local preview)

### Deploy to Vercel
```bash
git push origin main
# Vercel auto-deploys on push to main
# Check deployments: https://vercel.com/coelhotv/meus-remedios
```

### Local Testing
```bash
npm install
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Build for production
npm run preview       # Preview production build locally
```

---

## 📊 Quality Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Lighthouse Performance | ≥90 | 90+ ✅ |
| Lighthouse Accessibility | ≥95 | 95+ ✅ |
| Bundle Size (gzip) | ≤110kB | 102.47kB ✅ |
| Test Pass Rate | 100% | 32/32 ✅ |
| Build Time | <10s | 9.86s ✅ |

---

## 📞 Support

### Issues with v4.0.0?
1. **Visual bugs:** Check if browser zoom is 100% and cache is cleared
2. **Login issues:** Clear localStorage and cookies
3. **Old data missing:** Check if using same account (login required)
4. **Performance complaints:** Try on 4G mobile to see actual improvements

### Report Issues
- GitHub Issues: https://github.com/coelhotv/meus-remedios/issues
- Email: coelhotv@gmail.com

---

## 📚 Related Documentation

- [CHANGELOG.md](../CHANGELOG.md) — Full change history
- [Mobile Performance Standards](./standards/MOBILE_PERFORMANCE.md) — Lazy loading, code splitting
- [Redesign System Guide](./architecture/REDESIGN_SANCTUARY.md) — Design tokens, patterns
- [Accessibility Standards](./standards/ACCESSIBILITY.md) — WCAG compliance, best practices
- [Chatbot AI Architecture](./architecture/CHATBOT_AI.md) — Groq integration, safety measures

---

## 🎉 Thank You!

v4.0.0 represents 18+ months of iterative design, accessibility research, and performance optimization. Thank you for being part of this journey.

**Welcome to Santuário Terapêutico.** 💊✨

---

*Last Updated: 2026-04-09*  
*Release Manager: DEVFLOW Agent*  
*Status: Production ✅*
