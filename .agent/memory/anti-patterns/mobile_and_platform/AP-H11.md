---
id: AP-H11
title: Use detection probe to detect Hermes URLSearchParams bugs
summary: Hermes não lança 'not implemented' em testes sintéticos — só lança em uso real pelo Supabase. Detection probe passa mas prod falha.
applies_to:
  - apps/mobile/polyfills.js
tags:
  - mobile
  - expo
  - hermes
  - polyfill
  - supabase
trigger_count: 1
last_triggered: 2026-04-13
expiry_date: 2027-04-13
status: active
related_rule: R-165
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-H11: Use detection probe to detect Hermes URLSearchParams bugs

## Problema

Usar um probe sintético para detectar se `URLSearchParams.set` é funcional no Hermes (ex: `try { new URLSearchParams().set('_test','_val') } catch(e) { return true }`) falha como estratégia de detecção.

## Causa Raiz

O Hermes (Expo Go SDK 53, React Native) implementa `URLSearchParams` globalmente mas as funções de mutação (`.set`, `.append`, `.delete`) estão presentes no objecto mas lançam `"not implemented"` apenas em contexto real de uso (ex: chamada pelo Supabase JS internamente), não em chamadas sintéticas directas.

## Impacto

- Primeira iteração da correcção passou no probe mas falhou em produção
- Erro na tela: `"URLSearchParams.set is not implemented"`
- Ciclo extra de gsync+reload para diagnosticar → perdido ~30min

## Prevenção

**Substituição incondicional** — nunca usar detection probe para polyfills Hermes. Se a API é conhecida como parcialmente implementada no Hermes, substituir `global.X` directamente sem testar:

```js
// ❌ ERRADO — probe falha silenciosamente no Hermes
if (needsPatch()) { global.URLSearchParams = MyImpl }

// ✅ CORRECTO — substituição incondicional
global.URLSearchParams = MyImpl
```

## Ficheiros Afectados

- `apps/mobile/polyfills.js` — `patchURLSearchParams()` IIFE

## Commits

- Fix v1 (probe, falhou): commit na sessão H5.2
- Fix v2 (incondicional, funcionou): confirmado em log `[polyfill] URLSearchParams substituído — set: function`
