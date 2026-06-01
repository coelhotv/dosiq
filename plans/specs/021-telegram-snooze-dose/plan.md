# Implementation Plan: Telegram Dose Snooze (Telegram Only)

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`  
**Spec**: `spec.md`  
**Legacy Sources**:
- `plans/backlog-notifications/EXEC_SPEC_SNOOZE_DOSE.md`

---

## Summary

Este plano estabelece a arquitetura e o fluxo de implementação do Snooze de Doses (adiamento) pelo Telegram integrado diretamente com a tabela canônica `dose_instances` (`snoozed_until`), eliminando tabelas de jobs redundantes. Detalha a criação de helpers de elegibilidade clínica, tratamento de callbacks do bot seguros contra limites de bytes do Telegram e orquestração do runner cron a cada minuto.

---

## Technical Context

- **Uso de `dose_instances` Canônica**: A tabela materializada já possui a coluna `snoozed_until` (`timestamptz`) e `notified_at` (`timestamptz`). O Snooze atuará atualizando estes campos diretamente na linha da instância de dose correspondente.
- **Limitação de Payload do Telegram**: Os dados trafegados no clique dos botões inline (`callback_data`) são limitados pela API do Telegram a **exatos 64 bytes**. UUIDs ocupam 36 bytes. A modelagem de callback deve usar prefixos extremamente curtos.
- **Serverless Cron**: O motor opera sob modelo serverless sem estado em memória. A tabela `dose_instances` é a única fonte da verdade, consultada a cada minuto pelo cron unificado do servidor.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **R-020 (Timezone)** | ✅ Pass | A data e horário do re-alerta são calculados em UTC absoluto no banco (`snoozed_until`) e traduzidos para fuso `America/Sao_Paulo` (ou timezone do usuário) exclusivamente na renderização textual de confirmação no Telegram. |
| **R-090 (Serverless Limit)** | ✅ Pass | O Cron do Snooze roda dentro da mesma função serverless do reminder em `api/notify.js`, otimizando a cota Hobby de 12 slots da Vercel. |
| **R-117 (Mobile Performance)** | ✅ Pass | Feature exclusiva do canal Telegram (não onera a timeline ou views móveis na web/mobile nesta fase). |
| **R-221 (SQP)** | ✅ Pass | Inclui o bump da versão do core/web e logging no DEVFLOW C5. |

---

## Architecture / Approach

### 1. Helpers de Snooze (`server/bot/_snoozeHelpers.js` [NEW])
Criar a biblioteca utilitária no bot:
- **`getAvailableSnoozeOptions(scheduledFor, now = new Date())`**:
  - Calcula a diferença entre `now` e o horário canônico da dose original (`scheduledFor`).
  - A janela máxima de tomada retroativa é de 120 minutos (2h).
  - Filtra e retorna apenas as opções fixas (15, 30 ou 60 minutos) cujo instante de re-alerta (`now + minutos`) seja menor do que `scheduledFor` + 120 minutos.
- **`isSnoozeEligible(timeSchedule)`**:
  - Recebe o array de horários `'HH:MM'` do protocolo e valida se é elegível ao snooze.
  - Se for dose única diária (array unitário ou vazio), é **sempre elegível**.
  - Ordena e calcula o menor intervalo (gap) em minutos entre doses adjacentes.
  - Trata o gap circular (diferença entre o último horário da noite e o primeiro da manhã seguinte).
  - Elegível apenas se o menor intervalo for **maior que 120 minutos (2h)**.
- **`checkSnoozedDoses(dispatcher, correlationId)`**:
  - Executado pelo cron a cada minuto.
  - Consulta em `dose_instances` as instâncias pendentes cujo `snoozed_until <= now() AND status = 'pending' AND notified_at IS NOT NULL`.
  - Para cada instância elegível, chama `dispatcher.dispatch` enviando o lembrete com o contexto `{ isSnoozed: true, originalScheduledHHMM }`.
  - Após despacho bem-sucedido, atualiza a instância no banco: `snoozed_until = null` e `notified_at = now()`.

### 2. Handlers de Callbacks no Telegram (`doseActions.js`)
- **Limites de Bytes (64 bytes)**:
  - Exibir opções (Snooze inicial): `snooze_:${doseInstanceId}` -> Prefixo 8 bytes + UUID 36 bytes = 44 bytes (respeita o limite).
  - Confirmar opção selecionada: `snooze_pick:${minutes}:${doseInstanceId}` -> Prefixo 12 bytes + delay 2 bytes + 1 byte + UUID 36 bytes = 51 bytes (respeita o limite).
- **`handleSnooze`**:
  - Disparado pelo clique no botão `⏰ Adiar`.
  - Carrega a `dose_instances` e valida a elegibilidade do protocolo e as opções válidas de tempo.
  - Se elegível, edita a mensagem do Telegram substituindo os botões pelo teclado inline contendo as opções calculadas (`⏰ 15 min`, `⏰ 30 min`, `⏰ 1 hora`).
- **`handleSnoozePick`**:
  - Disparado ao selecionar o tempo.
  - Re-valida a janela limite (evitando race conditions).
  - Faz update em `dose_instances`: `snoozed_until = now() + (delayMinutes * interval '1 minute')`.
  - Edita a mensagem do Telegram limpando o teclado inline e exibindo o texto de confirmação com a hora local do re-alerta (fuso do usuário).

### 3. Decoração de Payload e Layout inline (`buildNotificationPayload.js`)
- **`applySnoozeDecoration`**:
  - Função utilitária ativada quando `context.isSnoozed = true`.
  - Modifica o payload:
    - Injeta o caractere `⏰ ` no início do título da mensagem.
    - Adiciona uma linha em itálico no topo do corpo: `_Lembrete adiado (original: HH:MM)_\n\n`.
- **Botões Inline de Ação**:
  - Em `formatDoseReminder`, o array de ações inclui `'snooze'` entre `'take'` e `'skip'`.
  - O schema de ações canônicas em `packages/core/schemas/actionSchema.js` (ou `_payloadSchemas.js`) deve ser atualizado para aceitar a ação `'snooze'`.
  - O `telegramChannel.js` traduz a ação `'snooze'` gerando o callback `snooze_:${doseInstanceId}`.

### 4. Integração no Cron Runner do Servidor (`api/notify.js`)
- No arquivo `api/notify.js`, importar a função `checkSnoozedDoses` e adicioná-la no loop principal do cron de lembretes a cada minuto:
  ```js
  // Snooze de doses vencidas (Every minute)
  await withCorrelation(
    (context) => checkSnoozedDoses(notificationDispatcher, context.correlationId),
    { correlationId, jobType: 'snooze_reminders' }
  );
  ```

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `server/bot/_snoozeHelpers.js` [NEW] | Utilitários de cálculo de janelas clínicas, gap de fuso e cron runner | Requisito T2 do spec legado |
| `server/bot/callbacks/doseActions.js` | Handlers do Telegram para callback de adiar e confirmação de snooze | Requisito T3 do spec legado |
| `server/notifications/payloads/buildNotificationPayload.js` | Decoração visual de mensagens e injeção do botão adiar na UI | Requisito T4/T7 do spec legado |
| `packages/core/schemas/actionSchema.js` | Atualização do enum de ações canônicas aceitando 'snooze' | Requisito T5 do spec legado |
| `server/notifications/channels/telegramChannel.js` | Tradução e codificação de callbacks inline para 'snooze' | Requisito T6 do spec legado |
| `api/notify.js` | Integração do processador de re-alertas no loop do cron a cada minuto | Requisito T8 do spec legado |

---

## Contracts and ADRs

- **ADR-048**: A tabela `dose_instances` de fuso tz-aware deve ser a única controladora de estado.
- **R-221 (SQP)**: bumps e changelog em português obrigatórios.

---

## Risks

- **Concorrência com Tomada Manual**: O usuário pode tomar a dose no app nativo enquanto o snooze está agendado no Telegram.
  - *Mitigação*: Ao registrar a dose como `taken` no app, a linha correspondente de `dose_instances` altera seu status para `'taken'`. O cron runner `checkSnoozedDoses` busca estritamente instâncias com `status = 'pending'`, anulando de forma automática qualquer re-alerta pendente de doses já tomadas!

---

## Quality Gates

- `rtk lint` deve rodar limpo nas pastas do bot e do core.
- Cobertura de testes unitários para cálculo de gap e elegibilidade de fuso em `snoozeHelpers.test.js`.
- Comando `npm run validate:agent`.
