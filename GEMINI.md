# 💊 Meus Remédios - Gemini CLI Context

Este arquivo serve como guia de contexto para interações com o **Gemini CLI** neste repositório. Ele consolida as diretrizes de `CLAUDE.md`, `ARQUITETURA.md` e os arquivos de memória em `.memory/`.

## 🎯 Visão Geral do Projeto
**Meus Remédios** é um PWA (Progressive Web App) brasileiro para gerenciamento de medicamentos, protocolos de tratamento e estoque.
- **Frontend:** React 19 + Vite 7 (ES Modules).
- **Backend:** Supabase (PostgreSQL + Auth + RLS).
- **Infra:** Vercel (Hosting + Serverless Functions + Cron).
- **Bot:** Telegram (Node.js) para lembretes e gestão rápida.
- **Validação:** Zod 4 (Runtime Validation).
- **Testes:** Vitest 4 + React Testing Library.

## 🚀 DEVFLOW — Skill Oficial de Desenvolvimento

> **Este projeto usa DEVFLOW como sistema de memória persistente e workflow estruturado.**
> Todos os agentes DEVEM usar `/devflow` como primeiro passo em qualquer tarefa de desenvolvimento.

**Modos disponíveis do `/devflow`:**

| Modo | Comando | Proposito |
|------|---------|-----------|
| Bootstrap | `/devflow` (sem args) | **OBRIGATORIO** — carrega `state` + core `hot` + packs `warm` inferidos; `cold` so entra sob demanda |
| Status | `/devflow status` | Dashboard: sprint, counts de memória, distillation pending, mutations |
| Planning | `/devflow planning "goal"` | Planejamento: análise de scope, spec, ADRs, verificação de contratos |
| Coding | `/devflow coding "task"` | Implementação: C1-C4 checklist, contract gateway, quality gates |
| Reviewing | `/devflow reviewing "PR #N"` | Revisão: violation scan, memory sync, atualizar trigger counts de APs |
| Distillation | `/devflow distill` | Compressão de journals e revisar lifecycle `hot/warm/cold/archived` (quando journal_entries >= 10) |
| Export | `/devflow export` | Promover regras candidatas ao global_base (requer aprovação) |

---

## 🏗️ Estrutura de Pastas (v4.0.0)
- `src/features/`: Módulos de domínio (adherence, dashboard, medications, protocols, stock). **Fonte canônica de lógica de negócio.**
- `src/shared/`: Recursos compartilhados (components/ui, hooks, services, utils, styles).
- `src/schemas/`: Único local para Schemas Zod. Sincronizados com o banco de dados.
- `src/views/`: Wrappers de páginas (Dashboard, Medicines, etc.). Carregados via `React.lazy`.
- `server/bot/`: Código do Bot do Telegram.
- `api/`: Serverless Functions da Vercel (limite de 12 funções no plano Hobby).
- `.agent/memory/`: **Memória de Longo Prazo — DEVFLOW** (rules.json, anti-patterns.json, knowledge.json, decisions.json, journal/ JSONL).

## 🛠️ Comandos Principais
- `npm run dev`: Servidor de desenvolvimento.
- `npm run build`: Build de produção (Vite).
- `npm run lint`: Verificação de linting (ESLint).
- `npm run validate:agent`: **OBRIGATÓRIO** antes de qualquer push. Suite crítica de testes (kill switch 10min).
- `npm run test:critical`: Testes de services, utils e schemas.
- `npm run bot`: Inicia o bot localmente.

## 📏 Convenções de Desenvolvimento

### Idioma e Nomenclatura
- **Código (Variáveis/Funções):** Inglês (`calculateAdherence`).
- **Comentários/UI/Mensagens:** Português brasileiro.
- **Commits:** Português semântico (`feat(scope): descrição`).
- **Arquivos:** PascalCase para Componentes, camelCase para o restante.

### Regras Críticas (R-NNN)
1. **Sempre executar `/devflow`** (bootstrap) antes de codificar — carrega `hot` e expande `warm` conforme o goal; `cold` fica fora do bootstrap normal.
2. **Datas:** NUNCA use `new Date('YYYY-MM-DD')`. Use `parseLocalDate()` de `@utils/dateUtils`.
3. **Validar:** SEMPRE use `safeParse()` do Zod nos services antes de operações no Supabase.
4. **Cache:** Use `useCachedQuery` e `cachedServices` para leitura; invalide após mutations.
5. **Hooks:** Ordem obrigatória: States -> Memos -> Effects -> Handlers.
6. **Imports:** Use **Path Aliases** (`@features`, `@shared`, `@utils`). Nunca caminhos relativos longos.

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
> Skill: `/devflow` | Definição: `.agent/DEVFLOW.md`

Ao final de cada tarefa, execute o protocolo **DEVFLOW C5**:
- Novo bug corrigido → `AP-NNN` em `.agent/memory/anti-patterns.json` + `anti-patterns_detail/`
- Novo padrão descoberto → `R-NNN` em `.agent/memory/rules.json` + `rules_detail/`
- Entrega realizada → entrada em `.agent/memory/journal/YYYY-WWW.jsonl` (JSONL, append-only)
- Atualizar `.agent/state.json` (incrementar `journal_entries_since_distillation`)
- Se `journal_entries >= 10` → executar `/devflow distill`

> ⚠️ `.memory/` está **aposentado** desde 2026-04-08. Não escreva nele.
> Fontes canônicas: `.agent/memory/rules.json` (96 regras ativas) + `.agent/memory/anti-patterns.json` (74 APs ativos)

---
*Última atualização: 2026-04-08*
