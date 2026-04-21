# Exec Spec Hibrido - Fase 2: Extracao do Core Puro

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 1 concluida
> **Objetivo da fase:** extrair somente codigo puro para `packages/core` sem introduzir adapters nem mover services browser-dependent

---

## 1. Papel desta fase

Esta fase transforma o que ja e puro em fonte compartilhada real.

Ela **nao** faz:

- adapters de storage
- adapters de config
- refactor de query cache
- refactor do Supabase singleton
- app mobile
- notificacoes nativas

Ela **faz**:

- extracao de schemas
- extracao de utils puros
- extracao opcional de utils puros de feature
- consolidacao de exports do `packages/core`
- atualizacao dos imports da web com minimo risco

---

## 2. Regra central da fase

Se um arquivo toca qualquer um dos itens abaixo, ele **nao entra** em `packages/core`:

- `window`
- `document`
- `navigator`
- `localStorage`
- `sessionStorage`
- `matchMedia`
- `Notification`
- `import.meta.env`
- `process.env`
- `createClient(...)`
- singleton Supabase da web
- hooks React
- componentes React

Nao existe excecao nesta fase.

---

## 3. Escopo exato da fase

## 3.1. Entram nesta fase

Entram obrigatoriamente:

- `src/schemas/**`
- `src/utils/**`

Entram somente se permanecerem puros apos auditoria:

- `src/features/protocols/utils/**`

Entram somente como extracao de funcao pura, nunca como service inteiro:

- funcoes puras isoladas atualmente dentro de services, desde que sejam movidas para modulo proprio de dominio/utilitario

## 3.2. Nao entram nesta fase

- `src/shared/utils/supabase.js`
- `src/shared/utils/queryCache.js`
- `src/shared/hooks/useCachedQuery.js`
- qualquer `src/features/*/services/**`
- qualquer componente
- qualquer CSS

---

## 4. Estrutura alvo obrigatoria ao fim da fase

```text
packages/core/
├── package.json
├── README.md
└── src/
    ├── index.js
    ├── schemas/
    │   ├── index.js
    │   └── ...
    ├── utils/
    │   ├── index.js
    │   └── ...
    └── protocols-utils/
        ├── index.js
        └── ...           # apenas se a auditoria de pureza permitir
```

---

## 5. Estrategia obrigatoria de baixo risco

### Decisao

Nesta fase, a estrategia padrao e:

1. criar `packages/core`
2. mover codigo puro para la
3. criar exports claros
4. repontar aliases da web quando isso reduzir churn
5. evitar reescrita massiva de imports desnecessariamente

### Consequencia pratica

Para `@schemas` e `@utils`, o caminho mais seguro nesta fase e:

- manter o alias na web
- fazer o alias apontar para o novo destino no `packages/core`

Isso reduz edicao de centenas de imports.

---

## 6. Sprint interno 2.1 - Preparar `packages/core` para uso real

### Objetivo

Tirar `packages/core` do estado placeholder e preparar barrel exports reais.

### `packages/core/package.json`

Usar algo deste tipo:

```json
{
  "name": "@dosiq/core",
  "private": true,
  "version": "0.1.0-phase2",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./schemas": "./src/schemas/index.js",
    "./utils": "./src/utils/index.js",
    "./protocols-utils": "./src/protocols-utils/index.js"
  }
}
```

### `packages/core/src/index.js`

```js
export * from './schemas/index.js'
export * from './utils/index.js'
```

Se `protocols-utils` ainda nao tiver sido auditado, nao exportar nesta etapa.

### Regra obrigatoria

Todos os imports internos do pacote devem usar:

- caminhos relativos locais

Nao usar:

- aliases do Vite raiz
- imports cruzados para `src/` da web

---

## 7. Sprint interno 2.2 - Extrair `src/schemas/**`

### Objetivo

Mover schemas Zod para o pacote compartilhado.

### Passos obrigatorios

1. mover arquivos de `src/schemas/**` para `packages/core/src/schemas/**`
2. criar `packages/core/src/schemas/index.js`
3. ajustar imports internos dos schemas, se existirem
4. atualizar imports da web que apontavam para caminhos antigos

### Exemplo de `packages/core/src/schemas/index.js`

```js
export * from './medicineSchema.js'
export * from './protocolSchema.js'
export * from './stockSchema.js'
```

### Regras obrigatorias

- nao deixar schema duplicado no destino e na origem
- nao criar "copia temporaria" como fonte dupla de verdade
- se o schema importa util puro, esse util tambem deve ser migrado ou importado por caminho valido

### Validacao de pureza

Executar:

```bash
rg -n "\\b(window|document|navigator|localStorage|import\\.meta\\.env|process\\.env|createClient)\\b" packages/core/src/schemas
```

Resultado esperado:

- nenhum match

---

## 8. Sprint interno 2.3 - Extrair `src/utils/**`

### Objetivo

Mover utils globais puras para o pacote compartilhado.

### Passos obrigatorios

1. mover `src/utils/**` para `packages/core/src/utils/**`
2. criar `packages/core/src/utils/index.js`
3. ajustar imports internos dos utils movidos
4. confirmar que nenhum util passou a depender de path da web

### Exemplo de `packages/core/src/utils/index.js`

```js
export * from './dateUtils.js'
export * from './adherenceLogic.js'
export * from './titrationUtils.js'
```

### Regra obrigatoria

Se algum util tocar browser APIs, ele sai desta fase e volta para o inventario como `ADAPTER_REQUIRED`.

### Scan obrigatorio

```bash
rg -n "\\b(window|document|navigator|localStorage|import\\.meta\\.env|process\\.env|createClient)\\b" packages/core/src/utils
```

Resultado esperado:

- nenhum match

---

## 9. Sprint interno 2.4 - Extrair `src/features/protocols/utils/**` se e somente se for puro

### Objetivo

Aproveitar utilitarios puros de feature sem puxar services nem UI.

### Regra obrigatoria

Este sprint e opcional.

Ele so pode acontecer se:

- Sprint 2.2 estiver verde
- Sprint 2.3 estiver verde
- os arquivos forem realmente puros

### Destino recomendado

```text
packages/core/src/protocols-utils/
```

### Scan obrigatorio

```bash
rg -n "\\b(window|document|navigator|localStorage|import\\.meta\\.env|process\\.env|createClient)\\b" src/features/protocols/utils packages/core/src/protocols-utils
```

### Regra de falha

Se surgir duvida sobre pureza, **nao mover nesta fase**.

---

## 10. Sprint interno 2.5 - Atualizar imports da web com minimo risco

### Objetivo

Fazer a web consumir o novo `packages/core` sem reescrita desnecessaria.

### Estrategia recomendada

Primeiro, repontar aliases em `vite.config.js` para reduzir churn:

```js
alias: {
  '@schemas': path.resolve(__dirname, './packages/core/src/schemas'),
  '@utils': path.resolve(__dirname, './packages/core/src/utils'),
}
```

### Observacao

Se `@utils` atual ja e usado para `src/utils`, repontar o alias e uma forma segura de manter o import do codigo atual funcionando.

### O que nao fazer

Nao abrir uma PR que:

- move os arquivos
- reescreve todos os imports do projeto para `@dosiq/core/*`
- mexe em services e hooks ao mesmo tempo

### Se houver testes/imports relativos

Atualizar pontualmente apenas os arquivos que quebraram.

Exemplo:

```js
// antes
import { validateMedicine } from '../medicineSchema.js'

// depois
import { validateMedicine } from '@schemas/medicineSchema.js'
```

Ou, se o contexto do teste exigir:

```js
import { validateMedicine } from '../../../packages/core/src/schemas/medicineSchema.js'
```

Preferencia:

- usar alias estavel
- evitar caminhos relativos longos quando possivel

---

## 11. Sprint interno 2.6 - Opcional: extrair funcoes puras para dominio

### Objetivo

Retirar funcoes matematicas realmente puras de dentro de services, sem mover o service inteiro.

### Exemplo correto

Se um arquivo de service contem:

- 2 funcoes puras
- 1 funcao com Supabase

Entao:

- mover as 2 funcoes puras para `packages/core/src/domain/`
- deixar a funcao com Supabase onde esta

### Exemplo incorreto

Mover o service inteiro porque "a maior parte e pura".

Isso esta proibido na Fase 2.

### Regra

Se qualquer extracao desse tipo aumentar risco ou confusao, adiar para Fase 3.

---

## 12. Validacoes obrigatorias da fase

## 12.1. Validacao de pureza

Executar:

```bash
rg -n "\\b(window|document|navigator|localStorage|import\\.meta\\.env|process\\.env|createClient|framer-motion|react-native|expo-)\\b" packages/core/src
```

Resultado esperado:

- nenhum match funcional

## 12.2. Validacao web

Executar:

```bash
npm run lint
npm run test:critical
npm run build
```

## 12.3. Validacao estrutural

Conferir:

- `packages/core` tem exports claros
- web continua compilando
- nenhum service browser-dependent entrou no pacote

---

## 13. Anti-patterns desta fase

### Errado 1 - Mover `src/shared/utils/supabase.js` para o core

Erro:

- depende de `import.meta.env`
- depende de contrato de auth/storage ainda nao criado

### Errado 2 - Mover `src/shared/utils/queryCache.js` para o core

Erro:

- usa `window.localStorage`
- sera refatorado apenas na Fase 3

### Errado 3 - Reescrever tudo para package import novo

Erro:

- churn desnecessario
- aumenta superficie de erro

### Errado 4 - Extrair service inteiro porque "parece puro"

Erro:

- services atuais frequentemente dependem de singleton Supabase ou browser state

---

## 14. Definition of Done da Fase 2

- [ ] `packages/core` deixou de ser placeholder
- [ ] `src/schemas/**` foi extraido
- [ ] `src/utils/**` foi extraido
- [ ] `src/features/protocols/utils/**` foi extraido ou explicitamente adiado com justificativa
- [ ] aliases/imports da web foram ajustados com minimo risco
- [ ] `packages/core/src` nao contem browser/native APIs
- [ ] `npm run lint` passa
- [ ] `npm run test:critical` passa
- [ ] `npm run build` passa

---

## 15. Handoff para a Fase 3

O proximo agente deve receber:

- `packages/core` populado e validado
- web compilando via imports estaveis
- inventario atualizado mostrando o que ainda e `ADAPTER_REQUIRED`
- confirmacao explicita de que `supabase`, `queryCache` e services browser-dependent ficaram fora

Sem isso, a Fase 3 com adapters comeca contaminada.

---

## 16. Ancoragem e validacao contra a Master Spec

Checklist obrigatorio de ancoragem:

- [ ] Esta fase move apenas `src/schemas/**` e `src/utils/**`
- [ ] Esta fase nao move `src/shared/utils/supabase.js`
- [ ] Esta fase nao move `src/shared/utils/queryCache.js`
- [ ] Esta fase nao move hooks, components nem CSS
- [ ] Esta fase mantem a web na raiz
- [ ] Esta fase respeita a Fase 2 da master spec
- [ ] Esta fase prepara, mas nao implementa, os adapters da Fase 3

Se qualquer item acima falhar, este documento deve ser corrigido antes da Fase 3.

