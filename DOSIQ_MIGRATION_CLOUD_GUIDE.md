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

> Mantenha as URLs antigas (`dosiq.vercel.app`) durante o período de transição para não quebrar sessões ativas. Remova-as somente após confirmar que o domínio novo está funcional.

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

> Após renomear, o domínio automático muda de `dosiq.vercel.app` para `dosiq.vercel.app`. Confirme que o deploy está funcional antes de continuar.

### 2.2 Atualizar Variáveis de Ambiente

`Project → Settings → Environment Variables`

Verificar e atualizar as variáveis relacionadas ao branding:

| Variável | Valor atual | Valor novo |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | token do `meus_remedios_bot` | token do `dosiq_bot` |
| `NEXT_PUBLIC_APP_URL` (se existir) | `https://dosiq.vercel.app` | `https://dosiq.vercel.app` |
| `VITE_APP_URL` (se existir) | `https://dosiq.vercel.app` | `https://dosiq.vercel.app` |

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

### 3.2 EAS Project ID (novo projeto criado no expo.dev)

Um novo projeto foi criado no expo.dev para ter o slug correto (`dosiq-app`), gerando um **novo Project ID**: `7d1f6cb7-2fdd-4a5e-9ad3-e3ec56417bba`.

O campo `extra.eas.projectId` em `apps/mobile/app.config.js` (linha 90) ainda aponta para o ID antigo. Após clonar o novo repositório, vincule ao projeto novo com:

```bash
# 1. Instalar o EAS CLI globalmente (se ainda não tiver)
npm install --global eas-cli

# 2. Navegar até o subpacote mobile — IMPORTANTE: rodar dentro de apps/mobile/, não na raiz
cd /Users/coelhotv/git-icloud/dosiq/apps/mobile

# 3. Fazer login (se necessário)
eas login

# 4. Vincular ao novo projeto — atualiza automaticamente o projectId em app.config.js
eas init --id 7d1f6cb7-2fdd-4a5e-9ad3-e3ec56417bba
```

O `eas init --id` faz exatamente uma coisa: atualiza o campo `extra.eas.projectId` no `app.config.js` para o novo ID. Após esse comando, commite a alteração:

```bash
# De volta à raiz do repo
cd /Users/coelhotv/git-icloud/dosiq
git add apps/mobile/app.config.js
git commit -m "chore(mobile): vincular ao novo projeto EAS dosiq (7d1f6cb7)"
git push
```

> **O que muda e o que não muda:**
> - ✅ `extra.eas.projectId` → atualizado pelo `eas init`
> - ✅ Painel expo.dev → builds e updates passam a aparecer no projeto `dosiq-app`
> - ❌ `eas.json` → não precisa alterar (sem referência ao Project ID)
> - ❌ Bundle IDs iOS/Android → não mudam (já são `com.coelhotv.dosiq` desde a Fase 2)

### 3.3 Credenciais (Keystore Android + Provisioning iOS)

Execute localmente **após** o `eas init` acima:

```bash
cd /Users/coelhotv/git-icloud/dosiq/apps/mobile
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

O projeto Firebase precisa de **2 apps Android** (não 3 — preview compartilha as credenciais de development):

| App Firebase | Package name | Arquivo gerado |
|---|---|---|
| Dosiq (production) | `com.coelhotv.dosiq` | `google-services.json` |
| Dosiq Dev | `com.coelhotv.dosiq.dev` | `google-services-development.json` |

> `google-services-preview.json` **não existe mais** — o `build-android.sh` foi atualizado para usar `google-services-development.json` tanto para `development` quanto para `preview`.

**Passos:**

1. No Firebase Console, criar os 2 apps Android acima (se ainda não existirem)
2. Baixar cada `google-services.json` e renomear conforme a tabela
3. Salvar em `$ICLOUD_MOBILE/` (caminho lido pelo `build-android.sh`)
4. Adicionar SHA-1 e SHA-256 de **cada perfil** no app Firebase correspondente:

```bash
# SHA do keystore de produção
eas credentials --platform android --profile production

# SHA do keystore de development (usado também pelo preview)
eas credentials --platform android --profile development
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

### 5.2 Registrar os Bundle IDs no Apple Developer Portal

> URL: [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers)

Registrar **2 App IDs** (não 3 — preview usa o mesmo bundle ID de development):

| App ID | Bundle ID | Uso |
|---|---|---|
| Dosiq | `com.coelhotv.dosiq` | Production (App Store) |
| Dosiq Dev | `com.coelhotv.dosiq.dev` | Development + Preview (TestFlight / instalação direta) |

Para cada um: `Identifiers → (+) → App IDs → App`, preencher Description e Bundle ID (Explicit), habilitar as capabilities necessárias (Push Notifications, Associated Domains, etc.) e registrar.

**Firebase iOS:** Criar os mesmos 2 apps no Firebase Console e baixar os plists:

| App Firebase | Bundle ID | Arquivo |
|---|---|---|
| Dosiq (production) | `com.coelhotv.dosiq` | `GoogleService-Info.plist` |
| Dosiq Dev | `com.coelhotv.dosiq.dev` | `GoogleService-Info-development.plist` |

> `GoogleService-Info-preview.plist` não é mais necessário — preview usa `GoogleService-Info-development.plist`.

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

O projeto usa um bare repo local em iCloud como `.git` físico, mais dois working trees. A ordem de operações importa:

#### Passo 1 — Renomear o bare repo

```bash
mv "/Users/coelhotv/Library/Mobile Documents/com~apple~CloudDocs/git_server/meus-remedios.git" \
   "/Users/coelhotv/Library/Mobile Documents/com~apple~CloudDocs/git_server/dosiq.git"
```

#### Passo 2 — Atualizar o remote GitHub dentro do bare repo

```bash
cd "/Users/coelhotv/Library/Mobile Documents/com~apple~CloudDocs/git_server/dosiq.git"
git remote set-url origin git@github.com:coelhotv/dosiq.git
git remote -v   # confirmar
```

#### Passo 3 — Atualizar o ponteiro `.git` em cada working tree

Cada working directory tem um arquivo `.git` (não pasta) com o caminho absoluto para o bare repo. Verificar e corrigir em ambos:

```bash
# iCloud working tree
cat "/Users/coelhotv/git-icloud/meus-remedios/.git"
# Deve conter algo como: gitdir: /Users/coelhotv/Library/Mobile Documents/.../meus-remedios.git

# Atualizar para o novo caminho
echo "gitdir: /Users/coelhotv/Library/Mobile Documents/com~apple~CloudDocs/git_server/dosiq.git" \
  > "/Users/coelhotv/git-icloud/meus-remedios/.git"

# Bridge local working tree
cat "/Users/coelhotv/local-git/meus-remedios/.git"
# Mesmo processo:
echo "gitdir: /Users/coelhotv/Library/Mobile Documents/com~apple~CloudDocs/git_server/dosiq.git" \
  > "/Users/coelhotv/local-git/meus-remedios/.git"
```

#### Passo 4 — Verificar que tudo funciona

```bash
# Testar em cada working tree
cd /Users/coelhotv/git-icloud/meus-remedios
git status        # deve funcionar normalmente
git remote -v     # deve mostrar github.com/coelhotv/dosiq

cd /Users/coelhotv/local-git/meus-remedios
git status
git remote -v
```

> **Sobre o rename das pastas de trabalho (`meus-remedios` → `dosiq`):** não é obrigatório — git não depende do nome da pasta. Renomeie se quiser consistência visual, mas atualize aliases de terminal e o workspace do VSCode depois.

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

> A abordagem aqui é **clone novo** em pastas novas — não renomear as existentes.
> Isso garante um ambiente limpo e mantém o repo antigo intacto como fallback durante a transição.

### 7.1 Clonar nos Dois Diretórios

```bash
# iCloud (sync / fonte canônica)
git clone git@github.com:coelhotv/dosiq.git /Users/coelhotv/git-icloud/dosiq

# Bridge local fora do iCloud (builds e desenvolvimento)
git clone git@github.com:coelhotv/dosiq.git /Users/coelhotv/local-git/dosiq
```

> **Sobre o bare repo em iCloud (`git_server/`):** o clone normal cria um `.git` folder padrão — sem vínculo com o bare repo antigo. Se quiser recriar o mesmo padrão de gitdir separado para o novo repo, faça um `git clone --bare` para `git_server/dosiq.git` e reconfigure os working trees manualmente. Para um setup mais simples, os clones normais acima são suficientes.

### 7.2 Instalar Dependências

```bash
cd /Users/coelhotv/git-icloud/dosiq && npm install
cd /Users/coelhotv/local-git/dosiq && npm install
```

### 7.3 Copiar Arquivos Não Versionados

Os arquivos abaixo estão no `.gitignore` e **não existem no clone novo**. Todos precisam ser copiados ou recriados manualmente.

#### Variáveis de ambiente — raiz

```bash
OLD=/Users/coelhotv/git-icloud/meus-remedios
NEW=/Users/coelhotv/git-icloud/dosiq

cp "$OLD/.env"       "$NEW/.env"
cp "$OLD/.env.local" "$NEW/.env.local" 2>/dev/null || true
```

#### Variáveis de ambiente — web

```bash
cp "$OLD/apps/web/.env"       "$NEW/apps/web/.env"       2>/dev/null || true
cp "$OLD/apps/web/.env.local" "$NEW/apps/web/.env.local" 2>/dev/null || true
```

#### Variáveis de ambiente — mobile

```bash
cp "$OLD/apps/mobile/.env.development" "$NEW/apps/mobile/.env.development" 2>/dev/null || true
cp "$OLD/apps/mobile/.env.preview"     "$NEW/apps/mobile/.env.preview"     2>/dev/null || true
```

> Revisar os valores após copiar — algumas variáveis podem conter URLs ou nomes com `meus-remedios` que precisam ser atualizados para `dosiq`.

#### Firebase Android (2 arquivos — baixar do novo Firebase Console)

```bash
# Estes devem ser os downloads do projeto Firebase novo (com.coelhotv.dosiq)
# NÃO copiar do repo antigo — os arquivos antigos referenciam com.coelhotv.meusremedios
cp "$ICLOUD_MOBILE/google-services.json" \
   "$NEW/apps/mobile/google-services.json"

cp "$ICLOUD_MOBILE/google-services-development.json" \
   "$NEW/apps/mobile/google-services-development.json"

# google-services-preview.json não existe mais — preview usa o arquivo de development
```

#### Firebase iOS (2 arquivos — baixar do novo Firebase Console)

```bash
cp "$ICLOUD_MOBILE/GoogleService-Info.plist" \
   "$NEW/apps/mobile/GoogleService-Info.plist"

cp "$ICLOUD_MOBILE/GoogleService-Info-development.plist" \
   "$NEW/apps/mobile/GoogleService-Info-development.plist"

# GoogleService-Info-preview.plist não existe mais — preview usa o arquivo de development
```

> O arquivo `apps/mobile/ios/MeusRemediosDev/GoogleService-Info.plist` dentro do diretório `ios/` é gerado pelo EAS durante o build — não precisa ser copiado manualmente.

#### `.vercel/project.json`

O diretório `.vercel/` é ignorado pelo git. Recriar no novo clone:

```bash
mkdir -p "$NEW/.vercel"
cat > "$NEW/.vercel/project.json" << 'EOF'
{"projectId":"prj_yQIAbiPJEgZxv4CKGnBrAG6HipPN","orgId":"team_zkyqhzaNOyNUKklyuPi8dPNA","projectName":"dosiq"}
EOF
```

#### `.agent/sessions/` (estado DEVFLOW da sessão atual)

```bash
# Opcional — copiar apenas se quiser preservar o histórico de eventos da sessão atual
cp "$OLD/.agent/sessions/events.jsonl" "$NEW/.agent/sessions/events.jsonl" 2>/dev/null || true
```

### 7.4 Vincular ao Novo Projeto EAS

```bash
cd /Users/coelhotv/git-icloud/dosiq/apps/mobile
eas init --id 7d1f6cb7-2fdd-4a5e-9ad3-e3ec56417bba
git add app.config.js
git commit -m "chore(mobile): vincular ao novo projeto EAS dosiq (7d1f6cb7)"
git push
```

### 7.5 Abrir o Workspace no VSCode

```bash
# O arquivo já existe no novo clone com o nome atualizado
code /Users/coelhotv/git-icloud/dosiq/dosiq.code-workspace
```

### 7.6 Atualizar Aliases de Terminal (zsh/bash)

```bash
grep -n "meus-remedios\|meus_remedios" ~/.zshrc ~/.bashrc 2>/dev/null
```

Atualizar qualquer alias encontrado:

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
- [x] Templates de e-mail atualizados (5 templates)
- [x] Site URL atualizada para `dosiq.vercel.app`
- [x] Redirect URLs incluem `dosiq.vercel.app` e `dosiq://`
- [x] Nome do projeto (opcional) atualizado

### Vercel
- [x] Projeto renomeado para `dosiq`
- [x] Deploy funcional em `dosiq.vercel.app`
- [x] `TELEGRAM_BOT_TOKEN` atualizado (se bot foi renomeado)
- [x] `.vercel/project.json` local atualizado

### Expo EAS
- [x] Slugs confirmados no painel expo.dev
- [ ] `eas credentials` executado para cada perfil
- [ ] Push notifications vinculadas ao novo bundle ID

### Google Play Console
- [x] App `com.coelhotv.dosiq` criado (1 app apenas — dev/preview não vão à loja)
- [ ] App name, descrições e screenshots atualizados
- [x] Firebase Android: 2 apps criados (`com.coelhotv.dosiq` + `com.coelhotv.dosiq.dev`)
- [x] `google-services.json` e `google-services-development.json` baixados e salvos em `$ICLOUD_MOBILE/`
- [ ] SHA-1/SHA-256 adicionados no Firebase para cada app

### App Store Connect
- [x] App `com.coelhotv.dosiq` criado (1 app apenas — dev/preview via TestFlight/instalação direta)
- [x] Bundle IDs registrados no Developer Portal: `com.coelhotv.dosiq` + `com.coelhotv.dosiq.dev`
- [x] Firebase iOS: 2 apps criados (`com.coelhotv.dosiq` + `com.coelhotv.dosiq.dev`)
- [x] `GoogleService-Info.plist` e `GoogleService-Info-development.plist` baixados e salvos em `$ICLOUD_MOBILE/`
- [ ] Descrição e keywords atualizadas
- [ ] Build gerado com `eas build --platform ios --profile production`

### GitHub
- [ ] Repositório renomeado para `dosiq`
- [ ] Remote local atualizado: `git remote set-url origin git@github.com:coelhotv/dosiq.git`
- [ ] Secrets atualizados (se CI/CD em uso)

### Ambiente Local
- [ ] Repositório clonado em `/Users/coelhotv/git-icloud/dosiq`
- [ ] Arquivos Firebase baixados do console novo e salvos em `$ICLOUD_MOBILE/` (2 Android + 2 iOS)
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
