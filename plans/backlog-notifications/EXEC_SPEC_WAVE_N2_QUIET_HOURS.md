# Exec Spec — Wave N2: Quiet Hours + Redesign da Experiência de Notificações Nativas

> **Status:** PRONTO PARA EXECUÇÃO (após N1 mergeado)
> **Master Plan:** [`MASTER_PLAN_NOTIFICATIONS_REVAMP.md`](./MASTER_PLAN_NOTIFICATIONS_REVAMP.md)
> **Idea Plan:** [`IDEA_PLAN_NOTIFICATIONS_REVAMP.md`](./IDEA_PLAN_NOTIFICATIONS_REVAMP.md) — §Wave N2
> **Mockups hi-fi de referência:** [`new-profile.png`](./new-profile.png), [`new-notification-central.png`](./new-notification-central.png), [`new-notification-settings.png`](./new-notification-settings.png), [`new-notification-telegram.png`](./new-notification-telegram.png)
> **Pré-requisito:** Wave N1 mergeado (PR #1) · **independente de N3**
> **PR alvo:** PR #2 da reforma
> **Estimativa:** ~3.5 dias úteis · 9 sprints
>
> **Nota de design (2026-04-27):** Esta wave deixou de ser apenas "quiet hours + digest mode" e passa a
> consolidar a experiência nativa de notificações em uma arquitetura de produto de 4 níveis:
> Perfil → Avisos → Preferências → Telegram. Quiet hours, digest e canais continuam obrigatórios.
>
> **Nota técnica (2026-04-26):** O formatter enriquecido do digest (`formatDailyDigestMessage` com
> agrupamento por bloco temporal + copy variável) permanece em **N3 Sprint 3.4**. N2 entrega apenas o
> trigger do digest com formato simples funcional.

---

## 1. Objetivo

Dar controle ao usuário sobre **quando** e **onde** ser avisado, e substituir a experiência nativa incremental de notificações por uma jornada organizada, consistente e desenhada como produto.

Wave N2 entrega:

1. **Perfil redesenhado** como porta de entrada para conta, notificações e demais itens.
2. **Central de Avisos redesenhada** como inbox acionável, com filtros, agrupamento temporal, estado vazio e acesso às configurações.
3. **Preferências de Notificação redesenhadas** com status global, canais App/Telegram/Web PWA, modo de envio, quiet hours e digest time.
4. **Tela Telegram redesenhada** como fluxo dedicado de vinculação, com passos claros, código copiável/renovável e nota de segurança.
5. **Backend de quiet hours + digest mode** preservando os requisitos originais da Wave N2.

---

## 2. Leitura dos mockups

### 2.1 Hierarquia de produto

| Nível | Mockup | Papel na jornada | Implicação |
|-------|--------|------------------|------------|
| **1. Perfil** | `new-profile.png` | Hub de conta e avisos. O card "Notificações" combina inbox + preferências + canais. | `ProfileScreen` deve ter uma seção "Avisos & Lembretes" com único item "Notificações", badge de não lidas e resumo curto. |
| **1.1 Avisos** | `new-notification-central.png` | Inbox operacional. O usuário entende pendências, filtra e age. | `NotificationInboxScreen` vira "Avisos", com gear para preferências, filtros por tipo/status e cards acionáveis. |
| **1.1.1 Preferências** | `new-notification-settings.png` | Controle consolidado. Canais e cadência ficam numa tela só. | `NotificationPreferencesScreen` deixa de ser lista de escolhas antigas e vira configuração por seções. |
| **1.1.1.1 Telegram** | `new-notification-telegram.png` | Fluxo de integração dedicado, não card solto no perfil. | `TelegramLinkScreen` deve ser acessada a partir de Preferências > canal Telegram. |

### 2.2 Princípios visuais extraídos

- **Calma e clareza**: fundo neutro, cards brancos, títulos grandes, rótulos em caixa alta para seções.
- **Densidade moderada**: pouca ornamentação, mas cada card carrega estado útil (badge, status, CTA).
- **Ícones funcionais**: ícones sempre acompanhados de texto/acessibilidade; usar `lucide-react-native`.
- **Ações primárias evidentes**: CTA verde para registrar dose, ver estoque, abrir Telegram.
- **Canais extensíveis**: o mockup mostra App/Telegram/Email como ilustração; a implementação deve suportar também Web (PWA) porque N1.7 entrega `web_push`.
- **Estados como produto**: zero state da Central de Avisos deve ser desenhado, não apenas "lista vazia".
- **Não pixel-perfect obrigatório**: mockups são direção hi-fi. Implementação deve seguir tokens existentes e regras RN do projeto.

---

## 3. Pré-requisitos

| Item | Estado |
|------|--------|
| Wave N1 mergeado | ⏳ (PR #1 deve estar em produção) |
| `runDailyDigest` existente em `tasks.js` | ✅ |
| `ProfileScreen` mobile | ✅ — hoje tem cards separados para Preferências, Central e Telegram |
| `NotificationInboxScreen` mobile | ✅ — SectionList + grouped notifications N1 |
| `NotificationPreferencesScreen` mobile | ✅ — estrutura antiga focada em `notification_preference` |
| `TelegramLinkScreen` mobile | ✅ — fluxo existe, precisa redesign |
| `useUnreadNotificationCount` | ✅ |
| `useNotificationLog` mobile | ✅ |
| `getCurrentTimeInTimezone` helper | ✅ (`server/bot/utils/`) |
| Sprint N1.7 `web_push` | ⏳ — N1.7 deve entregar canal dispatcher + SW navigation + ponto mínimo de ativação PWA |

---

## 4. Arquitetura de navegação nativa

### 4.1 Estrutura alvo

```
Perfil
└── Notificações
    ├── Avisos (Inbox)
    │   ├── filtros: Todos / Não lidos / Doses / Estoque
    │   └── gear → Preferências
    └── Preferências
        ├── Notificações ativas
        ├── Canais
        │   ├── App (push)
        │   ├── Telegram → Conectar ao Telegram
        │   ├── Web (PWA)
        │   └── Email (disabled/backlog)
        ├── Modo de envio
        ├── Não me incomode
        └── Hora do resumo
```

### 4.2 Rotas

| Rota atual | Manter? | Ajuste esperado |
|------------|---------|-----------------|
| `ROUTES.PROFILE_MAIN` | ✅ | Redesign do hub de Perfil |
| `ROUTES.NOTIFICATION_INBOX` | ✅ | Título visual "Avisos"; recebe `userId`; gear navega para Preferências |
| `ROUTES.NOTIFICATION_PREFERENCES` | ✅ | Redesign completo das configurações |
| `ROUTES.TELEGRAM_LINK` | ✅ | Mantém rota, mas passa a ser subfluxo da tela de Preferências |

Não criar nova tab. O acesso continua pelo Perfil para manter a navegação principal enxuta.

---

## 5. Sprints

### Sprint 2.1 — Migration Supabase + Zod schema sync

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Entregas**:

1. Criar migration em `docs/migrations/`:
   ```sql
   ALTER TABLE user_settings
     ADD COLUMN quiet_hours_start TIME,
     ADD COLUMN quiet_hours_end TIME,
     ADD COLUMN notification_mode TEXT DEFAULT 'realtime'
       CHECK (notification_mode IN ('realtime', 'digest_morning', 'silent')),
     ADD COLUMN digest_time TIME DEFAULT '07:00',
     ADD COLUMN channel_mobile_push_enabled BOOLEAN,
     ADD COLUMN channel_web_push_enabled BOOLEAN DEFAULT false,
     ADD COLUMN channel_telegram_enabled BOOLEAN;

   UPDATE user_settings
   SET
     channel_mobile_push_enabled = notification_preference IN ('mobile_push', 'both'),
     channel_telegram_enabled = notification_preference IN ('telegram', 'both'),
     channel_web_push_enabled = COALESCE(channel_web_push_enabled, false)
   WHERE channel_mobile_push_enabled IS NULL
      OR channel_telegram_enabled IS NULL;

   ALTER TABLE user_settings
     ALTER COLUMN channel_mobile_push_enabled SET DEFAULT true,
     ALTER COLUMN channel_mobile_push_enabled SET NOT NULL,
     ALTER COLUMN channel_web_push_enabled SET NOT NULL,
     ALTER COLUMN channel_telegram_enabled SET DEFAULT false,
     ALTER COLUMN channel_telegram_enabled SET NOT NULL;
   ```

2. Atualizar schema compartilhado ou schemas sincronizados:
   ```js
   quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
   quiet_hours_end:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
   notification_mode: z.enum(['realtime', 'digest_morning', 'silent']).default('realtime'),
   digest_time:       z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('07:00'),
   channel_mobile_push_enabled: z.boolean().default(true),
   channel_web_push_enabled:    z.boolean().default(false),
   channel_telegram_enabled:    z.boolean().default(false),
   ```

3. Confirmar source of truth:
   - Preferir `packages/core/src/schemas/userSettingsSchema.js` se a wave criar o compartilhamento.
   - Se web e mobile ainda usam schemas separados, documentar a duplicação na própria spec de implementação e sincronizar ambos.
   - Manter `notification_preference` como campo legado/backcompat nesta wave, mas a UI nova deve ler/gravar os booleans de canal.

4. Testes:
   - HH:MM válido/inválido.
   - Enum de `notification_mode`.
   - Backfill de `notification_preference` para os booleans:
     - `mobile_push` → mobile true, telegram false, web false.
     - `telegram` → mobile false, telegram true, web false.
     - `both` → mobile true, telegram true, web false.
     - `none` → todos false.
   - Defaults.

**Critério de aceite**:
- Migration aplica sem erro em staging.
- Schema e DB sincronizados.
- `safeParse` aceita inputs válidos e rejeita formato errado.

---

### Sprint 2.2 — Server: lógica de supressão por modo + quiet hours

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Entregas**:

1. Criar helper `server/bot/utils/notificationGate.js`:
   ```js
   export function shouldSendNow({ mode, quietHoursStart, quietHoursEnd, currentHHMM }) {
     if (mode === 'silent') return false
     if (mode === 'digest_morning') return false
     if (isInQuietHours(currentHHMM, quietHoursStart, quietHoursEnd)) return false
     return true
   }
   ```

2. `isInQuietHours` deve tratar janela que cruza meia-noite:
   - `22:00 → 07:00` significa `currentHHMM >= 22:00 || currentHHMM < 07:00`.
   - `13:00 → 15:00` significa `13:00 <= currentHHMM < 15:00`.
   - start/end ausentes desativam quiet hours.

3. Em `server/bot/tasks.js` (`checkRemindersViaDispatcher`):
   - Ler `notification_mode`, `quiet_hours_start`, `quiet_hours_end`.
   - Antes do dispatch externo, aplicar `shouldSendNow`.
   - Se suprimido, preservar entrada de inbox/auditoria com status explícito (`suprimida` ou equivalente aceito pelo schema).
   - Garantir que a resolução de canais externos respeite os novos booleans em `user_settings`.

4. Integração com N1.7 (`web_push`):
   - `resolveChannelsForUser` deve retornar `web_push` somente quando:
     - `channel_web_push_enabled === true`; e
     - existir device ativo em `notification_devices` com `provider = 'webpush'`.
   - `mobile_push` deve continuar dependente de device Expo ativo.
   - `telegram` deve continuar dependente de vínculo Telegram ativo.
   - Se `notification_preference` legado ainda for usado por algum caller, criar adapter temporário para derivar flags e não quebrar usuários existentes.

5. Tests:
   - `notificationGate.test.js`: todos os modos, dentro/fora de janela, cross-midnight.
   - `resolveChannelsForUser.test.js`: flags × devices para `mobile_push`, `web_push`, `telegram` e combinações.

**Critério de aceite**:
- `silent`: nenhum push/Telegram enviado, Inbox ainda recebe registro.
- `digest_morning`: lembrete realtime suprimido; digest cuida do resumo.
- `realtime` dentro de quiet hours: suprime.
- `realtime` fora de quiet hours: envia.
- Web push só é enviado quando o usuário habilitou Web (PWA) e tem subscription ativa.

---

### Sprint 2.3 — Server: trigger do digest matinal (formato simples)

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Entregas**:

1. Em `server/bot/tasks.js` (`runDailyDigest`):
   - Quando `notification_mode === 'digest_morning'` e `currentHHMM === user.digest_time`:
     - Buscar protocolos do usuário com `time_schedule` não-vazio.
     - Contar total de doses do dia.
     - Disparar **1 push** via `dispatcher.dispatch()` com `kind = 'daily_digest'`.
     - Title simples: `Sua agenda de hoje — X doses programadas`.
     - Body simples: lista flat de horários e nomes.

2. Testes:
   - Envia 1 push no horário configurado.
   - Não envia fora do horário.
   - Não envia para usuário `realtime` ou `silent`.

**Critério de aceite**:
- `digest_morning` gera 1 push no `digest_time`.
- Corpo contém contagem total.
- MarkdownV2 válido quando o canal for Telegram.

---

### Sprint 2.4 — Mobile Perfil: novo hub "Avisos & Lembretes"

**Agente recomendado**: 🟢 **Avançado** (Codex/Sonnet/Pro)

**Entregas**:

1. Redesenhar `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` seguindo `new-profile.png`:
   - Título "Perfil" com escala 28/800 ou padrão atual de header nativo.
   - Seção "Minha conta": email + plano/status.
   - Seção "Avisos & Lembretes": **um único card "Notificações"** com ícone Bell, subtítulo "Avisos, preferências e canais", badge de não lidas e chevron.
   - Seção "Outros": Privacidade & dados, Sobre o Dosiq, Sair da conta.

2. Remover duplicidade visual:
   - Não manter `Preferências de Notificação`, `Central de Avisos` e `Bot Telegram` como três entradas concorrentes no Perfil.
   - Telegram deixa de ser seção principal do Perfil; passa a viver dentro de Preferências.

3. Navegação:
   - Tap no card "Notificações" deve abrir `ROUTES.NOTIFICATION_INBOX` com `userId`.
   - Badge usa `useUnreadNotificationCount`.

4. Estado vazio:
   - Se `unreadCount === 0`, não mostrar badge vermelho.
   - Subtítulo continua útil.

**Critério de aceite**:
- Perfil possui apenas uma entrada principal para notificações.
- Usuário chega à Central de Avisos em 1 tap.
- Telegram não aparece como card solto no Perfil.
- Sem regressão no logout.

---

### Sprint 2.5 — Mobile Inbox: redesign "Avisos" + filtros + zero state

**Agente recomendado**: 🟢 **Avançado** (Codex/Sonnet/Pro)

**Entregas**:

1. Redesenhar `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx` seguindo `new-notification-central.png`:
   - Header com back icon à esquerda, título "Avisos", subtítulo dinâmico e gear à direita.
   - Gear navega para `ROUTES.NOTIFICATION_PREFERENCES`.
   - Chips/filtros horizontais:
     - `Todos`
     - `Não lidos`
     - `Doses`
     - `Estoque`
   - Manter agrupamento temporal (`Hoje`, `Ontem`, etc.) com labels em caixa alta.

2. Filtragem:
   - `Não lidos`: itens sem leitura conforme regra atual de `useUnreadNotificationCount`/local seen.
   - `Doses`: `dose_reminder`, `dose_reminder_by_plan`, `dose_reminder_misc`, `missed_dose`, `daily_digest`.
   - `Estoque`: `stock_alert`.
   - `Todos`: lista completa.

3. Cards:
   - Preservar CTAs de N1: registrar dose/plano/doses, ver estoque.
   - Preservar `X/N tomadas` em grouped notifications.
   - Usar ícone contextual por `notificationIconMapper`.
   - Unread dot no canto superior direito.

4. Zero state:
   - Título: "Tudo em dia por aqui".
   - Body: "Quando houver lembretes, alertas de estoque ou resumos, eles aparecem aqui."
   - Deve funcionar também para filtro sem resultados.

**Critério de aceite**:
- Filtros mudam a lista sem refetch desnecessário.
- Gear abre Preferências.
- Estado vazio é renderizado quando não há notificações ou filtro sem resultados.
- CTAs continuam navegando corretamente para Today/Stock.

---

### Sprint 2.6 — Mobile Preferências: canais, modos, quiet hours e digest

**Agente recomendado**: 🟢 **Avançado** (Codex/Sonnet/Pro)

**Entregas**:

1. Reescrever `apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx` seguindo `new-notification-settings.png`:
   - Título "Preferências".
   - Subtítulo "Escolha onde e quando ser avisado."
   - Card de status global "Notificações ativas" com switch.
   - Seção "Canais":
     - App (push): switch; se permissões ausentes, pedir permissão antes de ativar.
     - Telegram: row com status `CONECTADO`/`DESCONECTADO`, chevron para `ROUTES.TELEGRAM_LINK`.
     - Web (PWA): row visível com status `ATIVO`/`INATIVO`/`CONFIGURAR NA WEB`.
       - No app nativo, não tentar criar subscription PWA.
       - Se `channel_web_push_enabled === true` e houver device webpush ativo, mostrar ativo.
       - Se não houver device webpush ativo, mostrar "Configure pelo navegador".
     - Email: row disabled/backlog, switch off, sem persistência obrigatória nesta wave.

2. Mapear a UI nova para o contrato existente:
   - Source of truth novo: `channel_mobile_push_enabled`, `channel_web_push_enabled`, `channel_telegram_enabled`.
   - `notification_preference` legado deve ser atualizado apenas como compatibilidade:
     - mobile true + telegram false → `mobile_push`.
     - mobile false + telegram true → `telegram`.
     - mobile true + telegram true → `both`.
     - mobile false + telegram false → `none`.
     - Web (PWA) não cabe no enum legado; nunca depender dele para decidir `web_push`.
   - Bloquear status global ativo com todos os canais off e mostrar: "Ao menos um canal precisa estar ativo para receber lembretes de dose."

3. Adicionar novas configurações:
   - **Modo de envio**: `realtime`, `digest_morning`, `silent`.
   - **Não me incomode**: switch + 2 seletores de hora (`quiet_hours_start`, `quiet_hours_end`).
   - **Hora do resumo**: seletor de hora visível quando `notification_mode === 'digest_morning'`.

4. Persistência:
   - Salvar updates parciais em `user_settings`.
   - Sincronizar device token quando App push for ativado.
   - Persistir `channel_web_push_enabled`, mas deixar claro quando falta subscription webpush ativa.
   - Reload/refetch mostra valores salvos.

5. Acessibilidade:
   - Todo switch/row tem `accessibilityLabel`.
   - Ícones sempre acompanhados por texto.

**Critério de aceite**:
- Preferências controlam canais atuais sem regressão.
- Quiet hours e digest persistem no DB.
- App push respeita permissão nativa.
- Telegram row abre a tela dedicada.
- Web (PWA) aparece como canal global, sem tentar registrar service worker pelo app nativo.
- Não é possível deixar canais externos incoerentes sem feedback.

---

### Sprint 2.7 — Mobile Telegram: fluxo dedicado redesenhado

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Entregas**:

1. Redesenhar `apps/mobile/src/features/profile/screens/TelegramLinkScreen.jsx` seguindo `new-notification-telegram.png`:
   - Back icon.
   - Ícone Telegram grande.
   - Título "Conectar ao Telegram".
   - Copy: "Receba lembretes e registre doses direto pelo chat. Vai levar uns 30 segundos."
   - Card com passos:
     - "1 Abra o bot no Telegram" + CTA "Abrir @dosiq_bot".
     - "2 Envie este código no chat" + caixa escura com `/start TOKEN`.
     - Botão/ícone para copiar código.
     - Ação "Gerar novo código".
   - Nota de segurança: "O bot nunca pede sua senha. O código é temporário e só serve para vincular sua conta."

2. Estado conectado:
   - Mostrar status conectado, chat id mascarado se disponível e ação de renovar/desvincular somente se já existir suporte seguro.
   - Se não houver suporte de desvincular, deixar fora de escopo e documentar.

3. Clipboard:
   - Usar API disponível no workspace mobile; se exigir dependência nova, preferir fallback sem adicionar pacote e documentar.

**Critério de aceite**:
- Usuário consegue abrir Telegram e copiar/enviar token.
- Fluxo conectado e desconectado são claros.
- Não há texto pt-EU.

---

### Sprint 2.8 — Web Settings UI: canal Web (PWA), quiet hours e digest

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Entregas**:

1. Em `apps/web/src/views/redesign/Settings.jsx` e `apps/web/src/views/redesign/settings/SettingsRedesign.css`:
   - Adicionar seção "Canais" com:
     - App (push nativo): status informativo se houver device Expo ativo; edição principal no app nativo.
     - Web (PWA): switch funcional.
       - Ao ativar: chamar `webpushService.subscribe()` (criado/desbloqueado por N1.7), registrar subscription e gravar `channel_web_push_enabled = true`.
       - Ao desativar: gravar `channel_web_push_enabled = false`; se existir serviço para desativar subscription, chamar também. Se não existir, documentar follow-up.
       - Se o browser não suportar Push API/Service Worker, row fica disabled com mensagem curta.
     - Telegram: status e link/CTA para instruções existentes, sem recriar fluxo completo na web nesta wave.
     - Email: disabled/backlog.
   - Adicionar "Modo de notificação" com 3 opções:
     - "Tempo real"
     - "Resumo matinal"
     - "Silencioso"
   - Adicionar "Não me incomode" com switch + inputs `type="time"`.
   - Adicionar "Hora do resumo" visível em `digest_morning`.

2. Persistir via helper local extraído da própria view ou serviço dedicado, se criado.
   - O checkout atual não possui `userSettingsService`; se a implementação criar esse serviço, ele deve aceitar os booleans de canal e os campos de quiet hours/digest.
   - Não usar apenas `notification_preference` para representar canais.

3. Client-side validation:
   - `quiet_hours_start` e `quiet_hours_end` ambos preenchidos ou ambos vazios.
   - Pelo menos um canal externo ativo quando `notification_mode !== 'silent'`.

**Critério de aceite**:
- Configuração feita na web reflete no mobile.
- Configuração feita no mobile reflete na web.
- Ativar Web (PWA) cria subscription webpush e habilita `channel_web_push_enabled`.
- Desativar Web (PWA) impede `resolveChannelsForUser` de retornar `web_push`.
- Reload mantém os valores.

---

### Sprint 2.9 — Validação manual + DEVFLOW C5

**Agente recomendado**: ⚪ **Humano**

**Entregas**:

1. E2E manual:
   - Perfil → Notificações → Avisos → gear → Preferências → Telegram.
   - Central com zero state em conta sem notificações.
   - Filtros Todos/Não lidos/Doses/Estoque.
   - Web Settings → habilitar Web (PWA) → cron N1.7 envia `web_push`.
   - Web Settings → desabilitar Web (PWA) → cron não retorna `web_push`.
   - Configurar `quiet_hours_start=22:00`, `quiet_hours_end=07:00` em web → device físico não recebe push 23:00.
   - Alternar para `digest_morning 07:00` → único push aparece 07:00 com agenda do dia.
   - Modo `silent` → 0 push externo, mas Inbox ainda popula.

2. DEVFLOW C5:
   - ADR-NNN: "Política de quiet hours, modos de notificação, canais App/Web/Telegram e arquitetura nativa Perfil → Avisos → Preferências → Telegram".
   - R-NNN: "isInQuietHours deve tratar janela cross-midnight (start > end → spans midnight)".
   - R-NNN candidato: "Experiência nativa de notificações deve ter uma única porta de entrada no Perfil e um subfluxo dedicado para canal Telegram".
   - R-NNN candidato: "Canal `web_push` depende de flag explícita em `user_settings` e device ativo `notification_devices.provider='webpush'`; não inferir apenas de subscription existente."
   - Journal entry.

3. Quality gates:
   - `npm run validate:agent`
   - `npm run lint`
   - `cd apps/mobile && npm test -- --runInBand` ou comando mobile equivalente do workspace, se existir.

---

## 6. Tabela Resumo de Alocação

| Sprint | Descrição | Agente | Estimativa |
|--------|-----------|--------|------------|
| **2.1** | Migration + Zod schema | 🟡 Rápido | ~1h |
| **2.2** | Server: gate + supressão | 🟢 Avançado | ~3h |
| **2.3** | Server: trigger digest simples | 🟡 Rápido | ~1h |
| **2.4** | Mobile Perfil redesign | 🟢 Avançado | ~2h |
| **2.5** | Mobile Inbox redesign + filtros | 🟢 Avançado | ~3h |
| **2.6** | Mobile Preferências redesign + quiet hours | 🟢 Avançado | ~4h |
| **2.7** | Mobile Telegram redesign | 🟡 Rápido | ~2h |
| **2.8** | Web Settings canal PWA + quiet hours/digest | 🟡 Rápido | ~2h |
| **2.9** | Validação + DEVFLOW C5 | ⚪ Humano | ~2h + 24h calendário para quiet hours |

**Total**: ~20h trabalho + validação calendário. **4 sprints 🟢 (~12h)** + **4 sprints 🟡 (~6h)** + **1 sprint ⚪ (~2h)**.

---

## 7. Arquivos-alvo

### Backend / Schema

```
docs/migrations/*_notification_quiet_hours.sql
server/bot/utils/notificationGate.js
server/bot/utils/__tests__/notificationGate.test.js
server/bot/tasks.js
server/notifications/policies/resolveChannelsForUser.js
packages/core/src/schemas/userSettingsSchema.js        (se adotado como shared)
apps/web/src/schemas/userSettingsSchema.js             (se schema web separado)
```

### Mobile

```
apps/mobile/src/features/profile/screens/ProfileScreen.jsx
apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx
apps/mobile/src/features/notifications/components/NotificationItem.jsx
apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx
apps/mobile/src/features/profile/screens/TelegramLinkScreen.jsx
apps/mobile/src/features/profile/services/profileService.js
apps/mobile/src/features/profile/services/__tests__/profileService.test.js
apps/mobile/src/navigation/ProfileStack.jsx             (somente se rotas exigirem opções/header)
apps/mobile/src/navigation/routes.js                    (somente se rota nova for inevitável; preferir não criar)
```

### Web

```
apps/web/src/views/redesign/Settings.jsx
apps/web/src/views/redesign/settings/SettingsRedesign.css
apps/web/src/shared/services/webpushService.js          (usar `subscribe()` de N1.7)
apps/web/src/services/userSettingsService.js            (somente se criado; hoje não existe)
apps/web/src/schemas/userSettingsSchema.js              (se não migrar para core)
```

---

## 8. Regras e contratos relevantes

| Ref | Aplicação |
|-----|-----------|
| R-001 / R-092 | Verificar caminhos reais antes de editar specs/arquivos. |
| R-010 / R-110 | Hooks antes de handlers; guard clauses depois dos hooks. |
| R-121 / R-130 | Validar leitura e escrita de settings com Zod. |
| R-131 | Filtros temporais Supabase devem respeitar timezone/local day. |
| R-166 | Texto mobile deve localizar equivalente web antes de criar copy nova. |
| R-167 | Logs RN sempre protegidos por `if (__DEV__)`. |
| R-169 | Screens RN devem usar safe area. |
| R-180 | Header nativo padrão Santuário. |
| R-189 | Expo SDK 53 usa `shouldShowBanner` + `shouldShowList`. |
| AP-H16 | Evitar pt-EU em mobile (`registrar`, `tomar`, `tomadas`). |
| AP-059 | RN não resolve CSS vars; usar tokens JS/hex. |

---

## 9. Critério de Saída

PR #2 pode ser mergeado quando:

- ✅ Todos os 9 sprints concluídos.
- ✅ Perfil tem uma única porta de entrada para notificações.
- ✅ Central de Avisos nativa tem filtros, gear para Preferências, cards acionáveis e zero state.
- ✅ Preferências nativas controlam canais, modo, quiet hours e digest time.
- ✅ Canal Web (PWA) aparece nas configurações e controla `web_push` via flag + subscription ativa.
- ✅ Telegram tem fluxo dedicado redesenhado.
- ✅ Migration aplicada em staging e validada.
- ✅ Quiet hours validado em device físico por janela completa.
- ✅ `digest_morning` envia 1 push no horário configurado com contagem do dia.
- ✅ Settings cross-platform sync funcional.
- ✅ Gemini review aprovado.
- ✅ `npm run validate:agent` + `npm run lint` passando.
- ✅ DEVFLOW C5 (ADR + R + journal).

---

## 10. Fora do escopo

- Redesign web completo da Central de Avisos.
- Email como canal funcional de notificações.
- Desvincular Telegram, se a operação segura ainda não existir.
- Formatter enriquecido do digest e copy variável (N3).
- Tracking `opened_at` / `action_taken_at` (N3).
- Framework de A/B test.
