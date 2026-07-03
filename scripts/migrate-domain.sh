#!/usr/bin/env bash
# =============================================================================
# migrate-domain.sh — 040 TypeScript Migration (Dosiq)
#
# Migra UM domínio (diretório) de JS→TS de forma mecânica e barata:
#   1. git mv  *.js/*.jsx → *.ts/*.tsx (JSX detectado por conteúdo, não extensão)
#   2. Reescreve import specifiers com extensão explícita que apontam para os
#      arquivos renomeados (repo-wide, best-effort — tsc é a autoridade final)
#   3. Dump de erros: tsc --noEmit + lint (saída agrupada = input do modelo)
#
# Uso:
#   ./migrate-domain.sh <dir> [--tsconfig <path>] [--dry-run]
# Exemplos:
#   ./migrate-domain.sh packages/core/src/repositories --tsconfig packages/core/tsconfig.json
#   ./migrate-domain.sh apps/web/src/features/stock --tsconfig apps/web/tsconfig.json
#   ./migrate-domain.sh apps/mobile/src/shared --tsconfig apps/mobile/tsconfig.json --dry-run
#
# Regras:
#   - Roda da RAIZ do repo, working tree LIMPA (commit/stash antes).
#   - NÃO toca: configs de tooling (babel/metro/app.config/vite/vitest/eslint),
#     service-worker.js, arquivos fora do dir alvo (exceto imports que apontam
#     para os renomeados).
#   - Specifiers relativos ficam SEM extensão (bundler resolution: Vite/Metro/
#     tsx/esbuild resolvem; manter '.js' quebraria o resolve do Vite p/ .ts).
#   - O script é 90% — os erros residuais de tsc/lint são o trabalho do modelo.
# =============================================================================
set -euo pipefail

DOMAIN="${1:?uso: migrate-domain.sh <dir> [--tsconfig <path>] [--dry-run]}"
shift || true
TSCONFIG=""
DRY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tsconfig) TSCONFIG="$2"; shift 2 ;;
    --dry-run)  DRY=1; shift ;;
    *) echo "arg desconhecido: $1" >&2; exit 1 ;;
  esac
done

[[ -d "$DOMAIN" ]] || { echo "ERRO: dir não existe: $DOMAIN" >&2; exit 1; }
# gitdir pode ser externo (arquivo .git, não dir) — usar o git mesmo
[[ "$(git rev-parse --show-toplevel 2>/dev/null)" == "$(pwd)" ]] || { echo "ERRO: rodar da raiz do repo" >&2; exit 1; }
if [[ $DRY -eq 0 && -n "$(git status --porcelain)" ]]; then
  echo "ERRO: working tree suja — commit/stash antes de migrar" >&2; exit 1
fi

# Exclusões (nunca migrar)
EXCLUDE_RE='(service-worker\.js|babel\.config\.js|metro\.config\.js|app\.config\.js|vite\.config\.js|vitest\..*\.config\.js|eslint\.config\.js|\.lintstagedrc)'

echo "== 040 migrate-domain: $DOMAIN (dry-run=$DRY) =="

# -----------------------------------------------------------------------------
# 1) Coleta + rename (JSX por conteúdo: presença de tag de fechamento/self-close)
# -----------------------------------------------------------------------------
RENAMED_LIST="$(mktemp)"
while IFS= read -r f; do
  base="$(basename "$f")"
  [[ "$base" =~ $EXCLUDE_RE ]] && { echo "  skip (excluído): $f"; continue; }

  ext="ts"
  # JSX heurística: '</' ou '/>' fora de comentário simples. Falso-positivo raro;
  # tsc acusa e o modelo corrige o rename manualmente.
  if grep -qE '(<\/[A-Za-z]|\/>)' "$f"; then ext="tsx"; fi
  # testes seguem o código: .test.js → .test.ts(x)
  stem="${f%.*}"
  target="${stem}.${ext}"

  echo "  $f -> $target"
  if [[ $DRY -eq 0 ]]; then git mv "$f" "$target"; fi
  # registra stem relativo p/ reescrita de imports (sem extensão)
  echo "$stem" >> "$RENAMED_LIST"
done < <(find "$DOMAIN" -type f \( -name '*.js' -o -name '*.jsx' \) | sort)

COUNT=$(wc -l < "$RENAMED_LIST" | tr -d ' ')
echo "== renomeados: $COUNT arquivos =="
[[ "$COUNT" -eq 0 ]] && { echo "nada a migrar"; exit 0; }
[[ $DRY -eq 1 ]] && { echo "(dry-run: parando antes da reescrita de imports)"; exit 0; }

# -----------------------------------------------------------------------------
# 2) Reescrita de imports repo-wide (só specifiers que terminam no arquivo
#    renomeado, com extensão explícita). Best-effort por basename — colisões
#    de nome em dirs diferentes são raras e o tsc acusa.
# -----------------------------------------------------------------------------
echo "== reescrevendo import specifiers =="
SRC_GLOBS=(apps/web/src apps/mobile/src packages server api)
while IFS= read -r stem; do
  name="$(basename "$stem")"
  # from './name.js' | '../x/name.jsx' | "@alias/.../name.js" → sem extensão
  pattern="s#(from[[:space:]]+['\"][^'\"]*/${name})\.(js|jsx)(['\"])#\1\3#g; \
           s#(import\(['\"][^'\"]*/${name})\.(js|jsx)(['\"])#\1\3#g; \
           s#(require\(['\"][^'\"]*/${name})\.(js|jsx)(['\"])#\1\3#g"
  grep -rlE "/${name}\.(js|jsx)['\"]" "${SRC_GLOBS[@]}" 2>/dev/null \
    | grep -vE "$EXCLUDE_RE" \
    | while IFS= read -r importer; do
        sed -E -i '' "$pattern" "$importer"
      done || true
done < "$RENAMED_LIST"
rm -f "$RENAMED_LIST"

# imports INTERNOS do domínio (arquivos agora .ts importando irmãos): mesmo
# tratamento já coberto acima (grep pega .ts também). Nada extra.

# -----------------------------------------------------------------------------
# 3) Dump de erros — ESTE é o input do modelo (não os arquivos)
# -----------------------------------------------------------------------------
echo "== tsc --noEmit =="
if [[ -n "$TSCONFIG" ]]; then
  npx tsc --noEmit -p "$TSCONFIG" 2>&1 | head -120 || true
else
  echo "(sem --tsconfig; pulei o type-check — passe o do workspace)"
fi

echo "== lint (só o domínio) =="
npx eslint "$DOMAIN" 2>&1 | tail -60 || true

echo ""
echo "== PRÓXIMOS PASSOS (modelo) =="
echo "  1. corrigir erros de tsc/lint acima (e SÓ eles)"
echo "  2. npm run test:changed   (ou testes do package)"
echo "  3. git add -A && commit 'refactor(040): migra ${DOMAIN} para TS'"
echo "  4. matar a sessão no commit — próxima sessão = próximo domínio"
