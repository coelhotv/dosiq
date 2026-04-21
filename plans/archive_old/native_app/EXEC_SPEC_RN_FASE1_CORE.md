# Exec Spec: Fase 1 (Fundação do Monorepo e Extração do Core)

> **SUPERSEDIDO EM 2026-03-29:** Este exec spec foi substituído por `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`. Não executar esta fase isoladamente sem reconciliar com o documento definitivo.

## Contexto e Objetivo
Garantir a transformação da aplicação PWA existente (Vite) em um Monorepo gerenciado pelo Turborepo, isolando as lógicas de backend, domínio (`schemas`), tipagens e serviços Supabase no pacote `@dosiq/core`.

A PWA continuará com build ativo sem downtime na Vercel ao fim desta fase. NENHUM recurso React Native será embarcado aqui. Tudo é focado estruturalmente em Node/JS para suporte das próximas fases.

Atenção especial à regra `R-001` (Nomes Duplicados) e `R-117` (Perf Mobile): Extrações de módulos não podem corromper as estruturas atuais dos arquivos importados e testados.

---

## Sprint 1.1: Setup Turborepo e Migração Estrutural Web
**Meta:** O diretório alvo atual via `src/` virar `apps/web/src/`. O `apps/web` hospedará unicamente a camada UI Desktop.

### 1. Criar `turbo.json` Root
O `turbo.json` deve estar explícito na raiz do repositório, mapeando e cacheando os pipelines fundamentais:
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "dist-ssr/**"]
    },
    "lint": {},
    "test": {},
    "validate:agent": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 2. Preparar package.json (npm workspaces)
Substituir cirurgicamente o `package.json` raiz para hospedar workspace packages:
```json
{
  "name": "dosiq-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "validate:agent": "turbo run validate:agent"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### 3. Migrar Pasta PWA Inteiramente
Os agentes devem rodar a contenção pura dos projetos:
```bash
mkdir -p apps/web
mv src public index.html vite.config.js apps/web/
```
E clonar as diretrizes do lint.

---

## Sprint 1.2: Isolamento de Domínio (`packages/core`)
**Meta:** Transferir a inteligência (Node/Zod) para que Web e Mobile dividam o single-source-of-truth, sem redundâncias futuras de código.

### 1. Criar a Estrutura Core Oculta
Dentro de `packages/core/src`, criar:
```bash
mkdir -p packages/core/src/{schemas,services,utils}
```

### 2. Popular Package Core
Mover com cuidado e refatorar imports legados:
```bash
mv apps/web/src/schemas/* packages/core/src/schemas/
mv apps/web/src/utils/dateUtils.js packages/core/src/utils/
mv apps/web/src/features/*/services/*.js packages/core/src/services/
```
*(Critério Agent-AI: Analisar em loop `grep` qualquer import interno quebrado pelas mudanças de subdiretório).*

### 3. O `.json` Central do Core (`@dosiq/core`)
```json
{
  "name": "@dosiq/core",
  "version": "1.0.0",
  "main": "src/index.js",
  "dependencies": {
    "zod": "^3.22.4",
    "@supabase/supabase-js": "^2.39.0",
    "date-fns": "^3.3.1"
  }
}
```

---

## Sprint 1.3: Linkagem e Validação Automática
**Meta:** A PWA (`apps/web`) deve ler os hooks globalmente como `@dosiq/core` via alias/symlink.

### 1. Refatorar Alias Absolutos do Vite
No arquivo `apps/web/vite.config.js`, o `resolve.alias` (como `@schemas`) não apontará para seu diretório `./src` interior, mas importará o módulo compartilhado do NPM symlink.
Mapeamentos de script (`sed`) em toda branch Web (`apps/web/src/**/*.jsx`) devem substituir os paths `import X from "../../schemas/x"` para consumirem a sub-interface via pacote npm: `import { X } from '@dosiq/core/schemas'`.

### 2. Revalidação Critica do Command
**Critério de Sucesso do Robô:**
```bash
cd apps/web && npm install
npm run test:critical
npm run build
```
O Vercel Pipeline CI/CD não aceita repositórios quebrando compilação DOM por imports extraviados. Todos os `Test:Critical` (Testes Vitest) de schemas que outrora habitavam `/src` devem executar sem erros importando lógicas via monorepo Turborepos linkados nativamente.
