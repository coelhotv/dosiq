# Dosiq — Documento de Produto

**Versão:** 1.1  
**Data:** Maio 2026  
**Classificação:** Interno — Produto, Marketing, Ops, Stakeholders, Investidores

---

## Sumário Executivo

O Dosiq é uma plataforma brasileira de gerenciamento pessoal de medicamentos — disponível como **app nativo (iOS e Android via React Native/Expo)** e como **PWA web**, compartilhando o mesmo backend, design system e lógica de negócio num monorepo unificado. É gratuito, funciona offline, inclui **chatbot IA** contextual via Groq, se integra ao Telegram — e entrega ao paciente algo que nenhum aplicativo de saúde no Brasil entrega hoje com a mesma profundidade: **clareza total sobre o próprio tratamento, a qualquer hora, em qualquer dispositivo**.

A proposta de valor é simples o suficiente para uma avó e sofisticada o suficiente para um paciente cardiovascular com seis protocolos paralelos. O mesmo produto, a mesma qualidade de experiência, para os dois.

---

## 1. O Problema que o Dosiq Resolve

A adesão ao tratamento medicamentoso é um dos maiores desafios de saúde pública no Brasil. Dados globais indicam que pacientes com doenças crônicas tomam, em média, apenas 50% das doses prescritas. As razões são conhecidas: esquecimento, rotinas caóticas, embalagens confusas, múltiplos horários, estoque que acaba sem aviso, e nenhum sistema que una tudo num único lugar de fácil acesso.

O impacto é direto: internações evitáveis, progressão de doenças controláveis, custos elevados para o sistema de saúde e perda de qualidade de vida do paciente.

O mercado brasileiro carece de soluções que combinem:

1. **Acessibilidade real** — sem paywall, sem instalação obrigatória, sem curva de aprendizado
2. **Integração nativa com os canais que o brasileiro já usa** — WhatsApp, não app proprietário
3. **Inteligência clínica client-side** — dados do próprio paciente gerando insights sem expor informações a terceiros
4. **Design que não intimida** — tanto para Dona Maria, 68 anos, 2 medicamentos, quanto para Carlos, 45 anos, seis protocolos simultâneos

O Dosiq foi construído para resolver exatamente isso.

---

## 2. O Que é o Dosiq

O Dosiq é um **PWA de gerenciamento pessoal de medicamentos**, acessível diretamente pelo navegador de qualquer smartphone. Não exige instalação pela App Store ou Google Play — funciona como um site que se comporta como um app, pode ser adicionado à tela inicial com um toque, e opera com suporte parcial a modo offline.

O paciente registra seus remédios, configura protocolos de dosagem (horários, frequências, titulações), controla o estoque, acompanha sua adesão ao longo do tempo e recebe alertas inteligentes pelo canal que já tem aberto: Telegram hoje, WhatsApp em breve.

É gratuito. Sem freemium escondido. Sem limite de medicamentos. Sem expiração.

### O que o Dosiq não é

Não é um prontuário eletrônico. Não é uma plataforma de telemedicina. Não é um marketplace de farmácia. Não é um app de prescrição médica. O Dosiq é **a ferramenta do paciente** — o lado do paciente numa relação que começa na consulta médica e precisa continuar por meses ou anos em casa.

---

## 3. Para Quem é o Dosiq

O Dosiq serve quatro perfis de usuário. O produto adapta automaticamente sua densidade e linguagem ao perfil detectado — sem configuração manual.

### Persona 1 — Dona Maria (paciente simples)
67 anos, hipertensa e diabética. Viúva, mora sozinha em São Paulo, aposentada, usa SUS e Farmácia Popular. Smartphone Android básico, WhatsApp diariamente, baixa familiaridade com apps. Toma 5 medicamentos em horários variados; já teve episódio de hiperglicemia por esquecer a metformina. Não sabe explicar ao médico o que tomou no mês. O que ela precisa: lembrete claro no WhatsApp, PDF simples para levar à UBS, filha recebendo alerta quando ela perde doses.

**Interface em modo Simples:** botões grandes (64px), linguagem humana ("Tratamento em dia"), ação em um toque, sem densidade analítica.

### Persona 2 — Carlos (paciente complexo)
52 anos, executivo, hipertenso e dislipidêmico. Curitiba, iPhone, convênio SulAmérica. Viagens e finais de semana quebram a rotina. Quer dados para mostrar ao cardiologista. Precisa de streaks e score de risco para manter o hábito.

**Interface em modo Complexo:** dashboard analítico, barras de adesão por protocolo, score de risco, otimizador de horário de lembrete.

### Persona 3 — Ana (paciente jovem com protocolo complexo)
35 anos, desenvolvedora, recém-diagnosticada com lúpus. Regime de titulação (hidroxicloroquina + prednisona com desmame gradual). Quer timeline visual do desmame, histórico exportável para a reumatologista, interface moderna.

**Interface:** protocolos com titulação, timeline visual, exportação CSV/JSON, PWA instalada na tela home.

### Persona 4 — Ana Paula (cuidadora)
42 anos, filha de Dona Maria. Mora a 1h30 da mãe. Não sabe se a mãe está tomando os remédios. Quer ser avisada quando a mãe perde doses — via WhatsApp, sem instalar app.

**Superfície:** Parceiro de Responsabilidade (Fase 7) — resumo semanal via WhatsApp sem criar conta.

---

Os quatro perfis são servidos pelo mesmo produto. A adaptação de interface acontece automaticamente por complexidade detectada (≤3 meds = Simples, 4–6 = Moderado, 7+ = Complexo), com override manual nas configurações.

---

## 4. Proposta de Valor

### Para o paciente

**"Você nunca mais vai esquecer um remédio. E vai saber, a qualquer hora, se seu tratamento está em dia."**

- **Zero atrito no acesso:** Abre no navegador. Funciona offline. Pode ser instalado na tela inicial. Sem cadastro demorado — onboarding em 3 minutos.
- **Zero custo real:** Gratuito para sempre. Todas as funcionalidades essenciais. Sem trial, sem upgrade, sem limite de medicamentos.
- **Inteligência sem burocracia:** O app prevê quando o estoque vai acabar, calcula o horário ideal de cada lembrete baseado nos horários reais de tomada, e alerta quando um protocolo mostra sinais de risco — tudo calculado localmente, sem enviar dados para terceiros.
- **No canal que você já usa:** Lembretes e alertas chegam pelo Telegram (e em breve pelo WhatsApp). Não precisa abrir o app para confirmar que tomou o remédio.
- **Portabilidade clínica:** PDF de consulta médica pronto para imprimir ou compartilhar com o médico. Cartão de emergência offline com medicamentos e alergias. Exportação completa dos dados.

### Para o sistema de saúde

Melhor adesão ao tratamento significa menos internações por descompensação de doenças crônicas, menos complicações evitáveis, e pacientes mais preparados para consultas médicas com histórico de adesão documentado.

### Para parceiros e investidores

Uma base de usuários com dados de adesão medicamentosa de alta granularidade, num mercado de 215 milhões de pessoas com prevalência crescente de doenças crônicas, operando com custo marginal zero por usuário e sem paywall que limite o crescimento.

---

## 5. Visão de Produto

> **"A ferramenta indispensável para gestão de medicamentos no Brasil — gratuita, inteligente, integrada ao WhatsApp."**

A visão de longo prazo do Dosiq é tornar-se a camada de continuidade de cuidado entre consultas médicas. O médico prescreve; o Dosiq garante que o tratamento acontece, e documenta que aconteceu.

Isso tem cinco pilares estratégicos:

| Pilar | Descrição |
|-------|-----------|
| **Conveniência** | Registro de dose em um swipe. Lembrete no WhatsApp. Estoque controlado sem esforço. |
| **Inteligência** | Dados do próprio paciente gerando predições acionáveis. Client-side. Zero custo. |
| **Alcance** | Estar onde o paciente já está — WhatsApp, com 147M de usuários ativos no Brasil. |
| **Encorajamento** | Streaks, badges, gamificação sutil. Celebrar a disciplina do paciente. |
| **Wow Factor** | IA conversacional contextual, registro por voz, surpresas que fidelizam. |

---

## 6. Features Atuais (v3.3.0)

### 6.1 Registro de Doses

O gesto central do app: **swipe para a direita** confirma a dose. O dashboard organiza as doses do dia em zonas temporais dinâmicas (Atrasadas / Agora / Próximas / Mais tarde / Registradas), calculadas em tempo real relativo ao momento do usuário. Nunca é preciso procurar qual remédio tomar — ele está sempre na posição certa.

- Registro individual por swipe com micro-animação de confirmação
- Registro em lote (todos do mesmo horário ou todos do mesmo protocolo)
- Modo Consulta: interface simplificada para mostrar histórico ao médico
- Dosagens fracionadas, doses variáveis (titulação progressiva)
- Suporte a medicamentos "quando necessário" (sem protocolo fixo)

### 6.2 Gestão de Medicamentos e Protocolos

- Cadastro de medicamento com autocomplete via base ANVISA (6.816 medicamentos ativos)
- Frequências: diária, dias alternados, semanal, personalizada, quando necessário
- Titulação: doses que mudam ao longo do tempo (ex: escalonamento de antidepressivo)
- Wizard de cadastro unificado em 3 passos (Medicamento → Como tomar → Estoque)
- Agrupamento por planos de tratamento com emoji e cor personalizáveis (🫀 Cardiovascular, 🩸 Diabetes, etc.)
- Medicamentos inativos preservados no histórico

### 6.3 Controle de Estoque

- Rastreamento de quantidade em comprimidos (não miligramas)
- Previsão de esgotamento baseada no consumo real dos últimos 30 dias
- Alertas visuais por criticidade: Crítico (<7 dias), Baixo (<14 dias), Normal (<30 dias), Alto (≥30 dias)
- Análise de custo mensal por medicamento com projeção 3 meses
- Timeline visual de vigência de prescrições

### 6.4 Adesão e Histórico

- **Score de adesão:** porcentagem calculada com janela de 14 dias rolling, por protocolo e global
- **Streak:** dias consecutivos com adesão completa, com milestones celebrados visualmente
- **Ring Gauge animado:** visualização principal do score, com sparkline de 7 dias inline
- **Heatmap de adesão:** calendário com cores por dia (100% / parcial / zero / sem doses esperadas)
- **Score de risco por protocolo:** detecta protocolos com tendência negativa de adesão nos últimos 14 dias
- **Análise de padrão:** quais dias da semana e períodos do dia têm menor adesão
- Histórico completo com timeline de doses e filtros por período

### 6.5 Relatórios e Portabilidade Clínica

- **PDF de Relatório de Adesão:** gerado localmente (jsPDF), inclui score, streak, heatmap, histórico por protocolo. Formato para levar à consulta médica.
- **PDF de Resumo de Consulta:** visão condensada e clínica do tratamento atual
- **Cartão de Emergência:** página offline com medicamentos, doses e alergias, acessível sem login
- **Exportação de dados:** CSV e JSON com histórico completo (LGPD: o paciente é dono dos seus dados)
- **Compartilhamento via link:** PDF gerado e hospedado temporariamente via Vercel Blob

### 6.6 Notificações e Canais

- **Push Notifications PWA:** alertas de dose diretamente no navegador, sem app instalado
- **Bot Telegram:** lembretes de dose, alertas de estoque baixo, resumo diário de adesão, relatório semanal e mensal, confirmação de dose pelo próprio Telegram (sem abrir o app)
- **Alertas proativos:** bot verifica ativamente se doses foram registradas e dispara lembretes contextuais
- **DLQ (Dead Letter Queue):** fila de notificações falhas com retry automático e painel de admin

### 6.7 Inteligência Client-Side (Fase 6 — Insights)

Todos os cálculos acontecem no dispositivo do usuário, sobre o cache local. Sem chamadas adicionais ao servidor, sem exposição de dados, com custo operacional zero.

- **Previsão de reposição:** data exata de esgotamento baseada no consumo real (não na dose prescrita)
- **Otimizador de lembrete:** calcula o horário ideal de alerta baseado nos horários reais de tomada dos últimos 30 dias
- **Análise de custo avançada:** custo real por dose (consumo real × preço unitário), não apenas custo teórico
- **Score de risco por protocolo:** adesão 14d rolling + tendência de piora = score de risco de 0-100

### 6.8 Chatbot IA (em produção)

O Dosiq inclui chatbot IA contextual via Groq SDK (`api/chatbot.js`, slot 7/12 das serverless functions). O chatbot recebe o histórico da conversa e um system prompt com contexto clínico do paciente (medicamentos ativos, protocolos, histórico de adesão), e responde a perguntas sobre medicamentos, horários e dúvidas de tratamento. Modelo: `groq/compound` (configurável via `GROQ_MODEL`). Validação de input via Zod, histórico de mensagens com janela máxima configurável via `CHATBOT_MAX_HISTORY`. Disclaimer médico obrigatório no system prompt.

### 6.9 Estoque FIFO Auditável (v4.0.0)

A v4.0.0 evoluiu o domínio de estoque para um modelo transacional rastreável por lote. Cada dose registrada consome os lotes mais antigos primeiro (FIFO). Cada ajuste manual gera registro em `stock_adjustments`. O histórico de compras (`purchases`) é separado do saldo corrente — o paciente vê exatamente o que comprou quando, em qual farmácia, de qual laboratório, ao preço unitário registrado.

### 6.10 PWA e Performance

- **Instalável sem App Store:** adicionar à tela inicial via browser, funciona como app nativo
- **Offline parcial:** dados em cache, doses registradas offline, sync quando reconectar
- **Bundle otimizado:** 102 kB gzip (redução de 89% desde o início — de 989 kB originais)
- **First Load JS:** 678 kB (redução de 53% via lazy loading agressivo)
- **Auth roundtrip:** 1 (reduzido de 13 originais por session)
- **Lighthouse PWA e Performance:** ≥90 ambos

### 6.11 Segurança e Privacidade

- **Supabase Auth** com Row Level Security (RLS) — cada usuário acessa apenas seus próprios dados
- **LGPD-ready:** exportação completa, deleção sob demanda, sem compartilhamento com terceiros
- **Zero telemetria de dados clínicos:** analytics é localStorage apenas (eventos de navegação, sem dados de medicamentos ou doses)
- **Sem paywall = sem modelo de monetização baseado em dados clínicos**

---

## 7. Plataformas, Canais e Formatos de Acesso

### Plataformas

| Plataforma | Status | Detalhes |
|------------|--------|---------|
| **App iOS** | ✅ Produção | React Native 0.79 + Expo 53, bundle ID `com.coelhotv.dosiq`, iOS 15.5+ |
| **App Android** | ✅ Produção | React Native 0.79 + Expo 53, package `com.coelhotv.dosiq`, edge-to-edge |
| **PWA (Web)** | ✅ Produção | React 19 + Vite 7, instalável via Chrome/Safari/Edge |

O monorepo `@dosiq` reúne `apps/web`, `apps/mobile` e `packages/` (tokens de design, core compartilhado). As apps nativa e web compartilham o mesmo Supabase, os mesmos schemas Zod via `@dosiq/core`, e o mesmo design system de tokens. A lógica de complexidade adaptativa (Dona Maria / Carlos) está implementada em ambas as plataformas.

### Canais de Notificação e Comunicação

| Canal | Status | Cobertura |
|-------|--------|-----------|
| **Push Notifications (nativo)** | ✅ Produção | expo-notifications + Firebase, iOS e Android |
| **Push Notifications (PWA)** | ✅ Produção | Web Push API (VAPID), melhor em Android |
| **Telegram Bot** | ✅ Produção | Lembretes, confirmações, alertas, relatórios |
| **WhatsApp Bot** | 🗓 Roadmap Fase 7 | Meta Cloud API, feature parity com Telegram |

### Distribuição

- **App Store (iOS):** distribuído via EAS Build + App Store Connect
- **Google Play (Android):** distribuído via EAS Build + Google Play Console
- **Web (PWA):** deploy no Vercel Hobby, instalável diretamente pelo browser
- **Builds:** `build-android.sh` e `build-ios.sh` com EAS (`eas.json` com profiles development/production)

---

## 8. Stack Tecnológico

### Web (`apps/web`)

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Frontend | React 19 + Vite 7 | Performance, ecossistema, produtividade |
| Animações | Framer Motion 12 | Micro-interações com significado clínico |
| Validação | Zod 4 (via `@dosiq/core`) | Schemas compartilhados, SSOT |
| Deploy | Vercel Hobby | Free tier, Edge Network, Serverless Functions |
| PDF | jsPDF + jspdf-autotable | Client-side, sem custo de servidor, offline |
| Testes | Vitest 4 + Testing Library | 539 testes, 100% passando |

### Mobile (`apps/mobile`)

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Framework | React Native 0.79 + Expo 53 | Code sharing, EAS Build, distribuição simplificada |
| Navegação | React Navigation 7 (Bottom Tabs + Native Stack) | Padrão RN, performance nativa |
| Notificações | expo-notifications + Firebase | Push confiável em iOS e Android |
| Armazenamento | AsyncStorage + expo-secure-store | Dados locais + credenciais seguras |
| Ícones | lucide-react-native | Mesmos ícones do web (consistência visual) |
| Analytics | Firebase Analytics | Eventos de uso, funil de ativação |
| Motor JS | Hermes (iOS e Android) | Performance e startup mais rápidos |
| Testes | Jest | Suite separada, `--passWithNoTests` |

### Compartilhado (`packages/`)

| Pacote | Conteúdo |
|--------|---------|
| `@dosiq/core` | Schemas Zod, utilitários de data, lógica de adesão, enums — SSOT para web e mobile |
| `@dosiq/design-tokens` | Tokens CSS/JS de cores, tipografia e espaçamento — consumidos por ambas as apps |

### Backend (compartilhado por ambas as plataformas)

| Componente | Tecnologia |
|------------|-----------|
| Banco de dados | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (JWT, sessões automáticas) |
| Serverless | Vercel Hobby (6/12 funções usadas) |
| Bot | Node.js + node-telegram-bot-api |

**Custo operacional atual:** R$0/mês. Todo o produto roda em tiers gratuitos de Supabase, Vercel, Firebase e Groq (chatbot IA).

---

## 9. Arquitetura de Design

O Dosiq usa o que internamente chamamos de **"Therapeutic Sanctuary"** — uma filosofia de design que rejeita a densidade caótica de apps médicos tradicionais em favor de espaço, hierarquia clara e calor humano.

### Dois modos, um design system

**Modo Simples ("Card Deck"):** Interface tátil e navegável por cartões. Cada cartão é uma unidade de ação. O CTA domina visualmente. Dados são traduzidos para linguagem antes de chegar à tela ("Tratamento em dia", não "93%").

**Modo Complexo ("Control Panel"):** Interface analítica e escaneável. Tabular, comparável, densa sem ser confusa. Métricas numéricas, barras de adesão por protocolo, ordenação por risco.

A transição entre os modos é automática, baseada no número de medicamentos ativos do paciente, e pode ser sobreposta manualmente nas configurações.

### Princípios de design que guiam cada tela

1. **Transformar números em histórias visuais** — dados brutos não motivam, histórias motivam
2. **Evoluir, não acumular** — enriquecer o que existe em vez de criar telas novas
3. **Surpreender quem é disciplinado** — micro-animações celebram a disciplina do paciente
4. **Escalar sem sobrecarregar** — a UI que serve 2 medicamentos adapta-se visualmente para 10
5. **Navegação por atividade, não por entidade** — Hoje / Tratamento / Estoque / Perfil, não Remédios / Protocolos / Histórico / Estoque

### Design tokens principais

- **Primary (Verde Saúde):** #006a5e — confiança, ação, progresso
- **Secondary (Azul Clínico):** #005db6 — seriedade, profissionalismo
- **Superfícies em camadas:** sem bordas de 1px — separação por variação de tom de fundo
- **Tipografia:** Public Sans (headlines, autoridade) + Lexend (corpo, legibilidade reduzida de ruído cognitivo)
- **Espaçamento mínimo de toque:** 56px (acomodação de tremores e motricidade reduzida)

---

## 10. Modelo de Negócio e Monetização

### Filosofia: gratuito como estratégia, não como concessão

O Dosiq opera com custo operacional zero real: Vercel Hobby, Supabase free tier, Meta Cloud API (1.000 conversas/mês grátis), Groq free tier. Isso permite oferecer todas as funcionalidades essenciais **sem nunca cobrar o paciente** — uma promessa difícil de ser mantida por concorrentes com infraestrutura cara. O Medisafe, por exemplo, restringiu o plano gratuito para 2 medicamentos em 2026. O Dosiq não seguirá esse caminho.

**Lembretes ilimitados, múltiplos medicamentos, histórico completo: gratuitos para sempre.**

### Fluxos de receita (ordenados por viabilidade temporal)

**1. Afiliação com farmácias (gatilho: 100+ usuários ativos)**
Quando o app detecta estoque baixo, exibe "Comprar agora" com comparação de preços (CliqueFarma, Consulta Remédios). CPA por compra realizada. O Dosiq tem a vantagem rara de saber exatamente quando o paciente vai precisar comprar, qual medicamento e em que quantidade — gerando relevância máxima para o anunciante e mínima intrusão para o usuário. Estimativa conservadora com 100 usuários: R$100/mês. Escala linearmente.

**2. Programas de Suporte ao Paciente — PSP (gatilho: 500+ usuários, dados de adesão demonstráveis)**
Laboratório farmacêutico licencia o app para programa de adesão de uma molécula específica. White-label ou co-branded. O dado "adesão média de 85% com o app vs 50% sem app" é o argumento de venda. Pricing referência: fee anual fixo + R$10–30/paciente ativo/mês.

**3. Planos de saúde e operadoras (longo prazo)**
Operadora oferece o app como benefício para beneficiários com doenças crônicas. R$5–15/beneficiário/mês. ROI para a operadora: redução de internações por descompensação de crônicos. Requer evidência clínica com dados reais + parceria com universidade.

**4. Real-World Evidence — RWE (longo prazo)**
Relatórios agregados e anonimizados de adesão, padrões de uso, taxas de abandono por classe terapêutica, vendidos para indústria farmacêutica. Requer LGPD-native, consentimento explícito, DPO designado.

### Caminho para monetização

```
Hoje — 100% gratuito, custo R$0
  ↓
Fase 7 (WhatsApp + Cuidador) — 100+ MAU
  → Afiliação farmácia ativada (R$ simbólico, prova de modelo)
  → Continua 100% gratuito para o paciente
  ↓
Fase 8 + 200 MAU — dados de adesão demonstráveis
  → PSP piloto com 1 laboratório
  ↓
500+ MAU + evidência clínica
  → Contratos B2B2C com planos de saúde
  → RWE pipeline habilitado com LGPD
```

### Considerações regulatórias

O Dosiq **não é classificado como Software como Dispositivo Médico (SaMD)** enquanto não calcula doses individualizadas, não faz diagnóstico e não prescreve tratamentos. O chatbot IA (Fase 8) deve incluir disclaimer médico obrigatório. A Fase 8.2 (interações medicamentosas ANVISA) deve ser informativa, não prescritiva — consulta jurídica especializada em saúde digital antes do lançamento.

---

## 11b. Roadmap

### Entregue (v4.0.0 — atual, Abril 2026)

- Fases 1–6 completas + Mobile Performance Initiative (M0-M8, P1-P4, D0-D3)
- App nativo iOS e Android (React Native + Expo 53)
- Monorepo unificado (`apps/web` + `apps/mobile` + `packages/`)
- Chatbot IA via Groq em produção (`api/chatbot.js`)
- Estoque FIFO auditável: `purchases` + `stock_consumptions` + `stock_adjustments`
- ANVISA `regulatory_category` integrada ao modelo de dados
- 539 testes passando. Bundle web 102 kB. Auth em 1 roundtrip. Lighthouse ≥90.

### Próximas fases

**Fase 7 — Crescimento e Alcance**
- Bot WhatsApp via Meta Cloud API (feature parity com Telegram, 1.000 conversas/mês grátis)
- Seleção de canal nas configurações (Telegram ou WhatsApp)
- Alertas inteligentes multi-canal usando outputs da Fase 6
- Modo Parceiro de Responsabilidade: familiar acompanha adesão pelo WhatsApp sem criar conta
- Modo Cuidador completo: read-only, multi-canal, consentimento duplo

**Fase 8 — Experiência Inteligente (parcialmente entregue)**
- ✅ Chatbot IA multi-canal via Groq — em produção
- 🗓 Registro de dose por voz: Web Speech API nativa, sem dependência externa
- 🗓 Resumo de doses por voz (Speech Synthesis)
- 🗓 Interações medicamentosas ANVISA: alertas automáticos baseados em base seed

**Backlog futuro (trigger-gated)**
- Portal B2B para profissionais de saúde (gatilho: demanda validada)
- Afiliação com farmácias CPA (gatilho: 100+ usuários ativos)
- Multi-perfil família (gatilho: 50+ usuários ativos)
- OCR de receita médica (gatilho: fricção de onboarding confirmada)
- i18n PT-PT, ES (gatilho: expansão internacional confirmada)

---

## 11. Análise Competitiva e Diferenciação

O Brasil tem aproximadamente 215 milhões de habitantes, com prevalência alta e crescente de diabetes (15M+), hipertensão (35M+), e doenças cardiovasculares. O mercado de saúde digital cresce aceleradamente, mas a oferta de ferramentas genuinamente acessíveis ao paciente comum — e não ao sistema de saúde corporativo — é escassa.

### Benchmark: principais players globais

O mercado global de medication management apps é maduro. Os líderes (MyTherapy, Medisafe, Pillo) cobrem bem os JTBDs fundamentais — lembretes, histórico, estoque — mas apresentam lacunas estruturais no contexto brasileiro:

| Dimensão | MyTherapy | Medisafe | Pillo | **Dosiq** |
|----------|-----------|----------|-------|-----------|
| **Custo** | Gratuito (B2B monetiza) | Freemium restritivo: limitou free a 2 medicamentos em 2026 (~US$40/ano premium) | Gratuito + anúncios + upgrades | **Gratuito total, sem paywall em saúde crítica** |
| **WhatsApp** | ❌ | ❌ | ❌ | **✅ (Telegram hoje, WhatsApp Fase 7)** |
| **Base local (ANVISA)** | ❌ | ❌ | ❌ | **✅ 6.816 medicamentos com autocomplete** |
| **Titulação de doses** | Básico | Básico | Básico | **✅ Nativo (timeline visual, fases automáticas)** |
| **PDF para médico** | Básico | Premium | Básico | **✅ Profissional, compartilhável, gratuito** |
| **Cartão de emergência offline** | ❌ | ❌ | ❌ | **✅** |
| **Inteligência client-side** | ❌ | ❌ | ❌ | **✅ Predição de reposição, score de risco, otimizador de horário** |
| **App nativo + PWA** | App nativo | App nativo | App nativo | **✅ App nativo (iOS/Android) + PWA** |
| **Cuidador via WhatsApp** | ❌ | ❌ | Caregiver básico | **🗓 Fase 7** |
| **Modo cuidador completo** | Parcial | Parcial | Parcial | **🗓 Fase 7** |
| **IA conversacional** | ❌ | ❌ | ❌ | **✅ Em produção (Groq, api/chatbot.js)** |
| **Registro por voz** | ❌ | ❌ | ❌ | **🗓 Fase 8 (Web Speech API)** |

### Jobs to Be Done que o Dosiq resolve melhor

**JTBD 1 — "Não quero esquecer nenhum remédio"**
Push nativo no app (iOS e Android via Expo/Firebase) + Telegram hoje + WhatsApp na Fase 7. O lembrete chega onde o paciente já está. Para Dona Maria: o WhatsApp que ela já usa. Para Carlos: o app nativo com notificações discretas.

**JTBD 2 — "Quero saber se meu tratamento está em dia"**
Score de adesão visual (Ring Gauge animado), sparkline de 7 dias, heatmap mensal, score de risco por protocolo. Não um número — uma história visual. E diferentemente dos concorrentes, isso está disponível gratuitamente para todos os usuários.

**JTBD 3 — "Não quero ficar sem medicamento"**
Previsão de esgotamento baseada no consumo real (não na dose teórica), alerta visual por criticidade, alertas proativos no bot. Fase 7: alerta de reposição diretamente no WhatsApp antes de acabar.

**JTBD 4 — "Quero ajudar alguém a tomar os remédios"**
No roadmap Fase 7: parceiro de responsabilidade recebe resumo semanal via WhatsApp sem precisar instalar nada. Modo cuidador completo com convite por link. **Este é o principal loop viral do produto** — o cuidador que descobre o app pelo paciente e instala para acompanhar outro familiar.

### Vantagens estruturais

**App nativo + PWA + bot num único produto** — Nenhum concorrente no Brasil oferece as três superfícies com paridade de features. O paciente escolhe como interagir: abre o app nativo no smartphone, acessa pelo browser no desktop, ou confirma doses diretamente no Telegram sem abrir nada.

**Custo zero genuíno** — Medisafe restringiu o plano gratuito em 2026 (2 medicamentos max). O Dosiq não tem e não terá paywall em funcionalidades que impactam diretamente a saúde. Lembretes ilimitados, múltiplos medicamentos, histórico completo — gratuitos para sempre.

**Alinhamento com o paciente, não com o pagador** — Sem modelo de monetização de dados clínicos. A ausência de conflito de interesse com planos de saúde, farmácias ou laboratórios é vantagem de credibilidade com o paciente e com reguladores.

**Contexto brasileiro nativo** — Base ANVISA integrada (não é um add-on), UI em português natural, fluxos pensados para o SUS e Farmácia Popular, WhatsApp como canal principal.

---

## 12. Estado Atual e Métricas de Qualidade (v4.0.0)

**Versão atual:** v4.0.0 (lançada em 02/04/2026)

A v4.0.0 é a maior evolução já feita no domínio de estoque: separação entre histórico de compras e saldo corrente, consumo FIFO transacional e rastreável por lote, e bot Telegram alinhado ao mesmo modelo da web. O chatbot IA via Groq (`api/chatbot.js`) está em produção como slot 7/12 das serverless functions.

### Métricas de Qualidade

| Métrica | Valor | Referência |
|---------|-------|-----------|
| Testes automatizados passando | 539/539 (100%) | Vitest 4 |
| Bundle size (gzip) | 102.47 kB | -89% vs. baseline original |
| First Load JS | 678 kB | -53% vs. baseline |
| Auth roundtrips por sessão | 1 | -92% vs. baseline (era 13) |
| Lighthouse PWA | ≥90 | — |
| Lighthouse Performance | ≥90 | — |
| Serverless functions usadas | 7/12 | Vercel Hobby budget |
| Custo operacional mensal | R$0 | Fases 1–8 (Groq free tier) |

### Arquitetura de estoque (v4.0.0)

A v4.0.0 introduziu um modelo de estoque completamente novo com três camadas:
- **`purchases`** — fonte canônica do histórico de compras, com pharmacy, laboratory, notes
- **`stock`** — saldo corrente por lote (separado do histórico)
- **`stock_consumptions`** — rastreia quais lotes cada dose registrada consumiu (FIFO auditável)
- **`stock_adjustments`** — auditoria de correções manuais

RPCs transacionais: `create_purchase_with_stock`, `consume_stock_fifo`, `restore_stock_for_log`, `apply_manual_stock_adjustment`.

---

## 13. Time e Governança

O Dosiq é desenvolvido por um time pequeno com ciclos curtos, processo de desenvolvimento orientado por memória institucional (DEVFLOW) e revisão de código automatizada via Gemini. Cada entrega passa por gates de qualidade automatizados antes de ir à produção.

Todo merge requer aprovação humana. Nenhum agente faz merge automático. O ciclo de desenvolvimento inclui registro de anti-padrões, regras e decisões arquiteturais que alimentam a memória do time para sprints futuros.

---

## 14. Posicionamento de Marca

### Nome
**Dosiq** — evocação de "dose" com sufixo que sugere precisão e controle. Memorável, curto, sem ambiguidade de pronúncia em português.

### Tagline
*"Cuide do seu tratamento. Nós lembramos por você."*

### Tom de voz

Quente e direto. Como um amigo bem-informado, não um software médico. Sempre português brasileiro. Sem jargão clínico sem necessidade. Sem tom de superioridade ou paternalismo.

| Em vez de | Usar |
|-----------|------|
| "Otimização terapêutica" | "Seu tratamento em dia" |
| "Solução inovadora de adesão" | "Registre suas doses sem esquecer" |
| "Gestão farmacológica avançada" | "Controle seus medicamentos" |
| "Experiência premium de saúde" | "Mais clareza para cuidar da sua saúde" |

### Identidade visual
**Verde Saúde (#006a5e)** como cor primária — confiança, natureza, saúde. **Azul Clínico (#005db6)** como cor secundária — seriedade, profissionalismo médico. Interface editorial, respirada, com hierarquia clara. Sem bordas decorativas. Sem agressividade visual.

---

## 15. Por Que Agora

O crescimento do uso de smartphones entre idosos brasileiros (acelerado pela pandemia), a massificação do WhatsApp como canal de comunicação primário, e o aumento da prevalência de doenças crônicas que exigem múltiplos medicamentos criam uma janela de oportunidade singular.

O sistema público de saúde brasileiro não tem capacidade de acompanhar individualmente a adesão ao tratamento de milhões de pacientes crônicos. As farmácias não têm incentivo estrutural para promover adesão (o paciente que esquece o remédio compra de novo). Os planos de saúde internalizam o custo das complicações mas não têm ferramenta de prevenção voltada ao paciente.

O Dosiq preenche esse vazio com custo zero ao paciente e custo operacional próximo de zero ao produto.

---

*Documento elaborado pelo time de Produto — Maio 2026.*  
*Versão de produto de referência: v4.0.0 (Abril 2026).*  
*Atualizar a cada release major (vX.0.0) ou mudança significativa de posicionamento.*  
*Referências: `plans/UX_VISION_EXPERIENCIA_PACIENTE.md` · `plans/DESIGN-SYSTEM.md` · `plans/PRODUCT_STRATEGY_CONSOLIDATED.md` · `plans/backlog-roadmap_v4/ROADMAP_v4.md` · `plans/benchmarks/relatorio-meus-remedios-benchmark.md` · `plans/benchmarks/canvas-produto-mercado.md` · `docs/releases/v4.0.0.md`*
