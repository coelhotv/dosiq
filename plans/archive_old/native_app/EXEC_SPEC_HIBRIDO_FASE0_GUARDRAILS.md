# Exec Spec Hibrido - Fase 0: Guardrails, ADRs e Inventario

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Objetivo da fase:** preparar a execucao; nao implementar produto native
> **Resultado esperado:** arquitetura alinhada, escopo congelado, inventario pronto, docs legados controlados

---

## 1. Papel desta fase

Esta fase existe para impedir que agentes futuros comecem a iniciativa hibrida com premissas falsas.

Nesta fase, os agentes **nao** devem:

- criar app Expo real
- mover a web para `apps/web`
- extrair services para pacotes compartilhados
- adicionar push native
- mudar banco de dados

Nesta fase, os agentes **devem**:

- consolidar as decisoes de arquitetura
- escrever ADRs curtas e objetivas
- produzir inventario de extracao
- identificar allowlist, denylist e rewrite-required
- marcar documentos antigos como historicos/supersedidos

---

## 2. Regras de ouro da fase

### R0-001. Nenhuma mudanca estrutural grande na app

Proibido nesta fase:

- mover `src/`
- mover `public/`
- mover `index.html`
- mover `vite.config.js`
- mudar raiz de deploy da Vercel

### R0-002. Nenhum codigo native de produto

Proibido nesta fase:

- `create-expo-app`
- React Navigation
- `expo-notifications`
- `expo-secure-store`
- `AsyncStorage`

**Acao corretiva obrigatoria:** o `package.json` raiz atualmente contem `expo` como dependencia direta sem scaffold correspondente. Esta dependencia deve ser **removida** nesta fase como parte do sprint 0.1. A reintroducao de `expo` ocorrera na Fase 4, dentro de `apps/mobile/package.json`.

### R0-003. Nenhuma extracao para `packages/*` ainda

Esta fase pode preparar o terreno documental, mas nao deve produzir extracao funcional de codigo ainda.

### R0-004. Um unico documento manda

`plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md` e a master spec.

Todos os documentos escritos nesta fase devem:

- citar a master spec
- obedecer as decisoes congeladas nela
- nao contradizer:
  - web na raiz nas fases iniciais
  - `packages/core` puro
  - `notification_devices` para tokens
  - `StyleSheet + AsyncStorage` no MVP native

---

## 3. Deliverables obrigatorios

Ao final desta fase, os seguintes arquivos devem existir:

### 3.1. ADRs obrigatorias

Criar pasta:

```text
plans/adr/
```

Criar exatamente estes arquivos:

```text
plans/adr/ADR-001-web-na-raiz-primeiro.md
plans/adr/ADR-002-notification-devices.md
plans/adr/ADR-003-stylesheet-asyncstorage-mvp.md
```

### 3.2. Inventarios obrigatorios

Criar exatamente estes arquivos:

```text
plans/PHASE0_EXTRACTION_INVENTORY.md
plans/PHASE0_SHARED_BOUNDARY_MATRIX.md
```

### 3.3. Controle de supersessao

Garantir que os documentos legados de RN:

- estejam marcados como supersedidos
- apontem para a master spec
- nao se apresentem mais como unica fonte da verdade

---

## 4. Estrutura obrigatoria das ADRs

Cada ADR deve ter no maximo 1-2 paginas e seguir este formato:

```md
# ADR-001 - Titulo

## Status
Accepted

## Contexto
- Fato 1
- Fato 2
- Restricao 1

## Decisao
- Decisao clara e unica

## Consequencias
- Positivas
- Negativas
- O que fica explicitamente fora

## Relacao com a Master Spec
- Secao X da master spec
- Secao Y da master spec
```

### Conteudo minimo de cada ADR

#### `ADR-001-web-na-raiz-primeiro.md`

Deve responder sem ambiguidade:

- por que a web fica na raiz nas fases 0, 1 e 2
- por que mover a web cedo demais aumenta risco
- qual e o gatilho minimo para mover a web depois

#### `ADR-002-notification-devices.md`

Deve responder sem ambiguidade:

- por que token em `profiles` esta proibido
- por que `user_settings` guarda preferencia e nao device token
- por que precisamos de tabela dedicada de dispositivos

#### `ADR-003-stylesheet-asyncstorage-mvp.md`

Deve responder sem ambiguidade:

- por que `StyleSheet` entra antes de `NativeWind`
- por que `AsyncStorage` entra antes de `MMKV`
- por que isso reduz fragilidade para agentes e builds

---

## 5. Estrutura obrigatoria do inventario

## 5.1. `PHASE0_EXTRACTION_INVENTORY.md`

Este arquivo deve listar **caminho por caminho** o que sera feito com cada grupo relevante de codigo.

Formato obrigatorio:

| Path | Categoria | Acao Futura | Fase | Observacoes |
|------|-----------|-------------|------|-------------|
| `src/schemas/**` | PURE | mover para `packages/core` | Fase 2 | sem browser APIs |
| `src/shared/utils/queryCache.js` | ADAPTER_REQUIRED | refatorar antes de compartilhar | Fase 3 | usa `localStorage` |

Categorias permitidas:

- `PURE`
- `ADAPTER_REQUIRED`
- `PLATFORM_WEB`
- `PLATFORM_MOBILE`
- `DO_NOT_SHARE`
- `DOC_INCONSISTENCY`

## 5.2. `PHASE0_SHARED_BOUNDARY_MATRIX.md`

Este arquivo deve responder de forma extremamente objetiva:

- o que entra em `packages/core`
- o que entra em `packages/shared-data`
- o que entra em `packages/storage`
- o que entra em `packages/config`
- o que nunca pode sair da web

Formato obrigatorio:

| Grupo | Destino | Permitido agora? | Motivo | Dono da decisao |
|-------|---------|------------------|--------|-----------------|

---

## 6. Sprint interno 0.1 - Auditoria factual do repositorio

### Objetivo

Produzir uma fotografia tecnica factual do repositorio atual.

### Passos obrigatorios

1. Validar versao atual em `package.json`
2. Validar shell atual da app web
3. Validar presenca real ou ausencia de:
   - `manifest.json`
   - service worker
   - web push
4. Validar onde moram hoje:
   - cliente Supabase
   - cache
   - configuracoes de Telegram
5. Listar arquivos browser-dependent criticos

### Comandos recomendados

```bash
sed -n '1,220p' package.json
sed -n '1,220p' src/App.jsx
sed -n '1,220p' src/shared/utils/supabase.js
sed -n '1,220p' src/shared/utils/queryCache.js
find public -maxdepth 2 -type f | sort
rg -n "serviceWorker|manifest\\.json|PushManager|Notification\\.requestPermission|beforeinstallprompt" src public
rg -n "\\b(window|document|navigator|localStorage|import\\.meta\\.env)\\b" src --glob '!**/__tests__/**'
```

### Itens adicionais obrigatorios no inventario (pos-redesign v4.0.0)

O inventario deve classificar explicitamente:

- `framer-motion` → `PLATFORM_WEB` / `DO_NOT_SHARE`
- `jspdf` + `html2canvas` → `PLATFORM_WEB` / `DO_NOT_SHARE`
- `groq-sdk` → `PLATFORM_WEB` (por enquanto) / avaliar compartilhamento futuro
- `react-virtuoso` → `PLATFORM_WEB` / `DO_NOT_SHARE`
- `src/shared/styles/motionConstants.js` → `PLATFORM_WEB` / `DO_NOT_SHARE`
- tokens Sanctuary (`src/shared/styles/`) → `SHARED_TOKEN` (via `packages/design-tokens`)
- path aliases do `vite.config.js` (`@schemas`, `@utils`, `@features`, `@shared`, `@services`, etc.) → documentar no inventario para referencia das fases 2-3

### Acao corretiva: remover `expo` do `package.json`

Incluir no sprint 0.1:

```bash
npm uninstall expo
```

Validar que `npm run build` e `npm run validate:agent` continuam verdes apos remocao.

### Criterio de conclusao

O inventario precisa refletir **codigo real**, nao apenas docs antigos.

---

## 7. Sprint interno 0.2 - Escrita das ADRs

### Objetivo

Congelar as decisoes que agentes fracos tenderiam a reinterpretar errado.

### Regras obrigatorias

- ADR curta
- linguagem objetiva
- uma decisao por arquivo
- sem multiplas opcoes "em aberto"
- sem "talvez", "pode ser", "depende"

### Anti-patterns desta sprint

Proibido escrever ADR assim:

```md
Podemos talvez mover a web cedo se tudo estiver tranquilo.
```

Obrigatorio escrever assim:

```md
A web permanece na raiz ate o fim da Fase 6. Mover antes disso esta proibido.
```

---

## 8. Sprint interno 0.3 - Inventario de extracao

### Objetivo

Transformar a master spec em um mapa operacional de arquivos.

### Regras obrigatorias

- inventariar por caminho real do repo
- classificar explicitamente browser-dependent
- classificar explicitamente o que fica na web
- marcar docs inconsistentes

### Caminhos que obrigatoriamente devem aparecer no inventario

- `src/schemas/**`
- `src/utils/**`
- `src/features/protocols/utils/**`
- `src/shared/utils/supabase.js`
- `src/shared/utils/queryCache.js`
- `src/shared/hooks/useCachedQuery.js`
- `src/features/emergency/services/emergencyCardService.js`
- `src/features/chatbot/services/chatbotService.js`
- `src/features/export/services/exportService.js`
- `src/features/reports/services/shareService.js`
- `src/views/**`
- `src/shared/components/**`
- `src/features/*/components/**`
- `api/notify.js`
- `server/bot/tasks.js`

### Exemplo correto

```md
| `src/shared/utils/supabase.js` | ADAPTER_REQUIRED | nao mover na Fase 2 | Fase 3 | depende de `import.meta.env` e contrato de storage de auth |
```

### Exemplo incorreto

```md
| `src/shared/utils/supabase.js` | PURE | mover para core | Fase 2 | |
```

---

## 9. Sprint interno 0.4 - Supersessao e higiene documental

### Objetivo

Evitar que agentes futuros usem specs legadas como se fossem planos atuais.

### Passos obrigatorios

1. Inserir nota de supersessao nos docs RN antigos
2. Garantir que cada um aponte para a master spec
3. Se um doc antigo se autodenomina "unica fonte da verdade", remover essa autoridade

### Resultado esperado

Os docs antigos permanecem como:

- contexto historico
- referencia comparativa

Eles **nao** permanecem como:

- autoridade atual
- ordem de execucao
- plano de implementacao

---

## 10. Sprint interno 0.5 - Validacao final da fase

### Objetivo

Provar que a fase terminou sem causar dano no projeto.

### Validacao obrigatoria

Executar:

```bash
npm run lint
npm run test:critical
npm run build
```

Se a fase for somente documental e o maintainer decidir nao rodar tudo, registrar explicitamente no fechamento:

- que a fase foi documental
- que nao houve mudanca de codigo de produto
- quais comandos nao foram executados

### Criterio de aprovacao

A fase so termina se:

- docs novos existirem
- inventario estiver completo
- docs antigos estiverem controlados
- a web continuar integra

---

## 11. Definition of Done da Fase 0

Considerar a fase concluida somente se todos os itens abaixo forem verdadeiros:

- [ ] Master spec existe e esta atual
- [ ] 3 ADRs foram criadas
- [ ] 2 inventarios foram criados
- [ ] docs RN legados foram marcados como supersedidos
- [ ] nenhuma mudanca estrutural de app foi feita
- [ ] nenhuma dependencia mobile foi adicionada
- [ ] `expo` foi removido do `package.json` raiz
- [ ] inventario inclui dependencias web-only (framer-motion, jspdf, etc.)
- [ ] inventario inclui path aliases do vite.config.js
- [ ] tokens Sanctuary classificados como `SHARED_TOKEN`
- [ ] ADRs foram registradas no `.agent/memory/decisions.json` (DEVFLOW)
- [ ] checklist de dependencias humanas revisado (ver addendum `HUMAN_DEPENDENCIES.md`)
- [ ] a web continua compilando

---

## 12. O que o agente da proxima fase recebera

Ao finalizar a Fase 0, o proximo agente deve receber:

- master spec
- 3 ADRs
- inventario de extracao
- matriz de fronteiras compartilhadas

Sem isso, a Fase 1 **nao deve comecar**.

---

## 13. Ancoragem e validacao contra a Master Spec

Checklist obrigatorio de ancoragem:

- [ ] Esta fase nao move a web para `apps/web`
- [ ] Esta fase nao cria app native funcional
- [ ] Esta fase reforca `packages/core` puro
- [ ] Esta fase reforca `user_settings + notification_devices`
- [ ] Esta fase reforca `StyleSheet + AsyncStorage` no MVP
- [ ] Esta fase nao contradiz as secoes 3, 4, 5, 8 e 12 da master spec

Se qualquer item acima falhar, este documento deve ser corrigido antes da Fase 1.

