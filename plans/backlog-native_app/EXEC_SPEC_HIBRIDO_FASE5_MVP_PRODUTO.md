# Exec Spec Hibrido - Fase 5: MVP de Produto Mobile

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 4 concluida
> **Objetivo da fase:** entregar o primeiro MVP funcional do produto mobile, provando consumo real da camada compartilhada sem tentar atingir paridade total da web

---

## 1. Papel desta fase

Esta e a fase em que o app mobile deixa de ser apenas um scaffold tecnico e passa a oferecer fluxo real de produto.

Esta fase **faz**:

- shell de navegacao do produto
- tela "Hoje" / dashboard enxuto
- registro de dose a partir da tela principal
- leitura de tratamentos/protocolos
- leitura de estoque
- perfil/configuracoes basicas
- vinculo Telegram
- arquitetura de telas e componentes suficiente para um beta funcional interno

Esta fase **nao faz**:

- push native operacional fim a fim
- permissao de notificacao
- registro de token `expo`
- dispatcher multicanal
- biometria
- HealthKit/Google Fit
- PDF/export/share complexos
- chatbot IA
- emergency card avancado
- calendario completo
- admin DLQ

### Nota de reconciliacao com a master spec

A master spec lista "registro de token de push native" dentro do MVP final desejado, mas a ordem de fases coloca toda a arquitetura de notificacoes na Fase 6.

Portanto, a leitura correta e:

- Fase 5 entrega o **MVP de produto sem push nativo operacional**
- Fase 6 adiciona a camada de notificacoes e completa o item "registro de token de push native"

Nenhum agente deve antecipar `expo-notifications` nesta fase.

### Leituras complementares obrigatorias

Antes de executar esta fase, o agente deve ler tambem:

- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`

---

## 2. Definicao operacional de MVP nesta fase

O MVP mobile desta fase deve permitir que um usuario real:

1. faca login
2. abra o app e veja um resumo util do dia
3. registre uma dose rapidamente
4. consulte seus tratamentos ativos
5. consulte seu estoque
6. abra perfil/configuracoes
7. veja o estado de vinculo com Telegram e gere token de vinculo

O MVP **nao** precisa permitir que o usuario:

- use todas as views existentes na web
- use todas as features do Dashboard web
- exporte PDF
- acesse features administrativas
- veja interfaces redesign da web

---

## 3. Regras de ouro da fase

### R5-001. Mobile nao busca paridade visual da web

O app mobile deve ser:

- funcional
- legivel
- rapido
- nativo o suficiente

Ele **nao** deve:

- tentar copiar layout pixel a pixel da web
- importar conceitos de CSS web
- portar componentes complexos da web sem simplificacao

### R5-002. O shell mobile e baseado no valor do produto, nao na arvore atual da web

A web hoje possui muitas views, variações e legado.

O shell mobile do MVP deve colapsar isso em poucos destinos claros:

- Hoje
- Tratamentos
- Estoque
- Perfil

### R5-003. Registro de dose e o fluxo principal

Se houver qualquer trade-off entre "mostrar muitos dados" e "registrar dose rapido", priorizar:

- menor friccao para registrar dose
- menor numero de toques
- UI simples

### R5-004. A camada compartilhada deve ser usada, nao duplicada

Nesta fase, o app mobile deve consumir:

- `@meus-remedios/core`
- `@meus-remedios/shared-data`
- bootstrap native da Fase 4

E proibido:

- duplicar schema no mobile
- duplicar regra de negocio no mobile
- reimplementar calculos de dominio localmente sem necessidade

### R5-005. Nada de features fora do MVP

Se a tela/fluxo pertence a:

- PDF
- Chatbot
- Emergency avancado
- Consultation mode
- Calendar

Entao ele esta fora desta fase.

### R5-006. Nenhuma dependencia de componente web

Esta proibido:

- copiar JSX da web "adaptando por cima"
- importar assets CSS da web
- tentar compartilhar componentes React entre web e mobile

### R5-007. Performance e simplicidade vencem completude

Se um componente da web e complexo demais, criar uma versao mobile reduzida e correta.

Exemplos:

- dashboard mobile nao precisa replicar todos os widgets
- stock mobile nao precisa replicar todos os graficos
- treatments mobile pode ser lista hierarquica simples

### R5-008. O MVP mobile e online-first, nao offline-first

Nesta fase:

- leitura resiliente e permitida
- stale state explicito e obrigatorio
- escrita offline continua proibida

### R5-009. Rotas e links internos devem seguir contrato centralizado

Mesmo no MVP, o mobile nao pode espalhar strings de rota por componentes.

Routing minimo deve nascer coerente com o addendum de deep links.

### R5-010. Native correctness vence improviso visual

Esta fase deve respeitar:

- safe area
- teclado em formularios
- comportamento razoavel do botao voltar no Android

---

## 4. Escopo exato da fase

## 4.1. Entram obrigatoriamente

- shell + tabs
- Hoje / Dashboard enxuto
- registrar dose
- Tratamentos
- Estoque
- Perfil / Settings
- vinculo Telegram

## 4.2. Entram apenas se forem pequenos e derivarem do shell acima

- loading states
- empty states
- error states
- stale offline states
- refresh manual simples
- deep links internos simples do shell MVP
- filtros leves

## 4.3. Nao entram

- push native
- permissao de notificacao
- token `expo`
- PDF/export/share
- chatbot
- consultation
- calendar
- emergency card completo
- area admin
- redesign web

---

## 5. Estrutura alvo obrigatoria do app mobile ao fim da fase

```text
apps/mobile/src/
├── app/
│   ├── AppRoot.jsx
│   ├── Navigation.jsx
│   └── navigation/
│       ├── RootTabs.jsx
│       ├── TreatmentStack.jsx
│       └── ProfileStack.jsx
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── screens/TodayScreen.jsx
│   ├── dose/
│   │   ├── components/
│   │   └── services/
│   ├── treatments/
│   │   ├── components/
│   │   └── screens/TreatmentsScreen.jsx
│   ├── stock/
│   │   ├── components/
│   │   └── screens/StockScreen.jsx
│   └── profile/
│       ├── components/
│       └── screens/ProfileScreen.jsx
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   ├── states/
│   │   └── feedback/
│   ├── hooks/
│   └── theme/
└── platform/
```

### Regra importante

Pode haver pequenas variacoes de nomes, mas o app precisa ficar organizado por feature.

Nao criar tudo em `screens/` soltas sem agrupamento.

---

## 6. Modelo de navegacao obrigatorio

## 6.1. Tabs do MVP

As tabs obrigatorias sao:

1. `Hoje`
2. `Tratamentos`
3. `Estoque`
4. `Perfil`

### Regra

Nao criar tab para:

- chatbot
- configuracoes separadas
- admin
- calendar

## 6.2. Stacks internos

### `Hoje`

Pode conter:

- `TodayScreen`
- modal/sheet de registrar dose

### `Tratamentos`

Pode conter:

- `TreatmentsScreen`
- `TreatmentDetailsScreen` simples, se necessario

### `Estoque`

Pode conter:

- `StockScreen`
- `StockItemDetailsScreen` simples, se necessario

### `Perfil`

Pode conter:

- `ProfileScreen`
- `AccountSettingsScreen`
- `TelegramLinkScreen`, se a tela for separada

### Regra

Nao criar stacks profundas demais.

Se o fluxo exigir mais de 2 niveis de profundidade, a tela provavelmente esta complexa demais para o MVP.

---

## 7. Arquitetura de dados obrigatoria no mobile

## 7.1. Fonte de verdade

A fonte de verdade continua sendo:

- Supabase
- shared core
- shared-data

O app mobile nao vira nova fonte de verdade.

## 7.2. Consumo correto

O app mobile deve:

- usar repositories/factories vindos de `@meus-remedios/shared-data`
- usar cliente Supabase native da Fase 4
- reutilizar schemas e utils puros

## 7.3. Proibicoes

Proibido:

- fazer fetch "manual" desorganizado por tela se ja existe camada compartilhada equivalente
- criar schema local diferente do web/shared
- duplicar calculos de adesao, estoque, timeline

## 7.4. Caching

Se o cache da Fase 3 estiver pronto para consumo mobile, usar.

Se ainda nao estiver ergonomico para hooks mobile, o agente pode criar hook local leve no mobile consumindo a engine compartilhada.

O que **nao** pode:

- recriar um novo query cache do zero no mobile
- voltar a usar singletons acoplados da web

## 7.5. Politica online-first obrigatoria

Esta fase adota a politica congelada no addendum de offline:

- snapshots locais de leitura sao permitidos
- escrita offline e proibida
- mutacoes sem conectividade devem falhar claramente
- `Hoje`, `Tratamentos` e `Estoque` podem mostrar stale state quando necessario

## 7.6. Routing interno minimo obrigatorio

Mesmo sem notificacoes nativas ainda, o app deve sair desta fase com:

- registro central de rotas
- deep links internos para telas do shell MVP
- fallback seguro para `Hoje`

---

## 8. Sprint interno 5.1 - Estruturar shell e tabs do produto

### Objetivo

Substituir a navegacao tecnica de smoke/login/home pelo shell real do MVP.

### Entregaveis obrigatorios

- `RootTabs`
- tabs `Hoje`, `Tratamentos`, `Estoque`, `Perfil`
- icones simples e nativos
- indicador claro de aba ativa

### Exemplo de organizacao

```js
<Tab.Navigator>
  <Tab.Screen name="Hoje" component={TodayScreen} />
  <Tab.Screen name="Tratamentos" component={TreatmentStack} />
  <Tab.Screen name="Estoque" component={StockScreen} />
  <Tab.Screen name="Perfil" component={ProfileStack} />
</Tab.Navigator>
```

### Regra obrigatoria

`SmokeScreen` deixa de ser tela principal e passa a ser removida ou escondida em fluxo interno de diagnostico.

### Validacao

- o usuario logado cai no shell do produto
- logout volta para login

---

## 9. Sprint interno 5.2 - Construir a tela `Hoje`

### Objetivo

Entregar a tela mais importante do app.

### Conteudo minimo obrigatorio da tela `Hoje`

- cabecalho simples com saudacao ou status
- resumo do dia
- lista de doses pendentes/proximas
- CTA primario para registrar dose
- estado vazio
- estado de erro

### Conteudo proibido nesta fase

- todos os widgets complexos do dashboard web
- graficos pesados
- animacoes sofisticadas
- carrossel de insights

### Fonte de dados recomendada

Montar uma composicao enxuta a partir de:

- tratamentos ativos
- logs recentes
- indicadores simples derivados no shared/core

### Exemplo de estrutura de tela

```text
Hoje
├── Card de resumo
├── Secao "Proximas doses"
├── Lista de itens acionaveis
└── Botao/CTA registrar dose
```

### Regra obrigatoria

Se uma informacao nao ajudar o usuario a saber "o que tomar agora", ela nao e prioridade da tela.

---

## 10. Sprint interno 5.3 - Fluxo de registro de dose

### Objetivo

Implementar o fluxo mais critico do produto mobile.

### Requisitos obrigatorios

- abrir a partir da tela `Hoje`
- permitir registrar dose para item elegivel
- confirmar sucesso de forma clara
- refletir impacto na UI apos sucesso
- invalidar/atualizar dados relevantes

### Formato de UX recomendado

Usar:

- modal nativo simples
- bottom sheet simples
- tela secundaria curta

Nao usar:

- wizard longo
- UI super detalhada da web

### Dados minimos da acao

- protocolo ou medicamento alvo
- horario/contexto
- quantidade tomada

### Regras obrigatorias

- validacao usa schema compartilhado quando aplicavel
- mutacao passa pela camada de dados adequada
- apos sucesso, refletir mudancas em:
  - doses pendentes
  - resumo do dia
  - possivel indicador de adesao local

### Erros a evitar

- registrar dose direto em tela sem feedback
- deixar a UI stale sem refresh/invalidation
- bypassar a camada compartilhada para mutacao

---

## 11. Sprint interno 5.4 - Tela `Tratamentos`

### Objetivo

Permitir ao usuario entender rapidamente seus protocolos/tratamentos ativos.

### Conteudo minimo obrigatorio

- lista de tratamentos/protocolos ativos
- agrupamento simples por medicamento ou plano, se existir
- informacoes essenciais:
  - nome
  - frequencia
  - horarios
  - status ativo

### Conteudo opcional

- detalhe simples da dose alvo
- status de titracao resumido

### Conteudo proibido

- wizard completo de edicao
- todas as visualizacoes da web
- timeline complexa

### Regra obrigatoria

Esta tela e de **consulta** no MVP.

Se houver acao, ela deve ser leve e segura. Nada de editar tudo nesta fase sem necessidade explicita.

---

## 12. Sprint interno 5.5 - Tela `Estoque`

### Objetivo

Dar visibilidade rapida do nivel de estoque.

### Conteudo minimo obrigatorio

- lista de itens com status visual simples
- quantidade restante
- indicador de risco simples
- destaque de itens criticos

### Conteudo recomendado

- separacao:
  - critico
  - atencao
  - ok

### Conteudo proibido

- graficos complexos de custo
- visualizacoes historicas completas
- timeline de prescricoes

### Regra obrigatoria

Priorizar legibilidade e risco operacional, nao analytics.

---

## 13. Sprint interno 5.6 - Tela `Perfil` e configuracoes basicas

### Objetivo

Entregar o conjunto minimo de conta e preferencias acessiveis no mobile.

### Conteudo minimo obrigatorio

- email do usuario
- logout
- estado da conta
- entrada para Telegram
- entrada para configuracoes basicas

### Selecao de configuracoes permitidas nesta fase

- visualizar conta
- logout
- mudanca de senha simples, se o fluxo for viavel
- estado de Telegram

### Proibicoes

- replicar toda a tela de settings da web
- trazer modais/export/report
- trazer configuracoes administrativas

---

## 14. Sprint interno 5.7 - Vinculo Telegram no mobile

### Objetivo

Permitir que o usuario veja e controle o vinculo Telegram dentro do app mobile.

### Requisitos obrigatorios

- ler estado atual de `user_settings`
- mostrar conectado/desconectado
- gerar token de vinculacao
- exibir instrucoes curtas
- permitir desconectar, se o fluxo ja existir na camada de dados

### Fluxo recomendado

1. ler `telegram_chat_id`
2. se existir -> mostrar conectado
3. se nao existir -> botao gerar codigo
4. mostrar `/start TOKEN`
5. opcionalmente deep link para o bot

### Regra obrigatoria

Reutilizar a logica de backend/dados existente.

Nao criar um segundo mecanismo de vinculacao so para mobile.

---

## 15. Sprint interno 5.8 - Estados transversais de UX

### Objetivo

Fechar o MVP com consistencia minima.

### Componentes compartilhados internos do mobile recomendados

- `ScreenContainer`
- `SectionCard`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `PrimaryButton`
- `StatusBadge`

### Regras obrigatorias

- toda tela precisa ter loading
- toda tela precisa ter empty state
- toda tela precisa ter error state
- toda tela critica precisa ter stale/offline state coerente quando houver snapshot local
- mensagens devem ser claras e curtas

### Acessibilidade minima obrigatoria

- alvos de toque adequados
- labels legiveis
- contraste suficiente
- evitar textos pequenos demais
- respeito a safe area
- formularios utilizaveis com teclado aberto
- CTA principal nao escondido pelo teclado

---

## 16. Sprint interno 5.9 - Testes e validacao funcional

### Objetivo

Provar que o MVP funciona nos fluxos centrais.

### Testes unitarios/componentes obrigatorios

Cobrir no minimo:

- `TodayScreen`
- componente de lista de doses
- fluxo de registro de dose
- `TreatmentsScreen`
- `StockScreen`
- `ProfileScreen`
- componente/fluxo de Telegram link

### O que testar

- renderizacao basica
- loading/empty/error
- interacao do usuario
- sucesso/erro de mutacao
- navegacao entre fluxos principais

### Testes manuais obrigatorios

#### Fluxo 1

- login
- abrir Hoje
- registrar dose
- ver UI atualizada

#### Fluxo 2

- abrir Tratamentos
- validar dados carregados

#### Fluxo 3

- abrir Estoque
- validar destaque de risco simples

#### Fluxo 4

- abrir Perfil
- gerar token Telegram

#### Fluxo 5

- abrir Hoje online
- desligar a rede
- reabrir a tela
- stale state aparece corretamente
- tentar registrar dose offline
- app bloqueia com mensagem clara

### Plataformas obrigatorias

- iOS simulator
- Android emulator
- teclado e safe area validados em pelo menos 1 device por plataforma

---

## 17. Sprint interno 5.10 - Endurecimento e corte de escopo

### Objetivo

Antes de encerrar a fase, remover o que sobrou de ambicao excessiva.

### Checklist de corte

Se qualquer item abaixo tiver entrado sem ser essencial, remover ou adiar:

- tela extra fora das tabs principais
- grafico complexo
- animacao sofisticada
- fluxo administrativo
- feature web portada parcialmente
- qualquer dependencia nova nao essencial

### Regra

Um MVP menor, coeso e testado e preferivel a um "quase completo" instavel.

---

## 18. Estrategia recomendada de implementacao por PR

Divisao recomendada:

1. PR 1 - shell + tabs
2. PR 2 - Hoje + dose register
3. PR 3 - Tratamentos
4. PR 4 - Estoque
5. PR 5 - Perfil + Telegram
6. PR 6 - estados transversais + testes + hardening

### Regra obrigatoria

Nao abrir uma unica PR gigante com a Fase 5 inteira.

---

## 19. Anti-patterns desta fase

### Errado 1 - Tentar atingir paridade com a web

Erro:

- explode escopo
- sacrifica qualidade do MVP

### Errado 2 - Portar dashboard web inteiro

Erro:

- muito ruído
- piora a usabilidade mobile

### Errado 3 - Implementar push native nesta fase

Erro:

- contradiz a separacao entre Fase 5 e Fase 6

### Errado 4 - Duplicar logica de negocio localmente no mobile

Erro:

- cria drift com shared core/shared-data

### Errado 5 - Criar settings gigantes e pouco usados

Erro:

- rouba tempo do fluxo principal

### Errado 6 - Levar telas fora do MVP "porque ja existem na web"

Erro:

- existencia na web nao e criterio de entrada no MVP mobile

---

## 20. Definition of Done da Fase 5

- [ ] shell + tabs do produto funcionando
- [ ] tela `Hoje` funcional e util
- [ ] fluxo de registro de dose funcional
- [ ] tela `Tratamentos` funcional
- [ ] tela `Estoque` funcional
- [ ] tela `Perfil` funcional
- [ ] fluxo de vinculo Telegram funcional
- [ ] estados loading/empty/error presentes nas telas principais
- [ ] stale/offline states coerentes existem onde houver snapshot local
- [ ] fluxos principais validados manualmente
- [ ] testes unitarios/componentes criticos criados
- [ ] zero dependencia de componentes web
- [ ] zero dependencia de features fora do MVP

---

## 21. Handoff para a Fase 6

O proximo agente deve receber:

- app mobile com fluxo de produto real
- shell estavel
- auth/sessao estaveis
- camadas compartilhadas funcionando
- Telegram preservado

So entao faz sentido adicionar:

- `notification_devices`
- `notification_preference`
- `expo-notifications`
- dispatcher multicanal
- beta interno com push

---

## 22. Ancoragem e validacao contra a Master Spec

Checklist obrigatorio de ancoragem:

- [ ] Esta fase entrega shell + tabs
- [ ] Esta fase entrega `Hoje`
- [ ] Esta fase entrega registro de dose
- [ ] Esta fase entrega `Tratamentos`
- [ ] Esta fase entrega `Estoque`
- [ ] Esta fase entrega `Perfil / Settings`
- [ ] Esta fase entrega vinculo Telegram
- [ ] Esta fase nao implementa push native ainda
- [ ] Esta fase nao implementa PDF/chatbot/calendar/emergency avancado/admin
- [ ] Esta fase segue os addendums de deep links e offline/sync
- [ ] Esta fase respeita a Fase 5 da master spec e prepara corretamente a Fase 6

Se qualquer item acima falhar, este documento deve ser corrigido antes da Fase 6.
