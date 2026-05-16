# SPIKE — Lint Custom Rule para R-010 (Hook Order)

> **Status**: Investigação (timebox 1h)
> **Data**: 2026-05-16 (Spike Pre-Fase-2)
> **Origem**: RETRO_FASE1 §6 T2 — anti AP-160 (Opus violando R-010 em fixes incrementais)
> **Decisão**: Adotar fallback template comment + spike futuro de plugin custom

---

## Problema

`AP-160` documenta 4 violações de R-010 (ordem `States → Memos → Effects → Handlers`) cometidas pelo Opus durante fixes incrementais pós-validação PO em Fase 1 (PRs #556 e #558). Cavecrew Sonnet/Haiku NÃO violou — diferencial é o brief R-230 (template comment explícito). Lint atual NÃO detecta.

## Por que o lint nativo não cobre

`eslint-plugin-react-hooks` oferece:
- `react-hooks/rules-of-hooks` — proíbe hooks em condicionais/loops/etc. **Não cobre ordem categórica entre hooks.**
- `react-hooks/exhaustive-deps` — valida deps de useEffect/useMemo/useCallback. **Não cobre ordem.**

`no-restricted-syntax` (em uso para R-020, R-204): AST selectors. Selector "useEffect declarado antes de useMemo no mesmo escopo" é tecnicamente possível mas frágil:
- Falsos positivos quando há `useState` entre `useMemo` blocks (legítimo)
- Não cobre `useFocusEffect`, `useLayoutEffect`, custom hooks que internamente são effects
- Difícil distinguir "memo de output (retorno do hook)" vs "memo de dependência" — R-010 só aplica ao último

## Opções investigadas

### Opção A — Plugin custom `dosiq/hooks-order-by-category`

Plugin ESLint custom em `tools/eslint-plugin-dosiq/hooks-order-by-category.js`. Cada call expression de hook é categorizada (state/memo/effect/handler) e validamos ordem dentro do escopo de função componente.

**Categorias** (mapping de detecção):
- `state`: `useState`, `useReducer`, `useRef`, `useContext`
- `memo`: `useMemo`, hooks customizados que retornam dados (heurística: nome começa com `use` e termina com substantivo plural ou singular — frágil)
- `effect`: `useEffect`, `useLayoutEffect`, `useFocusEffect`, `useInsertionEffect`
- `handler`: `useCallback`, função declarada pós `useEffect`

**Prós**:
- Detecta na fonte
- Customizável para padrões do Dosiq

**Contras**:
- Heurística para `memo` vs custom hooks é frágil (`useMedicines()` retorna data — é state ou memo?)
- Custom hooks chamando `useMutation()` quebram a heurística (é state interno do hook, mas para o consumer é "memo")
- Manutenção do plugin (~150 LOC + tests + docs)
- False positives prováveis em ~10-20% dos casos legítimos (memos de output, hooks dependentes encadeados)

**Esforço estimado**: 6-10h (plugin + tests + integration em eslint.config.js)

### Opção B — Template comment obrigatório (LOW-TECH FALLBACK)

Forçar via convenção: todo componente DEVE começar com comentário template:

```javascript
export default function ComponentName() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const [...] = useState(...)

  // Memos
  const ... = useMemo(...)

  // Effects
  useEffect(...)

  // Handlers
  const handle... = useCallback(...)
  ...
}
```

**Detecção**: simple regex via `no-restricted-syntax` ou plugin micro:
- Componente exportado SEM `// States (R-010` no body → warn
- Hook declaration depois de `// Handlers` comment ANTES de `// Memos` aparecer → error (mas complexo)

Versão MAIS simples: warn quando componente exportado é detectado sem qualquer marcador de bloco.

**Prós**:
- Implementação ~30min via regex no plugin existente
- Zero false-positive em hooks complexos (cavecrew já segue o padrão)
- Cria pressão para Opus seguir o ritual (próximo PR review já flagaria)

**Contras**:
- Não cobre 100% — comentário pode ficar OK e hook ser adicionado no lugar errado depois
- Mitiga sintoma, não causa (Opus em fixes "rápidos" ainda pode pular)

### Opção C — `no-restricted-syntax` heurística simples

Detectar padrão problemático específico no AST:
- `useEffect` ou `useFocusEffect` chamado ANTES de qualquer `useMemo` no body do componente exportado.

**Prós**: zero novo código, só uma nova entry em `no-restricted-syntax`.

**Contras**:
- Falsos positivos quando o componente legitimamente não tem memos (alguns hooks são useEffect-only)
- Não cobre useState após useMemo (a outra violação típica)
- Difícil escrever selector AST que dispare apenas no caso problemático

### Opção D — Code review template + DEVFLOW journal alert

Adicionar à `/check-review` skill: linha obrigatória no checklist humano "**[ ] R-010 ordem dos hooks verificada** (States → Memos → Effects → Handlers)". Sem automation, mas força awareness.

**Prós**: zero código, melhora processo.
**Contras**: depende de disciplina humana.

---

## Recomendação

**Adotar Opção B + Opção D agora; Opção A após Fase 2 se AP-160 reincidir.**

Implementação imediata:
1. **Opção B — Template comment OBRIGATÓRIO** documentado em R-230 (já está) + GLOSSARY.md (a adicionar) + spec Fase 2 (já está em §7).
2. **Opção D — `/check-review` checklist** adicionar bullet "R-010 verificado" como parte do output do reviewer.

Implementação adiada (próxima retro pós-Fase 2):
- **Opção A plugin** — só se AP-160 reincidir em ≥2 PRs da Fase 2 apesar das mitigações B+D. Caso contrário, custo > benefício.

---

## Critério de sucesso (mensurar pós-Fase 2)

- AP-160 reincidência em PRs Fase 2:
  - 0 reincidências → mitigação B+D suficiente; arquivar este spike
  - 1 reincidência → ajustar ritual, sem code
  - ≥2 reincidências → escalar para Opção A (plugin custom)

---

## Histórico

- 2026-05-16 — investigação inicial. Decisão: B+D agora, A condicional.
