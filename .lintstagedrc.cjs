module.exports = {
  // Testes apenas dos arquivos em staged - rápido
  "src/**/*.{js,jsx}": [
    "vitest run --changed --passWithNoTests"
  ],

  // Lint em todos os arquivos staged JS/JSX
  "*.{js,jsx}": [
    "eslint --fix"
  ],

  // Prettier em arquivos de estilo e documentação
  "*.{css,md}": [
    "bash scripts/prettier-if-present.sh"
  ],
}
