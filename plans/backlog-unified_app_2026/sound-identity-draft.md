# Sound Identity — Draft

> **Status**: Draft / parking lot
> **Criado**: 2026-05-15 (durante Sprint P.3, validação de haptics no Form Kit)
> **Retomar em**: Pós-Fase 3 do projeto Evolução CRUD Native
> **Owner**: PO (coelhotv)

---

## Contexto e motivação

Durante validação do wrapper `haptics.js` (Sprint P.3 da Fase 0 CRUD Native), o PO observou que o Dosiq hoje não possui identidade sonora — sem sons de feedback de ações no app nem em notificações push.

Apps de mercado (fintech como Nubank, social como WhatsApp/Slack, healthcare como Glo, MyFitnessPal) reforçam branding e melhoram UX com áudio cuidadosamente desenhado:
- Sons de notificação distintos elevam taxa de "abrir o push" (priorização entre apps competindo por atenção)
- Stings de conquista (streak, meta diária) reforçam adesão a longo prazo
- Sonic logo no splash cria associação de marca

Healthcare adherence é contexto **sensível**: usuário toma dose à noite, ambiente clínico, parceiro/filho dormindo. Som intrusivo = uninstall. Mas distinguibilidade da notificação **muda** o jogo: o usuário sabe imediatamente "é dose, não é WhatsApp".

---

## Categorias avaliadas (custo × impacto × risco)

| Tipo | Custo | Impacto | Risco | Prioridade |
|------|-------|---------|-------|------------|
| **Som de notificação** (dose due, dose taken) | Baixo — 1 arquivo `.caf` iOS + channel Android | **Alto** — distinguibilidade entre apps | Baixo — já opt-out via system settings | ⭐⭐⭐ |
| **Stings de conquista** (streak hit, dose 100%) | Baixo — 1-2 stings curtos | Alto engagement | Baixo se opt-in | ⭐⭐⭐ |
| **In-app micro-feedback** (botões, toast, swipe) | Médio — 4-6 sons curtos polidos | Médio UX premium | **Alto** se não polido vira chatice | ⭐⭐ (A/B test obrigatório) |
| **Sonic logo / splash** | Alto — designer dedicado + licença | Médio brand | Baixo | ⭐ (última prioridade) |

---

## Timing recomendado

### Por que NÃO agora (Fase 0/1/2/3)
- Fase 0-3 entrega **load-bearing**: CRUD foundation, hooks, telas. Som é polish layer.
- Sem CRUD completo, áudio puxa atenção para detail estético antes de função principal estar sólida.

### Ordem natural
1. **Pós-Fase 3 (CRUD completo, ~sem 12+)** — som de **notificação** custom (maior ROI absoluto)
2. **Pré-v1.0 (App Store launch)** — stings de **conquista** (streak hit, dose 100% no dia). Opt-in via Settings.
3. **Pós-PMF + métricas de adesão estabilizadas** — in-app micro-feedback. **Só** se A/B test mostrar uplift em adesão. Senão deletar — não é decorativo.
4. **Sonic logo / brand identity** — última prioridade. Faz sentido só com brand designer dedicado.

---

## Sprint dedicada (rascunho)

**Nome**: `Sprint S0 — Sound Identity`
**Duração estimada**: 1 sprint semanal
**Pré-requisito**: Fase 3 CRUD completa + métricas de notificação baseline coletadas

### Tasks

| # | Task | Complexidade | Notas |
|---|------|--------------|-------|
| S0.1 | Selecionar/contratar som de notificação | ⭐ | Designer freelance (~$50-200) ou licença stock (~$30) |
| S0.2 | Bundlar `.caf` iOS + configurar notification channel Android com `setSound()` | ⭐⭐ | `expo-notifications.scheduleNotificationAsync({ sound: 'dose.caf' })`. Channel Android setado uma vez no boot. |
| S0.3 | Toggle `notification_sound_enabled` em Settings + persistência | ⭐⭐ | Pode ir no schema `users` ou local config. Já tem padrão de toggles (`expo-notifications` permissions). |
| S0.4 | Telemetria de adoção (Firebase Analytics event `notification_sound_*`) | ⭐ | Mede quantos opt-out, importante para evidência |
| S0.5 | (Opcional) Sting de conquista para streak | ⭐⭐ | `expo-av` ou `expo-audio` para tocar in-app |
| S0.6 | Docs em `docs/reference/` | ⭐ | Arquivo + URLs/licença + onde editar |

---

## Constraints técnicas (registrar agora para não esquecer)

### Plataformas
- **iOS**: `expo-notifications` aceita `sound: '<filename>.caf'` apontando para arquivo bundled em `assets/sounds/`. Formato `.caf` (Core Audio Format) é o nativo iOS. Conversão de `.wav` → `.caf` via `afconvert -f caff -d ima4 input.wav output.caf`. Limite: < 30 segundos. < 100KB recomendado.
- **Android**: `notification_channel` configurado em `expo-notifications` aceita `sound` URI. Cada channel = um som. Pode usar `.mp3` ou `.ogg`. Importância: criar channels via `Notifications.setNotificationChannelAsync` no boot do app. Idealmente em `usePushNotifications.js` (já existe).
- **Web (futuro)**: HTML5 Audio API. Não bloqueante para v1 — web hoje é PWA companion.

### Acessibilidade
- Som **NÃO** substitui anúncio VoiceOver/TalkBack. Notificação textual continua obrigatória.
- Toggle deve ser separado de "notification permissions" geral — usuário pode querer notificação muda (já controla pelo sistema, mas duplicar in-app é UX-friendly).

### Healthcare/regulação
- Dosiq não é dispositivo médico classificado pela ANVISA. Sem requisitos específicos sobre alarme sonoro.
- Boa prática: som NÃO deve simular alarme clínico ICU (evita confundir com equipamento médico real em hospital).

### Performance / bundle
- Sons curtos (`.caf` < 100KB cada) somam pouco ao bundle. Total final estimado para v1: < 500KB.
- Lazy-load se forem muitos (10+) ou se algum > 500KB. Para sprint S0 inicial (1-3 arquivos): bundle direto.

---

## Decisões a serem tomadas (quando retomar)

1. **Designer ou stock?**
   - Stock (AudioJungle, Pond5): rápido (~$30), risco de overlap com outros apps
   - Designer (Bruno Toledo de Brito ou similar): caro ($200-1000), exclusivo, premium
   - **Recomendação inicial**: stock para validar adoção; designer dedicado se métricas justificarem
2. **Tom de marca**: minimalista (single chime), orgânico (bell suave), digital (UI ping)? Pesquisar concorrentes: MyTherapy, Medisafe, Round Health
3. **Som único ou por contexto?** Dose due ≠ dose perdida ≠ stock baixo? Começar com 1, expandir se útil
4. **Opt-in ou opt-out?**: Opt-out (som ligado por default) maximiza adoção mas pode irritar primeiros usuários — recomendo **opt-in com banner sutil pós-onboarding** ("Adicione um som distinto para seus lembretes?")

---

## Métricas a coletar pré-decisão (sprint S0)

- Taxa atual de "abrir push" (eventos `push_opened` vs `push_received`)
- Quanto tempo em média entre push enviado e dose registrada (timing real)
- Taxa de notificações silenciadas no nível do system (proxy via permissions API)

Sem essas métricas, S0 vira "achismo de produto". Coletar **antes** de S0 começar.

---

## Inspirações para referência futura

- **Headspace**: chime de respiração — orgânico, calmante, totalmente diferente de notificação geral
- **Nubank**: ping sutil de transação — distinto e curto
- **Glo (yoga)**: bell ao final de sessão — sting de conquista
- **MyFitnessPal**: silêncio total em alguns flows, push padrão iOS — não diferenciado (anti-exemplo)
- **Apple Watch (Activity rings)**: som curto + haptic ao fechar anel — modelo perfeito de combinação áudio + tátil

Dosiq tem haptics implementado (Sprint P.3); par natural sons + haptic seguindo modelo Apple Watch é boa direção.

---

## Quando retomar este doc

- ✅ Fase 3 CRUD Native completa (Estoque mergeado em main)
- ✅ Métricas baseline de notificação coletadas (mínimo 4 semanas pós-Fase 3)
- ✅ App Store launch v1.0 NÃO bloqueado por isso

Mover para `plans/` ativo e criar `EXEC_SPEC_SOUND_IDENTITY.md` quando os 3 acima estiverem prontos.
