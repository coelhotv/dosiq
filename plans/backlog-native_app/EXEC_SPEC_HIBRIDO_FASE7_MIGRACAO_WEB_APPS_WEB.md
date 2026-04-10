# Exec Spec Hibrido - Fase 7: Migracao Tardia da Web para `apps/web`

> **Status:** Exec spec detalhado e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Pre-requisito:** Fase 6 concluida
> **Objetivo da fase:** mover a aplicacao web da raiz para `apps/web` somente se a estabilizacao da arquitetura hibrida justificar a mudanca

---

## 1. Papel desta fase

Esta fase nao existe para criar valor de produto direto ao usuario final.

Ela existe para:

- organizar o monorepo apos a estabilizacao do mobile e dos shared packages
- reduzir ambiguidade estrutural
- alinhar o repositorio ao estado alvo tardio descrito na master spec

### Regra principal

Esta fase e **opcional e tardia**.

Se a web estiver saudavel na raiz e nao houver dor operacional clara, a fase pode ser postergada.

Ela so deve acontecer quando houver beneficio concreto em:

- isolamento de apps
- clareza de ownership
- scripts e pipelines mais previsiveis

### Leituras complementares obrigatorias

Antes de executar esta fase, o agente deve ler tambem:

- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

---

## 2. Pre-condicoes obrigatorias

Nenhum agente pode iniciar esta fase sem verificar todos os itens abaixo:

1. Fases 1 a 6 concluidas.
2. Shared packages estaveis.
3. Mobile scaffold e MVP ja em uso.
4. Push native e beta interno funcionando.
5. Build web atual verde.
6. Testes web atuais verdes.
7. Maintainer humano aprovou explicitamente executar esta migracao.
8. `apps/mobile/app.config.js` e `apps/mobile/eas.json` estao estaveis.

### Regra

Se qualquer item acima falhar, a Fase 7 deve ser abortada ou adiada.

---

## 3. Objetivo exato da migracao

Ao fim da fase, a web deve sair de:

```text
meus-remedios/
  src/
  public/
  index.html
  vite.config.js
  package.json
```

Para:

```text
meus-remedios/
  apps/
    web/
      src/
      public/
      index.html
      vite.config.js
      package.json
    mobile/
  packages/
  api/
  server/
  package.json
```

### Resultado esperado

- a web continua funcionando igual ou melhor
- os scripts continuam claros
- os aliases continuam corretos
- deploy continua previsivel

---

## 4. O que esta fase faz e o que nao faz

## 4.1. Faz

- mover arquivos web para `apps/web`
- ajustar imports locais e aliases
- ajustar scripts do root e do app web
- ajustar Vite, Vitest e ESLint conforme necessario
- ajustar caminhos de build e public assets
- ajustar docs e pipelines
- ajustar configuracao de deploy

## 4.2. Nao faz

- redesign web
- refactor grande de componentes
- troca para TypeScript
- troca de bundler
- reorganizacao profunda de features
- novo design system
- mudanca de backend

### Regra

Migracao estrutural nao pode virar refactor oportunista.

Se um arquivo precisa ser movido, mova.
Se um arquivo precisa ser corrigido para o build voltar, corrija.
Nao acrescente escopo extra.

---

## 5. Regras de ouro da fase

### R7-001. Esta fase nao e prerequisito de produto

Nao bloquear o roadmap de produto aguardando `apps/web`.

### R7-002. Migracao fisica e separada de refactor funcional

Se possivel, o primeiro PR da fase deve priorizar:

- move
- rewiring
- scripts

E nao comportamento novo.

### R7-003. Root continua sendo workspace root

Mesmo apos mover a web:

- o root continua sendo a raiz do monorepo
- scripts agregadores continuam no root
- `api/` e `server/` nao mudam de lugar nesta fase

### R7-004. Alias e tooling precisam continuar explicitos

Nao depender de magia implicita de resolucao.

Se um alias da web dependia do root antes, ele deve ser reconfigurado conscientemente.

### R7-005. Deploy precisa ser tratado como parte da fase

Se o deploy da web usa configuracao de root antiga, esta fase nao termina sem corrigir:

- diretorio raiz do projeto web
- comando de build
- output directory
- env vars necessarias

### R7-006. O mobile nao pode quebrar por causa da web

Qualquer ajuste de workspace ou dependencias precisa preservar `apps/mobile`.

### R7-007. O backend atual nao muda de pasta

Nao mover:

- `api/`
- `server/`

Nesta fase.

### R7-008. A migracao da web nao pode quebrar o release tooling do mobile

Mesmo sendo fase estrutural da web, esta fase deve preservar:

- `apps/mobile/app.config.js`
- `apps/mobile/eas.json`
- scripts root usados pelo mobile
- resolucao de workspace do mobile

---

## 6. Estrategia recomendada de migracao

## 6.1. Modelo de transicao

Fazer a migracao em camadas:

1. preparar root scripts e workspace metadata
2. criar `apps/web`
3. mover arquivos da web
4. consertar tooling local
5. consertar CI/deploy
6. validar equivalencia funcional

## 6.2. Ordem de movimento obrigatoria

Mover primeiro:

- `src/`
- `public/`
- `index.html`
- `vite.config.js`

Avaliar e mover depois:

- config de testes da web
- configs de lint que precisem ficar locais
- assets auxiliares especificos da web

### Regra

Nao mover arquivos aleatoriamente por tentativa e erro.

Cada move precisa corresponder a uma responsabilidade clara da app web.

---

## 7. Estrutura alvo obrigatoria

```text
apps/web/
  src/
  public/
  index.html
  vite.config.js
  package.json
  vitest.config.js            # se separado do vite
  .env.example                # se existir arquivo especifico da web
```

## 7.1. `apps/web/package.json`

O app web deve ganhar `package.json` proprio.

Exemplo minimo:

```json
{
  "name": "@meus-remedios/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Regra

As dependencias podem continuar hoistadas no root se o workspace resolver adequadamente.

Nao duplicar dependencias sem necessidade.

## 7.2. Root `package.json`

O root deve continuar oferecendo comandos amigaveis.

Exemplo:

```json
{
  "scripts": {
    "dev:web": "npm run dev --workspace @meus-remedios/web",
    "build:web": "npm run build --workspace @meus-remedios/web",
    "dev:mobile": "npm run start --workspace @meus-remedios/mobile",
    "build": "npm run build:web"
  }
}
```

### Regra

Se o projeto tem automacoes antigas que chamam `npm run dev` e `npm run build`, preservar compatibilidade no root sempre que possivel.

---

## 8. Vite, aliases e resolucao

## 8.1. Responsabilidade do `apps/web/vite.config.js`

Este arquivo deve passar a ser a fonte canonica de:

- aliases da web
- plugins Vite da web
- manualChunks da web
- definicao de `root` quando aplicavel

## 8.2. Ajuste de aliases

Se antes o alias apontava para `src/` na raiz, apos a migracao ele deve apontar para `apps/web/src/`.

Exemplo:

```js
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@services': resolve(__dirname, 'src/services'),
      '@schemas': resolve(__dirname, 'src/schemas'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
})
```

### Regra

Nao manter aliases apontando silenciosamente para paths antigos na raiz.

## 8.3. Import de packages compartilhados

Se a web ja consome `packages/*`, os aliases ou imports devem passar a apontar para os nomes de pacote ou paths corretos do workspace.

Exemplo:

```js
import { someSchema } from '@meus-remedios/core'
```

E nao:

```js
import { someSchema } from '../../../packages/core/src'
```

---

## 9. Testes, lint e validacao

## 9.1. Objetivo

Garantir equivalencia comportamental da web antes e depois do move.

## 9.2. Regras

- os testes da web devem continuar descobertos pelo runner
- os imports absolutos precisam continuar resolvendo
- o build da web precisa continuar gerando os chunks esperados
- `validate:agent` nao pode ser degradado sem substituto claro

## 9.3. Ajustes permitidos

- mudar `include` e `exclude` de Vitest
- ajustar `eslint` para novos globs
- ajustar scripts root para apontar ao workspace correto

## 9.4. Ajustes proibidos

- desabilitar testes para "destravar a migracao"
- remover regras de lint para evitar corrigir paths
- apagar testes quebrados sem causa legitima

---

## 10. Deploy e ambiente

## 10.1. Vercel ou equivalente

Se a web atual depende da raiz para build/deploy, a fase deve explicitar:

- novo root directory da web
- novo build command
- output directory
- variaveis de ambiente usadas pela web

E deve confirmar explicitamente que nada disso quebra:

- EAS Build
- `app.config.js`
- resolucao de `apps/mobile`

## 10.2. Exemplo de raciocinio

Antes:

- root do projeto = repositorio
- `vite build` roda na raiz

Depois:

- root do monorepo = repositorio
- build da web roda em `apps/web`

### Regra

Se `api/` continuar no root para Vercel, documentar cuidadosamente como a plataforma deve resolver:

- frontend web em `apps/web`
- funcoes serverless em `api/`

Se isso nao for simples ou seguro no ambiente atual, adiar a fase.

---

## 11. Sprints internos obrigatorios

## Sprint 7.1 - Preparacao e freeze de escopo

### Objetivo

Congelar escopo e preparar o repositorio para o move fisico.

### Entregas

- checklist de pre-condicoes preenchido
- inventario do que pertence exclusivamente a web
- identificacao de scripts root impactados
- identificacao de pipeline/deploy impactado

### DoD do sprint

- esta claro o que sera movido
- esta claro o que ficara no root
- o maintainer humano confirmou a execucao

## Sprint 7.2 - Criacao de `apps/web` e package local

### Objetivo

Criar a casca do workspace da web sem ainda quebrar o repo.

### Entregas

- diretoria `apps/web`
- `apps/web/package.json`
- wiring inicial de scripts root
- definicao de ownership do app web

### DoD do sprint

- estrutura existe
- root reconhece o novo workspace
- nenhuma funcionalidade foi movida ainda sem mapeamento

## Sprint 7.3 - Move fisico e reparo de tooling

### Objetivo

Mover a app web e restaurar o estado verde local.

### Entregas

- move de `src/`
- move de `public/`
- move de `index.html`
- move de `vite.config.js`
- ajustes de aliases
- ajustes de tests/lint

### DoD do sprint

- `npm run dev:web` sobe
- `npm run build:web` gera build
- imports principais resolvem corretamente

## Sprint 7.4 - Compatibilidade root e automacoes

### Objetivo

Evitar quebrar a ergonomia do projeto e as automacoes existentes.

### Entregas

- scripts root retrocompativeis
- docs atualizadas
- comandos de validacao apontando para a web correta
- ajustes de CI localizados

### DoD do sprint

- colaborador consegue subir web e mobile sem adivinhacao
- docs de setup nao estao contraditorias

## Sprint 7.5 - Deploy e validacao final

### Objetivo

Confirmar que a mudanca estrutural nao piorou operacao nem entrega.

### Entregas

- configuracao de deploy revisada
- smoke test da web
- smoke test da integracao com `api/`
- validacao final dos packages compartilhados

### DoD do sprint

- deploy previsivel
- web comportamentalmente equivalente
- mobile e packages continuam intactos

---

## 12. Sequencia prescritiva de execucao

1. Confirmar aprovacao humana para executar a fase.
2. Inventariar tudo que hoje pertence a web raiz.
3. Criar `apps/web` e `package.json` local.
4. Ajustar root workspaces e scripts.
5. Mover `src/`, `public/`, `index.html` e `vite.config.js`.
6. Corrigir aliases e imports.
7. Corrigir lint, test e build.
8. Corrigir automacoes e docs.
9. Corrigir deploy.
10. Validar equivalencia funcional.

### Regra

Nao inverter a ordem 5 e 4.

Se mover a web antes de preparar workspace e scripts, o repositorio entra em estado confuso e dificulta recuperacao.

---

## 13. Exemplos de implementacao

## 13.1. Script root retrocompativel

```json
{
  "scripts": {
    "dev": "npm run dev:web",
    "dev:web": "npm run dev --workspace @meus-remedios/web",
    "build": "npm run build:web",
    "build:web": "npm run build --workspace @meus-remedios/web",
    "preview:web": "npm run preview --workspace @meus-remedios/web"
  }
}
```

## 13.2. Workspace root

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

## 13.3. Import correto de pacote compartilhado

```js
import { protocolSchema } from '@meus-remedios/core'
```

### E nao

```js
import { protocolSchema } from '../../../../packages/core/src/schemas'
```

---

## 14. Riscos conhecidos e como neutralizar

## 14.1. Risco: quebra de alias

Mitigacao:

- revisar `vite.config.js`
- revisar `vitest`
- revisar `eslint`

## 14.2. Risco: quebra de deploy

Mitigacao:

- tratar configuracao de plataforma como parte do escopo
- nao considerar sucesso local como suficiente

## 14.3. Risco: quebrar `api/` por mudar root de deploy

Mitigacao:

- validar explicitamente coexistencia entre frontend em `apps/web` e serverless em `api/`
- se o provedor nao suportar bem este layout atual, adiar a fase

## 14.4. Risco: introduzir refactor escondido

Mitigacao:

- revisar diff com foco em moves e wiring
- rejeitar mudancas oportunistas nao relacionadas

---

## 15. Testes obrigatorios

Executar ao menos:

- lint da web
- testes da web afetados
- build da web
- smoke da web autenticada
- smoke da web anonima
- smoke de integracao com Supabase
- smoke de integracao com `api/notify` e `api/telegram` se dependentes do build/deploy atual
- smoke de workspace mobile apos a mudanca estrutural

### Checklist manual obrigatorio

1. landing abre sem crash
2. login continua funcionando
3. dashboard abre
4. navegacao view-based continua funcional
5. profile/settings continuam abrindo
6. assets publicos carregam
7. build de producao abre localmente
8. `apps/mobile/app.config.js` continua resolvendo corretamente
9. `apps/mobile` continua iniciando pelo workspace root

---

## 16. O que um agente executor deve evitar

- nao mover `api/` para `apps/web/api`
- nao mover `server/`
- nao refatorar features web no mesmo PR
- nao misturar TypeScript
- nao mexer no mobile alem do necessario para preservar workspace
- nao assumir que deploy automaticamente entendera `apps/web`

---

## 17. Criterios de saida da fase

A fase so termina quando:

- a web esta em `apps/web`
- o root continua funcionando como monorepo root
- `npm run dev` ou equivalente root continua amigavel
- `npm run build` ou equivalente root continua previsivel
- tests/lint/build da web estao verdes
- deploy esta documentado e funcional
- `api/` e `server/` permanecem estaveis
- mobile continua intacto

---

## 18. Quando NAO executar esta fase

Esta fase deve ser adiada se:

- o mobile ainda nao entrega valor real
- push/beta ainda estao instaveis
- o time nao sente dor operacional com a web na raiz
- a plataforma de deploy nao esta clara para o layout novo
- o maintainer humano nao aprovou o move

---

## 19. Ancoragem e validacao contra a master spec

Checklist de ancoragem obrigatoria:

- Esta spec tratou a migracao para `apps/web` como tardia e opcional.
- Esta spec exigiu Fases 1 a 6 concluidas antes do move.
- Esta spec preservou `api/` e `server/` no root.
- Esta spec nao misturou a migracao com redesign, TypeScript ou refactor massivo.
- Esta spec tratou deploy e scripts como parte integrante da fase.
- Esta spec reconheceu que, se o move nao for necessario, ele pode ser postergado.
- Esta spec protegeu explicitamente o release tooling do mobile durante o move da web.

Se qualquer implementacao derivada violar um dos itens acima, ela esta desalinhada com a master spec e deve ser corrigida antes do merge.
