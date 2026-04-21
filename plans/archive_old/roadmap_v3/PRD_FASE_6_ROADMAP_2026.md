# PRD Fase 6: WhatsApp, Social e Resiliência

**Versão:** 2.0
**Status:** DRAFT
**Data:** 21/02/2026
**Fase do Roadmap:** 6 de 7
**Baseline:** v2.8.1 + Fase 5 concluída (Relatórios, Calendário, Interações, Modo Consulta, Cartão Emergência) + Fase 5.5 concluída (Inteligência Preditiva)
**Princípio:** Custo operacional R$ 0

> ⚠️ **Ação imediata necessária:** Iniciar processo de verificação do **Meta Business** (WhatsApp Cloud API) **4 semanas antes do desenvolvimento desta fase**. O processo pode levar 2–4 semanas e é o principal risco de bloqueio.

---

## 1. Visão Geral e Objetivos Estratégicos

A Fase 6 tem dois vetores de expansão simultâneos:

1. **Alcance:** O WhatsApp Bot expande o canal de notificações de ~14% da população brasileira (Telegram) para ~99% (WhatsApp), sem nenhum custo adicional — Meta Cloud API oferece 1.000 conversas/mês gratuitas permanentemente.

2. **Profundidade:** Modo Cuidador, Parceiro de Responsabilidade e Benchmarks Anônimos tornam o app social — aumentando retenção e engajamento emocional.

**Relação com Fase 5.5:** A Previsão de Reposição (I01) e o Score de Risco (I04) da Fase 5.5 alimentam **diretamente** os alertas proativos do WhatsApp Bot — o mesmo dado inteligente calculado client-side também dispara notificações no canal que o usuário já usa.

**Relação com Fase 7:** O WhatsApp Bot entregue aqui é a base para as Notificações Avançadas de Cuidador (F7.3 da Fase 7). O Modo Cuidador (F6.2) define o modelo de dados que o Portal B2B (F7.9) reutiliza.

### Objetivos Estratégicos

| ID | Objetivo | Métrica Primária |
|----|----------|-----------------|
| OE6.1 | Expandir alcance do bot para WhatsApp (canal majoritário BR) | Opt-in WhatsApp > 50% novos usuários |
| OE6.2 | Permitir acompanhamento por cuidadores (multi-canal) | Convites enviados > 15% usuários |
| OE6.3 | Garantir funcionamento offline com sync | Sessões offline rastreadas |
| OE6.4 | Suportar múltiplos perfis na mesma conta | Multi-perfil adotado > 10% usuários |
| OE6.5 | Aumentar retenção via motivação social | Retenção D30 > 40% |
| OE6.6 | Criar benchmarks de comunidade anônimos | Benchmarks visualizados > 30% usuários/semana |

### Pré-requisitos

- ✅ Fase 4 concluída: Bot Standardization (messageFormatter, errorHandler, 49 testes), PWA + Service Worker
- ✅ Fase 5 concluída: Relatórios PDF, Deep Links funcionais
- ✅ Fase 5.5 concluída: refillPredictionService, protocolRiskService (inputs para alertas WhatsApp)
- ⏳ Verificação Meta Business aprovada (iniciar 4 semanas antes)
- ✅ RLS configurado e funcional no Supabase

---

## 2. Escopo de Features

| ID | Feature | Prioridade | Story Points | Novas Dependências |
|----|---------|------------|-------------|-------------------|
| **F6.0** | **WhatsApp Bot (Meta Cloud API)** | **P0** | **21** | **axios ou meta-api-sdk** |
| **F6.0b** | **Seleção de Canal nas Configurações** | **P0** | **5** | **Nenhuma** |
| **F6.0c** | **Alertas Inteligentes WhatsApp (de Fase 5.5)** | **P0** | **8** | **Nenhuma (usa outputs da F5.5)** |
| F6.1 | Modo Cuidador (multi-canal: Telegram + WhatsApp) | P0 | 21 | Nenhuma |
| F6.2 | Modo Offline-First com Sync | P0 | 21 | idb (~5KB) |
| F6.3 | Multi-perfil Família | P1 | 13 | Nenhuma |
| **F6.4** | **Benchmarks Anônimos de Comunidade** | **P1** | **8** | **Nenhuma** |
| **F6.5** | **Parceiro de Responsabilidade** | **P1** | **8** | **Nenhuma** |
| F6.6 | Polish: Cores de Accent por Perfil | P2 | 3 | Nenhuma |
| F6.7 | Polish: Modo Foco | P2 | 3 | Nenhuma |
| F6.8 | Polish: Health Rituals | P2 | 3 | Nenhuma |

**Esforço Total:** 114 SP
**Novas dependências npm:** `idb` (~5KB), `axios` ou SDK WhatsApp (~15KB)

### Fora de Escopo

- Notificações avançadas de cuidador com relatórios semanais (Fase 7 — F7.3)
- Chatbot IA (Fase 7 — F7.1)
- Integração com sistemas externos de saúde

---

## 3. Descrição Detalhada de Features

### F6.0 WhatsApp Bot (Meta Cloud API) ⭐ NOVO

**Título:** Bot de notificações e interação via WhatsApp com feature parity ao Telegram
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, W01

**Contexto:**
```
Telegram no Brasil:       ~30M usuários (~14% da população adulta)
WhatsApp no Brasil:       ~147M usuários (~99% da população adulta)
Meta Cloud API free tier: 1.000 conversas/mês gratuitas (permanente)
Reuso de código:          ~60% da infra Telegram reutilizada (adapter pattern)
```

**Arquitetura — Adapter Pattern:**

O código do bot Telegram está bem modularizado em `tasks.js` e `alerts.js`, com `messageFormatter.js` e `errorHandler.js` já separados (✅ F4.5). A estratégia é criar uma interface comum:

```
INotificationChannel
  ├── TelegramAdapter (existente — refatorado)
  └── WhatsAppAdapter (novo)

tasks.js → usa INotificationChannel (canal-agnóstico)
alerts.js → usa INotificationChannel (canal-agnóstico)
```

**Arquivos a criar/modificar:**

```
server/
├── channels/
│   ├── INotificationChannel.js   ← interface/contrato
│   ├── TelegramAdapter.js        ← refatorado de bot-factory.js
│   └── WhatsAppAdapter.js        ← NOVO
├── whatsapp/
│   ├── whatsapp-client.js        ← Meta Cloud API client
│   ├── webhookHandler.js         ← recebe eventos do WhatsApp
│   └── messageTemplates.js       ← templates aprovados pela Meta
└── bot/
    └── tasks.js                  ← refatorado para canal-agnóstico
```

**API Endpoints novos:**
- `api/whatsapp.js` — Webhook do WhatsApp (similar ao `api/telegram.js`)
- `api/whatsapp-subscribe.js` — Configuração da assinatura do webhook

**Features com Parity com o Bot Telegram:**

| Feature | Telegram (atual) | WhatsApp (novo) |
|---------|-----------------|-----------------|
| Lembrete de dose | ✅ | ✅ |
| Confirmar tomada (Tomar/Adiar/Pular) | ✅ (inline buttons) | ✅ (reply buttons) |
| Alerta de estoque baixo | ✅ | ✅ |
| Relatório de adesão semanal | ✅ | ✅ |
| Alerta de titulação | ✅ | ✅ |
| Relatório mensal | ✅ | ✅ |
| Deep link para o app | ✅ | ✅ |

**Templates WhatsApp (aprovação Meta obrigatória para mensagens outbound):**
- Template `dose_reminder` — Lembrete de dose (aprovado antes do lançamento)
- Template `stock_alert` — Alerta de estoque
- Template `adherence_weekly` — Relatório semanal
- Mensagens conversacionais (inbound-triggered) — sem template necessário

**Critérios de Aceitação:**
- [ ] WhatsApp Bot tem feature parity com Telegram Bot atual
- [ ] Adapter pattern implementado: `tasks.js` funciona com ambos os canais sem duplicação
- [ ] Templates aprovados pela Meta antes do lançamento
- [ ] Webhook WhatsApp configurado em `api/whatsapp.js`
- [ ] Deduplicação de mensagens funciona independente do canal
- [ ] DLQ (Dead Letter Queue) existente captura falhas do WhatsApp
- [ ] messageFormatter existente (✅ F4.5) reutilizado para WhatsApp (adaptando MarkdownV2 → texto plano WhatsApp)

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-6.0.1 | Usuário | Configura WhatsApp em Perfil → recebe lembrete de dose via WhatsApp no horário |
| UC-6.0.2 | Usuário | Responde "1" (Tomar) no WhatsApp → dose registrada → confirmação enviada |
| UC-6.0.3 | Usuário | Recebe alerta de estoque: "Atenção: Losartana para ~5 dias. Toque para ver estoque: [link]" |

**Dependências:** Meta Business verificado, messageFormatter ✅, tasks.js, DLQ ✅
**Impacto Financeiro:** R$ 0 (1.000 conversas/mês gratuitas — conversas iniciadas pelo usuário não contam)

---

### F6.0b Seleção de Canal nas Configurações ⭐ NOVO

**Título:** Usuário escolhe entre Telegram, WhatsApp ou ambos para notificações
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, W02

**Requisitos Técnicos:**
- Nova seção "Notificações" em `#/perfil`
- Campo `notification_channel` no perfil Supabase: `enum ['telegram', 'whatsapp', 'both', 'none']`
- Componente `src/features/dashboard/components/ChannelSettings.jsx`
- Migration: `ALTER TABLE profiles ADD COLUMN notification_channel TEXT DEFAULT 'telegram'`

**Critérios de Aceitação:**
- [ ] Usuário pode selecionar Telegram, WhatsApp, ambos ou nenhum
- [ ] Configuração persiste no Supabase (não apenas localStorage)
- [ ] `tasks.js` e `alerts.js` respeitam a preferência do canal
- [ ] Onboarding sugere configurar canal na primeira sessão

---

### F6.0c Alertas Inteligentes via WhatsApp (outputs da Fase 5.5) ⭐ NOVO

**Título:** Previsão de reposição e score de risco da Fase 5.5 disparando alertas via WhatsApp
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, W03

**Descrição:**
A Fase 5.5 calculou `refillPredictionService` e `protocolRiskService` client-side. Esta feature expõe essas previsões para o bot (server-side) via query no Supabase, disparando alertas proativos pelo canal preferido do usuário.

**Alertas novos (além dos já existentes):**

| Alerta | Fonte | Gatilho |
|--------|-------|---------|
| "Sua Losartana real acaba em ~10 dias (vs 15 dias estimados)" | refillPredictionService | Diferença > 20% entre consumo real e teórico |
| "Atenção: protocolo Rivotril em risco de abandono" | protocolRiskService (score Crítico) | Score = Crítico nos últimos 14 dias |

**Critérios de Aceitação:**
- [ ] Alerta de reposição usa consumo **real** (logs) — não teórico
- [ ] Alerta de risco de abandono enviado quando protocolo fica Crítico por 3 dias consecutivos
- [ ] Funciona via Telegram e WhatsApp conforme seleção do canal
- [ ] Rate limit: 1 alerta de risco por protocolo por semana

---

### F6.1 Modo Cuidador (multi-canal) — Atualizado

**Título:** Sistema de convite e acompanhamento read-only para cuidadores, com notificações via Telegram OU WhatsApp
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, P09

**Descrição:**
Permite que o usuário convide um cuidador para acompanhar o tratamento em modo read-only. O cuidador agora pode escolher receber notificações via Telegram **ou WhatsApp** (o canal que já usa) — graças ao adapter pattern do F6.0.

**Modelo de Dados (Supabase — sem alterações vs original):**

```sql
CREATE TABLE caregiver_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code CHAR(6) NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);

CREATE TABLE caregiver_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions TEXT[] DEFAULT ARRAY['read_medications', 'read_adherence', 'read_stock'],
  notification_channel TEXT DEFAULT 'telegram',  -- novo campo
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, caregiver_id)
);
```

**Componentes Frontend:**
- `src/features/dashboard/components/caregiver/InviteGenerator.jsx`
- `src/features/dashboard/components/caregiver/InviteRedeemer.jsx`
- `src/features/dashboard/components/caregiver/CaregiverDashboard.jsx` (read-only)
- `src/features/dashboard/components/caregiver/CaregiverSettings.jsx` (gerenciar/revogar + canal)

**Rotas:**
- `#/cuidador/convidar` — Gerar convite
- `#/cuidador/aceitar` — Inserir código
- `#/cuidador/dashboard/:patientId` — Dashboard read-only
- `#/perfil/cuidadores` — Gerenciar cuidadores vinculados

**Notificações para Cuidador (via canal configurado):**
- Dose esquecida (t+30min): "O paciente esqueceu [medicamento] às [horário]"
- Estoque crítico (< 3 dias): "Estoque de [medicamento] do paciente está crítico"
- Score de risco Crítico (de Fase 5.5): "Protocolo de [paciente] com baixa adesão esta semana"

**Critérios de Aceitação:**
- [ ] Código de convite de 6 caracteres alfanuméricos gerado
- [ ] Convite expira em 7 dias se não aceito
- [ ] Cuidador vê dashboard read-only (sem poder registrar doses)
- [ ] Cuidador configura canal de notificação (Telegram ou WhatsApp)
- [ ] Cuidador recebe alertas pelo canal configurado
- [ ] Paciente pode revogar acesso a qualquer momento
- [ ] RLS garante isolamento de dados entre pacientes
- [ ] Máximo 5 cuidadores por paciente

**Dependências:** WhatsApp Bot (F6.0), Supabase novas tabelas, Hash Router ✅
**Impacto Financeiro:** R$ 0

---

### F6.2 Modo Offline-First com Sync

*(Conteúdo original preservado — sem mudanças de escopo)*

**Título:** Funcionamento completo offline com sincronização automática ao reconectar
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, N03

**Arquitetura Offline:**

```
[App] → [offlineService (IndexedDB)] → [syncService] → [Supabase]
                                             |
                                   [Fila de operações pendentes]
```

**Stores IndexedDB:**

| Store | Dados | Sync Direction |
|-------|-------|---------------|
| medications | Medicamentos do usuário | Bidirecional |
| protocols | Protocolos ativos | Bidirecional |
| dose_logs | Registros de dose | Push (local → server) |
| stock | Movimentações de estoque | Push (local → server) |
| sync_queue | Operações pendentes | Local only |
| cache_meta | Timestamps de última sync | Local only |

**Estratégia de Sync:**
- **Pull:** Delta por `updated_at` ao conectar
- **Push:** Operações da fila em ordem cronológica
- **Conflito:** Last-write-wins por `updated_at`
- **Retry:** Backoff exponencial (max 3 tentativas)

**Critérios de Aceitação:**
- [ ] App carrega e exibe dados offline (IndexedDB)
- [ ] Registro de dose funciona offline
- [ ] Indicador visual de modo offline visível
- [ ] Sync automático ao reconectar (sem ação do usuário)
- [ ] Conflitos resolvidos com last-write-wins
- [ ] Fila de sync visível nas configurações (X operações pendentes)
- [ ] Performance: leitura IndexedDB < 50ms
- [ ] Tamanho máximo IndexedDB: 50MB (cleanup automático de logs > 90 dias)

**Dependências:** PWA + Service Worker (✅ F4.2), idb
**Impacto Financeiro:** R$ 0

---

### F6.3 Multi-perfil Família

*(Conteúdo original preservado)*

**Título:** Gerenciar medicamentos de múltiplas pessoas na mesma conta
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, N10

**Modelo de Dados:**

```sql
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Critérios de Aceitação:**
- [ ] Até 5 perfis por usuário
- [ ] Alternância entre perfis em < 500ms
- [ ] Dados isolados por perfil (medicamentos, doses, estoque)
- [ ] Perfil primário criado automaticamente na migração
- [ ] Notificações do bot incluem nome do perfil: "[Mãe] Hora do Losartana"
- [ ] Relatórios PDF incluem nome do perfil no cabeçalho
- [ ] Multi-canal: perfis podem ter canais de notificação diferentes

**Dependências:** F6.1 (modelo de dados compatível), Supabase (migração)
**Impacto Financeiro:** R$ 0

---

### F6.4 Benchmarks Anônimos de Comunidade ⭐ NOVO

**Título:** Comparação motivacional de adesão com usuários de perfil similar
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, S01

**Descrição:**
"Usuários com perfil similar ao seu têm adesão média de 73% nos últimos 30 dias. Você está em 81% — ótimo trabalho!" — comparação motivacional sem exposição de dados individuais.

**Agrupamento de perfil similar:**
- Mesmo número de medicamentos (±1)
- Mesmo range de adesão histórica (60-79%, 80-89%, 90-100%)
- Frequência de doses similar (1x/dia, 2x/dia, etc.)

**Requisitos Técnicos:**
- Supabase aggregate function (sem expor dados individuais)
- Regra: só exibe se N >= 10 usuários no grupo de comparação
- Cache: calcula 1x/semana (não por sessão)
- Componente `src/features/adherence/components/CommunityBenchmark.jsx`
- Posição: dentro do `AdherenceWidget` existente (seção colapsável)

**Critérios de Aceitação:**
- [ ] Nunca expõe dados de usuários individuais (apenas médias agregadas)
- [ ] Mínimo de 10 usuários no grupo para exibir benchmark
- [ ] Exibição semanal (cache de 7 dias)
- [ ] Opção de opt-out do benchmark (preserva privacidade)
- [ ] Texto narrativo motivacional (não apenas números)
- [ ] Não exibido para usuários com < 14 dias de dados (dados insuficientes)

**Dependências:** AdherenceWidget (✅ HCC), Supabase RLS
**Impacto Financeiro:** R$ 0

---

### F6.5 Parceiro de Responsabilidade ⭐ NOVO

**Título:** Versão leve do cuidador — compartilha apenas resumo semanal de adesão
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 6, S02

**Descrição:**
Alternativa mais simples ao Modo Cuidador: o usuário escolhe alguém (familiar, amigo) para receber apenas o resumo semanal de adesão via WhatsApp ou Telegram. Sem acesso à conta. Sem necessidade de o parceiro ter conta no app. Máximo de engajamento com mínima fricção.

**Diferença do Modo Cuidador:**

| | Modo Cuidador (F6.1) | Parceiro de Responsabilidade |
|--|---|---|
| Acesso ao app | Sim (read-only) | Não |
| Conta necessária | Sim | Não |
| Canal | Telegram ou WhatsApp | WhatsApp ou Telegram (número de telefone) |
| O que recebe | Alertas de dose esquecida, estoque crítico | Apenas resumo semanal |
| Configuração | Código de 6 chars | Número de telefone |

**Requisitos Técnicos:**
- Tabela `accountability_partners` (patient_id, phone_number, channel, active)
- Cron semanal (segunda às 9h): envia resumo via canal configurado
- Componente `src/features/dashboard/components/AccountabilityPartner.jsx`
- Mensagem: "Olá! [Nome] pediu para te atualizar: esta semana teve 87% de adesão aos medicamentos. Continue incentivando! 💪"

**Critérios de Aceitação:**
- [ ] Usuário cadastra parceiro pelo número de telefone
- [ ] Parceiro não precisa ter conta no Dosiq
- [ ] Resumo semanal enviado toda segunda às 9h pelo canal configurado
- [ ] Usuário pode desativar a qualquer momento
- [ ] Parceiro pode responder "PARAR" para sair da lista
- [ ] LGPD: consentimento explícito na ativação (quem você está compartilhando)

**Dependências:** WhatsApp Bot (F6.0), Bot Telegram (✅)
**Impacto Financeiro:** R$ 0

---

### F6.6–F6.8 Polish (mantidos com prioridade P2)

*(Conteúdo original preservado, renumerados)*

| ID | Feature | SP | Dependência |
|----|---------|-----|------------|
| F6.6 | Cores de Accent por Perfil (8 opções, CSS custom property) | 3 | F6.3 |
| F6.7 | Modo Foco (fonte aumentada, apenas próximas doses) | 3 | SwipeRegisterItem ✅ |
| F6.8 | Health Rituals (agrupamento visual de doses por horário) | 3 | TreatmentAccordion ✅ |

---

## 4. Requisitos Não-Funcionais

| Requisito | Especificação | Métrica |
|-----------|--------------|---------|
| Performance | Alternância de perfil | < 500ms |
| Performance | Leitura IndexedDB | < 50ms |
| Performance | Sync após reconexão | < 10s para 50 operações |
| Segurança | RLS em tabelas de cuidador | Isolamento total entre pacientes |
| Segurança | Código de convite | 6 chars alfanuméricos, expira em 7 dias |
| Privacidade | Benchmarks anônimos | N >= 10 usuários, sem dados individuais |
| Privacidade | Parceiro de responsabilidade | Opt-in explícito, opt-out fácil |
| Disponibilidade | WhatsApp Bot | Fallback gracioso se Meta API indisponível |
| Resiliência | Modo offline | App funcional sem internet |
| Armazenamento | IndexedDB | Max 50MB, cleanup automático > 90 dias |
| LGPD | Parceiro de responsabilidade | Consentimento explícito na ativação |

---

## 5. Plano de Testes

### 5.1 Testes Unitários (Vitest)

| Componente | Cenários |
|------------|----------|
| WhatsAppAdapter | Envia mensagem, formata texto (sem MarkdownV2), rate limit, fallback |
| INotificationChannel | Adapter pattern respeita contrato |
| InviteGenerator | Gera código válido, expiração, unicidade |
| InviteRedeemer | Aceita código válido, rejeita expirado |
| CaregiverDashboard | Exibe dados read-only, não permite edição |
| offlineService | CRUD IndexedDB, fila de sync, cleanup |
| syncService | Push operações, pull delta, resolução de conflitos |
| CommunityBenchmark | N >= 10 mínimo, cache semanal, opt-out |
| AccountabilityPartner | Cadastro, resumo semanal, PARAR opt-out |

### 5.2 Testes de Integração

| Cenário | Validação |
|---------|-----------|
| WhatsApp end-to-end | Usuário configura → recebe lembrete de dose |
| Adapter pattern | tasks.js envia via Telegram e WhatsApp com mesmo código |
| Convite cuidador (multi-canal) | Cuidador configura WhatsApp → recebe alertas no WhatsApp |
| Offline + sync | Registra dose offline → reconecta → dados sincronizados |
| Benchmark anônimo | Menos de 10 usuários → não exibe; 10+ → exibe |
| Parceiro semanal | Cron executa → parceiro recebe resumo |

### 5.3 Testes Manuais Obrigatórios

| Cenário | Dispositivo |
|---------|-------------|
| WhatsApp Bot: lembrete + confirmação | Android (WhatsApp real) |
| Modo offline completo | Android Chrome (modo avião) |
| Sync após reconexão | Android Chrome (toggle wifi) |
| Benchmark anônimo com N < 10 | Ambiente de staging isolado |

---

## 6. Indicadores de Sucesso

| KPI | Baseline | Meta | Ferramenta |
|-----|----------|------|------------|
| Opt-in WhatsApp (novos usuários) | 0 | > 50% | Supabase query |
| Conversas WhatsApp/mês | 0 | < 1.000 (free tier) | Meta dashboard |
| Convites de cuidador enviados | 0 | > 15% usuários | Supabase query |
| Sessões offline | 0 | Tracking de ocorrências | Service Worker events |
| Multi-perfil adotado | 0 | > 10% usuários | Supabase query |
| Benchmarks visualizados | 0 | > 30% usuários/semana | Analytics local |
| Parceiros de responsabilidade ativos | 0 | > 10% usuários | Supabase query |
| Retenção D30 | N/A | > 40% | Analytics local |

---

## 7. Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| **Meta exige verificação Business** | **Alta** | **Médio** | **Iniciar 4 semanas antes — principal ação imediata** |
| Templates WhatsApp rejeitados pela Meta | Média | Médio | Preparar 2-3 variações por template; revisão antes de submeter |
| Supabase Free Tier atingir 500MB com novas tabelas | Média | Alto | Monitorar uso, cleanup de logs antigos |
| Complexidade do sync offline gerar bugs | Alta | Alto | Estratégia simples (last-write-wins), testes E2E extensivos |
| Benchmark com poucos usuários por muito tempo | Alta | Baixo | Feature simplesmente não exibe — UI adaptativa |
| Parceiro de responsabilidade interpretado como spam WhatsApp | Baixa | Médio | Opt-in explícito, PARAR fácil, rate limit (1/semana) |
| IndexedDB não disponível em navegadores antigos | Baixa | Médio | Feature detection, fallback modo online-only |

---

## 8. Migrações de Banco de Dados

### Novas Tabelas

```sql
-- Fase 6.0b — Canal de notificação
ALTER TABLE profiles ADD COLUMN notification_channel TEXT DEFAULT 'telegram'
  CHECK (notification_channel IN ('telegram', 'whatsapp', 'both', 'none'));

-- Fase 6.1 — Modo Cuidador
CREATE TABLE caregiver_invites (...);  -- detalhado na seção F6.1
CREATE TABLE caregiver_links (
  ...,
  notification_channel TEXT DEFAULT 'telegram'  -- multi-canal
);

-- Fase 6.3 — Multi-perfil
CREATE TABLE profiles (...);  -- detalhado na seção F6.3
ALTER TABLE medications ADD COLUMN profile_id UUID REFERENCES profiles(id);
ALTER TABLE protocols ADD COLUMN profile_id UUID REFERENCES profiles(id);
ALTER TABLE dose_logs ADD COLUMN profile_id UUID REFERENCES profiles(id);
ALTER TABLE stock ADD COLUMN profile_id UUID REFERENCES profiles(id);

-- Fase 6.5 — Parceiro de Responsabilidade
CREATE TABLE accountability_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Cronograma de Implementação

| Ordem | Feature | Dependência | SP |
|-------|---------|-------------|-----|
| 0 | **Verificação Meta Business** *(iniciar 4 semanas antes)* | Meta Business | — |
| 1 | F6.2 Modo Offline-First | PWA ✅, idb | 21 |
| 2 | F6.0 WhatsApp Bot + adapter pattern | Meta aprovado, messageFormatter ✅ | 21 |
| 3 | F6.0b Seleção de Canal | F6.0 | 5 |
| 4 | F6.0c Alertas Inteligentes (Fase 5.5) | F6.0, refillPredictionService | 8 |
| 5 | F6.1 Modo Cuidador (multi-canal) | F6.0, Supabase tabelas | 21 |
| 6 | F6.4 Benchmarks Anônimos | AdherenceWidget ✅, dados suficientes | 8 |
| 7 | F6.5 Parceiro de Responsabilidade | F6.0 (WhatsApp) | 8 |
| 8 | F6.3 Multi-perfil Família | F6.1 (modelo dados), migração | 13 |
| 9 | F6.6–F6.8 Polish | F6.3, outros | 9 |

---

## 10. Definição de Pronto (DoD)

- [ ] Código implementado e revisado
- [ ] Testes unitários passando com cobertura > 85%
- [ ] WhatsApp Bot com feature parity ao Telegram
- [ ] Adapter pattern: tasks.js funciona com ambos os canais
- [ ] Templates WhatsApp aprovados pela Meta
- [ ] Testes E2E offline passando (>= 5 cenários)
- [ ] Migrações SQL aplicadas e RLS validado
- [ ] Benchmark anônimo não exibe com N < 10
- [ ] Parceiro de responsabilidade com opt-out funcional
- [ ] Modo offline funcional em Android Chrome
- [ ] Sem regressão — testes críticos continuam passando

---

*Documento revisado em: 21/02/2026*
*Referência: Roadmap 2026 v3.2 - Fase 6*
*Baseline: v2.8.1 + Fase 5 + Fase 5.5*
*Próxima revisão: após conclusão da Fase 6*
