# Guia de Operações — Notificações Push

> **Status:** Operacional (Fase 6)
> **Stack:** Expo Push Service + Multi-channel Dispatcher (Server-side)

Este documento descreve como operar, diagnosticar e mitigar problemas no sistema de notificações push do Meus Remédios.

---

## 🚀 Rollback de Emergência

Se as notificações pararem de funcionar ou causarem instabilidade nos jobs de segundo plano (Cron), utilize a feature flag de rollback:

1. Acesse o **Vercel Dashboard** do projeto.
2. Vá em **Settings** > **Environment Variables**.
3. Altere (ou adicione) a variável:
   - `USE_NOTIFICATION_DISPATCHER` = `false`
4. **Redeploy** ou aguarde a propagação (recomendado redeploy se for crítico).

**O que acontece:** O sistema fará fallback imediato para o envio via Telegram legado, ignorando o dispatcher multicanal e as notificações push.

---

## 🛠️ Diagnóstico de Problemas

### 1. O usuário não está recebendo Push
Verifique os seguintes itens no Supabase Dashboard:

- **Preferência do usuário:** Na tabela `user_settings`, a coluna `notification_preference` deve ser `mobile_push` ou `both`.
- **Dispositivos registrados:** Na tabela `notification_devices`, verifique se há registros para o `user_id` com `is_active = true`.
- **Token desativado:** Se o `is_active` estiver `false`, o sistema detectou um erro permanente (ex: `DeviceNotRegistered`) e parou de tentar o envio para aquele token. O usuário deve abrir o app novamente para re-registrar o dispositivo.

### 2. Logs no Vercel
Procure no log do Vercel por eventos do tipo `job_dispatch` ou `dispatch_notification`. Eles trazem o `correlationId` para rastreamento fim-a-fim.

---

## 📈 Limites e Escalabilidade

### Expo Push Service
Atualmente utilizamos o plano gratuito do Expo Push Service.
- **Limites:** Não há limites rígidos publicados para pequenos volumes (< 50 usuários), mas o serviço é rate-limited por IP.
- **Escalabilidade:** Se o projeto crescer além do beta interno, considere migrar para integração direta com APNs (Apple) e FCM (Google) ou usar o plano pago do Expo.

---

## 👤 Gestão de Preferências

Para resetar ou alterar a preferência de um usuário via SQL:

```sql
UPDATE user_settings 
SET notification_preference = 'telegram' -- Opções: 'telegram', 'mobile_push', 'both', 'none'
WHERE user_id = 'UUID_DO_USUARIO';
```

Para remover todos os dispositivos de um usuário:
```sql
UPDATE notification_devices 
SET is_active = false 
WHERE user_id = 'UUID_DO_USUARIO';
```

---

## 📝 Contratos de Erro Permanente

O dispatcher desativa automaticamente tokens que retornam os seguintes erros do Expo:
- `DeviceNotRegistered`
- `InvalidCredentials` (configuração do servidor)
- `MessageTooBig`
