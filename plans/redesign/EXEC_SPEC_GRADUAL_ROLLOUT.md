# EXEC_SPEC — Gradual Redesign Rollout

**Status:** Infraestrutura de rollout entregue ✅ | Waves W0-W12 pendentes
**Versão:** 2.0
**Data:** 2026-03-24

---

## Contexto

O redesign "Santuário Terapêutico" (W0-W12) é uma mudança visual completa. Ele precisa ser
desenvolvido e validado com usuários reais em sessões privadas (pesquisa qualitativa) **antes**
de ser habilitado para todos os usuários.

**Problema:** Como desenvolver o redesign incrementalmente (wave por wave) sem que usuários
atuais vejam o estilo novo até validação completa?

**Solução:** Feature flag baseado em `data-attribute` no root da app + CSS custom property
override scoped. Todos os tokens e estilos novos só ativam quando `data-redesign="true"` está
presente no `.app-container`. Sem o atributo, o app funciona 100% igual ao atual.

**Princípio central:**

> Durante construção e pesquisa, o redesign é uma experiência opt-in, isolada por feature flag.

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
  <div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>
    {/* app */}
  </div>
)
```

### Regras do flag

- O flag **nunca** pode nascer ativo por padrão em produção.
- O flag **nunca** pode alterar dados, payloads ou regras de negócio.
- O flag controla apresentação e composição, não comportamento clínico.

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

| Faixa | Natureza da mudança | Estratégia obrigatória |
|------|----------------------|------------------------|
| **W0-W1** | Tokens, cor, tipografia, sombras, radius | CSS scoped em `[data-redesign="true"]` |
| **W2-W3** | Surface, layout utilities, primitives | CSS scoped + classes novas/aditivas |
| **W4-W5** | Navigation shell, sidebar, motion estrutural | Variantes explícitas com `useRedesign()` |
| **W6-W12** | Views e fluxos principais | Variantes explícitas de view/componente |

---

## Regra de Ouro — Foundation vs Experience

Nem toda wave de redesign é do mesmo tipo.

- **Foundation waves** (W0-W3): mudam tokens, tipografia, superfícies e primitives.
  → CSS scoped resolve bem.
- **Experience waves** (W4-W12): mudam composição, navegação, densidade, hierarquia e fluxo.
  → CSS scoped sozinho NÃO resolve.

### Regra operacional

- Se a mudança cabe em token/utilitário/skin: usar CSS scoped.
- Se a mudança altera árvore JSX, densidade, ordem de blocos, navegação ou composição: criar variante explícita.

Qualquer tentativa de empurrar W4+ apenas com override visual aumenta acoplamento, complexidade
de manutenção, risco de regressão silenciosa e custo de cleanup no fim do rollout.

---

## O que Compartilhar vs Duplicar

### Deve permanecer compartilhado (nunca duplicar)

- services;
- hooks de domínio;
- schemas Zod;
- integrações Supabase;
- cache/SWR;
- handlers de navegação (`setCurrentView`, params iniciais);
- regras de negócio e validação.

### Pode ter variante paralela

- views em `src/views/redesign/`;
- shell de navegação;
- layouts responsivos;
- components fortemente visuais;
- motion wrappers;
- primitives com skin própria.

### Não fazer

- duplicar service só porque a UI mudou;
- criar schema paralelo para a mesma entidade;
- introduzir estado clínico divergente entre antigo e novo;
- mover regra de domínio para dentro de componente de redesign.

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

## Estratégia de Branching no Código

### Onde o branching pode existir

- `App.jsx` para escolher shell/view variante;
- views canônicas que delegam para versão legacy/redesign;
- componentes de alto nível do redesign;
- contextos específicos de experiência, se necessário.

### Onde o branching deve ser evitado

- deep inside de subcomponentes pequenos;
- services, utils, schemas, funções de cálculo.

### Regra prática

Preferir:

```jsx
return isRedesignEnabled ? <DashboardRedesign ... /> : <DashboardLegacy ... />
```

Evitar:

```jsx
<Card className={isRedesignEnabled ? 'x' : 'y'}>
  {isRedesignEnabled ? <BlocoA /> : <BlocoB />}
  ...
</Card>
```

Quando condicionais fragmentadas começam a se repetir em muitos níveis, extrair para variante explícita.

---

## Pontos de Atenção e Mitigações

### CSS scoped tem limite — não tratar W4+ como tema

**Risco:** tentar resolver layout estrutural apenas com seletor mais específico.

**Mitigação:** congelar a regra de que W4+ exige variante explícita; rejeitar PR que tente
resolver composição de layout só com CSS scoped.

### Fontes carregadas globalmente

**Risco:** mesmo sem impacto visual, o `@import` de fontes pode disparar download para todos os usuários.

**Mitigação:** aceitar este custo nas waves iniciais. Medir efeito em Lighthouse. Se o custo
ficar relevante, migrar carregamento para estratégia lazy ou dinâmica na fase de hardening.

### `if (isRedesignEnabled)` espalhado cria acoplamento

**Risco:** condicionais fragmentadas em componentes pequenos aumentam custo de manutenção.

**Mitigação:** centralizar branching em `App.jsx`, shell e views canônicas. Evitar
`isRedesignEnabled` espalhado em subcomponentes.

### Cleanup final tipo big-bang é arriscado

**Risco:** remover scoping, mesclar tokens e apagar legado tudo de uma vez pode gerar regressão grande.

**Mitigação:** promover redesign a default primeiro. Manter experiência antiga atrás de `legacy flag`
temporário. Só depois executar limpeza por camadas.

### Pesquisa sem protocolo vira opinião

**Risco:** validar redesign com feedback ad hoc e sem critérios comparáveis.

**Mitigação:** toda sessão precisa de roteiro, hipótese e checklist observacional. Comparar tarefas
idênticas entre experiência atual e redesign. Registrar fricções por tarefa, não só preferência subjetiva.

---

## Protocolo de Pesquisa Qualitativa

### Objetivo

Responder se o redesign melhora a capacidade do paciente de entender:

- o que precisa fazer agora;
- o que está atrasado ou crítico;
- como navegar entre Hoje, Tratamentos, Estoque e Perfil;
- como executar tarefas sem aumentar carga cognitiva.

### Tarefas mínimas por sessão

- identificar a próxima ação no dashboard;
- localizar um tratamento específico;
- entender risco de estoque;
- executar uma ação primária;
- encontrar configuração relevante;
- voltar ao contexto anterior sem se perder.

### Critérios qualitativos de avanço

- participantes entendem a ação principal sem mediação excessiva;
- nova hierarquia reduz confusão em relação à versão atual;
- navegação não aumenta esforço de descoberta;
- feedback visual é percebido como claro, não ornamental;
- não surgem problemas graves de legibilidade ou densidade.

---

## Quality Gates

### Gates obrigatórios por PR

- lint sem erros;
- testes relevantes da área alterada;
- `npm run validate:agent` para waves que mudem app runtime;
- build funcionando (`npm run build`);
- smoke manual com flag **desligado** — app visualmente intacto;
- smoke manual com flag **ligado** — tokens/estilos corretos para a wave.

### Gates por transição de fase

| Fase | Gate |
|------|------|
| **Foundation complete** | Tokens e primitives estáveis com flag on/off |
| **Research-ready** | Shell/view alvo funcional para sessão guiada |
| **Pilot-ready** | Sem regressões graves + evidência qualitativa inicial |
| **Default-ready** | Pesquisa consolidada + bugs críticos zerados |
| **Cleanup-ready** | Redesign já default com estabilidade sustentada |

---

## Estratégia de Rollout para Produção

### Fase 0 — Construção interna

- redesign disponível apenas via flag;
- uso por time interno e QA;
- foco em estabilidade técnica.

### Fase 1 — Pesquisa qualitativa privada

- sessões guiadas com usuários selecionados;
- acesso por URL com flag (`?redesign=1`);
- foco em compreensão, legibilidade e fluxo.

### Fase 2 — Piloto controlado (opcional)

- manter estratégia atual se bastar para QA ampliado;
- se necessário, introduzir feature flag por usuário no backend.

### Fase 3 — Redesign vira default

- redesign passa a ser experiência padrão;
- experiência antiga permanece atrás de flag temporário por período curto e definido;
- monitorar regressões e feedback.

### Fase 4 — Cleanup

- remover legacy flag;
- apagar variantes antigas;
- consolidar tokens e estilos canônicos;
- atualizar documentação final.

---

## Estratégia de Cleanup

Executar em quatro passos sequenciais:

1. tornar redesign default sem apagar legado no mesmo PR;
2. introduzir `legacy fallback` temporário apenas para segurança operacional;
3. remover componentes/views legados em ondas pequenas;
4. consolidar tokens e apagar arquivos `.redesign.*` somente no fim.

**Regra:** o projeto não deve depender de um único PR final de "virada e limpeza".

---

## Arquivos Criados/Modificados — Sprint de Infraestrutura de Rollout

> Este sprint entregou apenas a **plataforma técnica** para receber o redesign de forma gradual.
> Nenhuma wave de design (W0-W12) foi executada ainda.

| Arquivo | Operação | Descrição |
|---------|----------|-----------|
| `src/shared/contexts/RedesignContext.jsx` | CRIADO | Provider + lógica do feature flag |
| `src/shared/contexts/RedesignContext.js` | CRIADO | Objeto de contexto (separado para react-refresh) |
| `src/shared/hooks/useRedesign.js` | CRIADO | Hook público de consumo |
| `src/shared/styles/tokens.redesign.css` | CRIADO | Arquivo-base para tokens scoped (ainda sem tokens de wave) |
| `src/shared/styles/index.css` | MODIFICADO | Importar `tokens.redesign.css` |
| `src/App.jsx` | MODIFICADO | Wrap com `RedesignProvider`, aplicar `data-redesign` ao `.app-container` |
| `src/views/Settings.jsx` | MODIFICADO | Toggle oculto para time interno |

---

## Estrutura de Arquivos — Waves 0-12 (a executar)

```
src/
  shared/
    styles/
      tokens.redesign.css          # W0 — tokens de cor, sombra, radius (a executar)
      typography.redesign.css      # W1 — fontes (Public Sans + Lexend) (a executar)
      layout.redesign.css          # W2 — grid/surfaces sanctuary (a executar)
      components.redesign.css      # W3 — component styles (a executar)
  views/
    redesign/                      # W4+ — variantes de view (a executar)
      DashboardRedesign.jsx
      TreatmentsRedesign.jsx
      StockRedesign.jsx
```

---

## Critérios de Sucesso

O rollout será considerado bem-sucedido quando:

- o redesign puder conviver com a experiência atual sem regressões relevantes;
- as waves W0-W12 forem executadas sem duplicação desnecessária de lógica;
- a pesquisa qualitativa indicar melhora perceptível na pergunta "o que preciso fazer agora?";
- a navegação e a legibilidade forem avaliadas como mais claras que no design atual;
- a promoção para default ocorrer sem big-bang técnico;
- o cleanup final puder ser feito de forma incremental e segura.

---

## Decisões Fechadas

- O redesign será desenvolvido em paralelo à experiência atual.
- O mecanismo principal de isolamento é `data-redesign="true"` no `.app-container`.
- W0-W3 usam CSS scoped como técnica principal.
- W4-W12 usam variantes explícitas como técnica principal.
- Lógica de domínio permanece 100% compartilhada.
- Pesquisa qualitativa faz parte do rollout, não é atividade separada.
- O rollout final será progressivo, não um merge técnico único.

---

## Referências

- `plans/redesign/EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` — visão e arquitetura macro W0-W12
- `plans/redesign/EXEC_SPEC_ROLLOUT_PESQUISA_VALIDACAO.md` — SSOT de pesquisa e validação (detalhado)
- `plans/redesign/WAVE_0_DESIGN_TOKENS.md` — execução W0
- `plans/redesign/WAVE_1_TYPOGRAPHY_ICONS.md` — execução W1
- `plans/redesign/WAVE_2_SURFACE_LAYOUT.md` — execução W2
- `plans/redesign/WAVE_3_COMPONENT_PRIMITIVES.md` — execução W3
- `src/shared/contexts/RedesignContext.jsx`
- `src/shared/hooks/useRedesign.js`
- `src/shared/styles/tokens.redesign.css`
