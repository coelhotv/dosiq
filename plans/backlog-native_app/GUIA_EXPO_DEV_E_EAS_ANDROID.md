# Guia Pratico - Expo.dev e EAS para Android

> **Contexto:** Meus Remedios hybrid/native | Fase 5 MVP de produto
> **Data:** 2026-04-14
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

Isso é intencional: pela `EXEC_SPEC_HIBRIDO_FASE5_MVP_PRODUTO.md`, o MVP da Fase 5 ainda não inclui push nativo operacional.

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
| `development` | `Meus Remedios Dev` | `meus-remedios-dev` | `com.coelhotv.meusremedios.dev` |
| `preview` | `Meus Remedios Preview` | `meus-remedios-preview` | `com.coelhotv.meusremedios.preview` |
| `production` | `Meus Remedios` | `meus-remedios` | `com.coelhotv.meusremedios` |

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

Você deve ver um projeto com nome coerente com `Meus Remedios` e ligado ao diretório `apps/mobile`.

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

Ao final do build, a CLI pode oferecer instalar e abrir o app no emulador. Se você responder que sim, o `Meus Remedios Preview` abre como um app Android normal.

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
- incremento automático de versão no perfil `production` (via EAS Remote)
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
3. procure o app `Meus Remedios Preview`
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

- `app.config.js` com `android.package = com.coelhotv.meusremedios`
- `version = 0.1.0` coerente com o estágio MVP Preview
- `android.versionCode` pronto para começar em `1`
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
2. procurar `Meus Remedios Preview` ou `Meus Remedios Dev`
3. abrir manualmente pelo launcher

Se quiser abrir o emulador por terminal:

```bash
emulator -list-avds
emulator -avd NOME_DO_SEU_AVD
```

## 12.7. Warning: "cli.appVersionSource is not set"

Causa provável:
- O EAS agora exige que você defina se a versão é controlada localmente ou remotamente para evitar conflitos em builds de CI.

Correção:
- No `eas.json`, adicione o bloco no topo:
```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": { ... }
}
```

## 12.9. App sobe com nome ou Package Name de "Dev" em perfil de Produção

Causa provável:
- O `app.config.js` falhou ao detectar o perfil e caiu no fallback `development`.

Correção:
- Verifique se o `eas.json` possui o bloco `env` com `EAS_BUILD_PROFILE` para o perfil em questão.
- Verifique se você não tem um arquivo `.env` local sobrescrevendo essas variáveis durante o disparo do build.

## 12.10. Watchman ou fluxo local ficam instáveis porque o repositório está no iCloud Drive

Causa provável:

- o projeto está em `~/Library/Mobile Documents/...`
- esse caminho costuma gerar problemas com Watchman e tooling React Native/Expo

Correção:

- preferir EAS Build quando possível
- se o fluxo local ficar instável, considerar uma cópia de trabalho fora do iCloud para desenvolvimento mobile

## 12.8. Tentação de configurar push agora

Não faça isso nesta fase.

Pelo recorte da Fase 5:

- não é hora de `expo-notifications`
- não é hora de registrar token Expo
- não é hora de dispatcher multicanal

Isso entra na Fase 6.

---

## 13. FAQ rápido

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

## 14. Definição prática de pronto para avançar

Considere o setup Expo/EAS pronto quando estes 6 critérios estiverem verdes:

1. projeto visível no `expo.dev`
2. `projectId` persistido no app
3. build `preview` concluída
4. app instalado e testado em Android real
5. build `production` concluída sem erro
6. `.aab` pronta para upload na Google Play Console

---

## 15. Próximo passo depois deste guia

Depois de concluir este guia, siga imediatamente para:

- `plans/backlog-native_app/GUIA_GOOGLE_PLAY_CONSOLE_MVP_ANDROID.md`

E, antes de publicar a ficha da loja:

- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`
