# Exec Spec — Wave N2: Quiet Hours + Digest Mode

> **Status:** PRONTO PARA EXECUÇÃO (após N1 mergeado)
> **Master Plan:** [`MASTER_PLAN_NOTIFICATIONS_REVAMP.md`](./MASTER_PLAN_NOTIFICATIONS_REVAMP.md)
> **Idea Plan:** [`IDEA_PLAN_NOTIFICATIONS_REVAMP.md`](./IDEA_PLAN_NOTIFICATIONS_REVAMP.md) — §Wave N2
> **Pré-requisito:** Wave N1 mergeado (PR #1) · **independente de N3**
> **PR alvo:** PR #2 da reforma
> **Estimativa:** ~2.5 dias úteis · 6 sprints
>
> **Nota de design (2026-04-26):** O formatter enriquecido do digest (`formatDailyDigestMessage` com
> agrupamento por bloco temporal + copy variável) foi movido para **N3 Sprint 3.4** — separação de
> responsabilidades: N2 = *quando* enviar (gates), N3 = *o que* enviar (conteúdo + copy).
> Sprint 2.3 aqui entrega apenas o **trigger do digest com formato simples** (placeholder funcional).

---

## 1. Objetivo

Dar controle ao usuário sobre **quando** ser interrompido. Adicionar quiet hours (`HH:MM` start/end) e modos de notificação (`realtime` / `digest_morning` / `silent`). Estender Settings UI nas duas pontas (web + mobile).

---

## 2. Pré-requisitos

| Item | Estado |
|------|--------|
| Wave N1 mergeado | ⏳ (PR #1 deve estar em produção) |
| `runDailyDigest` existente em `tasks.js` | ✅ |
| `userSettingsService` no web | ✅ |
| `NotificationPreferencesScreen` mobile (431 linhas) | ✅ — só toggle de canal |
| `getCurrentTimeInTimezone` helper | ✅ (`server/bot/utils/`) |

---

## 3. Convenção de Alocação de Agente

(Ver §3 de [`EXEC_SPEC_WAVE_N1_GROUPING.md`](./EXEC_SPEC_WAVE_N1_GROUPING.md) para definição completa.)

| Categoria | Modelos |
|-----------|---------|
| **🟢 Avançado** | Claude Sonnet, Gemini Pro, GPT Codex |
| **🟡 Rápido** | Claude Haiku, Gemini Fast, GPT Mini |
| **⚪ Humano** | Validação manual |

---

## 4. Sprints

### Sprint 2.1 — Migration Supabase + Zod schema sync

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Operação mecânica com padrão conhecido. Spec exata abaixo. Risco baixo (campos nullable, default seguro).

**Entregas**:

1. Criar migration em `supabase/migrations/` (ou local correspondente do projeto):
   ```sql
   ALTER TABLE user_settings
     ADD COLUMN quiet_hours_start TIME,
     ADD COLUMN quiet_hours_end TIME,
     ADD COLUMN notification_mode TEXT DEFAULT 'realtime'
       CHECK (notification_mode IN ('realtime', 'digest_morning', 'silent')),
     ADD COLUMN digest_time TIME DEFAULT '07:00';
   ```

2. Atualizar Zod schema (`apps/web/src/schemas/userSettingsSchema.js` — criar se não existir, ou estender):
   ```js
   quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
   quiet_hours_end:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
   notification_mode: z.enum(['realtime', 'digest_morning', 'silent']).default('realtime'),
   digest_time:       z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('07:00'),
   ```

3. Confirmar que mobile usa o mesmo schema (importa de `@dosiq/core` ou tem cópia sincronizada).

4. Test:
   - `userSettingsSchema.test.js` valida formato HH:MM, enum, defaults.

**Critério de aceite**:
- Migration aplica sem erro em ambiente staging.
- `safeParse` aceita inputs válidos e rejeita formato errado.
- Schema-DB sincronizados (R-CLAUDE.md sobre sync obrigatório).

---

### Sprint 2.2 — Server: lógica de supressão por modo + quiet hours

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: Lógica timezone-aware com edge cases (quiet hours que cruzam meia-noite ex: `22:00`–`07:00`), 3 modos com comportamentos distintos, integração com cron de minuto a minuto. Erro silencioso aqui = lembretes perdidos.

**Entregas**:

1. Criar helper `server/bot/utils/notificationGate.js`:
   ```js
   export function shouldSendNow({ mode, quietHoursStart, quietHoursEnd, currentHHMM }) {
     if (mode === 'silent') return false
     if (mode === 'digest_morning') return false  // só no horário do digest
     if (isInQuietHours(currentHHMM, quietHoursStart, quietHoursEnd)) return false
     return true
   }
   ```
   - `isInQuietHours` deve tratar janela cross-midnight: `22:00 → 07:00` significa "se HHMM ≥ 22:00 OU < 07:00".

2. Em `server/bot/tasks.js` (`checkRemindersViaDispatcher`):
   - Antes de cada `dispatcher.dispatch()`, chamar `shouldSendNow()` com config do user.
   - Se `false`: skip (sem dispatch, mas ainda persiste em `notification_log` com `status='suprimida'` e `channels=[]`? — decidir; o ideal é ainda aparecer na Inbox como "Lembrete suprimido por quiet hours" para auditabilidade).

3. Tests:
   - `notificationGate.test.js` — fixture para cada modo × dentro/fora de quiet hours × cross-midnight.

**Critério de aceite**:
- Modo `silent`: nenhum push enviado, log persiste como suprimido.
- Modo `realtime` + dentro de quiet 22:00–07:00 → suprime.
- Modo `realtime` + fora de quiet → envia.
- Cross-midnight válido (23:00 dentro de 22:00–07:00).

---

### Sprint 2.3 — Server: trigger do digest matinal (formato simples — enriquecimento em N3)

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Mecânico — apenas conectar modo `digest_morning` ao cron existente com formato
simples funcional. O formatter enriquecido por bloco temporal + copy variável é responsabilidade de
**N3 Sprint 3.4** (separação de responsabilidades). Downgrade de 🟢 para 🟡.

**Entregas**:

1. Em `server/bot/tasks.js` (`runDailyDigest`):
   - Quando `notification_mode === 'digest_morning'` e `currentHHMM === user.digest_time`:
     - Buscar `protocols` do user com `time_schedule` não-vazio
     - Contar total de doses do dia
     - Disparar **1 push** via `dispatcher.dispatch()` com formato simples:
       ```
       ☀️ Sua agenda de hoje — X doses programadas
       ```
     - Body: lista flat de horários e nomes (sem agrupamento por bloco — isso vem em N3)
   - Usar `kind = 'daily_digest'` já existente no dispatcher

2. Test:
   - `runDailyDigest.test.js` — valida que 1 único push é disparado no horário configurado,
     e que fora do horário nada é enviado.

**Critério de aceite**:
- 1 push enviado no `digest_time` configurado para usuários com `notification_mode = 'digest_morning'`.
- Corpo contém contagem total de doses.
- Renderização válida em MarkdownV2 (sem caracteres não-escapados).

> **Nota**: O formato ficará simples até N3 ser mergeado. Após N3, o mesmo push passará a usar
> `formatDailyDigestMessage` enriquecido com agrupamento por bloco + copy variável.

---

### Sprint 2.4 — Web Settings UI: 3 seções novas

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Form padrão com design system existente. Spec exata abaixo. Sem decisões arquiteturais.

**Entregas**:

1. Em `apps/web/src/features/settings/...` (caminho exato pode ser `apps/web/src/views/Settings.jsx` ou similar):
   - Adicionar seção "Notificações" abaixo do toggle de canal:

   **(a) Modo de notificação** — radio group com 3 opções:
   - "Tempo real" (default) — recebe cada lembrete na hora
   - "Resumo matinal" — 1 lembrete por dia com toda a agenda
   - "Silencioso" — só na Central de Avisos

   **(b) Não me incomode** — switch + 2 inputs `type="time"`:
   - "Início" e "Fim" das quiet hours
   - Disabled se switch off

   **(c) Hora do resumo** — input `type="time"` (visível apenas quando modo = `digest_morning`):
   - Default 07:00

2. Persistir via `userSettingsService.update({ quiet_hours_start, quiet_hours_end, notification_mode, digest_time })`.

3. Toast de confirmação ao salvar (reutilizar componente existente).

**Critério de aceite**:
- Form persiste no DB.
- Reload da página mostra valores corretos.
- Validação client-side: quiet_hours_start e end ambos preenchidos ou ambos vazios.

---

### Sprint 2.5 — Mobile Settings UI: 3 seções com `DateTimePicker`

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Form RN com `@react-native-community/datetimepicker` (padrão conhecido). Spec idêntica à web. Sem edge cases incomuns.

**Entregas**:

1. Em `apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx` (estender as 431 linhas existentes):
   - Adicionar 3 seções idênticas ao web (modo / quiet hours / digest_time).
   - Usar `RadioGroup` ou `SegmentedControl` para modo.
   - `Switch` + 2 botões que abrem `DateTimePicker` (mode='time') para quiet hours.
   - Idem para digest_time.

2. Persistir via service equivalente (`apps/mobile/src/features/profile/services/userSettingsService.js`).

3. A11y: cada controle com `accessibilityLabel` (R-138).

**Critério de aceite**:
- Config persiste no DB e reflete em web (cross-platform sync).
- DateTimePicker abre nativo iOS/Android.
- A11y validado com VoiceOver/TalkBack.

---

### Sprint 2.6 — `userSettingsService` updates + tests cross-platform

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: CRUD simples, spec clara, mecânico.

**Entregas**:

1. Estender `userSettingsService.update()` (web + mobile) para aceitar os 4 novos campos.
2. Tests unitários:
   - Update parcial (só `notification_mode`) preserva outros campos.
   - Update de quiet_hours valida formato HH:MM.

**Critério de aceite**:
- `npm run test:critical` cobre os novos campos.

---

### Sprint 2.7 — Validação manual + DEVFLOW C5

**Agente recomendado**: ⚪ **Humano**

**Entregas**:

1. **E2E manual**:
   - Configurar `quiet_hours_start=22:00`, `end=07:00` em web → device físico não recebe push 23:00 (validar por 24h).
   - Alternar para `digest_morning 07:00` → única push aparece 07:00 com agenda do dia.
   - Modo `silent` → 0 push, mas Inbox ainda popula.

2. **DEVFLOW C5**:
   - ADR-NNN: "Política de quiet hours e modos de notificação"
   - R-NNN: "isInQuietHours deve tratar janela cross-midnight (start > end → spans midnight)"
   - Journal entry

3. **Quality gates**:
   - `npm run validate:agent`
   - `npm run lint`

---

## 5. Tabela Resumo de Alocação

| Sprint | Descrição | Agente | Estimativa |
|--------|-----------|--------|------------|
| **2.1** | Migration + Zod schema | 🟡 Rápido | ~1h |
| **2.2** | Server: gate + supressão | 🟢 Avançado | ~3h |
| **2.3** | Server: trigger digest simples *(formatter enriquecido → N3)* | 🟡 Rápido | ~1h |
| **2.4** | Web Settings UI | 🟡 Rápido | ~2h |
| **2.5** | Mobile Settings UI | 🟡 Rápido | ~2.5h |
| **2.6** | `userSettingsService` updates | 🟡 Rápido | ~1h |
| **2.7** | Validação + DEVFLOW C5 | ⚪ Humano | ~2h (E2E quiet hours leva 24h calendário) |

**Total**: ~12.5h trabalho *(era 14.5h — -2h movidas para N3)*. **1 sprint 🟢 (~3h)** + **5 sprints 🟡 (~7.5h)** + **1 sprint ⚪ (~2h)**.

---

## 6. Distribuição de Tokens (estimativa)

- **🟢 Avançado** (2.2, 2.3): ~25k–50k tokens cada.
- **🟡 Rápido** (2.1, 2.4, 2.5, 2.6): ~5k–15k tokens cada.

Wave N2 estimado: **25k–50k tokens em modelos avançados** + **25k–75k em modelos rápidos**.

> **Observação**: Com o formatter enriquecido movido para N3, N2 é agora dominantemente 🟡.
> Excelente para usar quota residual de modelos rápidos — apenas Sprint 2.2 (gate cross-midnight)
> requer raciocínio mais cuidadoso.

---

## 7. Critério de Saída

PR #2 pode ser mergeado quando:

- ✅ Todos os 7 sprints concluídos
- ✅ Migration aplicada em staging e validada (rollback testado se necessário)
- ✅ Quiet hours validado em device físico por janela completa de 24h
- ✅ Modo `digest_morning` valida 1 push às 07:00 com contagem de doses do dia (formato simples — enriquecimento vem com N3)
- ✅ Settings cross-platform sync funcional
- ✅ Gemini review aprovado
- ✅ `npm run validate:agent` + `npm run lint` passando
- ✅ DEVFLOW C5 (ADR + R + journal)
