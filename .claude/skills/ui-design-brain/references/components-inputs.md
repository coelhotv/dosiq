# Component Reference — Inputs & Forms

Controls for collecting user data: text fields, selections, toggles, file uploads, and form structure.

**When to load this file:** Building forms, settings pages, filters, search, data entry flows, or any screen where the user provides input.

---

## Contents

- [Button](#button) · [Button group](#button-group) · [Segmented control](#segmented-control)
- [Checkbox](#checkbox) · [Radio button](#radio-button) · [Toggle](#toggle)
- [Text input](#text-input) · [Textarea](#textarea) · [Search input](#search-input)
- [Select](#select) · [Combobox](#combobox)
- [Date input](#date-input) · [Datepicker](#datepicker)
- [Slider](#slider) · [Stepper](#stepper) · [Rating](#rating) · [Color picker](#color-picker)
- [File](#file) · [File upload](#file-upload)
- [Rich text editor](#rich-text-editor)
- [Form](#form) · [Fieldset](#fieldset) · [Label](#label)

---

## Button

An interactive control that triggers an action — submitting a form, opening a dialog, toggling visibility.

**Best practices:**
- Establish a clear visual hierarchy: primary (filled), secondary (outlined), tertiary (text-only)
- Use verb-first labels: 'Save changes', 'Create project' — not 'Okay' or 'Submit'
- Minimum touch target 44×44 px; desktop buttons at least 36 px tall
- Show a loading spinner inside the button during async actions — disable to prevent double-clicks
- Limit to one primary button per visible viewport section
- Ensure focus ring is visible and high-contrast for keyboard users

**Common layouts:**
- Form footer: primary right-aligned, secondary left-aligned
- Hero CTA centered or left-aligned beneath headline
- Dialog footer: Cancel (secondary) + Confirm (primary)
- Floating action button (FAB) in bottom-right for mobile creation flows

---

## Button group

**Also known as:** Toolbar

A container that groups related buttons together as a single visual unit.

**Best practices:**
- Group only related actions — unrelated buttons should be separated
- Visually connect with shared border or tight 1–2 px gap
- Clearly indicate the active/selected state in toggle-style groups
- Keep to 2–5 buttons; more options warrant a dropdown or overflow menu

**Common layouts:**
- Text editor toolbar (bold, italic, underline)
- View switcher (grid view, list view)
- Segmented date range selector (Day, Week, Month)
- Split button: primary action + dropdown for alternatives

---

## Segmented control

**Also known as:** Toggle button group

A compact row of mutually exclusive options — a hybrid of button groups, radio buttons, and tabs for switching views.

**Best practices:**
- Limit to 2–5 segments — more options warrant tabs or a dropdown
- Use equal-width segments for visual balance
- Animate the selection indicator sliding between options
- Ensure the selected state has strong contrast against unselected
- Use sentence case for segment labels

**Common layouts:**
- Map/list/grid view switcher
- Billing period toggle (Monthly / Annually)
- Light/dark mode toggle in settings
- Chart type selector (Line, Bar, Pie)

---

## Checkbox

A binary input that lets users toggle an option on or off — or select multiple items from a list.

**Best practices:**
- Use for multi-select; use radio buttons for single-select
- Align the checkbox to the first line of its label, not center
- Support indeterminate state for 'select all' with partially-selected children
- Minimum 44 px touch target including label area
- Group related checkboxes under a fieldset with a legend

**Common layouts:**
- Filter panel with multi-select facets
- Terms & conditions single checkbox with long label
- To-do list with check/uncheck per item
- Table row multi-select with header 'select all'

---

## Radio button

**Also known as:** Radio · Radio group

A selection control where the user picks exactly one option from a predefined set.

**Best practices:**
- Use for mutually exclusive choices (select one from many)
- Always pre-select a sensible default when possible
- Group under a fieldset with a legend describing the choice
- Stack vertically for more than 2 options; horizontal only for 2–3 short-label options
- Provide at least 8 px spacing between options for easy tapping

**Common layouts:**
- Shipping method selection (Standard, Express, Overnight)
- Payment method chooser with radio + icon + description
- Survey question with single-choice answers
- Plan/tier selection in a pricing form

---

## Toggle

**Also known as:** Switch · Lightswitch

A binary switch that toggles between on and off — takes effect immediately.

**Best practices:**
- Use for settings that take immediate effect (no Save required)
- Label with what it controls, not 'On/Off'
- Show state visually (color, thumb position) and optionally with a text label
- Size for tappability: 44+ px wide
- In forms that require Save, use a checkbox instead

**Common layouts:**
- Settings row: label on left, toggle on right
- Dark mode toggle in header or settings panel
- Feature flag list in admin panel
- Notification preferences list

---

## Text input

A single-line form field for entering short text values.

**Best practices:**
- Use appropriate input types (email, tel, url, number) for correct mobile keyboards
- Placeholder text as format hint only — never as a label replacement
- Show character count for length-limited fields
- Inline validation errors below the input with red border + message
- Support autofill attributes (name, email, address)

**Common layouts:**
- Login form with email and password inputs
- Search bar with icon prefix and clear button
- Inline edit field that converts on click
- Settings form with single-column labeled inputs

---

## Textarea

**Also known as:** Textbox · Text box

A multi-line text field for longer content entry.

**Best practices:**
- Allow vertical resizing; set sensible min and max heights
- Show character count when there's a limit
- Default height 3–5 rows to signal multi-line is expected
- Auto-grow as the user types for a smooth experience

**Common layouts:**
- Comment/reply input below a post
- Feedback form with large message area
- Note field in a CRM or project tool
- Code or JSON input with monospace font

---

## Search input

**Also known as:** Search

A text field designed specifically for entering search queries.

**Best practices:**
- Magnifying glass icon inside the field
- Support Cmd/Ctrl+K global shortcut to focus
- Show recent searches and suggestions in a dropdown
- Debounce input (200–300 ms) and show loading indicator during server queries
- Clear/reset button (×) once text is entered

**Common layouts:**
- Global search in top navigation
- Command palette overlay (Cmd+K) with categorized results
- Inline filter above a data table
- Full-page search with prominent input and results below

---

## Select

**Also known as:** Dropdown · Select input

A form input that shows the current selection when collapsed and reveals an option list when expanded.

**Best practices:**
- Use native `<select>` for simple cases (best accessibility and mobile UX)
- Custom selects must have full keyboard support and ARIA attributes
- Always show a placeholder label ('Select an option…') with no pre-selection
- Group long option lists with optgroups or headings
- For 5+ searchable options, use a Combobox instead

**Common layouts:**
- Country/region picker in address form
- Sort-by dropdown in product listing toolbar
- Role selector in user invitation flow
- Language/locale switcher

---

## Combobox

**Also known as:** Autocomplete · Autosuggest

A select-like input enhanced with a free-text field that filters available options as you type.

**Best practices:**
- Show suggestions after 1–2 characters to reduce noise
- Highlight matched text within each suggestion
- Allow keyboard navigation (arrow keys + Enter) through dropdown
- Show a 'no results' message instead of an empty dropdown
- Debounce input (200–300 ms) to avoid excessive API calls

**Common layouts:**
- Search bar with autocomplete suggestions
- Address input with location suggestions
- Tag input that suggests existing tags
- Assignee picker in a project management tool

---

## Date input

A date entry control, often split into separate day, month, and year fields.

**Best practices:**
- Clearly label the expected format (DD/MM/YYYY or MM/DD/YYYY)
- Use separate fields for day, month, and year for unambiguous entry
- Validate in real-time and show errors inline
- Auto-advance between fields when a segment is complete

**Common layouts:**
- Date of birth entry in a registration form
- Passport/ID expiry date input
- Invoice date field in a financial form

---

## Datepicker

**Also known as:** Calendar · Datetime picker

A calendar-based control for selecting dates visually.

**Best practices:**
- Allow both manual text entry and calendar selection
- Clearly indicate the expected date format
- Highlight today's date and the currently selected date
- Disable dates outside the valid range
- Support keyboard navigation through the calendar grid
- For date ranges, show both start and end in a connected picker

**Common layouts:**
- Booking flow with check-in/check-out range picker
- Form field with calendar dropdown on focus
- Dashboard date range filter in toolbar
- Event creation with start date and optional end date

---

## Slider

**Also known as:** Range input

A draggable control for selecting a value from within a defined range.

**Best practices:**
- Show current value in a tooltip or adjacent label
- Use tick marks for discrete value sliders
- Support both dragging and clicking on the track to set value
- Minimum 44 px touch target for the thumb
- Pair with a text input for precise value entry

**Common layouts:**
- Price range filter with dual thumbs (min/max)
- Volume/brightness control
- Image crop zoom level control
- Pricing page seat/usage slider with dynamic price display

---

## Stepper

**Also known as:** Quantity · Nudger · Counter

A numeric input with increment and decrement buttons for adjusting a value.

**Best practices:**
- Use clear +/– buttons with adequate touch targets
- Allow direct number entry in addition to button interaction
- Set sensible min, max, and step values
- Disable the relevant button when at min or max

**Common layouts:**
- Quantity selector in an e-commerce cart
- Number input for seat count in a booking flow
- Portion size adjuster in a recipe app

---

## Rating

A control that displays or captures a star-based score.

**Best practices:**
- 5-star scale is the widely understood standard
- Half-star precision for display; full stars for input
- Show average rating and total review count together
- Filled/empty stars with sufficient color contrast

**Common layouts:**
- Product rating display with stars and review count
- Review submission with interactive star input and textarea
- Summary rating card with distribution bar chart

---

## Color picker

A control that lets users select a color value.

**Best practices:**
- Provide spectrum picker, hue slider, and direct hex/RGB input
- Include preset swatches for quick selection
- Show a real-time preview of the selected color
- Support copy-paste of hex/RGB/HSL values
- Remember recently used colors

**Common layouts:**
- Design tool picker with spectrum, sliders, and input fields
- Theme customizer with preset palette and custom override
- Annotation tool with color swatch row
- Brand settings with primary/secondary/accent pickers

---

## File

**Also known as:** Attachment · Download

A visual representation of a file — an uploaded attachment or downloadable document.

**Best practices:**
- Show file type icon, name, and size clearly
- Include download action and optionally a preview action
- Display upload date or last modified date
- Show upload progress indicator during upload

**Common layouts:**
- Attachment list below a message or form
- File card with icon, name, size, and download button
- Document grid with thumbnails and metadata

---

## File upload

**Also known as:** File input · Dropzone

A control that lets users select and upload files from their device.

**Best practices:**
- Support drag-and-drop with a clearly defined drop zone
- Show accepted file types and size limits before upload begins
- Display per-file upload progress with a progress bar
- Allow cancellation of in-progress uploads
- Show preview (thumbnail for images, icon+name for documents) after selection
- Validate file type and size client-side before uploading

**Common layouts:**
- Profile photo upload with circular crop preview
- Document attachment area in a form
- Multi-file drag-and-drop zone with file list below
- Inline file field with browse button and filename display

---

## Rich text editor

**Also known as:** RTE · WYSIWYG editor

A WYSIWYG editing surface for creating and formatting rich text content.

**Best practices:**
- Provide a minimal default toolbar — reveal advanced formatting on demand
- Support keyboard shortcuts (Cmd+B bold, Cmd+I italic, Cmd+K link)
- Sanitize pasted content to prevent layout-breaking HTML
- Show word/character count for content with limits

**Common layouts:**
- Blog post editor with formatting toolbar and preview
- Email composer with rich text and attachment support
- Comment editor with basic formatting (bold, italic, link, list)

---

## Form

A collection of input controls that allows users to enter and submit structured data.

**Best practices:**
- Use a single-column layout for most forms — faster to scan
- Place labels above inputs for mobile-friendly forms
- Group related fields with visual proximity and optional fieldset headings
- Show inline validation on blur, not on every keystroke
- Keep forms as short as possible — ask only what's necessary

**Common layouts:**
- Sign-up form with name, email, password, and CTA
- Multi-step wizard form with progress indicator
- Settings form with grouped preference sections
- Contact form with name, email, subject, and message textarea

---

## Fieldset

A container that groups related form fields under a shared label or legend.

**Best practices:**
- Use to group related fields under a descriptive legend
- Style the legend as a section heading within the form
- Ensure the fieldset is announced by screen readers for context

**Common layouts:**
- Address section (street, city, state, zip)
- Payment information (card number, expiry, CVV)
- Personal details section in a multi-part form

---

## Label

**Also known as:** Form label

A text element that identifies and describes a form input.

**Best practices:**
- Always associate labels with their inputs (htmlFor / id pairing)
- Place labels above the input for vertical forms, beside for horizontal
- Mark required fields clearly (asterisk or 'required' text)
- Keep label text concise — use helper text for additional guidance

**Common layouts:**
- Form field with label above and helper text below
- Inline label beside a toggle or checkbox
- Floating label that moves to the top on input focus
