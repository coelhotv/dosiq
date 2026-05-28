---
id: AP-H24
title: "FirebaseCoreInternal / GoogleUtilities quebra pod install sem useModularHeaders"
category: mobile_and_platform
layer: warm
status: active
severity: high
tags: [firebase, ios, cocoapods, swift, expo-build-properties, native-build]
created_at: "2026-04-18"
trigger_count: 1
last_triggered: "2026-04-18"
---

## Problema

Após corrigir a versão do Firebase (v21), o `pod install` falha com:

```
The following Swift pods cannot yet be integrated as static libraries:
The Swift pod `FirebaseCoreInternal` depends upon `GoogleUtilities`,
which does not define modules. To opt into those targets generating
module maps (which is necessary to import them from Swift when building
as static libraries), you may set `use_modular_headers!` globally in
your Podfile, or specify `:modular_headers => true` for particular
dependencies.
pod install --repo-update --ansi exited with non-zero code: 1
```

## Causa Raiz

`FirebaseCoreInternal` (Swift) depende de `GoogleUtilities` (ObjC) que não expõe module maps. Para compilar como static library com Swift, CocoaPods precisa de `use_modular_headers!` no Podfile.

## Impacto

- `npx expo prebuild` termina sem o diretório iOS funcional
- `pod install` abortado — impossível gerar o build nativo

## Prevenção e Fix

Instalar `expo-build-properties` e configurar em `app.config.js`:

```bash
npx expo install expo-build-properties
```

```js
// app.config.js
plugins: [
  '@react-native-firebase/app',
  ['expo-build-properties', {
    ios: {
      useModularHeaders: true,
    },
  }],
],
```

Isso injeta `use_modular_headers!` no Podfile gerado pelo Expo automaticamente.

## Fix Aplicado (2026-04-18)

- Instalado `expo-build-properties ~0.14.8`
- Adicionado plugin com `useModularHeaders: true` em `app.config.js`
- Commit: fix(mobile): adiciona expo-build-properties com useModularHeaders para Firebase iOS
