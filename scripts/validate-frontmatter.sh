#!/bin/bash

# Encontra o caminho absoluto do diretório do script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$DIR/.." && pwd )"

# Executa o script validador em Node.js repassando todos os argumentos recebidos
node "$ROOT_DIR/scripts/validate-frontmatter.mjs" "$@"
