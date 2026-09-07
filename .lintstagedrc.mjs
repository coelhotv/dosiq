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

  // Gate de frescor do índice compilado de memória (spec 079). O FILTRO POR DIFF É ESTE GLOB:
  // o lint-staged só dispara o comando quando um `.md` de `.agent/memory/` está staged, então
  // commit que não toca memória não paga nada — sem uma linha de `git diff | grep` escrita à mão,
  // que é a superfície onde o AP-325 nasceu neste repo.
  //
  // FUNÇÃO, e não string, de propósito: o lint-staged anexa a lista de arquivos staged ao fim do
  // comando, e o `--check` opera sobre o ACERVO INTEIRO, não sobre um subconjunto. O `parseArgs`
  // do script ignora argumento desconhecido e engoliria a lista sem erro — depender disso seria
  // acoplamento silencioso entre dois arquivos que ninguém lê junto.
  //
  // Não há mensagem de sucesso aqui: a única saída positiva é a do próprio script
  // ("índice em dia (sourceHash …)"), que não existe se ele não rodou. É o AP-325 neutralizado
  // por construção — não há string de sucesso escrita pelo hook que possa mentir.
  // ⚠️ LIMITE MEDIDO, não suposto: o `--check` compara o DISCO com o índice EM DISCO — não o que
  // está sendo commitado. Recompilar e esquecer o `git add` do índice deixa o commit passar com o
  // artefato versionado velho (verificado em branch descartável: commit exit=0 com só a memória no
  // diff). Fechar isso exigiria `git diff --cached` dentro do hook, que é a lógica à mão que este
  // desenho evita de propósito. O que o gate garante é "o disco é consistente", não "o commit é".
  ".agent/memory/**/*.md": () => "node scripts/compile-memory-index.mjs --check"
}
