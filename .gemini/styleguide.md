# Style Guide: Dosiq

Este documento contém as diretrizes e convenções de código que o Gemini Code Assist deve seguir ao revisar Pull Requests para este repositório.

> Última atualização: 2026-05-16 — incorporada arquitetura monorepo (mobile + core).

---

## 🏗️ Arquitetura — Monorepo npm workspaces + Turborepo

| Workspace | Stack | Onde |
|-----------|-------|------|
| `@dosiq/web` | React 19 + Vite 7 + Supabase + Zod 4 + Vitest 4 | `apps/web/` |
| `@dosiq/mobile` | **Expo 53 + React Native 0.79 + Hermes** + React Navigation 7 + Firebase + AsyncStorage + Zod 4 + Jest + jest-expo | `apps/mobile/` |
| `@dosiq/core` | Código puro compartilhado: schemas Zod, utils puros, repositories factory CRUD | `packages/core/` |
| `@design-tokens` | Tokens CSS/JS | `packages/design-tokens/` |
| `api/` | Vercel serverless funcs (≤12 Hobby) | `api/` |
| `server/bot/` | Telegram bot | `server/bot/` |

**Regra geral**: web e mobile NÃO compartilham hooks, components, utils de plataforma. Compartilham apenas `@dosiq/core` (puro, sem APIs DOM/RN). Antes de sugerir "use o helper X" em mobile, verifique se X existe em `apps/mobile/` ou `@dosiq/core` — utils da `apps/web/src/shared/` NÃO estão disponíveis no mobile.

**Padrões cross-platform**:
- Schemas Zod canônicos em `packages/core/src/schemas/` (ex: `medicineSchema`, `protocolSchema`).
- `zodSetup.js` aplica locale PT-BR + customError friendly globalmente ao importar `@dosiq/core` (R-232).
- Repositories factory CRUD em `packages/core/src/repositories/` (ex: `createMedicineRepository`); web e mobile injetam DI parametrizada (ADR-045, R-231).
- Hardening em 3 gates: **G1 cópia → G2 extract para factory → G3 web adota factory** (ADR-043). Durante G1, divergências do espelho web SÃO o problema — sugerir consolidação ANTES de G2/G3 quebra o gate de parity.

---

## 📋 Regras de Ouro (Golden Rules)

> **Sistema de memória: DEVFLOW** — skill `/devflow`
> Regras: `.agent/memory/RULES_INDEX.md` + `rules/[cat]/R-NNN.md` (183 regras)
> Anti-patterns: `.agent/memory/ANTI_PATTERNS_INDEX.md` + `anti-patterns/[cat]/AP-NNN.md` (162 APs)
> Decisões: `.agent/memory/DECISIONS_INDEX.md` (45 ADRs)
> `.memory/` está **aposentado** desde 2026-04-08.
> Arquivos JSON `rules.json`/`anti-patterns.json`/`contracts.json`/`decisions.json` foram migrados para INDEX.md + detail files (DEVFLOW v1.7+) — NÃO referenciar os JSONs.

**Top 6 (referência rápida):**

1. **Arquivos duplicados** (R-001): Verificar `find apps/<workspace>/src -name "*File*"` antes de modificar.
2. **Ordem dos Hooks** (R-010): States → Memos → Effects → Handlers (previne TDZ). **Exceção conhecida**: quando `useEffect` depende de `useCallback`, o handler deve ser declarado ANTES do effect (pattern padrão `useX/useXById`). Comentário inline justifica.
3. **Timezone** (R-020): Sempre `parseLocalDate()` de `@dosiq/core`, NUNCA `new Date('YYYY-MM-DD')` direto.
4. **Zod Enums** (R-021): Sempre em Português. Código em Inglês, UI/erros em Português PT-BR.
5. **Zod 4 locale global** (R-232): NÃO criar errorMap por schema. `@dosiq/core` aplica `z.config({ customError })` PT-BR friendly globalmente. Customizar mensagens só quando regra dá info útil ao usuário.
6. **Dosagem** (R-022): Registrar em comprimidos (não mg), `quantity_taken` ≤ 100.

---

## 📱 Mobile (Expo + React Native + Hermes)

Ambiente diferente do web. Várias APIs e padrões NÃO se aplicam.

### Hermes engine
- **Sem ICU completo**: `toLocaleString('pt-BR')` cai em fallback US. Vírgula decimal via `String(qty).replace('.', ',')`. Datas via `formatDatePtBR` de `@dosiq/core` (tabela manual de meses).
- **`__DEV__`** substitui `process.env.NODE_ENV` (indisponível em mobile).
- **`new Date()` direto = AP-020**: usar `getNow()`/`getTodayLocal()` de `@dosiq/core`.

### Cache mobile
- Pattern estabelecido: `useState` + `AsyncStorage` snapshot manual + TTL via `parseISO`/`getNow` de `@dosiq/core`.
- Canônicos: `apps/mobile/src/features/medications/hooks/useMedicines.js`, `apps/mobile/src/features/treatments/hooks/useProtocols.js`.
- **NÃO sugerir `useCachedQuery`** — é util da `apps/web/`, NÃO existe no workspace mobile.
- **NÃO sugerir SWR / React Query** — fora da stack atual.

### React Native specifics
- **borderStyle**: RN suporta APENAS `'solid'`. `'dashed'` / `'dotted'` disparam `WARN Unsupported dashed / dotted border style` (AP-163) — multiplica por frame em containers animados via `LayoutAnimation`.
- **No-Line Rule** (`plans/DESIGN-SYSTEM.md` §2): proibido borda 1px sólida para sectionar conteúdo. Boundaries via shift de `backgroundColor` (ex: `primary[50]` chip rounded em vez de `borderTop: 1px`).
- **`@expo/vector-icons` é pesado** (~4 MB de fonts cumulativos — AP-162). Preferir `lucide-react-native` ou import seletivo de família específica.
- **Stack navigator** (R-117/ADR-036): usar `@react-navigation/stack` (JS), NÃO `@react-navigation/native-stack`. Native-stack crasha em Android API 24 (rn-screens IndexOutOfBoundsException).

### Lint mobile (Jest, não Vitest)
- Workspace mobile usa **Jest + jest-expo**, NÃO Vitest.
- Imports `import { describe, it, expect, vi } from 'vitest'` quebram. Usar `jest.mock()`, `jest.fn()`, etc.
- Sempre verificar `package.json` do workspace antes de sugerir mocks ou imports de teste.

### Cavecrew distribution (ADR-044)
Não bloqueia review. Explica autoria: Opus arquiteta + escreve features complexas; Sonnet/Haiku spawnados para tarefas menores em paralelo. Estilo pode variar levemente entre arquivos do mesmo PR.

---

## 🌐 Web (React 19 + Vite 7)

- **Vitest 4** (`vi.mock`, `vi.fn`). `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` obrigatório.
- **Cache**: `useCachedQuery` (SWR customizado) em `apps/web/src/shared/hooks/`. Invalidar após mutações.
- **Path aliases** (`apps/web/vite.config.js`): `@features @shared @services @schemas @utils @dashboard @medications @protocols @stock @adherence @calendar @emergency @prescriptions @settings @design-tokens @dosiq/core`. Sempre usar aliases.
- **Lazy loading** (R-117): views (exceto Dashboard) DEVEM ser `React.lazy()` + `Suspense` com fallback `ViewSkeleton`. Bundle crítico ≤310 kB gzip.

---

## 🤖 Telegram bot
- `callback_data` < 64 bytes (índices, não UUIDs).
- `escapeMarkdownV2()` sempre — escapar `\` PRIMEIRO (R-031).
- `shouldSendNotification()` já loga — NÃO chamar `logNotification()` depois.

---

## ☁️ Vercel Serverless (R-090)
- Hobby: **máx 12 funções** em `api/`. Utilitários em `api/_prefixo/` não contam.
- Verificar budget antes de criar `.js` em `api/`.
- NUNCA `process.exit()` → `throw new Error()`.
- SEMPRE `res.status(code).json(body)` (nunca `res.json()`).
- Env vars: fallback `process.env.X || process.env.VITE_X`.

---

## 🔍 Foco da Revisão

- **Segurança**: vulnerabilidades de RLS, validação Zod, SQL injection, hardcoded secrets.
- **Performance**: re-renders, memoização em cálculos pesados, bundle bloat, N+1 queries.
- **Manutenibilidade**: funções > 30 linhas com lógica aninhada → sugerir extract. Componentes > 250 linhas → sugerir split.
- **Cross-platform consistency**: se PR mexe em web E mobile, verificar schemas Zod permanecem canônicos em `@dosiq/core/schemas/` (não duplicados).

---

## ⚠️ Salvaguardas

- Não sugerir alterações que quebrem plano gratuito Supabase ou Vercel Hobby.
- Respeitar estrutura de diretórios existente.
- **NÃO sugerir libs/utils que não existam no workspace alvo** (ex: `useCachedQuery` no mobile). Verificar `package.json` + `node_modules` do workspace antes de propor pattern alternativo.
- **Corpus de treino pode estar desatualizado**: Zod 4 mudou API issue para `code/origin/input` (não mais `type/received` do Zod 3). Validar empiricamente antes de sugerir refactor de mensagens de erro.
- **Hardening G1/G2/G3** (ADR-043): durante G1 (cópia), divergências do espelho web SÃO o problema. Sugerir consolidação ANTES de G2/G3 quebra o gate de parity.
