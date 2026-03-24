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
presente no `<div id="app">`. Sem o atributo, o app funciona 100% igual ao atual.

**Objetivo geral:** definir como o redesign será desenvolvido em paralelo à experiência atual,
validado com usuários reais sem impacto na base inteira, medido ao longo das waves e promovido
com segurança até se tornar a experiência padrão.

> **Princípio central:** durante construção e pesquisa, o redesign é uma experiência opt-in,
> isolada por feature flag.

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

### O que esta estratégia evita

- criar uma segunda aplicação paralela;
- duplicar services, hooks, schemas e integrações;
- introduzir novo router só para o redesign;
- expor usuários atuais a regressões visuais durante pesquisa.

---

## Regra de Ouro do Projeto

Nem toda wave de redesign é do mesmo tipo.

- **Foundation waves** mudam tokens, tipografia, superfícies e primitives.
- **Experience waves** mudam composição, navegação, densidade, hierarquia e fluxo.

Portanto:

- **CSS scoped resolve bem foundation.**
- **CSS scoped sozinho NÃO resolve experience.**

Qualquer tentativa de empurrar W4+ apenas com override visual aumenta:

- acoplamento entre design antigo e novo;
- complexidade de manutenção;
- risco de regressão silenciosa;
- custo de cleanup no fim do rollout.

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

### Contrato técnico

O root autenticado da app deve seguir este padrão:

```jsx
<div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>
```

### Regras do flag

- O flag nunca pode nascer ativo por padrão em produção.
- O flag nunca pode alterar dados, payloads ou regras de negócio.
- O flag controla apresentação e composição, não comportamento clínico.

---

## Fluxo por Wave

| Faixa | Natureza da mudança | Estratégia obrigatória |
|-------|---------------------|------------------------|
| **W0-W1** | Tokens, cor, tipografia, sombras, radius | CSS scoped em `[data-redesign="true"]` |
| **W2-W3** | Surface, layout utilities, primitives | CSS scoped + classes novas/aditivas |
| **W4-W5** | Navigation shell, sidebar, motion estrutural | Variantes explícitas com `useRedesign()` |
| **W6-W12** | Views e fluxos principais | Variantes explícitas de view/componente |

### Regra operacional

- Se a mudança cabe em token/utilitário/skin: usar CSS scoped.
- Se a mudança altera árvore JSX, densidade, ordem de blocos, navegação ou composição: criar variante explícita.

---

## Shared vs Duplicado

### Deve permanecer compartilhado

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

## Estratégia de Branching no Código

### Onde o branching pode existir

- `App.jsx` para escolher shell/view variante;
- views canônicas que delegam para versão legacy/redesign;
- componentes de alto nível do redesign;
- contextos específicos de experiência, se necessário.

### Onde o branching deve ser evitado

- deep inside de subcomponentes pequenos;
- services;
- utils;
- schemas;
- funções de cálculo.

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

quando isso começa a se repetir em muitos níveis.

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

## Pontos de Atenção e Mitigações

### 8.1 CSS scoped é forte, mas tem limite

**Risco:** tratar todo o redesign como se fosse apenas tema.

**Mitigação:**
- congelar a regra de que W4+ exige variante explícita;
- documentar por wave se ela é foundation ou experience;
- rejeitar PR que tente resolver layout estrutural só com seletor mais específico.

### 8.2 Duas experiências em paralelo aumentam custo

**Risco:** manutenção duplicada da camada de apresentação.

**Mitigação:**
- compartilhar 100% da lógica possível;
- centralizar branching em poucos pontos (`App.jsx`, shell, views canônicas);
- evitar `if (isRedesignEnabled)` espalhado em componentes pequenos;
- preferir wrappers/variantes por view em vez de condicionais fragmentadas.

### 8.3 Fontes importadas ainda podem impactar usuários sem flag

**Risco:** mesmo sem impacto visual, o CSS pode disparar download de fontes para todos.

**Mitigação:**
- aceitar esse custo nas waves iniciais apenas se o impacto de bundle/rede for pequeno;
- medir o efeito em build e Lighthouse;
- se o custo ficar relevante, migrar carregamento de fontes para uma estratégia lazy ou sob demanda na fase de hardening.

### 8.4 `localStorage + URL param` é ótimo para pesquisa, mas fraco para beta segmentado

**Risco:** não permite cohort rollout real por usuário, equipe ou tenant.

**Mitigação:**
- usar a estratégia atual para pesquisa qualitativa e QA;
- se houver necessidade de beta controlado, planejar Fase 2 com flag persistido por usuário no backend;
- não bloquear W0-W12 por essa evolução.

### 8.5 Cleanup final tipo big-bang é arriscado

**Risco:** remover scoping, mesclar tokens e apagar legado tudo de uma vez pode gerar regressão grande.

**Mitigação:**
- promover o redesign a default primeiro;
- manter a experiência antiga atrás de um `legacy flag` temporário por curto período;
- só depois remover legado em waves de cleanup;
- executar limpeza por camadas: tokens, primitives, shell, views.

### 8.6 Pesquisa sem protocolo vira opinião

**Risco:** validar redesign com feedback ad hoc e sem critérios comparáveis.

**Mitigação:**
- toda sessão precisa de roteiro, hipótese e checklist observacional;
- comparar tarefas idênticas entre experiência atual e redesign;
- registrar fricções por tarefa, não só gosto subjetivo;
- só promover fase com evidência qualitativa suficiente.

---

## Protocolo de Pesquisa e Validação

### Objetivo da pesquisa

Responder se o redesign melhora a capacidade do paciente de entender:

- o que precisa fazer agora;
- o que está atrasado ou crítico;
- como navegar entre Hoje, Tratamentos, Estoque e Perfil;
- como executar tarefas sem aumentar carga cognitiva.

### Sessões qualitativas

Cada sessão deve registrar:

- perfil do participante;
- dispositivo usado;
- se a sessão ocorreu com `?redesign=1`;
- tarefas executadas;
- dúvidas, hesitações e erros;
- trechos que reduziram ou aumentaram ansiedade;
- comparação com a experiência atual, quando aplicável.

### Tarefas mínimas recomendadas

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

## Testes e Quality Gates

### Gates obrigatórios por PR

- lint sem erros;
- testes relevantes da área alterada;
- `npm run validate:agent` para waves que mudem app runtime;
- build funcionando;
- smoke manual com flag desligado;
- smoke manual com flag ligado.

### Smoke mínimo obrigatório

Com flag desligado:

- app visualmente intacta;
- navegação principal intacta;
- nenhum componente atual degradado.

Com flag ligado:

- tokens/estilos corretos para a wave;
- view nova ou variante renderizando corretamente;
- navegação principal sem perda de contexto;
- fallback de lazy loading preservado com `Suspense` + `ViewSkeleton`.

### Quality gates por transição de fase

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
- acesso por URL com flag;
- foco em compreensão, legibilidade e fluxo.

### Fase 2 — Piloto controlado (opcional)

- manter estratégia atual se bastar para QA ampliado;
- se necessário, introduzir feature flag por usuário no backend.

### Fase 3 — Redesign vira default

- redesign passa a ser experiência padrão;
- experiência antiga permanece atrás de flag temporário;
- monitorar regressões e feedback por período curto e definido.

### Fase 4 — Cleanup

- remover legacy flag;
- apagar variantes antigas;
- consolidar tokens e estilos canônicos;
- atualizar documentação final.

---

## Plano de Cleanup Recomendado

Executar cleanup em quatro passos:

1. tornar redesign default sem apagar legado no mesmo PR;
2. introduzir `legacy fallback` temporário apenas para segurança operacional;
3. remover componentes/views legados em ondas pequenas;
4. consolidar tokens e apagar arquivos `.redesign.*` somente no fim.

**Regra:** o projeto não deve depender de um único PR final de "virada e limpeza".

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
- O mecanismo principal de isolamento continuará sendo `data-redesign="true"`.
- W0-W3 usam CSS scoped como técnica principal.
- W4-W12 usam variantes explícitas como técnica principal.
- Lógica de domínio permanece compartilhada.
- Pesquisa qualitativa faz parte do rollout, não é atividade separada.
- O rollout final será progressivo, não um merge técnico único.

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

---

## Referências

- `plans/redesign/EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`
- `plans/redesign/EXEC_SPEC_ROLLOUT_PESQUISA_VALIDACAO.md`
- `plans/redesign/WAVE_0_DESIGN_TOKENS.md`
- `plans/redesign/WAVE_1_TYPOGRAPHY_ICONS.md`
- `plans/redesign/WAVE_2_SURFACE_LAYOUT.md`
- `plans/redesign/WAVE_3_COMPONENT_PRIMITIVES.md`
- `src/App.jsx`
- `src/shared/contexts/RedesignContext.jsx`
- `src/shared/hooks/useRedesign.js`
- `src/shared/styles/tokens.redesign.css`
