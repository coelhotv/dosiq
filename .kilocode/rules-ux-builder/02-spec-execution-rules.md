# UX Builder — Regras de Execucao de Specs

## Regra de Ouro

**Se nao esta na spec, NAO implementar.**

Isso significa:
- NAO adicionar props que a spec nao define
- NAO criar state interno que a spec nao menciona
- NAO importar contextos/providers que a spec nao autoriza
- NAO adicionar features "bonus" ou "melhorias"
- NAO mudar a assinatura de componentes existentes alem do que a spec pede

## Anatomia de uma spec atomica

Cada spec bem definida contem:

| Secao | O que fazer |
|-------|------------|
| **Objetivo** | Entender o proposito em 1 frase |
| **Arquivo** | Usar o caminho EXATO (nunca criar em outro lugar) |
| **Substitui/Evolui** | Se e novo ou edita existente |
| **Props** | Implementar EXATAMENTE estas props (tipos, defaults) |
| **State interno** | Se diz "Nenhum", nao criar useState |
| **Data flow** | De onde vem os dados — NAO buscar de outro lugar |
| **Renderizacao** | Seguir o wireframe ASCII como guia visual |
| **Animacoes** | Usar os parametros EXATOS de Framer Motion |
| **CSS** | Usar os tokens e classes listados |
| **Testes esperados** | Criar EXATAMENTE estes describes/its |
| **Criterios de aceite** | Checklist final — todos devem passar |

## Tipos de task e como executar

### Componente NOVO (arquivo inexistente)
1. Criar `.jsx` no caminho exato da spec
2. Criar `.css` correspondente no mesmo diretorio
3. Definir se e puro (recebe dados por props) ou conectado (usa context/hooks)
   - A spec dira explicitamente — nao adivinhar
4. Exportar como default export
5. Criar testes em `__tests__/` no mesmo diretorio

### Componente EDITADO (evolucao de existente)
1. LER o arquivo existente inteiro antes de editar
2. Identificar as mudancas exatas (tabela "Antes | Depois" na spec, se houver)
3. Adicionar novas props SEM quebrar as existentes (backward compatible)
4. Testes existentes DEVEM continuar passando
5. Adicionar NOVOS testes para a funcionalidade adicionada

### View NOVA (pagina/tab)
1. Criar em `src/views/` com o nome definido na spec
2. Criar CSS dedicado no mesmo diretorio ou em subpasta
3. Registrar no `App.jsx` (adicionar ao switch/objeto de views)
4. Atualizar `BottomNav.jsx` se a view e uma tab principal
5. Criar arquivo de teste em `src/views/__tests__/`

### Hook NOVO
1. Criar em `src/shared/hooks/` (hook compartilhado) ou `src/features/X/hooks/` (hook de feature)
2. Assinatura posicional: `useNomeHook(param1, param2, options)` — nunca objeto como 1o arg
3. Retornar objeto nomeado: `{ data, loading, error, refresh }`
4. Criar testes com `vi.useFakeTimers()` para logica dependente de tempo

### CSS NOVO ou EDITADO
1. Usar tokens do design system (--color-*, --space-*, --font-size-*)
2. NUNCA valores hardcoded (#ef4444 → var(--color-error))
3. Sempre incluir `@media (prefers-reduced-motion: reduce)`
4. Nomenclatura BEM: `.componente__elemento--modificador`
5. Mobile-first: base para 375px, breakpoints com `min-width`

## Regras criticas do projeto

### Datas — CRITICO
- SEMPRE usar `parseLocalDate()` ou `formatLocalDate()` de `@utils/dateUtils`
- NUNCA usar `new Date('YYYY-MM-DD')` — interpreta como UTC midnight → off-by-one em GMT-3
- NUNCA usar `new Date().toISOString().split('T')[0]` — mesmo problema

### Hook order — CRITICO
```
// CORRETO
const [state] = useState()
const memo = useMemo(() => ..., [state])
useEffect(() => { ... }, [memo])
const handler = useCallback(() => { ... }, [])
```

### useCachedQuery — CRITICO
- Assinatura POSICIONAL: `useCachedQuery(key, fetcher, options)` — nunca objeto como 1o arg
- Objeto como 1o arg = `fetcher` recebe `undefined` = data nunca carrega

### Imports — OBRIGATORIO
Usar SEMPRE path aliases. Nunca caminhos relativos longos (`../../`):
```
@           → src/
@features   → src/features/
@shared     → src/shared/
@dashboard  → src/features/dashboard/
@medications → src/features/medications/
@schemas    → src/schemas/
@utils      → src/utils/
```

## Erros que voce NAO pode cometer

| Erro | Consequencia | Prevencao |
|------|-------------|-----------|
| `new Date('YYYY-MM-DD')` direto | Off-by-one em GMT-3 | Usar `parseLocalDate()` |
| `useCachedQuery({key, fetcher})` objeto | Data nunca carrega | Assinatura posicional |
| Importar context em componente puro | Acoplamento indevido | Verificar se spec autoriza |
| Usar cor hardcoded | Quebra tema escuro | Sempre `var(--token)` |
| Esquecer `prefers-reduced-motion` | Falha de acessibilidade | Checklist obrigatorio |
| Quebrar props de componente existente | Regressao | Backward compatible |
| Criar arquivo em path diferente da spec | Confusao de imports | Caminho EXATO |
| Pular testes | Quality gate falha | Criar antes de commitar |
| Variavel de state nao usada apos remover JSX | Lint error no CI | Grep por variaveis orfas |
