#!/bin/bash
# release-tag.sh — fecha o release train: cria e publica a tag `mobile-v<versão>` (R-307)
# Uso: bash release-tag.sh <versão> [--commit <sha>] [--yes]
#
# QUANDO USAR: ao FECHAR um release train — a versão foi planejada, acumulou as features, e o build
# que foi (ou vai ser) promovido para produção nas lojas está decidido. NÃO rode a cada build alpha
# (TestFlight / closed testing): builds `production` não criam tag, só registram procedência.
#
# O QUE FAZ:
#   1. Descobre o commit COMPILADO: o do ledger (~/local/dev-builds/builds.jsonl) para essa versão —
#      iOS e Android precisam coincidir; senão, escolha com --commit. A tag marca o commit
#      compilado, nunca o HEAD do dia (R-307 §3b).
#   2. Confere que o app.config.js daquele commit declara exatamente essa versão, que o commit está
#      no origin e que a tag não existe em OUTRO commit (versão já fechada → bumpe, nunca mova a tag).
#   3. Mostra o resumo, pede confirmação, cria a tag anotada e a publica (--no-verify: não reroda a
#      suíte de testes para um push que só leva a tag).
#
# Efeito a jusante: `publish-ota.sh production` só aceita HEAD que descende desta tag (R-307 §4).
# Guia: docs/operations/GUIA_RELEASE_TRAIN.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
. "$SCRIPT_DIR/lib-release-tag.sh"

usage() {
  echo "Uso: bash release-tag.sh <versão> [--commit <sha>] [--yes]"
  echo ""
  echo "  <versão>        APP_VERSION do release (ex.: 0.34.0)"
  echo "  --commit <sha>  commit compilado, se o ledger não resolver (padrão: SHA do ledger)"
  echo "  --yes           não pede confirmação"
  echo ""
  echo "Exemplo:  bash release-tag.sh 0.34.0"
  exit 1
}

VERSION=""
COMMIT=""
YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --commit) [ $# -ge 2 ] || usage; COMMIT="$2"; shift 2 ;;
    --yes) YES=1; shift ;;
    -*) echo "❌ Flag desconhecida: '$1'"; usage ;;
    *) [ -z "$VERSION" ] || usage; VERSION="$1"; shift ;;
  esac
done

[ -n "$VERSION" ] || usage
case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "❌ Versão inválida: '$VERSION' (esperado X.Y.Z)"; exit 1 ;;
esac

TAG="$(release_tag_name "$VERSION")"

git fetch origin --quiet 2>/dev/null || { echo "❌ Não consegui consultar o origin (offline?) — a tag precisa ser verificada contra ele."; exit 1; }

# ── 1. Qual commit foi compilado? ────────────────────────────────────────────────────────────
SOURCE="--commit"
if [ -z "$COMMIT" ]; then
  IOS_SHA="$(ledger_latest_sha "$VERSION" ios)"
  ANDROID_SHA="$(ledger_latest_sha "$VERSION" android)"

  if [ -z "$IOS_SHA" ] && [ -z "$ANDROID_SHA" ]; then
    echo "❌ Nenhum build production de v$VERSION no ledger ($(build_ledger_path))."
    echo "   Builds feitos antes do ledger, ou em outra máquina, não estão lá. Informe o commit:"
    echo "     bash release-tag.sh $VERSION --commit <sha-do-commit-compilado>"
    exit 1
  fi
  if [ -n "$IOS_SHA" ] && [ -n "$ANDROID_SHA" ] && [ "$IOS_SHA" != "$ANDROID_SHA" ]; then
    echo "❌ iOS e Android de v$VERSION foram compilados de commits DIFERENTES:"
    echo "   ios     : $IOS_SHA"
    echo "   android : $ANDROID_SHA"
    echo "   Uma tag marca um commit só. Escolha o que representa o release:"
    echo "     bash release-tag.sh $VERSION --commit <sha>"
    exit 1
  fi
  COMMIT="${IOS_SHA:-$ANDROID_SHA}"
  if [ -n "$IOS_SHA" ] && [ -n "$ANDROID_SHA" ]; then
    SOURCE="ledger (iOS e Android coincidem)"
  elif [ -n "$IOS_SHA" ]; then
    SOURCE="ledger (só iOS — não há build Android registrado)"
  else
    SOURCE="ledger (só Android — não há build iOS registrado)"
  fi
fi

SHA="$(git rev-parse --verify -q "$COMMIT^{commit}")" || {
  echo "❌ Commit '$COMMIT' não existe neste repositório. (git fetch origin? build de outra máquina?)"
  exit 1
}

# ── 2. Sanidade ──────────────────────────────────────────────────────────────────────────────
# 2a. O app.config.js DAQUELE commit declara essa versão — senão a tag mentiria sobre a versão.
AT_VERSION="$(git show "$SHA:apps/mobile/app.config.js" 2>/dev/null \
  | sed -n "s/^const APP_VERSION = '\([0-9.]*\)'.*/\1/p" | head -1)"
if [ "$AT_VERSION" != "$VERSION" ]; then
  echo "❌ O commit $(git rev-parse --short "$SHA") declara APP_VERSION='${AT_VERSION:-?}', não '$VERSION'."
  echo "   Confira o commit (--commit) ou a versão."
  exit 1
fi

# 2b. Commit no origin: tag apontando para commit que só existe aqui é tag que ninguém resolve.
if [ -z "$(git branch -r --contains "$SHA" 2>/dev/null)" ]; then
  echo "❌ O commit $(git rev-parse --short "$SHA") não está em nenhum branch do origin."
  echo "   Publique antes:  git push origin <branch>"
  exit 1
fi

# 2c. Tag existente em OUTRO commit = versão já fechada. Nunca mover (R-307 §3).
EXISTING_LOCAL="$(git rev-parse -q --verify "refs/tags/$TAG^{}" 2>/dev/null || true)"
EXISTING_REMOTE="$(git ls-remote origin "refs/tags/$TAG^{}" 2>/dev/null | awk '{print $1}')"
for existing in "$EXISTING_LOCAL" "$EXISTING_REMOTE"; do
  if [ -n "$existing" ] && [ "$existing" != "$SHA" ]; then
    echo "❌ A tag $TAG já existe em OUTRO commit ($existing)."
    echo "   Essa versão já foi fechada com outro código. Bumpe APP_VERSION (R-221 §4) — não mova a tag."
    exit 1
  fi
done

# 2d. Fora da história da main? Informativo: acontece quando o build saiu do branch do PR e o PR foi
#     squash-mergeado. A tag marca o commit COMPILADO (R-307 §3b), então isso é aceito.
ON_MAIN="sim"
git merge-base --is-ancestor "$SHA" origin/main 2>/dev/null || ON_MAIN="NÃO (squash do PR?)"

# ── 3. Resumo + confirmação ──────────────────────────────────────────────────────────────────
echo ""
echo "🚆 --- FECHAMENTO DE RELEASE TRAIN ---"
echo "🏷️  Tag:        $TAG"
echo "📦 Versão:     $VERSION"
echo "🔗 Commit:     $(git log -1 --format='%h %s' "$SHA")"
echo "🧾 Origem:     $SOURCE"
echo "🌿 Na main:    $ON_MAIN"
echo "---------------------------------------"
if [ "$ON_MAIN" != "sim" ]; then
  echo "ℹ️  O commit compilado não está na história da main. É esperado após squash; a tag fica"
  echo "   sobre o commit COMPILADO e o fluxo de hotfix OTA parte dela, não da main."
fi
if [ "$YES" -eq 0 ]; then
  read -r -p "Fechar o release train v$VERSION com esta tag? (Enter para criar / Ctrl+C para cancelar) "
fi

create_release_tag "$VERSION" "$SHA"

echo ""
echo "✨ Release train v$VERSION fechado."
echo "📋 O OTA de produção desta versão agora só sai de $TAG ou de hotfix/ota-* cortado dela"
echo "   (GUIA_OTA_EAS_UPDATE.md §6)."
