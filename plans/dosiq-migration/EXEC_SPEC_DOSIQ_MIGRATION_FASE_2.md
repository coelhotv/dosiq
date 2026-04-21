# Exec Spec Fase 2: App Híbrido Mobile & Expo
> **Objetivo:** Adequar a identidade nativa do aplicativo para "Dosiq", preparando-o para compilação Google Play e App Store com seus respectivos bundle IDs novos.

## 1. Escopo de Arquivos Modificados
- `apps/mobile/app.config.js`
- `apps/mobile/src/platform/config/nativePublicAppConfig.js`
- (Verificação) `apps/mobile/src/features/dashboard/screens/*.jsx` (Onde houver texto hardcoredo de Branding).

## 2. Tarefas de Execução

### 2.1. app.config.js (Canônico App Profile)
- Field `name`: Alterar todas keys de environment (Dev, Prev, Prod) para "Dosiq Dev", "Dosiq Preview" e "Dosiq".
- Field `slug`: Alterar todos de `meus-remedios-[env]` para `dosiq-[env]`.
- Field `iosBundleIdentifier`: Modificar para `com.coelhotv.dosiq` (todas as chaves).
- Field `androidPackage`: Modificar para `com.coelhotv.dosiq` (todas as chaves).
- Field `scheme`: Modificar de `meusremedios` para `dosiq`. (Isso afeta deep linking, então redobrar atenção).

### 2.2. nativePublicAppConfig.js
- Localizar a constante que aponta URLs de ambiente web (se houver fallbacks) e atualizar `meus-remedios.vercel.app` para `dosiq.vercel.app`.

### 2.3. Resquícios de Texto Mobile
- Procurar chamadas globais de `Meus Remédios` entre os headers das views do aplicativo: `MedicinesScreen`, `TodayScreen`, `SmokeScreen`.

## 3. Validation Gate do Agente
- O Agente deve assegurar o comando do Expo Config Check: O App Native precisa abrir de alguma forma.
- Após modificações, rodar teste de schema local de pre-compilação se disponível, senão, `npm run test:changed` a partir de `apps/mobile`.
