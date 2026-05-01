# EXEC SPEC — GATE 5.5: Inbox Markdown Renderer (Visual Bug Fix)

> **Part of**: `notifications_architecture_consolidation_plan.md`
> **Branch**: `fix/wave-12/notification-architecture-consolidation`
> **Prerequisite**: GATE 5 approved and committed
> **Difficulty**: Low-Medium — UI-only change; no backend work
> **Estimated time**: 2–3 hours

---

## Objective

Fix a visual bug: `notification_inbox.body` stores MarkdownV2-formatted text (the same format Telegram renders), but the Inbox UI (web and mobile) displays it as raw text — users see `*bold*` and escape characters like `\\!` literally.

This gate adds a MarkdownV2 → rich text parser to the Inbox renderer on both platforms.

**No backend changes. No L2 changes. No schema changes. UI renderer only.**

---

## Prerequisites

```bash
git log --oneline -5
# GATE 5 commit must be at the top

# Find inbox UI components
find apps/web/src -iname "*inbox*" -o -iname "*notification*" | grep -v node_modules | grep -v ".test."
find apps/mobile/src -iname "*inbox*" -o -iname "*notification*" | grep -v node_modules | grep -v ".test." 2>/dev/null
```

Read the inbox components before making any changes. Identify:
- Where `body` field from `notification_inbox` is rendered
- Current rendering method (plain `<p>`, `<span>`, or existing Markdown lib)

---

## Context: MarkdownV2 Format to Parse

Telegram MarkdownV2 uses these patterns that appear in stored `body` text:

| Pattern | Meaning | Render as |
|---|---|---|
| `*text*` | Bold | `<strong>text</strong>` |
| `_text_` | Italic | `<em>text</em>` |
| `\\.` | Escaped dot (literal `.`) | `.` |
| `\\!` | Escaped exclamation (literal `!`) | `!` |
| `\\(` | Escaped open paren | `(` |
| `\\)` | Escaped close paren | `)` |
| `\\-` | Escaped hyphen | `-` |
| `\n` | Line break | `<br />` or newline |
| `  💊 text` | Indented list item | render as-is (preserve spacing) |

**Only these patterns appear in Dosiq notification bodies.** Do not implement a full MarkdownV2 parser — implement only what the actual stored messages use.

---

## Step-by-Step Instructions

### Step 1 — Locate and read inbox components

Identify the exact component that renders notification body text. Read it fully.

On web (`apps/web/src`), look for:
- A component rendering a list of notifications from `notification_inbox`
- The JSX element that outputs `notification.body` or similar

On mobile (`apps/mobile/src`), look for the equivalent.

### Step 2 — Write a `parseTelegramMarkdown` utility function

**Web version** — create or add to an existing utils file. Prefer adding to an existing helper file near the inbox component rather than creating a new file:

```js
/**
 * Parses a subset of Telegram MarkdownV2 into React elements.
 * Only handles patterns actually used in Dosiq notification bodies.
 */
export function parseTelegramMarkdown(text) {
  if (!text) return null;

  // Step 1: Unescape Telegram escape sequences → literal characters
  const unescaped = text
    .replace(/\\([.!()[\]{}_*~`>#+=|{}.!-])/g, '$1');

  // Step 2: Split on newlines, then parse inline formatting per line
  const lines = unescaped.split('\n');

  return lines.map((line, lineIndex) => {
    // Parse *bold* and _italic_ inline
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^\*([^*]+)\*/);
      const italicMatch = remaining.match(/^_([^_]+)_/);

      if (boldMatch) {
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
      } else if (italicMatch) {
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
      } else {
        // Consume up to the next * or _
        const nextSpecial = remaining.search(/[*_]/);
        if (nextSpecial === -1) {
          parts.push(<span key={key++}>{remaining}</span>);
          remaining = '';
        } else {
          parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
          remaining = remaining.slice(nextSpecial);
        }
      }
    }

    return (
      <span key={lineIndex} style={{ display: 'block' }}>
        {parts.length > 0 ? parts : ' '}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}
```

**Mobile version** — if using React Native, use `Text` nesting instead of HTML tags:

```js
import { Text } from 'react-native';

export function parseTelegramMarkdownNative(text) {
  if (!text) return null;

  const unescaped = text
    .replace(/\\([.!()[\]{}_*~`>#+=|{}.!-])/g, '$1');

  const lines = unescaped.split('\n');

  return lines.map((line, lineIndex) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^\*([^*]+)\*/);
      const italicMatch = remaining.match(/^_([^_]+)_/);

      if (boldMatch) {
        parts.push(<Text key={key++} style={{ fontWeight: 'bold' }}>{boldMatch[1]}</Text>);
        remaining = remaining.slice(boldMatch[0].length);
      } else if (italicMatch) {
        parts.push(<Text key={key++} style={{ fontStyle: 'italic' }}>{italicMatch[1]}</Text>);
        remaining = remaining.slice(italicMatch[0].length);
      } else {
        const nextSpecial = remaining.search(/[*_]/);
        if (nextSpecial === -1) {
          parts.push(<Text key={key++}>{remaining}</Text>);
          remaining = '';
        } else {
          parts.push(<Text key={key++}>{remaining.slice(0, nextSpecial)}</Text>);
          remaining = remaining.slice(nextSpecial);
        }
      }
    }

    return (
      <Text key={lineIndex}>{parts}{lineIndex < lines.length - 1 ? '\n' : ''}</Text>
    );
  });
}
```

### Step 3 — Use the parser in the inbox component

**Web**: Find where `notification.body` is rendered. Change from plain text to parsed:

```jsx
// BEFORE
<p>{notification.body}</p>

// AFTER
<div className="notification-body">
  {parseTelegramMarkdown(notification.body)}
</div>
```

**Mobile**: Similarly:
```jsx
// BEFORE
<Text>{notification.body}</Text>

// AFTER
<Text>{parseTelegramMarkdownNative(notification.body)}</Text>
```

> Note: The exact component structure depends on what you find in Step 1. Adapt accordingly — do not blindly copy this example if the actual component structure is different.

### Step 4 — Verify with real notification body samples

After wiring, visually verify with these sample body strings (copy-paste into the rendered view or write a quick test):

**Sample 1 — dose_reminder_by_plan:**
```
🍽️ *Quarteto Fantástico*

2 medicamentos agora — 12:15

  💊 SeloZok 50mg — 1 cp
  💊 Forxiga 10mg — 1 cp
```

Expected render: "Quarteto Fantástico" in bold, rest as normal text with line breaks preserved.

**Sample 2 — daily_digest:**
```
Bom dia, *João*\!

Você tem *2* doses pendentes para hoje:

💊 *Atorvastatina*
⏰ 08:00 \(1 cp\)

Não se esqueça de registrar no app\!
```

Expected render: "João" and "2" in bold, "Atorvastatina" in bold, parentheses and exclamation as literal characters (not escaped).

---

## What NOT To Do

- **DO NOT** install a full Markdown library (react-markdown, marked, etc.) if it requires significant bundle size addition. The parser above is ~40 lines and handles everything in Dosiq bodies.
- **DO NOT** modify L2 (`buildNotificationPayload.js`) to change the stored format.
- **DO NOT** migrate existing stored body text in the database.
- **DO NOT** add any backend endpoints or schema migrations.
- **DO NOT** change how `title` is displayed — it is plain text, not MarkdownV2.
- **DO NOT** apply the parser to `pushBody` — that field is already plain text.
- **DO NOT** commit without human approval.

---

## Verification Commands

```bash
# 1. Lint
cd /Users/coelhotv/git-icloud/dosiq && npm run lint

# 2. Tests
npm run test:critical

# 3. Confirm no new heavy dependencies added
cat apps/web/package.json | grep -E "react-markdown|marked|showdown|remark"
# Expected: ideally nothing new, or confirm the added lib is lightweight (<10KB)

# 4. Confirm parseTelegramMarkdown is NOT applied to title
grep -rn "parseTelegramMarkdown" apps/web/src apps/mobile/src 2>/dev/null
# Review each usage — should only be for `body` field, not `title`
```

---

## 🛑 HARD STOP — Gate Report

**STOP HERE. Do not commit. Do not proceed to GATE 6.**

Present the following to the human for review:

1. **Full diff** of the inbox component(s) changed (web and/or mobile)
2. **Full diff** of the parser utility added
3. **Screenshot or text rendering comparison** for the two sample bodies above:
   - Before: raw text with `*bold*` and `\\!` visible
   - After: rendered with bold and clean characters
4. **Confirm**: "No backend files were modified"
5. **Confirm**: "No L2 files were modified"
6. **Confirm**: "Title rendering was not changed"

**Wait for explicit human approval before proceeding.**

---

## Commit (only after human approval)

```bash
cd /Users/coelhotv/git-icloud/dosiq
npm run lint
# Add all modified inbox component files and parser utility
git add <inbox-component-files> <parser-utility-file>
git commit -m "$(cat <<'EOF'
fix(inbox): renderiza MarkdownV2 do body para paridade visual com Telegram

- parseTelegramMarkdown: parser subset de MarkdownV2 (bold, italic, unescape)
- InboxRenderer (web): body renderizado com formatação rica
- InboxRenderer (mobile): body renderizado com Text nesting

EOF
)"
git push origin fix/wave-12/notification-architecture-consolidation
```
