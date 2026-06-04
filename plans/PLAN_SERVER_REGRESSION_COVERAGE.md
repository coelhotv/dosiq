# Plano: Cobertura de Regressão para Módulos Serverless

**Status:** DRAFT  
**Origem:** Incidente prod 2026-06-04 — `supabase-js` 2.91 + Node 20 WebSocket  
**Tier:** 1 (Standard)  
**Scope:** Server-side (`api/`, `server/`)  

---

## Contexto

Dois bugs de prod em sequência (Sprint 011 + Hotfix 636) chegaram à prod sem serem detectados no CI:

1. **Zod validation failure** — campos `time`/`scheduledTime` ausentes no dispatcher (lógica nova sem teste)
2. **WebSocket crash no import** — `supabase-js` 2.91 requer WebSocket global; Node 20 não tem; CI usa JSDOM que tem

Root cause comum: **ausência de gate de smoke serverless**. O `validate:agent` (Vitest/JSDOM) não cobre inicialização de módulos em Node puro.

---

## Objetivos

1. Bloquear regressões de **bootstrap/import** de módulos serverless antes de deploy
2. Bloquear regressões de **lógica crítica do dispatcher** (campos obrigatórios, schemas)
3. Sem overhead excessivo — CI já leva ~10min; smoke deve ser <30s

---

## Entregas

### 1. `scripts/smoke-server.mjs` — Cold start smoke

Importa os módulos críticos do servidor em Node puro. Falha rápido se qualquer import quebrar.

```mjs
// scripts/smoke-server.mjs
// Smoke test de cold start — roda em Node puro (sem JSDOM/browser globals)
// Detecta erros de construtor, globals ausentes, deps de runtime faltando

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';

const modules = [
  './server/services/supabase.js',
  './server/bot/botFactory.js',
  './server/notifications/payloads/buildNotificationPayload.js',
  './server/notifications/dispatcher.js',
];

let failed = false;
for (const mod of modules) {
  try {
    await import(pathToFileURL(path.resolve(mod)).href);
    console.log(`✓ ${mod}`);
  } catch (err) {
    console.error(`✗ ${mod}: ${err.message}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('\nSmoke OK — todos os módulos serverless inicializam em Node puro.');
```

**Pré-requisito:** env vars mockadas via `.env.test` ou variáveis mínimas injetadas pelo CI.

---

### 2. `scripts/smoke-server.sh` — Wrapper CI

```bash
#!/bin/bash
set -e

# Garante que o smoke roda na mesma versão Node da Vercel
NODE_REQUIRED="20"
CURRENT=$(node -e "process.stdout.write(process.version.split('.')[0].replace('v',''))")

if [ "$CURRENT" != "$NODE_REQUIRED" ]; then
  echo "AVISO: Node $CURRENT detectado, esperado $NODE_REQUIRED. Continuando..."
fi

echo "=== Smoke: cold start serverless ==="
node --experimental-vm-modules scripts/smoke-server.mjs
```

---

### 3. Testes de schema do dispatcher — `server/__tests__/dispatcher.schema.test.js`

Testa que os dados produzidos por `_checkRemindersFromInstances` satisfazem os schemas Zod antes de chegar ao `buildNotificationPayload`. Previne o bug da Sprint 011 (campos `time`/`scheduledTime` ausentes).

```js
// server/__tests__/dispatcher.schema.test.js
import { describe, it, expect } from 'vitest';
import {
  doseReminderDataSchema,
  doseReminderByPlanDataSchema,
  doseReminderMiscDataSchema
} from '../notifications/payloads/_payloadSchemas.js';

describe('doseReminderDataSchema — campos obrigatórios', () => {
  it('rejeita data sem time', () => {
    const result = doseReminderDataSchema.safeParse({
      medicineName: 'Atenolol',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('time');
  });

  it('aceita payload mínimo válido', () => {
    const result = doseReminderDataSchema.safeParse({
      medicineName: 'Atenolol',
      time: '08:00',
    });
    expect(result.success).toBe(true);
  });
});

describe('doseReminderByPlanDataSchema — scheduledTime obrigatório', () => {
  it('rejeita sem scheduledTime', () => {
    const result = doseReminderByPlanDataSchema.safeParse({
      planName: 'Cardio',
      hour: 8,
      doses: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('doseReminderMiscDataSchema — scheduledTime obrigatório', () => {
  it('rejeita sem scheduledTime', () => {
    const result = doseReminderMiscDataSchema.safeParse({
      hour: 8,
      doses: [],
    });
    expect(result.success).toBe(false);
  });
});
```

---

### 4. Checklist no SQP (R-221) para bumps de deps server-side

Adicionar ao processo de bump de `@supabase/supabase-js` ou outras libs com sub-deps de runtime:

```
[ ] Ler changelog do sub-dep embutido (realtime-js, postgrest-js)
[ ] `ws` (ou equivalente) está em `dependencies` diretas do workspace server?
[ ] Rodar `node scripts/smoke-server.mjs` em Node 20 local (não em Node 22+)
[ ] PR inclui evidência de smoke OK no body
```

---

### 5. `package.json` raiz — fixar engines

```json
"engines": {
  "node": "20.x"
}
```

---

### 6. GitHub Actions step (futuro — quando CI for configurado)

```yaml
- name: Smoke test serverless (Node 20)
  uses: actions/setup-node@v4
  with:
    node-version: '20'
- run: |
    cp .env.example .env.local
    node scripts/smoke-server.mjs
```

---

## Priorização

| # | Entrega | Esforço | Impacto | Prioridade |
|---|---------|---------|---------|------------|
| 1 | `smoke-server.mjs` | ~30min | Alto — previne AP-212 | **P0** |
| 3 | Testes Zod do dispatcher | ~1h | Alto — previne AP da Sprint 011 | **P0** |
| 5 | `engines` no package.json | ~5min | Médio — âncora de ambiente | **P1** |
| 2 | `smoke-server.sh` | ~15min | Médio — wrapper CI | **P1** |
| 4 | Checklist SQP | ~10min | Médio — processo | **P1** |
| 6 | GitHub Actions step | ~30min | Alto — automação completa | **P2** (quando CI ativado) |

---

## Dependências e riscos

- **Smoke precisa de env vars mínimas** — `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` devem existir no CI. Solução: `.env.test` com valores fake que não causem requests reais (supabase-js não faz request no construtor, apenas verifica globals).
- **Vitest workspace** — testes de `server/` devem estar num workspace separado de `apps/web` (não misturar JSDOM com Node env). Verificar se já existe config ou criar `vitest.config.server.js`.

---

## APs e Rules derivados deste plano

- AP-210: Supabase createClient sem ws transport em Node < 22
- AP-211: Dep transitiva crítica sem entrada direta em package.json  
- AP-212: Sem smoke test de cold start serverless
- R-262: Cold start smoke obrigatório para módulos serverless
- R-263: Fixar versão Node no projeto e na Vercel
- R-264: Validar breaking changes de deps server-side ao bumpar

---

## Próximos passos

1. Implementar P0 (smoke + testes Zod) numa branch `chore/server-smoke-coverage`
2. Validar que smoke passa com env vars mínimas fakes
3. Adicionar `engines` ao package.json raiz
4. Documentar checklist SQP para bumps de deps (pode ser texto inline no CLAUDE.md ou em R-264 detail)
