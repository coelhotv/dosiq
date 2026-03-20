# DELIVER SPRINT — Workflow de Entrega Completo

> Skill compilada da experiência das sprints 5.A, 5.B e 5.C. Use este workflow para organizar entregas de sprints especificadas.

## Fases da Entrega

### FASE 1: SETUP & EXPLORAÇÃO (10-15 min)

**Objetivo**: Entender completamente o escopo antes de codar.

#### 1.1 Ler Especificação Executiva
- Arquivo: `plans/EXEC_SPEC_FASE_N.md` (ou sprint específica)
- Extrair: scope, deliverables, arquivos alvo, critérios de sucesso
- Registrar: notas sobre decisões arquiteturais já documentadas
- ⚠️ **Se spec não existir**: criar em EnterPlanMode antes de implementar

#### 1.2 Explorar Codebase
- **Padrão de imports**: confirmar path aliases em `vite.config.js`
- **Estrutura de pastas**: mapear `src/features/*/`, `src/shared/`, `src/services/`
- **Arquivo duplicados**: `find src -name "*NomeArquivo*"` para cada alvo
- **Rastreamento**: `grep -r "from.*NomeArquivo" src/` para impactos
- **Testes existentes**: localizar `__tests__/` do módulo alvo

#### 1.3 Analisar Componentes Base
- Se integrar componente (ex: Autocomplete): ler `src/features/*/components/{base}.jsx`
- Se criar service: ler padrão existente em `src/features/*/services/`
- Se modificar schema: ler `src/schemas/` equivalente + CHECK constraints do Supabase
- Usar: `Explore` agent se escopo > 5 arquivos

#### 1.4 Criar/Confirmar Branch
```bash
git checkout -b feature/fase-N/nome-descritivo
# ou fix/NN/nome-descritivo para hotfixes
```

---

### FASE 2: IMPLEMENTAÇÃO (variável por escopo)

**Objetivo**: Código de qualidade, seguindo padrões do projeto.

#### 2.1 Ordem de Modificação (estrutura)
1. **Schemas primeiro** (`src/schemas/`) — define contratos
2. **Services** (`src/features/*/services/`) — lógica reutilizável
3. **Componentes** (`src/features/*/components/`) — UI
4. **Views** (`src/views/`) — orquestração
5. **Testes** (`__tests__/`) — cobertura
6. **Styles** (`.css`) — isolados no final

#### 2.2 Padrões Obrigatórios

**React Hooks** (ordem imutável):
```jsx
// 1. Estados
const [data, setData] = useState()

// 2. Memos
const processed = useMemo(() => ..., [data])

// 3. Effects
useEffect(() => { ... }, [processed])

// 4. Handlers (useCallback)
const handleClick = useCallback(() => { ... }, [deps])

// 5. Guard clauses DEPOIS dos hooks
if (!data) return null

// 6. Render
return <div>...</div>
```

**Zod Schemas**:
- Enums em PORTUGUÊS: `['diario', 'semanal', 'quando_necessario']`
- Campos nullable: `.nullable().optional()` (nunca só `.optional()`)
- Validação não-bloqueante: sempre `.safeParse()`

**Commits Semânticos**:
```
feat(scope): descrição (nova feature)
fix(scope): descrição (bug fix)
docs(scope): descrição (docs)
refactor(scope): descrição (sem alteração funcional)
test(scope): descrição (apenas testes)
```

#### 2.3 Checklist por Tipo de Mudança

**✓ Novo Componente**:
- [ ] Criar `.jsx` + `.css` junto
- [ ] Adicionar JSDoc comentários em português
- [ ] Integrar imports em index files se necessário
- [ ] Criar `__tests__/{Component}.test.js`
- [ ] Mock Supabase se usar servico

**✓ Novo Service**:
- [ ] Criar `{name}Service.js`
- [ ] Exportar objeto com métodos públicos
- [ ] Usar `safeParse` para validações
- [ ] Adicionar test file com 100% coverage de happy path
- [ ] Documentar retorno esperado

**✓ Modificar Existente**:
- [ ] Read arquivo ANTES de Edit
- [ ] Preservar indentação exata (tabs/spaces)
- [ ] Não adicionar estilos inline (usar classes CSS)
- [ ] Verificar ordem de hooks após mudança
- [ ] Re-validar testes afetados

**✓ Integração com Banco**:
- [ ] Schema Zod sincronizado com CHECK constraints Supabase
- [ ] `getUserId()` / `getCurrentUser()` de `@shared/utils/supabase` (NUNCA `supabase.auth.getUser()` direto)
- [ ] `select()` com colunas específicas (não `select('*')` por padrão)
- [ ] Colunas existem no schema antes de adicioná-las ao select (verificar em `docs/architecture/DATABASE.md`)
- [ ] Tratamento de erros com `.error` object
- [ ] RLS policies (row-level security) respeitadas

#### 2.4 Evitar Anti-Patterns (críticos)
- ❌ `new Date('YYYY-MM-DD')` → ✅ `parseLocalDate('YYYY-MM-DD')`
- ❌ `.optional()` para null → ✅ `.nullable().optional()`
- ❌ Inline styles `style={{}}` → ✅ classes CSS `.wizard__label-note`
- ❌ Guard clauses antes de hooks → ✅ após todos os hooks + estados
- ❌ localStorage em testes → ✅ verificar `NODE_ENV === 'test'`
- ❌ setTimeout em act() → ✅ `waitFor(() => expect(...))`
- ❌ Mocks após imports → ✅ mocks NO TOPO do arquivo de teste

**Performance Mobile (P1-P4 + D0-D3 — obrigatório):**
- ❌ `supabase.auth.getUser()` direto → ✅ `getUserId()` / `getCurrentUser()` de `@shared/utils/supabase` (já cacheados)
- ❌ `select('*')` genérico → ✅ listar colunas necessárias; `{ count: 'exact', head: true }` para counts
- ❌ Import estático de componente pesado em view crítica → ✅ `React.lazy()` para componentes > 200 linhas fora do LCP
- ❌ Import estático de service pesado no top-level → ✅ `import()` dinâmico dentro do handler que usa
- ❌ Re-exportar services pesados em barrel (`@shared/services/index.js`) → ✅ importar direto do arquivo
- ❌ Queries de background logo após `setIsLoading(false)` → ✅ `requestIdleCallback(() => ..., { timeout: 2000 })`
- ❌ Animações com `width`/`height` em `@keyframes` → ✅ `transform: scaleX()` (GPU, zero reflow)
- ❌ `new Date()` em hot loop (> 100 iterações) → ✅ string comparison `YYYY-MM-DD` (lexicograficamente ordenável)

---

### FASE 3: VALIDAÇÃO LOCAL (5-10 min)

**Objetivo**: Zero erros antes de push.

#### 3.1 Testes Locais
```bash
# Executar validação completa (10 min timeout)
npm run validate:agent

# Se falhar, executar por etapas
npm run lint                    # Erros de estilo
npm run test:critical           # Services/schemas/hooks
npm run test:changed            # Apenas arquivos modificados
npm run validate:quick          # Lint + test:changed (mais rápido)
```

#### 3.2 Critérios de Sucesso
- ✅ 0 lint errors
- ✅ Todos os testes passando (473+ críticos mínimo)
- ✅ Build sem warnings
- ✅ Nenhuma console.error em testes

#### 3.3 Se Falhar
- **Lint error**: Ler a sugestão, corrigir no arquivo, re-lint
- **Test failure**: Debugar com `npm run test:changed -- --reporter=verbose`
- **Build error**: Verificar imports de path aliases e circular dependencies

#### 3.4 Debug Rápido
```bash
# Testar arquivo específico
npm run test -- src/features/x/services/y.test.js

# Modo watch para TDD
npm run test:watch -- src/features/x/

# Verificar cobertura
npm run test:coverage
```

---

### FASE 4: GIT & DOCUMENTAÇÃO PRE-PUSH (5 min)

**Objetivo**: Branch limpa, commits claros, documentação atualizada.

#### 4.1 Atualizar Memory/Docs Internas
Se descobriu padrão novo ou anti-pattern:
```bash
# Abrir .memory/rules.md
# Adicionar nova regra R-NNN (próximo número)

# Abrir .memory/anti-patterns.md
# Registrar anti-pattern se foi corrigido erro não-trivial
```

Exemplos:
- Descobriu que `mac_roman` encoding é necessário → R-111 em rules.md
- Aprendeu que guard clause vai DEPOIS de hooks → R-110 em rules.md
- Cometeu erro com `.optional()` em nullable → AP-030 em anti-patterns.md

#### 4.2 Verificar Git Status
```bash
git status  # Ver arquivos modificados

# NÃO commitar:
# - .env, credentials.json
# - node_modules, dist/
# - arquivos temporários

# Staging seletivo:
git add src/features/x/...  # Específicos, não "git add ."
```

#### 4.3 Commits Semânticos
```bash
# 1-2 commits lógicos (não 10 commits small)
# Mensagem em português, imperativo

git commit -m "feat(medications): add ANVISA autocomplete to TreatmentWizard"
git commit -m "fix(medications): correct Mac Roman encoding in ETL script"

# Evitar: "WIP", "fix typo", "cleanup"
```

#### 4.4 Verificar Status da PR Specification
Se a spec foi atualizada durante implementação:
```bash
# Abrir plans/EXEC_SPEC_FASE_N.md
# Atualizar seção "Entrega" se scope mudou
# Adicionar commit hashes implementados
```

---

### FASE 5: PUSH & CODE REVIEW (5-30 min)

**Objetivo**: Qualidade via revisão automatizada (Gemini) + humana.

#### 5.1 Push & Criar PR
```bash
git push -u origin feature/fase-N/nome-descritivo

# Via gh CLI:
gh pr create \
  --title "feat(scope): descrição clara" \
  --body "$(cat <<'EOF'
## Resumo
- O que foi implementado
- Por quê (contexto)

## Mudanças Principais
- Arquivo 1: mudança
- Arquivo 2: mudança

## Checklist
- [x] Testes passando (473+ críticos)
- [x] Lint ok (0 erros)
- [x] Documentação atualizada
- [x] Sem breaking changes

## Test Plan
1. Passo 1 para testar manualmente
2. Passo 2
3. Passo 3

🤖 Generated with Claude Code
EOF
)"
```

#### 5.2 Aguardar Gemini Code Assist
- Bot automático analisa PR (5-15 min)
- Posta comentários com sugestões (se houver)
- Gera issues automáticas para problemas

#### 5.3 Analisar Sugestões
Se `[Medium]` ou `[Low]`: avaliar se faz sentido para projeto
- Refactoring desnecessário? → ignorar
- Estilo code (inline → CSS)? → aplicar
- Segurança/padrão? → aplicar

**Aplicar Sugestões**:
```bash
# 1. Fazer mudança no código
# 2. Commit novo (NÃO amend se foi push)
git commit -m "style(x): remover inline styles para classe CSS"

# 3. Push
git push

# 4. Comentar na PR
# "/gemini review" para re-revisar
```

#### 5.4 Aprovação (Human)
- Aguardar aprovação de humano (o usuário neste caso)
- Validar testes de novo (podem ter falhado após mudanças)

---

### FASE 6: MERGE & CLEANUP (5 min)

**Objetivo**: Integrar em main, deletar branch, registrar entrega.

#### 6.1 Merge com Squash
```bash
# Opção 1: Via gh
gh pr merge PR_NUMBER --squash --delete-branch

# Opção 2: Manual
git checkout main
git pull origin main
git merge --squash feature/fase-N/nome-descritivo
git commit -m "commit message"
git push
git branch -D feature/fase-N/nome-descritivo
git push origin -d feature/fase-N/nome-descritivo
```

Resultado esperado: **1 commit squashado** em main com todos os diffs logicamente agrupados.

#### 6.2 Verificar Main
```bash
git log --oneline -5
# Deve estar sync com origin/main
git pull origin main  # confirmar
```

---

### FASE 7: DOCUMENTAÇÃO FINAL (5-10 min)

**Objetivo**: Registrar entrega formalmente.

#### 7.1 Atualizar Spec Executiva
```bash
# plans/EXEC_SPEC_FASE_N.md

# Seção "## Status da Entrega"
- Marcar como CONCLUÍDO
- Adicionar commit hash (git log --oneline -1)
- Atualizar timestamp

# Seção "## Progresso"
- Atualizar % completo (ex: 80% → 95%)
- Se foi fase final: marcar como 100%
```

#### 7.2 Criar/Atualizar Journal
```bash
# Abrir/criar .memory/journal/YYYY-WWW.md
# (YYYY = ano, WWW = semana ISO 01-53)

# Exemplo: 2026-W11.md para semana 11 de 2026

# Adicionar entrada:
## Sprint 5.C — Entrega X

### Deliverables
- ✅ Autocomplete integrado ao TreatmentWizard
- ✅ Encoding Mac Roman corrigido
- ✅ Documentação atualizada

### Qualidade
- 473/473 testes passando
- 0 lint errors
- Commit: 2f021b2

### Aprendizados
- Guard clause placement rule (R-110)
- Mac Roman encoding para ANVISA (R-111)

### Tempo
- Implementação: 45 min
- Validação: 10 min
- Review: 15 min
- Total: 70 min
```

#### 7.3 Atualizar MEMORY.md
```bash
# .memory/MEMORY.md (max 200 linhas mantém)

# Adicionar na seção "## Sprints Entregues"
- **Sprint 5.C** (2026-W11): Entrega X
  - Autocomplete ANVISA no TreatmentWizard
  - Encoding Mac Roman
  - Commit: 2f021b2

# Remover ou comprimir entradas muito antigas
```

#### 7.4 Issues do GitHub (se aplicável)
```bash
# Se Gemini criou issues automáticas (médias/baixas)
gh issue close ISSUE_NUMBER \
  -c "Resolvido em {commit_hash} — descrição curta"

# Se são duplicadas: fechar ambas com mesmo comentário
```

---

## Exemplo Completo: Sprint 5.B

```
FASE 1 (10min):
  ✓ Ler EXEC_SPEC_FASE_5.md → encoding + autocomplete scope
  ✓ Explorar process-anvisa.js, TreatmentWizard.jsx, Autocomplete components
  ✓ git checkout -b fix/5b/encoding-and-autocomplete

FASE 2 (45min):
  ✓ Adicionar iconv-lite a package.json
  ✓ Modificar process-anvisa.js para mac_roman
  ✓ Integrar MedicineAutocomplete + LaboratoryAutocomplete em TreatmentWizard
  ✓ Adicionar handlers (handleMedicineSelect, handleLaboratorySelect)
  ✓ Adicionar .wizard__label-note CSS
  ✓ Regenerar JSON databases

FASE 3 (10min):
  ✓ npm run validate:agent → 473/473 testes OK
  ✓ npm run lint → 0 erros

FASE 4 (5min):
  ✓ Atualizar .memory/rules.md → R-111 (Mac Roman)
  ✓ git commit -m "fix(medications): correct Mac Roman encoding..."

FASE 5 (20min):
  ✓ git push -u origin fix/5b/encoding-and-autocomplete
  ✓ gh pr create → PR #287
  ✓ Gemini Code Assist → 3 sugestões
  ✓ Aplicar sugestão: remover inline styles → CSS class
  ✓ git commit -m "style(...)"
  ✓ /gemini review → OK

FASE 6 (5min):
  ✓ Aprovação do usuário
  ✓ gh pr merge --squash --delete-branch
  ✓ git pull origin main
  ✓ Commit 2f021b2 em main

FASE 7 (10min):
  ✓ Atualizar EXEC_SPEC_FASE_5.md → 95% completo
  ✓ Criar .memory/journal/2026-W11.md
  ✓ Fechar issues #288 #289
  ✓ Atualizar MEMORY.md

Total: 110 minutos (desde especificação até merge completo)
```

---

## Troubleshooting Rápido

| Problema | Diagnóstico | Solução |
|----------|-------------|---------|
| Testes falham | `npm run test:changed -- --reporter=verbose` | Verificar mock setup, TDZ em hooks |
| Lint error | Ler mensagem exata | Editor + `npm run lint --fix` |
| Encoding corrompido | Verificar fonte CSV | Usar `iconv-lite` + stream pipe |
| Build falha | `npm run build` localmente | Circular imports? Path aliases? |
| PR não mergea | Verificar checks | Re-validar com Gemini, force-push se necessário |
| Specs desatualizadas | Cotejar com atual | Atualizar EXEC_SPEC antes de implementar |

---

## Checklist Pré-Código (obrigatório)

- [ ] Li `CLAUDE.md` (este arquivo + `.memory/rules.md`)
- [ ] Li `.memory/anti-patterns.md` (50 problemas conhecidos)
- [ ] Spec está atualizada? (`plans/EXEC_SPEC_FASE_N.md`)
- [ ] Confirmei path aliases em `vite.config.js`
- [ ] Entendi padrão de componentes/services existentes
- [ ] Vou usar `parseLocalDate()` para datas
- [ ] Vou rodar `npm run validate:agent` antes de push

## Checklist Pós-Código (obrigatório)

- [ ] Testes passando (473+ críticos)
- [ ] Lint zero erros
- [ ] Documentação interna atualizada (memory, spec)
- [ ] Journal entry criado com aprendizados
- [ ] Issues criadas pelo Gemini foram avaliadas/fechadas
- [ ] Main está sincronizado e branch deletada

---

## Referências Internas

- **CLAUDE.md** — conventions, paths, critical rules
- **.memory/rules.md** — 110+ regras documentadas (R-001..R-110)
- **.memory/anti-patterns.md** — 50 anti-patterns a evitar
- **.memory/knowledge.md** — domain facts (Telegram, Zod, etc)
- **docs/INDEX.md** — documentação geral do projeto
