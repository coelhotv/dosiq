# 📱 Arquitetura Metro & Expo Pipeline

Este documento descreve a arquitetura do bundler (Metro), as configurações específicas do Expo, os Smoke Tests e a pipeline de submissão do Dosiq para as lojas de aplicativos (App Store e Play Console).

## Visão Geral

A camada mobile do Dosiq (`apps/mobile`) utiliza o ecossistema Expo e o Metro Bundler. A resolução de dependências no Turborepo exige configurações customizadas no Metro para que os pacotes do monorepo (`@shared`, `@utils`, `@schemas`) sejam resolvidos corretamente fora do diretório padrão do aplicativo mobile.

## Configuração do Metro Bundler (`metro.config.js`)

Devido à estrutura de monorepo (Turborepo), o Metro precisa ser configurado com `watchFolders` para conseguir monitorar e fazer o *bundle* do código que vive fora de `apps/mobile`:

```js
// Exemplo de configuração essencial no metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Monitorar o workspace (raiz do Turborepo)
config.watchFolders = [workspaceRoot];

// 2. Garantir a resolução dos Node Modules no workspace
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Forçar a resolução de extensões nativas e ts/tsx
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
```

## Smoke Tests (EAS & Metro)

Antes da submissão para as lojas, validamos a integridade do bundle gerado pelo Metro. Nossos *Smoke Tests* focam em:

1. **Validação de Resolução de Path Aliases**: Verificar se imports de `@features` e `@schemas` são compreendidos pela camada mobile.
2. **Build Test (EAS Build Local)**: Rodar `eas build --profile development --platform android --local` para garantir que o Metro consegue emaranhar todos os assets sem quebrar.
3. **App Loader Check**: Garantir que o `App.tsx` não crashe no `SplashScreen.hideAsync()` por falha em providers ou hooks não resolvidos.

> [!WARNING]
> Nunca assuma que um código compartilhado no monorepo que funciona na Web (`apps/web` via Vite) funcionará diretamente no Mobile sem validar se não há dependência de APIs restritas do browser (ex: `window`, `localStorage`).

## Pipeline de Submissão (Release)

O processo de envio do App para as lojas (Google Play Console e Apple App Store) ocorre via **EAS (Expo Application Services)**.

### Pré-requisitos
- As variáveis de ambiente (EAS Secrets) devem estar atualizadas (URLs do Supabase, chaves de push).
- O número da versão (`version`) e o código do build (`android.versionCode` / `ios.buildNumber`) no `app.json` precisam estar *bumpados* seguindo a norma SQP `R-221`.

### Fluxo de Build e Submissão

1. **Lint e Tipagem**
   ```bash
   npm run lint --filter=mobile
   npm run tsc --filter=mobile
   ```

2. **Geração do Build (Produção)**
   ```bash
   eas build --platform all --profile production
   ```

3. **Submissão Automática (Submit)**
   Após o término do build, o próprio EAS pode empurrar os binários:
   ```bash
   eas submit -p android --latest
   eas submit -p ios --latest
   ```

### Considerações Finais
Toda atualização no código que impacte as stores de estado globais ou a comunicação com o Supabase deve ter seu Bundle verificado no emulador (via `npx expo start`) antes do comando de submit.
