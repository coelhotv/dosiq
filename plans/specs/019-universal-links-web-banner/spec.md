# Feature Specification: Universal Links / App Links & Web Smart Banner

**Feature Directory**: `plans/specs/019-universal-links-web-banner`  
**Created**: 2026-06-01  
**Status**: delivered — PR #607 (PWA deep linking; confirmado PO 2026-06-10)
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/EXEC_SPEC_DEEPLINK_UNIVERSAL_LINKS_WEB_BANNER.md`

---

## Context

O redirecionamento padrão do e-mail de confirmação de cadastro (`signUpWithEmail`) e redefinição de senha do Dosiq utilizava anteriormente o URL scheme cru `dosiq://auth/callback`. Embora funcional no mobile com o app instalado, este esquema não possui um fallback gracioso na Web, resultando em tela de erro no navegador caso o usuário acesse o link a partir de um desktop ou de um dispositivo sem o aplicativo nativo instalado.

A implementação de Universal Links (iOS) e App Links (Android) resolve esse obstáculo canalizando os fluxos de auth através do domínio canônico `https://dosiq.app/auth/callback`. Adicionalmente, quando usuários de dispositivos móveis acessam o web app pelo browser, um Smart App Banner (nativo no iOS Safari e customizado no Android/outros navegadores) é exibido para guiar e impulsionar a instalação do aplicativo nativo da loja App Store.

---

## User Scenarios & Testing

### User Story 1 — Redirecionamento com App Instalado (Priority: P1)
**Why this priority**: Crítico para garantir que o fluxo de autenticação e ativação de contas no mobile ocorra diretamente dentro do app, oferecendo a melhor UX nativa.  
**Independent Test**: Disparar um e-mail de confirmação ou redefinição, clicar no link `https://dosiq.app/auth/callback?...` em um celular iOS/Android que possua o Dosiq instalado e verificar se o sistema operacional abre o aplicativo nativo de forma imediata (sem passar pelo navegador mobile).

**Acceptance Scenarios**:
1. Given que o usuário possui o aplicativo Dosiq instalado no celular,  
   When ele clica no link de confirmação do e-mail apontando para `https://dosiq.app/auth/callback?...`,  
   Then o sistema operacional intercepta o link e o abre diretamente no aplicativo nativo, caindo no handler de auth.

---

### User Story 2 — Redirecionamento Sem App Instalado / Desktop (Priority: P1)
**Why this priority**: Evita telas de erro do navegador e permite que o usuário complete o fluxo de auth no PWA web se não possuir ou não quiser instalar o app nativo.  
**Independent Test**: Clicar no link de confirmação no navegador de um computador desktop ou celular sem o app instalado e verificar se a rota `/auth/callback` do web app realiza a troca de código (PKCE) ou sessão e realiza o login com sucesso no PWA.

**Acceptance Scenarios**:
1. Given que o usuário não possui o aplicativo nativo instalado (ou está em um computador desktop),  
   When ele abre o link `https://dosiq.app/auth/callback?...`,  
   Then o navegador carrega a rota web `/auth/callback` do PWA, completa a autenticação via Supabase Client e exibe a tela de boas-vindas ou onboarding na web.

---

### User Story 3 — Smart App Banner no Web Mobile (Priority: P2)
**Why this priority**: Alavancar o engajamento e a taxa de migração do web app mobile para o aplicativo nativo que gerencia lembretes e alarmes locais de forma persistente.  
**Independent Test**: Acessar o web app através do navegador Chrome ou Safari em um dispositivo móvel (fora do modo standalone/PWA instalado), verificar a presença do banner, dispensá-lo e confirmar que ele não volta a aparecer por 30 dias.

**Acceptance Scenarios**:
1. Given que o usuário acessa o site do Dosiq pelo navegador do celular,  
   When o web app não está rodando no display-mode standalone (PWA instalado) e o banner não foi dispensado nos últimos 30 dias,  
   Then um banner é renderizado no topo recomendando o download do app nativo.
2. Given que o banner está visível,  
   When o usuário clica no botão "X" (Dispensar),  
   Then o banner desaparece imediatamente e a preferência é salva localmente, impedindo sua re-exibição pela janela de 30 dias.

---

## Edge Cases

- **Links Universais no iOS Safari que caem na web após recusa**: Se o usuário abriu um link universal e forçou a visualização no Safari, o iOS pode memorizar que prefere o navegador. O fluxo deve funcionar perfeitamente quando o usuário reativar ou ao navegar via Smart App Banner.
- **Link de Confirmação Expirado**: Se o link do Supabase expirou, a rota `/auth/callback` do PWA deve exibir uma mensagem amigável em português explicando o ocorrido, com um CTA claro para solicitar um novo link.
- **Concorrência com prompt de instalação do PWA (`beforeinstallprompt`)**: Se o navegador disparar o prompt nativo de instalação do PWA, a UI deve priorizar o convite ao app nativo de lojas oficiais (App Store/Play Store) sobre o PWA, evitando sobreposição de banners e cansaço visual do usuário.

---

## Requirements

### Functional Requirements

- **FR-001**: O redirecionamento de cadastro e redefinição de senha nas configurações do Supabase e nas chamadas de serviço (`signUpWithEmail`) no app mobile deve ser atualizado para `https://dosiq.app/auth/callback` após a validação dos arquivos de associação em produção.
- **FR-002**: O web app (`apps/web`) deve escutar e rotear a URL `/auth/callback` tratando parâmetros PKCE (`?code=`) e implicit grant (`#access_token=...`) para autenticar o usuário e redirecioná-lo de forma segura.
- **FR-003**: A meta tag do Smart App Banner nativo da Apple deve ser inserida no `<head>` do `index.html` do web app utilizando o App Store ID oficial do Dosiq.
- **FR-004**: O banner de aplicativo customizado (`MobileAppBanner`) deve ser exibido exclusivamente em agentes móveis (iOS/Android), no navegador móvel padrão (fora do modo PWA independente) e caso o banner não tenha sido dispensado anteriormente (TTL de 30 dias gravado em localStorage).
- **FR-005**: O componente do banner deve respeitar critérios de acessibilidade WCAG/AAA, contendo descrições `aria-label` para o botão de fechamento e para a ação principal.

### Key Entities

- **Apple Domain Association (AASA)**: Arquivo JSON de associação estática em `/.well-known/apple-app-site-association` ligando o domínio `dosiq.app` ao app bundle `com.coelhotv.dosiq`.
- **Android Asset Links**: Arquivo JSON em `/.well-known/assetlinks.json` associando o domínio às chaves SHA-256 do keystore EAS.
- **App Store ID**: Identificador numérico atribuído pela Apple Developer ao aplicativo do Dosiq para renderização nativa do Smart App Banner.

---

## Success Criteria

- **SC-001**: E-mails de autenticação disparados para celulares com o app instalado abrem o aplicativo nativo diretamente e logado.
- **SC-002**: Cliques em desktops ou celulares sem o app carregam com sucesso a rota de fallback na web sem falhas ou loops.
- **SC-003**: 100% de conformidade de acessibilidade (a11y) no componente `MobileAppBanner` no Lighthouse/DevTools Audits.
- **SC-004**: O Service Worker (Workbox PWA) não realiza cache dos arquivos em `/.well-known/` em hipótese alguma.

---

## Assumptions

- O domínio `dosiq.app` está devidamente configurado e apontado na Vercel para servir o subdiretório `apps/web`.
- Os entitlements do Xcode e os intent filters do Android do aplicativo nativo estão gerados de forma correta pelo EAS CLI a partir de `app.config.js`.

---

## Open Questions

- *Nenhuma questão em aberto.* O escopo de deep links encontra-se plenamente alinhado entre o PO e a equipe técnica, com o Plano 1 de infraestrutura de domínio já homologado e entregue na pasta canônica do projeto.
