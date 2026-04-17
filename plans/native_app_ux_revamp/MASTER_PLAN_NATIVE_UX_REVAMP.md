# Master Plan: Native App UX Revamp

> **Status:** Documento autoritativo da iniciativa
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Objetivo:** definir visao, fronteiras, principios e waves do revamp UX do app mobile native sem ambiguidade

---

## 1. Objetivo executivo

Evoluir o app mobile native do estado atual de MVP funcional para uma experiencia:

- premium em linguagem visual
- clara em prioridade clinica
- consistente entre as 4 vistas principais
- compativel com execucao incremental por agentes IA

O projeto **nao** vai criar uma app diferente. O projeto **vai**:

1. preservar a IA principal atual
2. elevar a qualidade de hierarquia, ritmo, foco e acabamento
3. criar uma fundacao de componentes e tokens semanticos
4. preparar ads como trilha futura sem degradar a experiencia clinica

---

## 2. Baseline validada do app mobile atual

### 2.1. Fatos validados no repositorio

- existem telas reais para `Today`, `Treatments`, `Stock` e `Profile`
- a navegacao principal usa tab navigator em `apps/mobile/src/navigation/RootTabs.jsx`
- o mobile usa `StyleSheet`, alinhado a `ADR-028`
- o mobile ja possui tokens basicos em `apps/mobile/src/shared/styles/tokens.js`
- cada tela principal ja tem hook de dados proprio
- o app ja respeita a estrutura auth-aware e safe area

### 2.2. Leitura correta do estado atual

O app atual resolve:

- fluxo basico
- obtencao de dados
- navegacao
- estados primarios

Mas ainda nao resolve bem:

- hierarquia visual
- narrativa de marca
- consistencia de superficies
- diferenciação entre blocos clinicos
- reserva organizada para monetizacao futura

---

## 3. Leitura correta dos mocks hi-fi

Os mocks hi-fi devem ser interpretados como:

- prova de direcao estetica
- prova de ambicao de UX
- benchmark de acabamento visual

Eles **nao** autorizam:

- troca da IA principal
- criacao de tabs novas
- introducao automatica de features sem backing funcional
- reescrita completa do shell de navegacao

### 3.1. O que preservar dos mocks

- cards hero com CTA unico
- melhor uso de branco e espacamento
- tipografia de maior contraste
- risco e status comunicados por cor e forma
- agrupamento visual por contexto clinico
- placeholders patrocinados como slots previsiveis

### 3.2. O que adaptar

- nomes de menu e taxonomia
- superficie de perfil baseada em dados reais
- acoes de compra/reposicao somente quando houver acao valida
- componentes aspiracionais como emergencia/modo consulta

---

## 4. Referencias visuais oficiais da iniciativa

Os seguintes assets locais sao a referencia visual oficial desta trilha:

- `plans/native_app_ux_revamp/app-new-dashboard.png`
- `plans/native_app_ux_revamp/app-new-treatment.png`
- `plans/native_app_ux_revamp/app-new-stock.png`
- `plans/native_app_ux_revamp/app-new-profile.png`

Mapeamento canonico:

| Asset | Interpretação correta |
|-------|------------------------|
| `app-new-dashboard.png` | Direcao visual de `Hoje` |
| `app-new-treatment.png` | Direcao visual de `Tratamentos` |
| `app-new-stock.png` | Direcao visual de `Estoque` |
| `app-new-profile.png` | Direcao visual de `Perfil` |

Regra:

- os assets vivem no repo para reduzir dependencia de contexto conversacional
- agentes podem referencia-los em reviews, specs e handoffs
- qualquer conflito entre asset e regra congelada deste master plan deve ser resolvido a favor deste documento

---

## 5. Decisoes congeladas

1. Nao alterar a IA principal (`Hoje`, `Tratamentos`, `Estoque`, `Perfil`)
2. Nao trocar a stack de styling atual
3. Nao introduzir motion avancada nesta iniciativa
4. Nao bloquear entregas visuais por features aspiracionais sem suporte funcional
5. Ads nao entram na mesma wave da fundacao visual
6. Os mocks sao referencia estetica, nao layout canonico
7. O mobile continua separado da UI web, em conformidade com a estrategia hibrida

---

## 6. Principios nao negociaveis

### PUX-001. Clareza clinica antes de expressividade

Toda tela deve deixar claro:

- o que esta em risco
- o que exige acao
- o que e apenas contexto

### PUX-002. Uma acao principal por bloco

Hero cards, blocos de alerta e modulos utilitarios devem ter CTA primario unico. Se um bloco pedir muitas decisoes ao usuario, ele esta mal desenhado.

### PUX-003. Fundacao antes da decoracao

Nao executar redesign de tela final antes de:

- tokens semanticos
- scaffold de tela
- padrao de header
- contratos de status

### PUX-004. Dados reais dominam a forma

Se o dado nao existe de forma confiavel:

- esconder
- degradar
- adiar

Nunca inventar dado apenas para preencher o layout.

### PUX-005. Monetizacao subordinada ao valor clinico

Ads sao permitidos, mas nunca:

- acima da acao principal do dia
- entre um risco critico e seu CTA
- em contexto de erro/alerta de saude grave

---

## 7. Escopo exato da iniciativa

Entram obrigatoriamente:

- fundacao visual mobile
- revamp das 4 telas principais
- definicao de componentes base
- tokens semanticos
- padrao de estados
- placeholders de ads e seu contrato
- plano de testes visuais e funcionais
- plano de execucao por sprint

Nao entram nesta iniciativa:

- nova IA principal
- dark mode
- troca de engine de animacao
- mudancas no core compartilhado sem necessidade direta
- ativacao definitiva de provider de ads
- feature completa de emergencia sem decisao de produto

---

## 8. Relacao com a estrategia hibrida existente

Esta iniciativa respeita:

- P-001 da master spec: UIs separadas por plataforma
- P-002: shared core minimo e puro
- ADR-028: `StyleSheet` no mobile
- addendum de tokens: consumo de tokens JS no native
- addendum de deep links: navegacao preservada
- addendum de testing mobile: Jest + RNTL

Esta iniciativa nao substitui:

- fase 6 de push
- fase 7 de migracao web
- qualquer ADR aceita do trilho hybrid/native

---

## 9. Definicao das waves UX.1 a UX.8

### UX.1. Docs e baseline

Objetivo:

- congelar visao, PRD, arquitetura, addendums e sprint plan

Saida obrigatoria:

- docs desta pasta aprovados e usados como fonte unica da iniciativa

### UX.2. Fundacao visual e tokens

Objetivo:

- criar a base reutilizavel de componentes e tokens semanticos

Saida obrigatoria:

- `MobileScreenScaffold`
- `ScreenHeader`
- `StatusBadge`
- `AdSlotCard`
- tokens semanticos alinhados

### UX.3. Revamp Hoje

Objetivo:

- transformar `Hoje` em command center diario

### UX.4. Revamp Tratamentos

Objetivo:

- transformar `Tratamentos` em visao editorial dos protocolos

### UX.5. Revamp Estoque

Objetivo:

- transformar `Estoque` em leitura de risco e reposicao

### UX.6. Revamp Perfil

Objetivo:

- transformar `Perfil` em hub utilitario com identidade

### UX.7. Monetizacao foundation

Objetivo:

- inserir placements, flags e guardrails sem ativacao dura do provider

### UX.8. Hardening e consistencia

Objetivo:

- fechar ajustes transversais, testes, acessibilidade e estabilidade

---

## 10. Criterios de avancar entre waves

Uma wave so pode avancar quando:

- os contratos da wave anterior estiverem estaveis
- testes obrigatorios passarem
- validacao manual minima estiver concluida
- nao houver dependencias funcionais escondidas para a wave seguinte

Exemplos:

- `UX.3` nao inicia sem `UX.2` entregar scaffold e badges
- `UX.7` nao inicia sem `UX.3-UX.6` estabilizadas

---

## 11. Criterios de rollback visual

Rollback e permitido se:

- a legibilidade piorar
- a perfomance percebida degradar fortemente
- o CTA principal ficar menos claro
- a implementacao exigir dados que o dominio nao fornece

O rollback correto e:

- voltar para o componente anterior apenas na superficie afetada
- manter fundacao e contratos reaproveitaveis
- registrar o learning no sprint correspondente

---

## 12. Resultado esperado da iniciativa

Ao fim da trilha UX.1-UX.8, o projeto deve conseguir:

1. operar as 4 telas principais com linguagem visual coerente
2. oferecer clara prioridade clinica em cada vista
3. suportar monetizacao futura sem improviso estrutural
4. permitir execucao incremental por agentes IA com contexto limitado
5. preservar alinhamento com a estrategia hybrid/native maior
