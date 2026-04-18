---
id: AP-H26
title: "Falha de Regex do plugin Firebase v21+ no AppDelegate.swift do Expo 53"
category: mobile_and_platform
layer: warm
status: active
severity: high
tags: [firebase, ios, expo-53, swift, appdelegate, config-plugin, regex-failure]
created_at: "2026-04-18"
trigger_count: 1
last_triggered: "2026-04-18"
---

## Problema

Ao realizar `npx expo prebuild` no Expo SDK 53 com `@react-native-firebase/app` v21.14.0+, aparece o aviso:
`» ios: @react-native-firebase/app: Unable to determine correct Firebase insertion point in AppDelegate.swift. Skipping Firebase addition.`

Embora pareça apenas um aviso, o Firebase **não é inicializado** no iOS, quebrando Analytics, Push e Logs.

## Causa Raiz

O plugin oficial do Firebase v21 procura pela string `self.moduleName = "main"` (ou similar) como âncora para injetar `FirebaseApp.configure()`. No Expo 53, o `AppDelegate.swift` gerado foi simplificado e agora usa `factory.startReactNative(withModuleName: "main", ...)` diretamente, sem a atribuição explícita de `self.moduleName`. Isso faz com que a Regex do plugin falhe.

## Impacto

- Firebase silenciosamente desativado em runtime (iOS apenas).
- Falha no `pod install` se `use_modular_headers!` também não estiver corretamente propagado (correlacionado com AP-H24).

## Prevenção e Solução

Criar e usar um **Config Plugin customizado** que ignore a regex falha e injete o código baseado nos novos padrões do Expo 53.

1. Criar `withFirebaseFix.js` na raiz do projeto mobile:
```javascript
const { withAppDelegate } = require('@expo/config-plugins');

const withFirebaseFix = (config) => {
  return withAppDelegate(config, config => {
    if (config.modResults.language === 'swift') {
      let contents = config.modResults.contents;
      // Injeta import
      if (!contents.includes('import FirebaseCore')) {
        contents = contents.replace(/import Expo/g, `import Expo\nimport FirebaseCore`);
      }
      // Injeta configure() no didFinishLaunchingWithOptions
      const configureLine = `FirebaseApp.configure()`;
      if (!contents.includes(configureLine)) {
        contents = contents.replace(
          /(public override func application\(\s*_ application: UIApplication,\s*didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\s*\) -> Bool \{)/,
          `$1\n    ${configureLine}`
        );
      }
      config.modResults.contents = contents;
    }
    return config;
  });
};
module.exports = withFirebaseFix;
```

2. Registrar no `app.config.js`:
```javascript
plugins: [
  '@react-native-firebase/app',
  './withFirebaseFix.js'
]
```

## Aprendizado

O ecossistema Expo/React-Native em versões major (como a transição para React 19 e Expo 53) frequentemente quebra pressupostos de busca-e-substituição de plugins legado. Plugins locais (`withX.js`) são a forma mais resiliente de garantir builds determinísticos enquanto os plugins oficiais não são atualizados.
