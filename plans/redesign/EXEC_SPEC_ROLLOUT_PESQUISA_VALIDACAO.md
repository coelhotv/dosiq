# EXEC_SPEC — SSOT de Rollout, Pesquisa e Validação do Redesign

**Status:** Aprovado para execução
**Versão:** 1.0
**Data:** 2026-03-24
**Escopo:** Desenvolvimento paralelo, pesquisa qualitativa, validação técnica e rollout do redesign "Santuário Terapêutico"

---

## 1. Objetivo

Definir como o redesign será:

- desenvolvido em paralelo à experiência atual;
- validado com usuários reais sem impacto na base inteira;
- medido e testado ao longo das waves;
- promovido com segurança até se tornar a experiência padrão.

O princípio central é simples:

> **Durante construção e pesquisa, o redesign é uma experiência opt-in, isolada por feature flag.**

---

## 2. Decisão Arquitetural

### Estratégia adotada

Usar uma estratégia híbrida:

- **W0-W3:** isolamento por `data-redesign="true"` + CSS scoped + tokens/estilos aditivos;
- **W4-W12:** isolamento por flag + variantes explícitas de views/layouts/componentes estruturais;
- **Sempre:** lógica de negócio compartilhada entre experiência atual e redesign.

### Por que esta é a melhor estratégia para este projeto

- O app já possui ponto central de shell em `src/App.jsx`, com `setCurrentView` e renderização de views concentrada.
- O feature flag já existe via `RedesignContext`/`useRedesign`.
- O root da aplicação já recebe `data-redesign`, permitindo scoping real de CSS.
- O app já usa lazy loading por view, o que favorece variantes futuras sem refatorar o roteamento inteiro.
- O redesign altera muito mais a camada de apresentação do que a lógica de domínio.

### O que esta estratégia evita

- criar uma segunda aplicação paralela;
- duplicar services, hooks, schemas e integrações;
- introduzir novo router só para o redesign;
- expor usuários atuais a regressões visuais durante pesquisa.

---

## 3. Regra de Ouro do Projeto

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

## 4. Fontes Canônicas e Relação Entre Docs

### Este documento é o SSOT para

- rollout gradual;
- pesquisa qualitativa de validação;
- critérios de ativação/desativação do flag;
- estratégia de coexistência entre legado e redesign;
- quality gates de promoção entre fases;
- critérios de lançamento geral;
- estratégia de cleanup pós-rollout.

### Outros documentos continuam responsáveis por

- `plans/redesign/EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`
  Arquitetura, visão de produto e execução macro W0-W12.
- `plans/redesign/WAVE_*.md`
  Execução detalhada de cada wave.

Em caso de conflito:

1. este documento decide rollout, pesquisa e coexistência;
2. a spec principal decide visão e arquitetura alvo;
3. a wave decide execução local do sprint.

---

## 5. Mecanismo de Ativação

### Fonte do flag

O redesign permanece desativado por padrão e pode ser ativado por:

- `?redesign=1` na URL;
- `localStorage.mr_redesign_preview = '1'`;
- toggle interno em Configurações quando `mr_dev_mode=1`.

Desativação:

- `?redesign=0`;
- remoção do item em `localStorage`;
- desligamento via toggle interno.

### Contrato técnico

O root autenticado da app deve seguir este padrão:

```jsx
<div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>
```

### Regras

- O flag nunca pode nascer ativo por padrão em produção.
- O flag nunca pode alterar dados, payloads ou regras de negócio.
- O flag controla apresentação e composição, não comportamento clínico.

---

## 6. Estratégia por Fase

| Faixa | Natureza da mudança | Estratégia obrigatória |
|------|----------------------|------------------------|
| **W0-W1** | Tokens, cor, tipografia, sombras, radius | CSS scoped em `[data-redesign="true"]` |
| **W2-W3** | Surface, layout utilities, primitives | CSS scoped + classes novas/aditivas |
| **W4-W5** | Navigation shell, sidebar, motion estrutural | Variantes explícitas com `useRedesign()` |
| **W6-W12** | Views e fluxos principais | Variantes explícitas de view/componente |

### Regra operacional

- Se a mudança cabe em token/utilitário/skin: usar CSS scoped.
- Se a mudança altera árvore JSX, densidade, ordem de blocos, navegação ou composição: criar variante explícita.

---

## 7. Shared vs Duplicado

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

## 8. Pontos de Atenção e Mitigações

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

## 9. Protocolo de Pesquisa e Validação

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

## 10. Testes e Quality Gates

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

## 11. Estratégia de Branching no Código

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

## 12. Estratégia de Rollout para Produção

### Fase 0 — Construção interna

- redesign disponível apenas via flag;
- uso por time interno e QA;
- foco em estabilidade técnica.

### Fase 1 — Pesquisa qualitativa privada

- sessões guiadas com usuários selecionados;
- acesso por URL com flag;
- foco em compreensão, legibilidade e fluxo.

### Fase 2 — Piloto controlado

- opcional;
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

## 13. Plano de Cleanup Recomendado

Executar cleanup em quatro passos:

1. tornar redesign default sem apagar legado no mesmo PR;
2. introduzir `legacy fallback` temporário apenas para segurança operacional;
3. remover componentes/views legados em ondas pequenas;
4. consolidar tokens e apagar arquivos `.redesign.*` somente no fim.

### Regra

O projeto não deve depender de um único PR final de "virada e limpeza".

---

## 14. Critérios de Sucesso

O rollout será considerado bem-sucedido quando:

- o redesign puder conviver com a experiência atual sem regressões relevantes;
- as waves W0-W12 forem executadas sem duplicação desnecessária de lógica;
- a pesquisa qualitativa indicar melhora perceptível na pergunta "o que preciso fazer agora?";
- a navegação e a legibilidade forem avaliadas como mais claras que no design atual;
- a promoção para default ocorrer sem big-bang técnico;
- o cleanup final puder ser feito de forma incremental e segura.

---

## 15. Decisões Fechadas

- O redesign será desenvolvido em paralelo à experiência atual.
- O mecanismo principal de isolamento continuará sendo `data-redesign="true"`.
- W0-W3 usam CSS scoped como técnica principal.
- W4-W12 usam variantes explícitas como técnica principal.
- Lógica de domínio permanece compartilhada.
- Pesquisa qualitativa faz parte do rollout, não é atividade separada.
- O rollout final será progressivo, não um merge técnico único.

---

## 16. Referências

- `plans/redesign/EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`
- `plans/redesign/WAVE_0_DESIGN_TOKENS.md`
- `plans/redesign/WAVE_1_TYPOGRAPHY_ICONS.md`
- `plans/redesign/WAVE_2_SURFACE_LAYOUT.md`
- `plans/redesign/WAVE_3_COMPONENT_PRIMITIVES.md`
- `src/App.jsx`
- `src/shared/contexts/RedesignContext.jsx`
- `src/shared/hooks/useRedesign.js`
- `src/shared/styles/tokens.redesign.css`
