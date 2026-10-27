// metro.config.js — resolve workspaces do monorepo
// Sem esta configuração, @dosiq/* não é encontrado pelo bundler

const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getSentryExpoConfig(projectRoot)

// Observar todos os packages do monorepo
config.watchFolders.push(workspaceRoot)

// Resolver node_modules tanto do mobile quanto da raiz do monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Worktrees do Claude Code vivem dentro do repo (workspaceRoot é observado por inteiro)
// e carregam node_modules próprios — duplicam react-native/metro no mapa de arquivos.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList || []),
  /[\\/]\.claude[\\/]worktrees[\\/].*/,
]

// Permite o lookup hierárquico padrão (solicitado pelo Expo Doctor)
config.resolver.disableHierarchicalLookup = false

// Resolve imports com extensão .js apontando para fontes .ts/.tsx (R-282).
// Packages src-cru (@dosiq/config, storage, shared-data) usam
// `./x.js` em código de bundler — Vite resolve nativamente, Metro não.
// Espelha esse comportamento fazendo o strip do .js quando existe o .ts/.tsx.
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js') && (moduleName.startsWith('./') || moduleName.startsWith('../'))) {
    const withoutExt = moduleName.slice(0, -3)
    try {
      return context.resolveRequest(context, withoutExt, platform)
    } catch {
      // cai no default abaixo (ex.: arquivo .js real)
    }
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform)
}

// Força o Metro a usar APENAS o React e React Native da pasta apps/mobile
// Isso evita o erro "Cannot read property 'useState' of null" por duplicidade
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (['react', 'react-native', '@react-native-async-storage/async-storage'].includes(name)) {
        // Resolve a partir do mobile (cópia local se houver; senão a hoisted na raiz)
        return path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot] }))
      }
      return target[name]
    },
  }
)

module.exports = config
