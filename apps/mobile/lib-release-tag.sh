#!/bin/bash
# lib-release-tag.sh — procedência de binário de loja (R-307)
#
# Sourced por build-android.sh e build-ios.sh. Não executar direto.
#
# POR QUE EXISTE: `APP_VERSION` diz QUAL versão foi publicada, e nada diz QUAL CÓDIGO virou aquela
# versão. Sem esse elo, "rebuildar a 0.28.3 para investigar um bug" é arqueologia de git com
# chute de data — e publicar um hotfix por OTA é impossível, porque não há de onde partir (o OTA
# empacota a working tree, então ela precisa voltar a ser exatamente o que está na loja).
#
# A tag é criada NO MOMENTO DO BUILD porque é o único instante em que a informação existe sem
# ambiguidade. Reconstruir isso semanas depois é adivinhação.

# Nome canônico da tag de um build de loja.
release_tag_name() {
  echo "mobile-v$1"
}

# Pré-condições de um build de loja. Chamar ANTES de compilar — falhar depois de 20 minutos de
# gradle é desperdício, e falhar DEPOIS do submit é tarde demais.
assert_taggable_build() {
  local app_version="$1"
  local tag; tag="$(release_tag_name "$app_version")"

  # 1. Árvore limpa. Binário compilado de árvore suja é irrastreável: a tag apontaria para um
  #    commit cujo código NÃO é o que está no aparelho do usuário. Mesma classe do gate do
  #    publish-ota.sh — e aqui é pior, porque binário de loja não se corrige por OTA.
  if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "❌ Build de PRODUÇÃO exige working tree limpa."
    echo "   O binário seria compilado de um estado que não existe em commit nenhum — e a tag"
    echo "   $tag apontaria para um código diferente do que vai para a loja."
    echo ""
    git status --short
    echo ""
    echo "   Commite ou stashe antes de buildar."
    return 1
  fi

  # 2. Colisão de tag = versão não bumpada. Se a tag já existe em OUTRO commit, alguém mudou
  #    código sem bumpar APP_VERSION — e duas builds diferentes passariam a se chamar igual,
  #    destruindo justamente a rastreabilidade que a tag existe para dar (R-221 §4).
  # `^{}` desreferencia a tag: sem isso, uma tag ANOTADA resolve para o objeto de tag (sha próprio,
  # nunca igual a um commit) e toda revalidação do mesmo commit acusaria colisão falsa — bloqueando
  # justamente o build da segunda plataforma, que é o caso idempotente que este gate deve permitir.
  local existing; existing="$(git rev-parse -q --verify "refs/tags/$tag^{}" 2>/dev/null || true)"
  local head_sha; head_sha="$(git rev-parse HEAD)"

  if [ -n "$existing" ] && [ "$existing" != "$head_sha" ]; then
    echo ""
    echo "❌ A tag $tag já existe em OUTRO commit:"
    echo "   tag aponta para : $existing"
    echo "   HEAD atual      : $head_sha"
    echo ""
    echo "   Isso significa que o código mudou desde aquele build mas APP_VERSION não bumpou."
    echo "   Bumpe APP_VERSION no app.config.js (R-221 §4) — não mova a tag."
    return 1
  fi

  return 0
}

# Cria (idempotente) e publica a tag. Chamar DEPOIS do build ter gerado o artefato.
# Idempotência importa: iOS e Android do MESMO commit compartilham UMA tag; o segundo script a
# rodar encontra a tag já criada e apenas confirma.
create_release_tag() {
  local app_version="$1"
  local tag; tag="$(release_tag_name "$app_version")"
  local head_sha; head_sha="$(git rev-parse HEAD)"
  local existing; existing="$(git rev-parse -q --verify "refs/tags/$tag^{}" 2>/dev/null || true)"

  if [ "$existing" = "$head_sha" ]; then
    echo "🏷️  Tag $tag já existe neste commit (build da outra plataforma) — nada a fazer."
  else
    git tag -a "$tag" -m "Build de loja mobile $app_version"
    echo "🏷️  Tag $tag criada em $(git rev-parse --short HEAD)"
  fi

  # Tag só local é tag perdida: some com a máquina e não existe para mais ninguém. Falha de rede
  # não pode derrubar um build que já terminou — avisa e segue, com o comando pronto para repetir.
  if git push origin "$tag" 2>/dev/null; then
    echo "🏷️  Tag $tag publicada no origin"
  else
    echo "⚠️  Não consegui publicar a tag no origin (offline? sem permissão?)."
    echo "   Rode quando puder — tag só local não serve para reproduzir build em outra máquina:"
    echo "     git push origin $tag"
  fi
}
