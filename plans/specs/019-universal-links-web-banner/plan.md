# Implementation Plan: Universal Links / App Links & Web Smart Banner

**Feature Directory**: `plans/specs/019-universal-links-web-banner`  
**Spec**: `spec.md`  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/EXEC_SPEC_DEEPLINK_UNIVERSAL_LINKS_WEB_BANNER.md`

---

## Summary

Este plano de implementação consolida as entregas realizadas do **Plano 1** (infraestrutura de associação de domínio estática para Universal Links e App Links) e detalha o roteamento de fallback de autenticação `/auth/callback` na Web, a injeção da meta tag do Smart App Banner do iOS Safari e o componente reativo acessível `MobileAppBanner` no web app mobile do Dosiq.

---

## Technical Context

- **Estado Atual da Infra (Plano 1 ✅)**: Os arquivos estáticos canônicos estão criados na Web e acessíveis publicamente:
  - Apple Team ID: `LU8V56S7QF` (associado a `com.coelhotv.dosiq`) em [apple-app-site-association](file:///Users/coelhotv/git/dosiq/apps/web/public/.well-known/apple-app-site-association).
  - Android fingerprints: EAS production e Play Store signing configurados em [assetlinks.json](file:///Users/coelhotv/git/dosiq/apps/web/public/.well-known/assetlinks.json).
- **Roteamento Mobile**: O handler de deeplinks no React Native (`apps/mobile/src/navigation/Navigation.jsx`) já é scheme-agnóstico e trata links PKCE (`?code=`) e implicit grant de forma nativa.
- **Roteamento Web**: O web app (`apps/web`) opera em React 19 + Vite 7 hospedado na Vercel (Hobby budget, limite de 12 funções serverless). A rota `/auth/callback` deve ser implementada no lado do cliente (SPA) para evitar consumo de funções serverless.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **R-020 (Timezone)** | ✅ Pass | O roteamento e redirecionamento de links não alteram lógica de datas. |
| **R-060 (No Self-Merge)** | ✅ Pass | Planejado e estruturado; a implementação real será submetida a PR e aprovada manualmente. |
| **R-090 (Serverless Limit)** | ✅ Pass | Rota `/auth/callback` implementada estritamente no client-side para respeitar a cota Hobby de 12 funções. |
| **R-117 (Mobile Performance)** | ✅ Pass | Componente `MobileAppBanner` importado dinamicamente via `React.lazy` no layout raiz do PWA. |

---

## Architecture / Approach

### 1. Rota de Fallback Client-side (`/auth/callback`)
Criar uma página e rota `/auth/callback` no roteador do PWA web:
- Lê parâmetros de busca (`URLSearchParams` para `code` e hash hash fragments para `access_token`).
- Se houver `code`, executa `supabase.auth.exchangeCodeForSession(code)`.
- Se houver `access_token` e `refresh_token` no hash, executa `supabase.auth.setSession({ access_token, refresh_token })`.
- Após o login com sucesso:
  - Redireciona o usuário para o dashboard do web app (`/dashboard`) ou para o fluxo de onboarding se aplicável.
  - Se for um fluxo de redefinição de senha (`type=recovery`), redireciona para a página `/reset-password` do web app.
- Se houver erro ou expiração do link, renderiza um card com mensagem explicativa amigável em português: *"Ops! Este link de confirmação já expirou ou foi utilizado. Por favor, tente solicitar um novo e-mail a partir do aplicativo."*

### 2. Smart App Banner do iOS Safari (Plano 2.A)
Injetar a meta tag nativa no `<head>` do `apps/web/index.html`:
```html
<meta name="apple-itunes-app" content="app-id=<APP_STORE_ID>, app-argument=https://dosiq.app/">
```
*Nota: O `<APP_STORE_ID>` numérico será preenchido através do processo de placeholders `UL-S1` pelo PO assim que o app for publicado na Apple Store.*

### 3. Componente `MobileAppBanner` Customizado Cross-Platform (Plano 2.B)
- **Hook `useIsMobileWeb.js`**:
  - Verifica se o dispositivo é mobile baseado no User Agent (`/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)`).
  - Verifica se está rodando fora do modo standalone:
    - `window.matchMedia('(display-mode: standalone)').matches === false`
    - `navigator.standalone !== true` (específico iOS).
  - Lê e valida se a chave `dosiq:app-banner-dismissed` no `localStorage` está ausente ou se o timestamp expirou (TTL de 30 dias).
- **Componente `MobileAppBanner.jsx`**:
  - Renderiza um banner flutuante ou fixado no topo com visual premium e micro-animações do Framer Motion.
  - Textos em português de alta conversão: *"Facilite seu tratamento. Use o aplicativo nativo para receber alarmes persistentes e monitorar doses offline."*
  - CTA "Baixar no App": Redireciona para o Universal Link `https://dosiq.app/` que abre o app se instalado ou encaminha o navegador mobile para a loja oficial (Play Store no Android e App Store no iOS).
  - Botão de fechamento "X": Salva o timestamp atual + 30 dias em milissegundos no localStorage sob a chave `dosiq:app-banner-dismissed`, desmontando o componente com transição suave.
  - Acessibilidade: Contém `role="banner"`, `aria-label="Recomendação de aplicativo nativo"`, botão de fechamento com `aria-label="Dispensar recomendação"` e tags HTML semânticas.

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/web/index.html` | Injeção da meta tag nativa do Smart App Banner do iOS | Requisito 2.A do spec legado |
| `apps/web/src/shared/hooks/useIsMobileWeb.js` [NEW] | Hook utilitário para detectar navegador mobile fora do PWA | Requisito 2.B do spec legado |
| `apps/web/src/shared/components/MobileAppBanner.jsx` [NEW] | Componente de banner premium do aplicativo móvel | Requisito 2.B do spec legado |
| `apps/web/src/routes/auth/callback.jsx` [NEW] | Rota client-side do PWA para processar deep links de auth | Requisito 1.D do spec legado |

---

## Contracts and ADRs

- **ADR-048 (dose_instances)**: Assegurar que qualquer fluxo de auth que redirecione para `/dashboard` verifique a timezone local gravada e a presença de instâncias carregadas.
- **R-221 (SQP)**: Todo commit deste componente mobile/web deve classificar o impacto como **Low-to-Medium**, realizar bump de versão no `package.json` de `apps/web` e registrar a liberação no `CHANGELOG.md` do monorepo.

---

## Risks

- **Caching do Service Worker**: O Service Worker do Workbox PWA pode fazer o cache agressivo do `index.html` ou de arquivos sob `/.well-known/`.
  - *Mitigação*: Atualizar as configurações de exclusão no script do Workbox (`apps/web/vite.config.js`) para garantir que URLs contendo `/.well-known/` ou `apple-app-site-association` nunca passem pelo Service Worker.
- **Divergência de User Agent**: Alguns navegadores modernos ocultam ou simplificam o User Agent.
  - *Mitigação*: Combinar o teste de regex clássico com a checagem moderna `navigator.userAgentData?.mobile` como fallback defensivo.

---

## Quality Gates

- `rtk lint` deve rodar com zero erros ou avisos na pasta `apps/web`.
- A rota `/auth/callback` e o component `MobileAppBanner` devem ser validados no Lighthouse, atestando notas superiores a 95% em Performance e Acessibilidade (a11y).
- Execução do comando unificado de qualidade: `npm run validate:agent`.

---

## Migration Notes

- Na consolidação do Plano 1, as referências de associated domains do Expo no `app.config.js` do `apps/mobile` devem ser formalmente verificadas contra o código ativo para garantir que não haja regressão no entitlement de domínio associado (`applinks:dosiq.app`).
- Placeholders para o App Store ID serão formalmente listados no bloco de entrega final para intervenção manual do PO em conformidade com o protocolo `UL-S1`.
