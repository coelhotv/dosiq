# Plano de Implementação: PWA e Web Push Notifications (Dosiq)

## 📌 Visão de Produto (Healthtech)
A instalação da aplicação como um PWA (Progressive Web App) preenche a lacuna existente entre o Telegram Bot e o Aplicativo Nativo (React Native/Expo). Considerando um cenário de healthtech, a continuidade do tratamento exige fricção zero de adoção. Nem todo usuário, especialmente idosos ou pacientes em regimes agudos e de curto prazo, deseja baixar um app na AppStore/PlayStore. Oferecer um app instalável via navegador local (PWA) confere agilidade ao "onboarding" e melhora engajamento.
A inclusão do suporte a Web Push Notifications preenche a peça que faltava no PWA: manter o paciente alerta sobre suas janelas terapêuticas sem depender somente do Telegram ou App Nativo.

## 🏗 Visão Arquitetural
A análise no código (`vite.config.js` e `apps/web/src/shared/components/pwa`) indica que a implementação PWA atual atua primariamente na camada visual (`InstallPrompt.jsx`), exibindo balões educativos (como "Adicionar à Tela de Início" no iOS), sem de fato empacotar o Service Worker ou estruturar o Web Manifest funcionalmente via Vite.
Para notificações, o repositório (`notificationDeviceRepository`) e o banco de dados já preveem os valores `provider: 'webpush'` e `appKind: 'pwa'`, o que agilizará a persistência. Nenhuma biblioteca (`web-push`) Backend está rodando para enviar Web Pushes.

Abaixo as ações arquiteturais necessárias para consolidar o PWA.

---

## 🛠 Tarefas de Implementação (Frontend - `@dosiq/web`)

### 1. Inclusão e Configuração do Vite PWA Plugin
- **Ação:** Instalar o `vite-plugin-pwa` no workspace `@dosiq/web`.
- **Manifesto Web App:** Parametrizar dinamicamente no `vite.config.js` detalhes essenciais: `name`, `short_name`, `description`, `theme_color` (usando os tokens visuais mapeados em `@design-tokens`), `background_color`, e tipo de exibição `standalone`.
- **Assets e Ícones:** Extrair e reutilizar os assets originais existentes em `apps/mobile/assets` gerando suas variações necessárias.
- **Service Worker de Cache:** Configurar o modo `injectManifest` (preferencial devido à lógica de push), instruindo a estratégia de cacheamento do App Shell para garantir rápida inicialização.

### 2. Fluxo de Registro de Push Subscriptions
- **Ação:** Refatorar ou criar hooks acionados pelo contexto do `InstallPrompt`.
- **Lógica:**
  1. Solicitar permissão nativa (`Notification.requestPermission()`).
  2. Subscrever no evento através do Service Worker passando uma chave pública `VAPID_PUBLIC_KEY`.
  3. Enviar a subscription e endpoints via API para a base.

### 3. Service Worker customizado (`sw.js`)
- **Ação:** Registrar os listeners `push` nativos.
- **Listeners:**
  - `push`: recebe texto e aciona `self.registration.showNotification(title, options)`.
  - `notificationclick`: foca a aba correta do navegador do usuário no clique da notificação.

---

## ⚙ Tarefas de Implementação (Backend - API Vercel)

### 4. Integração do Despachador de Pushes
- **Ação:** Instalar a lib NodeJS `web-push` no backend.
- **Chaves VAPID:** Gerar um par de chaves VAPID (`npx web-push generate-vapid-keys`), registrando como variáveis de ambiente no Supabase/Vercel (`VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`).

### 5. Atualização da Persistência de Devices
- **Ação:** Criar um endpoint `POST /api/register-web-push` e invocar `notificationDeviceRepository.upsert({ ... provider: 'webpush', pushToken: 'json_stringificado' })`.

### 6. Agendador (Cron) adaptado para WebPush
- **Ação:** O Job/Cron iterável existente em `api/notify.js` precisará contemplar accounts cujo provider venha na query como `webpush`.
- **DLQ:** Adicionar controle de falhas (HTTP `410 Gone` ou `404 Not Found`) invocando a exclusão do provider no repositório.

---

## 🚦 Observações e Regulamentações Mobile

Como foco no PWA e experiência:
1. **Limitação Apple no iOS:** O Web Push Notification no iPhone funciona **exclusivamente** no modo instalado/Standalone (não operará via safari browser nativo). O atual `InstallPrompt.jsx` fará o papel principal para superar essa restrição.
2. **Prioridade Funcional vs Opcional:** O offline cache do Shell Web é a cereja do bolo, mitigando "Load Views Brancos". Devemos carregar os views/React Lazy de imediato do LocalStorage do navegador.
