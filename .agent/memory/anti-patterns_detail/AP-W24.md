# AP-W24 — FABs e chatbot trigger aparecem sobre Modal mesmo com z-index corrigido

**Category:** Ui
**Status:** active
**Related Rule:** None
**Applies To:** all

## Problem



## Prevention




**O que é:** Durante Wave 11, o `z-index` do Modal foi elevado para `1200` (acima do chatbot `1100` e FABs), mas os elementos continuaram visíveis sobre o modal no mobile após múltiplos refreshes.

**Arquivos corrigidos mas bug persistente:**
- `src/App.module.css` → `.doseFab` e `.chatFab` alterados para `var(--z-chatbot, 1100)`
- `src/features/chatbot/components/ChatWindow.module.css` → `var(--z-chatbot)` e `calc(var(--z-chatbot) + 1)`
- `src/shared/components/ui/Modal.css` → `var(--z-modal-overlay, 1200)`

**Hipóteses para investigar:**
- `transform: translateX(-50%)` no `.doseFab` cria novo stacking context, anulando z-index
- Elemento pai em `App.jsx` sem `isolation: isolate` quebra hierarquia de composição
- CSS Modules podem não estar injetando variáveis CSS corretamente no mobile

**Status:** BUG ABERTO — investigar em Wave 12 ou hotfix dedicado.

*Registrado: 2026-03-30*
