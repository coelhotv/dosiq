
## 1. Cabeçalho e Metadados

**Produto:** Meus Remédios (Web + Bot Telegram)  
**Tipo de documento:** Product Requirements Document (PRD)  
**Versão:** 1.0  
**Data:** 2026-02-03  
**Fonte primária:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:288`](plans/ROADMAP_CONSOLIDADO_FINAL.md:288)  
**Escopo do PRD:** 18 tarefas oficiais, organizadas em 3 ondas (Fundação, Inteligência, Expansão).  
**Não-escopo:** novas ondas/tarefas fora da lista oficial; mudanças de stack que elevem custo recorrente (exceto custo potencial em IA na Tarefa 2.2).  

### 1.1 Contexto e premissas

- Aplicação web em React/Vite, backend Supabase com RLS, integrações via Vercel e Bot Telegram.
- Premissa de **custo operacional ~R$ 0** mantendo free tiers (Supabase/Vercel/Telegram), com exceção da IA em **Tarefa 2.2** (custo potencial). Referência de análise financeira: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:234`](plans/ROADMAP_CONSOLIDADO_FINAL.md:234).
- Execução incremental por ondas, priorizando robustez e experiência do usuário antes de expansão de superfície.

### 1.2 Público-alvo e personas

- **Usuário final (Paciente/Usuário):** pessoas em uso contínuo de medicamentos; parte relevante com protocolos complexos (titulação) e múltiplas doses diárias.
- **Cuidador(a):** familiar/profissional que acompanha adesão e status (introduzido na Onda 3).

### 1.3 Stakeholders

- **Product Owner:** responsável por priorização e validação de critérios de aceitação.
- **Engenharia (Web/Bot/Infra):** implementação, testes, observabilidade e qualidade.
- **Usuários pilotos:** validação de usabilidade, onboarding e clareza do bot.

### 1.4 Restrições e requisitos não-funcionais (NFR)

- **Confiabilidade:** reduzir regressões com testes e validação de inputs.
- **Performance percebida:** reduzir chamadas redundantes e melhorar responsividade do Dashboard.
- **Acessibilidade:** elevar score de acessibilidade (Lighthouse) progressivamente.
- **Privacidade e segurança:** manter isolamento por RLS e acesso mínimo necessário.
- **Operação:** manter implantação simples e custo recorrente mínimo.

---

## 2. Visão Geral do Produto

O **Meus Remédios** é uma aplicação web (mobile-first) com integração ao **Telegram** para lembretes e registro rápido de doses. O produto atende um problema recorrente: manter **adesão ao tratamento** e **organização** (protocolos, titulação, estoque), reduzindo esquecimento, erros e ansiedade com relação a horários, consumo e reposição.

O roadmap consolida uma evolução em três ondas: (1) **Fundação** para elevar qualidade e estabilidade; (2) **Inteligência** para transformar dados de uso em feedback acionável e suporte (incluindo IA); (3) **Expansão** para novos cenários (relatórios para médicos, cuidador, PWA/push, melhorias estruturais). Visão por ondas e priorização: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:224`](plans/ROADMAP_CONSOLIDADO_FINAL.md:224).

### 2.1 Proposta de valor

- **Para o usuário:** lembrar, registrar e acompanhar tratamento com baixo atrito, incluindo casos complexos (titulação) e controle de estoque.
- **Para o cuidador/médico (indireto):** acesso a relatórios e evidências (PDF) e suporte ao acompanhamento.

### 2.2 Métricas de sucesso (baseline e metas por onda)

Tabela refletindo a referência de métricas do roadmap: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:1042`](plans/ROADMAP_CONSOLIDADO_FINAL.md:1042).

| Métrica | Baseline | Meta Onda 1 | Meta Onda 2 | Meta Onda 3 |
|---------|----------|-------------|-------------|-------------|
| Cobertura Testes | ~20% | >50% | >60% | >70% |
| Lighthouse Performance | ~85 | >90 | >90 | >95 |
| Lighthouse Accessibility | ~70 | >80 | >85 | >90 |
| Funcionalidades IA | 0 | 0 | 2 | 2 |
| Value Prop Score | 7.7/10 | 8.0/10 | 8.5/10 | 8.8/10 |
| Custo Mensal | R$ 0 | R$ 0 | R$ 0-15 | R$ 0-15 |
| Tarefas Completas | 0/18 | 6/18 | 12/18 | 18/18 |

---

## 3. Objetivos Estratégicos

### 3.1 Objetivos

**OE1 — Qualidade e Confiabilidade (reduzir regressões):** elevar cobertura de testes e validar entradas para reduzir bugs e inconsistências.

**OE2 — Performance e Eficiência (melhorar UX do Dashboard):** reduzir latência percebida e repetição de requisições com cache e otimização no acesso a dados agregados.

**OE3 — Engajamento e Adesão (resultados de tratamento):** fornecer feedback (score, widgets) e reduzir ações acidentais no bot.

**OE4 — Inteligência Assistida (suporte ao usuário):** introduzir IA com controles (disclaimer e rate limit) para dúvidas sobre medicamentos.

**OE5 — Expansão de Casos de Uso (médico/cuidador/móvel):** relatórios PDF, modo cuidador, PWA/push e deep linking.

**OE6 — Sustentabilidade de Custo (manter R$ 0 sempre que possível):** preservar free tiers, destacando custo potencial apenas em IA.

### 3.2 Mapa de rastreabilidade (Objetivo ↔ Onda/Tarefa ↔ Métrica)

| Objetivo Estratégico | Onda/Tarefa | Métrica primária |
|---|---|---|
| OE1 — Qualidade e Confiabilidade | Onda 1 – Tarefa 1.1 | Cobertura Testes |
| OE1 — Qualidade e Confiabilidade | Onda 1 – Tarefa 1.2 | Cobertura Testes / Lighthouse Accessibility (reduz erros de input) |
| OE1 — Qualidade e Confiabilidade | Onda 1 – Tarefa 1.3 | Value Prop Score (confiabilidade do bot) |
| OE2 — Performance e Eficiência | Onda 1 – Tarefa 1.5 | Lighthouse Performance |
| OE2 — Performance e Eficiência | Onda 1 – Tarefa 1.6 | Lighthouse Performance |
| OE3 — Engajamento e Adesão | Onda 2 – Tarefa 2.1 | Value Prop Score / Tarefas Completas |
| OE4 — Inteligência Assistida | Onda 2 – Tarefa 2.2 | Funcionalidades IA / Custo Mensal |
| OE3 — Engajamento e Adesão | Onda 2 – Tarefa 2.4 | Value Prop Score |
| OE3 — Engajamento e Adesão | Onda 2 – Tarefa 2.5 | Value Prop Score (reduz erro de operação) |
| OE3 — Engajamento e Adesão | Onda 2 – Tarefa 2.6 | Value Prop Score |
| OE5 — Expansão de Casos de Uso | Onda 3 – Tarefa 3.1 | Value Prop Score |
| OE5 — Expansão de Casos de Uso | Onda 3 – Tarefa 3.2 | Value Prop Score |
| OE5 — Expansão de Casos de Uso | Onda 3 – Tarefa 3.3 | Value Prop Score / Lighthouse Performance |
| OE5 — Expansão de Casos de Uso | Onda 3 – Tarefa 3.4 | Value Prop Score |
| OE1 — Qualidade e Confiabilidade | Onda 3 – Tarefa 3.5 | Cobertura Testes (via padronização e menor duplicação) |
| OE1 — Qualidade e Confiabilidade | Onda 3 – Tarefa 3.6 | Cobertura Testes / Tarefas Completas (manutenibilidade) |

### 3.3 Diagrama (visão simples por ondas)

```mermaid
flowchart LR
  U[Usuário Web] -->|CRUD + Visualização| W[App React/Vite]
  U -->|Lembretes + Registro| T[Telegram]
  W --> S[Supabase (DB + RLS)]
  B[Bot Node.js] --> S
  V[Vercel API/Cron] --> S
  T --> B

  subgraph O1[Onda 1 - Fundação]
    O1a[Testes + Validação] --> O1b[Persistência de sessão]
    O1b --> O1c[Onboarding + Cache + View]
  end
  subgraph O2[Onda 2 - Inteligência]
    O2a[Score + Widgets] --> O2b[Chatbot IA]
    O2b --> O2c[Timeline + melhorias no bot]
  end
  subgraph O3[Onda 3 - Expansão]
    O3a[PDF + Cuidador] --> O3b[PWA/Push + Deep links]
    O3b --> O3c[Padronização + Organização]
  end
```

---

## 4. Ondas de Desenvolvimento (Onda 1, Onda 2, Onda 3)

### Onda 1 — Fundação

#### Onda 1 – Tarefa 1.1: Testes unitários

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:298`](plans/ROADMAP_CONSOLIDADO_FINAL.md:298)
- **Título:** Ampliar cobertura de testes unitários (services e componentes críticos)
- **Descrição detalhada:**
  A base atual possui testes pontuais, mas ainda há risco de regressões em áreas críticas (services de API e formulários). Esta tarefa expande a cobertura para proteger regras de negócio (ex.: estoque FIFO, criação/edição de logs e titulação) e reduzir incidentes após refactors.
  O benefício ao usuário é indireto, porém essencial: menos bugs, maior confiança no registro de doses/estoque e evolução mais rápida. Impacta principalmente **OE1** (qualidade) e, por efeito, **OE3** (adesão) ao reduzir falhas.
- **Requisitos técnicos principais:**
  - Adicionar testes para [`src/services/api/logService.js`](src/services/api/logService.js), [`src/services/api/stockService.js`](src/services/api/stockService.js) e [`src/utils/titrationUtils.js`](src/utils/titrationUtils.js).
  - Testar formulários [`src/components/log/LogForm.jsx`](src/components/log/LogForm.jsx) e [`src/components/stock/StockForm.jsx`](src/components/stock/StockForm.jsx).
  - Configurar mocks do Supabase e padrões de teste conforme infraestrutura existente (Vitest/RTL).
- **Critérios de aceitação:**
  - [ ] Cobertura mínima de **>50%** ao final da Onda 1 (tendência para >70% ao final do programa), conforme metas: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:1042`](plans/ROADMAP_CONSOLIDADO_FINAL.md:1042)
  - [ ] Testes passam via `npm test` em ambiente local/CI.
  - [ ] Casos críticos cobertos: FIFO no estoque; criação/edição/remoção de logs com ajuste de estoque; utilitários de titulação.
- **Dependências (se houver):** nenhuma (primeira tarefa da Onda 1).
- **Impacto financeiro (custo operacional):** **R$ 0** (execução local/CI). Referência de custo zero: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 1 – Tarefa 1.2: Validação Zod

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:340`](plans/ROADMAP_CONSOLIDADO_FINAL.md:340)
- **Título:** Validação robusta de inputs com Zod (client-side e services)
- **Descrição detalhada:**
  Atualmente, entradas inválidas podem gerar erros silenciosos, dados corrompidos e crashes em produção. Esta tarefa introduz validação estruturada com Zod para entidades principais (medicamentos, protocolos, estoque e logs), garantindo mensagens de erro claras em português.
  O benefício direto ao usuário é redução de frustração por erros de formulário e maior confiabilidade do app. Impacta **OE1** (qualidade) e apoia **OE6** (sustentabilidade) ao reduzir retrabalho/bugs.
- **Requisitos técnicos principais:**
  - Instalar Zod e criar schemas em `src/schemas/*` (medicamento, protocolo, estoque, log).
  - Integrar validação em services e/ou antes de persistir no Supabase.
  - Padronizar mensagens de erro em pt-BR e mapear erros para UI.
- **Critérios de aceitação:**
  - [ ] Inputs inválidos são rejeitados com mensagens claras e acionáveis.
  - [ ] Não há crash por dados malformados (ex.: quantidade negativa, campos obrigatórios vazios).
  - [ ] Serviços não enviam payload inválido ao backend.
- **Dependências (se houver):** recomenda-se execução após testes base (Tarefa 1.1) para reduzir risco de regressão.
- **Impacto financeiro (custo operacional):** **R$ 0** (biblioteca JS). Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:252`](plans/ROADMAP_CONSOLIDADO_FINAL.md:252)

#### Onda 1 – Tarefa 1.3: Sessões persistentes do bot

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:374`](plans/ROADMAP_CONSOLIDADO_FINAL.md:374)
- **Título:** Persistência de sessões conversacionais do bot (Supabase) com TTL
- **Descrição detalhada:**
  Fluxos conversacionais do bot (ex.: registrar dose/estoque) dependem de estado; hoje, o estado em memória se perde em restarts, causando falhas e confusão no usuário. Esta tarefa implementa armazenamento persistente (ex.: tabela `bot_sessions`) para garantir continuidade do diálogo.
  Benefício direto: conversas mais confiáveis e menos interrupções. Impacta **OE1** (confiabilidade) e melhora a percepção de qualidade do produto (contribui para **Value Prop Score**).
- **Requisitos técnicos principais:**
  - Criar tabela e índices para sessões com expiração/cleanup.
  - Refatorar armazenamento de sessão no bot para read/write no Supabase.
  - Implementar TTL (ex.: 30 minutos) e job/rotina de limpeza.
- **Critérios de aceitação:**
  - [ ] Sessões sobrevivem a restarts do bot.
  - [ ] Latência de read/write < 100ms em condições normais.
  - [ ] Limpeza automática de sessões expiradas funcionando.
- **Dependências (se houver):** depende de acesso ao Supabase com permissões adequadas e migração aplicada.
- **Impacto financeiro (custo operacional):** **R$ 0** (uso no free tier; ~1KB/sessão). Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:258`](plans/ROADMAP_CONSOLIDADO_FINAL.md:258)

#### Onda 1 – Tarefa 1.4: Onboarding guiado

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:417`](plans/ROADMAP_CONSOLIDADO_FINAL.md:417)
- **Título:** Onboarding guiado (wizard) para reduzir curva de aprendizado
- **Descrição detalhada:**
  Usuários novos podem se perder na complexidade inicial (medicamento → protocolo → integração Telegram). Esta tarefa cria um wizard em 4 passos para guiar o primeiro uso, reduzindo abandono inicial e erros de configuração.
  Benefícios: ativação mais rápida, maior confiança e menor suporte implícito. Impacta **OE3** (engajamento/adesão) e contribui para **Value Prop Score**.
- **Requisitos técnicos principais:**
  - Criar componente [`src/components/onboarding/OnboardingWizard.jsx`](src/components/onboarding/OnboardingWizard.jsx) com 4 etapas.
  - Persistir flag `onboarding_completed` em `user_settings`.
  - Mostrar apenas para novos usuários e suportar “pular” a qualquer momento.
- **Critérios de aceitação:**
  - [ ] 4 passos navegáveis, mobile-friendly.
  - [ ] “Skip” disponível em qualquer etapa.
  - [ ] Não reaparece após conclusão.
- **Dependências (se houver):** recomenda-se após Tarefa 1.2 (validação) para garantir experiência sem erros de input.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:254`](plans/ROADMAP_CONSOLIDADO_FINAL.md:254)

#### Onda 1 – Tarefa 1.5: Cache SWR pattern

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:440`](plans/ROADMAP_CONSOLIDADO_FINAL.md:440)
- **Título:** Estratégia de cache tipo SWR (stale-while-revalidate) para reduzir latência no Dashboard
- **Descrição detalhada:**
  O Dashboard pode disparar múltiplas chamadas em paralelo a cada carregamento, gerando lentidão e “flash” de loading em navegações rápidas. Esta tarefa implementa cache simples com deduplicação de requests e revalidação em background (padrão SWR), reduzindo o tempo percebido para o usuário.
  Benefício: experiência mais fluida, principalmente em mobile/rede instável. Impacta **OE2** (performance) e contribui para metas Lighthouse.
- **Requisitos técnicos principais:**
  - Criar utilitário de cache (ex.: `src/lib/queryCache.js`) com `staleTime` (ex.: 30s).
  - Integrar cache nas chamadas do Dashboard e serviços mais acessados.
  - Garantir consistência e invalidação básica (ex.: após mutation).
- **Critérios de aceitação:**
  - [ ] Dashboard carrega em < 500ms em visitas subsequentes (após cache “quente”).
  - [ ] Dados não ficam mais que 30s “stale”.
  - [ ] Redução perceptível de “flash” de loading em navegação rápida.
- **Dependências (se houver):** recomendado após Tarefa 1.1 (testes) para cobrir cenários de cache.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 1 – Tarefa 1.6: View stock summary

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:491`](plans/ROADMAP_CONSOLIDADO_FINAL.md:491)
- **Título:** View de resumo de estoque no banco (medicine_stock_summary) para performance
- **Descrição detalhada:**
  O cálculo de estoque total exige agregações frequentes; em páginas e widgets, isso pode degradar performance. Esta tarefa cria uma view (ou view materializada, se necessário) para resumir estoque por medicamento, reduzindo custo de query e tempo de resposta.
  Benefício: páginas de estoque e dashboard mais rápidas, com menor consumo de recursos. Impacta **OE2** (performance) e apoia metas Lighthouse.
- **Requisitos técnicos principais:**
  - Criar migration SQL para view `medicine_stock_summary` e habilitar RLS.
  - Atualizar [`src/services/api/stockService.js`](src/services/api/stockService.js) para usar a view quando aplicável.
  - Garantir compatibilidade com código existente.
- **Critérios de aceitação:**
  - [ ] Query de estoque total pelo menos 2x mais rápida (benchmark antes/depois).
  - [ ] RLS funcionando na view (usuário só vê seus dados).
  - [ ] Sem breaking changes.
- **Dependências (se houver):** coordenação com Supabase para aplicar migration.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

### Onda 2 — Inteligência

#### Onda 2 – Tarefa 2.1: Score de adesão

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:541`](plans/ROADMAP_CONSOLIDADO_FINAL.md:541)
- **Título:** Sistema de score de adesão (overall + por protocolo) com streaks
- **Descrição detalhada:**
  Usuários precisam entender sua adesão ao tratamento e identificar padrões de falha. Esta tarefa implementa um cálculo de adesão (doses esperadas vs. doses registradas), exibindo score geral, por protocolo e sequência (streak), promovendo consciência e motivação.
  Benefícios: feedback acionável e reforço positivo, melhorando engajamento. Impacta diretamente **OE3** (adesão) e melhora **Value Prop Score**.
- **Requisitos técnicos principais:**
  - Criar service (ex.: `src/services/api/adherenceService.js`) para cálculo por período.
  - Criar widget visual e componente de progresso circular.
  - Integrar no Dashboard e adicionar badge em cards de protocolo.
- **Critérios de aceitação:**
  - [ ] Score calculado corretamente para período configurável.
  - [ ] Widget visual no Dashboard funcionando e responsivo.
  - [ ] Streak (dias seguidos) implementado e atualizado.
- **Dependências (se houver):** recomenda-se após Onda 1 (cache/view) para evitar regressão de performance no Dashboard.
- **Impacto financeiro (custo operacional):** **R$ 0** (cálculo client-side). Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:256`](plans/ROADMAP_CONSOLIDADO_FINAL.md:256)

#### Onda 2 – Tarefa 2.2: Chatbot IA

- **Rastreabilidade (feature):** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:584`](plans/ROADMAP_CONSOLIDADO_FINAL.md:584)
- **Rastreabilidade (custo potencial):** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:234`](plans/ROADMAP_CONSOLIDADO_FINAL.md:234)
- **Título:** Chatbot com IA para dúvidas sobre medicamentos (com controles de segurança)
- **Descrição detalhada:**
  Usuários frequentemente têm dúvidas sobre interações, horários e efeitos colaterais, e recorrem a múltiplas fontes com informações inconsistentes. Esta tarefa adiciona um comando no bot para perguntas, usando IA para respostas informativas (sem diagnóstico), incluindo **disclaimer obrigatório**, limitação de uso e cache de respostas.
  Benefícios: suporte rápido e contextual com base na lista de medicamentos do usuário, elevando percepção de utilidade e retenção. Impacta **OE4** (inteligência) e contribui para **OE3** (engajamento), com atenção a custo e responsabilidade.
- **Requisitos técnicos principais:**
  - Criar comando `/pergunta` no bot e endpoint serverless (ex.: `api/ai-chat.js`).
  - Integrar com provedor (Groq free tier) e fallback opcional para `GPT-4o-mini`.
  - Rate limit: 10 perguntas/dia/usuário; cache de respostas frequentes.
  - Prompt com contexto de medicamentos e regras explícitas (não diagnosticar).
- **Critérios de aceitação:**
  - [ ] Respostas em < 5s (SLO de latência).
  - [ ] Disclaimer presente em 100% das respostas.
  - [ ] Rate limit por usuário funcionando.
  - [ ] Fallback configurado quando Groq falhar (quando habilitado).
- **Dependências (se houver):** requer gestão segura de chaves (env vars) e endpoint disponível em Vercel.
- **Impacto financeiro (custo operacional):**
  - **Base:** **R$ 0** (Groq free tier)
  - **Potencial:** **R$ 1–15/mês** (ex.: `GPT-4o-mini`) conforme análise: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:234`](plans/ROADMAP_CONSOLIDADO_FINAL.md:234)

#### Onda 2 – Tarefa 2.3: Timeline de titulação

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:637`](plans/ROADMAP_CONSOLIDADO_FINAL.md:637)
- **Título:** Timeline visual de titulação (etapas, status, dias restantes)
- **Descrição detalhada:**
  Protocolos com titulação são poderosos, mas difíceis de visualizar e acompanhar. Esta tarefa adiciona uma timeline clara com etapas concluídas/atuais/futuras, datas e dias restantes, reduzindo incerteza e erros.
  Benefício: clareza do tratamento e menor fricção para manter-se no plano. Impacta **OE3** (adesão) e melhora o **Value Prop Score**.
- **Requisitos técnicos principais:**
  - Criar componente de timeline (ex.: `src/components/protocol/TitrationTimeline.jsx`).
  - Integrar em visualização expandida do protocolo.
  - Responsividade mobile e sem regressões de performance.
- **Critérios de aceitação:**
  - [ ] Timeline renderiza todas as etapas com estados distintos.
  - [ ] Etapa atual e dias restantes são exibidos corretamente.
  - [ ] Funciona bem em mobile.
- **Dependências (se houver):** depende da existência de dados de titulação por protocolo.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 2 – Tarefa 2.4: Widgets de engajamento no Dashboard

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:681`](plans/ROADMAP_CONSOLIDADO_FINAL.md:681)
- **Título:** Widgets acionáveis no Dashboard (adesão, alertas de estoque, quick actions)
- **Descrição detalhada:**
  O Dashboard atual informa, mas nem sempre orienta ação. Esta tarefa adiciona widgets para transformar dados em decisões rápidas: adesão (progresso), alerta de estoque (reposição) e painel de ações (registrar dose, adicionar estoque, ver histórico).
  Benefício: mais engajamento e menor tempo para completar tarefas-chave. Impacta **OE3** (engajamento) e reforça metas de **Value Prop Score**.
- **Requisitos técnicos principais:**
  - Criar componentes de widgets e integrar ao [`src/views/Dashboard.jsx`](src/views/Dashboard.jsx).
  - Integrar com serviços existentes e considerar cache (Onda 1 – Tarefa 1.5).
  - Garantir navegação consistente e responsiva.
- **Critérios de aceitação:**
  - [ ] 3 widgets visíveis e funcionais no Dashboard.
  - [ ] Alertas de estoque são clicáveis e levam à tela correta.
  - [ ] Quick actions executam as rotas/ações esperadas.
- **Dependências (se houver):** recomendado após Tarefa 2.1 (para widget de adesão) e após Onda 1 (cache).
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 2 – Tarefa 2.5: Confirmação ao pular dose no bot

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:729`](plans/ROADMAP_CONSOLIDADO_FINAL.md:729)
- **Título:** Confirmação explícita antes de “pular” uma dose (evitar ação acidental)
- **Descrição detalhada:**
  O botão “Pular” no bot pode ser acionado acidentalmente, registrando uma decisão errada e impactando o histórico/adesão. Esta tarefa adiciona um passo de confirmação com inline keyboard e timeout para retornar ao estado original.
  Benefício: segurança operacional e redução de arrependimento/erros. Impacta **OE3** (adesão) e melhora confiança no bot.
- **Requisitos técnicos principais:**
  - Refatorar handler de skip (ex.: em [`server/bot/callbacks/doseActions.js`](server/bot/callbacks/doseActions.js)).
  - Adicionar teclado inline: “Confirmar pular” e “Cancelar”.
  - Persistir/lembrar estado por 30s e restaurar UI após timeout.
- **Critérios de aceitação:**
  - [ ] Não é possível pular dose sem confirmação.
  - [ ] Timeout de 30s cancela a confirmação e retorna ao estado inicial.
  - [ ] “Cancelar” encerra o fluxo sem registrar skip.
- **Dependências (se houver):** depende de handlers e estado do bot (beneficia-se de Onda 1 – Tarefa 1.3).
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 2 – Tarefa 2.6: Notificações ricas no bot

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:773`](plans/ROADMAP_CONSOLIDADO_FINAL.md:773)
- **Título:** Notificações enriquecidas (contexto de dose, horário, notas e formatação)
- **Descrição detalhada:**
  Notificações básicas reduzem clareza e podem gerar dúvidas (“qual remédio?”, “qual dose?”). Esta tarefa melhora mensagens de lembrete com nome do medicamento, dose, horário agendado, notas e formatação Markdown, mantendo concisão.
  Benefício: entendimento imediato e menor chance de erro ao tomar/registrar. Impacta **OE3** (adesão) e reforça proposta de valor do bot.
- **Requisitos técnicos principais:**
  - Atualizar scheduler/handlers de notificação (ex.: [`server/bot/scheduler.js`](server/bot/scheduler.js)).
  - Montar template com campos opcionais (notas) e `parse_mode` Markdown.
  - Garantir compatibilidade com caracteres especiais/escaping.
- **Critérios de aceitação:**
  - [ ] Mensagens incluem medicamento, dose e horário.
  - [ ] Notas aparecem apenas quando existem.
  - [ ] Markdown renderiza corretamente (sem quebra por caracteres).
- **Dependências (se houver):** recomenda-se após Onda 1 – Tarefa 1.3 (sessão/estado) para consistência do bot.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

### Onda 3 — Expansão

#### Onda 3 – Tarefa 3.1: Relatórios PDF

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:814`](plans/ROADMAP_CONSOLIDADO_FINAL.md:814)
- **Título:** Exportação de relatórios em PDF (adesão, período, medicamentos e gráficos)
- **Descrição detalhada:**
  Usuários precisam levar informações para consultas médicas e acompanhar evolução. Esta tarefa oferece relatório PDF exportável com dados relevantes (período, lista de medicamentos/protocolos, adesão e elementos visuais), com design consistente e rápido.
  Benefício: compartilhamento offline e maior utilidade clínica. Impacta **OE5** (expansão) e melhora **Value Prop Score**.
- **Requisitos técnicos principais:**
  - Integrar biblioteca de PDF (ex.: jsPDF + autotable) e criar componente de relatório.
  - Inserir botão de exportação na página de histórico.
  - Incluir logo e dados do usuário, respeitando privacidade.
- **Critérios de aceitação:**
  - [ ] PDF gerado em < 3s.
  - [ ] Layout legível e “profissional”.
  - [ ] Inclui logo e dados do período selecionado.
- **Dependências (se houver):** depende de dados de logs/adesão (beneficia-se de Onda 2 – Tarefa 2.1).
- **Impacto financeiro (custo operacional):** **R$ 0** (client-side). Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:257`](plans/ROADMAP_CONSOLIDADO_FINAL.md:257)

#### Onda 3 – Tarefa 3.2: Modo cuidador

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:834`](plans/ROADMAP_CONSOLIDADO_FINAL.md:834)
- **Título:** Modo cuidador (acesso read-only + alertas ao cuidador)
- **Descrição detalhada:**
  Em cenários de cuidado (idosos, doenças crônicas, dependência), terceiros precisam acompanhar sem comprometer segurança e privacidade. Esta tarefa cria um modelo de convite, permissões e visão read-only para cuidador, com notificações de dose esquecida via Telegram.
  Benefício: suporte familiar e redução de risco de não adesão. Impacta **OE5** (expansão) e fortalece **OE1** (segurança via permissões).
- **Requisitos técnicos principais:**
  - Criar tabela `caregivers` e fluxo de convite por código.
  - Implementar permissões read-only e políticas de acesso.
  - Implementar notificação de dose esquecida para cuidador.
- **Critérios de aceitação:**
  - [ ] Cuidador vê dados permitidos e não consegue editar.
  - [ ] Notificações para cuidador funcionam.
  - [ ] Revogação de acesso é imediata.
- **Dependências (se houver):** depende de regras claras de segurança (RLS/policies) e modelagem de permissões.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 3 – Tarefa 3.3: PWA + Push

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:867`](plans/ROADMAP_CONSOLIDADO_FINAL.md:867)
- **Título:** PWA instalável com push notifications e cache offline básico
- **Descrição detalhada:**
  Muitos usuários preferem experiência “de app” no celular, com instalação e notificações nativas. Esta tarefa adiciona PWA completo (manifest, service worker) com push notifications e modo offline básico para consultas.
  Benefício: conveniência e confiabilidade em rede instável. Impacta **OE5** (expansão) e auxilia **OE2** (performance percebida).
- **Requisitos técnicos principais:**
  - Configurar plugin PWA no build e gerar manifest completo.
  - Implementar Web Push (com consentimento explícito).
  - Cache offline básico para telas de consulta.
- **Critérios de aceitação:**
  - [ ] App instalável em dispositivo móvel.
  - [ ] Push notifications funcionando (quando habilitado).
  - [ ] Modo offline básico para consultas.
- **Dependências (se houver):** pode depender de configurações de deploy e chaves/serviço de push.
- **Impacto financeiro (custo operacional):** **R$ 0** (Web Push nativa). Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:259`](plans/ROADMAP_CONSOLIDADO_FINAL.md:259)

#### Onda 3 – Tarefa 3.4: Hash router + deep linking

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:888`](plans/ROADMAP_CONSOLIDADO_FINAL.md:888)
- **Título:** Hash router e deep linking (URLs compartilháveis e abertura via Telegram)
- **Descrição detalhada:**
  A navegação atual limita URLs compartilháveis e deep links vindos do Telegram. Esta tarefa implementa roteamento via hash (sem dependências) com suporte a back/forward, e habilita deep linking para abrir telas específicas a partir do bot.
  Benefício: navegação melhor, links compartilháveis e integração mais fluida com o bot. Impacta **OE5** (expansão) e melhora experiência geral.
- **Requisitos técnicos principais:**
  - Implementar hook/router simples (ex.: `src/lib/router.js`).
  - Definir rotas principais e parâmetros.
  - Adicionar links no bot para abrir telas específicas do app.
- **Critérios de aceitação:**
  - [ ] URLs são compartilháveis e reproduzíveis.
  - [ ] Browser back/forward funciona.
  - [ ] Deep links do Telegram abrem a seção correta.
- **Dependências (se houver):** recomendado após PWA (3.3) para coesão de experiência mobile, mas pode ser independente.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:260`](plans/ROADMAP_CONSOLIDADO_FINAL.md:260)

#### Onda 3 – Tarefa 3.5: Padronização handlers do bot

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:929`](plans/ROADMAP_CONSOLIDADO_FINAL.md:929)
- **Título:** Padronização de handlers do bot (factory createCommand e tratamento de erros)
- **Descrição detalhada:**
  Handlers do bot podem divergir em padrões de erro, logging e autorização, aumentando risco de inconsistências e bugs. Esta tarefa padroniza a estrutura dos comandos com uma fábrica (`createCommand`) e centraliza tratamento de erros.
  Benefício: manutenção mais simples e menos regressões ao evoluir o bot. Impacta **OE1** (qualidade) e ajuda a manter velocidade sustentável.
- **Requisitos técnicos principais:**
  - Criar base de comandos (ex.: `server/bot/commands/base.js`) e migrar comandos existentes.
  - Centralizar mensagens de erro e logging.
  - Reduzir duplicação e manter compatibilidade.
- **Critérios de aceitação:**
  - [ ] Todos os comandos do bot usam o padrão/factory.
  - [ ] Tratamento de erro é consistente (usuário e logs).
  - [ ] Redução ~30% de duplicação (estimativa).
- **Dependências (se houver):** depende de inventário completo de comandos e testes/validação manual.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)

#### Onda 3 – Tarefa 3.6: Organização de componentes por feature

- **Rastreabilidade:** [`plans/ROADMAP_CONSOLIDADO_FINAL.md:986`](plans/ROADMAP_CONSOLIDADO_FINAL.md:986)
- **Título:** Reorganização de componentes por feature (melhor coesão e escalabilidade)
- **Descrição detalhada:**
  A estrutura atual de componentes tende a crescer de forma “flat”, dificultando descoberta e manutenção conforme novas features entram (onboarding, adesão, relatórios). Esta tarefa reorganiza pastas por feature, padroniza componentes comuns e atualiza imports.
  Benefício: desenvolvimento mais rápido e menor atrito para evoluções futuras. Impacta **OE1** (manutenibilidade) e reduz custo indireto de mudança.
- **Requisitos técnicos principais:**
  - Criar estrutura alvo de pastas por feature e mover componentes.
  - Atualizar imports e garantir build/testes funcionando.
  - Criar pastas para módulos novos (dashboard/adherence/onboarding/reports).
- **Critérios de aceitação:**
  - [ ] Nenhuma quebra funcional (app continua operando).
  - [ ] Imports atualizados corretamente.
  - [ ] Estrutura final facilita inclusão de novas features.
- **Dependências (se houver):** recomendado após estabilização das features principais de Onda 2/3 para evitar retrabalho.
- **Impacto financeiro (custo operacional):** **R$ 0**. Referência: [`plans/ROADMAP_CONSOLIDADO_FINAL.md:247`](plans/ROADMAP_CONSOLIDADO_FINAL.md:247)
