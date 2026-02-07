# rules.md

## GIT RULES

Regras padrão para modificação de código fonte

## Diretrizes

- NUNCA comitar diretamente na `main`. SEMPRE criar branch primeiro.
- Antes de iniciar as suas tarefas de coding, você deve criar um novo branch no Git (utilizando o naming proposto)
- Você aloca todo o seu trabalho atual de coding e alteração de arquivos em um PR específico
- Após fazer o push do PR, você commita seu código, faz o merge com o `main` e apaga seu branch

## Branch Naming

- **feat/**: Para novas funcionalidades (ex: `feat/user-authentication`)
- **fix/**: Para correções de bugs (ex: `fix/login-error`)
- **docs/**: Para atualizações de documentação (ex: `docs/update-readme`)
- **refac/**: Para refatorações de código (ex: `refac/optimize-api`)
- **test/**: Para adição ou modificação de testes (ex: `test/add-unit-tests`)


## Commit Semanticos Obrigatorios

- Use o formato: `<type>(<scope>): <subject>`
  - **type**: feat, fix, docs, style, refac, test, chore
  - **scope**: (opcional) parte do código afetada
  - **subject**: descrição concisa (máx. 50 caracteres)

| Type | Quando Usar | Exemplo |
|------|-------------|---------|
| `feat` | Nova funcionalidade | `feat(widget): adicionar score de adesão` |
| `fix` | Correção de bug | `fix(bot): corrigir escape de markdown` |
| `docs` | Documentação | `docs(readme): atualizar instruções` |
| `test` | Testes | `test(service): adicionar testes de adesão` |
| `refactor` | Refatoração | `refac(hook): otimizar useCachedQuery` |
| `style` | Formatação | `style(lint): corrigir erros de lint` |
| `chore` | Manutenção | `chore(deps): atualizar dependências` |


## Pull Requests

- Crie PRs para cada featu na branch


## Fluxo Obrigatório

```bash
# 1. Sempre começar na main atualizada
git checkout main
git pull origin main

# 2. Criar branch ANTES de qualquer alteração
git checkout -b feat/wave-X/nome-descritivo

# 3. Desenvolver com commits atômicos e semânticos

# 4. Validar antes de push
npm run lint
npm run test:critical
npm run build

# 5. Push e criar PR
git push origin feat/wave-X/nome-descritivo

# 6. Merge via PR apenas (com review) // usar sempre `--no-ff
git merge --no-ff feat/wave-X/nome-descritivo

# 7. Apagar branch após merge
git branch -d feat/wave-X/nome-descritivo
```

# Roo Agent Rules

## MAIN LONG-TERM LEARNING LOOP (obrigatório)

## RULES BEGIN

### 1) No início de um conjunto de tarefas
- Leia o arquivo de memória: `@/.roo/rules/memory.md`
- Extraia 3–7 “regras locais”/aprendizados aplicáveis ao trabalho atual (ex.: “nesse repo, X costuma quebrar Y”).

### 2) Ao final de **cada** conjunto de tarefas (obrigatório)
Você deve **apendar** (append) uma nova entrada em:
`@/.roo/rules/memory.md`

**Nunca sobrescreva** o arquivo. Não edite entradas antigas, exceto se explicitamente solicitado.

#### 2.1) Formato padrão da entrada (copiar e usar sempre)
Adicione ao final do arquivo exatamente neste formato:

## Memory Entry — YYYY-MM-DD HH:MM
**Contexto / Objetivo**
- (1–3 bullets do que foi pedido e o resultado esperado)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `path/to/file.ext` — (resumo)
- Comportamento impactado:
  - (bullet)

**Verificação**
- Testes/checagens executadas:
  - (ex.: unit, integration, build, lint, repro steps)
- Evidência do resultado:
  - (saídas, critérios atendidos, observações)

**O que deu certo**
- (2–5 bullets: técnicas, abordagens, decisões que funcionaram)

**O que não deu certo / riscos**
- (2–5 bullets: dead ends, falhas, pontos de atenção, dívidas)

**Causa raiz (se foi debug)**
- Sintoma:
- Causa:
- Correção:
- Prevenção:

**Decisões & trade-offs**
- Decisão:
- Alternativas consideradas:
- Por que:

**Regras locais para o futuro (lições acionáveis)**
- (3–7 bullets curtos, no estilo “Se X, então Y”)

**Pendências / próximos passos**
- (bullets objetivos, com prioridade se possível)

### 3) O que NÃO vai para a memória
- Segredos/credenciais.
- Texto longo redundante.
- Discussões irrelevantes para o futuro do projeto.
- Opiniões vagas sem ação (“foi difícil”).

> If anything is uncertain, explicitly state assumptions and propose the safest next step.

## RULES END

### START MEMORIES BELOW
