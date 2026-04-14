# Phase 0 — Extraction Inventory

> **Status:** Inventory factual de codigo atual
> **Data:** 2026-04-10
> **Base:** `MASTER_SPEC_HIBRIDO_WEB_NATIVE.md` rev.1
> **Objetivo:** Mapear cada grupo de codigo para sua categoria (PURE, ADAPTER_REQUIRED, PLATFORM_WEB, etc.)

---

## Legenda de Categorias

| Categoria | Significado | Exemplo | Decisao de Extracao |
|-----------|------------|---------|-------------------|
| **PURE** | Zero deps de browser, sem storage, sem env vars — pode ser compartilhado | schemas, pure utils | Mover para `packages/core` em Fase 2 |
| **ADAPTER_REQUIRED** | Usa browser APIs (localStorage, import.meta.env); requer adaptador | queryCache, supabase client | Refatorar em Fase 3 com adapter pattern |
| **PLATFORM_WEB** | Dependencia web-only; nunca compartilhar | Framer Motion, jsPDF, Groq SDK | Ficar em `src/` para sempre |
| **PLATFORM_MOBILE** | Dependencia mobile-only; nunca compartilhar | React Native, Expo | Ir para `apps/mobile/` em Fase 4+ |
| **SHARED_TOKEN** | Design tokens que viajam entre plataformas | Cores, espacamento Sanctuary | Mover para `packages/design-tokens` em Fase 2 |
| **DO_NOT_SHARE** | Codigo entrelacado ou dominio especifico; custo alto para extrair | Feature-specific hooks, views | Manter em `src/features/` |
| **DOC_INCONSISTENCY** | Spec/docs desalinhados com codigo real | Pode haver notas obsoletas | Documentar e depois sincronizar |

---

## Inventario por Caminho

### **Schemas (PURE)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/schemas/medicineSchema.js` | PURE | Mover para `packages/core` | Fase 2 | Zod schema, sem deps externas |
| `src/schemas/protocolSchema.js` | PURE | Mover para `packages/core` | Fase 2 | Zod schema |
| `src/schemas/stockSchema.js` | PURE | Mover para `packages/core` | Fase 2 | Zod schema |
| `src/schemas/logSchema.js` | PURE | Mover para `packages/core` | Fase 2 | Zod schema |
| `src/schemas/*` | PURE | Mover para `packages/core` | Fase 2 | Todos os schemas sao puros |

### **Utils Puros (PURE)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/utils/dateUtils.js` | PURE | Mover para `packages/core` | Fase 2 | Data parsing, timezone-aware, sem localStorage |
| `src/utils/adherenceLogic.js` | PURE | Mover para `packages/core` | Fase 2 | Calculos de adesao, math puro |
| `src/features/protocols/utils/titrationUtils.js` | PURE | Mover para `packages/core` | Fase 2 | Logica de titulacao, math puro |
| `src/features/protocols/utils/protocolUtils.js` | PURE | Mover para `packages/core` | Fase 2 | Helpers de protocolo |
| `src/features/dashboard/utils/analyticsUtils.js` | PURE | Mover para `packages/core` | Fase 2 | Formulas de analytics |
| `src/features/medications/utils/medicineUtils.js` | PURE | Mover para `packages/core` | Fase 2 | Helpers de medicamento |

### **Services Puros com Contratos (PURE → ADAPTER_REQUIRED)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/features/medications/services/medicineService.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Depende de Supabase client + contratos (CON-001, CON-002) |
| `src/features/protocols/services/protocolService.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Depende de Supabase |
| `src/features/stock/services/stockService.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Depende de Supabase |
| `src/features/dashboard/services/adherenceService.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Depende de contratos de query cache |
| `src/features/emergency/services/emergencyCardService.js` | PURE | Mover para `packages/core` | Fase 2 | Formatacao de card de emergencia |
| `src/features/chatbot/services/chatbotService.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Depende de Groq SDK (PLATFORM_WEB) — deixar abstrato |
| `src/features/export/services/exportService.js` | PLATFORM_WEB | Ficar em `src/features/export/` | — | Depende de jsPDF + html2canvas |
| `src/features/reports/services/shareService.js` | PLATFORM_WEB | Ficar em `src/features/reports/` | — | Depende de jsPDF e @vercel/blob |

### **Supabase Client (ADAPTER_REQUIRED)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/shared/utils/supabase.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Usa `import.meta.env`; requiere adapter de config para web/mobile |

### **Query Cache (ADAPTER_REQUIRED)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/shared/utils/queryCache.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Usa `localStorage`; requer adapter para web/AsyncStorage mobile |
| `src/shared/hooks/useCachedQuery.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Depende de queryCache; abstract contract necessario |
| `src/shared/services/cachedServices.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Interface de cache; requer contratinho claro (CON-012?) |

### **Storage (ADAPTER_REQUIRED)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/shared/services/migrationService.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Coordena migracao de dados em localStorage |

### **Componentes (PLATFORM_WEB ou DO_NOT_SHARE)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/shared/components/ui/` | PLATFORM_WEB | Ficar em `src/shared/components/` | — | Componentes React; nao podem ser usados direto em RN |
| `src/shared/components/log/` | DO_NOT_SHARE | Ficar em `src/shared/components/` | — | Componentes de log de dose (formularios complexos) |
| `src/shared/components/pwa/` | PLATFORM_WEB | Ficar em `src/shared/components/` | — | InstallPrompt, PushPermission (web-only) |
| `src/shared/components/onboarding/` | DO_NOT_SHARE | Refatorar depois (Fase 8+) | — | Onboarding web; pode ser adaptado para mobile depois |
| `src/features/*/components/` | PLATFORM_WEB | Ficar em `src/features/` | — | Feature-specific, entrelacadas |

### **Views (PLATFORM_WEB)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/views/` | PLATFORM_WEB | Ficar em `src/views/` | — | Views React; mobile vai ter estrutura separada em `apps/mobile/screens/` |

### **Styles (SHARED_TOKEN + PLATFORM_WEB)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/shared/styles/tokens/colors.css` | SHARED_TOKEN | Migrar para `packages/design-tokens` | Fase 2 | Cores Sanctuary (v4.0.0) |
| `src/shared/styles/tokens/spacing.css` | SHARED_TOKEN | Migrar para `packages/design-tokens` | Fase 2 | Espacamento |
| `src/shared/styles/tokens/typography.css` | SHARED_TOKEN | Migrar para `packages/design-tokens` | Fase 2 | Tipografia |
| `src/shared/styles/motionConstants.js` | PLATFORM_WEB | Ficar em `src/shared/styles/` | — | Constantes de animacao Framer Motion |
| `src/shared/styles/` | PLATFORM_WEB | Ficar em `src/shared/styles/` | — | CSS geral da web |

### **Dependencies Especiais (PLATFORM_WEB)**

| Pacote | Uso | Categoria | Acao Futura |
|--------|-----|-----------|-------------|
| `framer-motion` | Animacoes web | PLATFORM_WEB | Ficar em `src/`; nao compartilhar |
| `jspdf` + `html2canvas` | Export PDF | PLATFORM_WEB | Ficar em `src/features/export/` |
| `groq-sdk` | Chatbot IA | PLATFORM_WEB | Refatorar em Fase 3 (avaliar se compartilha ou nao) |
| `react-virtuoso` | Virtual scrolling | PLATFORM_WEB | Ficar em `src/` |
| `zod` | Validacao | PURE | Dependencia compartilhada; vai para `packages/core` |
| `@supabase/supabase-js` | Backend | ADAPTER_REQUIRED | Adapter para web/mobile |

### **Path Aliases Vite (REFERENCIA)**

| Alias | Aponta para | Fase | Observacoes |
|-------|------------|------|-------------|
| `@` | `src/` | 1 | Root de aliases |
| `@features` | `src/features/` | 1 | Feature modules |
| `@shared` | `src/shared/` | 1 | Shared components/utils |
| `@services` | `src/services/api/` | 1 | API services |
| `@schemas` | `src/schemas/` | 1 | Zod schemas |
| `@utils` | `src/utils/` | 1 | Utilities |
| `@dashboard` | `src/features/dashboard/` | 1 | Dashboard feature |
| `@medications` | `src/features/medications/` | 1 | Medications feature |
| etc. | etc. | 1 | (ver vite.config.js completo) |

### **API Serverless (PLATFORM_WEB)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `api/notify.js` | PLATFORM_WEB | Refatorar em Fase 6 | Fase 6 | Cron orchestrator; vai chamar dispatcher mobile |
| `api/telegram.js` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Webhook; vai compartilhar logica com bot |
| `api/share.js` | PLATFORM_WEB | Ficar em `api/` | — | Vercel Blob shareable links (web-only) |
| `api/health/*` | PURE | Mover logica para `packages/core` | Fase 2 | Health checks (estrutura pode ser compartilhada) |
| `api/gemini-reviews/` | PLATFORM_WEB | Ficar em `api/` | — | Gemini Code Assist (dev tool, web-only) |
| `api/dlq/` | ADAPTER_REQUIRED | Refatorar em Fase 3 | Fase 3 | Dead letter queue; vai precisar de contrato generico |

### **Bot (PLATFORM_WEB + ADAPTER_REQUIRED)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `server/bot/tasks.js` | ADAPTER_REQUIRED | Refatorar em Fase 6 | Fase 6 | Telegram scheduler; vai compartilhar dispatcher com mobile |
| `server/bot/callbacks/` | ADAPTER_REQUIRED | Refatorar em Fase 6 | Fase 6 | Telegram handlers |
| `server/bot/commands/` | ADAPTER_REQUIRED | Refatorar em Fase 6 | Fase 6 | Telegram commands |
| `server/bot/middleware/` | ADAPTER_REQUIRED | Refatorar em Fase 6 | Fase 6 | Telegram middleware |

### **Web-Specific Assets (PLATFORM_WEB)**

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `public/` | PLATFORM_WEB | Ficar em `./public/` | — | PWA assets, icons, manifest.json |
| `index.html` | PLATFORM_WEB | Ficar em `./` | — | Entry point web |
| `vite.config.js` | PLATFORM_WEB | Refatorar em Fase 1 | Fase 1 | Vai incluir referencias aos packages/ |

---

## Resumo de Volumes

| Categoria | Count | Acao |
|-----------|-------|------|
| PURE (→ `packages/core`) | ~20 arquivos | Mover em Fase 2 |
| ADAPTER_REQUIRED (→ refactor + adapter) | ~15 arquivos | Refatorar em Fase 3 |
| SHARED_TOKEN (→ `packages/design-tokens`) | ~5 arquivos | Mover em Fase 2 |
| PLATFORM_WEB (ficar em `src/`) | ~60 arquivos | Nada muda; web continua na raiz |
| DO_NOT_SHARE (ficar em `src/features/`) | ~30 arquivos | Nada muda |

---

## Notas Importantes

1. **Migracao preserva funcionalidade:** Cada movo em Fase 2+ nao quebra a web; apenas reorganiza.
2. **Contratos ja existem:** Muitos CON-NNN ja estao em `.agent/memory/contracts.json`; inventario so mapeia o que vai mudar.
3. **Fase 1 (Workspaces):** Vai criar estrutura `packages/*` vazia; Fase 2 vai alimenta-la.
4. **Fase 3 (Adapters):** E a fase critica onde storage, config, queries sao desacopladas.
5. **Design tokens (Fase 2):** Critica para mobile ter cores/espacamento compativel com web.
6. **Expo dependencies:** Ainda NAO entram em root; apenas `packages/mobile/` em Fase 4.
