# Exec Spec 1: Consolidação de Serverless Endpoints

**Domínio:** Infraestrutura / Gerenciamento de Usuários
**Objetivo:** Consolidar os endpoints `/api/register-webpush.js` e `/api/beta-signup.js` em um único router `/api/users.js`, otimizando o limite de funções Serverless (Vercel Hobby plan) e mantendo as interfaces de comunicação consistentes para o frontend.

## 1. Contexto e Motivação
A Vercel impõe um limite estrito de 12 funções Serverless no plano Hobby. Atualmente utilizamos 10/12. Para habilitar o roadmap (integrações com WhatsApp, Portal e OCR), precisamos otimizar as funções de baixa complexidade isoladas e usar arquitetura de "Routers".
Os endpoints de `beta-signup` e `register-webpush` compartilham do mesmo domínio lógico (Usuário/Inscrição) e podem ser agrupados sob o path genérico `users`.

## 2. Escopo de Alterações (Arquivos Afetados)

### Backend (Serverless)
* **Criar:** `api/users.js` — Router principal que fará o *dispatch* com base em `req.query.action`.
* **Criar:** `api/users/_handlers/beta-signup.js` — Lógica do signup movida para cá.
* **Criar:** `api/users/_handlers/register-webpush.js` — Lógica de registro web push movida para cá.
* **Deletar:** `api/beta-signup.js`
* **Deletar:** `api/register-webpush.js`
* **Deletar:** `api/health/notifications.js` (Lixo inerte que ninguém chama, remoção isolada).

### Configurações de Roteamento
* **Modificar:** `vercel.json`
  * Adicionar rewrites para o novo router:
    ```json
    { "source": "/api/users/beta-signup", "destination": "/api/users.js?action=beta-signup" },
    { "source": "/api/users/register-webpush", "destination": "/api/users.js?action=register-webpush" }
    ```

### Frontend (Serviços e UI)
* **Modificar:** `apps/web/src/shared/services/betaSignupService.js`
  * Alterar endpoint no `fetch()` de `/api/beta-signup` para `/api/users/beta-signup`.
* **Modificar:** `apps/web/src/shared/services/webpushService.js`
  * Alterar endpoint no `fetch()` de `/api/register-webpush` para `/api/users/register-webpush`.

## 3. Guia de Implementação (Passo-a-Passo)

1. Mova e encapsule as funções atuais dentro da estrutura em `_handlers/` (arquivos nessas pastas não contam para o limite da Vercel).
2. O router `api/users.js` deve importar os dois *handlers* num padrão `const ROUTES = { 'beta-signup': handleBetaSignup, ... }`.
3. Garanta que o CORS e as verificações de método (`req.method !== 'POST'`) continuem funcionando idênticas no router.
4. Ajuste os apontamentos na interface client (`betaSignupService` e `webpushService`). 
5. Adicione as rotas e teste o envio/comunicação no ambiente local.

## 4. Quality Gates / Critérios de Validação
- [ ] A build local `npm run build` passa sem erros.
- [ ] Subscrições de beta via frontend conseguem ser escritas no banco com sucesso (verba-tests / network logs).
- [ ] O toggle de *Web Push* nas configurações continua enviando o VAPID token corretamente pro servidor (Code 200).
- [ ] O contador de funções na Vercel relata que foram liberadas pelo menos 2 functions na stack.
