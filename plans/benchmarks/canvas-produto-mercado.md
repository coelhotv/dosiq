# CANVAS DE PRODUTO: Dosiq — Plataforma de Adesão Terapêutica para o Mercado Brasileiro

> **Documento vivo** — adaptado a partir do brainstorming estratégico `brainstorming-canvas-produto.md`,
> ancorado na realidade técnica atual do produto (v3.1.0) e seu roadmap até a Fase 8.
>
> **Princípio central:** Custo operacional R$0 como vantagem competitiva genuína e promessa ao paciente.

---

## 1. VISÃO E POSICIONAMENTO

### 1.1. Nome e identidade

**Nome atual:** Dosiq (produto pessoal em evolução para plataforma)

### 1.2. Visão de produto

"Ser a ferramenta indispensável de gestão de medicamentos para brasileiros com doenças crônicas — gratuita, inteligente, integrada ao Telegram e portátil para qualquer consulta médica."

### 1.3. Posicionamento

Para **pacientes crônicos brasileiros e seus cuidadores** que **enfrentam dificuldade em manter adesão a tratamentos complexos**, Dosiq é uma **plataforma PWA de adesão terapêutica inteligente** que **combina lembretes multicanal (push + Telegram + WhatsApp), inteligência preditiva client-side, portabilidade clínica (PDF/cartão de emergência) e modo cuidador via WhatsApp**, diferentemente de **apps globais (Medisafe, MyTherapy) que ignoram o ecossistema brasileiro** e **apps locais genéricos que oferecem apenas alarmes simples sem inteligência ou portabilidade**.

**Vantagem estrutural única:** Custo operacional R$0 (Vercel Hobby + Supabase free tier) permite produto 100% gratuito para o paciente sem paywall, sem trial e sem freemium frustrante — algo que nenhum player global consegue sustentar no longo prazo para usuários individuais.

### 1.4. Proposta de valor por segmento

#### Para o paciente crônico individual:
- **Gratuito para sempre** — sem paywall, sem freemium. Funcionalidades essenciais ilimitadas.
- **Lembretes inteligentes** — push PWA + Telegram hoje, WhatsApp (Fase 7) amanhã. O canal certo para cada perfil de paciente.
- **Portabilidade clínica** — PDF de adesão para o médico, cartão de emergência offline, exportação completa dos dados.
- **Inteligência sem custo de servidor** — previsão de reposição de estoque, score de risco por protocolo, otimizador de horário de lembrete — tudo calculado no browser, sem chamada de API.
- **Base ANVISA integrada** — autocomplete de 10.000+ medicamentos registrados, preenchimento automático de campos.

#### Para o cuidador (familiar, cuidador formal):
- **Acompanhamento via WhatsApp** — familiar recebe resumo semanal de adesão sem precisar instalar app ou criar conta (Fase 7).
- **Modo cuidador completo** — convite via link, acesso read-only ou gerenciamento completo (Fase 7).
- **Alertas proativos** — notificação quando paciente perde doses críticas.

#### Para médicos e farmacêuticos (futuro, Backlog):
- **Relatórios de adesão estruturados** — PDF com percentual de doses tomadas, horários de miss, tendências.
- **Dados para reconciliação medicamentosa** — visão consolidada de todos os medicamentos ativos do paciente.
- **Portal clínico** — dashboard web para profissionais (trigger-gated: demanda validada com usuários reais).

---

## 2. SEGMENTOS DE USUÁRIOS E PERSONAS

### 2.1. Segmento primário: Paciente crônico adulto/idoso

**Persona 1: Dona Maria (67 anos, hipertensa e diabética tipo 2)**

- **Contexto:** Viúva, mora sozinha em São Paulo (Zona Leste), aposentada, renda ~2,5 salários mínimos. Usa SUS e Farmácia Popular. Tem smartphone Android básico, usa WhatsApp diariamente, baixa familiaridade com apps.
- **Dores:**
  - Toma 5 medicamentos (losartana, metformina, sinvastatina, AAS, omeprazol) em horários variados; frequentemente esquece ou confunde.
  - Já teve episódios de hiperglicemia por esquecer a metformina.
  - Filha mora longe; sente-se sozinha na gestão da saúde.
  - Não sabe explicar ao médico exatamente quais remédios toma ou quando perdeu doses.
- **Necessidades:**
  - Lembretes claros, com nome e foto do remédio, som alto — via WhatsApp (canal dominado).
  - Relatório simples para mostrar ao médico do posto (PDF imprimível).
  - Alguém (filha) receber alertas quando ela perde doses.
  - Não precisar pagar nada para usar as funcionalidades básicas.
- **JTBD:** "Quando chega a hora do remédio, quero ser avisada de forma clara e insistente, para não esquecer e evitar complicações."
- **Fit com o produto atual:** Push PWA + Telegram hoje. WhatsApp + modo cuidador na Fase 7. PDF de consulta já disponível (Fase 5).

**Persona 2: Carlos (52 anos, executivo hipertenso e dislipidêmico)**

- **Contexto:** Casado, 2 filhos, Curitiba. Gerente comercial, convênio SulAmérica, compra em Drogasil. iPhone, heavy user de apps.
- **Dores:**
  - Viagens e finais de semana quebram a rotina; esquece doses fora do escritório.
  - Quer algo que "não tome tempo" — integração com Apple Health seria ideal.
  - Quer dados para mostrar ao cardiologista (PA descontrolada na última consulta).
- **Necessidades:**
  - Lembretes discretos, snooze inteligente.
  - Relatório automático para o médico (PDF por e-mail).
  - Gamificação leve (streaks, badges) para criar hábito.
  - Score de risco que mostre quando ele está "escapando da rota".
- **JTBD:** "Quando estou fora da minha rotina, quero que o app me mantenha no caminho sem me atrapalhar, para não perder o controle da saúde."
- **Fit com o produto atual:** Dashboard de streaks e adesão já existem. Score de risco por protocolo vem na Fase 6. PDF de consulta disponível na Fase 5.

**Persona 3: Ana (35 anos, paciente jovem com doença autoimune)**

- **Contexto:** Recém-diagnosticada com lúpus. Regime complexo com titulação (hidroxicloroquina + prednisona com desmame gradual). Desenvolvedora de software, iOS e Android.
- **Dores:**
  - Titulação complexa: doses mudam a cada semana; quer visualizar o plano de desmame.
  - Quer entender se está aderindo bem antes da consulta com o reumatologista.
  - Quer exportar dados para levar para o especialista.
- **Necessidades:**
  - Timeline visual de titulação.
  - Histórico completo exportável.
  - Instalabilidade (PWA na tela home).
  - Interface moderna que não pareça "app de idoso".
- **JTBD:** "Quando tenho consulta com minha reumatologista, quero chegar com dados precisos de adesão e mostrar a evolução da titulação, para que ela tome decisões informadas."
- **Fit com o produto atual:** Protocolos com titulação, timeline visual, histórico e exportação já existem na Fase 5.

### 2.2. Segmento secundário: Cuidador familiar

**Persona 4: Ana Paula (42 anos, filha de Dona Maria)**

- **Contexto:** Professora em Guarulhos, mora a 1h30 da mãe. Visita fins de semana.
- **Dores:**
  - Não sabe se a mãe está tomando os remédios corretamente.
  - Descobre problemas apenas quando a mãe já está mal.
  - Sente culpa por não acompanhar de perto.
- **Necessidades:**
  - Receber alertas quando a mãe perde doses (via WhatsApp — sem instalar app).
  - Ver histórico de adesão da mãe remotamente.
  - Poder ajustar medicamentos da mãe à distância quando necessário.
- **JTBD:** "Quando minha mãe esquece o remédio, quero ser avisada imediatamente pelo WhatsApp, para poder ligar e ajudá-la."
- **Fit com o produto:** Parceiro de responsabilidade (Fase 7, W02 + C02) e modo cuidador completo (Fase 7, C01).

### 2.3. Segmento terciário: Profissional de saúde (Backlog)

**Persona 5: Dr. Roberto (cardiologista, 45 anos)**

- **Contexto:** Trabalha em clínica privada e UBS. Atende ~80 pacientes crônicos/mês.
- **Dores:**
  - Pacientes dizem "tomo tudo direitinho" mas exames mostram descontrole.
  - Não tem como verificar adesão real sem dados objetivos.
  - Não quer aprender mais um sistema complexo.
- **Necessidades:**
  - Relatório de adesão simplificado que o paciente traga na consulta (PDF imprimível/shareable).
  - Futuramente: dashboard web com visão de seus pacientes (se eles autorizarem).
- **Fit com o produto:** PDF de consulta médica já disponível (Fase 5). Portal clínico é backlog trigger-gated.

---

## 3. O QUE JÁ EXISTE — MVP REAL (v3.1.0)

Esta seção é crítica: diferentemente de um canvas de startup em branco, **o produto já existe e está funcional**. O MVP não é uma visão futura — é o estado atual.

### 3.1. Features entregues (produção)

| Feature | Descrição | Fase |
|---------|-----------|------|
| **Gestão de medicamentos** | CRUD completo com validação Zod, base ANVISA com autocomplete (10k+ meds) em breve | 1 + 5 |
| **Protocolos de tratamento** | Frequências: diário, dias alternados, semanal, personalizado, quando necessário | 2 |
| **Titulação de doses** | Timeline visual, automação de transições, histórico de fases | 3 |
| **Controle de estoque** | Quantidade em comprimidos, alertas de reposição (crítico/baixo/normal/alto), decremento automático | 2 |
| **Score de adesão** | Cálculo por protocolo e geral, histórico de 7/30/90 dias, streaks, tendências | 2 |
| **Dashboard** | RingGauge de adesão, DoseTimeline, StockBars, Sparklines, SmartAlerts, insights | UX 1-3 |
| **Registro de doses** | Check-in simples, registro retroativo, bulk register, log com timestamps | 2 |
| **Calendário visual** | Heatmap de adesão mensal, navegação por mês | 5 |
| **PWA instalável** | Service Worker, manifesto, instalação na tela home (iOS/Android) | 4 |
| **Push notifications** | Lembretes de dose via push web | 4 |
| **Bot Telegram** | Lembretes, registro via chat, alertas de estoque, relatórios, comandos conversacionais | 2-4 |
| **PDF de consulta** | Relatório médico profissional com histórico de adesão, exportação ou sharing | 5 |
| **Cartão de emergência** | Cartão offline com medicamentos ativos para urgências médicas | 5 |
| **Exportação de dados** | CSV e JSON para portabilidade total | 5 |
| **Rastreador de prescrições** | Histórico de prescrições com validade, upload de documentos | 5 |
| **Analytics privado** | localStorage only, privacy-first, métricas de uso sem telemetria externa | 4 |
| **Gamificação** | Streaks, badges, celebrações de marcos de adesão | 2-UX |

### 3.2. Stack técnica atual

| Componente | Tecnologia | Limitação relevante |
|------------|-----------|---------------------|
| **Frontend** | React 19 + Vite 7 + Framer Motion 12 | PWA, não nativo (sem App Store nativo) |
| **Backend** | Supabase (Postgres + Auth + RLS) | Free tier: 500MB storage, 5GB bandwidth |
| **Validação** | Zod 4 | Enums em português |
| **Testes** | Vitest 4 + Testing Library | 93/93 críticos passando |
| **Deploy** | Vercel Hobby | Max 12 serverless functions |
| **Bot** | Node.js + node-telegram-bot-api | Telegram somente (WhatsApp na Fase 7) |
| **Notificações** | Web Push API (VAPID) | iOS limitado sem instalação |
| **PDF** | jsPDF + jspdf-autotable | Client-side, sem custo de servidor |
| **IA** | — | Groq free tier na Fase 8 |

### 3.3. Modelo de dados atual (Supabase/Postgres)

```
medicamentos (medicines)
├── id (UUID)
├── user_id (FK → auth.users, RLS)
├── name (text)
├── dosage_per_pill (numeric — mg por comprimido)
├── dosage_unit (enum: mg|mcg|g|ml|ui|cp|gotas)
├── type (enum: comprimido|capsula|liquido|injecao|pomada|spray|outro)
├── active_ingredient (text, opcional — habilitado pela base ANVISA)
├── laboratory (text, opcional)
├── created_at, updated_at

protocolos (protocols)
├── id (UUID)
├── user_id (FK, RLS)
├── medicine_id (FK → medicamentos)
├── name (text)
├── frequency (enum: diario|dias_alternados|semanal|personalizado|quando_necessario)
├── time_schedule (array de HH:MM)
├── dosage_per_intake (numeric — comprimidos por dose)
├── start_date (date)
├── end_date (date, nullable)
├── titration_schedule (JSONB — fases de titulação)
├── titration_status (enum: ativo|pausado|concluido)
├── created_at, updated_at

estoque (stock)
├── id (UUID)
├── user_id (FK, RLS)
├── medicine_id (FK → medicamentos)
├── quantity (numeric — comprimidos)
├── purchase_date (date)
├── unit_price (numeric >= 0 — preço por comprimido)
├── expiration_date (date, nullable)
├── notes (text, nullable)
├── created_at

registros_doses (dose_logs)
├── id (UUID)
├── user_id (FK, RLS)
├── protocol_id (FK → protocolos)
├── medicine_id (FK → medicamentos)
├── taken_at (timestamptz)
├── quantity_taken (numeric <= 100 — comprimidos)
├── scheduled_time (text HH:MM)
├── source (enum: manual|bot|bulk)
├── notes (text, nullable)

prescrições (prescriptions) — Fase 5
├── id (UUID)
├── user_id (FK, RLS)
├── medicine_id (FK, nullable)
├── prescribed_by (text)
├── prescribed_at (date)
├── valid_until (date, nullable)
├── file_url (text, nullable)
├── notes (text, nullable)
```

**Evolução planejada do modelo de dados:**

```
Fase 7 — Cuidador:
cuidadores_vinculados (caregiver_links)
├── id (UUID)
├── patient_user_id (FK → auth.users)
├── caregiver_identifier (text — telefone WhatsApp criptografado)
├── permission_level (enum: view_only|full_manage)
├── invite_token (text, expires_at)
├── whatsapp_channel (boolean)
├── created_at, accepted_at

Fase 8 — IA:
chat_interactions
├── id (UUID)
├── user_id (FK, RLS)
├── message (text)
├── response (text)
├── model (text — groq/llama)
├── context_snapshot (JSONB — medicines ativos no momento)
├── created_at
```

---

## 4. ROADMAP DE EVOLUÇÃO DO PRODUTO

### 4.1. Fase atual: Fechar Fase 5 (v3.2.0) — Sprint ativo

**Objetivo:** Completar as 2 features restantes e encerrar o ciclo de Valor Clínico.

| Feature | Entrega |
|---------|---------|
| **F5.10 Análise de Custo** | Custo mensal por medicamento com previsão 3 meses, usando `unit_price` do estoque |
| **F5.6 Base ANVISA + Autocomplete** | 10.206 medicamentos, autocomplete preenche name/activeIngredient/laboratory/type automaticamente |

**Custo:** R$0 | **Stack novo:** Nenhum | **Funções serverless afetadas:** 0

---

### 4.2. Fase 6: Inteligência & Insights (v3.3.0)

**Objetivo:** Transformar dados acumulados em predições acionáveis — o app deixa de ser reativo e passa a ser proativo.

**Princípio técnico:** Zero chamadas novas ao Supabase. Toda a computação é pura sobre o cache SWR existente.

| Feature | Descrição | Valor para o usuário |
|---------|-----------|----------------------|
| **I01 Previsão de reposição** | Consumo real 30d → data exata de esgotamento por medicamento | "Losartana acaba em 12 dias — compre antes" |
| **I04 Score de risco por protocolo** | Adesão 14d rolling + tendência → low/medium/high risk | "Você está em risco de descontrole com este protocolo" |
| **I02 Heatmap de padrões** | Dia-da-semana × período do dia → onde estão os buracos de adesão | "Você perde mais doses nas sextas à noite" |
| **I03 Otimizador de horário** | Delta entre horário programado e `taken_at` real → sugestão de ajuste | "Mude o lembrete para 19h30 — você toma às 19h47 em média" |
| **I05 Análise de custo avançada** | Custo real por dia × adesão → custo por dose "desperdiçada" | "Você gastou R$12 em doses perdidas este mês" |
| **INT-01 Risk Score no PDF** | Score de risco incluído no relatório médico | Valor clínico direto para o especialista |
| **INT-02 Alertas de reposição no bot** | Previsão de esgotamento nos alertas do Telegram/WhatsApp | Lembrete proativo antes de faltar |

**Custo:** R$0 | **Dados necessários:** mínimo 14 dias de histórico (UI adaptativa com threshold)

---

### 4.3. Fase 7: Crescimento & Alcance (v4.0.0)

**Objetivo:** Expandir de Telegram para WhatsApp (147M usuários no Brasil) e habilitar o modo cuidador.

**Esta é a fase de maior impacto de crescimento.** WhatsApp é o canal dominante no Brasil — chegar nele significa chegar onde Dona Maria já está.

| Feature | Descrição | Impacto |
|---------|-----------|---------|
| **W01 WhatsApp Bot** | Meta Cloud API, adapter pattern (paridade com Telegram), 1000 conv/mês grátis | Acesso ao segmento de maior crescimento |
| **W02 Seleção de canal** | Usuário escolhe Telegram ou WhatsApp nas configurações | Reduz churn de usuários que preferem WhatsApp |
| **W03 Alertas inteligentes multi-canal** | Usa outputs da Fase 6 (previsão de reposição + risk score) | Alertas contextuais, não spam |
| **C02 Parceiro de responsabilidade** | Resumo semanal de adesão via WhatsApp para familiar, sem acesso à conta | Viralidade: familiar instala para acompanhar paciente |
| **C01 Modo cuidador completo** | Convite por link, read-only ou gerenciamento completo, multi-canal | Expansão para segmento cuidadores |

**Ação crítica:** Verificação Meta Business (4-8 semanas de processo burocrático) deve iniciar antes do desenvolvimento.

**Custo:** R$0 (Meta Cloud API free tier: 1000 conversações/mês)

---

### 4.4. Fase 8: Experiência Inteligente & Wow Factor (v4.1.0)

**Objetivo:** Elevar a experiência com IA conversacional, voz e interações que surpreendem e fidelizam.

| Feature | Descrição | Custo |
|---------|-----------|-------|
| **F8.1 Chatbot IA (Groq)** | LLM contextual multi-canal: "Posso tomar com suco?", "O que fazer se esqueci a dose?", disclaimer médico obrigatório | R$0-5/mês |
| **V01 Registro de dose por voz** | Web Speech API nativa: "Tomei a losartana" → log automático. Zero custo, zero dependência | R$0 |
| **V02 Resumo de doses por voz** | Speech Synthesis API: leitura da lista de doses do dia. Ideal para Dona Maria | R$0 |
| **F8.2 Interações medicamentosas** | Base seed de interações por classe terapêutica (ANVISA `therapeuticClass` já disponível no JSON) | R$0 |

---

### 4.5. Backlog Futuro (trigger-gated)

Features que só fazem sentido após atingir escala mínima ou validação de demanda:

| Feature | Gatilho para desenvolvimento |
|---------|------------------------------|
| Afiliação com farmácias (CPA por compra) | 100+ usuários ativos com histórico de estoque |
| OCR de receita (importação automática) | Fricção de onboarding confirmada por pesquisa com usuários |
| Portal B2B para profissionais de saúde | Demanda validada: 10+ médicos solicitando acesso |
| Multi-perfil família (gerenciar múltiplos pacientes) | 50+ usuários ativos, pedidos recorrentes |
| Offline-first com sync (IndexedDB) | Reclamações de usuários em áreas com conectividade ruim |
| Integração com Meu SUS Digital / Conecte SUS | API pública disponível, demanda validada |
| Integração com eRx (Memed, iClinic) | Parceria formal estabelecida |
| Backup automático criptografado | Demanda validada, custo de storage viável |
| App nativo React Native | >1.000 usuários ativos, limitação PWA confirmada |
| i18n (PT-PT, ES-LATAM) | Expansão internacional com usuários confirmados |

---

## 5. MODELO DE NEGÓCIO E MONETIZAÇÃO

### 5.1. Filosofia atual: Gratuito como estratégia, não como concessão

**O princípio "custo R$0" não é limitação — é vantagem competitiva.**

O produto opera com custo zero real: Vercel Hobby (deploy gratuito), Supabase free tier (Postgres + Auth), Meta Cloud API (1000 conversações/mês grátis), Groq free tier (LLM). Isso permite oferecer funcionalidades essenciais **sem nunca cobrar o paciente** — uma promessa difícil de ser mantida por concorrentes com infraestrutura cara.

Esta posição de "gratuito para sempre nas funcionalidades essenciais" é o principal driver de confiança e crescimento orgânico.

### 5.2. Fluxos de receita (ordenados por viabilidade temporal)

#### 5.2.1. Afiliação com farmácias (curto prazo — Backlog, gatilho 100 usuários)

**Modelo:** Quando o app detecta estoque baixo, exibe botão "Comprar agora" com comparação de preços (CliqueFarma, Consulta Remédios API). CPA (custo por aquisição) por compra realizada.

**Vantagem competitiva:** O app já tem os dados de estoque e consumo — sabe exatamente quando o paciente precisa comprar, qual medicamento, e em que quantidade. Isso gera relevância altíssima para o anunciante e baixíssima intrusão para o usuário.

**Estimativa conservadora:** 100 usuários ativos, 2 reposições/mês/usuário, conversão 20%, ticket médio R$50, comissão 5% → R$100/mês. Escala linearmente.

**Stack técnico:** Nenhuma serverless function nova (integrar no router existente `api/share.js` ou novo endpoint dentro do budget). Deep link para apps de farmácia.

#### 5.2.2. Programas de Suporte ao Paciente (PSP) — médio prazo (B2B2C)

**Modelo:** Laboratório farmacêutico licencia o app para programa de adesão de uma molécula específica (ex: programa de adesão de anti-hipertensivos). White-label ou co-branded.

**Quando:** Após 500+ usuários ativos com dados de adesão demonstráveis. O dado de "adesão média de 85% com o app vs 50-60% sem app" é o argumento de venda.

**Pricing referência:** Fee anual fixo + per-patient-per-month (R$10-30/paciente ativo, dependendo de funcionalidades).

**Requisito técnico para habilitar:** Multi-perfil (um usuário pode ser "paciente do programa X"), dashboard B2B separado, RWE pipeline anonimizado.

#### 5.2.3. Planos de saúde e operadoras — longo prazo (B2B2C)

**Modelo:** Operadora oferece o app como benefício para beneficiários com doenças crônicas. Per-beneficiary-per-month (R$5-15).

**ROI para a operadora:** Redução de internações evitáveis por descompensação de crônicos. Com adesão 30% maior, estimativa de redução de sinistralidade de 10-15% em crônicos descompensados.

**Quando:** Após evidência clínica (estudo com dados reais do app, parceria com universidade pública).

#### 5.2.4. Dados anonimizados (RWE) — longo prazo (B2B)

**Modelo:** Relatórios agregados de adesão, padrões de uso, taxas de abandono por classe terapêutica — vendidos para indústria farmacêutica como Real-World Evidence.

**Requisito crítico:** LGPD-native desde o início. Consentimento explícito, dados anonimizados, DPO designado antes de qualquer comercialização.

### 5.3. Caminho para monetização sem comprometer a missão

```
Hoje (v3.1.0)
  └─ 100% gratuito, custo R$0
       │
       ▼
Fase 7 (WhatsApp + Cuidador) — 100+ usuários ativos
  └─ Afiliação farmácia ativada (R$ simbólico, testa o modelo)
  └─ Continua 100% gratuito para o paciente
       │
       ▼
Fase 8 + 200 usuários ativos
  └─ PSP piloto com 1 laboratório (prova de conceito)
  └─ Dados de adesão como argumento de vendas
       │
       ▼
500+ usuários, evidência clínica
  └─ Contratos B2B2C com planos de saúde
  └─ RWE pipeline habilitado com LGPD
```

---

## 6. ARQUITETURA DE SISTEMA

### 6.1. Arquitetura atual (v3.1.0)

```
CLIENTE (PWA — React 19 + Vite 7)
│
│  Navegação view-based (sem React Router)
│  Views: dashboard | medicines | stock | protocols | history | settings
│  DashboardProvider (context global compartilhado)
│  useCachedQuery (SWR-like, cache client-side)
│  Analytics: localStorage only (privacy-first)
│
├── src/features/
│   ├── adherence/     (streaks, trends, widgets)
│   ├── dashboard/     (analytics, insights, widgets)
│   ├── medications/   (CRUD + base ANVISA)
│   ├── protocols/     (protocolos, titulação)
│   └── stock/         (estoque, análise de custo)
│
├── src/schemas/       (Zod 4 — fonte única de verdade)
├── src/shared/        (componentes, hooks, utils, styles)
└── src/utils/         (dateUtils, adherenceLogic, titrationUtils)
        │
        ↓ HTTPS / Supabase SDK (RLS enforced)
SUPABASE (Backend-as-a-Service)
├── PostgreSQL (dados transacionais)
├── Auth (JWT, sessões automáticas)
├── RLS (Row Level Security — cada usuário vê apenas seus dados)
└── Realtime (não usado ainda — potencial futuro)
        │
        ↓ Vercel Serverless (máx 12 funções — Hobby plan)
VERCEL SERVERLESS FUNCTIONS
├── api/telegram.js    (webhook Telegram, maxDuration: 10s)
├── api/notify.js      (cron orchestrator, maxDuration: 60s)
├── api/share.js       (PDF sharing via Vercel Blob)
├── api/dlq.js         (Dead Letter Queue admin)
├── api/gemini-reviews.js (code review automático)
└── api/health/notifications.js (health check)
— Budget: 6/12 funções usadas —
        │
TELEGRAM BOT (Node.js — server/bot/)
├── commands/          (/start, /hoje, /registrar, /estoque)
├── callbacks/         (confirmação de doses, ações)
├── scheduler.js       (cron jobs)
└── tasks.js           (formatadores, schedulers)
```

### 6.2. Arquitetura alvo (Fase 7 — WhatsApp)

```
CLIENTE (PWA — mesma arquitetura)
        │
        ↓
SUPABASE (mesma)
        │
        ↓
VERCEL SERVERLESS (mesmo budget — adapter pattern)
├── api/telegram.js     (existente — sem mudança)
├── api/whatsapp.js     (NOVO — Meta Cloud API webhook)  ← +1 função
├── api/notify.js       (expandido para multi-canal)
├── api/share.js        (existente)
├── api/dlq.js          (existente)
├── api/gemini-reviews.js (existente)
└── api/health/notifications.js (existente)
— Budget: 7/12 funções usadas — 5 de margem —

BOT ENGINE (Adapter Pattern)
├── BotAdapter (interface)
│   ├── TelegramAdapter (atual)
│   └── WhatsAppAdapter (Fase 7)
├── MessageFormatter (canal-agnóstico)
└── NotificationOrchestrator (choose channel por user pref)
```

### 6.3. Limitações técnicas e mitigações

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| Vercel Hobby: 12 functions máx | Não pode adicionar endpoints indefinidamente | Router pattern (DLQ router, Gemini router). Budget atual: 6/12 |
| Supabase Free: 500MB storage | Logs antigos podem esgotar o storage | Política de retenção de logs (90 dias), cleanup automático |
| Supabase Free: 5GB bandwidth | Pode esgotar com muitos usuários | Cache agressivo client-side, lazy loading de assets |
| PWA: não está no App Store | Menor discoverability, iOS limitado | ASO para web app, instalação guiada no onboarding |
| iOS Web Push limitado | Notificações menos confiáveis em iOS sem instalação | Fallback para Telegram/WhatsApp para usuários iOS |
| Web Speech API: cobertura parcial | Funcionalidade de voz não funciona em todos os browsers | Feature flag, graceful degradation, fallback texto |

---

## 7. EXPERIÊNCIA DO USUÁRIO — PRINCÍPIOS E JORNADAS

### 7.1. Princípios de UX

1. **Atividade sobre entidade** — O usuário pensa em "tomar remédios hoje", não em "gerenciar medicamentos". A navegação reflete isso: Hoje | Tratamento | Estoque | Perfil.

2. **Zero curva de aprendizado para ações críticas** — Registrar uma dose deve ser atingível em 1 tap da tela principal.

3. **Informação em camadas** — Dashboard mostra resumo; drill-down disponível para quem quer detalhes. Dona Maria vê o essencial; Carlos vê os dados completos.

4. **Multicanal sem atrito** — Push, Telegram, WhatsApp — o paciente escolhe seu canal. O app não força a instalação para entregar valor.

5. **Gamificação sem infantilizar** — Streaks e badges celebram consistência sem parecer "jogo de criança". O tom é encorajador, não punitivo.

6. **Acessibilidade para 60+** — Fontes grandes, alto contraste, suporte a voz, interface para telas menores.

### 7.2. Jornada de ativação (time-to-value < 5 minutos)

```
1. Acessa o app pela primeira vez
2. Cria conta (e-mail + senha ou magic link)
3. Wizard de onboarding: "Qual medicamento você toma?"
   └── Autocomplete ANVISA preenche name + activeIngredient automaticamente
   └── Define dosagem (manual — não disponível no CSV ANVISA)
   └── Define horários de dose
4. Primeiro lembrete configurado em < 3 minutos
5. Push notification ou Telegram configurado
6. ✓ Primeiro valor entregue
```

### 7.3. Loop de engajamento diário

```
MANHÃ
  └── Push/Telegram/WhatsApp: "Hora da sua losartana! Tap para confirmar."
  └── Usuário abre app OU confirma diretamente no chat
  └── Dose registrada → estoque decrementado
  └── Streak incrementado → badge se marco atingido

TARDE/NOITE
  └── Dashboard mostra progresso do dia: "2/3 doses tomadas"
  └── Insight proativo (Fase 6): "Você costuma perder a dose das 22h nas sextas"

SEMANAL
  └── Parceiro de responsabilidade recebe resumo via WhatsApp (Fase 7)
  └── "Ana Paula: sua mãe teve 85% de adesão esta semana. Parabéns!"

ANTES DA CONSULTA
  └── Usuário gera PDF de adesão
  └── Médico recebe dados objetivos pela primeira vez
```

---

## 8. GO-TO-MARKET (GTM)

### 8.1. Fase atual: produto pessoal → primeiros 100 usuários

O produto foi desenvolvido pelo criador para uso próprio — o dogfooding mais genuíno possível. A primeira coorte de usuários deve vir de redes próximas (amigos, família, colegas) antes de qualquer esforço de marketing pago.

**Canais de aquisição orgânicos (custo zero):**

| Canal | Ação | Meta |
|-------|------|------|
| **Redes pessoais** | Compartilhar o app com amigos e família que têm doenças crônicas | Primeiros 20 usuários |
| **Comunidades online** | Grupos de WhatsApp/Facebook de pacientes crônicos (hipertensão, diabetes, doenças autoimunes) | +50 usuários |
| **LinkedIn/Twitter/Instagram** | Posts sobre o problema de adesão, screenshots do app, compartilhamento de resultados pessoais | +50 usuários orgânicos |
| **Reddit (r/diabetes_brasil, r/saude)** | Presença com valor — responder dúvidas, não spam | +30 usuários |
| **SEO** | Artigos sobre "como não esquecer remédios", "controlar medicamentos crônicos" | Tráfego orgânico de longo prazo |

**Meta fase atual:** 50 MAU (Monthly Active Users) antes de iniciar a Fase 7.

### 8.2. Fase de crescimento (Fase 7 — WhatsApp ativo)

Com WhatsApp integrado, o produto tem **loop viral natural:**

```
Paciente usa o app
    └── Cuidador recebe resumo semanal via WhatsApp
        └── Cuidador pergunta "que app é esse?"
            └── Paciente compartilha link de instalação
                └── Cuidador instala para acompanhar outro paciente
```

**Canais pagos (quando houver receita):**
- Google Ads (Search): "app lembrete remédio", "controle diabetes app", "hipertensão medicamentos" — CAC estimado R$20-40
- Meta Ads: segmentação por interesse em saúde, 50+, lookalike de instaladores

**Parcerias estratégicas (sem custo inicial):**
- Farmácias parceiras: distribuição de QR-code do app em compras de medicamentos de uso contínuo
- Influenciadores médicos no Instagram/YouTube (médicos de família, endocrinologistas, cardiologistas)
- Associações de pacientes: ANAD (diabetes), grupos de hipertensão, associações de doenças autoimunes

### 8.3. Estratégia de retenção

| Alavanca | Mecanismo | Fase |
|----------|-----------|------|
| **Streaks** | Dias consecutivos sem miss → badge progressivo | Atual |
| **Score de risco** | Usuário vê que está "descorrilhando" → motivação para retomar | 6 |
| **Parceiro de responsabilidade** | Familiar acompanha → compromisso social | 7 |
| **Chatbot contextual** | Responde dúvidas no canal preferido → substitui pesquisa no Google | 8 |
| **Portabilidade clínica** | PDF para o médico → prova de valor tangível em consultas | Atual (5) |
| **Base ANVISA** | Onboarding 5x mais rápido → menos fricção = menos abandono | 5 |

---

## 9. MÉTRICAS-CHAVE (KPIs)

### 9.1. Produto e engajamento

| Métrica | Meta Fase 5-6 | Meta Fase 7-8 |
|---------|---------------|---------------|
| **MAU (Monthly Active Users)** | 50+ | 200+ |
| **DAU/MAU ratio** | >30% | >40% |
| **Retenção D7** | >50% | >60% |
| **Retenção D30** | >40% | >50% |
| **Streak médio** | >5 dias | >10 dias |
| **Doses registradas/dia/usuário** | >2 | >3 |
| **Instalações PWA** | >30% dos mobile | >40% dos mobile |

### 9.2. Qualidade técnica

| Métrica | Meta |
|---------|------|
| Testes críticos passando | 100% (93/93 hoje) |
| Bundle size | <1MB |
| Lighthouse PWA | >=95 |
| Lighthouse Performance | >=90 |
| Tempo de resposta dashboard | <50ms |

### 9.3. Impacto clínico (proposta de valor validável)

| Métrica | Definição | Meta |
|---------|-----------|------|
| **Aumento de adesão** | Δ% adesão após 30 dias de uso contínuo | +30% vs. baseline do usuário |
| **Taxa de adesão média** | % doses tomadas vs. programadas (agregado) | >80% |
| **NPS do app** | Net Promoter Score (survey in-app) | >50 |

### 9.4. Negócio (quando monetização ativa)

| Métrica | Meta (afiliação farmácia) | Meta (PSP B2B) |
|---------|---------------------------|----------------|
| **Conversão de recomendação** | >15% cliques → compra | N/A |
| **MRR** | R$500+ | R$10k+ |
| **LTV/CAC** | >10x | >20x |

---

## 10. RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Vercel Hobby: 12 functions esgotadas** | Média | Alto | Router pattern mantém 6/12 livres. Antes de qualquer nova function, verificar budget em `api/CLAUDE.md` |
| **Supabase Free 500MB esgotado** | Média | Alto | Política de retenção de logs (90 dias), cleanup automático, monitoramento de uso |
| **Meta Business verificação negada/demora** | Alta | Médio | Iniciar processo 4-8 semanas antes do desenvolvimento da Fase 7 |
| **iOS Web Push não funciona sem instalação** | Alta | Médio | Fallback para Telegram/WhatsApp. Guia de instalação PWA proeminente no onboarding |
| **Web Speech API limitado no iOS** | Média | Baixo | Feature flag. Graceful degradation para input de texto |
| **LGPD — cuidador com acesso a dados médicos** | Média | Alto | Consentimento explícito duplo (paciente + cuidador). Dados mínimos. Link com expiração. DPO designado antes de comercializar |
| **Groq free tier descontinuado** | Baixa | Baixo | Chatbot é feature condicional. Alternativas: Cloudflare Workers AI (gratuito), Ollama self-hosted |
| **Concorrência (Medisafe entrando no Brasil)** | Baixa | Médio | Diferenciação via WhatsApp-nativo, ecossistema ANVISA, portabilidade clínica, custo zero genuíno |
| **Baixa adoção por pacientes idosos** | Média | Médio | UX para 60+, voz (Fase 8), WhatsApp como canal principal, onboarding via cuidador |
| **Dados insuficientes para insights da Fase 6** | Média | Baixo | UI adaptativa com threshold de 14 dias. Onboarding guiado incentiva preenchimento histórico |

---

## 11. DIFERENCIAIS COMPETITIVOS vs. MERCADO BRASILEIRO

### 11.1. Análise competitiva

| Competidor | Pontos fortes | Pontos fracos | Nossa vantagem |
|------------|---------------|----------------|----------------|
| **Medisafe** (global) | UX polida, ampla base global | Sem integração ANVISA, sem WhatsApp, sem SUS, pago (premium) | Ecossistema local, gratuito total, WhatsApp |
| **MyTherapy** (global) | Gamificação, cuidador básico | Sem BR, sem WhatsApp, UI em inglês | Português nativo, WhatsApp, ANVISA |
| **Pillbox** (apps locais genéricos) | Simples, gratuito | Só alarmes, sem IA, sem portabilidade clínica | Tudo o que eles têm + inteligência |
| **Aplicativo de farmácia** (Drogasil, Raia) | Alta confiança, delivery integrado | Propósito de venda, não de saúde; sem adesão | Independente, focado no paciente |

### 11.2. Diferenciais proprietários

1. **WhatsApp-nativo** — 147M brasileiros. O lembrete chega onde o paciente já está, sem instalar nada.

2. **Portabilidade clínica real** — PDF médico profissional + cartão de emergência + exportação completa. O paciente é dono dos seus dados.

3. **Base ANVISA integrada** — Autocomplete de 10.206 medicamentos registrados no Brasil. Onboarding 5x mais rápido.

4. **Inteligência client-side** — Predições de reposição, score de risco, otimizador de horário — calculados no browser, sem custo de servidor, sem exposição de dados.

5. **Gratuito para sempre nas essencialidades** — Não existe paywall para funcionalidades de saúde críticas. Nunca.

6. **Titulação de doses** — Suporte nativo a protocolos complexos com doses variáveis ao longo do tempo (desmame de corticoides, titulação de anti-hipertensivos). Nenhum concorrente mainstream suporta.

7. **IA conversacional acessível** — Chatbot contextual que responde dúvidas sobre medicamentos no canal preferido do usuário (WhatsApp ou Telegram), com dados do próprio histórico de adesão como contexto.

---

## 12. CONSIDERAÇÕES REGULATÓRIAS (LGPD e ANVISA)

### 12.1. LGPD — compliance desde o design

| Requisito | Status atual | Próximos passos |
|-----------|-------------|-----------------|
| Consentimento explícito | Implícito no cadastro | Tela de consentimento explícito antes de usar |
| Política de privacidade | Ausente | Criar antes de escalar usuários |
| DPO designado | N/A (uso pessoal) | Obrigatório antes de B2B2C |
| Dados de saúde (dados sensíveis) | Armazenados no Supabase com RLS | Criptografia adicional em campos sensíveis ao escalar |
| Portabilidade de dados | Exportação CSV/JSON disponível | Formalizar como direito do usuário |
| Cuidador com acesso a dados | Não implementado ainda | Consentimento duplo + link com expiração (Fase 7) |

### 12.2. ANVISA — Software como Dispositivo Médico (SaMD)

O app **não é classificado como SaMD** enquanto:
- Não calcula doses médicas individualizadas
- Não faz diagnóstico
- Não prescreve tratamentos
- Não substitui decisão médica (disclaimer obrigatório no chatbot IA)

O risco de reclassificação aumenta se:
- Implementar alertas de interação medicamentosa com recomendações de conduta (F8.2 deve ser informativo, não prescritivo)
- Implementar predição de risco com sugestão de ajuste de medicação

**Ação preventiva:** Consulta formal com advogado especializado em saúde digital antes de lançar F8.2 (interações medicamentosas).

---

## 13. ROADMAP EXECUTIVO CONDENSADO

```
2026 Q1 — FECHAR FASE 5 (v3.2.0)
  └── F5.10 Análise de Custo (5 SP)
  └── F5.6 Base ANVISA + Autocomplete (13 SP)
  └── Meta: 20+ MAU, produto com base sólida de dados

2026 Q2 — FASE 6: INTELIGÊNCIA (v3.3.0)
  └── Previsão de reposição + Score de risco (I01, I04)
  └── Heatmap de padrões + Otimizador de horário (I02, I03)
  └── Análise de custo avançada + Integrações (I05, INT-01, INT-02)
  └── Meta: 50+ MAU, app proativo e não apenas reativo
  └── Iniciar verificação Meta Business (ação crítica)

2026 Q3 — FASE 7: CRESCIMENTO (v4.0.0)
  └── WhatsApp Bot (W01) + Seleção de canal (W02)
  └── Alertas inteligentes multi-canal (W03)
  └── Parceiro de responsabilidade (C02) + Modo cuidador (C01)
  └── Meta: 150+ MAU, loop viral via WhatsApp ativo
  └── Primeira receita: afiliação farmácia (se 100+ usuários atingido)

2026 Q4 — FASE 8: EXPERIÊNCIA INTELIGENTE (v4.1.0)
  └── Chatbot IA Groq (F8.1)
  └── Interface de voz: registro + resumo (V01, V02)
  └── Interações medicamentosas ANVISA (F8.2)
  └── Meta: 300+ MAU, produto com "wow factor" genuíno

2027 — ESCALA E MONETIZAÇÃO
  └── PSP piloto com laboratório farmacêutico (200+ usuários com dados)
  └── Multi-perfil família (50+ usuários ativos)
  └── Portal profissional de saúde (demanda validada)
  └── Meta: 1.000+ MAU, primeiras parcerias B2B2C formalizadas
```

---

## APÊNDICE: DADOS TÉCNICOS RÁPIDOS

### Arquivos canônicos do projeto

| Domínio | Localização |
|---------|-------------|
| Schemas Zod | `src/schemas/` (único local — usar `@schemas/`) |
| Feature services | `src/features/*/services/` |
| Shared services | `src/shared/services/` |
| Adherence/DLQ services | `src/services/api/` |
| Componentes compartilhados | `src/shared/components/` |
| Hooks | `src/shared/hooks/` |
| Utils | `src/utils/` (dateUtils, adherenceLogic, titrationUtils) |
| Views | `src/views/` |
| Serverless functions | `api/*.js` (max 12) |
| Telegram bot | `server/bot/` |

### Comandos de validação

```bash
npm run validate:agent    # OBRIGATÓRIO antes de qualquer push (10-min timeout)
npm run test:critical     # Services, schemas, utils, hooks
npm run test:changed      # Só arquivos alterados desde main
npm run validate:quick    # Lint + test:changed (pré-commit)
npm run validate:full     # Lint + coverage + build (CI completo)
```

### Regras críticas de desenvolvimento

- Hook order: States → Memos → Effects → Handlers (previne TDZ)
- Datas: sempre `parseLocalDate()`, nunca `new Date('YYYY-MM-DD')`
- Zod enums: sempre em português (`'diario'`, `'semanal'`)
- Dosagem: sempre em comprimidos, nunca em mg (`quantity_taken <= 100`)
- Serverless: verificar budget (`api/CLAUDE.md`) antes de criar novo `.js`
- Imports: sempre aliases (`@schemas/`, `@shared/`, etc.), nunca caminhos relativos longos

---

*Documento criado em: 06/03/2026*
*Versão do produto de referência: v3.1.0*
*Roadmap de referência: `plans/ROADMAP_v4.md`*
*Baseado em: `plans/brainstorming-canvas-produto.md`*
