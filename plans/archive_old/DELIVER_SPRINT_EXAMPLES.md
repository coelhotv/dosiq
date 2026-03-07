# deliver-sprint — Exemplos Práticos

> Casos de uso reais da skill compilada de sprints 5.A, 5.B, 5.C.

## Exemplo 1: Sprint 5.B Fixes (Encoding + Autocomplete)

**Contexto**: Bugs encontrados pós-entrega de Sprint 5.A (encoding corrompido + autocomplete não integrado).

### Fase 1: Setup (10 min)
```bash
# Exploração
cat plans/EXEC_SPEC_FASE_5.md  # Ler spec (era a mesma)

# Identificar arquivos
find src -name "*process-anvisa*"
find src -name "*TreatmentWizard*"
grep -r "mac_roman\|latin1" src/

# Criar branch
git checkout -b fix/5b/encoding-and-autocomplete
```

### Fase 2: Implementação (45 min)
```javascript
// 1. Modificar ETL: scripts/process-anvisa.js
// ANTES:
const fileStream = fs.createReadStream(CSV_INPUT, 'latin1')

// DEPOIS:
import iconv from 'iconv-lite'
const fileStream = fs.createReadStream(CSV_INPUT)
const decodedStream = fileStream.pipe(iconv.decodeStream('mac_roman'))
const rl = readline.createInterface({
  input: decodedStream,
  crlfDelay: Infinity,
})

// 2. Integrar Autocomplete: src/features/protocols/components/TreatmentWizard.jsx
// Adicionar imports
import MedicineAutocomplete from '@medications/components/MedicineAutocomplete'
import LaboratoryAutocomplete from '@medications/components/LaboratoryAutocomplete'

// Estender estado
const [medicineData, setMedicineData] = useState({
  name: '',
  laboratory: '',
  active_ingredient: '',
  therapeutic_class: null,
})

// Adicionar handlers
const handleMedicineSelect = useCallback((medicine) => {
  setMedicineData(prev => ({
    ...prev,
    name: medicine.name,
    active_ingredient: medicine.activeIngredient || '',
    therapeutic_class: medicine.therapeuticClass || null,
  }))
}, [])

// Substituir input por autocomplete
<MedicineAutocomplete
  value={medicineData.name}
  onChange={(value) => updateMedicine('name', value)}
  onSelect={handleMedicineSelect}
  placeholder="Ex: Losartana ou busque na base ANVISA..."
/>
```

### Fase 3: Validação (10 min)
```bash
npm run validate:agent
# ✅ 473/473 tests passing
# ✅ 0 lint errors
# ✅ Build OK
```

### Fase 4: Git & Docs (5 min)
```bash
# Atualizar memory
cat >> .memory/rules.md <<'EOF'

## R-111: Mac Roman Encoding para ANVISA CSV

Node.js `fs.createReadStream()` não suporta 'mac_roman' nativamente.
Usar iconv-lite + stream pipe:

```js
const decodedStream = fileStream.pipe(iconv.decodeStream('mac_roman'))
```

Aplicação: scripts/process-anvisa.js (ETL de medicamentos)
Referência: Sprint 5.B fix commit 2f021b2
EOF

# Commits semânticos
git add scripts/process-anvisa.js package.json
git commit -m "fix(medications): correct Mac Roman encoding in ETL"

git add src/features/protocols/components/TreatmentWizard.jsx
git commit -m "feat(protocols): add ANVISA autocomplete to TreatmentWizard"
```

### Fase 5: Push & Review (20 min)
```bash
git push -u origin fix/5b/encoding-and-autocomplete

# Via gh
gh pr create \
  --title "fix(medications): correct Mac Roman encoding + add autocomplete" \
  --body "## Resumo
- Corrigir encoding do CSV ANVISA (mac_roman, não latin1)
- Integrar MedicineAutocomplete e LaboratoryAutocomplete ao TreatmentWizard
- Remover inline styles → CSS classes

## Mudanças
- scripts/process-anvisa.js: iconv-lite piped stream
- TreatmentWizard.jsx: handlers + autocomplete components
- TreatmentWizard.css: .wizard__label-note class

## Testes
✅ 473/473 passing
✅ 0 lint errors

## Test Plan
1. Abrir "+Novo" no tratamento
2. Campo "Nome": buscar medicamento com 3+ chars → lista ANVISA
3. Selecionar medicamento → "Princípio Ativo" auto-preenchido
4. Campo "Laboratório": buscar lab → lista ANVISA
5. Completar wizard → medicamento salvo com dados ANVISA
"

# Aguardar Gemini Code Assist
# (5-15 min, analisa tudo automaticamente)

# Se sugestões: aplicar e re-revisar
git commit -m "style(protocols): remove inline styles for CSS class"
git push
# Comentar: "/gemini review"
```

### Fase 6: Merge (5 min)
```bash
# Aprovação do usuário, depois:
gh pr merge 287 --squash --delete-branch

# Resultado:
# ✅ Branch deletada
# ✅ Commit squashado: 2f021b2
# ✅ Main sync com origin
```

### Fase 7: Documentação (10 min)
```bash
# Atualizar spec
cat > plans/EXEC_SPEC_FASE_5.md <<'EOF'
## Status da Entrega

### Sprint 5.C — CONCLUÍDO

| Item | Status | Commit |
|------|--------|--------|
| Encoding Fix | ✅ | 2f021b2 |
| Autocomplete | ✅ | 2f021b2 |
| Documentation | ✅ | 2f021b2 |

Progresso: 80% → 95% (fase 5 completa)
EOF

# Criar journal
cat > .memory/journal/2026-W11.md <<'EOF'
## Sprint 5.C — Encoding + Autocomplete Fixes

### Deliverables
✅ Encoding Mac Roman corrigido (900+ medicines)
✅ Autocomplete integrado ao TreatmentWizard
✅ Code review suggestions applied
✅ Documentação atualizada

### Quality
- 473/473 tests ✅
- 0 lint errors ✅
- Commit: 2f021b2

### Learnings
- R-111: Mac Roman encoding (iconv-lite)
- Guard clause placement (após todos os hooks)
- CSS class extraction from inline styles

### Time
- Setup: 10 min
- Implementation: 45 min
- Validation: 10 min
- Git/Docs: 5 min
- Push/Review: 20 min
- Merge: 5 min
- Final Docs: 10 min
- **Total: 110 min**
EOF

# Fechar issues automáticas
gh issue close 288 -c "Resolvido em 2f021b2 — remover inline styles"
gh issue close 289 -c "Resolvido em 2f021b2 — remover inline styles"

# Atualizar memory
cat >> .memory/MEMORY.md <<'EOF'

## Sprint 5.C (Fixes) — Encoding + Autocomplete ✅ DELIVERED
**Status:** MERGED em main (commit 2f021b2, PR #287)
- **Fixes:** Mac Roman encoding (ANVISA CSV), Autocomplete integration (TreatmentWizard)
- **Code Review:** 1/1 sugestão Gemini resolvida (remove inline styles)
- **Quality Gate:** ✅ PASSED (473/473 tests)
- **Journal:** 2026-W11.md
- **Timeline:** 07/03/2026
EOF
```

---

## Exemplo 2: Sprint 5.A (Cost Analysis Feature)

**Contexto**: Nouvelle feature complexa com múltiplas dependências.

### Timeline Resumida
```
FASE 1 (Setup): 10 min
  ✓ Ler EXEC_SPEC_FASE_5.md (F5.10 — Cost Analysis)
  ✓ Explorar Stock.jsx, schemas, services
  ✓ git checkout -b feature/fase-5/cost-analysis

FASE 2 (Implementation): 60 min
  ✓ Criar costAnalysisSchema.js (Zod with .coerce, .min(), .nullable().optional())
  ✓ Criar costAnalysisService.js (171 linhas, O(M+P) optimized)
  ✓ Integrar em Stock.jsx (componente CostChart)
  ✓ 524 linhas de testes (getAnalysis, calculate, edge cases)

FASE 3 (Validation): 10 min
  ✓ npm run validate:agent → 425/425 tests ✅
  ✓ Coverage 95.65% ✅

FASE 4 (Git): 5 min
  ✓ Atualizar .memory/rules.md → R-??? (cost analysis patterns)
  ✓ 4 commits semânticos (feat + 3 follow-ups para code review)

FASE 5 (Push/Review): 30 min
  ✓ gh pr create
  ✓ Gemini: 4 sugestões (1 CRITICAL, 3 HIGH)
  ✓ Aplicar todas as 4 em 4 commits separados
  ✓ Gemini re-review OK

FASE 6 (Merge): 5 min
  ✓ gh pr merge --squash
  ✓ Commit: 894bb98

FASE 7 (Docs): 10 min
  ✓ Atualizar EXEC_SPEC_FASE_5.md
  ✓ Criar 2026-W10.md com aprendizados (Zod validation, performance optimization)

TOTAL: 130 minutos (setup → main merged)
```

### Deliverables
- ✅ costAnalysisSchema.js (73 linhas)
- ✅ costAnalysisService.js (171 linhas, 6.7x faster than naive)
- ✅ Integration em Stock.jsx
- ✅ 524 linhas de testes (100% happy path)
- ✅ Journal entry com aprendizados

---

## Exemplo 3: Próxima Sprint (Fase 6.A)

**Contexto**: Não especificada ainda, mas skill pode ser usada assim:

```bash
# PASSO 1: Ler spec
cat plans/EXEC_SPEC_FASE_6.md

# PASSO 2: Invocar skill
# "Estou pronto para entregar Fase 6.A. Usa deliver-sprint para organizar"
# Referência: plans/DELIVER_SPRINT_WORKFLOW.md

# PASSO 3: Seguir checklist
# ✅ Setup (exploração)
# ✅ Implementation (código)
# ✅ Validation (testes)
# ✅ Git & Docs (memory + commits)
# ✅ Push & Review (PR + Gemini)
# ✅ Merge (squash + sync)
# ✅ Final Docs (spec + journal)

# RESULTADO: Entrega completa, documentada, integrada em main
```

---

## Patterns Reutilizáveis (compilados da skill)

### Pattern 1: Encoding Issues
```javascript
// Problema: charset mismatch (CSV em mac_roman, lendo com latin1)
// Solução: iconv-lite + stream pipe
// Exemplo: scripts/process-anvisa.js

const fileStream = fs.createReadStream(path)
const decodedStream = fileStream.pipe(iconv.decodeStream('mac_roman'))
const rl = readline.createInterface({ input: decodedStream })
```

### Pattern 2: Component Integration
```javascript
// Problema: novo componente precisa integrar em existente
// Solução: analisar padrão (ex: MedicineAutocomplete em MedicineForm)
// Depois aplicar ao novo local (TreatmentWizard)

// 1. Ler componente existente (MedicineForm.jsx)
// 2. Identificar handler pattern (onSelect callback)
// 3. Replicar em novo contexto (TreatmentWizard)
```

### Pattern 3: Code Review Cycles
```bash
# Ciclo 1: Gemini Code Assist (~10 min)
# - Detecta sugestões automáticas
# - Cria issues se CRITICAL/HIGH

# Ciclo 2: Apply Suggestions (~15 min)
# - Avaliar se sugestão faz sentido
# - Aplicar em novo commit
# - Re-request review (/gemini review)

# Ciclo 3: Merge (~5 min)
# - Após aprovação human
# - Squash merge (1 commit lógico)
```

---

## Checklist Rápida por Fase

### Fase 1: Setup ✅
- [ ] Spec lida (plans/EXEC_SPEC_*)
- [ ] Codebase explorado (files + patterns)
- [ ] Branch criada (feature/fase-N/...)

### Fase 2: Implementation ✅
- [ ] Padrões seguidos (hooks order, Zod, etc)
- [ ] Zero console.error
- [ ] Commits semânticos

### Fase 3: Validation ✅
- [ ] `npm run validate:agent` OK
- [ ] 0 lint errors
- [ ] Testes 100% passing

### Fase 4: Git & Docs ✅
- [ ] Memory atualizada (rules + anti-patterns)
- [ ] Staging seletivo (sem lixo)
- [ ] Commits claros

### Fase 5: Push & Review ✅
- [ ] PR com boa descrição
- [ ] Gemini suggestions avaliadas
- [ ] Aplicar se faz sentido

### Fase 6: Merge ✅
- [ ] PR aprovada (human)
- [ ] Squash merge
- [ ] Branch deletada

### Fase 7: Docs ✅
- [ ] Spec atualizada
- [ ] Journal criado (YYYY-WWW.md)
- [ ] Memory atualizada

---

## Benchmarks (baseado em 5.A + 5.B + 5.C)

| Fase | Tempo Médio | Variável Por |
|------|-------------|--------------|
| Setup | 10 min | Familiaridade com codebase |
| Implementation | 45-60 min | Complexidade feature |
| Validation | 10 min | # de tests |
| Git & Docs | 5 min | Quanta coisa é nova |
| Push & Review | 20-30 min | # de suggestions Gemini |
| Merge | 5 min | Fixed |
| Final Docs | 10 min | Size de journal |
| **TOTAL** | **105-125 min** | **Sprint scope** |

---

## Próximas Iterações da Skill

- [ ] Adicionar templates de PR description (copy-paste ready)
- [ ] Criar script bash para automizar fases 1-3
- [ ] Integrar com GitHub workflow (auto-label, auto-assign)
- [ ] Documentar variações por tipo (feature vs fix vs refactor)
