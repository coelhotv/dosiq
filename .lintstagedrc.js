module.exports = {
  // Testes apenas dos arquivos em staged - suporte a monorepo
  "{apps/*/src,server,api}/**/*.{js,jsx,ts,tsx}": [
    "vitest related --run --passWithNoTests"
  ],

  // Lint em todos os arquivos staged JS/JSX/TS/TSX (incluindo apps, server e api)
  "**/*.{js,jsx,ts,tsx}": [
    "eslint --fix"
  ],

  // Prettier em arquivos de estilo e documentação
  "**/*.{css,md}": [
    "prettier --write --ignore-unknown"
  ],
}
