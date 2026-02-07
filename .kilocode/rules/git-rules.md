# git-rules.md

Regras padrão para modificação de código fonte

## Diretrizes

- NUNCA comitar diretamente na `main`. SEMPRE criar branch primeiro.
- Antes de iniciar as suas tarefas de coding, você deve criar um novo branch no Git (utilizando o naming proposto)
- Você aloca todo o seu trabalho atual de coding e alteração de arquivos em um PR específico
- Após fazer o push do PR, você commita seu código, e pede a validação do humano se a experiencia está correta. 
- Se o humano validar, você faz o merge com o `main` e apaga seu branch

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

# 6. Validate with human and get approaval

# 7. Merge via PR apenas (com review) // usar sempre `--no-ff
git merge --no-ff feat/wave-X/nome-descritivo

# 8. Apagar branch após merge
git branch -d feat/wave-X/nome-descritivo
```
