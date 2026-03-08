# PRD Fase 3: Experiencia Mobile Premium

**Versao:** 1.0  
**Status:** DRAFT  
**Data:** 08/02/2026  
**Fase do Roadmap:** 3 de 7  
**Baseline:** v2.5.0 (pos-Health Command Center)  
**Principio:** Custo operacional R$ 0  

---

## 1. Visao Geral e Objetivos Estrategicos

A Fase 3 transforma a experiencia mobile do Meus Remedios com interacoes nativas, gamificacao avancada e feedback visual que diferenciam o produto no mercado. O foco e elevar o engajamento e a retencao atraves de micro-interacoes, visualizacoes de tendencia e reforco emocional.

### Objetivos Estrategicos

| ID | Objetivo | Metrica Primaria |
|----|----------|-----------------|
| OE3.1 | Elevar engajamento diario com feedback visual imediato | Tempo para primeira acao < 3s |
| OE3.2 | Aumentar retencao via gamificacao (streaks, celebracoes) | Streak medio > 3 dias |
| OE3.3 | Melhorar acessibilidade e conforto visual | WCAG AA > 95% |
| OE3.4 | Fornecer visualizacao rapida de tendencia de adesao | Adocao sparkline > 30% sessoes |

### Pre-requisitos

- Wave 2 completa (Score de adesao, Cache SWR, AdherenceWidget)
- HCC implementado (HealthScoreCard, SwipeRegisterItem, SmartAlerts)
- Framer Motion 12 instalado e operacional
- adherenceService funcional com calculo por periodo

---

## 2. Escopo de Features

| ID | Feature | Prioridade | Story Points | Novas Dependencias |
|----|---------|------------|-------------|-------------------|
| F3.1 | Sparkline de Adesao Semanal | P0 | 3 | Nenhuma (SVG inline) |
| F3.2 | Micro-interacoes e Feedback Tatil | P1 | 5 | Nenhuma (Framer Motion) |
| F3.3 | Celebracoes de Milestone | P1 | 3 | Nenhuma (CSS + Framer Motion) |
| F3.4 | Empty States Ilustrados | P2 | 2 | Nenhuma (SVG inline) |
| F3.5 | Tema Claro/Escuro | P1 | 3 | Nenhuma (CSS custom properties) |
| F3.6 | Analytics Local (Privacy-First) | P1 | 3 | Nenhuma (localStorage) |

**Esforco Total:** 19 story points  
**Novas dependencias npm:** Nenhuma  

### Fora de Escopo

- Alteracoes no backend Supabase
- Novas rotas ou navegacao (Fase 4)
- Exportacao de dados (Fase 5)
- Qualquer feature com custo recorrente

---

## 3. Descricao Detalhada de Features

### F3.1 Sparkline de Adesao Semanal

**Titulo:** Grafico sparkline SVG inline mostrando adesao dos ultimos 7 dias  
**Rastreabilidade:** Roadmap 2026 - Fase 3, P03  

**Descricao:**  
Grafico SVG compacto (inline, sem biblioteca externa) exibido abaixo do HealthScoreCard, mostrando a tendencia de adesao dos ultimos 7 dias. Cada ponto representa o percentual de adesao do dia. Permite ao usuario identificar padroes de queda ou melhora sem navegar para telas de detalhe.

**Requisitos Tecnicos:**
- Componente `src/components/dashboard/SparklineAdesao.jsx`
- SVG inline com polyline, sem dependencia externa
- Dados consumidos do `adherenceService` via cache SWR existente
- Responsivo: largura 100% do container, altura fixa 40px
- Cores: linha segue o tema (primary), area preenchida com opacidade 0.1
- Tooltip opcional ao tocar em um ponto (dia + percentual)

**Criterios de Aceitacao:**
- [ ] Renderiza corretamente em viewports >= 320px
- [ ] Dados dos ultimos 7 dias exibidos com precisao
- [ ] Nao dispara chamadas adicionais ao Supabase (usa cache existente)
- [ ] Respeita `prefers-reduced-motion` (sem animacao de entrada se ativado)
- [ ] Performance: renderizacao < 16ms (60fps)

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-3.1.1 | Usuario | Abre dashboard -> ve sparkline abaixo do score -> identifica tendencia de queda nos ultimos 3 dias |
| UC-3.1.2 | Usuario | Toca em ponto do sparkline -> tooltip mostra "Ter 04/02: 85%" |
| UC-3.1.3 | Usuario novo | Abre dashboard sem dados suficientes -> sparkline exibe estado vazio com mensagem motivacional |

**Dependencias:** adherenceService, HealthScoreCard  
**Impacto Financeiro:** R$ 0  

---

### F3.2 Micro-interacoes e Feedback Tatil

**Titulo:** Animacoes de feedback para acoes do usuario (confete, pulse, shake)  
**Rastreabilidade:** Roadmap 2026 - Fase 3, P04  

**Descricao:**  
Sistema de micro-interacoes que fornece feedback visual e tatil imediato para acoes do usuario. Inclui: animacao de confete ao completar todas as doses do dia, pulse no HealthScoreCard ao registrar dose, shake em campos com erro de validacao, e feedback tatil (Vibration API) em acoes criticas.

**Requisitos Tecnicos:**
- Componente `src/components/ui/ConfettiAnimation.jsx` (CSS keyframes, sem canvas)
- Componente `src/components/ui/PulseEffect.jsx` (Framer Motion scale)
- Componente `src/components/ui/ShakeEffect.jsx` (Framer Motion x oscillation)
- Hook `src/hooks/useHapticFeedback.js` (Vibration API com fallback silencioso)
- Todas as animacoes devem usar `will-change` e rodar na GPU (transform/opacity)
- Respeitar `prefers-reduced-motion`: desabilitar animacoes, manter feedback funcional

**Criterios de Aceitacao:**
- [ ] Confete dispara ao atingir 100% de adesao no dia
- [ ] Pulse anima o HealthScoreCard ao registrar dose via swipe
- [ ] Shake anima campos com erro de validacao Zod
- [ ] Vibration API funciona em Android Chrome (fallback silencioso em iOS/desktop)
- [ ] Todas as animacoes rodam a 60fps (sem jank)
- [ ] `prefers-reduced-motion: reduce` desabilita animacoes visuais
- [ ] Nenhuma animacao bloqueia interacao do usuario

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-3.2.1 | Usuario | Registra ultima dose do dia via swipe -> confete aparece por 2s -> vibra brevemente (50ms) |
| UC-3.2.2 | Usuario | Registra dose -> HealthScoreCard pulsa suavemente indicando atualizacao |
| UC-3.2.3 | Usuario | Submete formulario com campo invalido -> campo treme (shake) -> mensagem de erro exibida |
| UC-3.2.4 | Usuario com reduced-motion | Registra ultima dose -> sem confete visual -> feedback tatil mantido |

**Dependencias:** Framer Motion 12, SwipeRegisterItem, HealthScoreCard  
**Impacto Financeiro:** R$ 0  

---

### F3.3 Celebracoes de Milestone

**Titulo:** Telas de celebracao para marcos de adesao (streaks, metas)  
**Rastreabilidade:** Roadmap 2026 - Fase 3, P07  

**Descricao:**  
Sistema de celebracoes visuais que reconhece marcos importantes do usuario: streaks de 3, 7, 14, 30 dias; primeira semana com 100% de adesao; primeiro mes completo. Exibe modal/overlay com animacao, mensagem motivacional e badge conquistado. Reforco emocional positivo para aumentar retencao.

**Requisitos Tecnicos:**
- Componente `src/components/gamification/MilestoneCelebration.jsx`
- Componente `src/components/gamification/BadgeDisplay.jsx`
- Service `src/services/milestoneService.js` (deteccao de milestones client-side)
- Persistencia de milestones alcancados em `localStorage` (evitar repeticao)
- Milestones definidos como constantes em `src/constants/milestones.js`
- Modal overlay com Framer Motion (AnimatePresence + motion.div)
- Badges como SVG inline (sem assets externos)

**Milestones Definidos:**

| Milestone | Gatilho | Badge | Mensagem |
|-----------|---------|-------|----------|
| Primeiro Registro | 1 dose registrada | Estrela Bronze | "Primeiro passo dado!" |
| Streak 3 dias | 3 dias consecutivos | Chama | "3 dias seguidos! Continue assim!" |
| Streak 7 dias | 7 dias consecutivos | Trofeu Prata | "Uma semana perfeita!" |
| Streak 14 dias | 14 dias consecutivos | Trofeu Ouro | "Duas semanas de dedicacao!" |
| Streak 30 dias | 30 dias consecutivos | Diamante | "Um mes completo! Incrivel!" |
| Semana 100% | 7 dias com 100% adesao | Coracao | "Semana perfeita de adesao!" |

**Criterios de Aceitacao:**
- [ ] Milestone detectado corretamente apos registro de dose
- [ ] Modal de celebracao exibido com animacao suave (300ms entrada, 200ms saida)
- [ ] Cada milestone exibido apenas uma vez (persistido em localStorage)
- [ ] Badge exibido no perfil/dashboard apos conquista
- [ ] Botao "Fechar" ou tap fora do modal para dispensar
- [ ] Respeita `prefers-reduced-motion`

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-3.3.1 | Usuario | Registra dose que completa streak de 7 dias -> modal celebracao aparece -> badge "Trofeu Prata" exibido -> usuario fecha modal -> badge visivel no dashboard |
| UC-3.3.2 | Usuario | Abre app apos conquistar milestone offline -> celebracao exibida na proxima sessao |
| UC-3.3.3 | Usuario | Ja conquistou streak 7 -> atinge novamente -> nao exibe celebracao repetida |

**Dependencias:** adherenceService (calculo de streaks), Framer Motion  
**Impacto Financeiro:** R$ 0  

---

### F3.4 Empty States Ilustrados

**Titulo:** Estados vazios com ilustracoes SVG e CTAs motivacionais  
**Rastreabilidade:** Roadmap 2026 - Fase 3, P17  

**Descricao:**  
Substituir estados vazios genericos por ilustracoes SVG inline com mensagens motivacionais e CTAs claros. Aplicavel a: dashboard sem medicamentos, historico sem registros, estoque vazio, e lista de protocolos vazia.

**Requisitos Tecnicos:**
- Componente `src/components/ui/EmptyState.jsx` (reutilizavel)
- Props: `illustration` (enum), `title`, `description`, `ctaLabel`, `ctaAction`
- Ilustracoes como componentes SVG inline em `src/components/ui/illustrations/`
- 4 ilustracoes: `NoPills`, `NoHistory`, `NoStock`, `NoProtocols`
- Estilo consistente com design system existente (cores do tema)

**Criterios de Aceitacao:**
- [ ] 4 empty states implementados (dashboard, historico, estoque, protocolos)
- [ ] Cada empty state tem ilustracao SVG, titulo, descricao e CTA
- [ ] CTA navega para acao relevante (ex: "Cadastrar medicamento")
- [ ] SVGs responsivos e acessiveis (role="img", aria-label)
- [ ] Tamanho total dos SVGs < 20KB

**Dependencias:** Nenhuma  
**Impacto Financeiro:** R$ 0  

---

### F3.5 Tema Claro/Escuro

**Titulo:** Suporte a tema claro e escuro com deteccao automatica de preferencia do sistema  
**Rastreabilidade:** Roadmap 2026 - Fase 3, N06  

**Descricao:**  
Implementar suporte a tema claro e escuro usando CSS custom properties. O tema padrao segue a preferencia do sistema operacional (`prefers-color-scheme`), com opcao de override manual pelo usuario. A preferencia do usuario e persistida em `localStorage`.

**Requisitos Tecnicos:**
- Definir tokens de cor em CSS custom properties (`:root` e `[data-theme="dark"]`)
- Hook `src/hooks/useTheme.js` (detecta preferencia do sistema, le/grava localStorage)
- Componente `src/components/ui/ThemeToggle.jsx` (botao de alternancia)
- Migrar cores hardcoded existentes para custom properties
- Transicao suave entre temas (200ms em background-color e color)
- Garantir contraste WCAG AA em ambos os temas

**Tokens de Cor:**

| Token | Claro | Escuro |
|-------|-------|--------|
| --bg-primary | #ffffff | #0a0a0f |
| --bg-secondary | #f5f5f7 | #1a1a2e |
| --bg-card | #ffffff | #16213e |
| --text-primary | #1a1a2e | #e8e8e8 |
| --text-secondary | #6b7280 | #9ca3af |
| --accent-primary | #6366f1 | #818cf8 |
| --accent-success | #10b981 | #34d399 |
| --accent-warning | #f59e0b | #fbbf24 |
| --accent-danger | #ef4444 | #f87171 |
| --border | #e5e7eb | #374151 |

**Criterios de Aceitacao:**
- [ ] Tema segue preferencia do sistema por padrao
- [ ] Usuario pode alternar manualmente via toggle
- [ ] Preferencia manual persistida em localStorage
- [ ] Transicao suave entre temas (sem flash)
- [ ] Contraste WCAG AA em ambos os temas (ratio >= 4.5:1 para texto)
- [ ] Todos os componentes existentes funcionam em ambos os temas
- [ ] HealthScoreCard SVG adapta cores ao tema

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-3.5.1 | Usuario com sistema escuro | Abre app pela primeira vez -> tema escuro aplicado automaticamente |
| UC-3.5.2 | Usuario | Clica no toggle de tema -> transicao suave para tema oposto -> preferencia salva |
| UC-3.5.3 | Usuario | Muda preferencia do sistema -> app atualiza em tempo real (se nao houver override manual) |

**Dependencias:** Nenhuma  
**Impacto Financeiro:** R$ 0  

---

### F3.6 Analytics Local (Privacy-First)

**Titulo:** Sistema de analytics local sem dependencia de terceiros  
**Rastreabilidade:** Roadmap 2026 - Fase 3, N04  

**Descricao:**  
Sistema leve de tracking de eventos armazenado em localStorage para medir adocao de features e comportamento do usuario sem enviar dados para servicos externos. Dados agregados podem ser consultados via console ou exportados manualmente. Serve como base para decisoes de produto nas fases seguintes.

**Requisitos Tecnicos:**
- Service `src/services/analyticsService.js`
- Metodos: `track(event, properties)`, `getEvents(filter)`, `getSummary()`, `clear()`
- Armazenamento em localStorage com chave `mr_analytics`
- Rotacao automatica: manter apenas ultimos 30 dias de eventos
- Tamanho maximo: 500KB (limpar eventos mais antigos se exceder)
- Eventos padrao: `page_view`, `dose_registered`, `swipe_used`, `theme_changed`, `milestone_achieved`, `sparkline_tapped`

**Criterios de Aceitacao:**
- [ ] Eventos registrados com timestamp, nome e propriedades
- [ ] Rotacao automatica de eventos > 30 dias
- [ ] Limite de 500KB respeitado com cleanup automatico
- [ ] Metodo `getSummary()` retorna contagens agregadas por evento
- [ ] Nenhum dado enviado para servicos externos
- [ ] Performance: `track()` executa em < 5ms

**Dependencias:** Nenhuma  
**Impacto Financeiro:** R$ 0  

---

## 4. Requisitos Nao-Funcionais

| Requisito | Especificacao | Metrica |
|-----------|--------------|---------|
| Performance | Todas as animacoes a 60fps | Frame time < 16ms |
| Performance | Renderizacao de sparkline | < 16ms |
| Acessibilidade | WCAG AA compliance | Contraste >= 4.5:1 |
| Acessibilidade | Suporte a prefers-reduced-motion | 100% das animacoes |
| Acessibilidade | SVGs com role="img" e aria-label | 100% dos SVGs |
| Responsividade | Funcional em viewports >= 320px | Todos os componentes |
| Bundle Size | Impacto maximo no bundle | < 15KB gzipped (total fase) |
| Privacidade | Nenhum dado enviado a terceiros | Zero requests externos |
| Compatibilidade | Chrome 90+, Safari 15+, Firefox 90+ | Testes manuais |

---

## 5. Plano de Testes

### 5.1 Testes Unitarios (Vitest)

| Componente | Cenarios |
|------------|----------|
| SparklineAdesao | Renderiza com dados, renderiza vazio, responsividade, reduced-motion |
| ConfettiAnimation | Dispara no gatilho, respeita reduced-motion, cleanup apos 2s |
| MilestoneCelebration | Detecta milestones, nao repete, persiste em localStorage |
| EmptyState | Renderiza com props, CTA funcional, acessibilidade SVG |
| useTheme | Detecta preferencia sistema, persiste override, transicao |
| analyticsService | Track evento, rotacao 30d, limite 500KB, getSummary |

### 5.2 Testes de Integracao

| Cenario | Validacao |
|---------|-----------|
| Registro de dose + confete | Swipe -> dose registrada -> confete dispara -> score atualiza |
| Milestone apos streak | 7 doses consecutivas -> modal celebracao -> badge persistido |
| Tema + componentes | Toggle tema -> todos os componentes adaptam cores |
| Analytics + acoes | Dose registrada -> evento tracked -> getSummary reflete |

### 5.3 Cobertura Alvo

| Metrica | Meta |
|---------|------|
| Cobertura de linhas | > 80% (novos componentes) |
| Cobertura de branches | > 75% |
| Testes de acessibilidade | 100% dos novos componentes |

---

## 6. Indicadores de Sucesso

| KPI | Baseline | Meta | Ferramenta |
|-----|----------|------|------------|
| Adocao sparkline | 0% | > 30% sessoes | Analytics local |
| Streak medio | N/A | > 3 dias | Query Supabase |
| Tempo para primeira acao | N/A | < 3s | Analytics local |
| Milestones conquistados | 0 | > 1 por usuario ativo | localStorage |
| Adocao tema escuro | 0% | > 20% usuarios | Analytics local |
| Cobertura de testes | ~75% | > 80% | Vitest coverage |
| Acessibilidade WCAG | ~90% | > 95% | Lighthouse |

---

## 7. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Animacoes causam jank em dispositivos low-end | Media | Alto | Usar transform/opacity apenas, testar em dispositivos reais, respeitar reduced-motion |
| localStorage cheio impede analytics | Baixa | Baixo | Limite de 500KB com cleanup automatico, fallback silencioso |
| Migracao de cores para custom properties quebra componentes | Media | Medio | Migracao incremental, testes visuais antes/depois |
| Confete/celebracoes percebidos como infantis | Baixa | Medio | Design sutil e elegante, opcao de desabilitar |

---

## 8. Cronograma de Implementacao

| Ordem | Feature | Dependencia | Story Points |
|-------|---------|-------------|-------------|
| 1 | F3.6 Analytics Local | Nenhuma | 3 |
| 2 | F3.5 Tema Claro/Escuro | Nenhuma | 3 |
| 3 | F3.1 Sparkline Adesao | adherenceService | 3 |
| 4 | F3.4 Empty States | Nenhuma | 2 |
| 5 | F3.2 Micro-interacoes | Framer Motion | 5 |
| 6 | F3.3 Celebracoes Milestone | F3.2, F3.6 | 3 |

---

## 9. Definicao de Pronto (DoD)

- [ ] Codigo implementado e revisado
- [ ] Testes unitarios passando com cobertura > 80%
- [ ] Testes de acessibilidade passando (axe-core)
- [ ] Funcional em Chrome, Safari e Firefox
- [ ] Responsivo em viewports >= 320px
- [ ] `prefers-reduced-motion` respeitado
- [ ] Sem regressao em funcionalidades existentes
- [ ] Analytics local tracking eventos da feature
- [ ] Bundle size delta < 15KB gzipped

---

*Documento elaborado em 08/02/2026*  
*Referencia: Roadmap 2026 v3.0 - Fase 3*  
*Proxima revisao: apos conclusao da Fase 3*
