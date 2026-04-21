# Exec Spec Fase 4: Integrações, Auth e Bot Backend
> **Objetivo:** Refatoração de endpoints de autenticação, integrações sociais (Supabase Auth) e o serviço do Telegram Bot.

## 1. Escopo de Arquivos Modificados
- `server/` (Scripts Node atrelados ao Telegram)
- Classes de Handlers ou Repositories de Notificação: Ex `apps/mobile/src/platform/notifications/`

## 2. Tarefas de Execução

### 2.1. Telegram Bot Handlers
- Fazer um grep global pela query `Meus Remédios` e substituí-la por `Dosiq`.
- Fazer um grep global pela query `meus_remedios_bot` ou username legados e modificá-los formalmente para o recém criado pelo cliente: `dosiq_bot`. 
- Caso hajam Deep Links do bot que redirecionem ou mandem `/start` payloads contendo URL velhas, substituí-las pela arquitetura nova (`dosiq://` native handler ou `dosiq.vercel.app`).

### 2.2. Supabase Auth Templates e URL Builders
- Dentro da codebase de serviços (ex `cachedServices` ou funções de Login/Signup da API) buscar referências estáticas que enviam URIs de callback hardcoded para emails; redirecioná-las de `meus-remedios-dev` / `meus-remedios` para as do `dosiq`.

## 3. Validation Gate do Agente
- Rodar os testes na pasta local `/server` garantindo que o Telegraf não corrompeu.
- Rodar `npm run test:critical` (que engloba schemas e funcoes essenciais) para se certificar de que nenhum refactor no domínio destruiu integrações.
