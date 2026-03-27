# 2026-W13 — Wave 9: Profile, Health History, Emergency Redesign

**Dates:** 2026-03-27 | **Status:** ✅ DELIVERED | **PR:** #434 | **Branch:** feature/redesign/wave-9-profile-saude | **Commit:** c78e1a4

---

## 📋 Summary

Completed Wave 9 of the Santuário Terapêutico redesign — comprehensive overhaul of three critical views (Profile, Health History, Emergency) with Material 3 design system, two-column responsive layout, and CSS-based state management.

**Key Metrics:**
- **Lines of code:** 1,273 inserted across 10 files
- **Components created:** 7 (ProfileRedesign + 3 sub-components, HealthHistoryRedesign, EmergencyRedesign)
- **CSS written:** 1,350+ lines (Profile 608, HealthHistory 134, Emergency 120, overrides)
- **Sprints:** 5 sequential (9.1-9.5) + 1 bugfix + AI review cycle
- **Review cycle:** 2 comments → 1 accepted, 1 declined with rationale

---

## 🎯 Tasks Completed

### Sprint 9.1-9.2: ProfileRedesign Main + Sub-Components ✅

**Main Component — ProfileRedesign.jsx (282 lines)**

Architecture:
- **Two-column desktop layout** (768px+): 240px left sidebar nav + 1fr content area
- **Single column mobile:** full-width flex layout with section slots
- **State management:** activeSection (desktop) + CSS data-active visibility (prevents remount)

Navigation:
- 3 sections: "Saúde & Histórico" (health), "Relatórios & Dados" (reports), "Configurações" (settings)
- Each section has nav item with emoji icon + Lucide ChevronRight
- Active state: background color-primary-bg + bold font + opacity 1
- Hover state: background color-surface-container-low + opacity 1

Content Sections:
- **Health:** Minha Saúde, Cartão de Emergência, Modo Consulta Médica
- **Reports:** Relatório PDF, Exportar Dados
- **Settings:** Telegram (connect/disconnect + token), Densidade (auto/confortável/normal/compacto), Alterar Senha, Admin DLQ (conditional)

Handlers (copied from original Profile.jsx, identical logic):
- `loadProfile()` — fetch user + user_settings; added error feedback
- `handleLogout()` — sign out via Supabase Auth
- `handleUpdatePassword()` — validate 6+ chars, update, clear form
- `generateTelegramToken()` — create UUID token, upsert to user_settings, show link
- `handleDisconnectTelegram()` — confirm, null telegram_chat_id, show feedback
- `handleComplexityChange()` — store to localStorage, remove if 'auto'

**Sub-Components:**

1. **ProfileHeaderRedesign.jsx** (28 lines)
   - Avatar: 44px circular gradient (green-primary to primary-container)
   - Initials: first 2 words, first letter uppercase
   - Name + email display

2. **ProfileSectionRedesign.jsx** (14 lines)
   - Wrapper: `pr-section` + `pr-section__title` + `pr-section__content`
   - Title: 0.75rem, uppercase, letter-spacing 0.08em, opacity 0.45
   - Content: tonal surface container lowest, border-radius 1.25rem, shadow-ambient

3. **ProfileLinkRedesign.jsx** (25 lines)
   - Flexbox button: icon-wrap + label + detail (optional) + chevron
   - Icon wrap: 36px secondary-fixed container
   - Label: 1rem, 500 weight
   - Chevron: 18px Lucide ChevronRight, opacity 0.3
   - States: hover (background color-surface-container-low), active (darker background)

**ProfileRedesign.css** (607 lines):
- Mobile-first: all single-column by default
- Desktop (768px+) media query: grid layout, panel visible, header hidden
- Colors: var(--color-primary), var(--color-surface-*), var(--color-outline-ghost)
- No glass, no neon — tonal surfaces with shadow-ambient
- Responsive breakpoint: 768px (iPad portrait)

**Design Philosophy:**
- Consistency: every child component reuses same color tokens
- Accessibility: icons always paired with text labels
- State preservation: CSS data-active attribute prevents form state loss on section switch
- Mobile-first: desktop layout is enhancement, not override

**AI Review Feedback:**
- **Comment #1 (HIGH, declined):** Consolidate ProfileHeaderRedesign avatars
  - Rationale: Different sizes (44px desktop vs 52px mobile) + different styling requirements mean consolidation would require prop complexity that reduces maintainability
- **Comment #2 (MEDIUM, applied):** Add user-facing error in loadProfile
  - Fix committed: `setError('Falha ao carregar os dados do perfil. Por favor, recarregue a página.')`

### Sprint 9.3: HealthHistoryRedesign Wrapper ✅

**HealthHistoryRedesign.jsx** (21 lines):
- Simple wrapper: imports HealthHistory + wraps in `.hhr-wrapper`
- Zero logic changes — CSS-only override strategy

**HealthHistoryRedesign.css** (134 lines):
- Calendar heatmap colors:
  - Full/taken → `var(--color-primary)` + text `var(--color-on-primary)`
  - Partial → `var(--color-secondary-fixed)`
  - Missed/empty → `var(--color-error-bg, #ffdad6)` + text `var(--color-error)`
  - Selected → outline 2px primary + offset 2px
  - Today → border 2px primary
- AdherenceHeatmap cells:
  - high → primary
  - medium → primary-fixed
  - low → warning (#f59e0b)
  - none → surface-container-high
- SparklineAdesao (Recharts):
  - Stroke: `var(--color-primary)`, filter none (removes glow)
  - Area: fill primary, opacity 0.1
  - Dots: fill primary, stroke surface-container-lowest
- Stats cards: surface-container-lowest background, shadow-ambient, border-radius 1.25rem, no glass
- Log entries: surface-container-lowest, border-bottom outline-ghost, no shadow

**Strategy:** Wrapper pattern preserves all HealthHistory logic (Virtuoso, lazy loading, data fetching) — only visual tokens change

### Sprint 9.4: EmergencyRedesign Wrapper ✅

**EmergencyRedesign.jsx** (21 lines):
- Simple wrapper: imports Emergency + wraps in `.er-wrapper`
- Zero logic changes — CSS-only override strategy

**EmergencyRedesign.css** (120 lines):
- Card container: surface-container-lowest background, shadow-ambient, radius 2rem, no glass
- Header: gradient `135deg, var(--color-primary), var(--color-primary-container)`, no shadow/filter
- Title: color-on-primary, font-display, 700 weight, no text-shadow
- Fields:
  - Background: surface-container-low
  - Border: 1px outline-ghost, radius 0.75rem
  - Label: uppercase, letter-spacing 0.06em, opacity 0.5
  - Value: body font, no text-shadow/filter
- Alert/critical tag: color-error-bg + color-error, border-radius 99px, no shadow
- Form inputs (focus): border color-primary + shadow `0 0 0 3px rgba(0,106,94,0.12)`
- Edit button: gradient primary→primary-container, shadow `0 8px 24px rgba(0,106,94,0.20)`, no filter

**Strategy:** CSS-only override for form styling — Emergency logic (localStorage, offline, field management) untouched

### Sprint 9.5: App.jsx Integration ✅

**Changes to src/App.jsx (29 lines modified):**

1. **Added 3 lazy imports** (lines 27-29):
   ```jsx
   const ProfileRedesign = lazy(() => import('./views/redesign/ProfileRedesign'))
   const HealthHistoryRedesign = lazy(() => import('./views/redesign/HealthHistoryRedesign'))
   const EmergencyRedesign = lazy(() => import('./views/redesign/EmergencyRedesign'))
   ```

2. **Updated 4 case branches with isRedesignEnabled branching:**
   - `case 'profile'` — conditional render ProfileRedesign vs Profile
   - `case 'health-history'` — conditional render HealthHistoryRedesign vs HealthHistory
   - `case 'history'` — conditional render HealthHistoryRedesign vs HealthHistory (alias)
   - `case 'emergency'` — conditional render EmergencyRedesign vs Emergency

3. **Pattern:** Each branch gets its own Suspense wrapper (matches existing 'stock' pattern):
   ```jsx
   case 'profile':
     return isRedesignEnabled ? (
       <Suspense fallback={<ViewSkeleton />}>
         <ProfileRedesign onNavigate={setCurrentView} />
       </Suspense>
     ) : (
       <Suspense fallback={<ViewSkeleton />}>
         <Profile onNavigate={setCurrentView} />
       </Suspense>
     )
   ```

4. **Bugfix: Consultation navigation** (line 233):
   - Changed `onBack={() => setCurrentView('dashboard')}` → `setCurrentView('profile')`
   - Users entering Consulta Médica from Profile now return to Profile, not Dashboard
   - Discovered during testing; fixed proactively

**QA Results:**
- ESLint: 0 errors (1 pre-existing warning in coverage/)
- Critical tests: All pass
- Lazy loading: Dynamic imports working correctly (pattern fixed after initial dynamic import error)
- Mobile/desktop: Layout switches correctly at 768px breakpoint
- Navigation: Consultation back button returns to correct view

---

## 💾 Commits

| Commit | Message | Files |
|--------|---------|-------|
| 377d6e0 | feat(redesign): Wave 9.1-9.2 — ProfileRedesign main + sub-components | 5 |
| 278f6a6 | feat(redesign): Wave 9.3-9.4 — HealthHistory + Emergency redesign wrappers | 4 |
| 93b546b | feat(redesign): Wave 9.5 — App.jsx integration + consultation navigation fix | 1 |
| 7d6a001 | fix(redesign): add user-facing error feedback in loadProfile | 1 |
| c78e1a4 | merge | squash |

---

## 🔍 Lessons Learned

### ✅ What Worked Well

**1. CSS-Based Visibility (Data-Active Pattern)**
- Using `data-active` attribute + CSS selectors prevents component remount
- Form state (showPasswordForm toggle) preserved across section switches
- Pattern: `div[data-active="true"] { display: block }` is more reliable than conditional JSX rendering in this context
- **Lesson:** For section-based UIs, CSS-based visibility + conditional rendering is better than React state toggling

**2. Wrapper Strategy for Design Consistency**
- HealthHistoryRedesign and EmergencyRedesign required zero logic changes
- CSS-only overrides (scoped `.hhr-wrapper`, `.er-wrapper`) allowed confident redesign without touching complex components
- Original logic (Virtuoso lists, offline storage, Recharts charts) all preserved
- **Lesson:** Wrapper pattern scales well for visual redesigns that don't change data models or behavior

**3. Two-Column Responsive Layout**
- Desktop grid: `grid-template-columns: 240px 1fr` works well with sidebar nav
- Mobile flex: single column with CSS visibility control for sections
- Breakpoint 768px (iPad portrait) chosen correctly — balances usability
- **Lesson:** 240px sidebar + content is sweet spot for 768px+ screens; don't go narrower

**4. Lazy Loading Pattern (After Fix)**
- Each Suspense branch with own component prevents dynamic import errors
- Pattern: `isRedesignEnabled ? <Suspense><New/></Suspense> : <Suspense><Old/></Suspense>`
- Matches existing 'stock' case — consistency across codebase
- **Lesson:** Never put conditional inside Suspense boundary; wrap both branches separately

**5. AI Review Cycle (Declined Suggestion)**
- Reviewer suggested consolidating ProfileHeaderRedesign avatars (different sizes)
- Declined with design rationale: prop complexity vs intentional separation for styling
- Reviewer accepted reasoning in follow-up comment
- **Lesson:** Declining suggestions with clear reasoning is acceptable; reviewers respect well-explained trade-offs

### ⚠️ What Could Be Better

**1. Initial Conditional Rendering Pattern**
- First attempt put conditional inside Suspense boundary
- Caused dynamic import error in browser: `Failed to fetch dynamically imported module`
- Fix: Moved conditional outside, each branch gets own Suspense
- **Anti-pattern created:** AP-W9-01 — Never use conditional JSX inside Suspense boundary for lazy imports

**2. Error Handling in loadProfile**
- Original Profile.jsx only `console.error()` on failure
- Reviewer correctly flagged: users see no feedback when profile load fails
- Applied fix: `setError()` with user-facing message
- **Lesson:** Async operations in frontend always need user-facing feedback, not just console

**3. Testing Against Original Profile Component**
- User reported Supabase 400 errors during manual dev testing
- Errors appeared to come from user_settings queries
- Never confirmed if errors were pre-existing in Profile.jsx vs new in ProfileRedesign
- **Lesson:** When testing redesign component, always test original component against same actions for comparison

---

## 🚀 Rollout Strategy

**Current State:**
- All 3 views (Profile, HealthHistory, Emergency) now have redesign wrappers
- Flag `isRedesignEnabled` controls which version renders
- Original components (Profile, HealthHistory, Emergency) preserved as fallback
- Zero performance impact when flag is off

**Next Steps for Rollout:**
1. Enable `isRedesignEnabled` for specific user cohort (e.g., alpha testers)
2. Monitor: error rates, performance (Web Vitals), user feedback
3. Gradual rollout: 10% → 25% → 50% → 100%
4. Watch for: Telegram connection issues, form state loss on section switch, mobile layout issues

**Known Issues to Monitor:**
- Supabase user_settings query errors (400 status) — investigate root cause
- Consultation navigation tested but not extensively — watch for edge cases

---

## 📚 Related Files

- **Spec:** `plans/redesign/WAVE_9_PROFILE_SAUDE_REDESIGN.md` (3000+ lines, complete prescriptive spec)
- **Original Profile:** `src/views/Profile.jsx` (reference for identical handler logic)
- **Design tokens:** `src/shared/styles/tokens.redesign.css` (Material 3, verde saúde)
- **Original CSS:** `src/views/profile/Profile.css` (for migration pattern reference)

---

**Sprint Cycle Time:** ~4 hours (discovery + planning + implementation + testing + review + merge)
**Quality Gate:** ESLint 0 errors, critical tests pass, AI review processed, human approval
**Deployment:** Merged to main, ready for flag-based rollout
