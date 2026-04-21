// metro.config.js — resolve workspaces do monorepo
// Sem esta configuração, @dosiq/* não é encontrado pelo bundler

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Observar todos os packages do monorepo
config.watchFolders.push(workspaceRoot)

// Resolver node_modules tanto do mobile quanto da raiz do monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Permite o lookup hierárquico padrão (solicitado pelo Expo Doctor)
config.resolver.disableHierarchicalLookup = false

// Força o Metro a usar APENAS o React e React Native da pasta apps/mobile
// Isso evita o erro "Cannot read property 'useState' of null" por duplicidade
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (['react', 'react-native', '@react-native-async-storage/async-storage'].includes(name)) {
        return path.resolve(projectRoot, 'node_modules', name)
      }
      return target[name]
    },
  }
)

module.exports = config
