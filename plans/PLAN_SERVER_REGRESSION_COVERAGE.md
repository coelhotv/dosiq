# Plano: Cobertura de Regressão para Módulos Serverless

**Status:** CONCLUÍDO (Implementado na Sprint 2026-W23 via Spec 024)  
**Origem:** Incidente prod 2026-06-04 — `supabase-js` 2.91 + Node 20 WebSocket (Workaround aplicado e resolvido em definitivo com upgrade para Node 22)  
**Tier:** 1 (Standard)  
**Scope:** Server-side (`api/`, `server/`)  

---

## Contexto

Dois bugs de prod em sequência (Sprint 011 + Hotfix 636) chegaram à prod sem serem detectados no CI:

1. **Zod validation failure** — campos `time`/`scheduledTime` ausentes no dispatcher (lógica nova sem teste)
2. **WebSocket crash no import** — `supabase-js` 2.91 requer WebSocket global; Node 20 não tem; CI usa JSDOM que tem

Root cause comum: **ausência de gate de smoke serverless**. O `validate:agent` (Vitest/JSDOM) não cobria inicialização de módulos em Node puro. Resolvido com o upgrade do runtime do projeto para Node 22 LTS e a introdução de um smoke test de cold start no CI.

---

## Objetivos

1. Bloquear regressões de **bootstrap/import** de módulos serverless antes de deploy
2. Bloquear regressões de **lógica crítica do dispatcher** (campos obrigatórios, schemas)
3. Sem overhead excessivo — smoke test roda em < 5s

---

## Entregas (Implementadas)

### 1. `scripts/smoke-server.mjs` — Cold start smoke

Importa os módulos críticos do servidor em Node puro. Falha rápido se qualquer import quebrar (como falta de WebSocket global).

*Nota: Veja o arquivo implementado em [smoke-server.mjs](file:///Users/coelhotv/git/dosiq/scripts/smoke-server.mjs).*

---

### 2. Testes de schema do dispatcher — `server/__tests__/dispatcher.schema.test.js`

Testa que os dados produzidos por `_checkRemindersFromInstances` satisfazem os schemas Zod antes de chegar ao `buildNotificationPayload`. Previne o bug da Sprint 011 (campos `time`/`scheduledTime` ausentes).

---

### 3. Checklist no SQP (R-221) para bumps de deps server-side

Adicionado ao processo de bump de `@supabase/supabase-js` ou outras libs com sub-deps de runtime:

```
[ ] Ler changelog do sub-dep embutido (realtime-js, postgrest-js)
[ ] `ws` (ou equivalente) está em `dependencies` diretas do workspace server?
[ ] Rodar `node scripts/smoke-server.mjs` em Node 22 local
[ ] PR inclui evidência de smoke OK no body
```

---

### 4. `package.json` raiz — engines Node 22

```json
"engines": {
  "node": ">=22.0.0"
}
```

---

### 5. GitHub Actions step (Integrado no `test.yml`)

No job `smoke` do workflow de testes, o smoke-server é executado em Node 22:

```yaml
      - name: Install server dependencies
        run: npm ci --prefix server

      - name: Run Serverless Smoke Test (Cold Start)
        run: npm run test:smoke-server
```

---

## APs e Rules derivados deste plano

- AP-210: Supabase createClient sem ws transport em Node < 22
- AP-211: Dep transitiva crítica sem entrada direta em package.json  
- AP-212: Sem smoke test de cold start serverless
- R-262: Cold start smoke obrigatório para módulos serverless
- R-263: Fixar versão Node no projeto e na Vercel
- R-264: Validar breaking changes de deps server-side ao bumpar
