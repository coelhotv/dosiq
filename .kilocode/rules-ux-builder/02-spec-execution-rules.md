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

Cada spec contem:

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

## Regras por tipo de task

### Componente NOVO (ex: RingGauge.jsx)
1. Criar arquivo .jsx no caminho da spec
2. Criar arquivo .css correspondente
3. Componente recebe dados por PROPS (Onda 1 = puro, sem context)
4. Exportar como default export
5. Criar testes em `__tests__/` no mesmo diretorio

### Componente EDITADO (ex: SparklineAdesao.jsx — evolucao)
1. LER o componente existente inteiro antes de editar
2. Identificar as mudancas exatas da spec (tabela "Antes | Depois")
3. Adicionar novas props SEM quebrar as existentes
4. Manter backward compatibility (props antigas continuam funcionando)
5. Testes existentes DEVEM continuar passando
6. Adicionar NOVOS testes para a funcionalidade adicionada

### CSS NOVO (ex: animations.css)
1. Usar tokens do design system (--color-*, --space-*, --font-size-*)
2. NUNCA valores hardcoded (#ef4444 -> var(--color-error))
3. Sempre incluir @media (prefers-reduced-motion: reduce)
4. Classes BEM: .componente__elemento--modificador

## Erros que voce NAO pode cometer

| Erro | Consequencia | Prevencao |
|------|-------------|-----------|
| Importar DashboardProvider na Onda 1 | Acoplamento prematuro | Onda 1 = props only |
| Criar state quando spec diz "Nenhum" | Componente impuro | Ler spec com atencao |
| Usar cor hardcoded | Quebra tema escuro | Sempre var(--token) |
| Esquecer prefers-reduced-motion | Acessibilidade | Checklist obrigatorio |
| Mudar props de componente existente | Regressao | Backward compatible |
| Criar arquivo em path diferente da spec | Confusao de imports | Caminho EXATO |
| Pular testes | Quality gate falha | Criar ANTES de commitar |
