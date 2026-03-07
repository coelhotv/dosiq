# Page Composition Templates

Five archetypal page patterns with anatomy, spatial maps, composition rules, and state matrices.

**How to use this file:** Don't copy. Think. Each template is a design brief, not a scaffold.
Read the anatomy, understand *why* each region exists, then compose your own solution
for the specific context in your project.

> A page that looks like these templates but was *reasoned through* will always
> beat a page that copied them. The goal is internalized principles, not reproduced layouts.

---

## Contents

1. [Settings Page](#1-settings-page)
2. [Data Table View](#2-data-table-view)
3. [Authentication Form](#3-authentication-form)
4. [Dashboard Overview](#4-dashboard-overview)
5. [Detail / Profile View](#5-detail--profile-view)

---

## 1. Settings Page

**Purpose:** Let users view and change their preferences. Every interaction must
feel safe (reversible) and feedback must be immediate and legible.

### Spatial Map

```
┌─────────────────────────────────────────────────────┐
│  PAGE HEADER                                        │
│  Title "Settings"          [optional Save button]   │
├────────────────┬────────────────────────────────────┤
│                │  SECTION HEADER                    │
│  SECTION NAV   │  Title + description               │
│                │ ─────────────────────────────────  │
│  · General     │  SETTING ROW                       │
│  · Account   ◄─┤  Label + helper text   [control]  │
│  · Security    │  SETTING ROW                       │
│  · Billing     │  Label + helper text   [control]  │
│  · Appearance  │ ─────────────────────────────────  │
│  · Integrations│  SECTION HEADER                    │
│                │  ...                               │
│                │ ─────────────────────────────────  │
│                │  DANGER ZONE (if applicable)       │
│                │  [Destructive action]              │
└────────────────┴────────────────────────────────────┘
```

### Anatomy

**Page Header**
- One `h1` — never editable inline. Title is the page, not the active section.
- Top-level Save button only if the page uses a deferred-save model.
  If controls take immediate effect (toggles), remove the Save button entirely.
- Breadcrumb if settings is nested (Account → Settings → Security).

**Section Nav (left column)**
- Vertical list of 4–8 sections. Active section has a clear indicator (background fill or left border accent).
- Width: 200–240px fixed on desktop. Collapses to a horizontal tab bar or a `<select>` on mobile.
- Icons optional — use them consistently or not at all. Never mix icon+label sections with label-only.
- Never show more than 8 sections. Group overflow under a parent or promote to subpages.

**Section Header (main column, repeated per section)**
- `h2` title + one sentence description of what this section controls.
- Section header is visually separate from setting rows — use spacing (32px) not a horizontal rule.

**Setting Row (the fundamental unit)**
- Left: Label (`font-weight: 600`) + helper text (muted, `font-size: 13px`) stacked vertically.
- Right: Control (Toggle, Select, Button, Input, Badge).
- Control is right-aligned to the container edge. Never centered.
- Rows separated by a subtle horizontal divider OR by whitespace (16px) — not both.

```
[  Label text                                         [control]  ]
[  Helper text explaining what this setting does                 ]
```

**Danger Zone**
- Always at the bottom of its section. Never at the top.
- Visual differentiation: red-tinted border, or a separating horizontal rule + "Danger zone" label.
- Destructive actions use a ghost button with `--color-error` border and text.
- Opens a confirmation Modal before executing — never executes on single click.

### Composition Rules

1. **Match control to save model**
   - Toggle, Select, Segmented control → immediate effect, no Save needed
   - Text input, Combobox → requires explicit Save (use inline Save button per row, or a section-level Save)
   - Never mix immediate-effect and deferred controls in the same section without clear visual differentiation

2. **One control per row**
   - Never stack two controls side-by-side in the same row. It breaks scannability.
   - Exception: paired controls (start date + end date). Treat as a single logical control.

3. **Helper text is mandatory for non-obvious settings**
   - If the label alone is not 100% self-explanatory, add helper text.
   - Helper text describes the effect, not the mechanic ("Receive an email when someone comments" not "Toggle email notifications")

4. **Section nav and content must stay in sync**
   - Active section must always be visible in nav — auto-scroll the nav if needed.
   - On mobile, selected section appears as the page title or a back-navigable screen.

5. **Feedback must be local, not global**
   - Successful save: inline confirmation near the saved row ("Saved ✓" text fading in) OR a Toast.
   - Error: inline below the field, not a page-level Alert.
   - Do not redirect after saving settings. The user stays on the page.

### State Matrix

| State | What to show |
|-------|-------------|
| Loading section data | Skeleton rows matching the real row structure |
| Saving (deferred model) | Button shows loading spinner, row inputs disabled |
| Save success | Toast ("Changes saved") OR inline "Saved ✓" momentarily visible |
| Save error | Inline error below affected field + Toast with retry |
| Destructive action confirm | Confirmation Modal: describe consequences + require typed confirmation for irreversible actions |
| Empty section | Explain what would appear here + CTA to populate it |

### Design Prompts (answer before building)

- Does this section use immediate-effect controls, deferred Save, or both?
- How does the layout collapse at 768px and 375px?
- Is there a Danger Zone? What confirmation does it require?
- What happens if the user navigates away with unsaved changes?

---

## 2. Data Table View

**Purpose:** Let users scan, search, filter, and act on a collection of entities.
The primary cognitive task is *finding one item* or *acting on many*.

### Spatial Map

```
┌─────────────────────────────────────────────────────────────┐
│  PAGE HEADER                                                │
│  Title "Projects"      [secondary actions]  [Primary CTA]  │
├─────────────────────────────────────────────────────────────┤
│  TOOLBAR                                                    │
│  [Search input]  [Filter chips]  [Sort by ▾]  [View ▾]    │
├─────────────────────────────────────────────────────────────┤
│  ACTIVE FILTERS (conditional — only when filters applied)  │
│  [Filter A ×]  [Filter B ×]              [Clear all]       │
├─────────────────────────────────────────────────────────────┤
│  TABLE                                                      │
│  [☐] Col A     Col B        Col C      Col D    Actions    │
│  ─────────────────────────────────────────────────────────  │
│  [☐] Value     Value        [Badge]    12,400   [⋮]        │
│  [☐] Value     Value        [Badge]    8,200    [⋮]        │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  BULK ACTION BAR (conditional — only when rows selected)   │
│  3 selected   [Action A]  [Action B]  [Delete ×]           │
├─────────────────────────────────────────────────────────────┤
│  TABLE FOOTER                                               │
│  Showing 1–25 of 143 results        [Pagination controls]  │
└─────────────────────────────────────────────────────────────┘
```

### Anatomy

**Page Header**
- `h1` with entity name (plural: "Projects", "Invoices", "Users").
- Secondary actions (Export, Import) as ghost/outlined buttons — they are not the main action.
- Primary CTA ("Create project") as a filled button. One primary action, always.

**Toolbar**
- Search input is the leftmost element — highest-frequency action gets prime position.
- Filter controls follow search. Prefer dropdown filter pills over a filter drawer for ≤4 filters.
- Sort and View mode controls are the lowest priority — rightmost, visually quieter.
- Toolbar is sticky when the table scrolls (stays below a sticky page header).

**Active Filters Bar**
- Appears conditionally, only when at least one filter is active.
- Each active filter shown as a removable chip with an × control.
- "Clear all" is right-aligned and visible only when 2+ filters are active.
- Never show this bar when no filters are applied — empty state is confusing.

**Table**
- First column: checkbox for bulk selection.
- Column order: most identifying → most descriptive → status → numeric → actions.
- Actions column: always last, always right-aligned. Kebab (⋮) for row-level actions.
- Column headers: left-aligned for text, right-aligned for numbers. Sortable columns show a sort icon.
- Row height: 48–56px for comfortable touch and readability.

**Bulk Action Bar**
- Appears at the bottom of the viewport (fixed or sticky) when ≥1 row is selected.
- Shows count of selected items. Offers contextual actions valid for the selection.
- Destructive action (Delete) is visually separated (right side) and colored with `--color-error`.
- Disappears when all rows are deselected.

**Table Footer**
- "Showing X–Y of Z results" on the left — tells users where they are in the dataset.
- Pagination or "Load more" on the right.
- Rows-per-page selector optional for admin/power-user contexts.

### Composition Rules

1. **Search, filter, and sort are independent — design them independently**
   - Search filters by text across all text fields.
   - Filters narrow by specific attribute values.
   - Sort orders existing results — it doesn't reduce them.
   - Never conflate them into a single "Search & Filter" component. Their affordances are different.

2. **The empty state depends on context**
   - No data at all (first time): illustration + CTA to create the first item.
   - No results from search: "No results for 'query'" + suggestion to refine or clear.
   - No results from filter: "No items match these filters" + [Clear filters] button.
   - Never show the same empty state for all three conditions.

3. **Row actions vs bulk actions are different affordances**
   - Row action (kebab ⋮): acts on one specific item. Appears on hover or is always visible.
   - Bulk action: acts on a selection. Never show in a row — it lives in the bulk action bar.

4. **Status should be scannable in under 1 second**
   - Status column uses Badges with consistent semantic colors.
   - If status is the primary thing users scan for, put it in column 2 (after identifier).
   - Never put status in the last column — it's buried.

5. **Responsive strategy must be explicit**
   - At 768px: hide the least-important columns (but never status, never identifier).
   - At 375px: collapse to a card list. Each card shows: identifier + status + primary value + action.
   - Never hide the Actions column on any breakpoint.

### State Matrix

| State | What to show |
|-------|-------------|
| Initial load | Full table skeleton — rows with placeholder shapes |
| Search in progress | Inline spinner in search input; table dims slightly |
| No results (search) | Empty state specific to "no search results" |
| No results (filter) | Empty state specific to "no filter matches" + Clear filters |
| No data at all | Empty state with CTA to create first item |
| Row action loading | Spinner in the row, other rows remain interactive |
| Bulk action loading | Bulk action bar shows progress; table dims |
| Delete confirmation | Modal: "Delete 3 projects? This cannot be undone." |
| Row selected | Checkbox fills, row has subtle highlight, bulk bar appears |

### Design Prompts (answer before building)

- What is the primary action a user takes when they find an item? (Edit? View? Archive?)
- Which columns are sortable? Which are filterable?
- What does "empty" mean in context — no data ever, or no results right now?
- Does the table need inline editing or does editing happen in a Drawer / page?

---

## 3. Authentication Form

**Purpose:** Let the user enter credentials and gain access. Every element of friction
must be intentional. Cognitive load must be near zero.

### Spatial Map

```
         ┌──────────────────────────────┐
         │  BRAND MARK                  │
         │  Logo or wordmark, centered  │
         ├──────────────────────────────┤
         │  FORM CARD                   │
         │                              │
         │  Heading: "Sign in"          │
         │  Subtext: one sentence       │
         │                              │
         │  [  Email input           ]  │
         │  [  Password input        ]  │
         │                Forgot pw? →  │
         │                              │
         │  [  Sign in button (full) ]  │
         │                              │
         │  ─────────── or ──────────── │
         │                              │
         │  [  Continue with Google  ]  │
         │  [  Continue with GitHub  ]  │
         │                              │
         │  Don't have an account?      │
         │  Sign up →                   │
         └──────────────────────────────┘
         Background: subtle texture, gradient,
         or illustration — never flat white.
```

### Anatomy

**Brand Mark**
- Logo above the form card. Centered. Links to the marketing homepage.
- Never inside the form card — the card is for the task, not for branding.
- Sufficient vertical space between logo and card (48–64px).

**Form Card**
- Contained surface: white/surface background, subtle shadow, `border-radius: 12–16px`.
- Optimal width: 400–440px. Never full-width on desktop.
- Internal padding: 32–40px. Never ≤24px — it feels cramped.

**Heading + Subtext**
- `h1` heading: "Sign in", "Create account", "Reset your password". Minimal — one to three words.
- Subtext: one sentence of context only when truly necessary ("Sign in to your workspace").
  Omit if the heading is already self-explanatory.
- No marketing copy. No list of benefits. This is a task screen.

**Input Fields**
- Labels above inputs — always. No floating labels (disappear on type, cognitive load).
- Password input: always include a "show/hide" toggle (eye icon on the right).
- Email field: `type="email"`, `autocomplete="email"`.
- Password field: `type="password"`, `autocomplete="current-password"` (or `new-password` for signup).
- Tab order must be: email → password → submit. Nothing else in between.

**Forgot Password Link**
- Right-aligned below the password field. Never below the submit button.
- Small, muted — it's an escape hatch, not a call to action.

**Submit Button**
- Full width of the form. This reinforces it's the primary action.
- Verb-first label: "Sign in", "Create account", "Send reset link".
- Loading state while the request is in flight: spinner inside button, button disabled.

**Social Auth Divider**
- Only shown if social options are available. "or" centered between two lines.
- Social buttons: full width, outlined style, provider icon + "Continue with [Provider]".
- Never use provider brand colors for the button background (legal and design reasons).
  Use neutral outlined buttons with the provider icon.

**Footer Link**
- The alternative action: "Don't have an account? Sign up →"
- Small and muted. It's a navigation link, not a competing CTA.
- Right-aligned or centered below the card — never inside the card.

### Composition Rules

1. **One job, zero distractions**
   - No navigation header. No sidebar. No unrelated links.
   - The only interactive elements are: the form, the forgot password link, social auth, and the footer link.

2. **Autofocus the first field**
   - The email input should receive `autofocus` on page load.
   - On mobile, this triggers the keyboard — test that it doesn't obscure the submit button.

3. **Error messages are not punishments**
   - Failed login: don't say "Invalid email" or "Wrong password" separately (security).
     Say: "Email or password is incorrect."
   - Validation errors: appear on blur, not on keystroke.
   - Error message appears below the field with a red border. The message text is specific:
     "Please enter a valid email address" not "Invalid input".

4. **The background is not decoration — it's context**
   - A flat white page with a centered form signals no craft.
   - Use: a subtle gradient, a mesh, a soft geometric pattern, a brand illustration, or
     a blurred atmospheric image. The form card floats above it.

5. **Multi-step auth is still one visual context**
   - If the auth is multi-step (email → password → 2FA), each step should feel like
     a continuation of the same card, not a page navigation.
   - Animate the transition (slide or fade) to communicate continuity.

### State Matrix

| State | What to show |
|-------|-------------|
| Default | Empty form, autofocus on email |
| Typing | Real-time format feedback (email validity) only after first blur |
| Submitting | Button spinner, all inputs disabled |
| Auth failed | Inline error: "Email or password is incorrect." Reset button to active. |
| Rate limited | Alert: "Too many attempts. Try again in 5 minutes." |
| Success | Redirect or brief success state — don't linger on this screen |
| Forgot password sent | Replace form with confirmation: "Check your email" + back link |
| Social auth loading | Full-width button shows spinner, other options disabled |

### Design Prompts (answer before building)

- Is this sign-in, sign-up, or password reset? Each has a different heading and field set.
- Are social auth options available? If so, which providers?
- Is there a multi-step flow (email first, then password)? How does it animate between steps?
- What happens after successful authentication — redirect or inline state change?

---

## 4. Dashboard Overview

**Purpose:** Give users an at-a-glance snapshot of what matters. The user's
question on arrival is always: "Is everything okay? What needs my attention?"

### Spatial Map

```
┌──────────────────────────────────────────────────────────────┐
│  APP SHELL — Persistent header + sidebar (see Navigation)    │
├──────────────────────────────────────────────────────────────┤
│  PAGE HEADER                                                 │
│  "Good morning, Ana"    [Date range filter]  [Export ▾]     │
├──────────────────────────────────────────────────────────────┤
│  KPI STRIP                                                   │
│  [KPI Card]  [KPI Card]  [KPI Card]  [KPI Card]             │
├─────────────────────────────┬────────────────────────────────┤
│  PRIMARY CHART              │  SECONDARY CHART / WIDGET      │
│  (60–65% width)             │  (35–40% width)               │
│                             │                                │
│                             │                                │
├─────────────────────────────┴────────────────────────────────┤
│  SUPPORTING CONTENT ROW                                      │
│  [Recent activity list]     [Quick actions or top items]     │
└──────────────────────────────────────────────────────────────┘
```

### Anatomy

**Page Header**
- Personalized greeting (if user is identifiable) or plain page title.
- Date range filter on the right — it governs all metrics on the page.
- Export is a secondary action — ghost button, lower visual weight.

**KPI Strip (Key Performance Indicators)**
- 3–5 cards maximum. More than 5 and nothing is "key" anymore.
- Each KPI card anatomy: Metric label → Big number → Delta (vs last period) → Sparkline (optional).
- Delta must communicate direction AND magnitude: "+12% vs last month" with a colored indicator.
- Cards equal width. Never vary card size in the KPI strip.
- Cards link to the detail view for that metric — the entire card is clickable.

**Primary Chart**
- Takes 60–65% of the horizontal space. It's the dominant visual.
- Choose chart type based on what the data *is*: line for trends over time,
  bar for comparisons, donut for part-to-whole. Never choose for aesthetics alone.
- Chart title + time period always visible. Legend always readable without hovering.
- Data labels or tooltips on hover — never always visible (clutters the visual).

**Secondary Chart / Widget**
- Takes 35–40% of horizontal space. Complements the primary chart — shows a different
  dimension of the same story, not the same data again.
- Alternatively: a leaderboard, top-N list, or a status summary widget.

**Supporting Content Row**
- Recent activity list: timestamped event log of the most recent actions in the system.
  Shows what happened, who did it, and when. Linked to the relevant entities.
- Quick actions or top items: most-accessed items, recent records, or pinned content.

### Composition Rules

1. **Establish a single visual hierarchy: KPI → trend → detail**
   - The eye must travel top-to-bottom from the most abstract (a single number) to
     the most detailed (event logs). Never invert this.

2. **Every metric must answer a question a human actually asks**
   - Bad KPI: "Total events: 48,302". Nobody asks that.
   - Good KPI: "Revenue this month: $24,100 (+8% vs last month)". Real question, real answer.

3. **Date range governs everything — make it visible and consistent**
   - When the user changes the date range, ALL charts and KPIs update.
   - The active date range should be visible at all times, not just in the filter control.
   - Show it in each chart's subtitle: "Revenue · Last 30 days".

4. **Loading state is a design moment, not an afterthought**
   - KPI strip: skeleton cards matching the real card dimensions.
   - Charts: skeleton placeholder matching the chart's aspect ratio.
   - Stagger the loading: KPIs first, then charts, then supporting content.

5. **The dashboard must function without the charts**
   - If JS fails, the API is slow, or charts aren't supported, the page should still
     convey the core information through the KPI strip and activity list.

### State Matrix

| State | What to show |
|-------|-------------|
| Loading | Skeleton KPI cards + skeleton chart placeholders |
| No data for period | KPI cards showing 0 with neutral delta; chart shows empty state |
| Partial data | Show what's available, mark incomplete data with a note |
| Error fetching data | Inline error per widget with a retry action; other widgets load normally |
| Date range changed | Brief loading state per widget; don't blank the page |
| First-time user (no data) | Empty state with onboarding prompt, not a ghost dashboard |

### Design Prompts (answer before building)

- What are the 3–5 KPIs that matter most to this user role?
- What question does the primary chart answer?
- What time period granularity does the data support (hourly, daily, monthly)?
- Is this a personal dashboard or a shared/team view?

---

## 5. Detail / Profile View

**Purpose:** Show everything there is to know about one entity (a user, project,
order, contact) and let the user take actions specific to that entity.

### Spatial Map

```
┌─────────────────────────────────────────────────────────────┐
│  BREADCRUMB  Projects / Acme Corp Project                   │
├────────────────────────────┬────────────────────────────────┤
│  ENTITY HEADER             │                                │
│  [Avatar / thumbnail]      │  SIDEBAR / METADATA PANEL     │
│  Name / Title  [Status]    │                                │
│  Meta line (role, date...) │  Key properties               │
│                            │  (owner, created, tags, etc.) │
│  [Primary action]          │                                │
│  [Secondary actions ▾]     │  [Quick actions]              │
├────────────────────────────┤                                │
│  TAB BAR                   │  Activity feed                 │
│  Overview · Activity · ... │  (recent events on entity)    │
├────────────────────────────┤                                │
│  TAB CONTENT               │                                │
│  (changes per active tab)  │                                │
│                            │                                │
└────────────────────────────┴────────────────────────────────┘
```

### Anatomy

**Breadcrumb**
- Always present on detail views. The user arrived from somewhere and needs a way back.
- Shows the path to this entity: "Customers / Acme Corp" or "Projects / Q4 Launch / Tasks".
- Current entity (last item) is not a link.

**Entity Header**
- The entity's identity at maximum prominence.
- Avatar or thumbnail if the entity has one (user photo, project cover, product image).
- Name/title as `h1`. One only per page.
- Status Badge — must be immediately visible without scanning. Placed right of the title.
- Supporting meta (role, date, company, ID) — muted, small, one line if possible.

**Actions**
- Primary action: the most common thing someone does to this entity (Edit, Message, Assign).
  Filled button, always visible.
- Secondary actions: dropdown (⋮ or "More actions") containing Edit, Duplicate, Archive, Delete.
- Destructive actions (Delete) are always inside the secondary dropdown — never primary.

**Tab Bar**
- Segments the entity's information by type or relationship.
- Standard tabs: Overview (summary), Activity (history), related entity (e.g. Files, Tasks, Invoices).
- 2–6 tabs. If a tab has no content yet, still show it with a count of zero — don't hide it.

**Tab Content — Overview**
- Summary of the most important properties and relationships.
- Never duplicate what's in the sidebar. The overview supplements it.

**Tab Content — Activity**
- Chronological log of events related to this entity.
- Each entry: actor / action / timestamp / optional detail link.
- Load more or paginate — never truncate silently.

**Sidebar / Metadata Panel**
- Right column (or below header on mobile). Contains properties that don't change often.
- Owner, dates, tags, related entities, custom fields.
- Inline edit on click: the field becomes an input on click, saves on blur/Enter.
- Group related properties under subtle headings.

### Composition Rules

1. **The entity's identity answers "What am I looking at?" in under 2 seconds**
   - Name + status + one meta line must be visible without scrolling.
   - If the entity needs more than 3 seconds to identify, the header has failed.

2. **Sidebar is for stable metadata; tabs are for dynamic content**
   - Metadata that rarely changes: owner, creation date, tags, custom fields → sidebar.
   - Content that grows over time: activity, files, tasks, comments → tabs.
   - Never put activity logs in the sidebar or key metadata inside tabs.

3. **Inline edit in the sidebar — not a separate edit page for simple fields**
   - Single-field changes (rename, reassign, retag) should be inline.
   - Multi-field forms warrant an edit modal or an edit mode toggle.
   - After inline save, show a brief "Saved" confirmation and return to read mode.

4. **Tab counts communicate at a glance**
   - Show counts on tabs: "Tasks (12)", "Files (3)", "Comments (0)".
   - A tab with count 0 is useful information — the user knows there's nothing there.
   - Counts should update live when content is added (WebSocket or polling).

5. **Breadcrumb must reflect the navigation path that brought the user here**
   - If the user arrived from the Projects list, breadcrumb shows "Projects / [name]".
   - If they arrived from a dashboard widget, the breadcrumb still shows the canonical path.
   - Never show a breadcrumb that can't be navigated.

### State Matrix

| State | What to show |
|-------|-------------|
| Loading entity | Skeleton header + skeleton sidebar + skeleton tab content |
| Entity not found | 404 within the app shell: clear message + link back to list |
| Entity archived/deleted | Banner at the top: "This project was archived on [date]" + restore action |
| Inline edit active | Field becomes an input, focused; save/cancel appear below |
| Inline save loading | Field shows spinner, disabled; cancels if user navigates |
| Tab loading | Tab content shows skeleton; other tabs remain navigable |
| Activity — load more | "Load more" button at the bottom of the list; not infinite auto-scroll |

### Design Prompts (answer before building)

- What is the primary action someone takes when they open this entity?
- What information must be visible above the fold without scrolling?
- What tabs does this entity need? What is in each one?
- Does inline editing make sense here, or does complexity warrant a separate edit form?
