# Dosiq — Documento de Produto

**Versão:** 1.2  
**Data:** Maio 2026  
**Classificação:** Interno — Produto, Marketing, Ops, Stakeholders, Investidores

---

## Sumário Executivo

O Dosiq é uma plataforma brasileira de gerenciamento pessoal de medicamentos — disponível como **app nativo para iOS e Android** (React Native + Expo) e como **PWA web**, compartilhando o mesmo backend, design system e lógica de negócio num monorepo unificado. É gratuito, funciona offline, inclui **chatbot IA** contextual via Groq, se integra ao Telegram — e entrega ao paciente algo que nenhum aplicativo de saúde no Brasil entrega hoje com a mesma profundidade: **clareza total sobre o próprio tratamento, a qualquer hora, em qualquer dispositivo**.

A proposta de valor é simples o suficiente para uma avó e sofisticada o suficiente para um paciente cardiovascular com seis protocolos paralelos. O mesmo produto, a mesma qualidade de experiência, para os dois.

---

## 1. O Problema que o Dosiq Resolve

A adesão ao tratamento medicamentoso é um dos maiores desafios de saúde pública no Brasil. Dados globais indicam que pacientes com doenças crônicas tomam, em média, apenas 50% das doses prescritas. As razões são conhecidas: esquecimento, rotinas caóticas, embalagens confusas, múltiplos horários, estoque que acaba sem aviso, e nenhum sistema que una tudo num único lugar de fácil acesso.

O impacto é direto: internações evitáveis, progressão de doenças controláveis, custos elevados para o sistema de saúde e perda de qualidade de vida do paciente.

O mercado brasileiro carece de soluções que combinem:

1. **Acessibilidade real** — sem paywall, disponível como app nativo e como PWA, sem curva de aprendizado
2. **Integração nativa com os canais que o brasileiro já usa** — WhatsApp e Telegram, não só app proprietário
3. **Inteligência clínica client-side** — dados do próprio paciente gerando insights sem expor informações a terceiros
4. **Design que não intimida** — tanto para Dona Maria, 68 anos, 2 medicamentos, quanto para Carlos, 45 anos, seis protocolos simultâneos

O Dosiq foi construído para resolver exatamente isso.

---

## 2. O Que é o Dosiq

O Dosiq é uma **plataforma de gerenciamento pessoal de medicamentos**, disponível em três superfícies complementares:

- **App iOS** — distribuído na App Store, React Native + Expo, push notifications nativas via Firebase
- **App Android** — distribuído no Google Play, mesma base de código, edge-to-edge nativo
- **PWA Web** — acessível pelo browser de qualquer dispositivo, instalável na tela inicial sem App Store

As três superfícies compartilham o mesmo backend (Supabase), os mesmos schemas de validação (`@dosiq/core`), e o mesmo design system (`@dosiq/design-tokens`), organizados num monorepo unificado. O paciente escolhe a superfície que prefere — e a experiência é consistente em todas.

O paciente registra seus remédios, configura protocolos de dosagem (horários, frequências, titulações), controla o estoque com rastreamento FIFO por lote, acompanha sua adesão ao longo do tempo, conversa com um chatbot IA contextual, e recebe alertas pelo Telegram (e em breve pelo WhatsApp).

É gratuito. Sem freemium escondido. Sem limite de medicamentos. Sem expiração.

### O que o Dosiq não é

Não é um prontuário eletrônico. Não é uma plataforma de telemedicina. Não é um marketplace de farmácia. Não é um app de prescrição médica. O Dosiq é **a ferramenta do paciente** — o lado do paciente numa relação que começa na consulta médica e precisa continuar por meses ou anos em casa.

---

## 3. Para Quem é o Dosiq

O Dosiq serve quatro perfis de usuário. O produto adapta automaticamente sua densidade e linguagem ao perfil detectado — sem configuração manual, em todas as superfícies (nativo e web).

### Persona 1 — Dona Maria (paciente simples)
67 anos, hipertensa e diabética. Viúva, mora sozinha em São Paulo, aposentada, usa SUS e Farmácia Popular. Smartphone Android básico, WhatsApp diariamente, baixa familiaridade com apps. Toma 5 medicamentos em horários variados; já teve episódio de hiperglicemia por esquecer a metformina. Não sabe explicar ao médico o que tomou no mês. O que ela precisa: lembrete claro no WhatsApp, PDF simples para levar à UBS, filha recebendo alerta quando ela perde doses.

**Superfície preferida:** App Android. **Interface em modo Simples:** botões grandes (64px), linguagem humana ("Tratamento em dia"), ação em um toque, sem densidade analítica.

### Persona 2 — Carlos (paciente complexo)
52 anos, executivo, hipertenso e dislipidêmico. Curitiba, iPhone, convênio SulAmérica. Viagens e finais de semana quebram a rotina. Quer dados para mostrar ao cardiologista. Precisa de streaks e score de risco para manter o hábito.

**Superfície preferida:** App iOS. **Interface em modo Complexo:** dashboard analítico, barras de adesão por protocolo, score de risco, otimizador de horário de lembrete.

### Persona 3 — Ana (paciente jovem com protocolo complexo)
35 anos, desenvolvedora, recém-diagnosticada com lúpus. Regime de titulação (hidroxicloroquina + prednisona com desmame gradual). Quer timeline visual do desmame, histórico exportável para a reumatologista, interface moderna.

**Superfície preferida:** PWA no desktop para análise + app nativo no mobile para registro diário. Protocolos com titulação, timeline visual, exportação CSV/JSON.

### Persona 4 — Ana Paula (cuidadora)
42 anos, filha de Dona Maria. Mora a 1h30 da mãe. Não sabe se a mãe está tomando os remédios. Quer ser avisada quando a mãe perde doses — via WhatsApp, sem instalar nada.

**Superfície:** Parceiro de Responsabilidade (Fase 7) — resumo semanal via WhatsApp sem criar conta.

---

Os quatro perfis são servidos pelo mesmo produto. A adaptação de interface acontece automaticamente por complexidade detectada (≤3 meds = Simples, 4–6 = Moderado, 7+ = Complexo), com override manual nas configurações, em todas as plataformas.

---

## 4. Proposta de Valor

### Para o paciente

**"Você nunca mais vai esquecer um remédio. E vai saber, a qualquer hora, se seu tratamento está em dia."**

- **Onde você preferir:** App nativo na App Store e no Google Play. PWA no browser de qualquer dispositivo. Experiência consistente nas três superfícies.
- **Zero custo real:** Gratuito para sempre. Todas as funcionalidades essenciais. Sem trial, sem upgrade, sem limite de medicamentos.
- **Notificações nativas confiáveis:** Push notifications via Firebase no app nativo (iOS e Android), Web Push no PWA, e lembretes via Telegram — o canal que você já tem aberto.
- **Inteligência sem burocracia:** O app prevê quando o estoque vai acabar, calcula o horário ideal de cada lembrete baseado nos horários reais de tomada, alerta quando um protocolo mostra sinais de risco, e responde perguntas via chatbot IA contextual — tudo sem enviar dados para terceiros.
- **Portabilidade clínica:** PDF de consulta médica pronto para imprimir ou compartilhar. Cartão de emergência offline com medicamentos e alergias. Exportação completa dos dados.

### Para o sistema de saúde

Melhor adesão ao tratamento significa menos internações por descompensação de doenças crônicas, menos complicações evitáveis, e pacientes mais preparados para consultas médicas com histórico de adesão documentado.

### Para parceiros e investidores

Uma base de usuários com dados de adesão medicamentosa de alta granularidade, presente em três superfícies (iOS, Android, Web), num mercado de 215 milhões de pessoas com prevalência crescente de doenças crônicas, operando com custo marginal zero por usuário e sem paywall que limite o crescimento.

---

## 5. Visão de Produto

> **"A ferramenta indispensável para gestão de medicamentos no Brasil — gratuita, inteligente, em qualquer dispositivo."**

A visão de longo prazo do Dosiq é tornar-se a camada de continuidade de cuidado entre consultas médicas. O médico prescreve; o Dosiq garante que o tratamento acontece, e documenta que aconteceu.

Isso tem cinco pilares estratégicos:

| Pilar | Descrição |
|-------|-----------|
| **Conveniência** | Registro de dose em um swipe. Lembrete no canal preferido. App nativo ou PWA — o paciente escolhe. |
| **Inteligência** | Dados do próprio paciente gerando predições acionáveis. Client-side. Zero custo. IA conversacional contextual já em produção. |
| **Alcance** | App Store + Google Play + PWA + Telegram + WhatsApp (Fase 7). Estar onde o paciente já está. |
| **Encorajamento** | Streaks, badges, gamificação sutil. Celebrar a disciplina do paciente. |
| **Wow Factor** | Chatbot IA em produção, registro por voz no roadmap, surpresas que fidelizam. |

---

## 6. Features Atuais (v4.0.0)

### 6.1 Registro de Doses

O gesto central do app: **swipe para a direita** confirma a dose (web e nativo). O dashboard organiza as doses do dia em zonas temporais dinâmicas (Atrasadas / Agora / Próximas / Mais tarde / Registradas), calculadas em tempo real relativo ao momento do usuário. Nunca é preciso procurar qual remédio tomar — ele está sempre na posição certa.

- Registro individual por swipe com micro-animação de confirmação
- Registro em lote (todos do mesmo horário ou todos do mesmo protocolo)
- Modo Consulta: interface simplificada para mostrar histórico ao médico
- Dosagens fracionadas, doses variáveis (titulação progressiva)
- Suporte a medicamentos "quando necessário" (sem protocolo fixo)

### 6.2 Gestão de Medicamentos e Protocolos

- Cadastro de medicamento com autocomplete via base ANVISA (6.816 medicamentos ativos, incluindo `regulatory_category`)
- Frequências: diária, dias alternados, semanal, personalizada, quando necessário
- Titulação: doses que mudam ao longo do tempo (ex: desmame de corticoides, escalonamento de antidepressivo)
- Wizard de cadastro unificado em 3 passos (Medicamento → Como tomar → Estoque)
- Agrupamento por planos de tratamento com emoji e cor personalizáveis (🫀 Cardiovascular, 🩸 Diabetes, etc.)
- Medicamentos inativos preservados no histórico

### 6.3 Controle de Estoque FIFO Auditável (v4.0.0)

A v4.0.0 evoluiu o domínio de estoque para um modelo transacional rastreável por lote:

- **`purchases`** — fonte canônica do histórico de compras, com farmácia, laboratório, notas, preço unitário
- **`stock`** — saldo corrente por lote (separado do histórico de compras)
- **`stock_consumptions`** — rastreia exatamente quais lotes cada dose registrada consumiu (FIFO auditável)
- **`stock_adjustments`** — auditoria de correções manuais

RPCs transacionais: `create_purchase_with_stock`, `consume_stock_fifo`, `restore_stock_for_log`, `apply_manual_stock_adjustment`.

Alertas visuais por criticidade: Crítico (<7 dias), Baixo (<14 dias), Normal (<30 dias), Alto (≥30 dias). Análise de custo mensal com projeção 3 meses. Timeline visual de vigência de prescrições.

### 6.4 Adesão e Histórico

- **Score de adesão:** porcentagem calculada com janela de 14 dias rolling, por protocolo e global
- **Streak:** dias consecutivos com adesão completa, com milestones celebrados visualmente
- **Ring Gauge animado:** visualização principal do score, com sparkline de 7 dias inline
- **Heatmap de adesão:** calendário com cores por dia (100% / parcial / zero / sem doses esperadas)
- **Score de risco por protocolo:** detecta protocolos com tendência negativa de adesão nos últimos 14 dias
- **Análise de padrão:** quais dias da semana e períodos do dia têm menor adesão
- Histórico completo com timeline de doses e filtros por período

### 6.5 Relatórios e Portabilidade Clínica

- **PDF de Relatório de Adesão:** gerado localmente (jsPDF), inclui score, streak, heatmap, histórico por protocolo. Para levar à consulta médica.
- **PDF de Resumo de Consulta:** visão condensada e clínica do tratamento atual
- **Cartão de Emergência:** página offline com medicamentos, doses e alergias, acessível sem login
- **Exportação de dados:** CSV e JSON com histórico completo (LGPD: o paciente é dono dos seus dados)
- **Compartilhamento via link:** PDF gerado e hospedado temporariamente via Vercel Blob

### 6.6 Notificações e Canais

- **Push Notifications nativas (iOS e Android):** via expo-notifications + Firebase — confiáveis, com suporte a modo economia de bateria e background delivery
- **Push Notifications PWA:** Web Push API (VAPID) — melhor cobertura no Android sem app instalado
- **Bot Telegram:** lembretes de dose, alertas de estoque baixo, resumo diário de adesão, relatório semanal e mensal, confirmação de dose pelo próprio Telegram sem abrir o app
- **Alertas proativos:** bot verifica ativamente se doses foram registradas e dispara lembretes contextuais
- **DLQ (Dead Letter Queue):** fila de notificações falhas com retry automático e painel de admin

### 6.7 Inteligência Client-Side

Todos os cálculos acontecem no dispositivo do usuário, sobre o cache local. Sem chamadas adicionais ao servidor, sem exposição de dados, com custo operacional zero.

- **Previsão de reposição:** data exata de esgotamento baseada no consumo real (não na dose prescrita)
- **Otimizador de lembrete:** calcula o horário ideal de alerta baseado nos horários reais de tomada dos últimos 30 dias
- **Análise de custo avançada:** custo real por dose (consumo real × preço unitário por lote)
- **Score de risco por protocolo:** adesão 14d rolling + tendência de piora = score de risco de 0–100

### 6.8 Chatbot IA (em produção)

O Dosiq inclui chatbot IA contextual via Groq SDK (`api/chatbot.js`, slot 7/12 das serverless functions). O chatbot recebe o histórico da conversa e um system prompt com contexto clínico do paciente (medicamentos ativos, protocolos, histórico de adesão), e responde a perguntas sobre medicamentos, horários e dúvidas de tratamento. Modelo: `groq/compound` (configurável via `GROQ_MODEL`). Validação de input via Zod, histórico de mensagens com janela máxima configurável via `CHATBOT_MAX_HISTORY`. Disclaimer médico obrigatório no system prompt.

### 6.9 Performance (Web)

- **Bundle otimizado:** 102 kB gzip (redução de 89% — de 989 kB originais, via code splitting e lazy loading)
- **First Load JS:** 678 kB (redução de 53%)
- **Auth roundtrip:** 1 por sessão (reduzido de 13 originais)
- **Lighthouse PWA e Performance:** ≥90 ambos
- **Offline parcial:** dados em cache SWR, doses registradas offline, sync quando reconectar

### 6.10 Segurança e Privacidade

- **Supabase Auth** com Row Level Security (RLS) — cada usuário acessa apenas seus próprios dados
- **expo-secure-store** no app nativo para credenciais sensíveis
- **LGPD-ready:** exportação completa, deleção sob demanda, sem compartilhamento com terceiros
- **Zero telemetria de dados clínicos:** analytics web é localStorage apenas; analytics mobile é Firebase sem dados clínicos
- **Sem paywall = sem modelo de monetização baseado em dados clínicos**

---

## 7. Plataformas, Canais e Formatos de Acesso

### Plataformas

| Plataforma | Status | Detalhes |
|------------|--------|---------|
| **App iOS** | ✅ Produção | React Native 0.79 + Expo 53, bundle ID `com.coelhotv.dosiq`, iOS 15.5+, Hermes |
| **App Android** | ✅ Produção | React Native 0.79 + Expo 53, package `com.coelhotv.dosiq`, edge-to-edge nativo |
| **PWA (Web)** | ✅ Produção | React 19 + Vite 7, instalável via Chrome (Android), Safari (iOS 16.4+), Edge |

O monorepo `@dosiq` reúne `apps/web`, `apps/mobile` e `packages/`. As três superfícies compartilham o mesmo Supabase, os mesmos schemas Zod via `@dosiq/core`, e o mesmo design system via `@dosiq/design-tokens`. A lógica de complexidade adaptativa (Dona Maria / Carlos) está implementada em todas as plataformas.

### Canais de Notificação

| Canal | Status | Cobertura |
|-------|--------|-----------|
| **Push nativo (iOS/Android)** | ✅ Produção | expo-notifications + Firebase, background delivery |
| **Push PWA** | ✅ Produção | Web Push API (VAPID), melhor em Android |
| **Telegram Bot** | ✅ Produção | Lembretes, confirmações, alertas, relatórios, registro sem abrir o app |
| **WhatsApp Bot** | 🗓 Fase 7 | Meta Cloud API, feature parity com Telegram |

### Distribuição

- **App Store (iOS):** EAS Build + App Store Connect, `build-ios.sh` com profiles development/production
- **Google Play (Android):** EAS Build + Google Play Console, `build-android.sh`
- **Web (PWA):** deploy contínuo no Vercel Hobby via Git push

---

## 8. Stack Tecnológico

### Web (`apps/web`)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite 7 |
| Animações | Framer Motion 12 |
| Validação | Zod 4 via `@dosiq/core` |
| Deploy | Vercel Hobby |
| PDF | jsPDF + jspdf-autotable (client-side) |
| Testes | Vitest 4 + Testing Library (539 testes, 100%) |

### Mobile (`apps/mobile`)

| Camada | Tecnologia |
|--------|-----------|
| Framework | React Native 0.79 + Expo 53 |
| Navegação | React Navigation 7 (Bottom Tabs + Native Stack) |
| Notificações | expo-notifications + Firebase |
| Armazenamento | AsyncStorage + expo-secure-store |
| Ícones | lucide-react-native (mesmos do web) |
| Analytics | Firebase Analytics |
| Motor JS | Hermes (iOS e Android) |
| Testes | Jest |

### Compartilhado (`packages/`)

| Pacote | Conteúdo |
|--------|---------|
| `@dosiq/core` | Schemas Zod, utilitários de data, lógica de adesão, enums — SSOT para web e mobile |
| `@dosiq/design-tokens` | Tokens de cores, tipografia e espaçamento — consumidos por ambas as apps |

### Backend (compartilhado por todas as superfícies)

| Componente | Tecnologia |
|------------|-----------|
| Banco de dados | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (JWT, sessões automáticas) |
| Serverless | Vercel Hobby (7/12 funções usadas) |
| Bot | Node.js + node-telegram-bot-api |
| IA | Groq SDK (`groq/compound`, slot 7/12) |

**Custo operacional atual:** R$0/mês — Supabase, Vercel, Firebase e Groq todos em tiers gratuitos.

---

## 9. Arquitetura de Design

O Dosiq usa o que internamente chamamos de **"Therapeutic Sanctuary"** — uma filosofia de design que rejeita a densidade caótica de apps médicos tradicionais em favor de espaço, hierarquia clara e calor humano. A filosofia é aplicada tanto no web (Framer Motion, CSS tokens) quanto no nativo (StyleSheet, lucide-react-native, mesmos tokens via `@dosiq/design-tokens`).

### Dois modos, um design system

**Modo Simples ("Card Deck"):** Interface tátil e navegável por cartões. Cada cartão é uma unidade de ação. O CTA domina visualmente. Dados são traduzidos para linguagem antes de chegar à tela ("Tratamento em dia", não "93%").

**Modo Complexo ("Control Panel"):** Interface analítica e escaneável. Tabular, comparável, densa sem ser confusa. Métricas numéricas, barras de adesão por protocolo, ordenação por risco.

A transição entre os modos é automática (≤3 meds = Simples, 4–6 = Moderado, 7+ = Complexo), presente em todas as superfícies, e pode ser sobreposta manualmente nas configurações.

### Princípios de design que guiam cada tela

1. **Transformar números em histórias visuais** — dados brutos não motivam, histórias motivam
2. **Evoluir, não acumular** — enriquecer o que existe em vez de criar telas novas
3. **Surpreender quem é disciplinado** — micro-animações celebram a disciplina do paciente
4. **Escalar sem sobrecarregar** — a UI que serve 2 medicamentos adapta-se visualmente para 10
5. **Navegação por atividade, não por entidade** — Hoje / Tratamento / Estoque / Perfil, em todas as plataformas

### Design tokens principais

- **Primary (Verde Saúde):** #006a5e — confiança, ação, progresso
- **Secondary (Azul Clínico):** #005db6 — seriedade, profissionalismo
- **Superfícies em camadas:** sem bordas de 1px — separação por variação de tom de fundo
- **Tipografia:** Public Sans (headlines) + Lexend (corpo, legibilidade reduzida de ruído cognitivo)
- **Espaçamento mínimo de toque:** 56px (acomodação de tremores e motricidade reduzida)

---

## 10. Modelo de Negócio e Monetização

### Filosofia: gratuito como estratégia, não como concessão

O Dosiq opera com custo operacional zero real: Vercel Hobby, Supabase free tier, Firebase free tier, Groq free tier. Isso permite oferecer todas as funcionalidades essenciais **sem nunca cobrar o paciente** — uma promessa que o Medisafe, por exemplo, abandonou em 2026 ao limitar o plano gratuito a 2 medicamentos. O Dosiq não seguirá esse caminho.

**Lembretes ilimitados, múltiplos medicamentos, histórico completo, IA contextual: gratuitos para sempre.**

### Fluxos de receita (ordenados por viabilidade temporal)

**1. Afiliação com farmácias (gatilho: 100+ usuários ativos)**
Quando o app detecta estoque baixo, exibe "Comprar agora" com comparação de preços (CliqueFarma, Consulta Remédios). CPA por compra realizada. O Dosiq tem a vantagem rara de saber exatamente quando o paciente vai precisar comprar, qual medicamento e em que quantidade — gerando relevância máxima para o anunciante e mínima intrusão para o usuário. Estimativa conservadora com 100 usuários: R$100/mês. Escala linearmente.

**2. Programas de Suporte ao Paciente — PSP (gatilho: 500+ usuários, dados demonstráveis)**
Laboratório farmacêutico licencia o app para programa de adesão de uma molécula específica. White-label ou co-branded. O dado "adesão média de 85% com o app vs 50% sem app" é o argumento de venda. Pricing referência: fee anual fixo + R$10–30/paciente ativo/mês.

**3. Planos de saúde e operadoras (longo prazo)**
Operadora oferece o app como benefício para beneficiários com doenças crônicas. R$5–15/beneficiário/mês. ROI: redução de internações por descompensação de crônicos. Requer evidência clínica com dados reais + parceria com universidade.

**4. Real-World Evidence — RWE (longo prazo)**
Relatórios agregados e anonimizados de adesão, padrões de uso, taxas de abandono por classe terapêutica. Requer LGPD-native, consentimento explícito, DPO designado.

### Caminho para monetização

```
Hoje — 100% gratuito, custo R$0, 3 superfícies (iOS + Android + PWA)
  ↓
Fase 7 (WhatsApp + Cuidador) — 100+ MAU
  → Afiliação farmácia ativada (prova de modelo)
  → Continua 100% gratuito para o paciente
  ↓
200+ MAU — dados de adesão demonstráveis
  → PSP piloto com 1 laboratório
  ↓
500+ MAU + evidência clínica
  → Contratos B2B2C com planos de saúde
  → RWE pipeline habilitado com LGPD
```

### Considerações regulatórias

O Dosiq **não é classificado como Software como Dispositivo Médico (SaMD)** enquanto não calcula doses individualizadas, não faz diagnóstico e não prescreve tratamentos. O chatbot IA em produção inclui disclaimer médico obrigatório no system prompt. A Fase 8 (interações medicamentosas ANVISA) deve ser informativa, não prescritiva — consulta jurídica especializada em saúde digital antes do lançamento.

---

## 11. Análise Competitiva e Diferenciação

O Brasil tem aproximadamente 215 milhões de habitantes, com prevalência alta e crescente de diabetes (15M+), hipertensão (35M+), e doenças cardiovasculares. O mercado de saúde digital cresce aceleradamente, mas a oferta de ferramentas genuinamente acessíveis ao paciente comum é escassa.

### Benchmark: principais players globais

| Dimensão | MyTherapy | Medisafe | Pillo | **Dosiq** |
|----------|-----------|----------|-------|-----------|
| **Custo** | Gratuito (B2B monetiza) | Freemium restritivo: limitou free a 2 meds em 2026 (~US$40/ano premium) | Gratuito + anúncios | **Gratuito total, sem paywall em saúde crítica** |
| **Plataforma** | iOS + Android | iOS + Android | Android | **iOS + Android + PWA** |
| **WhatsApp/Telegram** | ❌ | ❌ | ❌ | **✅ Telegram hoje, WhatsApp Fase 7** |
| **Base local (ANVISA)** | ❌ | ❌ | ❌ | **✅ 6.816 medicamentos com autocomplete** |
| **Titulação de doses** | Básico | Básico | Básico | **✅ Nativo (timeline visual, fases automáticas)** |
| **PDF para médico** | Básico | Premium | Básico | **✅ Profissional, compartilhável, gratuito** |
| **Cartão de emergência offline** | ❌ | ❌ | ❌ | **✅** |
| **Inteligência client-side** | ❌ | ❌ | ❌ | **✅ Predição de reposição, score de risco, otimizador** |
| **Estoque FIFO auditável** | ❌ | ❌ | Básico | **✅ Por lote, transacional, auditável** |
| **IA conversacional** | ❌ | ❌ | ❌ | **✅ Em produção (Groq)** |
| **Cuidador via WhatsApp** | ❌ | ❌ | Caregiver básico | **🗓 Fase 7** |
| **Registro por voz** | ❌ | ❌ | ❌ | **🗓 Fase 8** |

### Jobs to Be Done que o Dosiq resolve melhor

**JTBD 1 — "Não quero esquecer nenhum remédio"**
Push nativo (iOS/Android via Expo/Firebase) + Telegram + WhatsApp (Fase 7). O lembrete chega onde o paciente já está. Para Dona Maria: o WhatsApp que ela já usa. Para Carlos: notificação nativa no iPhone com som discreto.

**JTBD 2 — "Quero saber se meu tratamento está em dia"**
Score de adesão visual (Ring Gauge animado), sparkline de 7 dias, heatmap mensal, score de risco por protocolo — disponível gratuitamente. E com chatbot IA para tirar dúvidas em linguagem natural.

**JTBD 3 — "Não quero ficar sem medicamento"**
Previsão de esgotamento baseada no consumo real (FIFO por lote), alerta visual por criticidade, alertas proativos no bot. Fase 7: alerta de reposição diretamente no WhatsApp antes de acabar.

**JTBD 4 — "Quero ajudar alguém a tomar os remédios"**
Fase 7: parceiro de responsabilidade recebe resumo semanal via WhatsApp sem precisar instalar nada. **Este é o principal loop viral do produto** — o cuidador que descobre o app pelo paciente e instala para acompanhar outro familiar.

### Vantagens estruturais

**Três superfícies num único produto** — iOS, Android e PWA com paridade de features. Nenhum concorrente no Brasil oferece isso com qualidade equivalente. O paciente escolhe como interagir — e a experiência é consistente.

**Custo zero genuíno** — Medisafe restringiu o plano gratuito em 2026. O Dosiq não tem e não terá paywall em funcionalidades que impactam diretamente a saúde. Lembretes ilimitados, múltiplos medicamentos, histórico completo, IA — gratuitos para sempre.

**Contexto brasileiro nativo** — Base ANVISA integrada (não é add-on), UI em português natural, fluxos pensados para SUS e Farmácia Popular, WhatsApp como canal principal.

**Alinhamento com o paciente, não com o pagador** — Sem conflito de interesse com planos de saúde, farmácias ou laboratórios. Vantagem de credibilidade com o paciente e com reguladores.

---

## 12. Estado Atual e Métricas de Qualidade (v4.0.0)

**Versão atual:** v4.0.0 (lançada em 02/04/2026)

A v4.0.0 é a maior evolução já feita no domínio de estoque: separação entre histórico de compras e saldo corrente, consumo FIFO transacional e rastreável por lote, integração de `regulatory_category` da ANVISA, bot Telegram alinhado ao mesmo modelo da web, e chatbot IA via Groq em produção.

### Métricas de Qualidade

| Métrica | Valor |
|---------|-------|
| Testes web passando | 539/539 (100%) |
| Bundle size web (gzip) | 102.47 kB (-89% vs. baseline) |
| First Load JS web | 678 kB (-53% vs. baseline) |
| Auth roundtrips por sessão | 1 (-92% vs. baseline — era 13) |
| Lighthouse PWA | ≥90 |
| Lighthouse Performance | ≥90 |
| Serverless functions usadas | 7/12 (Vercel Hobby budget) |
| Custo operacional mensal | R$0 |

---

## 13. Roadmap

### Entregue (v4.0.0 — atual, Abril 2026)

- Fases 1–6 completas + Mobile Performance Initiative (M0-M8, P1-P4, D0-D3)
- **App nativo iOS e Android** (React Native + Expo 53, distribuído nas lojas)
- **Monorepo unificado** (`apps/web` + `apps/mobile` + `packages/`)
- **Chatbot IA via Groq** em produção (`api/chatbot.js`)
- **Estoque FIFO auditável** — `purchases`, `stock_consumptions`, `stock_adjustments`
- ANVISA `regulatory_category` integrada ao modelo de dados
- 539 testes passando, bundle web 102 kB, auth em 1 roundtrip, Lighthouse ≥90

### Próximas fases

**Fase 7 — Crescimento e Alcance**
- Bot WhatsApp via Meta Cloud API (feature parity com Telegram, 1.000 conversas/mês grátis)
- Seleção de canal nas configurações (Telegram ou WhatsApp)
- Alertas inteligentes multi-canal usando outputs da Fase 6
- Modo Parceiro de Responsabilidade: familiar acompanha adesão pelo WhatsApp sem criar conta
- Modo Cuidador completo: read-only, multi-canal, consentimento duplo

**Fase 8 — Experiência Inteligente (parcialmente entregue)**
- ✅ Chatbot IA contextual via Groq — em produção
- 🗓 Registro de dose por voz (Web Speech API nativa, zero custo)
- 🗓 Resumo de doses por voz (Speech Synthesis)
- 🗓 Interações medicamentosas ANVISA (alertas automáticos por classe terapêutica)

**Backlog futuro (trigger-gated)**
- Portal B2B para profissionais de saúde (gatilho: demanda validada)
- Afiliação com farmácias CPA (gatilho: 100+ usuários ativos)
- Multi-perfil família (gatilho: 50+ usuários ativos)
- OCR de receita médica (gatilho: fricção de onboarding confirmada)
- i18n PT-PT, ES (gatilho: expansão internacional confirmada)

---

## 14. Time e Governança

O Dosiq é desenvolvido por um time pequeno com ciclos curtos, processo de desenvolvimento orientado por memória institucional (DEVFLOW) e revisão de código automatizada via Gemini. Cada entrega passa por gates de qualidade automatizados antes de ir à produção.

Todo merge requer aprovação humana. Nenhum agente faz merge automático. O ciclo de desenvolvimento inclui registro de anti-padrões, regras e decisões arquiteturais que alimentam a memória do time para sprints futuros.

---

## 15. Posicionamento de Marca

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
**Verde Saúde (#006a5e)** como cor primária — confiança, natureza, saúde. **Azul Clínico (#005db6)** como cor secundária — seriedade, profissionalismo médico. Interface editorial, respirada, com hierarquia clara. Sem bordas decorativas. Sem agressividade visual. Aplicado de forma consistente no web (CSS tokens) e no nativo (design tokens JS via `@dosiq/design-tokens`).

---

## 16. Por Que Agora

O crescimento do uso de smartphones entre idosos brasileiros (acelerado pela pandemia), a massificação do WhatsApp como canal de comunicação primário, o aumento da prevalência de doenças crônicas que exigem múltiplos medicamentos, e a maturidade das ferramentas de distribuição de apps nativos a custo zero (EAS Build, Firebase free tier) criam uma janela de oportunidade singular.

O sistema público de saúde brasileiro não tem capacidade de acompanhar individualmente a adesão ao tratamento de milhões de pacientes crônicos. As farmácias não têm incentivo estrutural para promover adesão. Os planos de saúde internalizam o custo das complicações mas não têm ferramenta de prevenção voltada ao paciente.

O Dosiq preenche esse vazio com custo zero ao paciente, custo operacional zero ao produto, e presença nativa nas três superfícies onde o paciente brasileiro já vive: seu smartphone Android, seu iPhone, e seu navegador.

---

*Documento elaborado pelo time de Produto — Maio 2026.*  
*Versão de produto de referência: v4.0.0 (Abril 2026).*  
*Atualizar a cada release major (vX.0.0) ou mudança significativa de posicionamento.*  
*Referências: `plans/UX_VISION_EXPERIENCIA_PACIENTE.md` · `plans/DESIGN-SYSTEM.md` · `plans/PRODUCT_STRATEGY_CONSOLIDATED.md` · `plans/backlog-roadmap_v4/ROADMAP_v4.md` · `plans/benchmarks/relatorio-meus-remedios-benchmark.md` · `plans/benchmarks/canvas-produto-mercado.md` · `docs/releases/v4.0.0.md`*
