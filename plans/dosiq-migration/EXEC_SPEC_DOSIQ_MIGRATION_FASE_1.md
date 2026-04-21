# Exec Spec Fase 1: Fundação Node e Monorepo
> **Objetivo:** Renomear todos os pacotes e definições NPM do monorepo, adaptando toolings e scripts de build (`apps/*`, `packages/*`).

## 1. Escopo de Arquivos Modificados
- `package.json` (Raiz)
- `apps/web/package.json`
- `apps/mobile/package.json`
- `packages/core/package.json`
- `packages/design-tokens/package.json`
- `apps/web/vite.config.js`

## 2. Tarefas de Execução

### 2.1. package.json Raiz
- Alterar field `"name"` para `"dosiq"`.
- Em `"scripts"`, substituir chamadas `--workspace @meus-remedios/web` para `--workspace @dosiq/web` e equivalentes para Mobile e pacotes.

### 2.2. Workspaces Package.jsons
- Para cada `package.json` em `apps/` e `packages/`, mudar field `"name"` de `@meus-remedios/[nome]` para `@dosiq/[nome]`. Modificar logs descriptivos também (`"description": "Dosiq..."`).

### 2.3. Vite e Tollings Locais
- `apps/web/vite.config.js`: Em `resolve.alias`, atualizar `@meus-remedios/core` para apontar para `'../../packages/core/src'`, caso a chave do alias seja literal o nome do package. Alterar a chave do alias para `@dosiq/core` (e todos imports da codebase caso houver uso desse alias estrito).
- Procurar chamadas globais que importam via workspace old. `grep -rnw "@meus-remedios/" src/`

## 3. Validation Gate do Agente
- O Agente deve rodar um `npm install` limpo após editar `.json`s, forçando o regenerar do `package-lock.json`.
- O Agente deve rodar `npm run lint` para validar que nenhum path explodiu e os aliases bateram.
