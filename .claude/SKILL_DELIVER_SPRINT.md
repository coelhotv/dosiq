# Skill: deliver-sprint

> Organiza e executa a entrega completa de um sprint especificado.

## Uso

```
/deliver-sprint <fase> <nome-descritivo>
```

Exemplos:
```
/deliver-sprint 5.C "Autocomplete no TreatmentWizard"
/deliver-sprint 6.A "Real-time sync com Supabase"
/deliver-sprint 5.B "Encoding fixes"
```

---

## O que esta Skill Faz

Implementa **7 fases estruturadas** de entrega de sprint:

1. **SETUP & EXPLORAÇÃO** — Entender spec + codebase
2. **IMPLEMENTAÇÃO** — Código seguindo padrões
3. **VALIDAÇÃO LOCAL** — Testes + lint (0 erros)
4. **GIT & DOCS PRE-PUSH** — Memory + branches + commits
5. **PUSH & CODE REVIEW** — PR + Gemini Code Assist
6. **MERGE & CLEANUP** — Squash + delete + sync
7. **DOCUMENTAÇÃO FINAL** — Spec + journal + memory

**Resultado**: Sprint completamente entregue, documentado e integrado em `main`.

---

## Pré-Requisitos

✅ Spec existe em `plans/EXEC_SPEC_FASE_N.md`
✅ Branch criada: `feature/fase-N/...` ou `fix/NN/...`
✅ Nenhuma mudança uncommitted no branch

---

## Fluxo Passo a Passo (Completo)

Ver arquivo completo em: `docs/standards/DELIVER_SPRINT_WORKFLOW.md`

### Resumo Rápido

```bash
# FASE 1: Setup
git checkout -b feature/fase-N/descricao
# Explorar spec + codebase

# FASE 2: Implementação
# Criar/modificar arquivos seguindo padrões

# FASE 3: Validação
npm run validate:agent

# FASE 4: Git & Docs
git add src/features/...
git commit -m "feat(scope): descrição"
# Atualizar .memory/

# FASE 5: Push & Review
git push -u origin feature/fase-N/...
gh pr create --title "..." --body "..."
# Aguardar Gemini Code Assist
# Aplicar sugestões se necessário

# FASE 6: Merge
gh pr merge PR_NUM --squash --delete-branch
git pull origin main

# FASE 7: Documentação
# Atualizar EXEC_SPEC_FASE_N.md
# Criar .memory/journal/YYYY-WWW.md
# Atualizar .memory/MEMORY.md
```

---

## Checklist Rápido (use enquanto implementa)

### Antes de Começar
- [ ] Li `plans/EXEC_SPEC_FASE_N.md` completamente
- [ ] Explorei arquivos alvo com Explore agent se necessário
- [ ] Confirmei path aliases em `vite.config.js`
- [ ] Entendi padrões existentes (hooks, services, components)

### Durante Implementação
- [ ] Seguindo ordem: Schemas → Services → Components → Views → Tests → Styles
- [ ] Respeitando ordem de hooks: States → Memos → Effects → Handlers → Guard clauses
- [ ] Usando `parseLocalDate()` para datas
- [ ] Zod enums em PORTUGUÊS
- [ ] Sem inline styles (usar classes CSS)
- [ ] Sem `.optional()` puro para campos nullable

### Antes de npm run validate:agent
- [ ] Lido arquivo antes de Edit
- [ ] Testes criados para novas funções
- [ ] Nenhum console.error deixado
- [ ] Imports usando path aliases

### Depois de Validação OK
- [ ] Atualizado `.memory/rules.md` se aprendeu padrão novo
- [ ] Atualizado `.memory/anti-patterns.md` se cometeu erro não-trivial
- [ ] Commits semânticos (feat/fix/docs/refactor/test)
- [ ] Nada uncommitted

### Após Merge em Main
- [ ] Spec atualizada (`plans/EXEC_SPEC_FASE_N.md`)
- [ ] Journal criado (`.memory/journal/YYYY-WWW.md`)
- [ ] MEMORY.md atualizado
- [ ] Issues do Gemini fechadas (se houver)

---

## Estrutura de Fase 5.C (Exemplo)

```
SPEC: plans/EXEC_SPEC_FASE_5.md
DELIVERABLES:
  ✅ Encoding correction (process-anvisa.js)
  ✅ Autocomplete integration (TreatmentWizard.jsx)
  ✅ Code style improvements (CSS classes)

TIMELINE: 110 min
  - Setup: 10 min
  - Implementation: 45 min
  - Validation: 10 min
  - Git/Docs: 5 min
  - Push/Review: 20 min
  - Merge/Cleanup: 5 min
  - Final Docs: 10 min

RESULT:
  Commit: 2f021b2 em main
  Tests: 473/473 OK
  Lint: 0 errors
  Journal: .memory/journal/2026-W11.md
```

---

## Quando Usar Esta Skill

✅ **USE** para sprints com spec completa
✅ **USE** quando implementando multiple features relacionadas
✅ **USE** como referência para PRs em produção

❌ **NÃO USE** para one-liner fixes (typos, small tweaks)
❌ **NÃO USE** sem spec executiva documentada
❌ **NÃO USE** como substituição para EnterPlanMode (para planejar)

---

## Referências

- **Workflow completo**: `docs/standards/DELIVER_SPRINT_WORKFLOW.md`
- **Conventions**: `CLAUDE.md`
- **Rules**: `.memory/rules.md` (110+ regras)
- **Anti-patterns**: `.memory/anti-patterns.md` (50 problemas conhecidos)
- **Journal**: `.memory/journal/` (entradas por semana)

---

## Próximas Sprints

Use este skill como checklist para:
- Fase 5.D+
- Fase 6.A (Real-time Sync)
- Fase 6.B (Advanced Analytics)
- Future phases...

Cada execução refina o workflow. **Feedback welcome** após cada entrega.
