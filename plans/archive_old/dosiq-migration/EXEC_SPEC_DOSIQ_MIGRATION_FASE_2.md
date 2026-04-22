# EXEC SPEC FASE 2: App Híbrido Mobile & Expo

> **Branch:** `refactor/dosiq-migration-fase-2`
> **Pré-requisito:** Fase 1 merged e `main` atualizado
> **Duração estimada:** 30–45 min
> **Impacto:** Configuração nativa de identidade do app (bundle ID, slug, scheme, deep links)

---

## 0. Bootstrap Obrigatório

```bash
git checkout main && git pull   # Garantir Fase 1 incorporada
git checkout -b refactor/dosiq-migration-fase-2
npm run lint                    # Baseline limpo com os nomes de pacotes já atualizados
```

---

## 1. Arquivos a Modificar

### 1.1 `apps/mobile/app.config.js` — Identidade Canônica do App

Este é o arquivo crítico. Cada campo abaixo tem impacto direto nas lojas e no build nativo.

**Variantes de Build — objeto `variants`:**

| Campo | Chave | Valor atual | Novo valor |
|---|---|---|---|
| `development.name` | `name` | `'Meus Remedios Dev'` | `'Dosiq Dev'` |
| `development.slug` | `slug` | `'meus-remedios-dev'` | `'dosiq-dev'` |
| `development.iosBundleIdentifier` | `iosBundleIdentifier` | `'com.coelhotv.meusremedios.dev'` | `'com.coelhotv.dosiq.dev'` |
| `development.androidPackage` | `androidPackage` | `'com.coelhotv.meusremedios.dev'` | `'com.coelhotv.dosiq.dev'` |
| `preview.name` | `name` | `'Meus Remedios Preview'` | `'Dosiq Preview'` |
| `preview.slug` | `slug` | `'meus-remedios-dev'` | `'dosiq-dev'` |
| `preview.iosBundleIdentifier` | `iosBundleIdentifier` | `'com.coelhotv.meusremedios.preview'` | `'com.coelhotv.dosiq.preview'` |
| `preview.androidPackage` | `androidPackage` | `'com.coelhotv.meusremedios.preview'` | `'com.coelhotv.dosiq.preview'` |
| `production.name` | `name` | `'Meus Remedios'` | `'Dosiq'` |
| `production.slug` | `slug` | `'meus-remedios-dev'` | `'dosiq'` |
| `production.iosBundleIdentifier` | `iosBundleIdentifier` | `'com.coelhotv.meusremedios'` | `'com.coelhotv.dosiq'` |
| `production.androidPackage` | `androidPackage` | `'com.coelhotv.meusremedios'` | `'com.coelhotv.dosiq'` |

**Propriedades Globais — dentro de `module.exports.expo`:**

| Campo | Valor atual | Novo valor | Risco |
|---|---|---|---|
| `scheme` | `'meusremedios'` | `'dosiq'` | ⚠️ ALTO — afeta deep links e OAuth callbacks |
| `owner` | `'coelhotv'` | Manter `'coelhotv'` | — |
| `extra.eas.projectId` | `'7169f55a-...'` | **NÃO ALTERAR** | 🔴 Crítico — quebra o EAS |

> [!CAUTION]
> O campo `scheme` é usado pelo Supabase Auth para redirecionar após login via Magic Link e OAuth. Alterar sem atualizar as Redirect URLs no painel do Supabase tornará o login nativo quebrado. O usuário **já deve ter** adicionado `dosiq://` nas Redirect URLs do Supabase antes desta fase ser deployed em produção.

### 1.2 `apps/mobile/src/platform/config/nativePublicAppConfig.js`

Este arquivo foi incluído na Fase 1 (import `@meus-remedios/config` → `@dosiq/config`). Verificar se após o merge da Fase 1 o import já está correto. Se não, corrigir nesta fase.

Verificar também se existe qualquer URL hardcodada:
```bash
grep -n "meus.remedios\|meusremedios" apps/mobile/src/platform/config/nativePublicAppConfig.js
# Se retornar algo, corrigir
```

### 1.3 Screens e Componentes Mobile — Varredura de Text Copy

A auditoria não identificou cópias de texto hardcoded diretamente nas screens principais, mas os seguintes arquivos DEVEM ser verificados:

```bash
grep -rn "Meus Rem\|Meus remedios\|meus-remedios" \
  --include="*.jsx" --include="*.js" \
  apps/mobile/src/
# Listar todos os resultados e corrigir texto hardcoded encontrado
```

**Arquivos com risco confirmado pela auditoria:**
- `apps/mobile/src/screens/LoginScreen.jsx` — verificar strings de UI
- `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx` — verificar strings (o import já foi corrigido na Fase 1)
- `apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx` — verificar

**Para cada ocorrência de texto encontrada:** substituir "Meus Remédios" → "Dosiq" e "Meus Remedios" → "Dosiq".

### 1.4 README do Mobile

**Arquivo:** `apps/mobile/README.md`

Verificar e substituir todas as ocorrências de "Meus Remédios" por "Dosiq".

### 1.5 Build Scripts do Mobile

**Arquivo:** `apps/mobile/build-android.sh`

Verificar se contém referências ao nome do app ou ao pacote legado. Corrigir se necessário.

---

## 2. O Que NÃO Alterar Nesta Fase

- ❌ Arquivos `google-services*.json` e `GoogleService-Info*.plist` — são providenciados pelo usuário
- ❌ `extra.eas.projectId` — não alterar mesmo que pareça necessário
- ❌ `.expo/` cache local — não editar diretamente
- ❌ Qualquer arquivo dentro de `apps/mobile/ios/Pods/`

---

## 3. Quality Gates

### Gate 1: Verificação do app.config.js
```bash
# Confirmar que nenhum valor legado restou no app.config.js
grep -n "meusremedios\|meus-remedios\|Meus Rem" apps/mobile/app.config.js
# Resultado esperado: 0 linhas

# Validar que o config é parseable pelo Expo
npx expo config --type public apps/mobile 2>&1 | head -30
# Deve mostrar name: 'Dosiq Dev' (ou variante) — sem erros de parse
```

### Gate 2: Verificação de Screens
```bash
grep -rn "Meus Rem\|meusremedios\|meus-remedios" \
  --include="*.jsx" --include="*.js" \
  apps/mobile/src/
# Resultado esperado: 0 linhas
```

### Gate Final da Fase
```bash
npm run lint

# Escopo completo limpo:
grep -rn "meus.remedios\|meusremedios\|Meus Rem" \
  --include="*.js" --include="*.jsx" --include="*.json" --include="*.sh" --include="*.md" \
  apps/mobile/ \
  | grep -v node_modules | grep -v ios/Pods
# Resultado esperado: 0 linhas

git add -A
git commit -m "refactor(mobile): renomear identidade Expo para Dosiq (slug, scheme, bundle IDs)"
```

---

## 4. Critérios de Aceitação do PR

- [ ] `app.config.js`: todas as 12 ocorrências de variante atualizadas (name, slug, bundle IDs x3+3+3)
- [ ] `scheme` alterado para `'dosiq'`
- [ ] `EAS projectId` **não alterado**
- [ ] Zero ocorrências de texto legado nas screens mobile
- [ ] `npx expo config --type public` executando sem erros
- [ ] `npm run lint` passando


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
- Localizar a constante que aponta URLs de ambiente web (se houver fallbacks) e atualizar `dosiq.vercel.app` para `dosiq.vercel.app`.

### 2.3. Resquícios de Texto Mobile
- Procurar chamadas globais de `Meus Remédios` entre os headers das views do aplicativo: `MedicinesScreen`, `TodayScreen`, `SmokeScreen`.

## 3. Validation Gate do Agente
- O Agente deve assegurar o comando do Expo Config Check: O App Native precisa abrir de alguma forma.
- Após modificações, rodar teste de schema local de pre-compilação se disponível, senão, `npm run test:changed` a partir de `apps/mobile`.
