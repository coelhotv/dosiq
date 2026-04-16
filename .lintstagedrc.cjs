module.exports = {
  // Testes apenas dos arquivos em staged - máximo isolamento e agilidade
  "src/**/*.{js,jsx}": [
    "vitest related --run --passWithNoTests"
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
