# Exec Spec Hibrido - Addendum: Release Engineering Mobile

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 4, Fase 6 e Fase 7
> **Objetivo:** congelar as decisoes de identidade, build, ambiente, versionamento e distribuicao do app mobile para impedir improviso operacional

---

## 1. Papel deste addendum

Este documento existe para responder, sem ambiguidade:

- como o app mobile sera identificado
- como os ambientes serao separados
- como os builds serao gerados
- como versoes serao numeradas
- como segredos e configuracoes serao injetados
- como o beta sera distribuido sem quebrar reproducibilidade

Sem este documento, agentes menores tendem a:

- deixar `app.json` estatico quando ja existe necessidade de ambiente
- inventar `bundleIdentifier` e `applicationId`
- misturar segredo com variavel publica
- criar build local nao reprodutivel
- ativar OTA cedo demais

---

## 2. Decisoes congeladas

### RE-001. `app.config.js` e o formato canonico do mobile

Mesmo que a Fase 4 comece com um scaffold simples, o estado-alvo do projeto mobile deve usar:

- `apps/mobile/app.config.js`

E nao:

- `apps/mobile/app.json` como configuracao final

Motivo:

- o projeto tera multiplos ambientes
- o projeto tera identidades por build profile
- o projeto precisara centralizar strings, scheme e ids com menos risco

### RE-002. `eas.json` e obrigatorio antes de preview/beta

O projeto deve ter um `apps/mobile/eas.json` com profiles explicitos.

Profiles obrigatorios:

- `development`
- `preview`
- `production`

### RE-003. Ambientes canonicamente suportados

O projeto mobile deve operar com a seguinte matriz:

- `local`: desenvolvimento do agente/coder
- `preview`: beta interno e validacao de release
- `production`: build pronto para distribuicao mais ampla

### RE-004. Segredo nunca entra em `EXPO_PUBLIC_*`

Variaveis publicas podem usar:

- `EXPO_PUBLIC_*`

Segredos nunca podem usar:

- `EXPO_PUBLIC_*`

Segredos devem vir de:

- `eas secret`
- env do CI
- mecanismo aprovado pelo maintainer

### RE-005. OTA nao e permitido por padrao nesta etapa

`expo-updates` nao deve ser ativado como estrategia operacional padrao sem aprovacao humana explicita.

Leitura correta:

- o app pode conviver com a infraestrutura padrao do Expo
- o time **nao** deve operar rollout OTA, channels e rollback OTA nesta etapa

### RE-006. Identidade do app deve ser estavel e previsivel

O projeto deve congelar:

- `slug`
- `scheme`
- `ios.bundleIdentifier`
- `android.package`

Sem ids improvisados por sprint.

### RE-007. O root do repo continua sendo a ancora do mobile

Mesmo que a web va para `apps/web` no futuro, o mobile continua assumindo:

- workspace root = raiz do repositorio
- `apps/mobile` como app path

Qualquer migracao estrutural que quebre isso viola este addendum.

---

## 3. Estrutura minima obrigatoria

```text
apps/mobile/
  app.config.js
  eas.json
  package.json
  .env.example
  src/
    platform/
      config/
        nativePublicAppConfig.js
```

## 3.1. `app.config.js`

Responsabilidades obrigatorias:

- nome do app
- slug
- scheme
- bundle identifiers
- versionamento base
- permissao strings
- plugins aprovados

## 3.2. `eas.json`

Responsabilidades obrigatorias:

- build profiles
- env por profile quando aplicavel
- estrategia clara de distribuicao

## 3.3. `.env.example`

Responsabilidades obrigatorias:

- listar variaveis publicas usadas no mobile
- diferenciar claramente publico x segredo

---

## 4. Matriz obrigatoria de configuracao

## 4.1. Campos canonicamente definidos

Exemplo prescritivo:

```js
const APP_VARIANTS = {
  development: {
    appName: 'Meus Remedios Dev',
    slug: 'dosiq-dev',
    iosBundleId: 'com.coelhotv.meusremedios.dev',
    androidPackage: 'com.coelhotv.meusremedios.dev',
  },
  preview: {
    appName: 'Meus Remedios Preview',
    slug: 'dosiq-preview',
    iosBundleId: 'com.coelhotv.meusremedios.preview',
    androidPackage: 'com.coelhotv.meusremedios.preview',
  },
  production: {
    appName: 'Meus Remedios',
    slug: 'dosiq',
    iosBundleId: 'com.coelhotv.meusremedios',
    androidPackage: 'com.coelhotv.meusremedios',
  },
}
```

### Regra

Se o owner ainda nao congelou ids finais, placeholders podem existir.

Mas os placeholders devem ser:

- documentados
- coerentes
- consistentes entre iOS e Android

## 4.2. Variaveis publicas permitidas

Exemplos:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV`

## 4.3. Variaveis secretas tipicas

Exemplos:

- credenciais de submit
- tokens internos de integracao
- chaves privadas futuras

### Regra

Se a variavel precisa ficar escondida do bundle, ela nao pode entrar em `EXPO_PUBLIC_*`.

---

## 5. `app.config.js` prescritivo

Exemplo base:

```js
const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'development'

const variants = {
  development: {
    name: 'Meus Remedios Dev',
    slug: 'dosiq-dev',
    iosBundleIdentifier: 'com.coelhotv.meusremedios.dev',
    androidPackage: 'com.coelhotv.meusremedios.dev',
  },
  preview: {
    name: 'Meus Remedios Preview',
    slug: 'dosiq-preview',
    iosBundleIdentifier: 'com.coelhotv.meusremedios.preview',
    androidPackage: 'com.coelhotv.meusremedios.preview',
  },
  production: {
    name: 'Meus Remedios',
    slug: 'dosiq',
    iosBundleIdentifier: 'com.coelhotv.meusremedios',
    androidPackage: 'com.coelhotv.meusremedios',
  },
}

const current = variants[BUILD_PROFILE] || variants.development

module.exports = {
  expo: {
    name: current.name,
    slug: current.slug,
    scheme: 'meusremedios',
    version: '1.0.0',
    ios: {
      bundleIdentifier: current.iosBundleIdentifier,
    },
    android: {
      package: current.androidPackage,
    },
    extra: {
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || BUILD_PROFILE,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
}
```

### Regra

O mobile deve ler configuracao publica a partir de `extra`, normalizada pela camada de plataforma.

Pacotes compartilhados continuam proibidos de ler env diretamente.

---

## 6. `eas.json` prescritivo

Exemplo base:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### Regras obrigatorias

- `development` e para desenvolvimento e debug
- `preview` e para beta/teste interno
- `production` e reservado ao release mais estavel

### Proibido

- criar profiles ad hoc por sprint sem ADR ou justificativa
- operar com um unico profile para todos os ambientes

---

## 7. Politica de versionamento

## 7.1. Campos obrigatorios

- `version`
- `ios.buildNumber`
- `android.versionCode`

## 7.2. Politica recomendada

- `version` muda em marcos funcionais relevantes
- `buildNumber` e `versionCode` sobem a cada build distribuido

## 7.3. Regra

Nao deixar incremento manual implcito no cabeca do coder.

Se o time usar `autoIncrement`, isso precisa estar declarado no `eas.json`.

---

## 8. Politica de distribuicao

## 8.1. Desenvolvimento local

Aceito:

- `expo start`
- `expo run:ios`
- `expo run:android`

## 8.2. Beta interno

Aceito:

- EAS Build `preview`
- TestFlight interno
- Android internal testing

## 8.3. Submit

`EAS Submit` ou processo equivalente so deve entrar quando:

- o owner aprovar
- a Fase 6 estiver madura
- os metadados de loja estiverem fechados

---

## 9. Politica de OTA

Leitura congelada:

- nenhuma estrategia de rollout OTA deve ser introduzida automaticamente por um agente

Isto inclui:

- channels operacionais
- branches de update
- rollback OTA
- alteracao de `runtimeVersion`

### Se houver necessidade futura

Isto deve virar decisao formal da Fase 8 ou addendum especifico.

---

## 10. CI, secrets e ownership

## 10.1. Ownership obrigatorio

O maintainer humano continua sendo dono de:

- credenciais Apple
- credenciais Google Play
- segredos de submit
- aprovacoes de distribuicao

## 10.2. O que o agente pode fazer

- configurar arquivos de projeto
- preparar profiles
- documentar envs
- deixar comandos reproduziveis

## 10.3. O que o agente nao pode assumir

- posse de credenciais
- aprovacao de publicacao
- acesso a segredos nao presentes no ambiente

---

## 11. Checklist obrigatorio para consumo pelas fases

## 11.1. Fase 4 deve sair com

- `app.config.js` funcional
- `eas.json` inicial
- identity matrix coerente
- envs publicos documentados

## 11.2. Fase 6 deve sair com

- build `preview` operacional
- distribuicao beta alinhada com profiles
- logs/build metadata identificando ambiente

## 11.3. Fase 7 nao pode quebrar

- resolucao do `apps/mobile/app.config.js`
- `eas.json`
- scripts mobile no root

---

## 12. Ancoragem e validacao contra a master spec

- Este addendum reforca que o mobile nasce em Expo.
- Este addendum nao antecipa OTA nem capacidades pos-MVP.
- Este addendum torna beta interno operacional sem conflitar com a Fase 6.
- Este addendum preserva o root do monorepo como ancora do mobile mesmo se a web migrar depois.

Se qualquer implementacao derivada quebrar um destes pontos, ela esta desalinhada com a estrategia hibrida do projeto.
