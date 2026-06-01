# Tasks: Universal Links / App Links & Web Smart Banner

**Feature Directory**: `plans/specs/019-universal-links-web-banner`  
**Input**: `spec.md`, `plan.md`, legacy sources  
**Status**: Migrated Draft  

---

## Phase 1: Setup / Preflight

- [ ] **T001** [C1] Verificar a presença e o conteúdo dos arquivos de associação de domínio `apple-app-site-association` e `assetlinks.json` sob a pasta `apps/web/public/.well-known/`.
- [ ] **T002** [C1] Confirmar a configuração de associated domains no Expo config `apps/mobile/app.config.js` (`ios.associatedDomains`) e intent filters no Android para evitar regressão de build EAS.
- [ ] **T003** [C1] Validar a integridade da configuração DNS e URL Configuration no painel do Supabase permitindo redirects para `https://dosiq.app/auth/callback`.

---

## Phase 2: Implementation

### Sprint 1: Roteamento de Fallback Web (UL-S2)
- [ ] **T004** [US2] Criar a rota client-side `/auth/callback` no roteador web do PWA (`apps/web/src/routes/auth/callback.jsx`) para interceptar parâmetros PKCE (`?code=`) e hash de sessão.
- [ ] **T005** [US2] Implementar chamada a `supabase.auth.exchangeCodeForSession` ou `supabase.auth.setSession` na rota web, redirecionando o usuário autenticado com sucesso para a dashboard ou fluxo de redefinição de senha.
- [ ] **T006** [US2] Adicionar renderização de card de tratamento de erro amigável em português caso o link esteja expirado ou inválido.
- [ ] **T007** [US2] Atualizar a propriedade `emailRedirectTo` do serviço de auth nativo (`apps/mobile/src/platform/auth/authService.js`) para apontar para `https://dosiq.app/auth/callback`.

### Sprint 2: Smart App Banner e Detecção Mobile (BAN-S1)
- [ ] **T008** [US3] Criar o hook utilitário de detecção mobile `useIsMobileWeb.js` sob `apps/web/src/shared/hooks/` validando User Agent, status standalone do PWA e TTL da chave `dosiq:app-banner-dismissed` no `localStorage`.
- [ ] **T009** [US3] Desenhar o componente reativo de banner acessível `MobileAppBanner.jsx` sob `apps/web/src/shared/components/` com micro-animações, contendo as descrições `aria-label` e o botão "X" de fechamento (salvando dispensa por 30 dias).
- [ ] **T010** [US3] Importar dinamicamente (`React.lazy`) e integrar o `MobileAppBanner` no layout raiz do PWA web para exibição condicionada ao hook de detecção.

### Sprint 3: Smart App Banner iOS Safari (BAN-S2)
- [ ] **T011** [US3] Injetar a meta tag nativa `apple-itunes-app` no `<head>` do arquivo `apps/web/index.html` contendo o placeholder `<APP_STORE_ID>`.
- [ ] **T012** [C1] Configurar a regra do Workbox em `apps/web/vite.config.js` para garantir exclusão explícita de caching dos arquivos estáticos de domínio em `/.well-known/`.

---

## Phase 3: Validation

- [ ] **T013** [C4] Executar `rtk lint` na pasta `apps/web` e garantir zero erros no componente e hook criados.
- [ ] **T014** [C4] Validar que o clique no Universal Link abre o app instalado diretamente sem carregar o Safari no simulador/dispositivo iOS.
- [ ] **T015** [C4] Simular acesso desktop e comprovar redirecionamento gracioso da rota `/auth/callback` para a dashboard web PWA pós-autenticação.
- [ ] **T016** [C4] Testar a exibição do banner customizado no simulador móvel do Chrome DevTools, dispensá-lo e validar que a chave com TTL foi criada no `localStorage`.
- [ ] **T017** [C4] Rodar auditoria de acessibilidade no DevTools/Lighthouse e atestar nota superior a 95% no banner mobile.

---

## Phase 4: DEVFLOW Record (SQP R-221 Checkpoints)

- [ ] **T018** [C5] Classificar o impacto de liberação da feature de roteamento e banners como **Medium** (afeta rotas de auth web e adiciona metadados mobile).
- [ ] **T019** [C5] Realizar o bump de versão no arquivo canônico `apps/web/package.json` incrementando a patch version.
- [ ] **T020** [C5] Documentar a entrega no `CHANGELOG.md` do monorepo sob a seção `[Unreleased]` em português.
- [ ] **T021** [C5] Gravar os detalhes SQP e a evidência de conclusão no diário final do DEVFLOW C5 (`.agent/memory/journal/`).

---

## Dependencies

- Nenhuma dependência ativa bloqueadora (o Plano 1 estático já está entregue e implantado).

---

## Parallel Opportunities

- A implementação do componente `MobileAppBanner` (Sprint 2) pode ser realizada de forma paralela ao roteamento de fallback web `/auth/callback` (Sprint 1), pois ambos tocam arquivos e fluxos independentes do PWA web.
