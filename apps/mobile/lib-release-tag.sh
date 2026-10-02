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

# assert_clean_tree <título> <explicação> <ação>
# Gate de árvore limpa, compartilhado por build de loja e publish OTA (ambos fotografam a working
# tree). Retorna 1 (não faz exit) para o chamador decidir.
assert_clean_tree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "❌ $1"
    echo "   $2"
    echo ""
    git status --short
    echo ""
    echo "   $3"
    return 1
  fi
  return 0
}

# head_is_pushed
# 0 = HEAD existe em algum branch remoto. Faz fetch antes (o cache local de refs remotas mente);
# retorna 2 se o fetch falhar (offline) — "não sei" é diferente de "não está".
head_is_pushed() {
  git fetch origin --quiet 2>/dev/null || return 2
  [ -n "$(git branch -r --contains HEAD 2>/dev/null)" ]
}

# Pré-condições de um build de loja. Chamar ANTES de compilar — falhar depois de 20 minutos de
# gradle é desperdício, e falhar DEPOIS do submit é tarde demais.
assert_taggable_build() {
  local app_version="$1"
  local tag; tag="$(release_tag_name "$app_version")"

  # 1. Árvore limpa. Binário compilado de árvore suja é irrastreável: a tag apontaria para um
  #    commit cujo código NÃO é o que está no aparelho do usuário. Mesma classe do gate do
  #    publish-ota.sh — e aqui é pior, porque binário de loja não se corrige por OTA.
  assert_clean_tree "Build de PRODUÇÃO exige working tree limpa." \
    "O binário seria compilado de um estado que não existe em commit nenhum — e a tag
   $tag apontaria para um código diferente do que vai para a loja." \
    "Commite ou stashe antes de buildar." || return 1

  # 1b. HEAD precisa existir no origin. O push da tag (create_release_tag) roda com --no-verify —
  #     a suíte de testes já foi o gate do push do commit — e isso só é seguro se a tag não
  #     carregar commit novo junto. Offline também bloqueia: não dá para provar.
  local pushed_rc=0
  head_is_pushed || pushed_rc=$?
  if [ "$pushed_rc" -ne 0 ]; then
    echo ""
    if [ "$pushed_rc" -eq 2 ]; then
      echo "❌ Não consegui consultar o origin (offline?) — não dá para confirmar que o commit foi publicado."
    else
      echo "❌ O commit $(git rev-parse --short HEAD) não está em nenhum branch do origin."
    fi
    echo "   Build de loja sai de commit já publicado (passou pelo gate do push). Faça:"
    echo "     git push origin $(git rev-parse --abbrev-ref HEAD)"
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
  #
  # Já está no origin neste commit (build da outra plataforma)? Nada a empurrar. Antes o push era
  # incondicional e, como a tag dispara o hook pre-push, a suíte inteira rodava de novo (~2 min).
  local remote_sha
  remote_sha="$(git ls-remote origin "refs/tags/$tag^{}" 2>/dev/null | awk '{print $1}')"
  if [ -n "$remote_sha" ] && [ "$remote_sha" = "$head_sha" ]; then
    echo "🏷️  Tag $tag já publicada no origin — nada a empurrar."
    return 0
  fi

  # --no-verify: o hook pre-push roda `test:critical` e não olha o que está sendo enviado. Aqui o
  # push é só da tag, e assert_taggable_build já exigiu o commit publicado (que passou pelo hook).
  # Saída capturada: o motivo real da falha não pode ser engolido (antes: 2>/dev/null).
  local push_out
  if push_out="$(git push --no-verify origin "$tag" 2>&1)"; then
    echo "🏷️  Tag $tag publicada no origin"
  else
    echo "$push_out" | tail -5
    echo "⚠️  Não consegui publicar a tag no origin (offline? sem permissão? veja acima)."
    echo "   Rode quando puder — tag só local não serve para reproduzir build em outra máquina:"
    echo "     git push --no-verify origin $tag"
  fi
}
