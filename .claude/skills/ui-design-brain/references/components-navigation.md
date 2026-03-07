# Component Reference — Navigation & Wayfinding

Components that help users understand where they are, move between views, and control page-level flow.

**When to load this file:** Building headers, sidebars, menus, tab bars, breadcrumbs, pagination, or any multi-step or multi-view navigation structure.

---

## Contents

- [Header](#header)
- [Footer](#footer)
- [Navigation](#navigation)
- [Breadcrumbs](#breadcrumbs)
- [Tabs](#tabs)
- [Accordion](#accordion)
- [Dropdown menu](#dropdown-menu)
- [Pagination](#pagination)
- [Tree view](#tree-view)
- [Skip link](#skip-link)

---

## Header

The persistent top-of-page region containing the site brand, primary navigation, and key actions.

**Best practices:**
- Keep height compact (56–72 px) to preserve content space
- Logo/brand on the left; primary navigation center or right
- Sticky on long pages — consider auto-hide on scroll-down
- Collapse to hamburger (or bottom tab bar) gracefully on mobile
- Maintain visual separation from page content (border-bottom or subtle shadow)

**Common layouts:**
- SaaS app: logo + nav links + search + user avatar
- Marketing site: logo + nav links + CTA button
- Dashboard: breadcrumbs + page title + action buttons
- Minimal: centered logo + hamburger

---

## Footer

A region at the bottom of a page containing copyright info, legal links, or secondary navigation.

**Best practices:**
- Organize links into clear columns by category
- Include essential legal links (Privacy Policy, Terms of Service)
- Keep visually distinct but not distracting — muted background
- Include social links and newsletter signup if appropriate
- Ensure all links are keyboard-navigable

**Common layouts:**
- Multi-column with link groups, logo, and copyright
- Minimal SaaS footer with product links and social icons
- E-commerce with help, shipping, returns, and payment icons
- Single-line with copyright and key legal links

---

## Navigation

**Also known as:** Nav · Menu

A region containing links for moving between pages or sections.

**Best practices:**
- Limit primary navigation to 5–7 items; group extras under 'More' or sub-menus
- Clearly indicate the current/active page at all times
- Use consistent iconography alongside text labels for scannability
- Collapse to a hamburger menu or bottom tab bar on mobile
- Ensure all items are reachable via keyboard (Tab + Enter)

**Navigation patterns by context:**
- **Top nav horizontal** → marketing sites, SaaS apps (5–7 items)
- **Vertical sidebar** → icon + label with collapsible groups; 56–240 px wide
- **Bottom tab bar** → mobile apps; 4–5 icons max (Home, Search, Create, Notifications, Profile)
- **Mega-menu** → large content sites with deep category hierarchies

---

## Breadcrumbs

**Also known as:** Breadcrumb trail

A trail of links showing where the current page sits within the navigational hierarchy.

**Best practices:**
- Show the full hierarchy path; truncate middle segments on mobile with an ellipsis (…) menu
- The current page is the last item and should not be a link
- Use a subtle separator (/ or ›) with adequate spacing
- Place breadcrumbs near the top of content, below the header
- Sentence-case for readability

**Common layouts:**
- E-commerce: category → subcategory → product
- Documentation: section → guide → page
- Dashboard drill-down: overview → report → detail
- File manager path display

---

## Tabs

**Also known as:** Tabbed interface

A set of selectable labels that switch between content panels, keeping the layout compact.

**Best practices:**
- Limit to 2–7 tabs; more need a scrollable tab bar or dropdown overflow
- Clearly indicate active tab with a bottom border, background fill, or bold text
- Use short, descriptive labels (1–2 words)
- Place tab content immediately below the tab bar — no visual gap
- Keyboard: arrow keys between tabs, Tab key moves to content
- Consider swapping tabs for an Accordion on narrow viewports

**Common layouts:**
- Product page: Description / Reviews / Specifications
- Settings page: General / Security / Notifications
- Profile page: Activity / Projects / Settings
- Dashboard: Overview / Analytics / Logs

**Tabs vs Segmented control:**
- Tabs → switch between panels with distinct content areas
- Segmented control → switch a view mode or filter; content area stays the same

---

## Accordion

**Also known as:** Disclosure · Collapse · Expandable · Details

A vertically stacked set of collapsible sections — each heading toggles showing a label vs the full content beneath.

**Best practices:**
- Use for long-form content that benefits from progressive disclosure
- Keep headings concise and scannable — they are the primary navigation
- Allow multiple sections open simultaneously unless space is critically limited
- Include a chevron icon aligned consistently on the right
- Animate open/close with a short ease-out transition (150–250 ms)
- Keyboard: Enter/Space to toggle, arrow keys to move between headers

**Common layouts:**
- FAQ page with stacked question/answer pairs
- Settings panel with grouped preference sections
- Sidebar filter groups in e-commerce or dashboards
- Mobile navigation with expandable menu sections

---

## Dropdown menu

**Also known as:** Select menu (action context)

A menu triggered by a button that reveals a list of actions or navigation options — not a form input.

**Best practices:**
- Group related items with separators and optional group headings
- Keyboard: arrow keys to move, Enter to select, Escape to close
- Keep to 7±2 items; use sub-menus or search for longer lists
- Position to avoid viewport overflow — flip to top if near bottom edge
- Destructive actions in red, separated, always last in the list

**Common layouts:**
- User account menu in the top-right header
- Context menu on right-click or kebab (⋮) icon
- Action menu on a table row (Edit / Duplicate / Delete)
- Sort/filter dropdown in a toolbar

---

## Pagination

A control for navigating between pages of content when data is split across multiple views.

**Best practices:**
- Show first, last, and a window of pages around the current one
- Use ellipsis to indicate skipped pages
- Provide Previous/Next buttons in addition to numbered pages
- Clearly style the current page as selected
- Consider infinite scroll or 'Load more' for content feeds

**Common layouts:**
- Table footer with page numbers, rows-per-page selector, and total count
- Search results pagination centered below results list
- Blog archive with Previous/Next navigation
- API documentation with page controls at top and bottom

---

## Tree view

A collapsible, nested hierarchy for browsing structured data like file trees or category taxonomies.

**Best practices:**
- Use indentation (16–24 px per level) to show hierarchy
- Include expand/collapse toggles (chevron or triangle) for parent nodes
- Keyboard: arrows to traverse, Enter to select, +/– to expand/collapse
- Highlight the selected node with a focus indicator
- Lazy-load deep children for performance in large trees

**Common layouts:**
- File/folder browser in a code editor or CMS
- Category tree in an e-commerce sidebar
- Organization chart or reporting hierarchy
- Table of contents navigation in documentation

---

## Skip link

Hidden navigation links that let keyboard users jump directly to main content, bypassing repeated elements.

**Best practices:**
- Make it the first focusable element in the DOM
- Visually hidden until focused — then clearly visible and high-contrast
- Link to the main content area with a descriptive label ('Skip to main content')

**Common layout:**
- Hidden link appearing on Tab focus at the very top of the page
