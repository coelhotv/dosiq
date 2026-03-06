# UX Builder — Guardrails e Quality Gates

## Classificacao de risco por tipo de mudanca

Antes de comecar, classificar o risco da task. A spec deve indicar — se nao
indicar, usar este guia:

### RISCO BAIXO — Componente novo isolado
**Exemplos:** novo componente visual, novo CSS, nova animacao

**Permitido:**
- Criar arquivos novos em `src/features/` ou `src/shared/components/`
- Usar Framer Motion, CSS tokens
- Receber dados via props (sem acessar context)

**Proibido:**
- Modificar `App.jsx`, `BottomNav.jsx`, views existentes
- Alterar routing ou navegacao
- Importar DashboardProvider/context diretamente no componente

### RISCO MEDIO — Hook ou integracao de componente
**Exemplos:** novo hook, integrar componente no Dashboard, adicionar logica

**Permitido:**
- Criar hooks em `src/shared/hooks/` ou `src/features/*/hooks/`
- Importar e usar context nos hooks
- Editar `Dashboard.jsx` ou views existentes com **mudancas minimas** (import + JSX)

**Proibido:**
- Reescrever arquivos grandes (Dashboard.jsx, App.jsx) — apenas edits cirurgicos
- Alterar `App.jsx` ou `BottomNav.jsx`
- Remover funcionalidade existente

**Regra:** Se a mudanca em um arquivo existente tem mais de ~30 linhas, reavaliar a abordagem.

### RISCO ALTO — Navegacao ou nova view
**Exemplos:** nova tab, nova view, migrar funcionalidade entre views

**Permitido:**
- Modificar `BottomNav.jsx` e `App.jsx`
- Criar views novas em `src/views/`
- Migrar funcionalidade entre views

**Proibido:**
- Fazer todas as mudancas de uma vez (steps atomicos!)
- Deletar views/componentes existentes antes de ter os novos prontos
- Quebrar a navegacao em qualquer momento

**Regra:** Primeiro ADICIONAR, depois REMOVER. Testar cada parte individualmente.

---

## Quality Gate Universal

Toda task — independente de risco — deve passar neste checklist antes do PR:

```
[ ] npm run lint — zero erros, zero warnings
[ ] npm run validate:agent — todos os testes passando
[ ] npm run build — build de producao sem erros
[ ] Nenhum arquivo de duplicata criado (find src -name "*NomeComponente*")
[ ] Todos os criterios de aceite da spec estao marcados
[ ] Nenhuma funcionalidade existente foi quebrada
[ ] Variaveis/handlers orfaos removidos (grep apos remover JSX)
```

### Quality Gate adicional para RISCO ALTO

```
[ ] Navegacao funciona sem dead-ends
[ ] Todas as views existentes continuam acessiveis
[ ] Testes de integracao (BottomNav, App routing) passando
[ ] Smoke test manual: percorrer todas as tabs/views afetadas
```

---

## Anti-patterns especificos de UX

| Anti-pattern | O que fazer em vez disso |
|-------------|-------------------------|
| Componente fora do path da spec | Usar o caminho EXATO |
| Prop nao especificada | Consultar o autor da spec |
| Hex direto no CSS (#ef4444) | Usar `var(--color-error)` |
| Sem empty state | Toda lista precisa de fallback vazio |
| Sem loading state | Skeleton ou spinner para dados assincronos |
| Spinner em vez de skeleton | Skeleton para layouts previsiveis |
| Animacao sem reduced-motion | Sempre incluir fallback CSS ou hook |
| Click handler sem feedback visual | Hover + active states |
| Texto truncado sem title/tooltip | Adicionar `title` no elemento |
| SVG sem `role="img"` e `aria-label` | Acessibilidade obrigatoria |
| `window.confirm()` | Usar componente `Modal` do projeto |
| `Math.random()` para tokens de seguranca | Usar `window.crypto.randomUUID()` |
| `new Date().toISOString().split('T')[0]` | Usar `formatLocalDate(new Date())` |

---

## Reportando bloqueios

**Task BLOQUEADA por dependencia:**
1. NAO tentar implementar sem a dependencia
2. Reportar: "Task {ID} BLOQUEADA: depende de {dependencia nao concluida}"
3. Passar para a proxima task disponivel se houver
4. Atualizar o status no arquivo de spec/progresso

**Spec ambigua ou incorreta:**
1. NAO adivinhar a intencao
2. Reportar a ambiguidade com citacao exata da spec
3. Sugerir interpretacoes possiveis
4. Aguardar orientacao antes de implementar

**Arquivo da spec nao encontrado:**
1. Verificar em `plans/`, `plans/specs/`, `plans/roadmap_details/`
2. Se nao existir, informar o usuario — nao criar spec sem autorizacao

---

## Validacao final antes de PR

```bash
# 1. Lint
npm run lint

# 2. Testes criticos
npm run validate:agent

# 3. Build de producao
npm run build

# 4. Verificar duplicatas
find src -name "*NomeComponente*" -type f

# 5. Verificar imports
grep -r "from.*NomeComponente" src/

# 6. Verificar variaveis orfas (se removeu JSX)
grep -n "variavel_removida" src/views/ArquivoEditado.jsx
```
