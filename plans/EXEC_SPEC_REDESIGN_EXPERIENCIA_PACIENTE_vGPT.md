# Exec Spec — Redesign e Evolução da Experiência do Paciente V2

**Projeto:** Meus Remédios  
**Data:** 2026-03-23  
**Status:** Plano mestre para execução por agentes IA  
**Escopo:** Redesenho estrutural, visual e comportamental da app para convergir o produto atual à visão definida em `plans/UX_VISION_EXPERIENCIA_PACIENTE.md` e aos artefatos da pasta `public/new_designs/`

---

## 1. Objetivo

Este plano define, com nível operacional, como evoluir a aplicação atual para entregar a nova visão de produto e interface disponível em:

- `plans/UX_VISION_EXPERIENCIA_PACIENTE.md`
- `public/new_designs/DESIGN-SYSTEM.md`
- `public/new_designs/PRODUCT_STRATEGY_CONSOLIDATED.md`
- `public/new_designs/REFERENCE.md`
- `public/new_designs/design-system.png`
- mocks `.png` mobile e desktop de `Hoje`, `Tratamentos` e `Estoque`
- protótipos:
  - `public/new_designs/meus-remédios---simple-treatments/`
  - `public/new_designs/meus-remédios---complex-treatments/`

O documento foi escrito para agentes implementadores autônomos. Ele não é só um guia visual; é uma especificação de transformação de produto, arquitetura de UI, componentes, motion, navegação, densidade, prioridades técnicas e critérios de aceite.

---

## 2. Resultado Esperado

Ao final desta iniciativa, o Meus Remédios deve deixar de parecer uma interface funcional com camadas visuais heterogêneas e passar a operar como um sistema coeso de “santuário terapêutico brasileiro”:

- calmo
- editorial
- legível
- acolhedor
- de alta confiança clínica
- adaptativo à complexidade do paciente
- fiel ao fluxo real “Hoje / Tratamento / Estoque / Perfil”

O redesign não é apenas cosmético. Ele deve:

- reforçar a pergunta central do paciente: “o que preciso fazer agora?”
- reduzir ruído cognitivo
- adaptar densidade automaticamente para casos simples e complexos
- substituir a linguagem neon/cyberpunk residual por uma linguagem tonal clínica/editorial
- consolidar um design system executável, reutilizável e testável
- alinhar mobile e desktop a uma mesma gramática visual

---

## 3. Fontes Canônicas e Papel de Cada Uma

### 3.1 Documentos

- `plans/UX_VISION_EXPERIENCIA_PACIENTE.md`
  - Define a UX já conquistada e a direção obrigatória para qualquer UI futura.
  - É a fonte canônica para navegação, zonas temporais, complexidade progressiva e biblioteca de componentes clínicos.

- `public/new_designs/DESIGN-SYSTEM.md`
  - Define o tom visual alvo: “Therapeutic Sanctuary”.
  - É a base para tokens, tipografia, superfície, profundidade, botões, listas e princípios “No-Line”.

- `public/new_designs/PRODUCT_STRATEGY_CONSOLIDATED.md`
  - Define tese visual, personas, motion language, progressão de complexidade, content plan e regras de composição.
  - É a ponte entre estratégia de produto e decisões concretas de UI.

- `public/new_designs/REFERENCE.md`
  - Reforça atributos centrais do produto: gratuitidade, privacidade, portabilidade clínica, persona simples vs complexa.

### 3.2 Artefatos visuais

- `public/new_designs/design-system.png`
  - Snapshot de tokens visuais e primitives.

- Mocks mobile e desktop
  - `simple-hoje-*`
  - `simple-tratamentos-*`
  - `simple-estoque-*`
  - `complex-hoje-*`
  - `complex-tratamentos-*`
  - `complex-estoque-*`
  - Devem ser interpretados como referência de hierarquia, densidade, agrupamento, CTA e atmosfera.

### 3.3 Protótipos navegáveis

- `public/new_designs/meus-remédios---simple-treatments/`
  - Referência principal para pacientes simples.

- `public/new_designs/meus-remédios---complex-treatments/`
  - Referência principal para pacientes complexos.

Esses protótipos não devem ser copiados literalmente. Devem ser traduzidos para a arquitetura existente do produto, respeitando dados reais, constraints de acessibilidade, lazy-loading, componentes canônicos já construídos e regras da base.

---

## 4. Diagnóstico do Estado Atual

### 4.1 Ponto de entrada e shell

O `src/App.jsx` atual:

- controla navegação por `currentView` local, não por uma shell de experiência formalizada
- renderiza views via `switch`
- já possui lazy loading para views não críticas
- preserva `Dashboard` como view crítica
- usa `BottomNav` somente para autenticados
- mantém elementos globais como chatbot, onboarding, offline banner e install prompt

### 4.2 Mismatch entre estado atual e estado alvo

Hoje a aplicação mistura:

- legado visual glass/neon
- gradientes cyberpunk residuais
- bordas explícitas em diversas áreas
- navegação funcional correta, mas sem gramática visual unificada
- páginas com estilos próprios e pouco alinhamento entre si
- componentes clínicos novos convivendo com telas antigas ainda não absorvidas pelo sistema

Os maiores desvios observados:

1. **Tema visual inconsistente**
   - `Dashboard` já evoluiu semanticamente.
   - `Treatment`, `Stock` e `Profile` ainda exibem padrões antigos com bordas, gradientes neon e cards heterogêneos.

2. **Shell de aplicação subespecificada**
   - Não existe um `AppShell` explícito que encapsule top bar, nav, transições, área de conteúdo, safe areas e regras de densidade.

3. **BottomNav antiga**
   - Funciona, mas não expressa a linguagem glass editorial/tonal mostrada nos mocks e protótipos.

4. **Tratamento não atingiu a visão de complexidade progressiva**
   - A tela atual organiza dados corretamente, mas ainda está perto da estrutura de entidade/modelagem.
   - Falta transição clara entre experiência simples e complexa por domínio clínico, fase, titração e criticidade.

5. **Estoque ainda comunica “gestão” mais do que “prioridade de reabastecimento”**
   - A visão alvo enfatiza urgência, segurança e decisão rápida.

6. **Perfil ainda opera como agrupador utilitário tradicional**
   - Precisa refletir melhor a estrutura “Saúde & Histórico / Dados / Configurações”, com menor ruído visual.

7. **Motion language incompleta**
   - Há animações pontuais, mas não uma coreografia consistente de entrada, transição, feedback tátil e progress fill entre views.

---

## 5. Princípios Não Negociáveis

### 5.1 Produto

- O app serve ao paciente, não ao modelo de dados.
- A primeira pergunta sempre é: “o que fazer agora?”
- Complexidade deve emergir progressivamente, nunca de forma brusca.
- Simplicidade não é empobrecimento; é priorização.

### 5.2 Visual

- Aplicar a tese “Therapeutic Sanctuary”.
- Eliminar visual “neon pós-moderno” residual como estilo dominante.
- Manter apenas o que for reaproveitável em semântica, não em aparência.
- Aplicar a regra **No-Line**: não usar bordas como principal mecanismo de separação.
- Definir profundidade por superfícies e contraste tonal.

### 5.3 Composição

- Mobile-first.
- Vertical-first.
- Uma hierarquia principal por tela.
- No máximo 2 cores de acento por screen.
- CTA principal inequívoco.
- Sem mosaico genérico de cards.

### 5.4 Tipografia

- Headlines: Public Sans
- Body/UI: Lexend
- Nunca usar peso abaixo de 400
- Priorizar legibilidade para público idoso e cansado

### 5.5 Motion

- Motion comunica estado, prioridade e recompensa.
- Toda animação deve respeitar `prefers-reduced-motion`.
- Interações: até 400ms
- Data fills: até 1000ms
- Priorizar `transform` e `opacity`

---

## 6. Visão de Arquitetura de UI Alvo

## 6.1 Nova macroestrutura

Implementar a aplicação como uma shell de experiência composta por:

1. **AppShell**
   - container global da experiência autenticada
   - controla safe areas, fundo tonal, top spacing, padding bottom para nav, transições entre views

2. **ExperienceLayout**
   - decide composição mobile vs desktop
   - controla largura máxima, grids por tela, header contextual e regiões secundárias

3. **Navigation System**
   - BottomNav mobile em glass editorial
   - Sidebar desktop para views mais densas, quando fizer sentido
   - comportamento consistente entre `Hoje`, `Tratamento`, `Estoque`, `Perfil`

4. **Complexity System**
   - camada explícita que lê complexidade automática e override manual
   - injeta variantes visuais e densidade nas páginas

5. **Motion System**
   - transição de view
   - entrance cascade
   - living fill
   - tactile press

6. **Clinical Components Layer**
   - componentes canônicos para adesão, dose, estoque, titração, histórico e ações rápidas

---

## 7. Estratégia de Implementação por Camadas

A execução deve ocorrer de baixo para cima:

1. tokens e foundations
2. shell e navegação
3. componentes base
4. página Hoje
5. página Tratamento
6. página Estoque
7. página Perfil
8. landing/auth/onboarding/alinhamentos finais
9. polish, acessibilidade, testes e documentação

Nunca começar pelo refinamento visual de telas isoladas antes de estabilizar foundations.

---

## 8. Foundation Redesign

## 8.1 Objetivo

Criar uma base visual única para todo o produto.

## 8.2 Entregáveis

- novo conjunto de tokens CSS
- refatoração das variáveis de cor, superfície, texto, radius, sombra e motion
- incorporação de tipografia Public Sans + Lexend
- revisão das bases globais em `src/shared/styles/`
- guidelines para light theme principal
- tratamento opcional/minimal para dark theme sem inversão simplista

## 8.3 Mudanças obrigatórias

### Cores

Adotar tokens alinhados a:

- `primary: #006a5e`
- `primary-container: #008577`
- `primary-fixed: #90f4e3`
- `secondary: #005db6`
- `secondary-fixed: #d6e3ff`
- `tertiary-fixed: #ffdea8`
- `error: #ba1a1a`
- `surface: #f8fafb`
- `surface-container-low: #f2f4f5`
- `surface-container-lowest: #ffffff`
- `on-surface: #191c1d`

### Superfícies

Separação estrutural deve acontecer com:

- `surface`
- `surface-container-low`
- `surface-container-lowest`

Não depender de:

- borders hard
- glow neon
- sombras fortes
- outlines como separador primário

### Tipografia

Criar tokens claros para:

- `display-md`
- `headline-md`
- `title-lg`
- `title-sm`
- `body-lg`
- `label-md`
- `label-sm`

### Radius

Padronizar:

- botões: `xl` ou `full`
- cards padrão: `lg`
- containers principais: `2rem`
- pills/badges/progress: `full`

### Sombras

Substituir:

- glow neon
- drop shadow agressiva

Por:

- ambient shadow
- glass leve apenas em elementos flutuantes

### Motion tokens

Criar tokens reutilizáveis:

- `--duration-fast`
- `--duration-base`
- `--duration-slow`
- `--ease-default`
- `--ease-out`
- `--ease-spring`

---

## 9. App Shell e Navegação

## 9.1 Objetivo

Fazer a aplicação “parecer um produto único” independentemente da tela ativa.

## 9.2 Refatorações propostas

### `src/App.jsx`

Evoluir `App.jsx` para operar como orquestrador de shell:

- manter a lógica atual de autenticação e lazy loading
- encapsular conteúdo autenticado em `AppShell`
- encapsular conteúdo público em `PublicShell` ou equivalente simples
- aplicar transições entre views com `AnimatePresence`
- adicionar metadata por view:
  - label
  - navegação primária
  - título contextual
  - classe de layout
  - densidade preferida

### Novo `AppShell`

Responsabilidades:

- fundo base
- padding bottom compatível com BottomNav
- top safe area
- wrapper desktop/mobile
- transições de página
- floating layers:
  - chatbot
  - install prompt
  - offline banner
  - onboarding

### BottomNav v2

Objetivo:

- aproximar da referência dos protótipos e mocks
- glassmorphism sutil
- pills/active state suaves
- label sempre presente
- estados claros para ativo/inativo
- hit area confortável

Comportamentos:

- mobile: barra fixa inferior com cápsula ativa
- desktop: migrar para sidebar contextual quando necessário

### Sidebar desktop

Usar como extensão natural da navegação em telas amplas, inspirado no protótipo complexo.

Não deve:

- ser uma “versão admin”
- usar bordas pesadas
- competir com o conteúdo principal

Deve:

- abrigar branding
- navegação principal
- ação rápida de adicionar medicamento
- mini status do usuário

---

## 10. Complexity Engine

## 10.1 Objetivo

Transformar complexidade progressiva em um sistema explícito, e não apenas um conjunto de ifs visuais.

## 10.2 Estados

- `simple`
- `moderate`
- `complex`

## 10.3 Triggers

Combinar sinais de:

- quantidade de medicamentos ativos
- existência de protocolos com titração
- frequência/variação de doses
- monitoramento clínico especial
- override manual em Perfil

## 10.4 Responsabilidades

O complexity engine deve fornecer:

- modo atual
- motivo da classificação
- densidade recomendada por screen
- componentes a exibir/ocultar
- comportamento de colapso padrão
- layout de hero/resumo por view

## 10.5 Uso por tela

### Hoje

- simple: foco no “próximo a tomar”
- moderate: zonas temporais com toggle
- complex: agrupamento por plano, maior compactação, futuros colapsados

### Tratamento

- simple: lista linear e acolhedora
- complex: agrupamento por condição/plano/fase com indicadores clínicos

### Estoque

- simple: urgência e reabastecimento
- complex: priorização, histórico, custos e timelines

### Perfil

- complexidade afeta pouco; manter estável

---

## 11. Página Hoje — Execução Detalhada

## 11.1 Papel

É o coração do produto. Deve ser a screen mais forte do redesign.

## 11.2 Fontes

- `plans/UX_VISION_EXPERIENCIA_PACIENTE.md`
- `public/new_designs/simple-hoje-mobile.png`
- `public/new_designs/simple-hoje-desktop.png`
- `public/new_designs/complex-hoje-mobile.png`
- `public/new_designs/complex-hoje-desktop.png`

## 11.3 O que preservar do estado atual

O Dashboard já possui componentes importantes que devem ser reutilizados e refinados:

- `RingGauge`
- `StockBars`
- `DoseZoneList`
- `SwipeRegisterItem`
- `SmartAlerts`
- `useDoseZones`
- `useComplexityMode`
- `ViewModeToggle`
- `AdaptiveLayout`

## 11.4 O que redesenhar

### Hero clínico

Substituir qualquer sensação de “painel experimental” por um hero com:

- saudação pessoal
- adesão do dia
- streak
- trend visual inline
- alertas críticos condensados

### Zona de ação primária

No modo simples, a próxima dose deve aparecer como um bloco dominante com:

- nome do medicamento
- dose
- contexto
- horário
- CTA único “Tomar Agora” ou “Registrar Agora”

No modo complexo, essa zona deve virar:

- bloco de prioridade máxima
- lista agrupada por janela temporal
- CTA de lote quando pertinente

### Cronograma do dia

Evoluir para a linguagem dos mocks:

- seções temporais claras
- densidade adaptativa
- leading icon em fundo suave
- estados tomado / aguardando / atrasado / futuro
- progressão visual vertical fluida

### Doses concluídas

Transformar em feedback positivo compacto, sem virar elemento dominante.

### Alertas de estoque

Integrar no final da jornada do “Hoje” como suporte, não como protagonista, salvo criticidade alta.

## 11.5 Regras de composição

### Simple

- ring gauge grande
- CTA singular
- timeline do dia com cards altos
- linguagem acolhedora

### Complex

- hero mais compacto
- densidade maior
- agrupamento por manhã/tarde/noite ou zonas temporais deslizantes
- badges pequenos
- tratamento/plano visível quando necessário

## 11.6 Critérios de aceite

- Um paciente simples entende em 3 segundos a próxima ação
- Um paciente complexo enxerga o dia inteiro sem overload
- Swipe/register continua sendo gesto prioritário
- RingGauge permanece canônico, mas com refinamento visual editorial
- Tempo e prioridade são mais legíveis que no dashboard atual

---

## 12. Página Tratamento — Execução Detalhada

## 12.1 Papel

É a área de gestão do tratamento, não um espelho do banco de dados.

## 12.2 Fontes

- `public/new_designs/simple-tratamentos-mobile.png`
- `public/new_designs/simple-tratamentos-desktop.png`
- `public/new_designs/complex-tratamentos-mobile.png`
- `public/new_designs/complex-tratamentos-desktop.png`
- `public/new_designs/meus-remédios---simple-treatments/`
- `public/new_designs/meus-remédios---complex-treatments/`

## 12.3 Estado atual

A tela atual possui boa separação conceitual:

- planos de tratamento
- medicamentos avulsos
- sem tratamento
- inativos

Mas ainda expressa isso em linguagem estrutural/CRUD.

## 12.4 Estado alvo

### Modo simples

Inspirado no protótipo simple:

- search bar suave no topo
- tabs: `Ativos`, `Pausados`, `Finalizados`
- cards de medicamento/tratamento com foco em:
  - nome
  - dose
  - próxima dose
  - continuidade
  - status
- card crítico de estoque embutido quando necessário
- FAB ou CTA principal para novo tratamento

### Modo complexo

Inspirado no protótipo complex:

- título forte “Meus Tratamentos”
- subtítulo com contagem de medicações ativas
- agrupamento por domínio clínico ou plano terapêutico
- cards mais compactos
- indicadores inline de:
  - adesão 7d
  - próxima dose
  - fase de titração
  - status de estoque
- destaques clínicos para esquemas variáveis

## 12.5 Modelagem visual recomendada

Criar/ajustar componentes:

- `TreatmentHeader`
- `TreatmentTabs`
- `TreatmentSearch`
- `TreatmentGroup`
- `TreatmentCardSimple`
- `TreatmentCardComplex`
- `TitrationMiniTimeline`
- `ProtocolStatusBadge`
- `TreatmentActionFab`

## 12.6 Mapeamento do estado atual para o novo

- `TreatmentPlanCard` pode evoluir para `TreatmentGroup` / `TreatmentCardComplex`
- `ProtocolListItem` pode ser absorvido em uma row clínica mais refinada
- `MedicineOrphanCard` deve ganhar tratamento editorial e CTA mais claro
- `TreatmentWizard` permanece funcional, mas precisa herdar visual novo

## 12.7 Critérios de aceite

- Modo simples parece imediatamente mais simples que o atual
- Modo complexo acrescenta densidade sem poluir
- Titração é compreensível sem abrir várias telas
- Busca, tabs e FAB obedecem o design system
- Tratamento deixa de parecer “lista administrativa”

---

## 13. Página Estoque — Execução Detalhada

## 13.1 Papel

Traduzir controle de estoque em segurança clínica e decisão rápida.

## 13.2 Fontes

- `public/new_designs/simple-estoque-mobile.png`
- `public/new_designs/simple-estoque-desktop.png`
- `public/new_designs/complex-estoque-mobile.png`
- `public/new_designs/complex-estoque-desktop.png`

## 13.3 Estado atual

A tela já tem bons dados:

- status por medicamento
- custos
- prescription timeline
- histórico de entradas

O problema é a comunicação visual, ainda muito próxima de painel técnico com estética antiga.

## 13.4 Estado alvo

### Simple

- alerta superior forte e direto quando houver risco
- cards de estoque com:
  - categoria/condição
  - nome
  - quantidade
  - dias restantes
  - barra de progresso
  - rótulo de risco
- histórico abaixo
- FAB ou ação flutuante clara

### Complex

- lista de prioridade de reabastecimento
- cards de urgência por medicamento
- botão principal de reabastecimento/registro
- seção “Todos os itens” resumida
- histórico de entradas com hierarquia baixa

## 13.5 Componentes-alvo

- `StockPriorityHero`
- `StockUrgencyCard`
- `StockInventoryRow`
- `StockHistoryList`
- `StockQuickActionFab`
- evolução de `CostChart`
- evolução de `PrescriptionTimeline`
- evolução de `StockBars`

## 13.6 Regras

- o estado crítico deve ser compreendido sem leitura longa
- o vermelho só aparece para urgência real
- barras devem ser mais clínicas e menos decorativas
- custos são detalhe/contexto, não a mensagem principal
- a compra/reposição precisa de CTA inequívoco

## 13.7 Critérios de aceite

- paciente identifica rapidamente o que precisa repor primeiro
- o estoque “baixo” e “crítico” têm leitura instantânea
- a screen não depende de bordas para organizar conteúdo
- a hierarquia visual bate com os mocks

---

## 14. Página Perfil — Execução Detalhada

## 14.1 Papel

Ser utilitária, clara e serena. Sem drama visual.

## 14.2 Estado atual

Já possui a arquitetura funcional correta:

- saúde e histórico
- relatórios e dados
- configurações
- telegram
- densidade
- senha

## 14.3 Estado alvo

Refinar a visualidade para:

- reduzir bordas e ruído
- organizar em seções suaves
- melhorar header de usuário
- padronizar rows, badges, toggles, selects e formulários
- tornar “Densidade da interface” parte explícita do sistema de complexidade

## 14.4 Componentes-alvo

- `ProfileHero`
- `ProfileSectionCard`
- `ProfileActionRow`
- `ProfileStatusBadge`
- `ProfileSettingSelect`
- `ProfileInlineForm`

## 14.5 Critérios de aceite

- Perfil parece parte do mesmo produto, mas menos “heroic”
- Telegram, export, PDF e saúde ficam fáceis de escanear
- override manual de densidade fica claro e confiável

---

## 15. Landing, Auth e Estados Públicos

Embora o pedido central esteja nas áreas autenticadas, a visão final da aplicação exige alinhamento também nos estados públicos.

## 15.1 Necessário

- revisar `Landing`
- revisar `Auth`
- alinhar `Loading`, `ViewSkeleton`, `EmptyState`, `Modal`, `Button`
- garantir que o usuário não perceba ruptura brutal entre público e autenticado

## 15.2 Regra

Landing pode ter expressão mais narrativa, mas o app autenticado deve ser mais utilitário.

---

## 16. Sistema de Componentes a Consolidar

## 16.1 Componentes já existentes a preservar/evoluir

- `RingGauge`
- `StockBars`
- `SparklineAdesao`
- `SwipeRegisterItem`
- `TreatmentAccordion`
- `ViewModeToggle`
- `DailyDoseModal`
- `CostChart`
- `PrescriptionTimeline`
- `Calendar`

## 16.2 Componentes novos ou reescritos

- `AppShell`
- `ExperienceLayout`
- `TopBar`
- `BottomNavV2`
- `SidebarNav`
- `PageTransition`
- `SectionHeader`
- `PriorityDoseCard`
- `DoseTimeline`
- `TreatmentTabs`
- `TreatmentSearch`
- `TreatmentCardSimple`
- `TreatmentCardComplex`
- `StockPriorityHero`
- `StockUrgencyCard`
- `ProfileHero`

## 16.3 Regra de implementação

Não criar paralelos desnecessários. Sempre preferir:

- evoluir componente canônico existente
- ou substituir explicitamente um legado

Evitar manter duas bibliotecas concorrentes de UI para o mesmo propósito.

---

## 17. Reorganização de CSS e Tokens

## 17.1 Meta

Fazer o design system viver de forma explícita no código.

## 17.2 Direção

Consolidar tokens em:

- cores
- superfícies
- tipografia
- spacing
- radius
- motion
- elevation

## 17.3 Ações

- revisar `src/shared/styles/tokens/*`
- eliminar nomenclaturas ligadas a neon/glow como padrão primário
- manter compatibilidade somente enquanto houver migração incremental
- criar documentação curta de uso no próprio código

---

## 18. Motion System Detalhado

## 18.1 Entrance

Aplicar “cascade reveal” em:

- rows de dose
- cards de tratamento
- cards de estoque
- seções secundárias

## 18.2 Progress

Aplicar “living fill” em:

- ring gauge
- barras de estoque
- timelines de prescrição
- indicadores de adesão

## 18.3 Page transition

Aplicar “soft handoff” entre views em `AppShell`.

## 18.4 Interaction feedback

Aplicar “tactile press” em:

- botões
- nav items
- cards clicáveis
- FABs

## 18.5 Recompensa

Manter e refinar microcelebrações:

- confirmação de dose
- streak
- marco de 100%

Sem cair em visual infantil.

---

## 19. Responsividade

## 19.1 Mobile

É a prioridade.

Regras:

- tudo precisa funcionar confortavelmente em viewport estreita
- touch targets grandes
- nav inferior sempre segura
- CTA principal ao alcance do polegar

## 19.2 Desktop

Não deve ser apenas “mobile esticado”.

Regras:

- usar grid de 2 ou 3 colunas quando trouxer ganho real de legibilidade
- usar sidebar nos modos mais densos
- preservar respiro e assimetria intencional

## 19.3 Compatibilidade com PWA

Garantir:

- safe-area bottom/top
- overlays não colidirem com bottom nav
- install prompt e FAB não competirem entre si

---

## 20. Acessibilidade

Itens obrigatórios:

- contraste AA
- labels textuais com ícones
- foco visível
- `prefers-reduced-motion`
- `prefers-reduced-transparency`
- sem dependência de cor única para status
- leitura confortável para idosos
- formulários com labels e mensagens claras

---

## 21. Performance e Constraints Técnicas

O redesign deve respeitar as regras já estabelecidas no projeto:

- lazy-loading de views não críticas
- `Dashboard` continua crítico
- `ViewSkeleton` continua fallback padrão
- sem regressão de bundle
- sem regressão no M2/M3/M5/M6/P1-P4

## 21.1 Regras específicas

- evitar libs novas pesadas apenas para estética
- reutilizar Framer Motion já presente
- evitar layout thrash
- usar CSS e componentes leves
- garantir boa performance em mid-tier mobile

---

## 22. Plano de Execução por Fases

## Fase 0 — Preparação

### Objetivo

Montar o terreno sem mexer em tudo ao mesmo tempo.

### Tarefas

- inventariar componentes visuais atuais
- mapear tokens antigos usados por telas alvo
- decidir estratégia de migração incremental vs substituição
- capturar screenshots baseline da app atual
- definir matriz de telas alvo e estados

### Saída

- checklist de migração
- baseline visual e técnico

## Fase 1 — Foundation e Shell

### Objetivo

Criar a base visual e estrutural.

### Tarefas

- refatorar tokens globais
- incorporar fontes
- construir `AppShell`
- construir `BottomNavV2`
- construir `SidebarNav`
- construir `PageTransition`
- alinhar `Button`, `Modal`, `Loading`, `EmptyState`, `ViewSkeleton`

### Gate

- app inteira já usa shell nova
- sem regressão funcional de navegação

## Fase 2 — Dashboard / Hoje

### Objetivo

Entregar a screen mais importante na nova linguagem.

### Tarefas

- refinar hero
- refinar zonas temporais
- adaptar simple/moderate/complex
- revisar swipe, batch action, microfeedback
- alinhar stock widget e doses concluídas

### Gate

- mobile e desktop coerentes com mocks
- complexidade progressiva visível

## Fase 3 — Tratamento

### Objetivo

Unificar protótipo simple e complex numa única screen adaptativa.

### Tarefas

- construir search/tabs/header
- criar cards simple/complex
- integrar titration mini timeline
- redefinir grupos por plano/domínio/status
- alinhar wizard e flows auxiliares

### Gate

- experiência simples e complexa claramente distintas
- sem perda de capacidade funcional existente

## Fase 4 — Estoque

### Objetivo

Reposicionar estoque como segurança clínica e reabastecimento.

### Tarefas

- criar hero de prioridade
- criar cards de urgência
- reorganizar lista completa
- revisar histórico
- harmonizar `CostChart` e `PrescriptionTimeline`

### Gate

- urgência e próxima ação legíveis em segundos

## Fase 5 — Perfil e estados secundários

### Objetivo

Fechar a linguagem sistêmica.

### Tarefas

- refinar Perfil
- alinhar Health History / Consultation / Emergency onde necessário
- revisar Landing/Auth
- revisar FABs e overlays globais

### Gate

- produto parece coeso ponta a ponta

## Fase 6 — Polish, QA e documentação

### Objetivo

Estabilizar e preparar para rollout seguro.

### Tarefas

- QA visual mobile/desktop
- acessibilidade
- performance
- testes
- atualização de documentação
- screenshots finais

---

## 23. Ordem Recomendada de Trabalho para Agentes

Se a execução for distribuída entre vários agentes, seguir esta ordem:

1. agente foundation/tokens/shell
2. agente navigation + motion
3. agente Hoje
4. agente Tratamento
5. agente Estoque
6. agente Perfil + estados secundários
7. agente QA visual + testes

Regra:

- evitar agentes editando o mesmo conjunto de arquivos simultaneamente
- separar por ownership claro

---

## 24. Arquivos Provavelmente Impactados

## 24.1 Shell e entrypoint

- `src/App.jsx`
- `src/App.module.css`
- `src/shared/components/ui/BottomNav.jsx`
- `src/shared/components/ui/BottomNav.css`
- novos componentes de shell em `src/shared/components/` ou `src/shared/layouts/`

## 24.2 Styles

- `src/shared/styles/index.css`
- `src/shared/styles/tokens/*`
- `src/shared/styles/themes/*`

## 24.3 Hoje

- `src/views/Dashboard.jsx`
- `src/views/Dashboard.module.css`
- `src/features/dashboard/components/*`
- `src/features/dashboard/hooks/*`

## 24.4 Tratamento

- `src/views/Treatment.jsx`
- `src/views/treatment/*`
- `src/features/protocols/components/*`

## 24.5 Estoque

- `src/views/Stock.jsx`
- `src/views/Stock.css`
- `src/features/stock/components/*`

## 24.6 Perfil

- `src/views/Profile.jsx`
- `src/views/profile/*`

---

## 25. Critérios de Pronto por Tela

Uma tela só pode ser considerada concluída quando:

1. está visualmente alinhada aos artefatos de referência
2. respeita o design system novo
3. respeita complexity mode
4. mantém ou melhora a funcionalidade atual
5. está boa em mobile
6. está boa em desktop
7. não reintroduz estética neon legada como dominante
8. não depende de bordas para estrutura
9. tem CTA principal claro
10. possui loading, empty, error e success states coerentes

---

## 26. Critérios de Pronto do Programa de Redesign

O redesign completo estará pronto quando:

- a navegação autenticada inteira operar na nova shell
- `Hoje`, `Tratamento`, `Estoque` e `Perfil` estiverem alinhados à nova visão
- a app refletir com clareza os modos simple e complex
- o design system estiver codificado e reutilizável
- não houver choque visual gritante entre telas novas e antigas
- performance e acessibilidade permanecerem aceitáveis

---

## 27. Não Fazer

Durante a execução, agentes não devem:

- “embelezar” sem resolver hierarquia
- copiar pixel a pixel os protótipos ignorando a arquitetura real
- introduzir bibliotecas pesadas desnecessárias
- criar novos componentes paralelos para problemas já resolvidos
- reintroduzir bordas duras e grids genéricos de cards
- transformar Perfil em dashboard
- deixar complexidade simples e complexa com a mesma densidade
- sacrificar legibilidade por sofisticação visual

---

## 28. Riscos e Mitigações

## Risco 1 — Regressão visual parcial

### Problema

Parte da app nova, parte ainda antiga.

### Mitigação

- implementar foundation antes das telas
- usar shell nova cedo
- migrar por domínio completo

## Risco 2 — Copiar protótipos sem semântica do produto

### Problema

Tela bonita, mas quebrando fluxos reais.

### Mitigação

- sempre partir das responsabilidades da screen real
- usar protótipos como referência de composição, não como fonte de lógica

## Risco 3 — Densidade excessiva no modo complexo

### Problema

Complex vira confuso.

### Mitigação

- progressive disclosure
- colapsos padrão
- badges menores
- informação só quando agrega decisão

## Risco 4 — Perda da simplicidade no modo simple

### Problema

Simple herda ruído do complexo.

### Mitigação

- projetar simple primeiro
- tratar complex como enriquecimento progressivo

## Risco 5 — Regressão de performance

### Problema

Motion e glass em excesso degradam mobile.

### Mitigação

- motion GPU-only
- blur somente em elementos flutuantes
- medição real em dispositivos medianos

---

## 29. Estratégia de Testes e Validação

## 29.1 Visual

- comparar tela a tela com mocks e protótipos
- validar mobile e desktop
- validar simple vs complex

## 29.2 Funcional

- navegação entre tabs
- registro de dose
- flows de tratamento
- flows de estoque
- perfil, telegram, export, relatório

## 29.3 Técnica

- `npm run validate:agent`
- testes de componentes afetados
- smoke tests por tela

## 29.4 Acessibilidade

- teclado
- foco
- contraste
- reduced motion

---

## 30. Checklist Operacional para o Primeiro Agente Executor

- ler este plano inteiro
- reler `plans/UX_VISION_EXPERIENCIA_PACIENTE.md`
- revisar `public/new_designs/DESIGN-SYSTEM.md`
- revisar `public/new_designs/PRODUCT_STRATEGY_CONSOLIDATED.md`
- inspecionar `src/App.jsx` e as 4 views principais
- iniciar por foundation + shell
- só então migrar `Hoje`

---

## 31. Definição de Sucesso

O sucesso desta iniciativa será percebido quando:

- Dona Maria sentir que o app está mais simples e mais claro
- Carlos sentir que o app está mais poderoso e melhor organizado
- a marca parecer mais premium, clínica e humana
- a experiência deixar de parecer um conjunto de telas e passar a parecer um produto desenhado com intenção

---

## 32. Resumo Executivo para Agentes

Se você for o próximo agente executando este redesign, trate esta iniciativa como:

- **uma evolução de produto**, não apenas de CSS
- **uma consolidação de sistema**, não apenas de páginas
- **uma tradução da visão clínica para interface**, não uma cópia de mock

Comece pelo alicerce. Depois shell. Depois Hoje. Depois Tratamento. Depois Estoque. Depois Perfil.  
Sempre preserve o que já funciona semanticamente.  
Sempre substitua o que ainda prende a app ao visual legado.

