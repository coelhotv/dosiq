# Product Strategy

> Documento-base para orientar a evolução visual, narrativa e interativa dos protótipos em `public/new_landing/new-designs`.
> Esta estratégia consolida os padrões observados nos fluxos `simple` e `complex`, nos exports desktop/mobile, em [REFERENCE.md](/Users/coelhotv/git-icloud/meus-remedios/public/new_landing/new-designs/REFERENCE.md) e em [DESIGN-SYSTEM.md](/Users/coelhotv/git-icloud/meus-remedios/public/new_landing/new-designs/DESIGN-SYSTEM.md).
>
> Objetivo: preservar a clareza para usuários com baixa tolerância a ruído visual, sem abrir mão de sofisticação editorial, confiança clínica e sensação de cuidado premium.

---

## Visual Thesis

**Uma frase:** um santuário terapêutico brasileiro: calmo, editorial e legível, onde dados clínicos sensíveis aparecem com contraste suave, hierarquia clara e calor humano suficiente para reduzir ansiedade sem parecer infantil.

**Leitura consolidada dos protótipos:**
- A direção mais forte não é “app médico tradicional”, e sim “serviço de cuidado confiável”.
- O valor visual vem de superfícies tonais, tipografia grande, branco respirando e acentos clínicos precisos.
- O melhor material evita densidade hospitalar e também evita estética wellness genérica.
- `simple` privilegia acolhimento, foco em uma tarefa e leitura imediata.
- `complex` privilegia coordenação de protocolos, triagem e priorização sem perder serenidade.

---

## Content Plan Template

Esta é a espinha dorsal para páginas, views e novos protótipos do ecossistema.

| Section | Purpose | What Goes Here | Guidance |
|---------|---------|---|---|
| **Hero / Header Operacional** | Orientar | Nome da área, estado do dia, prioridade principal | Em produto, substitui hero de marketing por contexto acionável |
| **Support** | Provar | Próxima dose, adesão, item crítico, protocolo ativo | Um bloco dominante por vez |
| **Detail** | Aprofundar | Timeline, lista de tratamentos, estoque, notas clínicas, histórico | Informação estruturada por scanning, não por ornamentação |
| **Final CTA / Persistent Action** | Converter em ação | Registrar dose, repor estoque, adicionar medicamento, exportar | CTA único e inequívoco, fixo ou repetido em pontos de decisão |

**Template operacional:**
- **Hero / Header:** nome do produto ou da área + contexto temporal + estado principal do usuário.
- **Support:** um único insight dominante, como “próxima dose”, “aderência do dia” ou “reposição crítica”.
- **Detail:** visão expandida para decisão, com listas, progressos, agrupamentos por período ou categoria clínica.
- **Final CTA:** ação principal ligada ao estado da tela, nunca um conjunto de CTAs equivalentes competindo.

---

## Motion Language

Definir e repetir poucos padrões. A linguagem observada já aponta para transições curtas, feedbacks calmos e progressões que reforçam confiança.

**1. Soft Arrival**
- Entrada padrão de telas e blocos com `opacity` + leve `translateY` ou `translateX`.
- Duração: `180ms–320ms`.
- Easing: `easeOut`.
- Uso: carregamento de view, cards de lista, blocos de resumo.
- Sensação: conteúdo chega pronto, sem teatralidade.

**2. Therapeutic Fill**
- Animações de progresso para anéis, barras e métricas.
- Duração: `600ms–1200ms`, com atraso curto quando em sequência.
- Uso: adesão, estoque, evolução semanal, titulação.
- Sensação: progresso clínico tangível, não gamificação infantil.

**3. Calm Emphasis**
- Hover/press de CTAs com `scale(1.01-1.03)`, sombra suave e pequena mudança tonal.
- Duração: `100ms–180ms`.
- Uso: botões principais, cards clicáveis, FABs.
- Sensação: ação confirmada com tato visual.

**4. Guided Transition**
- Mudança de tabs, filtros e estados com transição curta de opacidade e realocação suave.
- Duração: `150ms–220ms`.
- Uso: Ativos/Pausados/Finalizados, troca de períodos, alternância entre painéis.
- Sensação: continuidade cognitiva.

**Notas de performance**
- Animar apenas `transform` e `opacity`.
- Evitar scroll effects cenográficos; este produto é prioritariamente operacional.
- Respeitar `prefers-reduced-motion` com versões estáticas para progresso e entradas.

---

## Color System

O sistema existente é forte e deve ser formalizado como arquitetura tonal, não apenas lista de hex.

**Primary Colors**
- **Accent:** `#006a5e`
  - Verde Saúde. A cor de confiança, confirmação e ação principal.
- **Background:** `#f8fafb`
  - Branco clínico suavizado. Nunca usar branco puro como plano dominante geral.
- **Surface:** `#ffffff`
  - Área ativa e conteúdo de maior prioridade.
- **Text/Primary:** `#191c1d`
  - Quase-preto editorial. Mais sofisticado e menos agressivo que `#000000`.
- **Text/Muted:** `#3e4946`
  - Legibilidade alta para subtítulos, meta-informação e contexto.
- **Border / Outline:** `#bdc9c5`
  - Usar apenas quando necessário; a regra principal continua sendo separação por tom.

**Semantic Colors**
- **Success:** `#006a5e` com apoio de `#90f4e3`
- **Warning:** `#7b5700` com apoio de `#ffdea8`
- **Error:** `#ba1a1a`
- **Info:** `#005db6`

**Tonal Architecture**
- **Level 0:** `#f8fafb` para fundo-base.
- **Level 1:** `#f2f4f5` para seções e agrupamentos.
- **Level 2:** `#ffffff` para conteúdo interativo e foco principal.
- **Glass surfaces:** usar base clara com opacidade alta e blur discreto somente em navegação flutuante ou ações persistentes.

**Regras**
- Um único acento dominante por tela: verde.
- Azul entra como cor clínica de suporte, não como concorrente do CTA.
- Amarelo/âmbar sinaliza atenção moderada, nunca vira cor de interface estrutural.
- Vermelho só aparece em criticidade, nunca em volume decorativo.

---

## Typography System

O produto já encontrou uma combinação correta: autoridade editorial + leitura confortável para público maduro.

**Display Font**
- Font name: `Public Sans`
- Usage: títulos de área, métricas centrais, nomes de marcos clínicos, cabeçalhos principais
- Weight preferences: `700–900`
- Why this font: transmite autoridade limpa, sem frieza corporativa

**Body Font**
- Font name: `Lexend`
- Usage: corpo de texto, labels, instruções, nomes de medicamentos, navegação
- Weight preferences: `400–600`
- Why this font: excelente legibilidade e ritmo visual confortável para leitura frequente

**Monospace / Data Accent**
- Font name: `não obrigatório`
- Uso preferencial: dispensado, a menos que haja IDs, logs ou exportações técnicas
- Observação: em produto de saúde para público amplo, o sistema deve evitar aparência excessivamente técnica

**Type Scale**
```text
Display hero / area title: clamp(40px, 5vw, 56px) / 1.05
Section title: 28px / 1.15
Panel title: 22px / 1.2
Primary body: 17px / 1.55
Secondary body: 15px / 1.5
Meta labels: 12px / 1.35
Micro labels: 10px / 1.3 with wide tracking
```

**Rules**
- Nunca usar peso abaixo de `400`.
- Nomes de medicamentos e ações principais devem aparecer maiores do que metadados de dose/horário.
- Uppercase com tracking amplo fica restrito a meta-labels e status curtos.

---

## Imagery Charter

Este produto é predominantemente de interface, então a “imagem” principal é o próprio sistema. Quando houver imagem externa, ela precisa reforçar cuidado real e confiança, não distração.

**Style & Tone**
- Base principal: screenshots do produto, ilustração funcional discreta e iconografia clínica clara.
- Tom geral: calmo, limpo, confiável, humano.
- Narrativa: “cuidado organizado”, não “tecnologia futurista”.

**Aspect Ratios & Sizing**
- Desktop overview / hero product shots: `16:10` ou `16:9`
- Mobile mockups: `9:19` ou equivalente vertical realista
- Feature crops: `4:3`
- Icon tiles / functional previews: `1:1`

**Text Overlay Rules**
- Evitar texto sobre screenshots complexos.
- Quando necessário, reservar faixa tonal calma ou usar fundo sólido/scrim.
- Contraste mínimo WCAG AA em qualquer estado.

**Sourcing & Visual Assets**
- Fonte primária: capturas do produto, diagramas do sistema visual, iconografia Material Symbols ou equivalente simples.
- Não usar fotos stock aspiracionais como protagonista da navegação do app.
- Se houver campanhas ou landing pages, usar imagem humana real com luz suave e contexto doméstico/clínico brasileiro.

**Performance**
- Exports em WebP sempre que possível.
- Hero/screenshot principal: meta de até `100KB`.
- Demais imagens: meta de até `50KB`.
- Lazy-load abaixo da dobra.

---

## Copy Tone & Voice

**Voice Characteristics**
- Direta, acolhedora e clínica.
- Segurança sem alarmismo.
- Clareza operacional antes de persuasão.

**Formality**
- Equilibrada. Nem burocrática, nem casual demais.

**Perspective**
- Priorizar “você” e linguagem de orientação prática.
- O produto fala como assistente de cuidado, não como plataforma vendendo a si mesma.

**Product Language Examples**
```text
Em vez de:                       Use:
--------------------------------------------------------------
"Otimização terapêutica"         "Seu tratamento em dia"
"Solução inovadora de adesão"    "Registre suas doses sem esquecer"
"Gestão farmacológica avançada"  "Controle seus medicamentos"
"Experiência premium de saúde"   "Mais clareza para cuidar da sua saúde"
```

**Forbidden Words/Phrases**
- ❌ “disruptivo”, “revolucionário”, “next-gen”, “plataforma”
- ❌ jargão técnico sem ganho cognitivo para o usuário
- ❌ humor, ironia ou exagero em alertas clínicos

**Preferred Terminology**
- Usar “medicamento” e “tratamento” como termos centrais
- Usar “dose” para ação diária
- Usar “repor estoque” em vez de “gerenciar inventário”
- Usar “histórico”, “próxima dose”, “aderência”, “alerta” e “resumo” como léxico-base

**Headline Guidance**
- Headline deve orientar, não impressionar.
- Em telas internas, o nome da área resolve mais do que slogans.
- Em superfícies críticas, a mensagem principal deve caber em uma leitura de 2–3 segundos.

---

## Accessibility Baseline

- Contraste AA mínimo em todos os textos e controles.
- Alvos interativos com `56px+` de altura nas ações principais e `44px+` nos demais controles.
- Navegação inteira disponível por teclado.
- Ícones nunca aparecem sozinhos quando carregam significado crítico.
- Estados de alerta precisam combinar cor + texto + forma, nunca cor sozinha.
- Progressos circulares e barras devem ter equivalente textual.
- Motion reduzida deve remover deslocamentos decorativos e manter apenas mudança de estado essencial.

**Litmus check**
- Se a cor sumir, o status ainda pode ser entendido?
- Se a animação sumir, a hierarquia ainda fica clara?
- Se o usuário tiver baixa visão ou tremor, a ação principal continua óbvia e confortável?

---

## Layout Principles

**1. Calm First View**
- O primeiro bloco da tela deve responder “o que importa agora?”.
- Em `simple`, isso vira próxima dose e progresso do dia.
- Em `complex`, isso vira triagem de protocolos, risco e exceções.

**2. One Dominant Idea Per Section**
- Cada seção precisa ter apenas uma função: orientar, priorizar, detalhar ou acionar.
- Misturar adesão, estoque, calendário e conselho de saúde no mesmo bloco enfraquece o produto.

**3. Cardless by Default, Carded by Necessity**
- Preferir planos tonais, listas estruturadas e spacing.
- Card entra quando o item precisa ser tocado, comparado ou isolado como unidade clínica.

**4. Senior-Friendly Scanning**
- Títulos fortes.
- Metadados em segunda linha.
- Agrupamento por período, categoria ou criticidade.
- Pouca dependência de ícones abstratos.

**5. Persistent Action Architecture**
- Toda tela importante merece um CTA dominante.
- Em mobile, FAB ou barra inferior só quando a ação for realmente recorrente.
- Em desktop, ação principal deve ficar visível sem competir com navegação.

---

## Product Modes

Os protótipos revelam dois modos complementares do mesmo produto. A estratégia deve tratá-los como presets de experiência, não produtos diferentes.

### Mode A: Guided Simplicity
- Público: pessoas que precisam de leitura rápida, rotina estável e baixa carga cognitiva.
- Características: menos elementos por tela, cards maiores, CTA imediato, timeline óbvia, menos filtros.
- Melhor referência: exports `simple-*`.

### Mode B: Clinical Coordination
- Público: usuários com múltiplos protocolos, titulação, estoque crítico e necessidade de visão cruzada.
- Características: densidade maior, agrupamento por categoria, métricas paralelas, notas clínicas, estado resumido.
- Melhor referência: exports `complex-*`.

**Decisão estratégica**
- A marca visual deve ser a mesma nos dois modos.
- O que muda é densidade informacional, não personalidade.

---

## Do's and Don'ts

**Do**
- Usar verde como fio condutor de confiança e ação.
- Tratar métricas de adesão e estoque como sinais de cuidado, não gamificação vazia.
- Manter muito espaço em branco e alinhamento firme.
- Escrever como produto de uso diário, não como campanha publicitária.
- Separar prioridades por tom de superfície antes de adicionar bordas.

**Don't**
- Não transformar a interface em grade genérica de cards SaaS.
- Não usar bordas de 1px como estrutura dominante.
- Não saturar a tela com azul, vermelho e amarelo simultaneamente.
- Não esconder significado crítico só em ícones.
- Não usar dashboards chamativos em áreas que deveriam transmitir serenidade.

---

## Litmus Checks

- A prioridade da tela está visível nos primeiros 3 segundos?
- O CTA principal é inequívoco?
- O layout continua claro sem sombras decorativas?
- A mesma tela funciona para alguém cansado, ansioso ou com leitura mais lenta?
- O produto parece cuidado de saúde confiável, e não software administrativo?
- A versão complexa continua serena mesmo com mais informação?
- A versão simples evita parecer simplória ou infantilizada?

---

## Recommended Next Step

Passar este documento para `ui-design-brain` antes de evoluir qualquer página definitiva. O próximo entregável ideal é uma série de `PAGE_STRATEGY.md` para:
- dashboard/hoje
- tratamentos
- estoque
- saúde & portabilidade
- perfil

Assim, a implementação pode preservar o mesmo sistema visual enquanto ajusta a densidade para cada fluxo.
