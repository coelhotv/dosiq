# 📋 Product Requirements Document (PRD) Expandido
## Meus Remédios - Evolução Zero Cost MVP

**Versão:** 2.0  
**Data:** 04/02/2026  
**Status:** Expandido com novas propostas validadas  
**Baseado em:** PRD_MEUS_REMEDIOS.md v1.1 + Roadmap Zero Cost MVP

---

## 1. Metadados e Contexto

### 1.1 Status de Implementação (Atualizado em 04/02/2026)

Este PRD expande o documento original incorporando propostas de:
- [`roadmap-kimi.md`](plans/roadmap-kimi.md) - UX/UI redesign
- [`spec_redesign-ux.md`](plans/spec_redesign-ux.md) - Especificações técnicas UX
- [`ROADMAP_ZERO_COST_MVP.md`](plans/ROADMAP_ZERO_COST_MVP.md) - Análise de viabilidade
- [`ONDA_2_FEEDBACK_DESENVOLVIMENTO.md`](plans/ONDA_2_FEEDBACK_DESENVOLVIMENTO.md) - Resultados Wave 2

**Baseado em auditoria de `docs/past_deliveries`:**

#### ✅ Funcionalidades ENTREGUES (Wave 1 - v2.3.0, 03/02/2026):
| Tarefa | PR | Métricas |
|--------|-----|----------|
| Validação Zod | #5 | 23 schemas, mensagens pt-BR |
| Testes unitários | #6 | ~75% cobertura, 110+ testes |
| Sessões bot persistentes | #7 | TTL 30min, persistência Supabase |
| View stock summary | #8 | 5x mais rápido (15ms → 3ms) |
| Cache SWR | #9 | 95% melhoria performance (800ms → 50-100ms) |
| Onboarding wizard | #10 | 4 passos, configuração Telegram 15% → 65% |

#### ✅ Funcionalidades ENTREGUES (Wave 2 - v2.4.0, 04/02/2026):
| Tarefa | PR | Componentes/Serviços Criados |
|--------|-----|------------------------------|
| Confirmação ao Pular Dose | #13 | Handlers confirmar/cancelar/timeout, inline keyboard |
| Notificações Ricas Bot | #14 | MarkdownV2, `escapeMarkdown()`, emojis nos botões |
| Score de Adesão + Widget | #15 | `AdherenceWidget`, `AdherenceProgress`, `StreakBadge`, `adherenceService.js` |
| Timeline de Titulação | #16 | `TitrationTimeline`, `TitrationStep`, modo compacto/expandido |
| Widgets de Engajamento Dashboard | #17 | `DashboardWidgets`, `QuickActionsWidget`, `StockAlertsWidget` |

**Resumo Wave 2:**
- **5 tarefas entregues** de 6 planejadas (**83% concluído**)
- **~2.800 linhas** de código adicionadas
- **~40 arquivos** criados/modificados
- **110+ testes** passando (100%)
- **0 lint errors**, build sem erros

#### 🔴 Funcionalidade ON-HOLD (Wave 2):
| Tarefa | Motivo | Condição Retomada |
|--------|--------|-------------------|
| Chatbot IA (Groq) | Manter custo zero | Funding disponível (R$ 1-15/mês) ou monetização comprovada |

#### ✅ Problemas Resolvidos:
- ~~Duplicação de Widgets de Adesão~~ → **RESOLVIDO** na v2.4.1 (unificação completa)
- Organização de responsabilidades no bot (`tasks.js` centralizou formatação)

#### ⚠️ Problemas Menores Identificados:
- **Inconsistências Schema/Banco**: Campos existem no banco mas não nos schemas Zod (impacto baixo - não afeta formulários atuais)

### 1.2 Restrições de Custo Mantidas

- **Custo operacional:** R$ 0 durante validação MVP
- **Gatilho para upgrade:** 100 usuários ativos OU R$ 500/mês em receita
- **Stack:** Supabase Free, Vercel Hobby, Groq Free Tier

---

## 2. Novas Funcionalidades Validadas

### 2.1 UX/UI Avançado (da spec_redesign-ux.md)

#### Feature 2.1.1: Smart Header Contextual

**Descrição:** Header adaptativo que muda mensagem e cor conforme horário do dia e próximo medicamento.

**Regras de Negócio:**
| Horário | Mensagem | Cor |
|---------|----------|-----|
| 06h-11h59 | "Hora do [Medicamento] Matinal" | Tons quentes (âmbar) |
| 12h-17h59 | "Hora do [Medicamento] Vespertino" | Tons neutros |
| 18h-21h59 | "Hora do [Medicamento] Noturno" | Tons frios (azul) |
| 22h-05h59 | "Lembrete Noturno" | Roxo escuro + vibrar only |

**Interações:**
- Tap: Expandir timeline das próximas 4 doses
- Long Press: Modo "soneca" - adiar todas doses em 30min

**Critérios de Aceitação:**
- [ ] Header atualiza automaticamente conforme hora
- [ ] Timeline expansível funciona em mobile
- [ ] Modo noturno não emite som (apenas vibração)

**Custo:** R$ 0 (cálculo client-side)

---

#### Feature 2.1.2: Swipe-to-Take

**Descrição:** Padrão de confirmação de dose por gesto de swipe horizontal.

**Especificações Técnicas:**
- Gesto mínimo: 80px horizontal
- Feedback tátil: Vibration API (200ms light, 100ms pause, 200ms heavy)
- Estados visuais:
  - `Idle:` Card branco, seta cinza indicando direção
  - `Dragging:` Background verde gradiente (#34C759 → #30D158) revelando ícone ✓
  - `Confirmed:` Card collapse com animação de "sumir"
  - `Undo:` Snackbar com 5s janela para desfazer

**Acessibilidade:**
- Alternativa: Botão "Tomei" explícito para mobilidade reduzida
- VoiceOver: "Deslize para direita com dois dedos para confirmar"

**Fallback:** Gestos desabilitados em desktop (mantém botão)

**Critérios de Aceitação:**
- [ ] Swipe funciona em touch devices
- [ ] Feedback tátil presente
- [ ] Undo funciona dentro de 5s
- [ ] Alternativa de botão sempre disponível

**Custo:** R$ 0 (APIs nativas)

---

#### Feature 2.1.3: Sparkline de Adesão Semanal

**Descrição:** Gráfico minimalista de tendência de adesão nos últimos 7 dias.

**Visualização:**
```
Seg Ter Qua Qui Sex Sab Dom
███░ ████ ███░ ████ ░░░░ ░░░ ░░░
 75%  100%  75%  100%  0%   -   -
```

**Implementação:** SVG inline com CSS
- Altura: 24px
- Largura: 100% do container
- Cores: Verde (#34C759) para ≥80%, Âmbar (#FF9500) para 50-79%, Vermelho (#FF3B30) para <50%

**Interação:** Tap para expandir relatório detalhado

**Critérios de Aceitação:**
- [ ] Sparkline renderiza corretamente em mobile
- [ ] Cores semânticas aplicadas
- [ ] Clique leva a relatório detalhado

**Custo:** R$ 0 (SVG + CSS)

---

#### Feature 2.1.4: Micro-interações e Feedback Imediato

**Animações Implementadas:**

| Evento | Animação | Tecnologia |
|--------|----------|------------|
| Dose confirmada | Confete (partículas sutis) | Canvas 2D ou CSS |
| Streak atingido | Pulso no badge | CSS animation |
| Estoque crítico | Shake no card | CSS keyframes |
| Sync completo | Check fade in | CSS transition |
| Pull to refresh | Spinner customizado | CSS |

**Confete Specification:**
- 15-20 partículas
- Cores: verde primário + variações
- Duração: 1s
- Trigger: Ao completar 100% das doses do dia

**Critérios de Aceitação:**
- [ ] Animações rodam a 60fps
- [ ] Respeitam `prefers-reduced-motion`
- [ ] Não bloqueiam interação

**Custo:** R$ 0 (CSS/Canvas)

---

#### Feature 2.1.5: Sistema de Cores Dinâmico

**Paleta Semântica:**

| Contexto | Cor | Hex | Uso |
|----------|-----|-----|-----|
| Sucesso | Verde | #34C759 | Doses tomadas, streaks |
| Urgência Leve | Âmbar | #FF9500 | Próxima dose <1h |
| Crítico | Vermelho | #FF3B30 | Atrasado, estoque zerado |
| Informativo | Azul | #007AFF | Insights, navegação |
| Neutro | Cinza | #8E8E93 | Textos secundários |
| Fundo | Preto | #0A0A0F | Background dark mode |
| Card | Cinza Escuro | #1C1C24 | Superfícies elevadas |

**Adaptação Contextual:**
- Header muda conforme período do dia
- Cards de medicamento mudam conforme proximidade da dose
- Alertas seguem hierarquia de prioridade

**Critérios de Aceitação:**
- [ ] Cores consistentes em toda aplicação
- [ ] Contraste mínimo 4.5:1 (WCAG AA)
- [ ] Transições suaves entre estados

**Custo:** R$ 0 (CSS variables)

---

### 2.2 Engajamento e Gamificação (do roadmap-kimi.md)

#### Feature 2.2.1: Sistema de Streaks

**Descrição:** Contador de dias consecutivos com 100% de adesão.

**Regras:**
- Streak incrementa quando >80% das doses do dia são registradas
- Streak quebra quando +20% das doses do dia são perdidas (não registradas no dia)
- Streak pausa em pausa de protocolo

**Visualização:**
```
🔥 12 dias seguidos
🏆 Recorde: 45 dias
```

**Milestones:**
- 7 dias: Badge bronze
- 30 dias: Badge prata  
- 90 dias: Badge ouro
- 180 dias: Badge diamante

**Notificações:**
- Telegram: "🔥 Streak de 7 dias! Você está arrasando!"
- Dia de risco de quebra: "⚠️ Falta 1 dose para manter seu streak de 12 dias!"

**Critérios de Aceitação:**
- [ ] Streak calculado corretamente
- [ ] Quebra identificada no dia seguinte
- [ ] Badges exibidos corretamente
- [ ] Notificações enviadas via Telegram

**Custo:** R$ 0 (cálculo client-side + notificação Telegram existente)

---

#### Feature 2.2.2: Celebrações de Milestone

**Descrição:** Feedback positivo ao atingir marcos de adesão.

**Triggers:**
- 7 dias: "Uma semana perfeita! 🎉"
- 30 dias: "Um mês impecável! Você é um exemplo! 🏆"
- 90 dias: "Trimestre de excelência! Incrível! 💎"
- 100% doses em dia: "Dia perfeito! Todas as doses registradas! ✅"

**Formato:** Modal não-bloqueante + confete + opcional share

**Critérios de Aceitação:**
- [ ] Celebracões aparecem no momento correto
- [ ] Não bloqueiam uso do app
- [ ] Podem ser dispensadas

**Custo:** R$ 0

---

#### Feature 2.2.3: Health Rituals (Rituais de Ancoragem)

**Descrição:** Sugestão de associação entre medicação e hábitos existentes.

**Implementação:**
- Campo opcional no protocolo: "Associar a:" (ex: café da manhã, escovar dentes)
- Notificações enriquecidas: "💊 Losartana + ☕ Café da manhã"
- Insights: "Você tem 40% melhor adesão quando associa ao café da manhã"

**Heurística de Sugestão:**
- Analisar horários de sucesso (>80% adesão)
- Sugerir associação baseada no padrão

**Critérios de Aceitação:**
- [ ] Campo opcional adicionado ao protocolo
- [ ] Notificações incluem associação
- [ ] Insights calculados corretamente

**Custo:** R$ 0 (análise local simples)

---

### 2.3 Chatbot IA Otimizado

#### Feature 2.3.1: Chatbot com Groq (Free Tier)

**Descrição:** Assistente IA para dúvidas sobre medicamentos usando Groq API.

**Limites do Free Tier:**
- 1 milhão de tokens/mês
- Modelo: llama3-70b-8192
- Rate limit: 20 requests/minuto

**Estratégia de Uso:**
```
Usuário → /pergunta → Cache local? 
  ├── Sim → Retorna cache (0 tokens)
  └── Não → Groq API → Cache resposta
```

**Controles:**
- Rate limit por usuário: 10 perguntas/dia
- Cache por 7 dias para perguntas similares
- Disclaimer médico obrigatório em todas as respostas

**Prompt Template:**
```
Você é um assistente informativo sobre medicamentos.
Medicamentos do usuário: {lista}
Contexto: {histórico doses recentes}

Pergunta: {pergunta}

Regras:
1. Responda apenas sobre medicamentos listados ou interações conhecidas
2. NUNCA forneça diagnósticos médicos
3. Sempre recomende consultar médico para decisões importantes
4. Seja conciso (máx 3 parágrafos)
5. Linguagem acessível, não técnica excessiva

Resposta: ___

⚠️ Este é um assistente informativo. Consulte sempre seu médico.
```

**Fallback:** Se Groq exceder limites, usar Together AI (também gratuito)

**Critérios de Aceitação:**
- [ ] Respostas em < 5 segundos
- [ ] Disclaimer presente em 100% das respostas
- [ ] Rate limit funcionando
- [ ] Cache evita chamadas desnecessárias

**Custo:** R$ 0 (dentro dos limites free)

---

### 2.4 Funcionalidades de Retenção

#### Feature 2.4.1: PWA Completo

**Descrição:** Progressive Web App instalável com experiência nativa-like.

**Recursos:**
- Manifest.json completo
- Service Worker para cache offline
- Instalação via navegador (Add to Home Screen)
- Ícone customizado
- Splash screen
- Orientação portrait (mobile)

**Modo Offline:**
- Cache de doses pendentes
- Sync quando online
- Visualização de histórico (readonly)
- Não permite cadastro/edit offline

**Critérios de Aceitação:**
- [ ] Instalável em Android e iOS
- [ ] Funciona offline para consultas
- [ ] Sync automático quando online
- [ ] Ícone e splash screen corretos

**Custo:** R$ 0 (Web APIs nativas)

---

#### Feature 2.4.2: Relatórios PDF Avançados

**Descrição:** Exportação de relatórios clínicos em PDF.

**Seções:**
1. Capa: Logo, nome usuário, período
2. Resumo: Score adesão, streak atual, medicamentos ativos
3. Adesão Detalhada: Heatmap calendário por medicamento
4. Estoque: Status atual, previsão de término
5. Titulação: Progresso em protocolos de ajuste

**Design:**
- Template profissional
- Cores semânticas
- Gráficos simples (barras) com jsPDF

**Critérios de Aceitação:**
- [ ] PDF gerado em < 3s
- [ ] Design profissional e legível
- [ ] Todos os dados corretos
- [ ] Compartilhável (download)

**Custo:** R$ 0 (jsPDF client-side)

---

## 3. Funcionalidades De Expansão (Pós-Validação)

### 3.1 Modo Cuidador

**Descrição:** Acesso read-only para familiares/cuidadores acompanharem adesão.

**Gatilho para Implementação:**
- 20% dos usuários ativos são cuidados por terceiros
- OU solicitação explícita de 10+ usuários

**Escopo Futuro:**
- Convite por código QR
- Dashboard simplificado (traffic light)
- Notificações de dose esquecida
- Revogação instantânea

**Custo Futuro:** R$ 0 (Supabase continua gratuito)

---

### 3.2 Integrações Apple/Google Health

**Descrição:** Sincronização com Apple HealthKit e Google Fit.

**Gatilho:**
- 50+ usuários iOS solicitando
- Receita >R$ 1000/mês (justifica Apple Developer R$ 400/ano)

**Escopo Futuro:**
- Exportar doses tomadas
- Ler dados de saúde relevantes (opcional)
- Widgets nativos

**Custo Futuro:** R$ 400/ano (Apple) + $25 único (Google)

---

### 3.3 Smart Suggestions ML Avançado

**Descrição:** Sugestões proativas baseadas em padrões de comportamento.

**Gatilho:**
- 100+ usuários ativos
- Dados suficientes para análise significativa

**Escopo Atual (Simplificado):**
- Regras heurísticas simples
- "Você costuma esquecer aos sábados"
- Baseado em análise local de histórico

**Escopo Futuro:**
- ML server-side para predições
- Sugestões personalizadas de horários
- Alertas preditivos

---

## 4. Checklist de Implementação

### 4.1 Prioridade de Implementação (Atualizado pós-Wave 2)

```
✅ FASE 1 - Fundação (Concluída v2.3.0)
├── ✅ Validação Zod
├── ✅ Testes (~75% cobertura)
├── ✅ Sessões Bot persistentes
├── ✅ Cache SWR
├── ✅ Onboarding Wizard
└── ✅ View Stock Summary

✅ FASE 2 - Inteligência (Concluída v2.4.0)
├── ✅ Score de Adesão + Widget (PR #15)
├── ✅ Timeline Titulação (PR #16)
├── ✅ Widgets Dashboard (PR #17)
├── ✅ Confirmação ao Pular Dose (PR #13)
├── ✅ Notificações Ricas Bot (PR #14)
└── ⏸️ Chatbot IA (ON-HOLD - aguardando funding)

🚀 FASE 2.5 - UX Avançada (Semanas 9-10) - PRÓXIMA
├── P0 (Crítico)
│   ├── Swipe-to-Take (diferenciador mobile)
│   └── Smart Header Contextual (engajamento temporal)
└── P1 (Alto)
    ├── Sistema de Cores Dinâmico
    └── Micro-interações (confete, shake, pulse)

📊 FASE 3 - Validação de Retenção (Semanas 11-16)
├── P0 (Crítico)
│   ├── Streaks/Gamificação (retenção emocional)
│   └── PWA Básico (instalação mobile)
├── P1 (Alto)
│   ├── Relatórios PDF (valor médico)
│   ├── Sparkline Semanal (tendência visual)
│   └── Health Rituals (ancoragem hábitos)
└── P2 (Médio)
    └── Modo Cuidador (expansão use case)
```

### 4.2 Dependências Técnicas (Atualizado pós-Wave 2)

| Feature | Status | Dependências | Bloqueio |
|---------|--------|--------------|----------|
| Score Adesão | ✅ **ENTREGUE** | Logs de doses | Cache SWR, Testes unitários |
| Timeline Titulação | ✅ **ENTREGUE** | Dados de protocolos | Validação Zod |
| Widgets Dashboard | ✅ **ENTREGUE** | Score + Estoque | View Stock Summary |
| Confirmação Skip | ✅ **ENTREGUE** | State management | Sessões bot persistentes |
| Notificações Ricas | ✅ **ENTREGUE** | Formatação mensagens | MarkdownV2 implementado |
| Smart Header | 🟡 **PENDENTE** | Dados de protocolos | Cache SWR (✅ disponível) |
| Swipe-to-Take | 🟡 **PENDENTE** | Componente dose card | Onboarding completo (✅) |
| Streaks | 🟡 **PENDENTE** | Score adesão | Score implementado (✅) |
| Chatbot IA | ⏸️ **ON-HOLD** | Endpoint Vercel | Funding (R$ 1-15/mês) |
| PDF | 🟡 **PENDENTE** | jsPDF | Score + histórico (✅ disponível) |
| PWA | 🟡 **PENDENTE** | Vite PWA plugin | Fase 1 completa (✅) |

**Nota:** Features marcadas como "PENDENTE" têm todas as dependências satisfeitas e estão prontas para desenvolvimento.

### 4.3 Testes Específicos

#### ✅ Testes Entregues (Wave 2)
| Feature | Tipo de Teste | Critério | Status |
|---------|--------------|----------|--------|
| Score Adesão | Unit + Integration | Cálculo correto 7d/30d/90d | ✅ 110+ testes passando |
| Timeline Titulação | Unit + Visual | Renderização etapas correta | ✅ Testado em PR #16 |
| Widgets Dashboard | Integration | Layout grid responsivo | ✅ Testado em PR #17 |
| Confirmação Skip | E2E Bot | Timeout 30s, handlers | ✅ Testado em PR #13 |
| Notificações Ricas | Unit | Escape MarkdownV2 correto | ✅ Testado em PR #14 |

#### 🟡 Testes Pendentes (Próximas Fases)
| Feature | Tipo de Teste | Critério | Prioridade |
|---------|--------------|----------|------------|
| Swipe-to-Take | E2E mobile | 95% sucesso em gestos | 🔴 Crítica |
| Smart Header | Unit | Cores corretas por hora | 🔴 Crítica |
| Sparkline | Visual | Renderização correta em viewport 320px+ | 🟠 Alta |
| Chatbot IA | Integration | < 5s resposta | ⏸️ ON-HOLD |
| Streaks | Unit | Cálculo correto edge cases | 🔴 Crítica |
| PWA | E2E | Instalação em Android/iOS | 🔴 Crítica |
| PDF | Visual | Geração em < 3s | 🟠 Alta |

---

## 5. Métricas de Validação das Novas Features

### 5.1 KPIs por Feature

| Feature | Métrica | Meta | Ferramenta |
|---------|---------|------|------------|
| Smart Header | Tempo para ação | < 3s | Analytics local |
| Swipe-to-Take | Taxa de uso | > 40% | Event tracking |
| Swipe-to-Take | Taxa erro | < 5% | Event tracking |
| Score Adesão | Usuários com score | 100% | DB query |
| Chatbot IA | Perguntas/dia | > 2/user | DB query |
| Chatbot IA | Satisfação | > 70% positiva | Feedback opcional |
| Streaks | Streak médio | > 3 dias | Analytics |
| PWA | Instalações | > 30% mobile | PWA events |
| PDF | Downloads/semana | > 20% users | Event tracking |

### 5.2 Thresholds de Decisão

| Cenário | Threshold | Decisão |
|---------|-----------|---------|
| Swipe não adotado | < 20% uso | Manter apenas botão |
| Chatbot não usado | < 10% users | Reduzir prioridade |
| Streaks funcionando | > 3 dias média | Investir em gamificação |
| PWA popular | > 50% instalação | Priorizar push notifications |
| PDF popular | > 30% downloads | Adicionar compartilhamento |

---

## 6. Considerações Finais

### 6.1 Princípios Mantidos

1. **Zero Cost:** Todas as features deste PRD são viáveis sem custo operacional
2. **Client-Side First:** Processamento local sempre que possível
3. **Fallbacks:** Alternativas gratuitas para todos os serviços externos
4. **Validação:** Métricas claras antes de avançar para fases pagas

### 6.2 Diferença do PRD Original

| Aspecto | PRD Original | Este PRD Expandido |
|---------|-------------|-------------------|
| Funcionalidades | 18 tarefas base | 18 tarefas + 8 novas UX |
| UX Avançado | Básico | Swipe, sparklines, animações |
| Engajamento | Score apenas | Streaks, rituais, celebrações |
| IA | Planejado | Especificado (Groq) |
| Retenção | PDF, PWA | PDF enriquecido, PWA completo |

### 6.3 Próximos Passos

1. Revisão deste PRD com stakeholders
2. Criação de protótipos Figma para features UX
3. Definição de branch para Fase 2
4. Implementação priorizada por P0, P1, P2

---

**Documento expandido por:** Architect Mode  
**Data:** 04/02/2026  
**Status:** Pronto para revisão
