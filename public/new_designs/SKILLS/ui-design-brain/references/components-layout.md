# Component Reference — Layout & Structure Primitives

Foundational elements that define page structure, visual hierarchy, and spatial relationships between content.

**When to load this file:** Structuring pages, establishing visual hierarchy through headings and separators, composing layouts with Stack, or working with icons, links, and accessibility primitives.

---

## Contents

- [Stack](#stack)
- [Separator](#separator)
- [Hero](#hero)
- [Heading](#heading)
- [Icon](#icon)
- [Link](#link)
- [Image (layout role)](#image-layout-role)
- [Visually hidden](#visually-hidden)

---

## Stack

A layout utility that applies uniform spacing between its child components.

**Best practices:**
- Use a consistent spacing scale (4, 8, 12, 16, 24, 32, 48 px)
- Default to vertical stacking; support horizontal for inline element groups
- Use Stack as a layout primitive to enforce consistent spacing across components — no ad-hoc margins
- Nest stacks for complex layouts (horizontal stack of vertical stacks)

**Spacing guide:**
- `gap-1` (4px) → icon + label pairs, badge internal padding
- `gap-2` (8px) → tight groups, compact form fields
- `gap-4` (16px) → standard content spacing
- `gap-6` (24px) → sections within a component
- `gap-8` (32px) → major layout sections

**Common layouts:**
- Vertical stack of form fields with uniform gap
- Horizontal stack of action buttons
- Card content: title → description → meta → action

---

## Separator

**Also known as:** Divider · Horizontal rule · Vertical rule

A visual divider — typically a line — used to separate content sections.

**Best practices:**
- Use subtle, low-contrast separators — they guide the eye, not dominate it
- Prefer spacing over separators when grouping is already clear from proximity
- Horizontal rules between content sections; vertical rules between columns
- Never use a separator as a substitute for intentional whitespace

**Common layouts:**
- Horizontal divider between list items or content sections
- Vertical separator between sidebar and main content
- Labeled divider with centered text ('or', 'continue with')

---

## Hero

**Also known as:** Jumbotron · Banner

A prominent banner near the top of a page, typically featuring a full-width area with a headline and CTA.

**Best practices:**
- Lead with a compelling headline — clarity over cleverness
- Limit to one primary CTA, optionally one secondary CTA
- Ensure text contrast against background images (overlay or safe text zone)
- Hero height should invite scrolling — it should not dominate the entire viewport
- Use `clamp()` for responsive headline sizing

**Headline sizing:**
```css
font-size: clamp(40px, 6vw, 72px);
line-height: 1.05;
letter-spacing: -0.02em; /* tighten at large sizes */
```

**Common layouts:**
- Split: headline + CTA on left / product screenshot on right
- Full-bleed background image with centered text overlay
- Minimal: large headline + subtext + inline email capture
- Video background hero with centered headline and CTA

---

## Heading

A title element that introduces and labels a content section.

**Best practices:**
- Strict heading hierarchy (h1 → h2 → h3) — never skip levels
- One h1 per page — it's the page title
- Keep headings concise and descriptive — they form the document outline
- Use consistent sizing, weight, and spacing across heading levels
- Don't use headings for visual emphasis on non-title text — use strong or styled spans

**Type scale for headings:**
```
h1: 32–48px, weight 800–900, tight tracking (-0.02em)
h2: 24–32px, weight 700–800, tight tracking (-0.01em)
h3: 18–24px, weight 600–700, normal tracking
h4: 15–18px, weight 600, normal tracking
```

**Common layouts:**
- Page title (h1) with section headings (h2) and subsections (h3)
- Card title as h3 within a section
- Dashboard section headers separating widget groups

---

## Icon

A small graphic symbol that communicates purpose or meaning at a glance.

**Best practices:**
- Use a consistent icon library throughout the product — `lucide-react` is preferred
- Use one style throughout (outlined or filled, not mixed)
- Size icons to align with adjacent text — typically 16–24 px
- Pair icons with text labels for clarity; icon-only buttons always need a Tooltip
- `aria-hidden="true"` for decorative icons; `aria-label` for functional icon-only buttons

**Size guide:**
- 16px → inline with small text, inside badges
- 20px → standard UI icons alongside body text
- 24px → nav items, button icons, section headers
- 32px+ → feature icons, empty state illustrations

**Common layouts:**
- Navigation item with icon + label
- Action button with icon + text ('Download report')
- Status indicator icon beside a label (check, warning, error)
- Icon-only toolbar with Tooltips

---

## Link

**Also known as:** Anchor · Hyperlink

A clickable reference to another resource — external page or location within the current document.

**Best practices:**
- Make link text descriptive — avoid 'click here' or 'learn more' in isolation
- Underline links in body text for discoverability; nav links may rely on context cues
- Use a distinct color from surrounding text
- Show a visited state for content-heavy pages to aid navigation
- External links should indicate they open in a new tab (icon or aria-label)

**Common layouts:**
- Inline text link within a paragraph
- Standalone link beneath a card ('View details →')
- Footer link columns for site navigation
- Breadcrumb links in a hierarchy path

---

## Image (layout role)

For image display specs and best practices focused on content presentation, see [components-data.md](components-data.md).

This entry covers image as a **layout element** — used for structure, not content.

**Layout-specific rules:**
- Use `object-fit: cover` for fixed-dimension image containers
- Use `aspect-ratio` CSS to reserve space before load and prevent layout shift
- Background images in hero sections: always add a darkening overlay for text legibility
- `loading="lazy"` on all images below the fold

```css
/* Reliable image container pattern */
.image-container {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

---

## Visually hidden

**Also known as:** Screen-reader only · sr-only

Content that is hidden visually but remains accessible to screen readers and assistive technology.

**Best practices:**
- Never use `display: none` or `visibility: hidden` — these hide from screen readers too
- Use the clip-rect technique (`.sr-only` in Tailwind) — it removes from visual layout but not from accessibility tree
- Apply to: skip links, icon-only button labels, form field instructions, decorative content descriptions

**The correct CSS pattern:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Common uses:**
- Hidden label for an icon-only close button (`<span className="sr-only">Close</span>`)
- Screen-reader instructions for a complex interactive widget
- Off-screen text providing context for a data visualization
