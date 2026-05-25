# EXEC SPEC — UX Premium do Signup: "Abrir e-mail" (cliente nativo ou webmail por domínio)

> **Status:** backlog (proposta) · **Origem:** discussão pós-PR #584 (confirmação de signup +
> deeplink-first). Evolui a tela "verifique seu e-mail" de um CTA de login para um CTA que
> **leva a usuária direto ao e-mail**, maximizando a taxa de confirmação (persona dona Maria).

---

## §0 — Contexto e ponto de partida (JÁ ENTREGUE no PR #584)

- A confirmação de signup já é **deeplink-first**: `emailRedirectTo: dosiq://auth/callback` +
  handler `type=signup` → ao tocar o link no e-mail, a usuária **volta ao app já logada** no
  passo 2 do onboarding (ver `apps/mobile/src/navigation/Navigation.jsx` e
  `apps/mobile/src/platform/auth/authService.js`).
- A tela "verifique seu e-mail" vive em `apps/mobile/src/screens/SignupScreen.jsx` (estado
  `emailSent`). Hoje o CTA é **"Entre com sua conta"** → `navigation.navigate(ROUTES.LOGIN)`,
  mantido como fallback (`successButton`).
- O retorno principal agora é **via deeplink**, não login manual. Logo, o CTA mais útil passa a
  ser **"Abrir e-mail"** — levar a usuária ao inbox para que ela ache o link de confirmação.

### Deps disponíveis hoje
- `expo-web-browser` (`~14.2.0`) e `Linking` (RN core). **NÃO** temos `expo-intent-launcher`
  nem `expo-mail-composer`.

### Por que não foi feito junto do PR #584
- Abrir o app de e-mail **bem em ambas as plataformas** exige `expo-intent-launcher` (Android) →
  **dep nativa nova → rebuild EAS**. No iOS não há "abrir minha caixa" universal — só dá pra abrir
  apps específicos por scheme (`googlegmail://`, `ms-outlook://`…) declarados em
  `LSApplicationQueriesSchemes`. Apple Mail puro (`message://`) não ajuda (maioria usa Gmail).
- Decisão do PO: fazer **direito numa branch própria**, com rebuild e smoke dedicados.

---

## §1 — Objetivo

Na tela "verifique seu e-mail", o botão primário **"Abrir e-mail"** deve, na melhor ordem
possível para o endereço cadastrado:

1. Abrir o **app nativo de e-mail** do provedor (Gmail, Outlook, Yahoo… se instalado).
2. Senão, abrir o **webmail do provedor** no browser (mapa por domínio — ver §4).
3. Senão (domínio desconhecido / corporativo), abrir o **app de e-mail padrão** do device.
4. Fallback final: manter o link secundário **"Já confirmei? Entrar"** → `ROUTES.LOGIN`.

Meta de produto: reduzir o atrito entre "criei a conta" e "confirmei o e-mail" — onde mais se
perde ativação.

---

## §2 — Detecção e roteamento

```
domínio = parteApós('@', email).toLowerCase()

1. Olhar o MAPA (§4): { appScheme?, webmailUrl?, label }
2. Se appScheme e Linking.canOpenURL(appScheme) → Linking.openURL(appScheme)   // app instalado
3. Senão se webmailUrl → abrir no browser (expo-web-browser openBrowserAsync)  // webmail
4. Senão:
   - Android → expo-intent-launcher: ACTION_MAIN + category APP_EMAIL          // app padrão
   - iOS     → tentar message://; se !canOpenURL → cair no passo 5
5. Fallback → nada abre: manter usuária na tela; CTA secundário "Já confirmei? Entrar".
```

- `canOpenURL` exige declarar os schemes consultados em `LSApplicationQueriesSchemes` (iOS).
- Sempre `try/catch` + telemetria leve (`analyticsService`? mobile usa Firebase Analytics) do
  resultado (`email_open_attempt`: `app|webmail|default|fallback`) para medir conversão.

---

## §3 — Mudanças técnicas

### App config (`apps/mobile/app.config.js`)
- `ios.infoPlist.LSApplicationQueriesSchemes`: `['googlegmail','ms-outlook','ymail','message']`
  (+ o que o mapa §4 trouxer).
- Confirmar `android.intentFilters` não conflita (App Links é outro spec).

### Deps
- Adicionar **`expo-intent-launcher`** (Android open-default-mail). Requer **rebuild EAS** (dev +
  prod). Verificar compat Expo 53 / RN 0.79.

### Tela (`SignupScreen.jsx`, estado `emailSent`)
- Botão primário **"Abrir e-mail"** → handler `openEmailForAddress(email)` (§2).
- Botão/secundário texto **"Já confirmei? Entrar"** → `ROUTES.LOGIN` (mantém fallback atual).
- Loading/disabled enquanto tenta abrir; toast gentil se nada abrir
  (*"Abra o app de e-mail e toque no link que enviamos."*).

### Util novo (`apps/mobile/src/platform/email/openEmailInbox.js` — sugestão)
- `openEmailForAddress(email): Promise<'app'|'webmail'|'default'|'fallback'>` encapsula §2.
- Sem PII em logs (logar só o resultado e o provedor, nunca o e-mail completo).

---

## §4 — Mapa de webmails/apps por domínio (INPUT DO AGENTE DE PESQUISA) 🔬

> **A preencher** com o levantamento dos provedores mais usados por brasileiros (o PO está
> spawnando um agente de pesquisa em paralelo). Estrutura sugerida:

```js
// apps/mobile/src/platform/email/providerMap.js
export const EMAIL_PROVIDERS = {
  'gmail.com':    { label: 'Gmail',   appScheme: 'googlegmail://', webmailUrl: 'https://mail.google.com' },
  'outlook.com':  { label: 'Outlook', appScheme: 'ms-outlook://',  webmailUrl: 'https://outlook.live.com' },
  'hotmail.com':  { label: 'Outlook', appScheme: 'ms-outlook://',  webmailUrl: 'https://outlook.live.com' },
  'live.com':     { label: 'Outlook', appScheme: 'ms-outlook://',  webmailUrl: 'https://outlook.live.com' },
  'yahoo.com.br': { label: 'Yahoo',   appScheme: 'ymail://',       webmailUrl: 'https://mail.yahoo.com' },
  'icloud.com':   { label: 'iCloud',  appScheme: 'message://',     webmailUrl: 'https://www.icloud.com/mail' },
  // BR-específicos a confirmar com a pesquisa: uol.com.br, bol.com.br, terra.com.br,
  // ig.com.br, globo.com, r7.com, … (schemes de app podem não existir → só webmail)
}
```

**Critérios que a pesquisa deve responder por provedor:**
- Domínios cobertos (incl. variações `.com`/`.com.br`).
- Existe app dedicado com URL scheme? Qual? (validar em iOS e Android).
- URL de webmail estável (idealmente que respeite sessão mobile / não force download de app).
- Participação aproximada entre usuários BR (para priorizar os top N).

---

## §5 — Sprints

### SGN-S1 — Util + mapa + tela (sem dep nativa) — webmail/scheme only
- `providerMap.js` (top provedores da pesquisa) + `openEmailInbox.js` (passos 1-3 e 5; passo 4
  Android fica para S2).
- `SignupScreen`: CTA "Abrir e-mail" + secundário "Já confirmei? Entrar" + toast fallback.
- `LSApplicationQueriesSchemes` no app.config (iOS).
- **DoD:** domínios conhecidos abrem app (se instalado) ou webmail; desconhecido → toast +
  fallback login. Sem rebuild de dep nova (usa Linking + expo-web-browser). Smoke iOS+Android.

### SGN-S2 — App de e-mail padrão (Android) via expo-intent-launcher
- Adicionar `expo-intent-launcher`; implementar passo 4 (Android APP_EMAIL).
- **DoD:** domínio desconhecido no Android abre o app de e-mail padrão. Rebuild EAS dev + smoke.
- **Bloqueador:** rebuild nativo.

### SGN-S3 — Telemetria + ajuste fino
- Evento `email_open_attempt` (resultado + provedor, sem PII); revisar cobertura do mapa com
  dados reais; copy final.
- **DoD:** dashboard/ло consegue ver taxa app/webmail/default/fallback.

> Ordem: SGN-S1 (entrega valor sem rebuild) → SGN-S2 (rebuild) → SGN-S3 (medição).

---

## §6 — Sub-agentes sugeridos (model-agnostic)

| Tier | Papel | Claude | Gemini | Uso |
|------|-------|--------|--------|-----|
| **A — Arquiteto** | Roteamento §2, decisão canOpenURL/fallbacks, revisão | Opus | 3.1 high | Desenhar `openEmailInbox`, revisar PRs |
| **B — Implementador** | Util, tela, app.config, intent-launcher | Sonnet | 3.1 low | SGN-S1/S2 |
| **C — Mecânico** | providerMap a partir da pesquisa, schemes, telemetria | Haiku | flash | Preencher mapa, eventos |

- Brief R-230 (6 itens). Sub-agente **nunca** commita na main (R-060); não adiciona dep nem faz
  rebuild sem OK do PO; nunca loga e-mail completo (PII).

---

## §7 — Riscos & decisões em aberto
1. **iOS sem "abrir inbox" universal** — só apps por scheme; Apple Mail (`message://`) é fraco.
   Aceitar que iOS depende do mapa/schemes.
2. **Webmail no mobile** pode não respeitar sessão / forçar app → medir e, se ruim, preferir o
   app scheme.
3. **expo-intent-launcher** = rebuild; agendar com o PO.
4. **Domínios corporativos/desconhecidos** → sempre cair no app padrão (Android) ou fallback.
5. **PII**: nunca logar/transmitir o e-mail completo nos eventos.
6. **Manutenção do mapa**: schemes de apps mudam; tratar `canOpenURL=false` graciosamente.

## §8 — Critérios de encerramento
- [ ] "Abrir e-mail" leva a usuária ao app/webmail do provedor para os top domínios BR.
- [ ] Desconhecido → app padrão (Android) ou fallback login, sem dead-end.
- [ ] Fallback "Já confirmei? Entrar" sempre presente.
- [ ] Telemetria de conversão do "Abrir e-mail" disponível.
- [ ] Sem PII em logs.

## §9 — Cross-references
- PR #584 (deeplink-first + tela emailSent atual).
- `EXEC_SPEC_DEEPLINK_UNIVERSAL_LINKS_WEB_BANNER.md` (Universal Links — relacionado, separado).
- `apps/mobile/src/screens/SignupScreen.jsx` (estado `emailSent`, `successButton`).
- R-224 (deep link auth handlers), R-230 (brief cavecrew), R-060 (no auto-merge).

## Changelog
- 2026-05-25 — Criação. Deriva da discussão pós-PR #584. Aguarda o mapa de webmails BR do agente
  de pesquisa (§4) para preencher `providerMap`.
