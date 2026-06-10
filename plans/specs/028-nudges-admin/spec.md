# Feature Spec — Nudges Admin

**Directory:** `plans/specs/028-nudges-admin`  
**Created:** 2026-06-08T17:25:00Z  
**Status**: in-progress — PR #654 mergeado; restante pendente
**Tier:** 1 (Standard)  
**Input:** User request + Epic 026 (nudges) as-built  

---

## Context

Epic 026 Fase 1 (Mobile) shipped nudges (in-app prompts via `in_app_nudges` Supabase table). Operacional guide at `docs/operations/GUIA_NUDGE_BANNERS.md` documents manual SQL inserts to Supabase dashboard.

**Goal:** Admin UI para criar, listar, editar, e ativar/desativar nudges sem SQL direto.

**Why:** Reduce friction (PO não precisa de Supabase access); reduce errors (form validation vs. free-form SQL); audit trail (API logs).

---

## User Stories

### US1 — Create Nudge
**As** admin (via web),  
**I want** um formulário para criar nudge com validação,  
**so that** posso adicionar nudges sem SQL.

**Acceptance Scenarios:**
- **Given** estou na view Nudges Admin, **When** clico "Novo Nudge", **Then** form abre com campos obrigatórios destacados
- **Given** preencho form com dados válidos, **When** clico Salvar, **Then** nudge é inserido, toast sucesso, form limpa
- **Given** deixo campo obrigatório vazio, **When** clico Salvar, **Then** campo exibe erro inline, form não submete

### US2 — List & Edit Nudges
**As** admin,  
**I want** listar nudges existentes com filtros e editar inline,  
**so that** encontro e ajusto nudges rapidamente.

**Acceptance Scenarios:**
- **Given** há N nudges na DB, **When** carrego a view, **Then** lista pagina (≤20/página), mostra título+body+status
- **Given** filtro por `target_view=dashboard`, **When** aplico, **Then** lista mostra só dashboards
- **Given** clico edit em um nudge, **When** form abre com dados pré-preenchidos, **Then** posso alterar e salvar

### US3 — Toggle Nudge Status
**As** admin,  
**I want** ativar/desativar nudge com um clique (toggle `is_active`),  
**so that** posso parar de exibir sem deletar.

**Acceptance Scenarios:**
- **Given** nudge com `is_active=true`, **When** clico toggle, **Then** status muda para `false`, toast confirma
- **Given** aplicação mostrava nudge, **When** desativo, **Then** nudge some da aplicação (próxima fetch)

---

## Functional Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| FR1 | Form dropdown: `target_view` (dashboard, profile, any) | enums pré-definidos |
| FR2 | Form dropdown: `action_type` (navigate, open_url, dismiss_only) | enums pré-definidos |
| FR3 | Form dropdown: `platform` (ios, android, web, all) | enums pré-definidos |
| FR4 | Form input: `title`, `body`, `priority` (número) | obrigatórios exceto priority (padrão 0) |
| FR5 | Form date pickers: `start_at` e `end_at` (UTC, opcional) | reusar pattern de LogForm |
| FR6 | Form semver range: `min_app_version`, `max_app_version` (opcional) | validar formato `X.Y.Z` |
| FR7 | Form JSON builder: `action_payload` (6 chaves: tab, screen, route, url, emoji, label) | condicional por `action_type` |
| FR8 | Endpoint POST `/api/admin/nudges` — criar nudge | valida schema Zod, insere, retorna criado |
| FR9 | Endpoint PATCH `/api/admin/nudges/{id}` — editar nudge | só campos alterados |
| FR10 | Endpoint PUT `/api/admin/nudges/{id}` — toggle `is_active` | sem delete hard |
| FR11 | List view: table com paginação (≤20/página), filtros por `is_active` e `target_view` | ordenar por priority DESC |
| FR12 | Admin auth: reusar `VITE_ADMIN_CHAT_ID` pattern (via telegram_chat_id) | confira useSettingsState |

---

## Success Criteria

| ID | Criterion | Verifiable |
|----|-----------|-----------|
| SC1 | Form valida todos campos obrigatórios antes de submit (Zod safeParse) | lint + unit test |
| SC2 | POST/PATCH/PUT endpoints retornam erro 401 se não admin | integration test + manual |
| SC3 | Date pickers exibem em UTC e aceitam input em UTC (não local) | E2E ou manual |
| SC4 | JSON builder exibe previews + editor de texto (fallback) | manual |
| SC5 | List reflete mudanças imediatamente após ação (refetch automático) | E2E |
| SC6 | Roteamento em AdminSection funciona (link → view aberta) | manual |

---

## Assumptions

1. **DateTimePickerInput abstração:** Reuso padrão LogForm. `toLocalISO()` → display (YYYY-MM-DDTHH:mm), `parseLocalDatetime().toISOString()` → save (ISO 8601 UTC com Z). Input type="datetime-local" nativo.
2. **JSON builder V1.5:** Campos condicionais por `action_type`. Tab/screen dropdowns pré-populados (Object.entries(ROUTES) import @ navigation/routes — 5 min). Navigate = tab+screen; open_url = URL; dismiss_only = emoji.
3. **Soft delete:** `is_active = false` permanente (sem hard delete). Alinha com feedback admin.
4. **Paginação:** ≤20 nudges por página. Assume N nudges << 1000.
5. **Auth:** Telegram_id já carregado em useSettingsState (isAdmin booleano). Reusar sem novo hook.
6. **Error handling:** Form fica em edit mode com campos preenchidos. Toast error embaixo. Sem retry automático (usuário re-clica salvar).

---

## Validated from Codebase

- **DateTime pattern:** LogFormTimeSection (type="datetime-local") + parseLocalDatetime() conversion. Source: `apps/web/src/shared/components/log/_logFormUtils.js` lines 4-12 (toLocalISO), 83 (buildLogPayloads).
- **ROUTES mapping:** `apps/mobile/src/navigation/routes.js` — 40+ enum entries. Import + Object.entries para dropdown. No dependencies.
- **Admin auth gate:** useSettingsState line 51-56 — `String(telegram_chat_id) === String(VITE_ADMIN_CHAT_ID)` → isAdmin. Reusar.

---

## Não está em escopo (Future)

- Analytics: quantos users viram/dismissaram cada nudge
- Scheduling visual: calendar UI para start_at/end_at
- A/B testing: segmentar nudges por user

---

## Related Documents

- **Epic 026 As-Built:** `plans/specs/026-activation-strategy/`
- **Operacional Guide:** `docs/operations/GUIA_NUDGE_BANNERS.md`
- **FeedbackAdmin Pattern:** `apps/web/src/views/admin/FeedbackAdmin.jsx` (reference)
- **AdminSection:** `apps/web/src/views/redesign/settings/sections/AdminSection.jsx`
