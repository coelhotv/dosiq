# Component Reference — Feedback & Overlays

Components that communicate system status, confirm actions, show loading states, and focus user attention.

**When to load this file:** Handling loading states, errors, confirmations, notifications, blocking flows, or any moment where the interface must respond to an event or communicate status.

---

## Contents

- [Alert](#alert)
- [Toast](#toast)
- [Modal](#modal)
- [Drawer](#drawer)
- [Popover](#popover)
- [Tooltip](#tooltip)
- [Skeleton](#skeleton)
- [Spinner](#spinner)
- [Progress bar](#progress-bar)
- [Progress indicator](#progress-indicator)
- [Empty state](#empty-state)

---

## Alert

**Also known as:** Notification · Feedback · Message · Banner · Callout

A prominent message that communicates important information or status changes.

**Best practices:**
- Use semantic color coding: red for errors, amber for warnings, green for success, blue for info
- Include a clear, actionable message — not just a status label
- Provide a dismiss action for non-critical alerts
- Position inline alerts close to the relevant content, not floating arbitrarily
- Use an icon alongside color for color-blind accessibility
- Keep text to one or two sentences maximum

**Common layouts:**
- Top-of-page banner for system-wide announcements
- Inline validation message beneath a form input
- Toast notification stack in the bottom-right corner
- Contextual warning inside a card or settings section

**When to use Alert vs Toast:**
- Alert → persistent status that requires user attention or action
- Toast → transient confirmation that auto-dismisses

---

## Toast

**Also known as:** Snackbar

A brief, non-blocking notification that appears in a floating layer above the interface.

**Best practices:**
- Auto-dismiss after 4–6 seconds for non-critical toasts
- Allow manual dismissal with a close button or swipe gesture
- Stack multiple toasts with newest on top
- Position consistently — bottom-right is most common on desktop
- Include an action link for undoable operations ('Undo' for destructive actions)
- Limit to one line of text — toasts are for brief confirmations, not explanations

**Common layouts:**
- Success toast after saving a form ('Changes saved')
- Error toast with retry action after a failed request
- Undo toast after deleting an item ('Item deleted · Undo')
- Notification toast with avatar and brief message preview

---

## Modal

**Also known as:** Dialog · Popup · Modal window

An overlay that demands the user's attention — interaction is required before returning to the content beneath.

**Best practices:**
- Use sparingly — only for actions that require immediate attention or focused input
- Always provide a clear close mechanism: X button, Cancel, and Escape key
- Trap focus within the modal while it's open (accessibility requirement)
- Return focus to the trigger element when the modal closes
- Keep content concise — if it requires scrolling, consider a full page or Drawer instead
- Use a semi-transparent backdrop to dim underlying content

**Common layouts:**
- Confirmation dialog with message and two action buttons (Cancel / Confirm)
- Form modal for quick data entry (create, edit — 1 to 3 fields)
- Image/media preview lightbox
- Onboarding or announcement with illustration and CTA

**When to use Modal vs Drawer vs Page:**
- Modal → focused, brief, < 3 fields, reversible
- Drawer → secondary detail, user stays in context
- New page → complex, multi-step, or destructive

---

## Drawer

**Also known as:** Tray · Flyout · Sheet

A panel that slides in from a screen edge to reveal secondary content or actions — user stays in context.

**Best practices:**
- Use for secondary content or focused sub-tasks that don't need a full page
- Right side for detail panels; left side for navigation
- Always include a clear close button and support Escape to dismiss
- Dim the background with a semi-transparent overlay
- Width: 320–480 px on desktop; full-width on mobile

**Common layouts:**
- Mobile navigation menu from the left
- Shopping cart preview panel from the right
- Detail/edit panel in a master-detail layout
- Notification center from the right

---

## Popover

A floating panel that appears on click near its trigger element — unlike a Tooltip, it can contain interactive content.

**Best practices:**
- Trigger via click, not hover — supports touch and accessibility
- Position intelligently to avoid clipping at viewport edges
- Include a subtle arrow/caret pointing to the trigger
- Dismiss when clicking outside or pressing Escape
- Keep content brief — it's not a modal; use a drawer for more content

**Common layouts:**
- Color picker dropdown triggered by a swatch
- User profile preview card on avatar click
- Quick-edit popover for inline data modification
- Help content with text + link

---

## Tooltip

**Also known as:** Toggletip

A small floating label that reveals supplementary information about an element, typically on hover.

**Best practices:**
- Use for supplementary info only — never for essential content
- Trigger on hover (desktop) and long-press (mobile); avoid click-to-show
- Show after a short delay (~300 ms); hide on mouse leave
- Keep text to a single sentence or a few words
- Position to avoid obscuring the trigger or important content
- Use a toggletip (click-triggered) when content includes interactive elements

**Common layouts:**
- Icon button tooltip showing the action name
- Truncated text tooltip revealing the full string on hover
- Info (ⓘ) icon tooltip explaining a form field's purpose
- Chart data point tooltip showing exact values

**Tooltip vs Popover:**
- Tooltip → hover-triggered, text only, no interaction
- Popover → click-triggered, can contain links, buttons, inputs

---

## Skeleton

**Also known as:** Skeleton loader

A low-fidelity placeholder that mimics the shape of content while it loads.

**Best practices:**
- Match the skeleton shape to the actual content layout as closely as possible
- Use a shimmer/pulse animation — not a spinner, not a static gray block
- Avoid showing skeletons for loads faster than 300 ms (flash of loading)
- Show skeleton immediately on navigation; replace atomically when data arrives
- Use muted, low-contrast colors (light gray on white) — they should recede visually

**Common layouts:**
- Card grid with image placeholder, title bar, and text lines
- List/feed with repeating row shapes
- Profile page with avatar circle and text blocks
- Dashboard with chart placeholder and metric blocks

---

## Spinner

**Also known as:** Loader · Loading

An animated indicator showing that a background process is running.

**Best practices:**
- Show only after a ~300 ms delay — avoids flicker on fast responses
- Size proportionally: inline (16 px), inside button (20 px), page-level (40+ px)
- Use a single, brand-consistent spinner design throughout
- Provide aria-label or sr-only text ('Loading…') for screen readers
- Prefer Skeleton screens over spinners when the layout is predictable

**Use Spinner when:** The layout after loading is unpredictable or non-uniform.
**Use Skeleton when:** You know exactly what the content structure will look like.

**Common layouts:**
- Centered full-page spinner during initial app load
- Inline spinner inside a button during form submission
- Small spinner beside a table cell during lazy-loaded data fetch
- Overlay spinner on a card while its content refreshes

---

## Progress bar

**Also known as:** Progress

A horizontal indicator showing how far a long-running task has progressed.

**Best practices:**
- Determinate bar when progress is measurable; indeterminate when unknown
- Include a percentage label for accessibility and clarity
- Color by state: blue/green normal, red error, amber warning
- Animate smoothly — no jarring jumps between values
- Keep the bar visually proportional to its container (not too thin)

**Common layouts:**
- File upload progress beneath the file name
- Onboarding completion bar in sidebar or header
- Course progress bar at top of a lesson page
- System resource usage bar in a monitoring dashboard

---

## Progress indicator

**Also known as:** Progress tracker · Steps · Timeline · Stepper (wizard)

A visual display of how far a user has advanced through a multi-step process.

**Best practices:**
- Clearly distinguish completed, current, and upcoming steps
- Use numbered or labeled steps — not just dots
- Allow clicking back to completed steps if the flow permits it
- Keep the total step count visible so users know the full scope
- Vertically stack steps on mobile for readability

**Common layouts:**
- Multi-step checkout (Cart → Shipping → Payment → Confirmation)
- Account setup wizard (profile, preferences, verification)
- Application form with multiple sections
- Project timeline with milestones

---

## Empty state

A placeholder shown when a view has no data to display — paired with a helpful action or suggestion.

**Best practices:**
- Include a clear illustration or icon to soften the empty feeling
- Write a helpful headline — positive framing: 'No projects yet', not 'You have no projects'
- Provide a primary CTA that guides the user toward the next step
- Show empty state in-place within the container, not as a full-page takeover

**Anatomy:**
```
[Icon or subtle illustration — 48px, muted color]
[Headline — "No projects yet"]
[One-line body — "Create your first project to get started"]
[Primary CTA button — "Create project"]
```

**Common layouts:**
- Empty dashboard with 'Create your first project' CTA
- Search results with 'No results found' and suggestions
- Empty inbox with illustration and encouraging message
- Empty table with inline prompt to add data
