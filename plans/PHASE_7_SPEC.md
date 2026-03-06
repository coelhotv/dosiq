# Spec de Execucao — Fase 7: Crescimento & Alcance

**Versao:** 1.0
**Data:** 06/03/2026
**Baseline:** v3.3.0 (Fase 6 completa)
**Esforco total:** 63 SP
**Custo operacional:** R$ 0 (Meta Cloud API: 1.000 conversas/mes gratuitas)

---

## Objetivo

Expandir de Telegram para WhatsApp como canal primario de notificacao no Brasil e introduzir suporte a cuidadores para desbloquear o caso de uso familiar.

---

## Contexto Estrategico

| Metrica | Telegram | WhatsApp |
|---------|----------|----------|
| Usuarios no Brasil | ~30M (~14% pop.) | ~147M (~99% pop. adulta) |
| Free tier | Ilimitado | 1.000 conversas/mes (permanente) |
| Reuso de codigo | 100% (existente) | ~60% da infra do Telegram |

**Caso de uso "Dona Maria":** filha gerencia medicamentos da mae via WhatsApp — sem instalar app, sem criar conta Telegram. A mae recebe lembretes no WhatsApp que ja usa diariamente.

---

## Features

### W01 — WhatsApp Bot via Meta Cloud API (21 SP)

**Arquitetura:** Adapter pattern para suportar multiplos canais.

```
server/
  channels/
    INotificationChannel.js   -- contrato de interface
    TelegramAdapter.js        -- refatorado a partir do bot existente
    WhatsAppAdapter.js         -- novo, Meta Cloud API
  whatsapp/
    whatsapp-client.js        -- wrapper da Meta Cloud API
    webhookHandler.js         -- processamento de mensagens recebidas
    messageTemplates.js       -- templates pre-aprovados pelo Meta
```

**Serverless:** Nova funcao `api/whatsapp.js` (webhook handler) — usa 1 dos 6 slots restantes (7/12 apos implementacao).

**Feature parity com Telegram:**
- Lembretes de dose
- Confirmacao de dose
- Alertas de estoque
- Relatorios de adesao
- Digests semanais e mensais

**Message Templates (requerem pre-aprovacao do Meta):**

| Template | Conteudo |
|----------|----------|
| `dose_reminder` | "Hora do seu remedio: {medicine} {time}" |
| `dose_confirmation` | "Dose registrada: {medicine} as {time}" |
| `stock_alert` | "Estoque baixo: {medicine} ({days} dias restantes)" |
| `weekly_digest` | Resumo semanal de adesao |

**Refatoracao do bot existente:**
- Extrair logica compartilhada de `tasks.js` para services agnositcos de canal
- `INotificationChannel` define: `send(userId, message)`, `sendWithButtons(userId, message, buttons)`, `formatMessage(template, data)`

**Restricoes criticas:**
- Meta exige verificacao Business (2-4 semanas) — INICIAR DURANTE A FASE 6
- Janela de 24 horas: mensagens free-form so dentro de 24h da ultima mensagem do usuario. Fora da janela: apenas templates pre-aprovados
- Formato de callback data diferente do Telegram (sem limite de 64 bytes, mas estrutura diferente)

---

### W02 — Selecao de Canal em Configuracoes (5 SP)

**Banco de dados:**
- Novo campo na tabela `profiles`: `notification_channel` enum (`'telegram'`, `'whatsapp'`, `'both'`, `'none'`)
- Default: `'telegram'` (retrocompativel)
- Migration: `ALTER TABLE profiles ADD COLUMN notification_channel TEXT DEFAULT 'telegram'`

**Schema:** Atualizar `profileSchema.js` com enum `notification_channel`.

**UI (Tab Perfil > Configuracoes):**
- Radio buttons: Telegram / WhatsApp / Ambos / Nenhum
- Fluxo de conexao WhatsApp: exibir QR code ou numero para o usuario enviar mensagem ao bot
- Indicador de status de conexao (conectado/desconectado)

---

### W03 — Alertas Inteligentes via WhatsApp (8 SP)

Integra as saidas de inteligencia da Fase 6 com o canal WhatsApp:

| Fonte (Fase 6) | Alerta |
|-----------------|--------|
| I01 Refill Prediction | "Seu {medicine} acaba em ~{days} dias. Hora de repor!" |
| I04 Risk Score | "Atencao: sua adesao ao protocolo {protocol} caiu para {score}% nos ultimos 14 dias." |

**Regras:**
- Usa `INotificationChannel` para enviar via canal preferido do usuario
- Respeita preferencias de notificacao (frequencia, horarios silenciosos)
- Deduplicacao: mesma logica existente (`shouldSendNotification()`)

---

### C02 — Parceiro de Responsabilidade (8 SP)

Versao leve de cuidador: alguem recebe APENAS o resumo semanal de adesao.

**Modelo de dados:**

```sql
CREATE TABLE accountability_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  partner_name TEXT NOT NULL,
  partner_channel TEXT NOT NULL,          -- 'telegram' ou 'whatsapp'
  partner_identifier TEXT NOT NULL,       -- numero WhatsApp ou username Telegram
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: usuario so ve seus proprios parceiros
ALTER TABLE accountability_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_partners" ON accountability_partners
  FOR ALL USING (auth.uid() = user_id);
```

**UI (Tab Perfil > "Parceiro de Responsabilidade"):**
- Adicionar parceiro (nome + numero WhatsApp ou username Telegram)
- Toggle ativo/inativo
- Maximo 3 parceiros por usuario

**Bot:** Scheduler envia resumo semanal aos parceiros ativos.

**Privacidade:** Parceiro ve APENAS adesao agregada (%) e streak — NUNCA nomes de medicamentos.

---

### C01 — Modo Cuidador Completo (21 SP)

Modo cuidador completo: alguem pode VISUALIZAR agenda de medicamentos, estoque e adesao do paciente.

**Modelo de dados:**

```sql
CREATE TABLE caregiver_invites (
  code CHAR(6) PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,        -- created_at + 7 dias
  used_at TIMESTAMPTZ
);

CREATE TABLE caregiver_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_user_id UUID REFERENCES auth.users(id) NOT NULL,
  patient_user_id UUID REFERENCES auth.users(id) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  channel_preference TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(caregiver_user_id, patient_user_id)
);

-- RLS: cuidador ve dados do paciente via caregiver_links
ALTER TABLE caregiver_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caregiver_own_links" ON caregiver_links
  FOR ALL USING (
    auth.uid() = caregiver_user_id OR auth.uid() = patient_user_id
  );
```

**Codigos de convite:** 6 caracteres alfanumericos, validade de 7 dias.

**Modelo de permissoes (JSONB):**

| Permissao | Tipo | Descricao |
|-----------|------|-----------|
| `view_schedule` | boolean | Ver agenda de medicamentos |
| `view_adherence` | boolean | Ver dados de adesao |
| `view_stock` | boolean | Ver niveis de estoque |
| `receive_alerts` | boolean | Receber alertas criticos |

**UI para o paciente (Tab Perfil > "Cuidadores"):**
- Gerar codigo de convite
- Ver cuidadores ativos
- Revogar acesso

**UI para o cuidador (Tab Perfil > "Pacientes que cuido"):**
- Inserir codigo de convite
- Escolher quais notificacoes receber
- Visualizacao read-only dos dados do paciente

**Bot para cuidador:** Alertas criticos (doses perdidas, estoque zerado) via canal preferido.

**LGPD:** Consentimento explicito do paciente, revogavel a qualquer momento, minimizacao de dados.

---

## Sequencia de Implementacao

```
W01 (21 SP) ──> W02 (5 SP) ──> W03 (8 SP)
    │                               │
    └──> C02 (8 SP) ──> C01 (21 SP) │
                                     │
              (W03 depende Fase 6) ──┘
```

| Ordem | Feature | SP | Dependencias |
|-------|---------|-----|-------------|
| 1 | W01 WhatsApp Bot + adapter refactor | 21 | Nenhuma |
| 2 | W02 Selecao de Canal | 5 | W01 |
| 3 | W03 Alertas Inteligentes WhatsApp | 8 | W01 + Fase 6 (I01, I04) |
| 4 | C02 Parceiro de Responsabilidade | 8 | W01 |
| 5 | C01 Modo Cuidador Completo | 21 | W01 |

**Sub-etapas de W01:**

1. Extrair logica compartilhada de `tasks.js` para services agnositcos de canal
2. Criar `INotificationChannel` + `TelegramAdapter` (refatoracao, sem features novas)
3. Criar `WhatsAppAdapter` + `api/whatsapp.js` webhook
4. Testar entrega dual-channel

---

## Pre-requisitos Criticos

- **Verificacao Meta Business:** iniciar durante a Fase 6. Lead time de 4-8 semanas. Bloqueador critico para W01.
- **Fase 6 completa:** I01 (Refill Prediction) e I04 (Risk Score) alimentam alertas inteligentes (W03).
- **Budget serverless:** `api/whatsapp.js` usa 1 slot (7/12 apos implementacao).

---

## O que foi CORTADO (e por que)

| Feature | SP | Motivo do corte |
|---------|-----|----------------|
| Offline-First | 21 | PWA Service Worker ja cobre cenario real. IndexedDB sync com conflict resolution e complexidade desproporcional para <100 usuarios. |
| Multi-perfil Familia | 13 | Requer migracao de schema em TODAS as tabelas. Modo Cuidador resolve "gerenciar meds da mae" sem essa complexidade. |
| Benchmarks Anonimos | 8 | Precisa N>=10 por grupo de comparacao. Com <100 usuarios, mostraria "dados insuficientes" por meses. |

---

## Criterios de Aceitacao

1. WhatsApp Bot com feature parity do Telegram (reminders, confirmacao, estoque, adesao, digests)
2. Selecao de canal persiste no perfil do usuario
3. Mensagens enviadas respeitam janela de 24h do Meta (templates fora da janela)
4. Parceiro de Responsabilidade NAO ve nomes de medicamentos (apenas % adesao e streak)
5. Cuidador so ve dados com consentimento explicito do paciente (revogavel)
6. `api/whatsapp.js` nao excede 7/12 do budget de serverless
7. Testes: >=85% cobertura para adapters e services
8. Zero regressao no Telegram Bot existente

---

## Metricas de Sucesso

| Metrica | Meta |
|---------|------|
| Novos usuarios que optam por WhatsApp | >30% |
| Links de cuidador criados | >=5 |
| Parceiros de responsabilidade ativos | >=3 |
| Downtime do Telegram durante migracao | Zero |

---

## Gestao de Riscos

| Risco | Prob. | Impacto | Mitigacao |
|-------|-------|---------|-----------|
| Meta Business verificacao demora >4 semanas | Alta | Alto | Iniciar durante Fase 6. Plano B: Twilio como fallback. |
| 1.000 conversas/mes insuficientes | Baixa | Medio | Monitorar uso. Upgrade Meta tier se necessario (~$0.05/conversa). |
| WhatsApp API rate limits | Media | Medio | Queue com retry exponencial. |
| Caregiver LGPD compliance | Media | Alto | Consentimento explicito, revogacao, audit log. |
| Refactor do bot quebra Telegram | Media | Alto | Testes E2E antes do deploy. Feature flag para dual-channel. |

---

*Documento criado 06/03/2026. Substitui PRD_FASE_6_ROADMAP_2026.md.*
