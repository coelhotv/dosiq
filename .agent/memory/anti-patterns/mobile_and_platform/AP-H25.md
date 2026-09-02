---
title: googleServicesFile iOS ausente no app.config.js causa falha no prebuild
summary: >-
  googleServicesFile iOS ausente no app.config.js — sempre configurar ios.googleServicesFile além do
  Android
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - app.config.js
    - ios.googleServicesFile
    - android.googleServicesFile
    - googleServicesFile
    - useModularHeaders
    - BUILD_PROFILE
    - GoogleService
    - Info.plist
  keywords:
    - googleservicesfile
    - ios
    - ausente
    - app
    - config
    - causa
    - falha
    - prebuild
category: mobile_and_platform
created_at: "2026-04-18"
id: AP-H25
last_triggered: "2026-04-18"
severity: medium
tags:
  - firebase
  - ios
  - app-config
  - googleservices
  - plist
  - native-build
trigger_count: 1
---

## Problema

Mesmo com Firebase v21 e `useModularHeaders` configurados, o prebuild falha com:

```
Path to GoogleService-Info.plist is not defined. Please add googleServicesFile to the ios config in app.config.js.
```

## Causa Raiz

O campo `ios.googleServicesFile` é obrigatório para o plugin `@react-native-firebase/app` em iOS, mas frequentemente esquecido ao configurar apenas o Android (que tem `android.googleServicesFile`).

## Impacto

- Prebuild iOS aborta — nenhum arquivo nativo gerado
- Confunde agentes que acham que v21 + useModularHeaders foi suficiente

## Prevenção

**Sempre configurar ambas as plataformas em `app.config.js`:**

```js
ios: {
  googleServicesFile: process.env.GOOGLE_SERVICES_PLIST_PATH
    || `./GoogleService-Info-${BUILD_PROFILE}.plist`,
  // ... resto das configs
},
android: {
  googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH
    || `./google-services-${BUILD_PROFILE}.json`,
  // ... resto das configs
},
```

**Os arquivos de credencial** (`GoogleService-Info-development.plist`, etc.) NÃO são commitados no git — são arquivos sensíveis do Firebase Console.

- Para desenvolvimento local: baixar do Firebase Console → iOS app → "Download GoogleService-Info.plist" e renomear para `GoogleService-Info-development.plist`
- Desde 2026-05-24 (projeto fora do iCloud, sem worktree-bridge): os `.plist`/`.json` de credencial ficam direto em `~/git/dosiq/apps/mobile/`. O fluxo antigo via `gsync-native.sh` está aposentado (ver AP-H20, R-161).

## Fix Aplicado (2026-04-18)

- Adicionado `ios.googleServicesFile` em `app.config.js` com pattern por BUILD_PROFILE
- Script `gsync-native.sh` atualizado para copiar `GoogleService-Info*.plist`
- Commit: fix(mobile): adiciona googleServicesFile iOS e suporte Swift Firebase no app.config.js
