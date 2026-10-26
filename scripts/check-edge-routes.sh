#!/usr/bin/env bash
#
# check-edge-routes.sh
#
# Validação de roteamento e headers na Vercel real (preview ou prod).
# Cobre PO-110-5 (rotas a-d) e PO-110-6 (headers de cache).
#
# Uso:
#   ./scripts/check-edge-routes.sh <preview-url>
# Exemplo:
#   ./scripts/check-edge-routes.sh https://dosiq-git-feat-110-web-landing-edge-bootstrap.vercel.app
#

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Erro: URL base não informada."
  echo "Uso: $0 <base-url>"
  echo "Exemplo: $0 https://dosiq-git-feat-110-web-landing-edge-bootstrap.vercel.app"
  exit 1
fi

BASE_URL="${1%/}"
BYPASS_SECRET="${VERCEL_AUTOMATION_BYPASS_SECRET:-}"

HEADER_ARGS=()
if [ -n "$BYPASS_SECRET" ]; then
  HEADER_ARGS+=("-H" "x-vercel-protection-bypass: $BYPASS_SECRET")
fi

echo "============================================================="
echo "  Dosiq Edge Routes & Cache Checker (PO-110-5 / PO-110-6)"
echo "  Base URL: $BASE_URL"
echo "============================================================="
echo ""

FAILURES=0

assert_status() {
  local path="$1"
  local expected_status="$2"
  local description="$3"

  local url="${BASE_URL}${path}"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" ${HEADER_ARGS[@]+"${HEADER_ARGS[@]}"} "$url")

  if [ "$http_code" = "$expected_status" ]; then
    echo "  [PASS] $description: $path -> $http_code (esperado: $expected_status)"
  else
    echo "  [FAIL] $description: $path -> $http_code (esperado: $expected_status)"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_static_html() {
  local path="$1"
  local title_pattern="$2"
  local description="$3"

  local url="${BASE_URL}${path}"
  local response
  local http_code
  local content_type

  response=$(curl -s -i ${HEADER_ARGS[@]+"${HEADER_ARGS[@]}"} "$url")
  http_code=$(echo "$response" | grep -i "^HTTP" | tail -n 1 | awk '{print $2}')
  content_type=$(echo "$response" | grep -i "^content-type:" | tr -d '\r' | awk '{print $2}')

  if [ "$http_code" = "200" ] && echo "$content_type" | grep -q "text/html" && echo "$response" | grep -iq "$title_pattern"; then
    echo "  [PASS] $description: $path -> 200 text/html contendo '$title_pattern'"
  else
    echo "  [FAIL] $description: $path -> code=$http_code, type=$content_type (esperava 200 text/html contendo '$title_pattern')"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_spa_fallback() {
  local path="$1"
  local description="$2"

  local url="${BASE_URL}${path}"
  local response
  local http_code
  local content_type

  response=$(curl -s -i ${HEADER_ARGS[@]+"${HEADER_ARGS[@]}"} "$url")
  http_code=$(echo "$response" | grep -i "^HTTP" | tail -n 1 | awk '{print $2}')
  content_type=$(echo "$response" | grep -i "^content-type:" | tr -d '\r' | awk '{print $2}')

  if [ "$http_code" = "200" ] && echo "$content_type" | grep -q "text/html" && echo "$response" | grep -q 'id="root"'; then
    echo "  [PASS] $description: $path -> 200 text/html (SPA fallback com #root)"
  else
    echo "  [FAIL] $description: $path -> code=$http_code, type=$content_type (esperava 200 SPA fallback com #root)"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_api_route() {
  local path="$1"
  local description="$2"

  local url="${BASE_URL}${path}"
  local response
  local content_type

  response=$(curl -s -i ${HEADER_ARGS[@]+"${HEADER_ARGS[@]}"} "$url")
  content_type=$(echo "$response" | grep -i "^content-type:" | tr -d '\r' | awk '{print $2}')

  # Rota de API não deve retornar o HTML da SPA
  if echo "$response" | grep -q 'id="root"'; then
    echo "  [FAIL] $description: $path caiu indevidamente no fallback SPA (#root encontrado)"
    FAILURES=$((FAILURES + 1))
  else
    echo "  [PASS] $description: $path roteado para função API (content-type: $content_type, não SPA)"
  fi
}

assert_cache_header() {
  local path="$1"
  local expect_immutable="$2"
  local description="$3"

  local url="${BASE_URL}${path}"
  local cache_control
  cache_control=$(curl -s -I ${HEADER_ARGS[@]+"${HEADER_ARGS[@]}"} "$url" | grep -i "^cache-control:" | tr -d '\r' || true)

  if [ "$expect_immutable" = "true" ]; then
    if echo "$cache_control" | grep -q "immutable" && echo "$cache_control" | grep -q "31536000"; then
      echo "  [PASS] $description: $path -> $cache_control (immutable presente)"
    else
      echo "  [FAIL] $description: $path -> $cache_control (esperava immutable e 31536000)"
      FAILURES=$((FAILURES + 1))
    fi
  else
    if echo "$cache_control" | grep -q "immutable"; then
      echo "  [FAIL] $description: $path -> $cache_control (NÃO deveria conter immutable)"
      FAILURES=$((FAILURES + 1))
    else
      echo "  [PASS] $description: $path -> $cache_control (sem immutable, revalida)"
    fi
  fi
}

echo "1. GRUPO A: 404 da CDN para assets inexistentes com extensão"
echo "-------------------------------------------------------------"
assert_status "/assets/inexistente.js" "404" "Asset JS inexistente"
assert_status "/og-inexistente.png" "404" "Imagem OG inexistente"
echo ""

echo "2. GRUPO B: 200 text/html para páginas estáticas limpas (cleanUrls)"
echo "-------------------------------------------------------------"
assert_static_html "/termos-de-uso" "Termos de Uso" "Página de Termos de Uso"
assert_static_html "/politica-de-privacidade" "Política de Privacidade" "Página de Privacidade"
assert_static_html "/glp-1" "Titulação" "Página GLP-1"
assert_static_html "/guia/rodizio-aplicacao" "Rodízio" "Guia de Rodízio"
assert_static_html "/baixar" "dosiq" "Página /baixar"
echo ""

echo "3. GRUPO C: 200 SPA fallback para rotas profundas sem extensão"
echo "-------------------------------------------------------------"
assert_spa_fallback "/dashboard" "Rota profunda /dashboard"
assert_spa_fallback "/settings/profile" "Rota profunda /settings/profile"
assert_spa_fallback "/historico" "Rota profunda /historico"
echo ""

echo "4. GRUPO D: Rotas /api/* preservadas (não caem na SPA)"
echo "-------------------------------------------------------------"
assert_api_route "/api/telegram" "Endpoint API Telegram"
assert_api_route "/api/notify" "Endpoint API Notify"
echo ""

echo "5. GRUPO E: Headers de Cache (PO-110-6)"
echo "-------------------------------------------------------------"
# Localiza um asset JS hasheado do dist se disponível
SAMPLE_ASSET=""
if [ -d "apps/web/dist/assets" ]; then
  SAMPLE_ASSET=$(find apps/web/dist/assets -name "index-*.js" -exec basename {} \; | head -n 1 || true)
fi

if [ -n "$SAMPLE_ASSET" ]; then
  assert_cache_header "/assets/$SAMPLE_ASSET" "true" "Asset JS hasheado"
else
  echo "  [SKIP] Nenhum asset local encontrado em dist/assets para testar header imutável."
fi

assert_cache_header "/service-worker.js" "false" "Service Worker"
assert_cache_header "/registerSW.js" "false" "Register SW"
assert_cache_header "/manifest.webmanifest" "false" "Web Manifest"
assert_cache_header "/" "false" "HTML Raiz"
echo ""

echo "============================================================="
if [ $FAILURES -eq 0 ]; then
  echo "✅ TODAS AS ROTAS E HEADERS FORAM VALIDADOS COM SUCESSO!"
  exit 0
else
  echo "❌ $FAILURES FALHA(S) ENCONTRADA(S) NAS ROTAS OU HEADERS."
  exit 1
fi
