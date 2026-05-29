# Exec Spec 3: Deprecação de Gemini Reviews

**Domínio:** Integrações Externas / Tooling Interno
**Objetivo:** Remover endpoints de API, dependências no pacote e rotinas no banco de dados encarregadas de persistir revisões do Gemini. Vamos manter apenas as actions base de Pull Requests do repositório gerando feedbacks nativos.

## 1. Contexto e Motivação
A tabela `gemini_reviews` contém milhares de registros paralelos não geridos. Como as próprias issues do Github se encarregam desse acompanhamento, extinguiremos a persistência paralela em banco (Supabase) e em Blob (Vercel), devolvendo budget de serverless. No entanto, **todos os steps e lógicas vitais do GitHub Actions (`gemini-review.yml`) que geram as tabelas de resumo e bloqueiam PRs por alertas de segurança serão rigorosamente mantidos.**


## 2. Escopo de Alterações

### API (Remoções de Código)
- **Deletar:** `api/gemini-reviews.js` (O router principal).
- **Deletar Diretório:** `api/gemini-reviews/` inteiro, contendo:
  - `_handlers/persist.js`
  - `_handlers/create-issues.js`
  - `_handlers/update-status.js`
  - `_handlers/batch-update.js`
  - `_shared/logger.js` e `_shared/security.js`

### UI / Services (Frontend)
- **Deletar:** `apps/web/src/services/api/geminiReviewService.js`.
- (Opcional) Procurar e remover importações orfãs apontando para o `geminiReviewService` no resto dos componentes da camada "web".

### Infra & Bibliotecas
- **Remover Dependência:** npm package `@vercel/blob` (rodar o uninstall).
- **Deletar Script CI:** `upload-to-vercel-blob.cjs` localizado em `.github/scripts/`.

### GitHub Actions (`gemini-review.yml`)
- **Modificar (Remover Integração Externa):** Encontrar e deletar o `fetch` ou step (`node`) que invoca `POST /api/gemini-reviews/persist` enviando dados para o backend da Vercel.
- **MANTER E PROTEGER (Não remover):**
  - **Parsing e Classificação:** O step que processa os comentários inline postados pelo Gemini.
  - **Tabelas de Resumo:** A compilação do markdown gerado e postado como "Summary" no PR.
  - **Security / Critical Gates:** Qualquer lógica que verifica tags como `![security-critical]` e falha o pipeline (bloqueando o PR).
  - O objetivo é que o CI rode 100% no ecossistema local do GitHub Actions sem tentar persistir os dados externamente.

## 3. Critérios de Validação
- [ ] Nenhuma quebra residual reportada pelo Vercel local build (`npm run build`).
- [ ] Ao abrir ou alterar um novo PR após essa especificação, a ação nativa do GitHub roda reportando as revisões localmente no diff da PR sem lançar erros no job (falha de pipeline).
