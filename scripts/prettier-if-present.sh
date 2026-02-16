#!/usr/bin/env bash
# Wrapper to run prettier only if available on PATH
set -e
if command -v prettier >/dev/null 2>&1; then
  prettier --write --ignore-unknown "$@"
else
  echo "[lint-staged] prettier not found in PATH — skipping formatting"
  exit 0
fi

