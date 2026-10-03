#!/bin/bash
# lib-release-tag.sh — procedência de binário de loja e tag de release train (R-307)
#
# Sourced por build-ios.sh, build-android.sh, publish-ota.sh e release-tag.sh. Não executar direto.
# Guia completo: docs/operations/GUIA_RELEASE_TRAIN.md
#
# MODELO (emenda 2026-10-02 à R-307): "build de loja" e "release" são coisas diferentes.
#
#   · BUILD `production` (TestFlight / closed testing / alpha) → NÃO cria tag. Exige árvore limpa e
#     commit já publicado, e REGISTRA a procedência (sidecar .json + ledger builds.jsonl) —
#     `record_build_provenance`. Assim "qual commit virou este binário?" tem resposta sem tag.
#   · FECHAMENTO DO RELEASE TRAIN → cria a tag `mobile-v<versão>` no commit que foi COMPILADO e
#     promovido — `release-tag.sh` → `create_release_tag`. A tag é o marco do release, não do build.
#
# Por que a tag saiu do build: o mesmo perfil `production` serve a builds alpha repetidos de uma
# versão em desenvolvimento; tag no build obrigava a bumpar versão ou a conviver com colisão a cada
# alpha, e a tag (que o gate do OTA de produção usa como âncora) deixava de significar "release".
#
# A tag continua respondendo UMA pergunta (R-307 §3b): qual código virou este binário. Por isso ela
# marca o commit compilado, nunca o HEAD do dia.

# Ledger local de builds de loja (um JSON por linha). Sobrescrevível para teste.
build_ledger_path() {
  echo "${DOSIQ_BUILD_LEDGER:-$HOME/local/dev-builds/builds.jsonl}"
}

# Nome canônico da tag de um release.
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

# Pré-condições de um build de loja (alpha ou release). Chamar ANTES de compilar — falhar depois de
# 20 minutos de gradle é desperdício.
#
# Não toca em tag: tag é do fechamento do release train (release-tag.sh).
assert_store_build_ready() {
  local app_version="$1"

  # 1. Árvore limpa. Binário compilado de árvore suja é irrastreável: o SHA registrado apontaria
  #    para um commit cujo código NÃO é o que está no aparelho do testador. Mesma classe do gate do
  #    publish-ota.sh — e aqui é pior, porque binário de loja não se corrige por OTA.
  assert_clean_tree "Build de loja exige working tree limpa." \
    "O binário seria compilado de um estado que não existe em commit nenhum — e o SHA registrado
   para v$app_version apontaria para um código diferente do que vai para a loja." \
    "Commite ou stashe antes de buildar." || return 1

  # 2. HEAD precisa existir no origin: o SHA registrado só ajuda se resolver em outra máquina, e o
  #    release-tag.sh depois só aceita commit publicado. Offline também bloqueia: não dá para provar.
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

  return 0
}

# ledger_latest_sha <versão> <ios|android>
# SHA do build `production` mais recente dessa versão e plataforma (vazio se nunca houve).
# Ordem dos campos no ledger é fixa (ver record_build_provenance) — por isso o grep literal.
ledger_latest_sha() {
  local ledger; ledger="$(build_ledger_path)"
  [ -f "$ledger" ] || return 0
  grep -F "\"version\":\"$1\",\"platform\":\"$2\",\"profile\":\"production\"" "$ledger" \
    | tail -1 | sed -n 's/.*"sha":"\([0-9a-f]*\)".*/\1/p' || true
}

# record_build_provenance <ios|android> <perfil> <versão> <caminho-do-artefato>
# Registra QUAL COMMIT virou este binário — no lugar da tag, que agora é do fechamento do train.
# Grava um sidecar `<artefato>.json` e uma linha em builds.jsonl. Se o último build da OUTRA
# plataforma da mesma versão veio de outro commit, AVISA (não bloqueia): era a colisão de tag da
# R-307 antiga, agora informativa — o release-tag.sh é quem exige coerência ao fechar o train.
record_build_provenance() {
  local platform="$1" profile="$2" version="$3" artifact="$4"
  local sha branch ts ledger sidecar line
  sha="$(git rev-parse HEAD)"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  ledger="$(build_ledger_path)"
  sidecar="$artifact.json"

  line="{\"ts\":\"$ts\",\"version\":\"$version\",\"platform\":\"$platform\",\"profile\":\"$profile\",\"sha\":\"$sha\",\"branch\":\"$branch\",\"artifact\":\"$(basename "$artifact")\"}"

  mkdir -p "$(dirname "$ledger")"
  echo "$line" >> "$ledger"
  echo "$line" > "$sidecar"
  echo "🧾 Procedência registrada: v$version ($platform) = $(git rev-parse --short HEAD) [$branch]"
  echo "   sidecar: $sidecar"
  echo "   ledger:  $ledger"

  local other other_sha
  if [ "$platform" = "ios" ]; then other="android"; else other="ios"; fi
  other_sha="$(ledger_latest_sha "$version" "$other")"
  if [ -n "$other_sha" ] && [ "$other_sha" != "$sha" ]; then
    echo "⚠️  O build $other de v$version foi feito de OUTRO commit ($(echo "$other_sha" | cut -c1-8))."
    echo "   Ao fechar o release train, release-tag.sh vai exigir que você escolha o commit (--commit)."
  fi
}

# create_release_tag <versão> [commit]
# Cria (idempotente) e publica `mobile-v<versão>` no commit dado (padrão: HEAD). Chamado pelo
# release-tag.sh. Tag só local é tag perdida: some com a máquina — falha de rede avisa e segue, com
# o comando pronto para repetir.
create_release_tag() {
  local app_version="$1" commit="${2:-HEAD}"
  local tag; tag="$(release_tag_name "$app_version")"
  local sha; sha="$(git rev-parse --verify "$commit^{commit}")"
  local existing; existing="$(git rev-parse -q --verify "refs/tags/$tag^{}" 2>/dev/null || true)"

  if [ "$existing" = "$sha" ]; then
    echo "🏷️  Tag $tag já existe neste commit — nada a criar."
  else
    git tag -a "$tag" "$sha" -m "Release mobile $app_version"
    echo "🏷️  Tag $tag criada em $(git rev-parse --short "$sha")"
  fi

  # Já está no origin neste commit? Nada a empurrar.
  local remote_sha
  remote_sha="$(git ls-remote origin "refs/tags/$tag^{}" 2>/dev/null | awk '{print $1}')"
  if [ -n "$remote_sha" ] && [ "$remote_sha" = "$sha" ]; then
    echo "🏷️  Tag $tag já publicada no origin — nada a empurrar."
    return 0
  fi

  # --no-verify: o hook pre-push roda `test:critical` e não olha o que está sendo enviado. Aqui o
  # push é só da tag, e o release-tag.sh já exigiu o commit publicado (que passou pelo hook).
  # Saída capturada: o motivo real da falha não pode ser engolido.
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
