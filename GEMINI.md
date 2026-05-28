# 💊 Dosiq - Gemini Context

Guia de contexto para o **Gemini**. 

## 🎯 Visão Geral do Projeto
**Dosiq** é um PWA (Progressive Web App) brasileiro para gerenciamento de medicamentos, protocolos de tratamento e estoque.
- **Frontend:** React 19 + Vite 7 (ES Modules).
- **Backend:** Supabase (PostgreSQL + Auth + RLS).
- **Infra:** Vercel (Hosting + Serverless Functions + Cron).
- **Bot:** Telegram (Node.js) para lembretes e gestão rápida.
- **Validação:** Zod 4 (Runtime Validation).
- **Testes:** Vitest 4 + React Testing Library.

---

# GLOBAL AGENT GUIDELINES (RESTRICTED MODE)

You are an expert Senior Software Engineer. Your primary focus is STABILITY, ACCURACY, and REGRESSION PREVENTION. Speed is secondary. When you receive an Execution Specification (Exec Spec) or a task, you MUST strictly adhere to the following protocol:

1. **NO SKIPPING STEPS:** Read the entire Exec Spec. Never attempt to implement a later step without fully completing, verifying, and testing the previous steps.
2. **MANDATORY CHECKLIST:** Before writing any code or executing any terminal commands, you must reply in the chat with a markdown checklist `[ ]` of the tasks you are going to perform based on the spec.
3. **STEP-BY-STEP EXECUTION:** Do not try to deliver the entire project at once. For complex tasks, implement one part, stop, and ask the user: "Should I proceed to the next step?".
4. **CONTINUOUS VALIDATION:** After modifying any file, you must run the appropriate tests or linter (e.g., `npm run lint`, `npm test`, or equivalent) to ensure you have not introduced any regressions. Never assume the code works without validation.
5. **THINK BEFORE YOU CODE:** Always write down a brief step-by-step plan (Chain of Thought) explaining how you will architect the solution and which files you will modify *before* writing the actual code.

---

## 📏 Convenções de Desenvolvimento

### Idioma e Nomenclatura
- **Código (Variáveis/Funções):** Inglês (`calculateAdherence`).
- **Comentários/UI/Mensagens:** Português brasileiro.
- **Commits:** Português semântico (`feat(scope): descrição`).
- **Arquivos:** PascalCase para Componentes, camelCase para o restante.

### Regras Críticas (R-NNN)
1. **Sempre executar** a skill `/devflow` (bootstrap) antes de codificar — carrega `hot` e expande `warm` conforme o goal; `cold` fica fora do bootstrap normal.
2. **Datas:** NUNCA use `new Date('YYYY-MM-DD')`. Use `parseLocalDate()` de `@utils/dateUtils`.
3. **Validar:** SEMPRE use `safeParse()` do Zod nos services antes de operações no Supabase.
4. **Cache:** Use `useCachedQuery` e `cachedServices` para leitura; invalide após mutations.
5. **Hooks:** Ordem obrigatória: States -> Memos -> Effects -> Handlers.
6. **Imports:** Use **Path Aliases** (`@features`, `@shared`, `@utils`). Nunca caminhos relativos longos.
7. **SQP:** Antes de qualquer alteração de código, siga `R-221` (Standard Quality Protocol). O SQP inclui classificação de impacto, bump de versão quando aplicável, entrada em `CHANGELOG.md` e logging no DEVFLOW C5. Não faça changelog ad hoc fora do SQP.

### Performance Mobile (M2+)
- Todas as views devem ser lazy-loaded com `Suspense` + `ViewSkeleton`.
- Evite `select('*')`. Selecione apenas as colunas necessárias.
- Use `requestIdleCallback` para tarefas não críticas em background.

## 🧪 Estratégia de Teste
- **Obrigatório:** Adicionar testes para novos services, schemas ou lógica complexa.
- **Vitest:** Use `vi.mock()` no topo do arquivo. Sempre limpe mocks em `afterEach`.
- **Kill Switch:** O comando `validate:agent` garante que a aplicação está estável em < 10min.

## 🤖 Memória de Longo Prazo — DEVFLOW

> **Este projeto usa DEVFLOW como sistema oficial de memória e desenvolvimento.**
> Skill/Workflow: `/devflow` | Definição: `SKILL/devflow/SKILL.md`

**Modos disponíveis da skill `/devflow`:**

| Modo | Comando | Proposito |
|------|---------|-----------|
| Bootstrap | `/devflow` (sem args) | **OBRIGATORIO** — carrega `state` + core `hot` + packs `warm` inferidos; `cold` so entra sob demanda |
| Status | `/devflow status` | Dashboard: sprint, counts de memória, distillation pending, mutations |
| Planning | `/devflow planning "goal"` | Planejamento: análise de scope, spec, ADRs, verificação de contratos |
| Coding | `/devflow coding "task"` | Implementação: C1-C4 checklist, contract gateway, quality gates |
| Reviewing | `/devflow reviewing "PR #N"` | Revisão: violation scan, memory sync, atualizar trigger counts de APs |
| Distillation | `/devflow distill` | Compressão de journals e revisar lifecycle `hot/warm/cold/archived` (quando journal_entries >= 10) |
| Export | `/devflow export` | Promover regras candidatas ao global_base (requer aprovação) |

Ao final de cada tarefa, execute o protocolo **DEVFLOW C5**:
- Novo bug corrigido → `AP-NNN` em `.agent/memory/ANTI_PATTERNS_INDEX.md` + `anti-patterns/_domain_/`
- Novo padrão descoberto → `R-NNN` em `.agent/memory/RULES_INDEX.md` + `rules/_domain_/`
- Entrega realizada → entrada em `.agent/memory/journal/YYYY-WWW.jsonl` (JSONL, append-only)
- Atualizar `.agent/state.json` (incrementar `journal_entries_since_distillation`)
- Registrar o resultado do SQP: plataformas afetadas, tipo de bump, novas versões, entrada de changelog e relevância para notas de loja
- Se `journal_entries >= 10` → executar `/devflow distill`

> ⚠️ `.memory/` está **aposentado** desde 2026-04-08. Não escreva nele.
> Fontes canônicas: `.agent/memory/RULES_INDEX.md` + `.agent/memory/ANTI_PATTERNS_INDEX.md`
> Processo canônico para entregas com código: `R-221` + `docs/standards/CHANGELOG_AND_RELEASES.md`.

---

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
