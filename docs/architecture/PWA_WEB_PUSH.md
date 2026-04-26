# 🌐 Arquitetura de Notificações PWA Web Push

A infraestrutura de Web Push Notifications foi elaborada no Dosiq como um PWA nativamente independente de pesados frameworks terceiros no client. Adotamos o modelo puro **HTML5 Push API**, intermediando o VAPID (Voluntary Application Server Identification) sob o protocolo de Web Push comum aos navegadores modernos.

---

## 🏗️ Estrutura do Web Push Flow

### 1. Inscrição do Frontend PWA

A aplicação cliente obtém e fornece o token gerador pelo próprio browser (via PushManager do Service Worker) utilizando uma Public Key contida diretamente no ambiente (`import.meta.env.VITE_VAPID_PUBLIC_KEY`). 

```javascript
// webpushService.js
const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
});
```

A inscrição envia para a API o token JSON encapsulado.
- **Provider utilizado**: `webpush`
- **Tabela de banco de dados**: `notification_devices` (Supabase)

### 2. Service Worker (Workbox)

A injeção do Service worker baseia-se no `vite-plugin-pwa` em modo `injectManifest`, permitindo compilar lógicas extras sem perder a abstração dos headers customizados de PWA no Vite.
Nele interceptamos centralizadamente:
- **`push`**: Mostra notificações do OS, carrega badges de PWA (`/pwa-192x192.png`), estipula padrão de vibração e atacha a URI destino para clique.
- **`notificationclick`**: Captura e resolve o *Routing* em Background (Caso a aba do aplicativo estiver em background faz *focus()*, caso esteja morta faz *openWindow()*).

### 3. Serverless API Proxy (Backend Vercel)

A API Proxy atesta o envio do device cadastrado de forma anonimiza ou com chave de autenticão.
Arquivo e rota: `/api/register-webpush`. Cadastrado ativamente tanto como Vercel Serverless Function, além do mapeamento em `vercel.json` na rota de `.rewrites()`.
Permite acoplar a mesma abstração universal do Dosiq que atende React Native à web:

```json
{
  "provider": "webpush",
  "push_token": "{\"endpoint\": \"https://fcm.googleapis.com...\", \"keys\": {\"p256dh\": \"...\", \"auth\": \"...\"}}",
  "app_kind": "pwa",
  ...tags (userId)
}
```

## ✨ Benefícios Técnicos

1. **Alta Performance (M2 Compliant)**: Excluímos a necessidade de inicializar `firebase/app` e `firebase/messaging` no pacote Frontend, o que significa que entregamos Web Push com "Taxa 0 de kBs no Browser", aproveitando a própria API nativa da DOM (`window.navigator.PushManager`).
2. **Suporte Cross-Browser Universal**: Usando as chaves VAPID o Firefox utiliza Mozilla Push, Edge utiliza WPNs, Chrome usa FCM transparente, iOS 16.4+ (Standalone PWA) utiliza Apple APNs de forma padronizada.
3. **Privacidade Preservada**: Os tokens não vazam do nosso backend Supabase diretamente a brokers de Marketing, e não existe amarra hardcoded da Web-SDK.

## 📝 Exibição UX Dinâmicas

A detecção de compatibilidade é gerenciada no módulo **`@shared/components/pwa/pwaUtils.js`**. O app foi treinado para exigir o trigger opt-in (botão "Habilitar Notificações") nativamente se o usuário possuir a tab PWA na modalidade `Standalone` e ainda não possuir a permissão `granted`. O componente **`InstallPrompt.jsx`** reencaminha essa exigência nativa para ele com estilo.
