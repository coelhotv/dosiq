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

## 🏗️ Estrutura de Pastas (v4.0.0)
- `src/features/`: Módulos de domínio (adherence, dashboard, medications, protocols, stock). **Fonte canônica de lógica de negócio.**
- `src/shared/`: Recursos compartilhados (components/ui, hooks, services, utils, styles).
- `src/schemas/`: Único local para Schemas Zod. Sincronizados com o banco de dados.
- `src/views/`: Wrappers de páginas (Dashboard, Medicines, etc.). Carregados via `React.lazy`.
- `server/bot/`: Código do Bot do Telegram.
- `api/`: Serverless Functions da Vercel (limite de 12 funções no plano Hobby).
- `.memory/`: **Memória de Longo Prazo** (Regras `rules.md`, Anti-patterns `anti-patterns.md`).

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
1. **Sempre ler** `.memory/rules.md` e `.memory/anti-patterns.md` antes de codificar.
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

## 🤖 Memória de Longo Prazo
Ao final de cada tarefa bem-sucedida ou correção de bug não trivial, **VOCÊ DEVE** atualizar:
- `.memory/rules.md`: Novos padrões ou regras positivas descobertas.
- `.memory/anti-patterns.md`: Erros cometidos ou armadilhas identificadas.
- `.memory/journal/YYYY-WWW.md`: Registro da entrega realizada.

---
*Última atualização: 2026-04-02*