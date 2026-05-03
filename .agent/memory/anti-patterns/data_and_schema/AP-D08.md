---
id: AP-D08
title: Fragile date parsing via toLocaleString default
summary: Relying on toLocaleString() output for the Date() constructor without forcing a stable 24h/ISO format.
applies_to:
  - server
  - utils
tags:
  - date
  - crash
  - timezone
incident_count: 1
last_referenced: 2026-05-02
status: active
related_rule: R-020
---

# AP-D08 — Fragile date parsing via toLocaleString default

## O Sintoma
`RangeError: Invalid time value` ao chamar `.toISOString()` em um objeto Date que foi "shiftado" via `getSaoPauloTime`.

## A Causa
O uso de `toLocaleString('en-CA')` sem a flag `hour12: false`. Em ambientes Node 24+, o formato canadense pode incluir `p.m.` (com pontos), o que o construtor `new Date()` não consegue interpretar, gerando um objeto `Invalid Date`.

```javascript
// ❌ ERRADO (Frágil)
const s = d.toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' });
return new Date(s); // Pode retornar Invalid Date no Node 24

// ❌ ERRADO (Perigoso)
return date.toISOString(); // Lança RangeError se date for Invalid
```

## A Solução
Sempre forçar o formato 24h e normalizar a string para um formato ISO-like que o construtor `Date` aceite universalmente. Adicionar validação `isNaN(getTime())` antes de operações críticas.

```javascript
// ✅ CORRETO (Padrão Hardened)
const s = d.toLocaleString('en-CA', { 
  timeZone: 'America/Sao_Paulo', 
  hour12: false 
}).replace(', ', 'T');
const shifted = new Date(s);
if (isNaN(shifted.getTime())) return d; // Fallback
```

## Referência
- **R-020**: Timezone — Local Dates & SP Hardening
- **Incidente**: Crash do Cron /api/notify em Produção (2026-05-02).
