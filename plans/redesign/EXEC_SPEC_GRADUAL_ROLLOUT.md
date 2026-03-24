# EXEC_SPEC — Gradual Redesign Rollout

**Status:** Aprovado para execução
**Branch:** `claude/gradual-redesign-rollout-VBlvB`
**Versão:** 1.0
**Data:** 2026-03-23

---

## Contexto

O redesign "Santuário Terapêutico" (W0-W12) é uma mudança visual completa. Ele precisa ser
desenvolvido e validado com usuários reais em sessões privadas (pesquisa qualitativa) **antes**
de ser habilitado para todos os usuários.

**Problema:** Como desenvolver o redesign incrementalmente (wave por wave) sem que usuários
atuais vejam o estilo novo até validação completa?

**Solução:** Feature flag baseado em `data-attribute` no root da app + CSS custom property
override scoped. Todos os tokens e estilos novos só ativam quando `data-redesign="true"` está
presente no `<div id="app">`. Sem o atributo, o app funciona 100% igual ao atual.

---

## Abordagem: CSS Scoped Token Override + RedesignContext

### Por que esta abordagem

- **Sem duplicação de componentes para W0-W3:** Tokens, tipografia e superfícies são 100% CSS
  custom properties. Basta sobrescrever as variáveis sob `[data-redesign="true"]`.
- **Rollback trivial:** Deletar o CSS de redesign + remover o `data-attribute` = volta ao
  estado atual imediatamente.
- **Zero impacto em usuários atuais:** O flag está em `localStorage` + URL param, nunca ativo
  por padrão.
- **Compatível com o lazy loading atual:** Nenhuma mudança no sistema de chunks Vite.
- **Para W4+ (layouts que mudam estruturalmente):** `useRedesign()` hook direciona para
  variantes de componente quando necessário.

---

## Arquitetura do Sistema de Flag

### RedesignContext (`src/shared/contexts/RedesignContext.jsx`)

```jsx
const { isRedesignEnabled, toggleRedesign } = useRedesign()

// Fontes de ativação (OR logic):
// 1. localStorage.getItem('mr_redesign_preview') === '1'
// 2. URL param: ?redesign=1 (seta localStorage automaticamente)
// 3. URL param: ?redesign=0 (limpa localStorage — útil para sessões de QA)
```

### App.jsx — data-attribute no root

```jsx
const { isRedesignEnabled } = useRedesign()
return (
  <div id="app" data-redesign={isRedesignEnabled ? 'true' : undefined}>
    {/* app */}
  </div>
)
```

### CSS Strategy

- **`src/shared/styles/tokens.redesign.css`** — tokens W0 scoped em `[data-redesign="true"]`
- **`src/shared/styles/index.css`** — importa `tokens.redesign.css` após os tokens atuais
- **Tokens atuais (`tokens/colors.css`, etc.) NÃO são tocados**

```css
[data-redesign="true"] {
  --color-primary: #006a5e;
  --color-primary-container: #008577;
  /* ... todos os tokens W0 ... */
}
```

---

## Fluxo por Wave

| Wave | Estratégia de Isolamento |
|------|--------------------------|
| W0 — Tokens | Sobrescrita CSS scoped em `[data-redesign="true"]` |
| W1 — Typography | `@import` de fontes (global, topo do arquivo); aplicação dos estilos de tipografia scoped em `[data-redesign="true"]` |
| W2 — Surface/Layout | Classes novas com prefixo `-sanctuary` ou scoped |
| W3 — Components | CSS interno dos componentes lê `[data-redesign="true"]`; API de props NUNCA muda |
| W4+ — Views | `useRedesign()` direciona para variante em `src/views/redesign/` |

---

## Como Ativar para Sessões Privadas de Validação

### Pesquisadores/QA (usuários externos):
```
https://app.meusremedios.com.br?redesign=1
```
- URL param detectado no `RedesignContext` ao montar
- Seta `localStorage.mr_redesign_preview = '1'` automaticamente
- Persiste durante a sessão inteira (reloads mantêm o flag)
- Para desativar: `?redesign=0` na URL

### Time interno:
- Toggle oculto em **Configurações** (`src/views/Settings.jsx`)
- Visível somente quando `localStorage.getItem('mr_dev_mode') === '1'`
- Permite ligar/desligar sem precisar manipular URL

---

## Arquivos Criados/Modificados neste Sprint

| Arquivo | Operação | Descrição |
|---------|----------|-----------|
| `src/shared/contexts/RedesignContext.jsx` | CRIAR | Provider + lógica do feature flag |
| `src/shared/hooks/useRedesign.js` | CRIAR | Hook público de consumo |
| `src/shared/styles/tokens.redesign.css` | CRIAR | Tokens W0 scoped em `[data-redesign="true"]` |
| `src/shared/styles/index.css` | MODIFICAR | Importar `tokens.redesign.css` |
| `src/App.jsx` | MODIFICAR | Wrap com `RedesignProvider`, aplicar `data-redesign` |
| `src/views/Settings.jsx` | MODIFICAR | Toggle oculto para time interno |

---

## Estrutura de Arquivos Futuros (Waves 1-12)

```
src/
  shared/
    styles/
      tokens.redesign.css          # W0 — tokens scoped (CRIADO neste sprint)
      typography.redesign.css      # W1 — fontes (Public Sans + Lexend)
      layout.redesign.css          # W2 — grid/surfaces sanctuary
      components.redesign.css      # W3 — component styles
  views/
    redesign/                      # W4+ — variantes de view
      DashboardRedesign.jsx
      TreatmentsRedesign.jsx
      StockRedesign.jsx
```

---

## Verificação

```bash
# Smoke test: flag desligado = app idêntico ao atual
# Smoke test: ?redesign=1 = tokens novos ativos

# Build sem erros
npm run build

# Sem regressões em testes
npm run validate:agent

# Bundle: tokens.redesign.css deve ser < 20KB gzip
```

---

## Critério de Conclusão deste Sprint

- [ ] `RedesignContext` + `useRedesign` criados e funcionando
- [ ] URL `?redesign=1` ativa os novos tokens visualmente
- [ ] App sem flag = visual atual intacto
- [ ] Toggle oculto em Settings funciona
- [ ] `npm run validate:agent` passa
- [ ] PR criado e aguardando review Gemini
