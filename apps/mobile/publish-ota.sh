#!/bin/bash
# publish-ota.sh — publica um update OTA assinado via EAS Update (spec 051-A · ADR-082/083)
# Uso: bash publish-ota.sh <preview|production> "<mensagem>" [rollout-%]
#
# Existe para que o checklist pré-publish (FR-015) seja um GATE EXECUTADO, não uma lista que
# alguém lê com pressa. Todo item abaixo já custou um incidente em algum projeto:
#   · esquecer --private-key-path        → update publicado SEM assinatura válida
#   · publicar com working tree sujo     → bundle com código que não existe em lugar nenhum
#   · publicar sem SHA na mensagem       → impossível saber depois o que foi ao ar (ADR-083 D4)
#   · errar o canal                      → teste destrutivo cai em cima de usuário real
#
# 🔴 O teste destrutivo do PO-5 (update que crasha de propósito) roda SEMPRE em `preview`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# release_tag_name, assert_clean_tree, head_is_pushed
. "$SCRIPT_DIR/lib-release-tag.sh"
. "$SCRIPT_DIR/lib-build-env.sh"

CHANNEL="${1:-}"
MESSAGE="${2:-}"
ROLLOUT="${3:-}"

usage() {
  echo "Uso: bash publish-ota.sh <preview|production> \"<mensagem>\" [rollout-%]"
  echo ""
  echo "  preview     canal de staging — alvo do smoke, incl. teste destrutivo"
  echo "  production  usuários reais — exige confirmação explícita"
  echo ""
  echo "Exemplos:"
  echo "  bash publish-ota.sh preview \"smoke 051 PR 1.6\""
  echo "  bash publish-ota.sh production \"fix do cálculo de estoque\" 1"
  exit 1
}

case "$CHANNEL" in
  preview|production) ;;
  *) usage ;;
esac

[ -n "$MESSAGE" ] || usage

# Rollout: inteiro de 1 a 100. Sem isto, `150` ou `abc` só estourariam no EAS — depois dos gates e
# do prompt de confirmação.
if [ -n "$ROLLOUT" ]; then
  case "$ROLLOUT" in
    ''|*[!0-9]*) echo "❌ Rollout inválido: '$ROLLOUT' (use um inteiro de 1 a 100)"; exit 1 ;;
  esac
  if [ "$ROLLOUT" -lt 1 ] || [ "$ROLLOUT" -gt 100 ]; then
    echo "❌ Rollout inválido: '$ROLLOUT' (use um inteiro de 1 a 100)"
    exit 1
  fi
fi

# Mesma CLI dos builds (eas global). Antes era `npx eas-cli@latest`: uma versão nova da CLI podia
# mudar flags no canal de produção sem ninguém ter pedido (ver a nota do --channel abaixo).
command -v eas >/dev/null 2>&1 || {
  echo "❌ eas-cli não encontrado no PATH. Instale: npm i -g eas-cli"
  exit 1
}

# ── Code signing: DESATIVADO (emenda ao ADR-083, 2026-07-27) ─────────────────────────────
# O EAS cobra assinatura de update no plano Enterprise, que o projeto não tem. Publicar com
# --private-key-path devolve erro do servidor, não um update assinado.
# O par de chaves segue guardado (DOSIQ_OTA_PRIVATE_KEY_PATH) para o dia em que houver plano.
# Enquanto isso a defesa do canal é: 2FA na conta Expo + publish manual PO-only + zero
# EXPO_TOKEN em CI. Ver §1.4 do docs/operations/GUIA_OTA_EAS_UPDATE.md.

# ── Gate 1: árvore limpa ────────────────────────────────────────────────────────
# O bundle publicado é fotografia da working tree AGORA. Working tree suja = código no ar que
# não corresponde a nenhum commit — irreproduzível e irrastreável.
assert_clean_tree "Working tree suja." \
  "O bundle publicado seria código que não existe em nenhum commit." \
  "Commite ou stashe antes de publicar." || exit 1

GIT_SHA="$(git rev-parse --short HEAD)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
APP_VERSION="$(get_app_version "$SCRIPT_DIR")"

# ── Gate 2: procedência do BUNDLE em production (R-307) ──────────────────────────────────
# O `eas update` empacota a WORKING TREE, não um commit. Publicar de uma `main` que já andou
# entrega TODAS as features não lançadas junto do fix — código não revisado, possivelmente
# chamando nativo que o binário instalado não tem (crash), e violação da Apple 3.3.1.
# A árvore precisa voltar a ser o que está na loja: tag de release, ou hotfix cortado dela.
# A tag é do FECHAMENTO do release train (release-tag.sh), não de cada build alpha: versão ainda
# sem tag = train aberto, e OTA de produção não sai. Para testar o mecanismo de OTA, use os canais
# `preview` e `device`. Guia: docs/operations/GUIA_RELEASE_TRAIN.md
if [ "$CHANNEL" = "production" ]; then
  RELEASE_TAG="$(release_tag_name "$APP_VERSION")"
  if ! git merge-base --is-ancestor "$RELEASE_TAG" HEAD 2>/dev/null; then
    echo "❌ HEAD não descende de $RELEASE_TAG — recusando publicar em production."
    echo ""
    echo "   O bundle é fotografia desta pasta AGORA. Se a árvore não for 'loja + o fix',"
    echo "   você entrega features não lançadas para todo mundo, sem revisão de loja."
    echo ""
    echo "   Fluxo correto:"
    echo "     git checkout -b hotfix/ota-$APP_VERSION $RELEASE_TAG"
    echo "     git cherry-pick <sha-do-fix>   # o fix já revisado e mergeado na main"
    echo "     bash publish-ota.sh preview \"...\"   # smoke primeiro"
    echo "     bash publish-ota.sh production \"...\""
    echo ""
    if ! git rev-parse -q --verify "refs/tags/$RELEASE_TAG" >/dev/null 2>&1; then
      echo "   ⚠️ A tag $RELEASE_TAG NÃO EXISTE. Ou o release train de $APP_VERSION ainda está"
      echo "      aberto (builds alpha não criam tag), ou o build foi feito antes da R-307 / de outra"
      echo "      máquina sem push da tag. Sem ela não há de onde partir:"
      echo "        · train fechado/promovido → bash release-tag.sh $APP_VERSION   (ou --commit <sha>)"
      echo "        · só testando OTA        → use o canal preview ou device, não production"
    fi
    exit 1
  fi
fi

# ── Gate 3: o commit publicado precisa existir no origin ─────────────────────────────────
# O SHA na mensagem é a trilha de auditoria (ADR-083 D4). Se o commit só existe nesta máquina, o
# SHA não se resolve em lugar nenhum — o OTA foi ao ar e ninguém consegue ver o que era.
# preview: só avisa (smoke local é legítimo) · production: bloqueia.
PUSHED_RC=0
head_is_pushed || PUSHED_RC=$?
if [ "$PUSHED_RC" -ne 0 ]; then
  if [ "$PUSHED_RC" -eq 2 ]; then
    PUSHED_MSG="Não consegui consultar o origin (offline?) — não dá para confirmar que $GIT_SHA foi publicado."
  else
    PUSHED_MSG="O commit $GIT_SHA não está em nenhum branch do origin."
  fi
  if [ "$CHANNEL" = "production" ]; then
    echo "❌ $PUSHED_MSG"
    echo "   Publicar em production com SHA irrastreável anula a trilha de auditoria (ADR-083 D4)."
    echo "   Faça:  git push -u origin $GIT_BRANCH"
    exit 1
  fi
  echo "⚠️  $PUSHED_MSG (preview: seguindo)"
fi

# SHA sempre na mensagem — é a trilha de auditoria exigida pelo ADR-083 D4.
FULL_MESSAGE="$MESSAGE [$GIT_SHA]"

# ── Resumo + confirmação ─────────────────────────────────────────────────────────────────
echo ""
echo "📡 --- PUBLICAÇÃO OTA ---"
echo "🎯 Canal:      $CHANNEL"
echo "📦 Runtime:    $APP_VERSION  (só alcança builds instalados nesta versão — ADR-082)"
echo "🌿 Branch:     $GIT_BRANCH @ $GIT_SHA"
echo "💬 Mensagem:   $FULL_MESSAGE"
echo "🔓 Assinatura: DESATIVADA (code signing exige plano EAS Enterprise — emenda ao ADR-083)"
if [ -n "$ROLLOUT" ]; then
  echo "📊 Rollout:    ${ROLLOUT}% dos devices"
else
  echo "📊 Rollout:    100% (imediato)"
fi
echo "--------------------------"

if [ "$CHANNEL" = "production" ]; then
  echo ""
  echo "🔴 ATENÇÃO: canal PRODUCTION — isto atinge usuários reais."
  echo "   Antes de confirmar, verifique:"
  echo "   · este mesmo bundle já foi validado em preview?"
  echo "   · a mudança é JS-only? (código nativo/SDK NÃO vai por OTA — exige build de loja)"
  echo "   · se pulou a escada de rollout, a justificativa está registrada?"
  echo ""
  read -r -p "Digite PUBLICAR para confirmar: " CONFIRM
  if [ "$CONFIRM" != "PUBLICAR" ]; then
    echo "Cancelado."
    exit 1
  fi
else
  read -r -p "Confirma? (Enter para publicar / Ctrl+C para cancelar) "
fi

# ── Publish ──────────────────────────────────────────────────────────────────────────────
# `--channel` SOZINHO, nunca junto de `--branch` (a CLI recusa os dois: "Cannot specify both").
# Entre os dois, o canal é o alvo correto: ele é o que o binário escuta, e o EAS resolve para a
# branch mapeada no momento. Publicar por `--branch` acertaria a branch nominal mesmo depois de um
# rollback ter repontado o canal para OUTRA branch (§4 do guia) — o update subiria com sucesso e
# não alcançaria device nenhum. Falha silenciosa, logo após um incidente, que é quando menos se
# pode pagar por uma.
ARGS=(update
  --channel "$CHANNEL"
  --message "$FULL_MESSAGE"
)

if [ -n "$ROLLOUT" ]; then
  ARGS+=(--rollout-percentage "$ROLLOUT")
fi

# Tudo vai para o log (o updateId devolvido precisa ir para o CHANGELOG, e no scrollback ele some).
# O terminal mostra a saída sem spinner/barras/inventário de assets. DOSIQ_BUILD_VERBOSE=1 mostra tudo.
OTA_LOG="$(build_log_path "$HOME/local/dev-builds" ota "$CHANNEL" "$APP_VERSION")"
mkdir -p "$(dirname "$OTA_LOG")"

echo ""
echo "🚀 Publicando... (log: $OTA_LOG)"
# shellcheck disable=SC2046  # flag vazia no modo verbose: precisa sumir, não virar argumento ""
if ! run_logged "$OTA_LOG" all "" eas "${ARGS[@]}" $(eas_noninteractive_flag); then
  echo ""
  echo "❌ eas update falhou. Fim do log ($OTA_LOG):"
  tail -40 "$OTA_LOG"
  exit 1
fi

echo ""
echo "✅ Publicado."
# O formato da saída do eas pode mudar; se nada casar, o log completo está no caminho abaixo.
UPDATE_IDS="$(grep -iE 'update (group )?id' "$OTA_LOG" | sed 's/\x1b\[[0-9;]*m//g' || true)"
if [ -n "$UPDATE_IDS" ]; then
  echo "🆔 IDs do update:"
  echo "$UPDATE_IDS" | sed 's/^/   /'
else
  echo "🆔 IDs do update: não identifiquei na saída — veja $OTA_LOG"
fi
echo "📋 Próximos passos:"
echo "   1. Anotar o updateId devolvido acima no CHANGELOG como [$APP_VERSION+ota.N] (ADR-082 —"
echo "      release OTA NÃO bumpa APP_VERSION)."
echo "   2. Reabrir o app 2x no device: o update baixa num launch e APLICA no seguinte."
echo "   3. Conferir o updateId na tela de Perfil (deve bater com o dashboard EAS)."
if [ "$CHANNEL" = "production" ] && [ -n "$ROLLOUT" ]; then
  echo "   4. Observar Sentry (erro por update_id) e PostHog (eventos chegando com o update novo)"
  echo "      antes de avançar o degrau:  eas update:edit --branch production"
fi
