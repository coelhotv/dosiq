# Phase 0 — Shared Boundary Matrix

> **Status:** Matriz de decisao de fronteiras entre packages
> **Data:** 2026-04-10
> **Base:** `MASTER_SPEC_HIBRIDO_WEB_NATIVE.md` rev.1, `PHASE0_EXTRACTION_INVENTORY.md`
> **Objetivo:** Definir o que entra em cada package e o que nunca sai da web

---

## Matriz de Decisao

| Grupo de Codigo | Destino | Permitido Agora? | Motivo | Dono da Decisao | Fase de Implementacao |
|-----------------|---------|------------------|--------|-----------------|----------------------|
| **Schemas Zod** | `packages/core` | NAO (Fase 2) | Fase 0 = guardrails, Fase 2 = migracao | ADR-001 | Fase 2 |
| **Utils puros** (dateUtils, math, logica) | `packages/core` | NAO (Fase 2) | Depende de schemas; migracao atomica | Spec Fase 2 | Fase 2 |
| **Supabase client** | `packages/shared-data` com adapter | NAO (Fase 3) | Requer abstraction de `import.meta.env`; Fase 3 = adapter | ADR refactoring | Fase 3 |
| **Query cache** | `packages/shared-data` com adapter | NAO (Fase 3) | Usa `localStorage`; requer `webStorageAdapter` | Spec Fase 3 | Fase 3 |
| **Config (env vars)** | `packages/config` com loader | NAO (Fase 3) | Requer contrato de loader web vs mobile | Spec Fase 3 | Fase 3 |
| **Storage abstrato** | `packages/storage` com adapters | NAO (Fase 3) | Web = `localStorage`, Mobile = `AsyncStorage` | Spec Fase 3 | Fase 3 |
| **Design tokens** | `packages/design-tokens` | NAO (Fase 2) | Extrair de CSS para JS/JSON; mobile a consume | Addendum Design Tokens | Fase 2 |
| **Componentes React** | FICAR em `src/shared/components/` | **SIM** | Nao podem rodar em React Native; web-only | ADR-003 | — |
| **Views web** | FICAR em `src/views/` | **SIM** | Platform-specific; mobile tem `apps/mobile/screens/` | Spec Fase 5 | — |
| **Framer Motion** | FICAR em `src/` | **SIM** | Web-only; mobile nao depende | Spec MVP | — |
| **jsPDF + html2canvas** | FICAR em `src/features/export/` | **SIM** | Web-only; mobile nao exporta PDF | Spec MVP | — |
| **Groq SDK** | FICAR em `src/` (por enquanto) | **SIM** | Chatbot web; mobile pode ter chatbot proprio depois | Spec Fase 5 | Fase 8+ (condicional) |
| **react-virtuoso** | FICAR em `src/` | **SIM** | Virtual scrolling web; mobile usa `FlashList` (RN) | Spec MVP | — |
| **Services com contratos** (medicineService, etc) | REFATORAR em Fase 3 | NAO (Fase 3) | Contratos permanecem web; refactor abstrai implementacao | CON-001 through CON-010 | Fase 3 |
| **Telegram bot** | REFATORAR em Fase 6 | NAO (Fase 6) | Vai compartilhar dispatcher com mobile push | Spec Fase 6 | Fase 6 |
| **Vercel serverless (api/)** | Refatorar incrementalmente | NAO (Fases 3+) | Alguns endpoints servem web, alguns mobile | Addendum Deploy Vercel | Fases 3-6 |

---

## Regras Explícitas

### **Regra 1: Nada sai de `packages/` para cima (raiz)**

- `packages/` exporta apenas _para_ web e mobile, nunca o contrario
- Root `package.json` nunca importa de `packages/*` (isso quebraria isolamento)
- Workspaces (Fase 1) definem limites claros de dependencia

**Enforcement:** Lint rule em Fase 1 — grep `"imports"` em root package.json vai falhar se apontarem para `packages/`

### **Regra 2: Browser APIs nao entram em `packages/core` ou `packages/shared-data`**

**Proibido em packages/:**
- `localStorage`, `sessionStorage`
- `window`, `document`, `navigator`
- `import.meta.env` (direto; deve passar por loader abstrato)
- `fetch` (direto; deve ir via Supabase client abstrato)

**Permitido com adaptadores:**
- Supabase client (abstrato, implementado via `webSupabaseClient.js` na web)
- Storage (abstrato, implementado via adapters)
- Config (abstrato, implementado via loaders)

**Enforcement:** Grep em Fase 3 — `rg "window|document|localStorage|import\.meta" packages/ --glob '!**/__tests__/**'` vai falhar se houver violacoes

### **Regra 3: Tipos + Enums vivem uma unica vez**

Schemas Zod em `packages/core` definem a verdade unica:
- Web importa tipos via `import { medicineSchema } from '@dosiq/core'`
- Mobile importa mesmos tipos (depois de Fase 2)
- Database schema deve estar sincronizado (via migrations SQL)

**Enforcement:** Test suite em Fase 2+ valida que Zod schema e SQL CHECK constraints correspondem

### **Regra 4: Cada package tem interface clara, contratos e testes**

Antes de um package poder ser importado:
- [ ] Tem `exports` em `package.json`
- [ ] Tem `index.js` exportando publico API
- [ ] Tem tests cobrindo pontos de integracao
- [ ] Tem CON-NNN no `.agent/memory/contracts.json` se houver breaking changes

**Enforcement:** PR gate em Fase 1+ — merge nega se package novo nao tiver testes

### **Regra 5: Design tokens viajam em duas direcoes**

- Web consome via CSS imports (`src/shared/styles/colors.css` → `--color-primary`)
- Mobile consome via JS exports (`packages/design-tokens/colors.js` → `colors.primary`)
- Sincronismo é garantido pela fonte unica em `packages/design-tokens/`

**Enforcement:** Addendum Design Tokens define sincronismo; Fase 2 implementa

---

## Fronteiras por Fase

### **Fase 0 (Guardrails) — Atual**

- Nenhuma nova dependencia web-mobile (expo ja foi removido)
- Nenhum package foi criado ainda
- Inventario e ADRs definem o que vem depois

### **Fase 1 (Workspaces)**

- `packages/` criado com estrutura vazia
- Workspace config em `package.json` root
- Vercel deploy continua apontando para `./` (web)

### **Fase 2 (Core Puro)**

- `packages/core/` alimentado com schemas + utils puros
- `packages/design-tokens/` alimentado com tokens Sanctuary
- Web importa schemas de `@dosiq/core` (rollback strategy em Fase 3)

### **Fase 3 (Adapters)**

- `packages/storage/` com adapters (web + memory)
- `packages/config/` com loaders
- `packages/shared-data/` com query cache abstrato
- Web refatorada para usar adapters (queryCache rollback descartado)

### **Fase 4 (Mobile Scaffold)**

- `apps/mobile/` criado (Expo)
- Mobile comeca a importar de `packages/core`, `packages/storage`, etc.
- Web continua na raiz (ADR-001)

### **Fase 5-6 (MVP + Push)**

- Mobile features implementadas
- Telegram bot refatorado para usar dispatcher compartilhado
- Vercel serverless refatorado para servir ambas plataformas

### **Fase 7 (Condicional — Web Migration)**

- Se aprovado, web migra para `apps/web/`
- Vercel deploy aponta para `apps/web/`

---

## O Que Nunca Sai de `src/` (Web-Only)

| Item | Motivo | Alternativa para Mobile |
|------|--------|------------------------|
| Componentes React | RN é diferente de React | `apps/mobile/components/` |
| Views | UX diferente por plataforma | `apps/mobile/screens/` |
| Framer Motion | Reanimated tem API diferente | `Reanimated` (depois) |
| jsPDF + html2canvas | Browser-only | Impresso ou gerar no backend |
| CSS global (sem tokens) | Web-only styling | CSS vars em `packages/design-tokens/` |
| `beforeinstallprompt` (PWA) | Chrome-only event | N/A para mobile |
| Service Worker | Browser concept | N/A para mobile |
| Web storage (direto) | Nunca em packages/ | AsyncStorage em mobile via adapter |

---

## O Que Compartilha (Fase 2+)

| Item | Localizacao Final | Web Import | Mobile Import |
|------|------------------|------------|---------------|
| Schemas | `packages/core/schemas/` | `@dosiq/core` | `@dosiq/core` |
| Utils puros | `packages/core/utils/` | `@dosiq/core` | `@dosiq/core` |
| Design tokens | `packages/design-tokens/` | CSS vars + JS fallback | JS objects |
| Storage abstrato | `packages/storage/` | `webStorageAdapter` | `asyncStorageAdapter` |
| Supabase client abstrato | `packages/shared-data/` | `webSupabaseClient` | `mobileSupabaseClient` |
| Query cache abstrato | `packages/shared-data/` | `webQueryCache` | `mobileQueryCache` |

---

## Validacoes por Fase

| Fase | Validacao | Comando | Deve Passar? |
|------|-----------|---------|-------------|
| 0 (atual) | Nenhuma migracao nova | npm run build | ✅ Sim |
| 1 | Workspaces criados | npm run build | ✅ Sim |
| 2 | Web ainda importa de schemas do novo path | npm run build | ✅ Sim |
| 3 | Adapters funcionam | npm run test:critical | ✅ Sim |
| 4 | Mobile builds | eas build --platform ios | ✅ Sim (validacao humana) |
| 5-6 | Features coexistem | npm run build + eas build | ✅ Sim (ambos) |
| 7 (se executado) | Web em apps/web | npm run build | ✅ Sim (novo rootDir) |

---

## FAQs

### **P: Por que nao compartilhar componentes web em Fase 2?**
**R:** React e React Native usam APIs diferentes. Um botao web nao vai funcionar em RN sem grande refactor. Fase 8+ pode considerar design system unificado com adapters.

### **P: Por que nao guardar token em profiles table?**
**R:** ADR-002 explica — um usuario pode ter multiplos devices. Tabela dedicada permite auditoria e revogacao clara.

### **P: Por que Framer Motion nao pode sair de src/?**
**R:** Reanimated (mobile) tem API completamente diferente. Web usa Framer, Mobile usa Reanimated — nunca compartilham.

### **P: Groq SDK pode compartilhar?**
**R:** Por enquanto, web-only (Chatbot web). Fase 8+ pode decidir compartilhar ou criar chatbot mobile proprio com modelo diferente.

---

## Proxima Acao

Esta matriz sera registrada no `.agent/memory/decisions.json` como referencia para Fases 1+.

Agentes futuros consultam isto antes de decidir "este arquivo pode sair de src/?".
