# EXEC SPEC — Universal Links / App Links + Banner "abra no app" (web mobile)

> **Status:** backlog (proposta) · **Origem:** Fase 4 (pós-merge PR #583), discussão de UX do
> link de confirmação de e-mail · **Pré-req parcial já entregue** — ver §0.3.
>
> Cobre **dois planos relacionados**, ambos ancorados no mesmo deeplink:
> - **Plano 1 — Universal Links (iOS) / App Links (Android):** `https://dosiq.app/...` abre o app
>   se instalado, senão fica no web (fallback real). Substitui o scheme cru `dosiq://`.
> - **Plano 2 — Banner no web mobile:** quando o usuário acessa o web app pelo celular, mostrar
>   banner recomendando o app nativo.

---

## §0 — Contexto e ponto de partida (NÃO refazer)

### 0.1 Stack & hospedagem
- Monorepo npm workspaces + Turborepo. `apps/mobile` (Expo 53 / RN 0.79, EAS) e `apps/web`
  (React 19 + Vite 7, **Vercel Hobby**, PWA Workbox).
- Domínio do web app: **`dosiq.app`** (servido pela Vercel). Confirmar no painel Vercel que o
  domínio aponta para o projeto `apps/web` antes de hospedar os arquivos `.well-known/*`.
- Mobile identifiers (de `apps/mobile/app.config.js`):
  - iOS bundle / Android package: **`com.coelhotv.dosiq`**
  - URL scheme canônico: **`dosiq`** → deeplink `dosiq://auth/callback`
- Cliente Supabase nativo: `apps/mobile/src/platform/supabase/nativeSupabaseClient.js`.
  Projeto Supabase id: `kwqjtdsqkkbebfiaxubb`.

### 0.2 Como o deeplink já é tratado hoje
- `apps/mobile/src/navigation/Navigation.jsx` → `handleDeepLink({ url })` (dentro do `useEffect`
  com `Linking.getInitialURL()` + `Linking.addEventListener('url', ...)`).
  - Trata **PKCE** (`?code=` → `exchangeCodeForSession`) e **implicit**
    (`#access_token=...&type=recovery|signup` → `setSession`).
  - O parser é **scheme-agnóstico** (faz `url.split('?')` / `url.split('#')`), então aceita tanto
    `dosiq://auth/callback...` quanto `https://dosiq.app/auth/callback...` **sem alteração de
    código** — apenas validar.
- Auth → URL Configuration → **Redirect URLs** no Supabase **já tem** `dosiq://auth/callback`
  liberado (desde a feature de troca de senha). Para o Plano 1 será necessário **adicionar**
  `https://dosiq.app/auth/callback`.

### 0.3 Pré-requisito JÁ ENTREGUE (branch `feat/signup-email-confirm-copy`)
- `signUpWithEmail` (`apps/mobile/src/platform/auth/authService.js`) agora envia
  `options.emailRedirectTo: 'dosiq://auth/callback'` → link de confirmação reabre o app.
- `handleDeepLink` estendido para `type === 'signup'` (além de `recovery`): `setSession` →
  dispara `SIGNED_IN` → app abre logado, cai no gate de onboarding.
- Copy da tela "verifique seu e-mail" reescrita (persona dona Maria) + fix do botão full-width.
- **Limitação que motiva este spec:** scheme `dosiq://` cru **não tem fallback web** — se o app
  não estiver instalado (ex.: usuário abriu o e-mail no desktop), o browser dá erro ao tentar
  abrir `dosiq://`. Universal/App Links resolvem isso.

### 0.4 — 🔒 Segurança: público vs. secreto + protocolo de placeholders (LER ANTES DE CODAR)

**Team ID (Apple) e SHA-256 fingerprint (Android) são PÚBLICOS por design** — AASA e
assetlinks são servidos abertamente em `https://dosiq.app/.well-known/` (Apple/Google buscam sem
auth). Não são segredo. Mas, por **decisão de processo do PO**, o agente **NÃO** escreve os
valores reais:

> **PROTOCOLO OBRIGATÓRIO (UL-S1):**
> 1. O agente cria os arquivos com **placeholders literais**: `<APPLE_TEAM_ID>` e
>    `<SHA256_FINGERPRINT>` (e `<APP_STORE_ID>` no Plano 2.A).
> 2. O agente **NÃO** inventa, adivinha, busca, nem preenche esses valores.
> 3. O agente entrega, no fim da task, um bloco **"PO FILL-IN"** listando, por arquivo:
>    caminho exato + linha/chave + onde colar o valor + como obter o valor.
> 4. O **PO** substitui os placeholders e só então faz commit/push.

**O que É segredo — nunca no repo, nunca no prompt do agente, PARE se aparecer:**
keystore Android (`.jks`) e senhas, chave `.p8`/cert de signing iOS, App Store Connect API key,
Supabase `service_role` key, qualquer env var de credencial. O fingerprint é a parte **pública**
do keystore — a chave privada permanece só no EAS. Se algum dado parecer secreto, o agente
**interrompe** e reporta ao PO em vez de escrever em arquivo versionado.

**Onde o PO obtém:** Team ID → Apple Developer (Membership). SHA-256 → `eas credentials`
(Android → keystore; incluir também o fingerprint do Google Play App Signing se ativo).
App Store ID → App Store Connect (após publicação).

---

## §1 — PLANO 1: Universal Links (iOS) / App Links (Android)

### Objetivo
`emailRedirectTo` (e qualquer link compartilhado) passa a ser `https://dosiq.app/auth/callback`.
Com o app instalado, o SO abre o app direto (sem browser). Sem o app, o browser carrega a rota
web `/auth/callback`, que completa o auth (fallback gracioso). Manter `dosiq://` no allow-list
durante a transição.

### 1.A — iOS Universal Links
1. **AASA file** hospedado em `https://dosiq.app/.well-known/apple-app-site-association`:
   - JSON puro, **sem extensão** no nome, servido com `Content-Type: application/json`, via HTTPS,
     **sem redirect** (200 direto). Na Vercel, colocar em `apps/web/public/.well-known/` e, se
     necessário, forçar o content-type via `apps/web/vercel.json` headers.
   - Conteúdo:
     ```json
     {
       "applinks": {
         "details": [
           { "appID": "<APPLE_TEAM_ID>.com.coelhotv.dosiq", "paths": ["/auth/*"] }
         ]
       }
     }
     ```
   - `<APPLE_TEAM_ID>` = Team ID da conta Apple Developer (10 chars). **Bloqueador — PO fornece.**
2. **`app.config.js`**: adicionar `ios.associatedDomains: ['applinks:dosiq.app']`. O EAS gera o
   entitlement `com.apple.developer.associated-domains` no build de produção.
3. Validar com a ferramenta da Apple (`https://app-site-association.cdn-apple.com/a/v1/dosiq.app`)
   após deploy.

### 1.B — Android App Links
1. **assetlinks.json** em `https://dosiq.app/.well-known/assetlinks.json`
   (`apps/web/public/.well-known/assetlinks.json`):
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.coelhotv.dosiq",
       "sha256_cert_fingerprints": ["<SHA256_FINGERPRINT>"]
     }
   }]
   ```
   - `<SHA256_FINGERPRINT>` = fingerprint do keystore de **produção** do EAS. Obter com
     `eas credentials` (Android → keystore). **Bloqueador — exige acesso EAS.**
     ⚠️ Se houver build via Google Play App Signing, incluir TAMBÉM o fingerprint do Google.
2. **`app.config.js`**: `android.intentFilters`:
   ```js
   android: {
     intentFilters: [{
       action: 'VIEW',
       autoVerify: true,
       data: [{ scheme: 'https', host: 'dosiq.app', pathPrefix: '/auth' }],
       category: ['BROWSABLE', 'DEFAULT'],
     }],
   }
   ```
3. Validar com `adb shell pm get-app-links com.coelhotv.dosiq` (deve mostrar `verified`).

### 1.C — App (mobile)
- `handleDeepLink` já aceita `https://dosiq.app/auth/callback` (parser agnóstico). **Apenas
  testar**; nenhuma mudança de código esperada. Se algum ajuste de parsing surgir, documentar.

### 1.D — Web (`apps/web`) — rota de fallback `/auth/callback`
- Criar rota/handler `/auth/callback` que:
  - Lê `?code=` (PKCE) ou `#access_token/refresh_token` (implicit) da URL.
  - Completa o auth via `supabase.auth.exchangeCodeForSession` / `setSession`.
  - `type=recovery` → leva à tela de redefinir senha (web). `type=signup` → loga e leva ao app
    web (dashboard/onboarding web, conforme exista).
  - Sem app instalado (desktop), este é o destino real — **não** pode cair na home muda.
- Verificar o roteador atual do `apps/web` (Vite + provável React Router ou views lazy R-117) e
  registrar a rota seguindo o padrão existente. NÃO inventar router novo.

### 1.E — Supabase config (PO/manual)
- Adicionar `https://dosiq.app/auth/callback` em Auth → URL Configuration → Redirect URLs.
- Trocar `emailRedirectTo` do mobile (`authService.signUpWithEmail`) para
  `https://dosiq.app/auth/callback` **somente após** AASA/assetlinks validados em produção
  (senão o usuário cai no web mesmo com app instalado). Manter `dosiq://auth/callback` liberado
  como rede de segurança até a verificação passar.

### Bloqueadores do Plano 1 (resolver ANTES de codar)
1. Apple Team ID. 2. SHA-256 fingerprint EAS (+ Google Play signing se aplicável).
3. Confirmar DNS `dosiq.app` → Vercel `apps/web`. 4. Saber se existe fluxo de auth web para
   `/auth/callback` reusar.

---

## §2 — PLANO 2: Banner "abra no app" (web mobile)

### Objetivo
No `apps/web`, quando acessado por navegador mobile e **fora** do PWA instalado, exibir banner
dispensável recomendando o app nativo, com CTA que abre o app (via Universal Link do Plano 1) ou
cai nas lojas.

### 2.A — Técnica nativa iOS Safari (opcional, complementar)
- Meta tag no `<head>` de `apps/web/index.html`:
  ```html
  <meta name="apple-itunes-app" content="app-id=<APP_STORE_ID>, app-argument=https://dosiq.app/">
  ```
- Zero JS; Apple renderiza Smart App Banner nativo. **Só** iOS Safari e **exige app publicado na
  App Store** (`<APP_STORE_ID>` numérico). **Bloqueador:** app publicado + App Store ID.

### 2.B — Banner custom cross-platform (principal)
- Componente `apps/web/src/shared/components/MobileAppBanner.jsx` + hook
  `apps/web/src/shared/hooks/useIsMobileWeb.js`.
- Renderiza no topo do layout raiz **somente quando**:
  - UA é mobile (`useIsMobileWeb`: regex UA + `navigator.userAgentData?.mobile` quando disponível);
  - **não** está rodando como PWA standalone
    (`window.matchMedia('(display-mode: standalone)').matches === false` e
    `navigator.standalone !== true`);
  - não foi dispensado antes (`localStorage['dosiq:app-banner-dismissed']`).
- Conteúdo: ícone + "Use o Dosiq pelo app — mais rápido e com lembretes" + botão **Abrir app**
  (link `https://dosiq.app/...` → abre app se instalado, senão store) + **X** dispensar (persiste
  no localStorage com TTL, ex.: re-mostrar após 30 dias).
- Acessibilidade (R-???): `accessibilityRole`/aria-label no botão e no X.
- Respeitar `prefers-reduced-motion` em qualquer animação de entrada.
- Não usar PII; sem analytics obrigatório (opcional: `analyticsService.track('app_banner_shown')`).

### 2.C — Detalhes de plataforma
- iOS: link universal abre app; sem app → App Store. Android: App Link abre app; sem app →
  Play Store. Desktop: banner **não** aparece (UA não-mobile).
- Coexistência com o prompt de instalação PWA existente (se houver `beforeinstallprompt`): não
  duplicar CTAs concorrentes na mesma viewport — decidir prioridade (sugestão: banner "abrir app
  nativo" > prompt PWA, pois o nativo é o produto preferido).

### Dependência
- O CTA "Abrir app" do banner depende do **Plano 1** (Universal Link) para abrir o app de forma
  confiável. Sem o Plano 1, o botão só consegue mandar para as lojas.

---

## §3 — Sprint Breakdown

> Sprints pequenos e verificáveis. Cada um termina em estado smoke-testável. Seguir DEVFLOW
> (C1–C5) e R-234 (smoke do PO antes do PR). Auth/links são sensíveis → não auto-aplicar config
> remota; PO valida em produção.

### UL-S1 — Hospedagem `.well-known` + config de app (Plano 1, parte estática)
- Criar `apps/web/public/.well-known/apple-app-site-association` (AASA) e `assetlinks.json`.
- Ajustar `apps/web/vercel.json` (headers/content-type, sem redirect em `.well-known/*`).
- `app.config.js`: `ios.associatedDomains` + `android.intentFilters` (autoVerify).
- ⚠️ **Placeholders, não valores reais** (ver §0.4): AASA/assetlinks/meta tag saem com
  `<APPLE_TEAM_ID>`, `<SHA256_FINGERPRINT>`, `<APP_STORE_ID>`. O agente entrega o bloco
  **"PO FILL-IN"** (arquivo + chave + como obter) e **não** commita; o **PO** preenche e commita.
- **DoD:** arquivos criados com placeholders + bloco PO FILL-IN entregue; após PO preencher,
  arquivos acessíveis em produção com content-type correto e validadores Apple/Android passam
  (precisa de build de produção + deploy web). Sem regressão no build EAS.
- **Bloqueadores:** Team ID, fingerprint EAS (preenchidos pelo PO).

### UL-S2 — Rota web `/auth/callback` (fallback) + corte do emailRedirectTo
- Implementar rota `/auth/callback` no `apps/web` (PKCE + implicit; recovery + signup).
- Trocar `emailRedirectTo` do mobile para `https://dosiq.app/auth/callback`.
- Adicionar URL no allow-list do Supabase (PO).
- **DoD:** (a) e-mail confirmado no **mesmo device com app** → abre app logado; (b) confirmado no
  **desktop sem app** → web `/auth/callback` completa e leva ao destino certo; (c) recovery segue
  funcionando. Smoke em build nativo + desktop.

### BAN-S1 — Banner custom cross-platform (Plano 2.B)
- `useIsMobileWeb` + `MobileAppBanner` + mount no layout raiz do `apps/web`.
- Regras de exibição (mobile && !standalone && !dismissed) + persistência + dispensar.
- **DoD:** aparece em browser mobile, some em PWA instalado e no desktop, dispensa persiste; CTA
  abre app (via UL) ou store. `npm run lint` + `validate:agent` (web) verdes.

### BAN-S2 — Smart App Banner iOS Safari (Plano 2.A) — opcional, pós App Store
- Meta `apple-itunes-app` no `index.html`.
- **DoD:** banner nativo aparece no iOS Safari (com app publicado). **Bloqueado por** publicação
  na App Store + App Store ID.

> **Ordem recomendada:** UL-S1 → UL-S2 → BAN-S1 → (BAN-S2 quando houver App Store ID).
> BAN-S1 pode começar em paralelo a UL-S2 com o CTA caindo nas stores até o UL ficar pronto.

---

## §4 — Sub-agentes sugeridos (model-agnostic)

> Os tiers descrevem **capacidade necessária**, não um provedor. Mapear conforme o executor.

| Tier | Papel | Claude | Gemini | Quando usar |
|------|-------|--------|--------|-------------|
| **A — Arquiteto/Revisor** | Decisões de auth/links, revisão de risco, validação de DoD sensível | Opus | 3.1 high | Desenhar UL-S2 (fallback web + corte do redirect), revisar PRs, resolver ambiguidade de fingerprint/Team ID |
| **B — Implementador** | Escrever rota web, componente banner, hook, config de app | Sonnet | 3.1 low | Maior parte de UL-S2, BAN-S1; edições multi-arquivo com lógica |
| **C — Mecânico** | Arquivos estáticos, meta tags, config declarativa, ajustes pontuais | Haiku | flash | UL-S1 (AASA/assetlinks/vercel.json/app.config intentFilters), BAN-S2 (meta tag) |

### Spawns sugeridos por sprint (brief R-230: 6 itens obrigatórios)
- **UL-S1** → Tier C (cavecrew/builder). Brief deve fixar: caminhos exatos dos `.well-known/*`,
  package/bundle id, **protocolo de placeholders §0.4** (`<APPLE_TEAM_ID>`/`<SHA256_FINGERPRINT>`
  NÃO preencher, NÃO inventar; entregar bloco **PO FILL-IN** e não commitar — PO substitui),
  regra "sem redirect/extensão no AASA", lint round-trip. Reforçar: "se aparecer dado secreto
  (chave/senha/API key), PARE e reporte — não escreva em arquivo versionado".
- **UL-S2** → Tier B implementa, **Tier A revisa** (auth sensível). Brief: reusar o handler/parse
  agnóstico, padrão de router do `apps/web`, matriz de teste (3 cenários do DoD), não trocar o
  `emailRedirectTo` antes de validar UL em prod.
- **BAN-S1** → Tier B. Brief: regras de exibição exatas, chaves de localStorage, a11y, coexistência
  com prompt PWA, sem PII.
- **BAN-S2** → Tier C. Brief: só a meta tag, condicional ao App Store ID existir.

> **Regra de processo (vale para qualquer provedor):** sub-agente **nunca** commita direto na main;
> sempre branch + PR + aprovação humana (R-060). Sub-agente não auto-aplica migration nem config
> remota (Supabase/Vercel/EAS) — entrega o passo manual documentado para o PO.

---

## §5 — Quality Gates
- Mobile: `npm test --workspace @dosiq/mobile` (Jest) verde; build EAS de produção sem erro de
  entitlement/intent filter.
- Web: `rtk lint` + `rtk npm run validate:agent` verdes; build Vercel ok; `.well-known/*` 200 com
  content-type correto.
- Validação de links: validador Apple (AASA CDN) + `adb shell pm get-app-links` = verified.
- Smoke matrix UL-S2 (3 cenários do DoD) + banner (mobile/standalone/desktop/dismiss).

## §6 — Riscos & Bloqueadores (consolidado)
1. **Apple Team ID** (AASA) — PO/Apple Developer.
2. **SHA-256 fingerprint EAS** (assetlinks) + Google Play signing — acesso EAS.
3. **DNS `dosiq.app` → Vercel `apps/web`** confirmado.
4. **Fluxo de auth web** para reusar em `/auth/callback` (pode não existir → criar do zero, custo
   maior).
5. **App Store ID** + app publicado (só BAN-S2).
6. **PWA Workbox** pode cachear `.well-known/*` ou `index.html` — garantir que o SW não intercepta
   os arquivos de associação (excluir do precache/runtime caching).
7. **Vercel Hobby**: arquivos estáticos não contam no limite de 12 funções (R-090) — ok; a rota
   `/auth/callback` deve ser client-side (SPA), não serverless, se possível.

## §7 — Critérios de encerramento
- [ ] Confirmação de e-mail no mobile com app instalado abre o app **logado** via `https://`.
- [ ] Confirmação no desktop sem app completa no web `/auth/callback` (fallback).
- [ ] Recovery continua funcionando (não regrediu).
- [ ] Banner aparece só em web mobile fora do PWA, dispensável e persistente.
- [ ] AASA + assetlinks verificados em produção.

## §8 — Cross-References
- `EXEC_SPEC_FASE4_PERFIL.md` (origem: signup/onboarding/recovery).
- `apps/mobile/src/navigation/Navigation.jsx` (handler de deeplink).
- `apps/mobile/src/platform/auth/authService.js` (`signUpWithEmail` + `emailRedirectTo`).
- `apps/mobile/app.config.js` (scheme `dosiq`, bundle `com.coelhotv.dosiq`).
- `.agent/memory` — R-224 (deep link auth handlers async + PKCE/implicit), R-090 (Vercel Hobby
  budget), R-230 (brief cavecrew), R-060 (no auto-merge).

## Changelog
- 2026-05-25 — Criação. Deriva da discussão pós-PR #583 (UX do link de confirmação). Pré-req
  (signup deeplink scheme + handler type=signup + copy) entregue na branch
  `feat/signup-email-confirm-copy`.
