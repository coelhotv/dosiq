---
title: "@react-native-firebase v19 incompatível com Swift AppDelegate (Expo 53+)"
summary: >-
  @react-native-firebase v19 incompatível com Swift AppDelegate (Expo 53+) — Firebase não
  inicializa;
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - AppDelegate.swift
    - package.json
  keywords:
    - react
    - native
    - firebase
    - v19
    - incompatível
    - swift
    - appdelegate
    - expo
category: mobile_and_platform
created_at: "2026-04-18"
id: AP-H23
incident_count: 4
last_referenced: "2026-04-21"
last_triggered: "2026-04-18"
severity: high
tags:
  - firebase
  - ios
  - expo
  - swift
  - appdelegate
  - native-build
trigger_count: 1
---

## Problema

Ao usar `@react-native-firebase/app` v19.x com Expo SDK 53+, o prebuild falha com:

```
@react-native-firebase/app: Unable to determine correct Firebase insertion point in AppDelegate.swift. Skipping Firebase addition.
```

O plugin do Firebase v19 só sabe injetar código em `AppDelegate.m` (Objective-C). O Expo 53 gera `AppDelegate.swift` por padrão. O resultado é que o Firebase não é inicializado no AppDelegate — comportamento silenciosamente quebrado.

## Impacto

- Firebase Analytics e Crashlytics não inicializam corretamente
- Push notifications via FCM podem falhar silenciosamente
- A mensagem é um *aviso*, não erro fatal — o prebuild termina, mas o app em runtime pode não ter Firebase funcional

## Causa Raiz

Incompatibilidade de versão: v19 usa API de plugin ObjC, Expo 53 usa Swift por padrão.

## Prevenção

**Usar `@react-native-firebase` v21.x ou superior** — tem suporte nativo a Swift AppDelegate.

```json
// package.json
"@react-native-firebase/app": "^21.14.0",
"@react-native-firebase/analytics": "^21.14.0"
```

Após atualizar, rodar `npx expo install` para reconfigurar versões e depois `npx expo prebuild --clean`.

## Fix Aplicado (2026-04-18)

- Upgrade de v19.2.0 → v21.14.0 em `apps/mobile/package.json`
- Commit: fix(mobile): atualiza @react-native-firebase para v21 com suporte Swift AppDelegate
