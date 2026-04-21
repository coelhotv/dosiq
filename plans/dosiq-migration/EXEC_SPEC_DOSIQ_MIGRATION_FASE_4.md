# EXEC SPEC FASE 4: Bot, API Serverless & Notificações

> **Branch:** `refactor/dosiq-migration-fase-4`
> **Pré-requisito:** Fase 1 merged e `main` atualizado
> **Duração estimada:** 30 min
> **Impacto:** Backend do Telegram, Serverless Functions da Vercel e deep links de notificação

---

## 0. Bootstrap Obrigatório

```bash
git checkout main && git pull
git checkout -b refactor/dosiq-migration-fase-4
npm run lint    # Baseline limpo
```

---

## 1. Arquivos a Modificar

### 1.1 `server/bot/commands/start.js` — Mensagem de Conexão

**Auditoria identificou** referência explícita ao nome do app na mensagem de onboarding:

```js
// Linha atual (mensagem que o usuário vê ao iniciar o bot):
'1. Abra o app Meus Remédios\n' +
```

Corrigir para:
```js
'1. Abra o app Dosiq\n' +
```

Varredura completa do arquivo:
```bash
grep -n "Meus Rem\|meusremedios\|meus-remedios\|meus_remedios" server/bot/commands/start.js
# Corrigir todas as ocorrências
```

### 1.2 `server/bot/commands/ajuda.js` — Username Fallback do Bot

**Auditoria identificou** o fallback hardcodado do username do bot:

```js
// Linha atual:
let botUsername = 'meus_remedios_bot';
```

Corrigir para:
```js
let botUsername = 'dosiq_bot';
```

> [!IMPORTANT]
> Este valor é apenas um fallback usado quando a chamada `bot.getMe()` falha. O valor real é obtido dinamicamente da API do Telegram. Ainda assim, o fallback DEVE ser atualizado para consistência.

### 1.3 `server/bot/services/chatbotServerService.js` — Serviço de Chatbot

Verificar e corrigir referências:
```bash
grep -n "Meus Rem\|meusremedios\|meus-remedios\|meus_remedios" server/bot/services/chatbotServerService.js
```

### 1.4 `server/bot/utils/commandWrapper.js` — Utilitário Wrapper

Verificar e corrigir referências:
```bash
grep -n "Meus Rem\|meusremedios\|meus-remedios" server/bot/utils/commandWrapper.js
```

### 1.5 `server/bot/tasks.js` — Tarefas Agendadas do Bot

Verificar e corrigir referências (especialmente mensagens que o bot envia nos cron jobs):
```bash
grep -n "Meus Rem\|meusremedios\|meus-remedios" server/bot/tasks.js
```

### 1.6 `server/notifications/payloads/buildNotificationPayload.js` — Deep Links de Notificação

**Auditoria identificou** deep links com scheme legado:

```js
// Linha 37 — atual:
deeplink: `meusremedios://today`,
```

Corrigir para:
```js
deeplink: `dosiq://today`,
```

Verificar todo o arquivo:
```bash
grep -n "meusremedios://" server/notifications/payloads/buildNotificationPayload.js
# Corrigir TODAS as ocorrências (podem ser múltiplas rotas: today, stock, etc.)
```

### 1.7 `api/notify.js` — Serverless Function de Notificação Vercel

**Auditoria identificou 3 deep links** hardcodados:

```js
// Linha 53:
deeplink: `meusremedios://today?protocolId=${data.protocolId}`,
// Linha 64:
deeplink: `meusremedios://stock`,
// Linha 71:
deeplink: `meusremedios://today`,
```

Corrigir TODAS para `dosiq://`:
```js
deeplink: `dosiq://today?protocolId=${data.protocolId}`,
deeplink: `dosiq://stock`,
deeplink: `dosiq://today`,
```

### 1.8 `api/` — Verificação Completa das Serverless Functions

```bash
grep -rn "meus.remedios\|meusremedios\|Meus Rem" --include="*.js" api/
# Corrigir qualquer ocorrência encontrada
# Atenção especial a URLs de redirect e base URLs do Vercel
```

### 1.9 Testes de Integração do GitHub Actions — Referências de URL

**Auditoria identificou** que arquivos de teste do `.github/scripts/__tests__/` contêm URLs hardcodadas para o repositório GitHub e para a API da Vercel:

```js
// .github/scripts/__tests__/check-resolutions.e2e.test.js linha 25:
const API_BASE_URL = 'https://meus-remedios.vercel.app/api/gemini-reviews';

// Vários arquivos de teste contêm:
html_url: 'https://github.com/coelhotv/meus-remedios/pull/100#...'
repo: 'meus-remedios'
```

> [!WARNING]
> **Sobre os URLs do GitHub nos testes:** Estes valores são fixtures de teste que simulam payloads reais do GitHub. Após o rename do repositório no GitHub, estas URLs mudarão de `meus-remedios` para `dosiq`. Portanto:
> - `API_BASE_URL` em `check-resolutions.e2e.test.js` → atualizar para `dosiq.vercel.app`
> - Fixtures de `html_url` e `repo` nos outros testes: atualizar para `dosiq`

```bash
# Verificar todos os arquivos de teste do .github:
grep -rn "meus-remedios\|meus_remedios" .github/
# Listar e corrigir todas as ocorrências
```

### 1.10 `server/BOT README.md`

Verificar e corrigir todas as referências ao nome do bot e da plataforma.

---

## 2. O Que NÃO Alterar Nesta Fase

- ❌ Token do Bot (fica no `.env`, não no código)
- ❌ Tabelas do Supabase ou queries SQL
- ❌ Chaves de API (ficam em variáveis de ambiente)

---

## 3. Quality Gates

### Gate 1: Varredura Completa do Server e API
```bash
grep -rn "meusremedios\|meus.remedios\|Meus Rem" \
  --include="*.js" \
  server/ api/
# Resultado esperado: 0 linhas
```

### Gate 2: Testes do Bot
```bash
# Se existir script de teste no server/:
cd server && npm test 2>&1 | tail -20
# Deve passar sem erros
```

### Gate Final da Fase
```bash
npm run lint
npm run test:critical    # Cobre schemas e serviços

# Escopo completo limpo:
grep -rn "meusremedios://\|meus_remedios_bot" --include="*.js" api/ server/
# Resultado esperado: 0 linhas

git add -A
git commit -m "refactor(bot,api): atualizar deep links meusremedios:// → dosiq:// e username do bot"
```

---

## 4. Critérios de Aceitação do PR

- [ ] `server/bot/commands/start.js`: texto "app Meus Remédios" corrigido para "app Dosiq"
- [ ] `server/bot/commands/ajuda.js`: fallback `meus_remedios_bot` → `dosiq_bot`
- [ ] `server/notifications/payloads/buildNotificationPayload.js`: zero deep links `meusremedios://`
- [ ] `api/notify.js`: 3 deep links `meusremedios://` → `dosiq://`
- [ ] `.github/scripts/__tests__/check-resolutions.e2e.test.js`: URL da API atualizada
- [ ] Fixtures de testes do `.github/` atualizadas
- [ ] Zero ocorrências de `meusremedios://` em todo o código
- [ ] `npm run test:critical` passando
- [ ] `npm run lint` passando


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
