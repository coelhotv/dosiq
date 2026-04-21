# Guia Pratico - Expo.dev e EAS para Android

> **Contexto:** Dosik hybrid/native | Fase 6 Push Native e Beta Interno
> **Data:** 2026-04-14 | **Ultima atualizacao:** 2026-04-18
> **Escopo deste guia:** configurar o projeto no `expo.dev`, validar o setup real do repositório e gerar builds Android para testes e publicação na Google Play

---

## 1. Objetivo

Este guia existe para que o maintainer consiga:

1. conectar o app mobile do projeto ao `expo.dev`
2. usar o `EAS Build` sem improviso
3. gerar builds Android coerentes com os perfis do repositório
4. chegar pronto ao envio para a Google Play

Este guia **não cobre**:

- push nativo fim a fim
- `expo-notifications`
- iOS/App Store Connect

Isso é intencional: até a Fase 5 o MVP não incluía push; a Fase 6 agora completa esta funcionalidade, mas as instruções de build base permanecem as mesmas.

---

## 2. Estado atual do repositório

O app mobile já possui base suficiente para subir no ecossistema Expo:

- `apps/mobile/app.config.js` é o arquivo canônico de configuração
- `apps/mobile/eas.json` já existe
- os perfis de build atuais são `development`, `preview` e `production`
- os identificadores oficiais já estão definidos

### Identidade atual por ambiente

| Perfil | Nome | Slug | Android package |
|---|---|---|---|
| `development` | `Dosik Dev` | `dosik-dev` | `com.coelhotv.dosik.dev` |
| `preview` | `Dosik Preview` | `dosik-preview` | `com.coelhotv.dosik.preview` |
| `production` | `Dosik` | `dosik` | `com.coelhotv.dosik` |

### Leitura correta desses perfis

- `development`: gera um **APK** para uso local/manual com dev client. Não serve para a Play Store.
- `preview`: distribuição interna para testes reais (pode gerar APK ou AAB).
- `production`: gera obrigatoriamente um **Android App Bundle (.aab)**, formato exigido pela Google Play Console para publicação.

---

## 3. Pré-requisitos antes de mexer em qualquer coisa

Antes de abrir o `expo.dev`, confirme estes itens:

- conta Expo criada com o mesmo e-mail que você pretende manter no projeto
- conta Google Play Console já aprovada
- Node e npm funcionando no ambiente local
- acesso ao diretório `apps/mobile`
- variáveis públicas disponíveis para o app mobile

### Variáveis esperadas hoje

O app mobile usa:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV`

### Regra importante

Pacotes compartilhados não devem ler `process.env` diretamente. A leitura pública do ambiente mobile já está centralizada em:

- `apps/mobile/app.config.js`
- `apps/mobile/src/platform/config/nativePublicAppConfig.js`

---

## 4. Passo a passo - primeira conexão com o Expo

### Passo 1 - entrar na pasta correta

```bash
cd "/Users/coelhotv/Library/Mobile Documents/com~apple~CloudDocs/git/meus-remedios/apps/mobile"
```

### Passo 2 - instalar dependências do mobile

Se ainda não instalou no monorepo:

```bash
npm install
```

Se o workspace raiz já está instalado, siga.

### Passo 3 - autenticar no Expo

Use a CLI atual:

```bash
npx eas-cli@latest login
```

Se preferir checar antes:

```bash
npx eas-cli@latest whoami
```

### Passo 4 - vincular este app a um projeto EAS

Como o repositório já tem app configurado, o próximo passo é criar ou linkar o projeto no EAS:

```bash
npx eas-cli@latest init
```

O comportamento esperado:

- a CLI cria ou vincula o projeto no Expo
- um `projectId` é associado ao app
- o `projectId` passa a existir dentro de `expo.extra.eas.projectId`

### Passo 5 - validar se o vínculo ficou correto

```bash
npx eas-cli@latest project:info
```

Você deve ver um projeto com nome coerente com `Dosik` e ligado ao diretório `apps/mobile`.

### Passo 6 - revisar o `app.config.js`

Depois do `init`, abra e confira:

- `name`
- `slug`
- `scheme`
- `android.package`
- `version`
- `android.versionCode`
- `extra.eas.projectId`

### Resultado esperado desta etapa

Ao final, o projeto deve estar visível no dashboard do `expo.dev` e o app local deve estar oficialmente ligado a ele.

---

## 5. Passo a passo - organizar ambientes no Expo/EAS

### Objetivo

Evitar o erro clássico de primeiro app mobile: buildar o app certo com ambiente errado.

### Passo 1 - criar variáveis por ambiente no Expo

No dashboard do Expo, cadastre variáveis coerentes com os três perfis:

- `development`
- `preview`
- `production`

Para este projeto, comece com:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV`

### Sugestão prática

No dashboard do Expo, você deve criar as variáveis e associá-las aos **Environments** específicos. Garanta que:

- `development` (Environment) -> `EXPO_PUBLIC_APP_ENV = development`
- `preview` (Environment) -> `EXPO_PUBLIC_APP_ENV = preview`
- `production` (Environment) -> `EXPO_PUBLIC_APP_ENV = production`

### Passo 2 - Documentar o mapeamento no eas.json

Para garantir que o `app.config.js` detecte o perfil corretamente, o `eas.json` deve injetar explicitamente a variável `EAS_BUILD_PROFILE`:

```json
"production": {
  "autoIncrement": true,
  "env": {
    "EAS_BUILD_PROFILE": "production"
  }
}
```

Registre internamente:

- se `preview` usa o mesmo Supabase do `production` ou um projeto separado
- quem tem permissão para alterar variáveis
- qual perfil é permitido para testes com usuários externos

### Recomendação para MVP

Se você ainda está no primeiro ciclo de publicação, mantenha:

- `development`: ambiente livre para desenvolvimento
- `preview`: staging para QA e closed testing
- `production`: produção real

---

## 6. Passo a passo - gerar builds Android

## 6.1. Build de desenvolvimento

Use quando quiser um dev client próprio.

```bash
npx eas-cli@latest build --platform android --profile development
```

Esse perfil gera build de distribuição interna com `developmentClient`.

Use quando:

- precisar testar no aparelho
- quiser depurar com mais controle do que o Expo Go

## 6.2. Build de preview

Use para QA, validação de fluxo e distribuição interna.

```bash
npx eas-cli@latest build --platform android --profile preview
```

Use quando:

- quiser entregar APK/AAB interno para testers
- estiver validando antes de subir algo na Play Console

### O que esperar no emulador

Ao final do build, a CLI pode oferecer instalar e abrir o app no emulador. Se você responder que sim, o `Dosik Preview` abre como um app Android normal.

Importante:

- isso não transforma o app em `development build`
- isso não garante que `npx expo start` vai reencontrá-lo depois
- o `preview build` deve ser tratado como build de QA e validação, não como cliente de desenvolvimento

## 6.3. Build de produção

Use para Google Play.

```bash
npx eas-cli@latest build --platform android --profile production
```

### O que esperar

- build Android para distribuição (.aab)
- `versionCode` derivado da versão em `app.config.js` (modo `local` — não há incremento automático)
- artefato pronto para upload na Google Play Console

### Regra simples

Para Play Store, pense assim:

- `preview` = testar
- `production` = publicar

---

## 7. Sequência operacional recomendada para este projeto

Se eu estivesse configurando do zero hoje, seguiria exatamente esta ordem:

1. `eas login`
2. `eas init`
3. validar `project:info`
4. cadastrar env vars no Expo
5. rodar build `preview`
6. instalar e validar no Android físico
7. corrigir problemas de runtime
8. rodar build `production`
9. subir `.aab` na Play Console em teste interno
10. só depois preparar release aberta/produção

---

## 8. Como reabrir o app depois que o emulador foi fechado

Se você gerou um `preview build`, abriu no emulador, fechou tudo e depois quis voltar ao app, use esta lógica:

### Cenário 1 - o app ainda está instalado

1. abra o Android Emulator
2. espere o Android iniciar
3. procure o app `Dosik Preview`
4. toque no ícone para abrir

Nesse caso, você não precisa rodar novo build.

### Cenário 2 - você quer abrir o emulador via terminal

Se o Android SDK estiver configurado:

```bash
emulator -list-avds
emulator -avd NOME_DO_SEU_AVD
```

Depois disso, abra o app manualmente no launcher do Android.

### Cenário 3 - o app sumiu ou não está instalado

Se o emulador foi recriado ou o app foi removido:

- reinstale o build preview
- ou gere um novo build preview

### Regra prática

Pense assim:

- `preview build` = app empacotado para QA
- `development build` = app cliente para trabalhar com bundler

---

## 9. Checklist de validação antes do primeiro build de produção

- `app.config.js` com `android.package = com.coelhotv.dosik`
- `version = APP_VERSION` definido em `app.config.js` com a fórmula semântica (ver secção 6.4)
- `android.versionCode = VERSION_CODE` derivado automaticamente — nunca editar manualmente
- `icon.png` aceitável para loja e launcher
- login funcionando
- tela Hoje funcionando
- registrar dose funcionando
- tratamentos funcionando
- estoque funcionando
- perfil/settings funcionando
- vínculo Telegram definido ou conscientemente adiado

---

## 10. Como decidir quando usar Expo Go, dev build e build de loja

### Expo Go

Use só para exploração rápida, se o fluxo atual do app permitir.

### Development build

Use para desenvolvimento real do app.

Esse é o modo certo quando você quer:

- abrir o app e conectar no bundler
- usar `npx expo start`
- iterar localmente com fluxo de desenvolvimento

Comando mais comum:

```bash
npx eas-cli@latest build --platform android --profile development
```

### Preview build

Use para QA, stakeholders e teste funcional em aparelho.

Esse não é o caminho ideal quando você quer hot reload ou reconexão automática pelo `expo start`.

### Production build

Use somente quando:

- o fluxo principal está estável
- você já validou no mínimo login, dashboard, dose, tratamentos e estoque

---

## 11. Por que o `expo start` não reencontra um preview build

Se você rodou:

```bash
npx eas-cli@latest build --platform android --profile preview
```

e depois tentou usar:

```bash
npx expo start
```

é esperado que a conexão com “development build” não funcione automaticamente.

### Motivo

O `preview build` é pensado para:

- QA
- distribuição interna
- validação próxima de release

Já o `development build` é pensado para:

- fluxo de desenvolvimento
- conexão com bundler
- iteração contínua

### Resumo simples

- quer QA: `preview`
- quer desenvolver com bundler: `development`

---

## 12. Problemas comuns no primeiro setup

## 12.1. Projeto não aparece corretamente no Expo

Causa provável:

- `eas init` não foi concluído
- diretório errado ao rodar a CLI

Correção:

- volte para `apps/mobile`
- rode `npx eas-cli@latest init`
- confirme com `project:info`

## 12.2. `eas init` falha porque o projeto usa `app.config.js` dinâmico

Causa provável:

- a EAS criou o projeto remoto
- mas não conseguiu escrever automaticamente no `app.config.js`

Correção:

- adicionar manualmente `expo.extra.eas.projectId`
- adicionar manualmente `expo.owner`

Formato esperado neste projeto:

```js
expo: {
  owner: 'coelhotv',
  extra: {
    eas: {
      projectId: 'SEU_PROJECT_ID',
    },
  },
}
```

Depois validar com:

```bash
npx eas-cli@latest project:info
```

## 12.3. Build sobe com identidade errada

Causa provável:

- `EAS_BUILD_PROFILE` incorreto
- confusão entre `preview` e `production`

Correção:

- sempre explicitar `--profile`
- conferir nome/slug/package antes da build

## 12.4. Build conecta no backend errado

Causa provável:

- variáveis públicas não configuradas por ambiente

Correção:

- revisar env vars no Expo
- confirmar `EXPO_PUBLIC_APP_ENV`

## 12.5. `expo start` não encontra o app depois de um build preview

Causa provável:

- o app instalado é `preview`, não `development build`

Correção:

- reabrir o app manualmente no emulador
- ou gerar um build `development` se a intenção for trabalhar com bundler

Comando recomendado para desenvolvimento:

```bash
npx eas-cli@latest build --platform android --profile development
```

## 12.6. Não sei mais como abrir o app no emulador depois que fechei tudo

Correção:

1. abrir o emulador novamente
2. procurar `Dosik Preview` ou `Dosik Dev`
3. abrir manualmente pelo launcher

Se quiser abrir o emulador por terminal:

```bash
emulator -list-avds
emulator -avd NOME_DO_SEU_AVD
```

## 12.7. Warning: "cli.appVersionSource is not set"

Causa provável:
- O EAS exige que você defina se a versão é controlada localmente ou remotamente para evitar conflitos em builds de CI.

**Estratégia adoptada neste projecto:** `"local"` — o `versionCode` é gerido manualmente no `app.config.js` usando uma fórmula derivada da versão semântica (ver secção 6.4).

Correção:
- No `app.config.js`, adicione o bloco `cli`:
```js
module.exports = {
  expo: {
    version: APP_VERSION,
    cli: {
      appVersionSource: 'local',
    },
    // ...
  }
}
```

> **Não use `"remote"` neste projecto** — escolhemos `"local"` para ter controlo explícito sobre o `versionCode` e evitar inconsistências entre builds locais e builds EAS na nuvem.

## 12.9. App sobe com nome ou Package Name de "Dev" em perfil de Produção

Causa provável:
- O `app.config.js` falhou ao detectar o perfil e caiu no fallback `development`.

Correção:
- Verifique se o `eas.json` possui o bloco `env` com `EAS_BUILD_PROFILE` para o perfil em questão.
- Verifique se você não tem um arquivo `.env` local sobrescrevendo essas variáveis durante o disparo do build.

## 12.10. Watchman ou fluxo local ficam instáveis porque o repositório está no iCloud Drive

Causa provável:
- O iCloud Drive pode tentar sincronizar arquivos enquanto o Watchman está tentando ler, causando conflitos de permissão ou CPU.

Correção:
- Idealmente, mova o projeto para fora do iCloud (ex: `~/Developer/`).
- Se precisar manter no iCloud, use o comando `git push` manualmente e evite sincronização automática durante builds pesados.

## 6.4. Gestão de versão para uploads no Play Console

O Google Play Console exige que cada upload tenha um `versionCode` inteiro **estritamente crescente**. Neste projecto, o `versionCode` é derivado automaticamente da versão semântica:

```js
// app.config.js
const APP_VERSION = '0.2.3'
const [major, minor, patch] = APP_VERSION.split('.').map(Number)
const VERSION_CODE = major * 10000 + minor * 100 + patch
// 0.2.3 → 203 | 0.2.4 → 204 | 0.3.0 → 300 | 1.0.0 → 10000

module.exports = {
  expo: {
    version: APP_VERSION,
    android: {
      versionCode: VERSION_CODE,
    }
  }
}
```

**Regra:** para cada novo upload ao Play Console, incremente `APP_VERSION` em `app.config.js`. Tudo o resto (versionCode, versionName) deriva automaticamente.

### Histórico de versões lançadas

| Versão | versionCode | Data | Notas |
|--------|-------------|------|-------|
| 0.1.0  | 1           | 2026-04-15 | Primeiro build EAS (modo remoto antigo) |
| 0.1.0  | 2           | 2026-04-15 | Build production EAS (modo remoto antigo) |
| 0.2.3  | 203         | 2026-04-18 | Firebase Analytics — primeiro build local |

---

## 13. Credenciais Firebase e EAS Build Local ⚠️

**CRÍTICO:** O EAS comprime o projeto via `git archive`, que exclui arquivos do `.gitignore`. Como `google-services-*.json` está no `.gitignore` (por segurança), os builds locais falham a menos que você use uma estratégia de **environment variables com path absoluto**.

### 13.1. Problema & Solução

**Sintoma:** Build falha com `ENOENT: Cannot copy google-services.json from ./apps/mobile/google-services-preview.json`

**Causa:** O arquivo não existe no diretório temporário de build porque foi excluído do tar.gz via git archive.

**Solução:** Modificar `app.config.js` para usar `GOOGLE_SERVICES_JSON_PATH` com path absoluto:

```javascript
// app.config.js
  googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH || `./google-services-${BUILD_PROFILE}.json`,
},
ios: {
  bundleIdentifier: current.iosBundleIdentifier,
  googleServicesFile: process.env.GOOGLE_SERVICES_PLIST_PATH || `./GoogleService-Info-${BUILD_PROFILE}.plist`,
}
```

### 13.2. Script Wrapper: `build-android.sh` (e iOS)

Crie `apps/mobile/build-android.sh` (que também servirá de base para iOS):

```bash
#!/bin/bash
# Prepara credenciais Firebase e roda eas build local
# Uso: bash build-android.sh [preview|development|production]

PROFILE="${1:-preview}"
ICLOUD_MOBILE="/Users/coelhotv/git-icloud/meus-remedios/apps/mobile"

# production usa google-services.json (sem sufixo), demais usam google-services-{profile}.json
if [ "$PROFILE" = "production" ]; then
  CREDS_FILE="$ICLOUD_MOBILE/google-services.json"
else
  CREDS_FILE="$ICLOUD_MOBILE/google-services-${PROFILE}.json"
fi

if [ ! -f "$CREDS_FILE" ]; then
  echo "❌ Credencial não encontrada: $CREDS_FILE"
  echo "   Baixe o google-services.json do Firebase Console e salve nesse path."
  exit 1
fi

echo "🔐 Exportando credencial Firebase: $CREDS_FILE"
export GOOGLE_SERVICES_JSON_PATH="$CREDS_FILE"

echo "🚀 Iniciando build ($PROFILE)..."
eas build --local --platform android --profile "$PROFILE"
```

**Tornar executável:**
```bash
chmod +x apps/mobile/build-android.sh
```

### 13.3. Operacionalizar Builds

**Build de Preview (APK para testes):**
```bash
cd apps/mobile
bash build-android.sh preview
```

**Build de Desenvolvimento (Dev Client):**
```bash
bash build-android.sh development
```

**Build de Produção (AAB para Play Store):**
```bash
bash build-android.sh production
```

---

## 14. Build Local (Fugindo da Fila) ⚡️

Se você não quer esperar os 100+ minutos na fila da Expo (Free Tier) ou ultrapassar o limite de 30 builds por mês, você pode construir o binário usando o seu próprio processador M2.

### 14.1. Pré-requisitos
- **Java JDK 17** (Zulu ou OpenJDK).
- **Android Studio** instalado.
- **Xcode 26+ (Mac)**: Instale o iOS Simulator Runtime correspondente via Xcode > Settings > Platforms se planeja testar iOS também.
- **Variáveis de Ambiente**:
  Certifique-se que o seu terminal enxerga as ferramentas do Android. Adicione ao seu `~/.zshrc` ou `~/.bashrc`:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  ```

### 14.2. Arquivos de Credencial Obrigatórios

Antes de rodar qualquer build, garanta que os arquivos Firebase existem em `apps/mobile/`:

- ✅ `google-services-development.json` (para perfil development)
- ✅ `google-services-preview.json` (para perfil preview)
- ✅ `google-services.json` (para perfil production — download do Firebase Console do app `com.coelhotv.dosik`)

**Nunca commitar esses arquivos** — eles estão corretamente no `.gitignore`.

### 14.3. Onde os Arquivos Aparecem?

Ao contrário da nuvem, o build local deixará o arquivo final (`.apk` ou `.aab`) em um diretório dentro de `apps/mobile` ou referenciado no console do EAS Build.

### 14.4. Status de Validação
- **Ambiente Validado**: Mac M2 (Sequoia) com Xcode 26.3 usando Bash. ✅
- **Resultado Estável**: Build de preview gerado localmente em ~5-10 min com script wrapper `build-android.sh`. ✅
- **Firebase**: Credenciais passadas via `GOOGLE_SERVICES_JSON_PATH` (Android) e `GOOGLE_SERVICES_PLIST_PATH` (iOS) funcionam corretamente. ✅
- **Expo 53 Fix**: O plugin local `withFirebaseFix.js` é obrigatório para inicializar o Firebase no `AppDelegate.swift` e resolver conflitos de modular headers no iOS. ✅

## 14.5. Problemas Específicos do iOS no Expo 53

Ao rodar `npx expo prebuild` para iOS no SDK 53, o plugin oficial do Firebase pode avisar que não encontrou o ponto de inserção. O projeto utiliza um plugin customizado (`withFirebaseFix.js`) para contornar isso.

Sintoma de falha (sem o fix):
`» ios: @react-native-firebase/app: Unable to determine correct Firebase insertion point in AppDelegate.swift.`

Solução integrada:
O arquivo `app.config.js` já carrega `./withFirebaseFix.js` que automatiza a correção no `AppDelegate.swift` e no `Podfile`.

## 12.8. Tentação de configurar push agora

Não faça isso nesta fase.

Pelo recorte da Fase 5:

- não é hora de `expo-notifications`
- não é hora de registrar token Expo
- não é hora de dispatcher multicanal

Isso entra na Fase 6.

---

## 15. FAQ rápido

### Posso usar `preview build` como se fosse `development build`?

Não. O `preview` serve para QA e validação de release. Para `expo start`, prefira `development`.

### Preciso rodar `eas init` de novo toda vez?

Não. Depois que `owner` e `projectId` estão corretos e `project:info` funciona, essa etapa já acabou.

### Se o app já foi instalado no emulador, preciso gerar novo build para abrir de novo?

Não. Basta reabrir o emulador e tocar no app, desde que ele ainda esteja instalado.

### Qual build eu uso para testar antes da Play Console?

`preview`

### Qual build eu uso para publicar?

`production`

### Qual build eu uso para trabalhar com bundler e desenvolvimento contínuo?

`development`

---

## 16. Definição prática de pronto para avançar

Considere o setup Expo/EAS pronto quando estes 6 critérios estiverem verdes:

1. projeto visível no `expo.dev`
2. `projectId` persistido no app
3. build `preview` concluída via script `build-android.sh preview`
4. app instalado e testado em Android real (APK funciona)
5. build `production` concluída via script `build-android.sh production` sem erro
6. `.aab` pronta para upload na Google Play Console

---

## 17. Próximo passo depois deste guia

Depois de concluir este guia, siga imediatamente para:

- `plans/backlog-native_app/GUIA_GOOGLE_PLAY_CONSOLE_MVP_ANDROID.md`

E, antes de publicar a ficha da loja:

- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`
