# Execution Spec: PWA Implementation & Web Push Notifications

## 🎯 Scope
Transformar a aplicação React/Vite em um PWA funcional via `vite-plugin-pwa`, implementando service workers robustos (App Shell caching) e sistema de Web Push Notifications integrado à tabela `notification_devices` atual.

## 📦 Deliverables

**Core Features (Frontend):**
- [ ] Configuração do `vite-plugin-pwa` no `apps/web/vite.config.js`.
- [ ] Construção do `manifest.json` via plugin, englobando os ícones portados e variações para standalone mode.
- [ ] Injetar o Service Worker Customizado (`injectManifest`) com rotinas para `push` event listeners.
- [ ] Funcionalidade de Subscribe: usar a API `Notification.requestPermission()` vinculada à UI do `InstallPrompt`.

**Core Features (Backend):**
- [ ] Adição da biblioteca `web-push` configurada com chaves VAPID.
- [ ] Refatoração do repositório/despachador de notificações para acolher devices com o provider `webpush`.
- [ ] Novo Endpoint de API Web Push (ex: `/api/notifications/webpush-subscribe`) que recebe o payload e aciona a tabela do banco via `notificationDeviceRepository.upsert()`.
- [ ] Job Cron configurado para despachar os `webpush`(es) devidos.

**Peripheral (Testes e Qualidade):**
- [ ] Atualização do Zod schema (`notificationSchema` / `deviceSchema`) caso extensões sejam necessárias.
- [ ] Adequação dos DLQs (exclusões ou inativações nos eventos de devoluções 404/410 do GCM/FCM).

## 📄 Target Files
- `apps/web/vite.config.js` (Modificação - Configurar plugin PWA)
- `apps/web/package.json` (Inclusão - dependência `vite-plugin-pwa`, `workbox-window`)
- `server/package.json` ou `package.json` root (Inclusão - dependência `web-push`)
- `apps/web/src/shared/components/pwa/pwaUtils.js` (Modificação - Suporte a Push Manager)
- `apps/web/src/shared/components/pwa/InstallPrompt.jsx` (Modificação - Handler do RequestPermission)
-Novo: `apps/web/src/service-worker.js` (Implementação Workbox)
-Novo: Rota de API: `api/register-webpush.js` (ou similar)
- `server/services/notificationDeduplicator.js` ou dispatcher principal (Inclusão lógica de roteamento)

## ✅ Acceptance Criteria
1. Após "Build", os arquivos `manifest.json` com ícones completos e `sw.js` são providos na pasta `dist`.
2. Em um browser moderno (Chrome/Edge), acessar a aplicação offline exibe a casca da tela via cache do Workbox.
3. Clicar em "Ativar Notificações", com aprovação, registra uma tupla na tabela `notification_devices` contendo o objeto PushJSON com a flag `app_kind = pwa` e `provider = webpush`.
4. Uma notificação disparada para o Web Push exibe um Alert/Toast visual em stand-by.

## 🚩 Risk Flags
- Requerimento de `ADR-029` (Dispatcher Multicanal) — a mecânica do webhook Web Push integrará essa casca.
- **VAPID Keys**: Geração segura destas chaves deverá ser documentada dentro do `.env.example`.

## 🛡️ Quality Gates
- **Lint**: `npm run lint` ou equivalente.
- **Teste Crítico**: `npm run test:critical` (para os utils de subscriptions).
- **Testes Agents**: `npm run validate:agent` após codificação.
