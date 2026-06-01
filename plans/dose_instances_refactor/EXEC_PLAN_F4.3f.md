# EXEC PLAN — F4.3f: injeção de tz ponta-a-ponta (fecha G1 fora do Histórico)

> **Origem:** MASTER §5 (ln 132-134, "tz antes de gerar — ordem não-negociável"; Q-A/Q-I ln 220/228) + `EXEC_PLAN_F4.3.md` §F4.3f (ln 96-110).
> **Problema:** o planner (`planWindow`/`generateInstances`) e o helper de zonas (`splitDayTimeline`/`classifyDose`) **já são tz-injetáveis** (param `tz`, default SP). O gap é que os **callers não passam o tz do usuário**: geração (write-path + cron) e "hoje" (web/mobile) usam `'America/Sao_Paulo'` hardcoded. Usuário expat (tz ≠ SP, habilitado ADR-053) tem `scheduled_for` materializado no fuso errado E virada-de-dia/HH:MM em SP.
> **Plataforma:** Shared/Core + Web/PWA + Mobile + Backend/Infra (cron `server/bot`).
> **ADRs:** ADR-049/053 (tz/expat) — **aceitos, sem ADR novo**. **Contratos:** CON-024 (já tz-injetável — sem mudança de assinatura).
> **Decisão PO:** **3 sub-PRs** (F4.3f.0 onboarding+nudge → mobile 0.7.2 · F4.3f.1 leitura+write-path → 0.7.3 · F4.3f.2 prompt troca → **0.8.0 release de loja**); **backfill impossível** (não conhecemos o tz real; `timezone=SP` é default, não verdade — reconciliação dos existentes via nudge no Perfil).

---

## Estado verificado (planner já pronto)

| Função | Caminho | tz |
|--------|---------|-----|
| `planWindow({...,tz})` | `packages/core/src/services/doseInstancePlanner.js:14` | ✅ param, default SP |
| `ensureInstancesUpTo({...,tz})` | `doseInstancePlanner.js:29` | ✅ |
| `renewProtocolWindow({...,tz})` | `doseInstancePlanner.js:67` | ✅ |
| `generateInstances(p, from, to, tz)` | `doseInstancePlanner.js` | ✅ |
| `splitDayTimeline(...,{tz})` / `classifyDose` / `buildDoseItemsFromInstances` | `doseZones.js` (CON-024) | ✅ |

**Gap = callers:**
- `createProtocolRepository.syncInstancesOnWrite` → `planWindow` **sem tz** (`createProtocolRepository.js:69`).
- `server/bot/doseInstanceScheduler.js` → `renewProtocolWindow`/`ensureInstancesUpTo` **sem tz** (default SP).
- web `useDoseZones` → `splitDayTimeline(..., { tz: DEFAULT_TZ })` (hardcoded).
- mobile `_useTodayDerived` → `splitDayTimeline(..., { tz: DEFAULT_TZ })` + `getTodayLocal()` (default SP).
- web `useDashboardContext` **não busca** `user_settings.timezone` (0 ocorrências).
- mobile `getUserSettings` retorna a linha — confirmar `timezone` no select.

---

## F4.3f.0 — Captura de tz do device (contas novas) + nudge de reconciliação (existentes)

> **SemVer:** Web Minor · Mobile Minor (→ **0.7.2**). **Fundação:** novas contas nascem com o tz real; existentes recebem convite passivo p/ ajustar. PR próprio, ANTES do f.1.
> **Por quê:** `timezone` default SP não reflete a localização real (a UI nunca capturou o device). Sem isto, expat NOVO nasce SP errado, e expat EXISTENTE nunca é avisado (prompt do f.2 só cobre *troca* manual).

### Deliverables
| # | Arquivo | Ação |
|---|---------|------|
| 1 | web `OnboardingProvider.jsx` (completeOnboarding upsert) | incluir `timezone` no upsert inicial = device tz (`Intl.DateTimeFormat().resolvedOptions().timeZone`), validado contra a lista suportada (ADR-053); fora da lista → `America/Sao_Paulo`. |
| 2 | mobile criação de `user_settings` (`profileService` upsert / fluxo de signup-onboarding) | idem com `expo-localization` (device tz), validado, fallback SP. |
| 3 | (core/shared) helper `resolveSupportedTz(deviceTz)` → tz suportado ou SP | normaliza device tz → opção válida (ADR-053). Reuso web+mobile (R-231). |
| 4 | **nudge no Perfil** (web `features/profile` + mobile `features/profile`) | card/banner informativo: "Novidade: agora o Dosiq respeita seu fuso horário. Confira o seu nas Configurações." + CTA → settings (seletor de tz). Dispensável; some após o usuário ajustar o tz manualmente. |
| 5 | ⚠️ **validação expat** | conferir/expandir o enum de tz (mobile `profileService.js:159` `z.enum(TIMEZONES_BR)`) p/ aceitar as cidades expat da ADR-053/F4.2b — senão Londres trava no save. |
| 6 | testes | onboarding grava device tz (mock Intl/localization); fallback SP p/ tz não suportado; nudge aparece/dispensa. |
| 7 | `app.config.js` + `CHANGELOG.md` | SQP mobile 0.7.1→0.7.2 + web minor + store-note. |

### Aceite (SC)
- [ ] Conta nova criada em Londres → `user_settings.timezone='Europe/London'` (device), doses nascem em Londres (via f.1).
- [ ] Device tz não suportado → fallback SP, sem erro.
- [ ] Usuário existente vê nudge no Perfil → CTA leva ao seletor de tz; nudge some após ajuste.
- [ ] Enum de tz aceita cidades expat (ADR-053) — Londres não trava.

> **Nota:** a captura é **silenciosa** na criação (conta nova não tem dose a perturbar). A reconciliação dos existentes é **passiva** (nudge), nunca prompt no load nem auto-write.

## F4.3f.1 — Leitura "hoje" tz + write-path tz (geração no fuso do dono)

> **SemVer:** Web Minor · Mobile Minor (→ **0.7.3**) · Core no-user-impact (callers). **Sem DADOS** (só novas escritas no tz certo). **Dep:** F4.3f.0.

### Deliverables (caminhos canônicos)
| # | Arquivo | Ação |
|---|---------|------|
| 1 | `packages/core/src/repositories/createProtocolRepository.js` | `syncInstancesOnWrite`: resolver tz do dono (`SELECT timezone FROM user_settings WHERE user_id = protocol.user_id`, 1 leitura, fallback SP) e passar a `planWindow`. Helper `resolveUserTz(client, userId)`. Idem qualquer `ensureInstancesUpTo` chamado aqui. |
| 2 | `server/bot/doseInstanceScheduler.js` | renovação due-only: para cada protocolo, resolver tz do dono (batch map `userId→timezone` numa query, ou join no SELECT de protocolos) e passar a `renewProtocolWindow`/`ensureInstancesUpTo`. Fallback SP. |
| 3 | `apps/web/src/features/dashboard/hooks/useDashboardContext.jsx` | adicionar fetch de `user_settings.timezone` (cache) e expor `timezone` no contexto. |
| 4 | `apps/web/src/features/dashboard/hooks/useDoseZones.js` | receber `timezone` do contexto; passar a `splitDayTimeline({ tz })` e `classifyDose`/`getUserTime`. Fallback SP quando ausente. |
| 5 | `apps/mobile/src/features/dashboard/services/dashboardService.js` | `getUserSettings`: garantir `timezone` no select. |
| 6 | `apps/mobile/src/features/dashboard/hooks/useTodayData.js` | propagar `userSettings.timezone` ao `data` consumido pelo `_useTodayDerived`. |
| 7 | `apps/mobile/src/features/dashboard/hooks/_useTodayDerived.js` | usar `data.timezone` (fallback SP) em `splitDayTimeline({ tz })`, `getTodayLocal(tz)` e fronteiras da janela de adesão. |
| 8 | testes | core (write-path passa tz não-SP → `scheduled_for` muda), web vitest (`useDoseZones` tz), mobile jest (`_useTodayDerived` tz), scheduler (tz por protocolo). |
| 9 | `app.config.js` + `CHANGELOG.md` | SQP: mobile 0.7.1→0.7.2 + web minor + entradas PT + store-note. |

### Migração (base atual) — CUIDADO: dado não é verdade capturada
`user_settings.timezone` tem **default `'America/Sao_Paulo'`** e a UI **nunca capturou o tz do device** → 100% das linhas = SP é **artefato do default**, NÃO prova de que os usuários estão em SP. Pode haver **expat silencioso** (fisicamente fora, `timezone=SP` errado). **Não dá pra backfill** (não conhecemos o tz real de ninguém — backfill cego pioraria). O tz e2e **não altera horários existentes**; corrige daqui pra frente. Reconciliar os existentes = **nudge no Perfil** (F4.3f.0), não automático.

### Cenários validados (write-path + leitura)
- Create/edit SP → idêntico (baseline).
- Create/edit expat (Londres) → `scheduled_for` em Londres; "hoje" deriva dia/HH:MM em Londres.
- DST (Londres BST↔GMT): resolvido pelo **nome IANA** via `Intl` (ADR-053) — geração e display corretos atravessando a virada; `classifyDose`/carryOver/lookAhead por instante absoluto.
- Consistência G2: geração e leitura no MESMO tz do perfil + MESMO fallback SP.

### Aceite (SC)
- [ ] Expat (`Europe/London`) cria/edita "08:00" → `scheduled_for` materializa **08:00 Londres** (não SP).
- [ ] "hoje" web+mobile deriva virada-de-dia e HH:MM no fuso de Londres.
- [ ] Cron renova no tz do dono de cada protocolo.
- [ ] SP segue idêntico (zero regressão maioria) — fallback SP quando `timezone` ausente.

## F4.3f.2 — Troca de tz → prompt de intenção (viagem vs mudança)

> **SemVer:** Web Minor · Mobile Minor (→ **0.8.0** — **release de loja**, fecha a Fase 4). **DADOS:** só na opção "Me mudei" (regenera `pending` futuras). **Dep:** F4.3f.1 (geração já tz-aware).
> **Decisões PO (validadas):** prompt enquadrado por **intenção**; **viagem é a 1ª opção** (mais comum/segura); dismiss = mantém (b1) e **não repergunta**; regen só de **futuras** (passado imutável, Q-E); notificações = **follow-up separado**; backfill = **pulado** (base 100% SP hoje).

### Modelo (crucial)
`user_settings.timezone` governa geração + display + (futuro) notif. Logo:
- **(b1) "Estou só de viagem"** = **NÃO persistir o tz novo** — a troca é cancelada pro app; o seletor volta ao fuso antigo. Sem divergência, sem coluna nova, sem regen, **não repergunta naturalmente** (só reabre se o usuário trocar de novo). Doses seguem no horário de casa (espaçamento 24h preservado).
- **(a) "Me mudei para {cidade}"** = persistir tz novo + `wipeFuturePending(protocolId)` + `planWindow(fromTs=now, tz=novo)` p/ cada tratamento ativo. Best-effort (R-245/246). Passadas/`taken`/`missed` intactas.

O prompt **só aparece** se a troca for p/ um tz diferente E houver **tratamento ativo com dose futura**; senão grava direto (conta nova/vazia).

### Copy (idoso-friendly, intenção, "tratamento" nunca "protocolo")
```
Título: Seu fuso horário mudou
Corpo:  Você mudou de {cidadeAntiga} para {cidadeNova}. O que fazer com os horários das suas doses?

[ Estou só de viagem ]            ← primário (topo)
  Suas doses seguem no horário de {cidadeAntiga}. A dose das {hhmm} toca quando for
  {hhmm} em {cidadeAntiga} ({hhmmEquivNovo} aqui).

[ Me mudei para {cidadeNova} ]    ← secundário
  Suas doses passam para o horário daqui. A dose das {hhmm} vai tocar às {hhmm} em {cidadeNova}.
```
- `{hhmm}` = dose ativa mais cedo do usuário (exemplo concreto). `{hhmmEquivNovo}` = esse instante no fuso novo.
- Cidades com label amigável (ADR-053: "Londres"/"Lisboa"/"Nova York"), nunca IANA cru.

### Deliverables
| # | Arquivo | Ação |
|---|---------|------|
| 1 | `apps/web/src/features/settings/hooks/useSettingsState.js` | `updateTimezone`: ANTES de persistir, se tz≠atual E há tratamento ativo c/ dose futura → abrir prompt. (a)→persiste+wipe+regen; (b1)/dismiss→**descarta** (mantém tz antigo). |
| 2 | (web) componente do prompt | modal/diálogo de intenção (reusa primitivas de modal do dashboard; copy acima). |
| 3 | `apps/mobile/src/features/profile/services/profileService.js` (+ `useProfile.js` + `SettingsScreen.jsx`) | mesma lógica + bottom-sheet/Alert de intenção (R-231 na parte core). |
| 4 | (core) helper `regenActiveProtocolsForTz({ client, userId, tz })` em serviço compartilhado (wipeFuturePending + planWindow por tratamento ativo) — usado por web+mobile na opção (a), sem duplicar (R-231). | criar |
| 5 | testes | core (regenActiveProtocolsForTz: futuras regeneradas, passadas intactas); web+mobile (a→regen, b1→não persiste/não regen, trigger só c/ dose futura). |
| 6 | `app.config.js` + `CHANGELOG.md` | SQP mobile 0.7.3→**0.8.0** (release de loja — consolida Fase 4) + web minor + **store-note de release** (notas de loja agregando tz e2e: doses no seu fuso, viagem vs mudança). |

### Aceite (SC)
- [ ] Trocar tz com tratamento ativo → prompt de intenção (viagem 1º).
- [ ] "Me mudei" → pending futuras regeneradas no novo tz; passadas/`taken`/`missed` intactas.
- [ ] "Estou de viagem"/dismiss → tz NÃO persiste; nenhuma dose muda; não repergunta.
- [ ] Sem tratamento ativo c/ dose futura → grava o tz direto, sem prompt.
- [ ] Best-effort: falha de regen não bloqueia o fluxo.

---

## Ordem & gates
`F4.3f.0 (onboarding+nudge) → [smoke conta nova expat + merge] → F4.3f.1 (leitura+write-path) → [smoke expat + merge] → F4.3f.2 (prompt troca) → [smoke troca-de-tz + merge]` → **Fase 4 fechada → distill final + RETRO**.

Cada PR: R-221 SQP, lint 0 + testes do workspace ANTES do commit, smoke PO ANTES do PR (R-234), Gemini review, merge humano (R-060). C5 pós-merge.

## Riscos
- **R1 — resolveUserTz no write-path:** +1 leitura por escrita de protocolo. Mitigar: SELECT único `timezone`, fallback SP, best-effort (R-245).
- **R2 — cron tz por protocolo:** N protocolos due → evitar N+1; batch map `userId→timezone` numa query.
- **R3 — consistência geração↔leitura (G2):** ambos no mesmo tz do perfil mata a divergência — garantir fallback SP idêntico nos dois lados.
- **R4 — regen on tz-change (F4.3f.2) recria muitas linhas:** escopar a `pending` futura + best-effort.
- **R5 — smoke expat:** usar conta de teste com `timezone='Europe/London'`; time-travel (docs/operations/DEV_TIME_TRAVEL.md) se precisar cruzar dia. AP-203 (não sujar `taken_at`).
- **R6 — instâncias legadas SP de quem virou expat:** regen-on-change (F4.3f.2) cobre no próximo write/troca; backfill pulado (decisão PO).

## Contratos / Memória
- CON-024 — sem mudança de assinatura (tz já é param). R-231 (reuso core), R-248, R-245/246 (best-effort), R-179 (script escopado — N/A, backfill pulado), R-166 (texto), ADR-049/053.

## DoD (F4.3f)
- [ ] Conta nova captura device tz no onboarding (fallback SP); enum aceita expat (ADR-053). (f.0)
- [ ] Existentes recebem nudge no Perfil → CTA p/ ajustar tz manual. (f.0)
- [ ] Geração (write-path + cron) usa o tz do dono do protocolo.
- [ ] "hoje" web+mobile usa o tz do perfil (virada-de-dia + HH:MM corretos no fuso).
- [ ] Troca de tz regenera pending futuras (F4.3f.2).
- [ ] SP idêntico (fallback). G1 fechado fora do Histórico.
- [ ] Testes core+web+mobile verdes; smoke PO expat por sub-fase; SQP/CHANGELOG/versões.
