// Root é ESM (`"type": "module"`): este arquivo era `.js` com `module.exports` e NUNCA
// carregou — só apareceu quando o hook voltou a rodar de verdade.
export default {
  // Testes apenas dos arquivos em staged - suporte a monorepo
  "{apps/*/src,server,api}/**/*.{js,jsx,ts,tsx}": [
    "vitest related --run --passWithNoTests"
  ],

  // Lint em todos os arquivos staged JS/JSX/TS/TSX (incluindo apps, server e api)
  "**/*.{js,jsx,ts,tsx}": [
    "eslint --fix"
  ],

  // Prettier SÓ em estilo. Markdown ficou de fora de propósito: `docs/`, `CLAUDE.md` e
  // `.agent/memory/**` são escritos à mão com quebra de linha e tabelas densas intencionais —
  // `prettier --write` reflui tudo e polui o diff de conhecimento. Reativar isto foi o que
  // manteve o hook inteiro desligado (e imprimindo sucesso falso — AP-325).
  "**/*.css": [
    "prettier --write --ignore-unknown"
  ],
}
