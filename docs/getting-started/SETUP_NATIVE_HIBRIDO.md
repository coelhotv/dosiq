# Meus Remedios - Guia de Setup Local para Desenvolvimento Native Hibrido

> **Status:** Guia operacional local
> **Data:** 2026-03-30
> **Publico-alvo:** maintainer do projeto e agentes/coders que vao trabalhar na frente native
> **Base arquitetural:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`

---

## 1. Objetivo

Este guia explica como preparar seu ambiente local para desenvolver e testar a futura versao native/hibrida do Meus Remedios.

Ele foi escrito para o seu contexto real:

- **hardware:** Mac mini M2
- **RAM:** 16 GB
- **IDE:** VS Code
- **stack atual:** Node + React + Vite + Supabase

A ideia e sair de um ambiente bom para web-only e chegar a um ambiente pronto para:

- continuar desenvolvendo a web
- subir o app Expo localmente
- testar iOS Simulator
- testar Android Emulator
- validar login, sessao, navegacao e, depois, push native

---

## 2. O que muda em relacao ao setup atual

Para a app web atual, voce ja precisava basicamente de:

- Node
- npm
- navegador
- VS Code

Para a frente native/hibrida, voce vai passar a precisar tambem de:

- Xcode
- iOS Simulator
- Android Studio
- Android SDK + emulator
- Watchman
- JDK 17
- CocoaPods
- Expo toolchain
- EAS CLI para build/distribuicao beta quando a Fase 6 chegar

---

## 3. Estrategia recomendada para o seu Mac mini M2

Para o seu hardware, o caminho mais eficiente e:

1. preparar primeiro **iOS local**
2. depois preparar **Android local**
3. manter **um simulador/emulador por vez**
4. usar **VS Code + terminal** como fluxo principal

### Recomendacao pratica

No dia a dia:

- use iOS Simulator como ambiente principal de desenvolvimento
- deixe Android Emulator para validacao cruzada e bugs especificos

Motivo:

- no Apple Silicon, o iOS Simulator costuma ser o caminho mais leve e fluido
- com 16 GB de RAM, rodar VS Code + Vite + iOS Simulator + Android Emulator + testes ao mesmo tempo nao e ideal

---

## 4. Visao geral do setup

### Minimo para comecar a frente native

- Homebrew
- Node LTS atual
- Watchman
- Xcode
- iOS Simulator

### Minimo para desenvolvimento completo iOS + Android

- tudo acima
- Android Studio
- Android SDK
- Android Emulator
- JDK 17
- ANDROID_HOME configurado

### Minimo para beta interno depois

- tudo acima
- EAS CLI
- login no Expo
- `app.config.js`
- `eas.json`

---

## 5. Ordem recomendada de instalacao

Siga exatamente esta ordem:

1. validar o que voce ja tem instalado
2. instalar/atualizar Homebrew
3. instalar Node LTS e Watchman
4. instalar Xcode e iOS Simulator
5. instalar CocoaPods
6. instalar JDK 17
7. instalar Android Studio + SDK + Emulator
8. configurar variaveis de ambiente Android
9. preparar VS Code
10. testar o ambiente inteiro com comandos de verificacao

---

## 6. Passo 1 - Validar o ambiente atual

Rode:

```bash
node -v
npm -v
git --version
xcode-select -p || true
java -version || true
watchman --version || true
pod --version || true
adb version || true
```

### O que voce quer descobrir aqui

- se o Node atual ja esta aceitavel
- se Xcode command line tools ja existem
- se Watchman, Java, CocoaPods e Android tooling ainda faltam

### Recomendacao de Node

Como o projeto ainda nao fixa `engines` no `package.json`, a recomendacao mais segura e usar a **LTS atual** via `nvm`.

Exemplo:

```bash
nvm install --lts
nvm use --lts
```

Se voce nao usa `nvm` ainda, vale muito a pena adotar agora.

---

## 7. Passo 2 - Garantir Homebrew

Se voce ja usa Homebrew, atualize:

```bash
brew update
brew doctor
```

Se ainda nao tiver Homebrew, instale pelo site oficial:

- https://brew.sh/

---

## 8. Passo 3 - Instalar Node LTS e Watchman

### Se for usar `nvm`

Instale `nvm`, depois:

```bash
nvm install --lts
nvm use --lts
```

### Watchman

O React Native recomenda Watchman no macOS para melhorar file watching.

```bash
brew install watchman
watchman --version
```

### Regra

Nao misture muitos gerenciadores de Node ao mesmo tempo.

Se optar por `nvm`, use `nvm` como padrao.

---

## 9. Passo 4 - Instalar Xcode e preparar iOS

### 9.1. Instalar Xcode

Instale pela App Store.

Depois:

1. abra o Xcode ao menos uma vez
2. aceite a licenca
3. deixe ele terminar a instalacao de componentes

### 9.2. Command Line Tools

Rode:

```bash
xcode-select --install
```

Se o sistema disser que ja estao instaladas, tudo certo.

### 9.3. Selecionar Xcode ativo

Depois de instalar:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 9.4. Verificar

```bash
xcodebuild -version
xcrun simctl list devices
```

### 9.5. iOS Simulator

Abra o Xcode e confira se pelo menos um simulator recente esta instalado:

- iPhone 16 ou equivalente recente
- iOS atual suportado pelo Xcode instalado

### Regra

Para o projeto hybrid, iOS Simulator deve ser o seu **primeiro alvo funcional**.

Se iOS ainda nao estiver rodando, nao avance para o Android antes de corrigir isso.

---

## 10. Passo 5 - Instalar CocoaPods

Para dev native em iOS, CocoaPods continua sendo ferramenta importante.

Recomendacao pratica no macOS:

```bash
brew install cocoapods
pod --version
```

Se isso falhar por algum motivo especifico do seu sistema, a alternativa costuma ser instalar por RubyGems, mas no seu caso eu manteria `brew` como primeira tentativa.

---

## 11. Passo 6 - Instalar JDK 17

O guia oficial de React Native continua recomendando JDK 17 para Android.

No Apple Silicon, uma base segura e:

```bash
brew install --cask zulu@17
java -version
```

Depois configure `JAVA_HOME` no seu shell.

Se voce usa `zsh`, adicione em `~/.zshrc`:

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
```

Depois recarregue:

```bash
source ~/.zshrc
echo $JAVA_HOME
java -version
```

### Regra

Nao use JDK "qualquer" e torca para funcionar.

Para o stack native previsto, trate **JDK 17** como baseline local.

---

## 12. Passo 7 - Instalar Android Studio

Baixe e instale pelo site oficial:

- https://developer.android.com/studio

Durante a instalacao, mantenha habilitado:

- Android SDK
- Android SDK Platform
- Android Virtual Device

Depois abra o Android Studio pelo menos uma vez.

---

## 13. Passo 8 - Instalar Android SDK e AVD corretos

No Android Studio:

1. abra **SDK Manager**
2. confira a aba **SDK Platforms**
3. habilite a plataforma Android recente suportada pelo tooling atual
4. instale tambem uma imagem **ARM 64** para Apple Silicon

Na aba **SDK Tools**, confira no minimo:

- Android SDK Build-Tools
- Android SDK Command-line Tools
- Android Emulator
- Platform-Tools

### Recomendacao para Apple Silicon

Prefira imagem:

- `Google APIs ARM 64 v8a System Image`

E nao imagens Intel/x86, quando houver opcao ARM nativa.

### Criar o emulador

No AVD Manager:

1. crie um device Pixel recente
2. use imagem ARM64
3. mantenha 1 AVD apenas no inicio

---

## 14. Passo 9 - Configurar ANDROID_HOME e PATH

No macOS, o caminho padrao costuma ser:

```bash
$HOME/Library/Android/sdk
```

Adicione ao `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Recarregue:

```bash
source ~/.zshrc
echo $ANDROID_HOME
adb version
emulator -list-avds
```

### Regra

Se `adb` ou `emulator` nao responderem, nao siga adiante.

Corrija ambiente antes.

---

## 15. Passo 10 - Preparar VS Code

Seu setup com VS Code continua valido, mas eu recomendo adicionar:

- `ESLint`
- `Prettier` se voce realmente usar no seu fluxo
- `React Native Tools`
- `Expo Tools` se estiver disponivel e fizer sentido no seu ambiente
- `Error Lens`
- `DotENV`

### Configuracao pratica

Mantenha no VS Code:

- terminal integrado como terminal principal
- workspace confiavel
- auto save apenas se nao atrapalhar lint/test loop

### Recomendacao de depuracao

Para o inicio, nao complique com debug nativo pesado.

Comece por:

- terminal + logs do Expo
- iOS Simulator
- Android Emulator

---

## 16. Expo e EAS no seu fluxo local

### 16.1. Expo CLI

Prefira usar via `npx`, nao como dependencia mental de install global antiga.

Exemplos:

```bash
npx expo start
npx expo run:ios
npx expo run:android
```

### 16.2. EAS CLI

Voce nao precisa operar beta interno no primeiro dia.

Mas como o roadmap oficial preve `eas.json` e build profiles, vale deixar a CLI pronta:

```bash
npm install -g eas-cli
eas --version
```

Ou, se preferir evitar global:

```bash
npx eas-cli --version
```

### Recomendacao

No seu caso, eu faria:

- `Expo CLI` via `npx`
- `EAS CLI` pode ser global ou via `npx`, o que voce achar mais confortavel

---

## 17. Variaveis de ambiente: web x native

Hoje o projeto usa `.env` com chaves da web/Vite.

Para a frente native, a separacao correta tende a ser:

- **web:** `VITE_*`
- **mobile publico:** `EXPO_PUBLIC_*`
- **segredos:** fora de `EXPO_PUBLIC_*`

### Leitura correta

Exemplos publicos aceitaveis no mobile:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV`

### Regra

Se um valor nao deve ir parar no bundle do app, ele **nao** pode morar em `EXPO_PUBLIC_*`.

---

## 18. Checklist de validacao do ambiente

Quando terminar a instalacao, estes comandos devem funcionar:

```bash
node -v
npm -v
watchman --version
xcodebuild -version
xcrun simctl list devices
pod --version
java -version
echo $JAVA_HOME
echo $ANDROID_HOME
adb version
emulator -list-avds
```

### Resultado esperado

- Node responde
- Watchman responde
- Xcode responde
- Simulator existe
- CocoaPods responde
- Java responde
- `ANDROID_HOME` existe
- `adb` responde
- ao menos 1 AVD existe

---

## 19. Fluxo recomendado quando a Fase 4 comecar

Quando `apps/mobile` existir de fato, a sequencia local recomendada e:

1. instalar dependencias do repo
2. subir a web normalmente
3. subir o app Expo
4. validar iOS primeiro
5. validar Android depois

Fluxo esperado:

```bash
npm install
npm run dev

# em outro terminal, quando apps/mobile existir:
cd apps/mobile
npx expo start
```

### Para iOS

```bash
npx expo run:ios
```

### Para Android

```bash
npx expo run:android
```

---

## 20. Recomendacoes praticas para o seu Mac mini M2

### Recomendacao 1

Nao rode:

- iOS Simulator
- Android Emulator
- Vite
- Vitest pesado
- cobertura

Tudo ao mesmo tempo sem necessidade.

### Recomendacao 2

No dia a dia:

- deixe 1 simulador/emulador aberto por vez
- feche Android Emulator quando estiver trabalhando so em iOS

### Recomendacao 3

Se a maquina estiver sofrendo:

- priorize iOS Simulator
- rode Android so em checkpoints

### Recomendacao 4

Para testes manuais de push no futuro:

- considere tambem um device fisico iPhone
- e, depois, um Android fisico se precisar validar edge cases

---

## 21. Problemas comuns no Apple Silicon

### Xcode instalado mas simulator nao abre

Checar:

- Xcode aberto ao menos uma vez
- components instalados
- licenca aceita

### `pod` nao encontrado

Checar:

- `brew install cocoapods`
- terminal reiniciado

### `adb` nao encontrado

Checar:

- `ANDROID_HOME`
- PATH com `platform-tools`

### Emulator muito lento

Checar:

- AVD ARM64
- apenas um emulador aberto

### Expo nao encontra device/simulator

Checar:

- simulator ja aberto
- `xcrun simctl list devices`
- `adb devices`

---

## 22. O que voce pode adiar agora

Voce **nao** precisa instalar hoje:

- tooling de HealthKit
- libs de biometria
- tooling de OTA rollout
- setup de publicacao final em App Store / Play Store

### O que eu recomendo instalar agora, sem falta

- Node LTS
- Watchman
- Xcode
- CocoaPods
- JDK 17
- Android Studio
- Android SDK / Emulator

---

## 23. Setup minimo recomendado para a sua proxima sessao

Se voce quiser o menor setup funcional para destravar o projeto native o quanto antes, faca nesta ordem:

1. `nvm install --lts`
2. `brew install watchman`
3. instalar Xcode e abrir uma vez
4. `xcode-select --install`
5. `brew install cocoapods`
6. `brew install --cask zulu@17`
7. instalar Android Studio
8. configurar `ANDROID_HOME`
9. criar 1 AVD ARM64

Depois valide os comandos do checklist da secao 18.

---

## 24. Leitura complementar obrigatoria

Depois de preparar o ambiente, a ordem de leitura recomendada para a frente native e:

1. `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
2. `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE4_MOBILE_SCAFFOLD.md`
3. `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
4. `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
5. `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`
6. `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

---

## 26. Identidade Oficial do Projeto (Aprovada Play Console ✅)

A partir de **2026-04-14**, os identificadores do projeto sao definitivos e oficiais. Utilize estes valores ao configurar novos builds ou ambientes:

| Ambiente | Bundle ID / Android Package | Nome do App |
|----------|-----------------------------|-------------|
| **Produção** | `com.coelhotv.meusremedios` | Meus Remédios |
| **Preview** | `com.coelhotv.meusremedios.preview` | Meus Remédios Preview |
| **Development** | `com.coelhotv.meusremedios.dev` | Meus Remédios Dev |

### Configuração no `app.config.js`

Estes valores são geridos dinamicamente no `app.config.js` com base na variável `EAS_BUILD_PROFILE`.

---

## 27. Versionamento de Builds (local vs EAS remoto)

### Como funciona o versionCode no Android

O Google Play Console exige que cada upload tenha um `versionCode` inteiro **estritamente crescente**. O `version` semântico (ex: `"0.2.3"`) é o que o utilizador vê na Play Store; o `versionCode` é interno e só o Play Console valida.

### Estratégia adoptada: versionCode derivado da versão semântica

O `app.config.js` usa a fórmula `major * 10000 + minor * 100 + patch`:

```js
const APP_VERSION = '0.2.3'
const [major, minor, patch] = APP_VERSION.split('.').map(Number)
const VERSION_CODE = major * 10000 + minor * 100 + patch
// 0.2.3 → 203 | 0.2.4 → 204 | 0.3.0 → 300 | 1.0.0 → 10000
```

Desta forma, ao incrementar `APP_VERSION` numa linha, tanto `version` (Play Store) como `versionCode` (interno) ficam sincronizados automaticamente.

### appVersionSource: 'local'

O campo `cli.appVersionSource: 'local'` instrui o Expo a **não** gerir o versionCode remotamente (modo EAS automático). Com isto, o controlo é explícito e vive no `app.config.js`. Cada novo upload ao Play Console requer incrementar `APP_VERSION`.

### Tabela de versões lançadas

| Versão | versionCode | Data | Notas |
|--------|-------------|------|-------|
| 0.1.0  | 1           | 2026-04-15 | Primeiro build EAS (modo remoto) |
| 0.1.0  | 2           | 2026-04-15 | Build production EAS (modo remoto) |
| 0.2.3  | 203         | 2026-04-18 | Firebase Analytics — primeiro build local |

### Fluxo para cada novo release

1. Incrementar `APP_VERSION` em `app.config.js`
2. Gerar build: `./build-android.sh production`
3. Fazer upload do `.aab` no Play Console
4. Atualizar a tabela acima

---

## 28. Fontes oficiais consultadas

- Expo docs - setup de ambiente: https://docs.expo.dev/get-started/set-up-your-environment
- React Native docs - setup de ambiente macOS: https://reactnative.dev/docs/set-up-your-environment
- Android Studio: https://developer.android.com/studio
- Apple Developer / Xcode: https://developer.apple.com/xcode/
