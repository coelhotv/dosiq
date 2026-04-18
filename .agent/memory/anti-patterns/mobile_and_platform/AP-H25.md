---
id: AP-H25
title: "googleServicesFile iOS ausente no app.config.js causa falha no prebuild"
category: mobile_and_platform
layer: warm
status: active
severity: medium
tags: [firebase, ios, app-config, googleservices, plist, native-build]
created_at: "2026-04-18"
trigger_count: 1
last_triggered: "2026-04-18"
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
- Para worktree de testes nativos: o script `gsync-native.sh` copia automaticamente os `.plist` do iCloud repo para o worktree (Passo 3 — Credenciais)

## Fix Aplicado (2026-04-18)

- Adicionado `ios.googleServicesFile` em `app.config.js` com pattern por BUILD_PROFILE
- Script `gsync-native.sh` atualizado para copiar `GoogleService-Info*.plist`
- Commit: fix(mobile): adiciona googleServicesFile iOS e suporte Swift Firebase no app.config.js
