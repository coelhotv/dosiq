# Guia de Validação Manual — Sprint N1.8 (Wave N1)

> **Sprint:** N1.8 — Validação manual + DEVFLOW C5
> **Spec:** [`EXEC_SPEC_WAVE_N1_GROUPING.md`](./EXEC_SPEC_WAVE_N1_GROUPING.md)
> **Pré-requisito:** Sprints N1.1–N1.6 mergeadas em `main` (PRs #496–501) ✅

---

## Pré-condições Gerais

- Bot Telegram de sandbox configurado e apontando para o servidor local ou Vercel preview
- App mobile instalado no device físico (build de desenvolvimento ou Expo Go)
- Protocolos de teste configurados na conta do usuário de sandbox
- Acesso ao Vercel Logs (ou terminal local) para acompanhar o cron em tempo real

---

## Bloco 1 — Sandbox bot Telegram

### Como acionar o cron manualmente

Em vez de aguardar o cron da Vercel, dispare `notify.js` diretamente:

```bash
# Via Vercel CLI (preview ou produção)
curl -X POST https://<preview-url>/api/notify \
  -H "Authorization: Bearer <CRON_SECRET>"

# Ou localmente
cd server
node -e "import('./bot/tasks.js').then(m => m.checkRemindersViaDispatcher())"
```

Acompanhe os logs em tempo real no Vercel Dashboard → Functions → `api/notify`.

---

### Cenário A — 8 doses avulsas (misc)

**Setup:** 8 protocolos ativos **sem** `treatment_plan_id`, todos com o mesmo horário (ex: `08:00`).

| Critério | ✅/❌ |
|---|---|
| Chegou **1 mensagem** no Telegram (não 8) | |
| Título: "Hora dos medicamentos" | |
| Corpo lista todos os 8 medicamentos | |
| Botão "Registrar doses" presente | |

---

### Cenário D — 4+3 em dois planos distintos

**Setup:** Plano A com 4 protocolos às `08:00`, Plano B com 3 protocolos às `08:00`.

| Critério | ✅/❌ |
|---|---|
| Chegaram **2 mensagens** separadas (não 7) | |
| Mensagem 1 exibe o nome correto do Plano A | |
| Mensagem 2 exibe o nome correto do Plano B | |
| Cada mensagem tem botão "Registrar este plano" | |

---

### Cenário E — 4+3+2 (dois planos + avulsos)

**Setup:** Plano A (4 doses) + Plano B (3 doses) + 2 protocolos avulsos sem plano — todos às `08:00`.

| Critério | ✅/❌ |
|---|---|
| Chegaram **3 mensagens** (não 9) | |
| Mensagem do Plano A com 4 itens | |
| Mensagem do Plano B com 3 itens | |
| Mensagem avulsa com 2 itens | |

---

### Botão "Registrar este plano" — validação cruzada

1. Clique no botão do **Plano A** no Telegram
2. Abra o app web → Dashboard → Hoje

| Critério | ✅/❌ |
|---|---|
| Apenas doses do Plano A aparecem como registradas | |
| Doses do Plano B continuam pendentes | |
| Estoque decrementado corretamente para cada medicamento do Plano A | |
| Mensagem original editada (botões removidos após confirmação) | |

---

## Bloco 2 — App Mobile (device físico)

### Teste 1 — Cold start (app morto → tap em push)

**Setup:** force-quit o app (swipe up e fechar).

Dispare push manualmente via Expo CLI:

```bash
npx expo push:send \
  --to <ExpoPushToken> \
  --title "💊 Plano Manhã" \
  --body "3 medicamentos — 08:00" \
  --data '{"navigation":{"screen":"bulk-plan","params":{"at":"08:00","planId":"<uuid>","treatmentPlanName":"Plano Manhã"}}}'
```

> O `ExpoPushToken` aparece nos logs do app ao iniciar (`[usePushNotifications] token: ExponentPushToken[...]`).

| Critério | ✅/❌ |
|---|---|
| App abre ao tocar na notificação | |
| `BulkDoseRegisterModal` abre diretamente (sem passar pela home) | |
| Modal exibe os medicamentos corretos do plano | |
| Header exibe o nome do plano | |

---

### Teste 2 — Foreground (app aberto → push chega)

**Setup:** app aberto na tela Today.

Dispare o mesmo push via Expo CLI (mesmo comando acima).

| Critério | ✅/❌ |
|---|---|
| Banner de notificação aparece com app em foreground | |
| Tocar no banner abre o `BulkDoseRegisterModal` | |
| Modal exibe dados corretos (plano, medicamentos, horário) | |

---

### Teste 3 — Inbox com contagem "X/N tomadas"

1. Dispare uma notificação de plano com 4 medicamentos
2. No modal, **desmarque 2** e registre apenas 2 doses
3. Navegue para a tela de Notificações (ícone do sino)

| Critério | ✅/❌ |
|---|---|
| Item da notificação exibe "2/4 tomadas" | |
| Indicador visual proporcional (ex: amarelo em 2/4, verde em 4/4) | |
| Item de dose individual continua exibindo ✅/❌ simples (sem X/N) | |

---

### Teste 4 — Lock screen iOS (cenário D)

**Setup:** Plano A (4 doses) e Plano B (3 doses) configurados para o mesmo horário.

| Critério | ✅/❌ |
|---|---|
| Aparecem **2 notificações distintas** no lock screen | |
| Notificações **não colapsadas** em grupo único | |
| Cada uma exibe o nome do plano correto | |

---

## Bloco 3 — Quality Gates

Execute na ordem abaixo antes de fechar o C5:

```bash
# 1. Testes críticos web (10-min kill switch)
cd apps/web
npm run validate:agent

# 2. Lint
npm run lint

# 3. Testes unitários do bot
cd ../../server
node --experimental-vm-modules node_modules/.bin/jest \
  bot/__tests__/partitionDoses.test.js \
  bot/__tests__/doseFormatters.test.js \
  bot/__tests__/takeplan.test.js \
  --verbose
```

| Gate | ✅/❌ |
|---|---|
| `validate:agent` passa sem erros | |
| `lint` zero errors | |
| `partitionDoses.test.js` (9 cenários A–I) | |
| `doseFormatters.test.js` (truncamento 1/4/12 doses) | |
| `takeplan.test.js` (cross-plano não vaza) | |

---

## Checklist Final (C5 pós-validação)

Após todos os blocos acima passarem, reportar ao agente para executar DEVFLOW C5:

- [ ] Todos os cenários Telegram validados (A, D, E + botão cross-plan)
- [ ] Cold start mobile ✅
- [ ] Foreground tap ✅
- [ ] Inbox "X/N tomadas" ✅
- [ ] Lock screen iOS 2 notificações distintas ✅
- [ ] Quality gates passando

O agente executará o C5 final da Wave N1:
- AP faltante: "não colapsar todas as doses simultâneas em uma única notif consolidada"
- R faltante: "push payload mobile deve incluir `data.navigation = { screen, params }`"
- Journal entry de encerramento da Wave N1
- `state.json` → `completed`
