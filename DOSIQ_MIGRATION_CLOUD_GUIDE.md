# Guia de Migração Cloud & Local: Meus Remédios → Dosiq

> **Contexto:** As Fases 1–5 da migração de código já estão completas e mergeadas em `main`.
> Este guia cobre exclusivamente as etapas manuais em serviços externos e no ambiente local.
> Todas as ações abaixo dependem de acesso humano a painéis web — agentes de código não podem executá-las.

---

## Índice

1. [Supabase](#1-supabase)
2. [Vercel](#2-vercel)
3. [Expo EAS](#3-expo-eas)
4. [Google Play Console](#4-google-play-console)
5. [App Store Connect](#5-app-store-connect)
6. [GitHub](#6-github)
7. [Ambiente Local](#7-ambiente-local)
8. [Verificação Final](#8-verificação-final)

---

## 1. Supabase

> URL: [supabase.com/dashboard](https://supabase.com/dashboard)
> Projeto atual: identifique pelo nome na tela inicial.

### 1.1 Templates de E-mail

`Authentication → Email Templates`

Editar cada template a seguir e substituir `Meus Remédios` por `Dosiq` nos campos de assunto e corpo:

| Template | Campo a editar |
|---|---|
| Confirm signup | Subject + Body |
| Magic Link | Subject + Body |
| Change Email Address | Subject + Body |
| Reset Password | Subject + Body |
| Invite User | Subject + Body |

### 1.2 URLs de Redirecionamento

`Authentication → URL Configuration`

Adicionar nas **Redirect URLs** (lista de URLs permitidas para auth callbacks):

```
https://dosiq.vercel.app
https://dosiq.vercel.app/**
dosiq://
```

> Mantenha as URLs antigas (`meus-remedios.vercel.app`) durante o período de transição para não quebrar sessões ativas. Remova-as somente após confirmar que o domínio novo está funcional.

### 1.3 Site URL

`Authentication → URL Configuration → Site URL`

Atualizar de:
```
https://meus-remedios.vercel.app
```
Para:
```
https://dosiq.vercel.app
```

### 1.4 (Opcional) Renomear o Projeto Supabase

`Project Settings → General → Project Name`

Alterar o nome de exibição para `Dosiq`.

> **Atenção:** Renomear o projeto Supabase **não altera** a URL do banco (que contém o Project ID imutável). Nenhuma variável de ambiente precisa ser atualizada.

---

## 2. Vercel

> URL: [vercel.com/dashboard](https://vercel.com/dashboard)

### 2.1 Renomear o Projeto

`Project → Settings → General → Project Name`

Alterar de `meus-remedios` para `dosiq`.

> Após renomear, o domínio automático muda de `meus-remedios.vercel.app` para `dosiq.vercel.app`. Confirme que o deploy está funcional antes de continuar.

### 2.2 Atualizar Variáveis de Ambiente

`Project → Settings → Environment Variables`

Verificar e atualizar as variáveis relacionadas ao branding:

| Variável | Valor atual | Valor novo |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | token do `meus_remedios_bot` | token do `dosiq_bot` |
| `NEXT_PUBLIC_APP_URL` (se existir) | `https://meus-remedios.vercel.app` | `https://dosiq.vercel.app` |
| `VITE_APP_URL` (se existir) | `https://meus-remedios.vercel.app` | `https://dosiq.vercel.app` |

> As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` **não mudam** — o banco Supabase é o mesmo.

### 2.3 Atualizar Domínio Customizado (se houver)

Se houver domínio customizado configurado (`dosiq.app` ou similar), verificar em:

`Project → Settings → Domains`

### 2.4 Atualizar o arquivo `.vercel/project.json` local

Após o rename no painel, o arquivo local `.vercel/project.json` ainda contém:

```json
{"projectId":"prj_yQIAbiPJEgZxv4CKGnBrAG6HipPN","orgId":"team_zkyqhzaNOyNUKklyuPi8dPNA","projectName":"meus-remedios"}
```

Atualizar o campo `projectName`:

```json
{"projectId":"prj_yQIAbiPJEgZxv4CKGnBrAG6HipPN","orgId":"team_zkyqhzaNOyNUKklyuPi8dPNA","projectName":"dosiq"}
```

---

## 3. Expo EAS

> URL: [expo.dev](https://expo.dev)
> Conta: `coelhotv`

### 3.1 Verificar Slugs dos Projetos

`expo.dev → Projects`

Confirmar que os três ambientes foram criados (ou criar caso não existam):

| Slug | Nome de exibição | Ambiente |
|---|---|---|
| `dosiq-app` (ou `dosiq`) | Dosiq | production |
| `dosiq-app` | Dosiq Preview | preview |
| `dosiq-app` | Dosiq Dev | development |

> O `app.config.js` já foi atualizado nas Fases 1–2 para usar `slug: 'dosiq-app'`. Confirme que o slug no painel bate com o do config.

### 3.2 EAS Project ID

O `EAS_PROJECT_ID` (`7169f55a-6de7-465f-b007-f5eb6034c8e6`) **não muda** — é o identificador interno do EAS e está vinculado ao `eas.json` e ao `app.config.js`. Não altere.

### 3.3 Credenciais (Keystore Android + Provisioning iOS)

Execute localmente após o rename do bundle identifier estar no ar:

```bash
cd /Users/coelhotv/git-icloud/dosiq   # ou o caminho atual do repo
eas credentials
```

Selecionar cada perfil (`development`, `preview`, `production`) e verificar se as credenciais estão vinculadas aos novos bundle IDs:

- Android: `com.coelhotv.dosiq` (production), `com.coelhotv.dosiq.dev` (development/preview)
- iOS: `com.coelhotv.dosiq` (production), `com.coelhotv.dosiq.dev` (development/preview)

### 3.4 Atualizar Webhook de Notificações Push (se configurado)

`expo.dev → Project → Credentials → Push Notifications`

Verificar se o serviço APNS (iOS) e FCM (Android) estão vinculados ao novo bundle ID.

---

## 4. Google Play Console

> URL: [play.google.com/console](https://play.google.com/console)

### 4.1 Renomear o App na Listagem

> **Atenção:** O package name (`com.coelhotv.dosiq`) já deve estar definido no código. O Google Play **não permite alterar** o package name de um app publicado. Se o app atual usa `com.coelhotv.meusremedios`, será necessário publicar como novo app.

#### Se o app ainda não foi publicado com `com.coelhotv.meusremedios` (ou está em Internal Testing):

`App → Store presence → Main store listing`

- **App name:** Alterar para `Dosiq`
- **Short description:** Atualizar para remover "Meus Remédios"
- **Full description:** Atualizar para remover "Meus Remédios"

#### Se o app já está publicado com o package name antigo:

Neste caso, a migração de identidade no Play Console exige criar um novo app:

1. `Create app` com package `com.coelhotv.dosiq`
2. Preencher as informações da nova listagem
3. Usar o EAS para gerar o novo APK/AAB com `eas build --platform android --profile production`
4. Submeter para revisão
5. Descontinuar o app antigo após confirmar que os usuários migraram

### 4.2 Atualizar Assets Visuais

`Store presence → Main store listing → Graphics`

- **App icon:** Atualizar se o ícone mudou com o rebranding
- **Feature graphic:** Atualizar se houver menção ao nome antigo
- **Screenshots:** Verificar se algum screenshot contém o nome "Meus Remédios" na UI

### 4.3 Firebase / Google Cloud (SHA Fingerprints)

`Google Cloud Console → Firebase Console → Project Settings → Your apps`

Se criou um novo projeto Firebase para o app `com.coelhotv.dosiq`:

1. Adicionar o app Android com package `com.coelhotv.dosiq`
2. Baixar o `google-services.json` novo
3. Copiar para `apps/mobile/google-services.json` (e variantes `*-development.json`, `*-preview.json`)
4. Adicionar SHA-1 e SHA-256 do keystore de produção em `Firebase Console → App → Add fingerprint`

Para obter o SHA do keystore via EAS:

```bash
eas credentials --platform android
# O painel exibe SHA-1 e SHA-256 do keystore gerenciado pelo EAS
```

---

## 5. App Store Connect

> URL: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)

### 5.1 Renomear o App

`My Apps → [selecionar o app] → App Information`

- **Name:** Alterar para `Dosiq`
- **Subtitle:** Atualizar se contiver "Meus Remédios"
- **Bundle ID:** Deve ser `com.coelhotv.dosiq` — confirmar que corresponde ao registrado no Apple Developer Portal

> **Atenção:** O Bundle ID **não pode ser alterado** após o app estar publicado. Se o app atual usa `com.coelhotv.meusremedios`, será necessário criar um novo app no App Store Connect com o novo bundle ID.

#### Se for necessário criar novo app no App Store Connect:

1. `My Apps → (+) → New App`
2. Plataformas: iOS
3. Name: `Dosiq`
4. Primary Language: Portuguese (Brazil)
5. Bundle ID: `com.coelhotv.dosiq` (deve estar registrado em Developer Portal primeiro)
6. SKU: `dosiq` (identificador interno único)

### 5.2 Registrar o Bundle ID no Apple Developer Portal

> URL: [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers)

Se `com.coelhotv.dosiq` ainda não estiver registrado:

1. `Identifiers → (+)` → App IDs → App
2. Description: `Dosiq`
3. Bundle ID: `com.coelhotv.dosiq` (Explicit)
4. Capabilities: habilitar as mesmas do app antigo (Push Notifications, Associated Domains, etc.)
5. Registrar

### 5.3 Atualizar Assets da Listagem

`App Store Connect → [app] → App Store → [versão] → App Store Information`

- **Promotional Text:** Verificar menções ao nome antigo
- **Description:** Substituir "Meus Remédios" por "Dosiq"
- **Keywords:** Atualizar se necessário
- **Screenshots:** Verificar se a UI exibida contém o nome antigo

### 5.4 Gerar Build iOS com Novo Bundle ID

```bash
cd /Users/coelhotv/git-icloud/dosiq   # ou caminho atual
eas build --platform ios --profile production
```

Após o build, submeter via:

```bash
eas submit --platform ios --latest
```

---

## 6. GitHub

> **Pré-requisito:** Todas as 5 Fases de código mergeadas em `main` (já concluído em 2026-04-21).

### 6.1 Renomear o Repositório

`github.com/coelhotv/meus-remedios → Settings → General → Repository name`

1. Alterar o nome para `dosiq`
2. Confirmar clicando em **Rename**

> O GitHub redireciona automaticamente todas as URLs antigas (`github.com/coelhotv/meus-remedios`) para o novo endereço por tempo indefinido. Links existentes continuam funcionando.

### 6.2 Atualizar Remote Local

Após o rename no GitHub, atualizar o remote do repositório local:

```bash
git remote set-url origin git@github.com:coelhotv/dosiq.git

# Verificar
git remote -v
# Esperado: origin  git@github.com:coelhotv/dosiq.git (fetch)
#           origin  git@github.com:coelhotv/dosiq.git (push)
```

### 6.3 Atualizar Secrets do GitHub Actions (se houver CI/CD)

`github.com/coelhotv/dosiq → Settings → Secrets and variables → Actions`

Verificar e atualizar:

| Secret | Atualizar se contiver |
|---|---|
| `VERCEL_PROJECT_ID` | ID do projeto antigo |
| `TELEGRAM_BOT_TOKEN` | Token do bot antigo |
| Qualquer secret com URL | URL antiga `meus-remedios.vercel.app` |

### 6.4 Atualizar Descrição e Topics do Repositório

`github.com/coelhotv/dosiq → (ícone de engrenagem ao lado de "About")`

- **Description:** Atualizar menções a "Meus Remédios"
- **Topics:** Adicionar `dosiq` se desejar

---

## 7. Ambiente Local

### 7.1 Clonar o Repositório no Novo Caminho

Após o rename do GitHub (Seção 6.1), clonar para o novo path canônico:

```bash
git clone git@github.com:coelhotv/dosiq.git /Users/coelhotv/git-icloud/dosiq
cd /Users/coelhotv/git-icloud/dosiq
npm install
```

### 7.2 Migrar Arquivos Sensíveis

Os arquivos abaixo **não estão no repositório** (estão no `.gitignore`). Copiar manualmente do diretório antigo:

```bash
# .env e .env.local na raiz
cp /Users/coelhotv/git-icloud/meus-remedios/.env \
   /Users/coelhotv/git-icloud/dosiq/.env

cp /Users/coelhotv/git-icloud/meus-remedios/.env.local \
   /Users/coelhotv/git-icloud/dosiq/.env.local 2>/dev/null || true

# Google Services Android (3 arquivos)
cp /Users/coelhotv/git-icloud/meus-remedios/apps/mobile/google-services.json \
   /Users/coelhotv/git-icloud/dosiq/apps/mobile/google-services.json

cp /Users/coelhotv/git-icloud/meus-remedios/apps/mobile/google-services-development.json \
   /Users/coelhotv/git-icloud/dosiq/apps/mobile/google-services-development.json

cp /Users/coelhotv/git-icloud/meus-remedios/apps/mobile/google-services-preview.json \
   /Users/coelhotv/git-icloud/dosiq/apps/mobile/google-services-preview.json

# GoogleService-Info iOS (3 arquivos)
cp /Users/coelhotv/git-icloud/meus-remedios/apps/mobile/GoogleService-Info.plist \
   /Users/coelhotv/git-icloud/dosiq/apps/mobile/GoogleService-Info.plist

cp /Users/coelhotv/git-icloud/meus-remedios/apps/mobile/GoogleService-Info-development.plist \
   /Users/coelhotv/git-icloud/dosiq/apps/mobile/GoogleService-Info-development.plist

cp /Users/coelhotv/git-icloud/meus-remedios/apps/mobile/GoogleService-Info-preview.plist \
   /Users/coelhotv/git-icloud/dosiq/apps/mobile/GoogleService-Info-preview.plist
```

> **Nota:** Se você criou novos projetos Firebase/Google para `com.coelhotv.dosiq`, substitua esses arquivos pelos **novos downloads** do Firebase Console, não pelos arquivos copiados acima.

### 7.3 Atualizar o `.vercel/project.json`

```bash
# No novo diretório dosiq/
cat > .vercel/project.json << 'EOF'
{"projectId":"prj_yQIAbiPJEgZxv4CKGnBrAG6HipPN","orgId":"team_zkyqhzaNOyNUKklyuPi8dPNA","projectName":"dosiq"}
EOF
```

### 7.4 Atualizar o Workspace do VSCode

O arquivo `meus-remedios.code-workspace` na raiz pode ser renomeado:

```bash
mv meus-remedios.code-workspace dosiq.code-workspace
```

Em seguida, abrir o VSCode com `File → Open Workspace from File` apontando para `dosiq.code-workspace` no novo diretório.

### 7.5 Atualizar Aliases de Terminal (zsh/bash)

Se você tiver aliases no `~/.zshrc` ou `~/.bashrc` apontando para o diretório antigo:

```bash
grep -n "meus-remedios\|meus_remedios" ~/.zshrc ~/.bashrc 2>/dev/null
```

Substituir qualquer ocorrência:
```bash
# Antes:
alias mr="cd ~/git-icloud/meus-remedios"

# Depois:
alias dosiq="cd ~/git-icloud/dosiq"
```

### 7.6 Validar o Novo Ambiente

```bash
cd /Users/coelhotv/git-icloud/dosiq

# Lint
npm run lint

# Testes críticos
npm run validate:agent

# Verificação final de resíduos
grep -rn "meus.remedios\|meusremedios\|Meus Rem\|@meus-remedios" \
  --include="*.js" --include="*.jsx" --include="*.json" --include="*.html" --include="*.md" \
  . | grep -v node_modules | grep -v dist/ | grep -v ios/Pods \
    | grep -v "plans/archive_old" | grep -v "plans/dosiq-migration" | grep -v ".bak"
# Resultado esperado: 0 linhas
```

---

## 8. Verificação Final

Checklist completo para confirmar que a migração está 100% concluída:

### Código (já concluído — Fases 1–5)
- [x] NPM packages renomeados para `@dosiq/*`
- [x] app.config.js: `name`, `slug`, `scheme`, `bundleIdentifier`, `androidPackage` atualizados
- [x] Web app: meta tags, manifest.json, títulos atualizados
- [x] Bot Telegram: mensagens e templates atualizados
- [x] Docs e memória DEVFLOW: atualizados

### Supabase
- [ ] Templates de e-mail atualizados (5 templates)
- [ ] Site URL atualizada para `dosiq.vercel.app`
- [ ] Redirect URLs incluem `dosiq.vercel.app` e `dosiq://`
- [ ] Nome do projeto (opcional) atualizado

### Vercel
- [ ] Projeto renomeado para `dosiq`
- [ ] Deploy funcional em `dosiq.vercel.app`
- [ ] `TELEGRAM_BOT_TOKEN` atualizado (se bot foi renomeado)
- [ ] `.vercel/project.json` local atualizado

### Expo EAS
- [ ] Slugs confirmados no painel expo.dev
- [ ] `eas credentials` executado para cada perfil
- [ ] Push notifications vinculadas ao novo bundle ID

### Google Play Console
- [ ] App name atualizado para `Dosiq`
- [ ] Descrições atualizadas
- [ ] Screenshots sem o nome antigo
- [ ] `google-services*.json` baixados para o novo app Firebase (se aplicável)
- [ ] SHA-1/SHA-256 adicionados no Firebase Console

### App Store Connect
- [ ] App name atualizado para `Dosiq`
- [ ] Bundle ID `com.coelhotv.dosiq` registrado no Developer Portal
- [ ] Descrição e keywords atualizadas
- [ ] Screenshots sem o nome antigo
- [ ] `GoogleService-Info*.plist` baixados para o novo app Firebase (se aplicável)
- [ ] Build gerado com `eas build --platform ios --profile production`

### GitHub
- [ ] Repositório renomeado para `dosiq`
- [ ] Remote local atualizado: `git remote set-url origin git@github.com:coelhotv/dosiq.git`
- [ ] Secrets atualizados (se CI/CD em uso)

### Ambiente Local
- [ ] Repositório clonado em `/Users/coelhotv/git-icloud/dosiq`
- [ ] Arquivos sensíveis copiados (`.env`, `google-services*.json`, `GoogleService-Info*.plist`)
- [ ] `.vercel/project.json` com `projectName: "dosiq"`
- [ ] `npm install` executado sem erros
- [ ] `npm run validate:agent` passando
- [ ] Varredura global retornando 0 linhas

---

## Ordem de Execução Recomendada

Para minimizar downtime e evitar erros de auth/redirect:

```
1. Supabase (Redirect URLs — crítico para auth funcionar no novo domínio)
2. Vercel (rename do projeto → gera dosiq.vercel.app)
3. GitHub (rename do repositório)
4. Ambiente local (clonar novo path, atualizar remote)
5. Expo EAS (credenciais e slugs)
6. Google Play Console (listagem + Firebase Android)
7. App Store Connect (listagem + Firebase iOS)
```

---

*Gerado em: 2026-04-21 | Migração de branding: Meus Remédios → Dosiq*
*Código local: Fases 1–5 completas e mergeadas em `main` (commits até `7949a65`)*
