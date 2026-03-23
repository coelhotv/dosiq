# Component Reference — Index & Routing Guide

60+ components split into 5 focused files. **Load only the file(s) relevant to your task.**

---

## Quick Routing

| If you're building... | Load this file |
|----------------------|----------------|
| Forms, inputs, buttons, file upload, search, selects, toggles, rich text | [components-inputs.md](components-inputs.md) |
| Alerts, toasts, modals, drawers, skeletons, spinners, empty states, tooltips | [components-feedback.md](components-feedback.md) |
| Headers, sidebars, nav menus, breadcrumbs, tabs, pagination, accordions | [components-navigation.md](components-navigation.md) |
| Tables, card grids, lists, badges, avatars, carousels, images, video | [components-data.md](components-data.md) |
| Page layout, headings, icons, links, stack/spacing, hero sections | [components-layout.md](components-layout.md) |

---

## Full Component → File Mapping

### components-inputs.md
Button · Button group · Segmented control · Checkbox · Radio button · Toggle ·
Text input · Textarea · Search input · Select · Combobox · Date input · Datepicker ·
Slider · Stepper (quantity) · Rating · Color picker · File · File upload ·
Rich text editor · Form · Fieldset · Label

### components-feedback.md
Alert · Toast · Modal · Drawer · Popover · Tooltip ·
Skeleton · Spinner · Progress bar · Progress indicator (wizard stepper) · Empty state

### components-navigation.md
Header · Footer · Navigation · Breadcrumbs · Tabs · Accordion ·
Dropdown menu · Pagination · Tree view · Skip link

### components-data.md
Table · Card · List · Badge · Avatar · Carousel · Image · Video · Quote

### components-layout.md
Stack · Separator · Hero · Heading · Icon · Link · Visually hidden

---

## Context Shortcuts

**"Build a settings page"**
→ components-navigation.md (tabs, header) + components-inputs.md (form, toggle, select) + components-feedback.md (toast, modal)

**"Build a data table view"**
→ components-data.md (table, badge, avatar) + components-navigation.md (pagination) + components-feedback.md (skeleton, empty state)

**"Build a dashboard"**
→ components-data.md (card, table) + components-layout.md (hero, stack) + components-feedback.md (skeleton, empty state, progress bar)

**"Build a multi-step form"**
→ components-inputs.md (form, fieldset, all inputs) + components-feedback.md (progress indicator, modal, toast) + components-navigation.md (stepper)

**"Build a modal / dialog"**
→ components-feedback.md (modal, alert, toast) + components-inputs.md (button, form)

---

## Page Composition Templates

For full-page patterns (settings, data tables, auth, dashboards, detail views):
→ **[page-templates.md](page-templates.md)**

Use when building complete pages. Each template contains:
- Spatial map (ASCII layout)
- Region anatomy (what exists and why)
- Composition rules (how regions relate)
- State matrix (all UI states)
- Design prompts (questions to answer before building)
