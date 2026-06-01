# Feature Specification: Telegram Dose Snooze (Telegram Only)

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-notifications/EXEC_SPEC_SNOOZE_DOSE.md`

---

## Context

No aplicativo Dosiq, o alerta de dose individual enviado pelo bot do Telegram oferece atualmente os botões de ação `✅ Tomar` e `⏭️ Pular`. O botão `⏰ Adiar` (Snooze) foi anteriormente removido da interface visual pela ausência de suporte no backend.

Com a implantação canônica da tabela `dose_instances` de fuso tz-aware (ADR-048), o Snooze pode ser integrado de forma nativa e extremamente elegante. Em vez de criar uma infraestrutura de agendamento em memória ou tabelas redundantes, o Snooze de Doses atualiza diretamente o campo `snoozed_until` da instância de dose correspondente. Isso permite que usuários adiem seus lembretes diretamente pelo chat do Telegram em opções fixas de 15, 30 ou 60 minutos, respeitando o limite clínico da janela de 2h de tomada atrasada configurada no fuso horário local do paciente.

---

## User Scenarios & Testing

### User Story 1 — Solicitar Adiamento de Dose no Telegram (Priority: P1)
**Why this priority**: Oferecer flexibilidade para que o paciente adie o alarme caso esteja ocupado ou impossibilitado de tomar o medicamento no instante exato do lembrete.  
**Independent Test**: Disparar um alerta de dose individual no Telegram, clicar no botão `⏰ Adiar`, verificar se o teclado inline é editado de forma imediata com as opções fixas de tempo válidas (15/30/60 min).

**Acceptance Scenarios**:
1. Given que o usuário recebe um alerta de dose individual do bot do Telegram,  
   When ele clica em `⏰ Adiar`,  
   Then o bot limpa o teclado anterior e exibe as opções inline: `⏰ 15 min`, `⏰ 30 min` e `⏰ 1 hora`.

---

### User Story 2 — Executar o Snooze com Sucesso (Priority: P1)
**Why this priority**: Garantir que a persistência no banco e o re-alerta ocorram de forma impecável no fuso horário do usuário.  
**Independent Test**: Selecionar a opção `⏰ 30 min`, verificar se a mensagem do Telegram é editada com uma confirmação amigável indicando o horário correto do re-alerta (fuso America/Sao_Paulo) e atestar no banco de dados que a coluna `snoozed_until` da `dose_instances` correspondente foi atualizada para `now() + 30 min`.

**Acceptance Scenarios**:
1. Given que as opções de adiamento estão visíveis na mensagem do Telegram,  
   When o usuário clica em `⏰ 30 min`,  
   Then o bot persiste o adiamento no banco de dados e edita a mensagem com o texto de confirmação: *"⏰ Lembrete adiado! Vou te lembrar novamente às HH:MM."* (no fuso local).

---

### User Story 3 — Inelegibilidade por Alta Frequência (Priority: P2)
**Why this priority**: Prevenir riscos de sobredosagem e confusão clínica caso o usuário adie uma dose para um horário muito próximo ou posterior ao da próxima dose agendada.  
**Independent Test**: Cadastrar um protocolo contendo tomadas a cada 1h (ex: 08:00 e 09:00), disparar o lembrete, clicar em `⏰ Adiar` e verificar se o bot bloqueia a ação emitindo um alerta explicativo.

**Acceptance Scenarios**:
1. Given que o usuário possui um protocolo com intervalo de doses adjacentes menor ou igual a 2 horas,  
   When ele clica no botão `⏰ Adiar` no Telegram,  
   Then o bot intercepta a ação e exibe um alerta pop-up informando: *"Este protocolo tem doses muito próximas. Adiar poderia causar confusão com a próxima dose."*.

---

## Edge Cases

- **Opção Expira Durante a Seleção**: Se o usuário demorar a clicar no botão de adiamento e a opção selecionada (ex: `⏰ 1 hora`) fizer o re-alerta ultrapassar a janela limite de 2h a partir do horário original da dose, o bot deve recusar a ação ao clicar e exibir um alerta pop-up informando: *"Esta opção não está mais disponível. A janela de 2h está se encerrando."*.
- **Adiar uma Dose Já Adiada**: O usuário pode adiar um lembrete repetidas vezes, desde que o novo instante de re-alerta (`fire_at`) não ultrapasse a janela máxima de 2h contadas a partir do horário de agendamento canônico da dose original (`scheduled_for`), que atua como âncora fixa.
- **Protocolo Inativado Após o Snooze**: Se o usuário inativar ou deletar o medicamento no app enquanto um snooze estiver pendente no banco, o cron a cada minuto deve detectar a ausência do protocolo ativo, marcar a instância como enviada/descartada e não disparar nenhuma mensagem no chat do Telegram.

---

## Requirements

### Functional Requirements

- **FR-001**: O bot do Telegram deve utilizar a coluna `snoozed_until` (`timestamptz`) da tabela canônica `dose_instances` para agendar e controlar lembretes adiados, eliminando tabelas de jobs paralelas.
- **FR-002**: O botão `⏰ Adiar` deve ser renderizado no alertas de dose individual no Telegram entre as opções `✅ Tomar` e `⏭️ Pular` (layout inline de 3 botões em linha única).
- **FR-003**: Ao clicar em `⏰ Adiar`, o bot deve calcular as opções válidas de tempo (15/30/60 min) cuja soma com o instante atual seja menor do que `scheduled_for` + 120 minutos (janela clínica de 2h).
- **FR-004**: O bot deve verificar se o intervalo mínimo de tempo entre todas as doses do dia do protocolo (incluindo o gap circular do fim do dia para a manhã seguinte) é maior que 2h. Caso contrário, a elegibilidade ao snooze é revogada de forma preventiva.
- **FR-005**: O callback do Telegram deve trafegar a ID da instância de dose usando strings de callback curtas (ex: `snooze_:${doseInstanceId}` e `snooze_pick:${minutes}:${doseInstanceId}`) para respeitar o limite técnico estrito de 64 bytes do Telegram.
- **FR-006**: O runner agendado a cada minuto no `api/notify.js` deve buscar instâncias em `dose_instances` cujo `snoozed_until <= now() AND status = 'pending'`, despachar o re-alerta via dispatcher de notificação e atualizar `snoozed_until = null` e `notified_at = now()`.
- **FR-007**: As mensagens de re-alerta geradas devem ser decoradas visualmente no cabeçalho (adicionando o emoji `⏰`) e incluir uma linha explicativa no corpo: *"Lembrete adiado (original: HH:MM)"*.

### Key Entities

- **Dose Instance**: Entidade materializada canônica que agora orquestra o campo `snoozed_until` para controlar re-alertas de forma inline.

---

## Success Criteria

- **SC-001**: O botão `⏰ Adiar` é exibido em linha única no Telegram sem quebrar o layout.
- **SC-002**: O re-alerta do snooze é disparado no minuto exato configurado, decorado visualmente e marcando a instância após o envio.
- **SC-003**: 100% de conformidade com a janela clínica limitante de 2h e fuso horário local America/Sao_Paulo nas mensagens de confirmação do bot.

---

## Assumptions

- O servidor do Dosiq possui um cron runner ativo disparado a cada minuto (ex: cron-job.org ou Vercel Cron) que aciona `api/notify.js`.
- O chat do bot do Telegram e a conta do Dosiq do usuário estão devidamente vinculados e salvos no banco.
