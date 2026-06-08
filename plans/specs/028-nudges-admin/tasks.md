# Tasks — Nudges Admin (028)

## Tier 1 — Standard (spec.md + tasks.md)

Each task tied to deliverable (FR), user story (US), or acceptance criterion (SC).

---

## PRECONDITIONS

- [ ] T000 [C1.5] Read spec.md completely ✓
- [ ] T001 [C1.5] Clarify open questions (3 markers in spec.md) — awaiting operator input
- [ ] T002 [C1] Verify canonical paths (all target files exist on disk)
- [ ] T003 [C1] Load RULES_INDEX.md + relevant APs (react-hooks, schema-data, infra-api, test-hygiene)

---

## DELIVERABLES — SERVICE + HOOK + VIEW

- [ ] T100 [FR8, FR9, FR10] Create `apps/web/src/services/api/nudgeAdminService.js`
  - `async getAll(filters)` → GET `/api/admin/nudges?...`
  - `async create(data)` → POST `/api/admin/nudges`
  - `async update(id, data)` → PATCH `/api/admin/nudges/{id}`
  - `async toggleActive(id, isActive)` → PUT `/api/admin/nudges/{id}`
  - Auth: Bearer token from `supabase.auth.getSession()`
  - Error handling: reusar pattern feedbackAdminService

- [ ] T101 [FR11, US2] Create `apps/web/src/views/admin/useNudgesAdminState.js` (custom hook)
  - State: nudges[], loading, error, page, totalPages, pageSize
  - Filters: isActive (all/true/false), targetView (dropdown)
  - Actions: loadNudges(), handleCreate(), handleUpdate(), handleToggleActive()
  - Pagination: setPage()
  - Message: actionMessage (toast), actionLoading (spinner)
  - Pattern: reuse useFeedbackAdminState structure

- [ ] T102 [US1, US2, US3] Create `apps/web/src/views/admin/NudgesAdmin.jsx` (component)
  - Layout: header (title + "Novo Nudge" button)
  - Form (modal or inline): title, body, target_view, action_type, platform, priority, start_at, end_at, min/max app version
  - Table: nudges list com colunas (title, target_view, is_active, actions: edit/delete)
  - Filtros: is_active dropdown, target_view dropdown
  - Paginação: prev/next buttons
  - Ações inline: toggle is_active, edit (abre form), delete (marca inativo)
  - Reuse FeedbackAdmin.jsx styling + card/list patterns

- [ ] T103 [FR7, SC4] JSON builder V1.5 — campos condicionais por `action_type`
  - **Navigate:** tab dropdown (all ROUTES tabs: 'Hoje', 'Tratamentos', etc), screen dropdown pré-populado (ProfileMain, Settings, NotificationInferences, etc)
    - Source: `apps/mobile/src/navigation/routes.js` — import, Object.entries(), filter by tab context
    - Exemplo UI: `<select><option value="ProfileMain">ProfileMain</option>...</select>`
  - **Open URL:** url text input, label input (default "Ver mais"), emoji input
  - **Dismiss only:** emoji input only
  - Render condicionais: `if (action_type === 'navigate') { render tabs } else if (...) { render url }`
  - JSON preview: exibir acumulado das chaves preenchidas (textarea readonly ou pre tag)
  - **Validation:** após preencher, clicar "Salvar" — validar que navigate tem tab+screen, open_url tem URL, etc

---

## API ENDPOINTS — `/api/admin/nudges`

- [ ] T200 [FR8] POST `/api/admin/nudges`
  - Payload: { title, body, target_view, action_type, platform, priority?, start_at?, end_at?, min_app_version?, max_app_version?, action_payload? }
  - Validação: Zod schema (reusar de packages/core/src/schemas/ ou criar inline)
  - Auth gate: telegram_chat_id === VITE_ADMIN_CHAT_ID
  - Response: { success: true, data: nudge } ou { error: "..." }

- [ ] T201 [FR9] PATCH `/api/admin/nudges/{id}`
  - Payload: partial nudge (qualquer campo)
  - Validação: Zod (allow partial)
  - Auth gate: mesmo
  - Response: { success: true, data: updated_nudge }

- [ ] T202 [FR10] PUT `/api/admin/nudges/{id}`
  - Payload: { is_active: boolean }
  - Auth gate: mesmo
  - Response: { success: true, data: nudge }

- [ ] T203 [FR11] GET `/api/admin/nudges?is_active=true&target_view=dashboard&limit=20&offset=0`
  - Filtros: is_active (null = all), target_view (null = all)
  - Paginação: limit, offset
  - Ordenação: priority DESC, created_at DESC
  - Auth gate: mesmo
  - Response: { data: [...], total: N, page: 1, pageSize: 20, totalPages: M }

---

## INTEGRATION — ADMIN SECTION LINK

- [ ] T300 [FR12] Update `apps/web/src/views/redesign/settings/sections/AdminSection.jsx`
  - Add button: "Nudges" (icon: Bell ou Zap)
  - onClick: onNavigate('admin-nudges')
  - Exibe só se isAdmin

- [ ] T301 [FR12] Update Settings.jsx routing
  - Handle onNavigate('admin-nudges') → render <NudgesAdmin onBack={...} />
  - Pattern: reusar FeedbackAdmin routing (modal ou view replacement)

---

## SCHEMA + VALIDATION

- [ ] T400 [SC1] Create or verify Zod schema for nudge create/update
  - File: `packages/core/src/schemas/nudgeSchema.js` (se não existe) ou `apps/web/src/schemas/`
  - Schema fields: title (string, 2-100), body (string, 5-200), target_view (enum), action_type (enum), platform (enum), priority (number, 0-100), start_at (ISO datetime, nullable), end_at (ISO datetime, nullable), min_app_version (semver string, nullable), max_app_version (semver string, nullable), action_payload (JSON, nullable)
  - Enums: reusar de Epic 026 (buildNudgeList source of truth)

---

## DATE TIME PICKER — ABSTRACTION

- [ ] T500 [FR5] Create `apps/web/src/shared/components/ui/DateTimePickerInput.jsx` (abstraction)
  - Input: `type="datetime-local"` (nativo, sem libs)
  - Props: `value` (ISO string ou null), `onChange`, `name`, `label`, `required`
  - Display: `toLocalISO(value)` — converte ISO UTC → local string (YYYY-MM-DDTHH:mm) pra exibir
  - Export: `toLocalISO` function from `@utils/dateUtils` (reuse LogForm pattern, line 4-12 _logFormUtils.js)
  - Parent responsibility: `onChange` retorna local string (YYYY-MM-DDTHH:mm) → parent converte via `parseLocalDatetime(localString).toISOString()` antes de submit
  - **Nota:** DateTimePickerInput NÃO converte; parent faz via parseLocalDatetime (separa concern: input exibe/captura, service converte)

---

## TESTS

- [ ] T600 [C4] Create `apps/web/src/services/api/__tests__/nudgeAdminService.test.js`
  - Mock supabase.auth.getSession()
  - Mock fetch + endpoints (POST, PATCH, PUT, GET)
  - Test: create, update, toggleActive, error 401 when not admin
  - Coverage: ≥80%

- [ ] T601 [C4] Create `apps/web/src/views/admin/__tests__/useNudgesAdminState.test.js`
  - Test: loadNudges(), handleCreate(), handleToggleActive()
  - Mock service
  - Test: pagination, filters
  - Coverage: ≥80%

- [ ] T602 [C4] Manual E2E (Settings → Admin → Nudges → Create/Edit/Toggle)
  - Chrome DevTools network tab confirm POST/PATCH/PUT
  - Toast messages exibem corretamente
  - Table reflete mudanças após ação

---

## QUALITY GATES

- [ ] T700 [C4] `rtk lint` — zero errors before each commit
- [ ] T701 [C4] `rtk npm run test:critical` — all tests pass
- [ ] T702 [C4] Verify R-221 SQP
  - Platform: Web/PWA
  - SemVer impact: minor (new feature, no user impact on mobile)
  - Version: 4.1.0 (web) [se versão mobile não se altera]
  - CHANGELOG.md entry added

---

## DOCUMENTATION

- [ ] T800 [C5] Update `docs/operations/GUIA_NUDGE_BANNERS.md`
  - Add section: "Via Admin UI" (link to Settings → Admin → Nudges)
  - Note: "SQL inserts still supported; admin UI is recommended"

- [ ] T801 [C5] Update CHANGELOG.md [Unreleased] section
  - Entry: `- **Painel** administrador para gerenciar nudges (PR #TBD)`

---

## DEVFLOW C5 — MEMORY & STATE

- [ ] T900 [C5] Check RULES_INDEX.md + ANTI_PATTERNS_INDEX.md
  - Record any R-NNN applied, any AP-NNN triggered
  - Create memory files if new patterns found

- [ ] T901 [C5] Update state.json
  - session.status = "completed"
  - Increment memory.journal_entries_since_distillation

- [ ] T902 [C5] Append events.jsonl + journal entry
  - Record platform, SemVer, files created, tests passing

---

## SUCCESS CHECKLIST (C4 Final)

- [ ] Form validates required fields (toast on error)
- [ ] POST/PATCH/PUT endpoints work (curl test or UI test)
- [ ] GET endpoint returns paginated list (20/page)
- [ ] Toggle is_active changes Supabase + UI reflects immediately
- [ ] Date pickers accept UTC (verify via browser F12)
- [ ] Admin auth gates endpoints (401 if not admin)
- [ ] Lint + tests passing
- [ ] CHANGELOG.md updated
- [ ] AdminSection link appears only for admin
