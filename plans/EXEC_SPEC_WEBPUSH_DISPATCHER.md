# Exec Spec 2: Integração do Web Push Dispatcher

**Domínio:** Notificações
**Objetivo:** Implementar o canal de disparo `web_push` no Dispatcher Central de notificações, conectando-o de fato às assinaturas (VAPID) registradas pelos usuários via frontend.

## 1. Contexto e Motivação
Atualmente, a API e o app PWA lidam perfeitamente com a subscrição de Web Push (salvando em `notification_devices` com `provider='webpush'`). No entanto, o backend central (Dispatcher) apenas lida com disparos para `telegram` e `mobile_push` (Expo), causando falha silenciosa ou rejeição das mensagens web push. É preciso preencher essa lacuna finalizando o pipeline de envio.

## 2. Escopo de Alterações (Arquivos Afetados)

* **Adicionar Dependência:** pacote npm `web-push`.
* **Criar:** `server/notifications/dispatcher/channels/webPushChannel.js`.
* **Modificar:** `server/notifications/dispatcher/_dispatchHelpers.js`.

## 3. Detalhamento de Implementação

### Configurando o Dispatcher Helper (`_dispatchHelpers.js`)
No switch / cadeia de *if's* do handler `dispatchChannel`:
```javascript
import { sendWebPushNotification } from './channels/webPushChannel.js'
// ...
} else if (channel === 'web_push') {
  return await sendWebPushNotification({ userId, payload, context, repositories })
}
```

### Criando o webPushChannel.js
Implementar o módulo que utiliza a biblioteca `web-push`:
1. Definir os *VAPID details* usando chaves presentes no ambiente (`process.env.VAPID_PUBLIC_KEY`, `process.env.VAPID_PRIVATE_KEY` e o e-mail responsável).
2. O método `sendWebPushNotification()` deve:
   - Resgatar os devices da base `repositories.devices.listActiveByUser(userId, 'webpush')`.
   - Formatar o payload para o Service Worker interpretar.
   - Usar `webpush.sendNotification(subscription, payload)` embrulhado num mapeamento que pegue possíveis erros (Promises ou Promise.allSettled).
3. Lidar proativamente com remoção: Se a requisição de push falhar com **Erro 410 (Gone)** ou **404**, isso significa que o usuário cancelou a permissão no browser. A função DEVE invocar a deleção (ou inativação) desse `device_id` imediatamente da tabela `notification_devices`.

## 4. Critérios de Validação / Quality Gates
- [ ] O app compila corretamente com a nova dependência de *web-push*.
- [ ] Erros "Gone/Unsubscribed (410)" expurgam as entradas do banco para não gerar retentativas contínuas desnecessárias (anti-pattern evitado).
- [ ] O `dispatchNotification.test.js` deve ser expandido com um mock simulando sucesso e recusa de permissão da função `sendWebPushNotification`.
