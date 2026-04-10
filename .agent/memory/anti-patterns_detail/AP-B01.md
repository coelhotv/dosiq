# AP-B01 — Adicionar `<link rel="modulepreload" href="/src/main.jsx" />` manual em `index.html` no Vite 7

**Category:** Build
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

Vite 7 base64-encoda o conteúdo raw do JSX e emite `data:text/jsx;base64,...` no `dist/index.html`. Browser rejeita com MIME type error. O Vite já gera modulepreload hints corretos para todos os chunks automaticamente.

## Prevention

Nunca adicionar hints manuais de modulepreload apontando para arquivos fonte. Deixar o Vite gerar os hints automaticamente.
