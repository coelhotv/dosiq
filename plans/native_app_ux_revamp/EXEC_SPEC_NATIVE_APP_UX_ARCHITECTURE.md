# Exec Spec: Native App UX Architecture

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Documentos complementares:** `PRD_NATIVE_APP_UX_REVAMP.md`, `MASTER_PLAN_NATIVE_UX_REVAMP.md`
> **Objetivo:** definir como a nova experiencia mobile sera suportada tecnicamente sem decisoes em aberto

---

## 1. Papel desta spec

Esta spec existe para impedir que agentes:

- redesenhem tela por tela sem fundacao comum
- coloquem regra de negocio dentro do componente visual
- acoplem ads diretamente ao layout final
- criem estados visuais inconsistentes entre vistas

Ela congela:

- arquitetura alvo da camada de apresentacao
- contratos publicos de UI
- view models por tela
- regras de composicao
- quality gates

---

## 2. Baseline tecnica atual do mobile

Fatos validados:

- `RootTabs.jsx` concentra as 4 tabs principais
- `ScreenContainer.jsx` ja e o wrapper base de fundo/safe area
- `TodayScreen.jsx`, `TreatmentsScreen.jsx`, `StockScreen.jsx`, `ProfileScreen.jsx` ja existem
- hooks atuais: `useTodayData`, `useTreatments`, `useStock`, `useProfile`
- tokens atuais existem, mas ainda sao basicos
- testes de algumas telas e hooks ja existem no workspace mobile

Leitura correta:

- a arquitetura atual suporta refactor incremental
- o maior gap esta na camada de apresentacao e na semantica visual

---

## 3. Arquitetura-alvo da camada de apresentacao

### 3.1. Camadas obrigatorias

1. **Hook de dados / service hook**
   - obtem dados
   - preserva refresh/loading/error/stale

2. **View model adapter**
   - transforma dados brutos da feature no shape da tela
   - aplica semantica de exibicao
   - decide o que esconder ou degradar

3. **Screen composition**
   - recebe `ScreenVM`
   - compoe blocos visuais
   - nao executa regra de negocio de dominio

4. **Base UI components**
   - componentes genericos reutilizaveis
   - recebem props simples e previsiveis

### 3.2. Regra obrigatoria

Toda tela principal deve sair do modelo:

- `hook -> tela monolitica`

Para:

- `hook -> screen view model -> scaffold + blocks`

---

## 4. Contratos publicos de UI congelados

### `MobileScreenScaffold`

Responsabilidade:

- safe area
- fundo da tela
- espacamento principal
- header padronizado
- area rolavel
- slots opcionais de topo/rodape/patrocinado

Nao faz:

- fetch
- regra de dominio
- parse de dados

### `ScreenHeader`

Responsabilidade:

- titulo
- subtitulo
- avatar/marca quando aplicavel
- acao de topo opcional

### `HeroCard`

Responsabilidade:

- bloco de maior prioridade da tela
- titulo, supporting copy, metadados e CTA primario

### `MetricCard`

Responsabilidade:

- exibicao compacta de metrica com label e supporting text

### `MetricRingCard`

Responsabilidade:

- variante com foco em score/percentual circular

### `SectionBlock`

Responsabilidade:

- agrupar cards ou listas sob mesma semantica

### `StatusBadge`

Responsabilidade:

- representar estado semantico: `estavel`, `normal`, `atencao`, `critico`, `em_dia`, `baixo_estoque`

### `AdSlotCard`

Responsabilidade:

- reservar placement de anuncio
- renderizar placeholder ou provider wrapper
- nunca possuir conhecimento de negocio clinico

### `ListSectionHeader`

Responsabilidade:

- marcar seccoes como `Agenda de Hoje`, `Estoque Critico`, `Estoque Regular`

### `UtilityActionCard`

Responsabilidade:

- acoes utilitarias em `Perfil`

---

## 5. Contratos de view model por tela

### `TodayScreenVM`

```js
{
  header,
  summary,
  priorityAction,
  agendaSections,
  contextualAlert,
  adSlot,
  screenState
}
```

### `TreatmentsScreenVM`

```js
{
  header,
  adherenceSummary,
  groups,
  treatments,
  floatingAction,
  adSlot,
  screenState
}
```

### `StockScreenVM`

```js
{
  header,
  criticalSummary,
  criticalItems,
  regularItems,
  adSlot,
  screenState
}
```

### `ProfileScreenVM`

```js
{
  header,
  identityCard,
  utilityActions,
  settingsActions,
  supportActions,
  adSlot,
  screenState
}
```

### Regra

Os VMs podem crescer com campos opcionais, mas:

- a estrutura principal deve se manter estavel
- `screenState` deve padronizar `loading`, `error`, `empty`, `ready`, `stale`

---

## 6. Tokens semanticos

Os tokens do mobile devem sair do nivel apenas fisico e ganhar semantica:

- `surface.screen`
- `surface.card`
- `surface.hero`
- `surface.subtle`
- `surface.adSlot`
- `text.primary`
- `text.secondary`
- `text.inverse`
- `accent.brand`
- `accent.clinical`
- `status.success`
- `status.warning`
- `status.error`
- `status.info`
- `status.neutral`
- `cta.primary.bg`
- `cta.primary.text`
- `cta.secondary.bg`
- `badge.<semantic>`
- `tab.active`
- `tab.inactive`

Regra:

- primeiro mapear para tokens semanticos
- depois usar nos componentes

---

## 7. Regras de composicao das telas

### Hoje

Ordem obrigatoria:

1. header
2. resumo / score
3. hero de prioridade
4. alerta contextual se aplicavel
5. agenda segmentada
6. ad slot abaixo da experiencia principal

### Tratamentos

Ordem obrigatoria:

1. header
2. resumo geral
3. grupos ou listagem editorial
4. alertas adjacentes por card
5. ad slot abaixo do conteudo principal

### Estoque

Ordem obrigatoria:

1. header
2. resumo de criticidade
3. ad slot opcional entre sumario e regular, nunca acima do critico
4. lista critica
5. lista regular

### Perfil

Ordem obrigatoria:

1. header/identidade
2. acoes essenciais
3. utilitarios secundarios
4. ad slot opcional no terco inferior

---

## 8. Padroes de loading, error e empty

### Loading

- usar estrutura da tela final sempre que possivel
- evitar spinner isolado como unica experiencia
- skeletons leves sao preferiveis nas telas principais

### Error

- erro deve ocupar a superficie principal da tela
- CTA de retry sempre presente quando tecnicamente possivel

### Empty

- empty state deve respeitar a intencao da tela
- evitar mensagem generica "sem dados"

### Stale

- `StaleBanner` permanece permitido
- deve integrar visualmente com a nova linguagem

---

## 9. Acessibilidade e responsividade

Minimos obrigatorios:

- touch targets adequados
- contraste suficiente
- truncamento controlado de nomes longos
- leitura aceitavel em iPhone e Android de largura reduzida
- badges nao dependem apenas de cor

---

## 10. Estrategia de feature flags

Flags recomendadas:

- `mobileUxRevampFoundation`
- `mobileUxRevampToday`
- `mobileUxRevampTreatments`
- `mobileUxRevampStock`
- `mobileUxRevampProfile`
- `mobileAdsSlotsEnabled`
- `mobileAdsProviderEnabled`

Regra:

- slot e provider sao flags separadas
- habilitar slot nao implica provider

---

## 11. Observabilidade visual minima

Cada sprint deve deixar claro:

- se a tela esta usando o novo scaffold
- se o view model esta ativo
- se os states principais foram verificados

Observabilidade minima aceitavel:

- logs locais em dev
- checklist manual por tela
- testes RNTL cobrindo estados

---

## 12. Compatibilidade com navegacao, deep link e push

Regras obrigatorias:

- nomes de rotas permanecem centralizados em `routes.js`
- tab navigator principal nao muda de IA
- push/deep link nao podem depender da nova apresentacao para funcionar
- tap em notificacao deve continuar resolvendo para telas existentes

---

## 13. Quality gates

Antes de merge de qualquer sprint de UX:

- tela compila no mobile workspace
- testes obrigatorios do sprint passam
- navegacao principal permanece intacta
- nenhum componente visual novo incorpora regra de dominio escondida
- placements de ads continuam neutros se provider estiver desligado

Gate adicional para waves de tela:

- comparacao manual com os principios do PRD
- verificacao de safe area
- verificacao de nomes longos

---

## 14. Criterio de aceite arquitetural

A arquitetura desta iniciativa estara correta quando:

1. as 4 telas principais passarem a ser composicao de blocos reutilizaveis
2. a semantica visual estiver centralizada em contratos e tokens
3. as regras de negocio permanecerem fora dos componentes de apresentacao
4. ads puderem entrar depois sem reescrever a tela
