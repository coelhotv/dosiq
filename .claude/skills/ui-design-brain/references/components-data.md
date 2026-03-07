# Component Reference — Data Display & Content

Components for presenting information, entities, media, and structured data to the user.

**When to load this file:** Building tables, card grids, lists, feeds, profiles, dashboards, or any view where the primary job is displaying rather than collecting information.

---

## Contents

- [Table](#table)
- [Card](#card)
- [List](#list)
- [Badge](#badge)
- [Avatar](#avatar)
- [Carousel](#carousel)
- [Image](#image)
- [Video](#video)
- [Quote](#quote)

---

## Table

A structured grid of rows and columns for displaying data — a "data table" when it supports sorting and filtering.

**Best practices:**
- Use a sticky header row for scrollable tables
- Right-align numeric columns for easy visual comparison
- Provide sortable column headers with a clear sort-direction indicator
- Alternate row colors (zebra striping) or use horizontal dividers — not both
- Include a bulk-select checkbox column for actionable tables
- Make tables horizontally scrollable on mobile rather than hiding columns

**Column alignment rules:**
- Left → text, names, descriptions
- Right → numbers, amounts, percentages
- Center → icons, status badges, boolean flags

**Common layouts:**
- Admin data table with search, filters, sort, pagination, and row actions
- Pricing comparison table with feature rows and plan columns
- Financial ledger with date, description, amount, and running balance
- Leaderboard with rank, name, avatar, and score

---

## Card

**Also known as:** Tile

A self-contained content block representing a single entity such as a contact, article, or task.

**Best practices:**
- Single, clear visual hierarchy within each card: media → title → meta → action
- Consistent card height in grid layouts — use `line-clamp` for variable text
- Make the entire card clickable when it represents a navigable entity
- Use subtle shadow OR border — never both on the same card
- Limit card content to essential info; let the detail page carry the rest
- Vary scale or featured treatment when one card deserves more prominence

**Common layouts:**
- Product grid: image / title / price / CTA
- Blog feed: thumbnail / headline / excerpt / date
- Dashboard KPI cards: metric / delta / sparkline
- Team directory: avatar / name / role

---

## List

A component that groups related items into an ordered or unordered sequence.

**Best practices:**
- Use consistent vertical rhythm — equal spacing between items
- Interactive lists: each row needs clear hover and active states
- Include dividers between items in dense lists; omit in spacious layouts
- Support keyboard navigation when the list is interactive
- Use virtualization (windowing) for lists exceeding ~100 items

**Common layouts:**
- Email inbox: sender / subject / preview / timestamp per row
- Settings list: label / value or toggle / optional chevron
- Activity feed: avatar / description / relative timestamp
- File list: icon / name / size / date columns

---

## Badge

**Also known as:** Tag · Label · Chip

A compact label that conveys status, category, or metadata near a larger component.

**Best practices:**
- 1–2 words maximum — badges are labels, not sentences
- Use a limited palette of colors mapped to clear semantic meaning
- WCAG AA contrast between badge text and background (minimum)
- Pill shape (fully rounded) for status badges; rounded rectangle for category tags
- Don't overuse — if everything is badged, nothing stands out

**Semantic color mapping (use muted tones, not saturated):**
- Green (success-100 / success-700) → Active, Published, Complete
- Amber (warning-100 / warning-700) → Pending, In review, Draft
- Red (error-100 / error-700) → Error, Failed, Expired
- Gray (gray-100 / gray-700) → Archived, Disabled, Inactive
- Blue (info-100 / info-700) → New, Info, Beta

**Common layouts:**
- Status indicator on a table row (Active / Pending / Archived)
- Tag cloud beneath a blog post or product card
- Notification count on a nav icon
- Feature label on a pricing tier card

---

## Avatar

A visual representation of a user, displayed as a photo, illustration, or initials.

**Best practices:**
- Support three sizes: small (24–32 px), medium (40–48 px), large (64–80 px)
- Fall back gracefully: photo → initials → generic icon
- Use a subtle ring or border to separate the avatar from its background
- For groups: stack with slight overlap and a '+N' overflow indicator
- Lazy-load images with a placeholder shimmer

**Common layouts:**
- User profile header with name and role
- Comment thread with avatar beside each message
- Team member list with stacked avatar group
- Nav bar user menu trigger

---

## Carousel

**Also known as:** Slider · Slideshow · Gallery

A container that cycles through a set of items horizontally, typically showing one or a few items at a time.

**Best practices:**
- Always provide visible Previous/Next navigation buttons — never auto-advance
- Show pagination dots or a slide counter so users know how many items exist
- Support swipe gestures on touch devices
- Pause any animation on hover and respect `prefers-reduced-motion`
- Carousel is often a last resort — a well-designed grid is usually more scannable

**Common layouts:**
- Product image gallery with thumbnail strip
- Marketing testimonial carousel with quote, name, and photo
- Featured content row with overflow scroll
- Mobile onboarding with step-by-step slides

---

## Image

**Also known as:** Picture

A component for displaying embedded images within a page.

**Best practices:**
- Always provide meaningful alt text (accessibility + SEO)
- Use responsive images (`srcset`) to serve appropriately sized files
- Lazy-load images below the fold for performance
- Reserve space before load (explicit `width`/`height`) to prevent layout shift
- Use modern formats (WebP, AVIF) with fallbacks

**Common layouts:**
- Hero banner with full-width background image
- Product image gallery with thumbnails and zoom
- Blog post featured image above or below the headline
- Avatar or profile photo in a circular frame

---

## Video

**Also known as:** Video player

A media component for playing video content with playback controls.

**Best practices:**
- Show a poster/thumbnail image before playback begins
- Include captions/subtitles for accessibility
- Provide standard controls: play/pause, volume, fullscreen, progress bar
- Lazy-load video content; avoid autoplay with sound
- Respect `prefers-reduced-motion` for background videos

**Common layouts:**
- Product demo video centered on a landing page
- Video player with title, description, and related content
- Background video hero with muted autoplay
- Tutorial video embedded in documentation

---

## Quote

**Also known as:** Pull quote · Block quote

A styled block for displaying quotations — from a person, external source, or a highlighted passage.

**Best practices:**
- Use a distinct visual treatment — large quotation marks, left border accent, or italic text
- Always attribute the quote to its source (name, title, company)
- Keep pull quotes short — they're attention-grabbers, not paragraphs

**Common layouts:**
- Testimonial block with photo / quote / name / title
- Pull quote in a blog post breaking up long text
- Customer quote in a case study with company logo
