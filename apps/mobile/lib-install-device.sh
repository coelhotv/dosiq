#!/bin/bash
# lib-install-device.sh — instala o binário recém-compilado no aparelho de teste
#
# Sourced por build-android.sh e build-ios.sh. Não executar direto.
#
# Alvo (nunca hardcoded — a repo é pública; o valor padrão mora no ~/.bashrc do operador):
#   DOSIQ_IOS_DEVICE      nome ou UDID do aparelho iOS   (ex.: o nome em `xcrun devicectl list devices`)
#   DOSIQ_ANDROID_SERIAL  serial do adb                  (ex.: o serial em `adb devices`)
# Sem a variável: 1 aparelho disponível → usa esse; vários → pergunta; nenhum → avisa e pula.
#
# CONTRATO: instalar é cortesia pós-build. O binário já está salvo em $FINAL_PATH, então QUALQUER
# falha aqui vira aviso + comando manual e retorna 0 — nunca derruba o script de build.

_install_fallback() {
  echo "⚠️  Instalação automática não concluída. O binário está preservado; para instalar à mão:"
  echo "   $1"
  return 0
}

# Escolhe um item de uma lista (1 por linha). Imprime o escolhido em stdout; prompt/avisos em stderr.
_pick_one() {
  local label="$1" items="$2" count
  count=$(printf '%s\n' "$items" | grep -c .)
  if [ "$count" -eq 1 ]; then
    printf '%s\n' "$items"
    return 0
  fi
  echo "📲 Vários aparelhos $label disponíveis:" >&2
  printf '%s\n' "$items" | nl -w2 -s') ' >&2
  local choice
  read -r -p "   Número do aparelho (Enter = pular): " choice
  [ -z "$choice" ] && return 1
  printf '%s\n' "$items" | sed -n "${choice}p" | grep . || return 1
}

# iOS: .ipa ad hoc em aparelho físico (cabo ou Wi-Fi; o devicectl resolve o transporte).
install_ios_device() {
  local ipa="$1" device="${DOSIQ_IOS_DEVICE:-}"
  local manual="xcrun devicectl device install app --device <nome|UDID> \"$ipa\""

  if [ -z "$device" ]; then
    # JSON em vez de parsear a tabela (frágil). transportType ausente = aparelho não alcançável.
    local json; json="$(mktemp -t dosiq-devicectl)"
    if ! xcrun devicectl list devices --json-output "$json" >/dev/null 2>&1; then
      rm -f "$json"
      _install_fallback "$manual"; return 0
    fi
    local names
    names=$(python3 -c "
import json,sys
for d in json.load(open(sys.argv[1]))['result']['devices']:
    if d['connectionProperties'].get('transportType'):
        print(d['deviceProperties']['name'])
" "$json" 2>/dev/null || true)
    rm -f "$json"
    if [ -z "$names" ]; then
      echo "ℹ️  Nenhum aparelho iOS alcançável (cabo ou Wi-Fi) — pulando instalação."
      _install_fallback "$manual"; return 0
    fi
    device=$(_pick_one "iOS" "$names") || { _install_fallback "$manual"; return 0; }
  fi

  echo "📲 Instalando no iOS [$device]..."
  if xcrun devicectl device install app --device "$device" "$ipa"; then
    echo "✅ Instalado em $device."
  else
    echo "   (aparelho bloqueado/desconectado, ou UDID fora do \`eas device:list\`?)"
    _install_fallback "xcrun devicectl device install app --device $device \"$ipa\""
  fi
}

# Android: .apk de development/preview. -r reinstala preservando dados.
install_android_device() {
  local apk="$1" serial="${DOSIQ_ANDROID_SERIAL:-}"
  local manual="adb -s <serial> install -r \"$apk\""

  if ! command -v adb >/dev/null 2>&1; then
    _install_fallback "$manual"; return 0
  fi

  if [ -z "$serial" ]; then
    # Só estado `device`: unauthorized/offline não instalam.
    local serials
    serials=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
    if [ -z "$serials" ]; then
      echo "ℹ️  Nenhum aparelho Android autorizado no adb — pulando instalação."
      _install_fallback "$manual"; return 0
    fi
    serial=$(_pick_one "Android" "$serials") || { _install_fallback "$manual"; return 0; }
  fi

  echo "📲 Instalando no Android [$serial]..."
  local out
  if out=$(adb -s "$serial" install -r "$apk" 2>&1); then
    echo "✅ Instalado em $serial."
  else
    echo "$out"
    if echo "$out" | grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE"; then
      echo "   Assinatura diferente: o Dosiq da Play Store está instalado. Desinstale-o antes"
      echo "   (apaga os dados do app — por isso o script não faz isso sozinho)."
    fi
    _install_fallback "adb -s $serial install -r \"$apk\""
  fi
}
