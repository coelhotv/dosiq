# MASTER SPEC: Migração Completa "Meus Remédios" → "Dosiq"

> **Referência:** `plans/dosiq-migration/EXEC_SPEC_DOSIQ_MIGRATION_MASTER.md`
> **Versão:** 2.0 (pós-auditoria completa do repositório — 140 ocorrências mapeadas)
> **Status:** EM EXECUÇÃO — Fases 1, 2 e 3 concluídas; Fases 4 e 5 pendentes
> **Backup:** `/Users/coelhotv/meus-remedios-backup-before-dosiq.tar.gz` ✅ já criado

---

## 1. Contexto e Escopo Total

A plataforma "Meus Remédios" será renomeada para **Dosiq** em todas as suas camadas. Esta migração é **puramente de identidade e nomenclatura** — não altera banco de dados, tabelas Supabase, Design System, paleta de cores ou lógica de negócio.

### 1.1 Inventário de Referências Legadas Confirmadas (auditoria real)

A auditoria completa identificou **140 ocorrências** de strings legadas distribuídas por:

| Categoria | Strings legadas | Substituição |
|---|---|---|
| Nome UI/copy | `Meus Remédios`, `Meus Remedios` | `Dosiq` |
| Scope npm | `@meus-remedios/` | `@dosiq/` |
| Package name raiz | `meus-remedios` (campo `name`) | `dosiq` |
| Deep links nativos | `meusremedios://` | `dosiq://` |
| Cache key localStorage | `meus_remedios_query_cache` | `dosiq_query_cache` |
| Slug Expo | `meus-remedios-dev` | `dosiq-dev` |
| Bundle IDs iOS/Android | `com.coelhotv.meusremedios.*` | `com.coelhotv.dosiq` + variantes |
| URL Vercel | `meus-remedios.vercel.app` | `dosiq.vercel.app` |
| Bot username fallback | `meus_remedios_bot` | `dosiq_bot` |
| scheme Expo | `meusremedios` | `dosiq` |
| GitHub URL (hardcodadas) | `coelhotv/meus-remedios` | Manter até rename do repo; atualizar nas Fases 4 e 5 |

### 1.2 Todos os Pacotes do Monorepo a Renomear

| Pacote atual | Novo nome | Arquivo |
|---|---|---|
| `@meus-remedios/web` | `@dosiq/web` | `apps/web/package.json` |
| `@meus-remedios/mobile` | `@dosiq/mobile` | `apps/mobile/package.json` |
| `@meus-remedios/core` | `@dosiq/core` | `packages/core/package.json` |
| `@meus-remedios/design-tokens` | `@dosiq/design-tokens` | `packages/design-tokens/package.json` |
| `@meus-remedios/config` | `@dosiq/config` | `packages/config/package.json` |
| `@meus-remedios/shared-data` | `@dosiq/shared-data` | `packages/shared-data/package.json` |
| `@meus-remedios/storage` | `@dosiq/storage` | `packages/storage/package.json` |

> [!IMPORTANT]
> A renomeação de pacotes npm **não é apenas nos `package.json`s**. É preciso atualizar TODOS os arquivos `.js`/`.jsx` que fazem `import from '@meus-remedios/*'` E todos os comentários JSDoc que referenciam esses módulos por nome. A auditoria identificou imports reais em: `TodayScreen.jsx`, `nativePublicAppConfig.js`, `metro.config.js` (comentário), `createQueryCache.js`, `packages/config/src/index.js`, `packages/storage/src/index.js`, `packages/design-tokens/src/*.js`, `apps/web/vite.config.js`.

---

## 2. Abordagem Multi-Agente e Ordem de Execução

As fases têm **dependências** e NÃO são 100% paralelizáveis:

```
Fase 1 (Monorepo/Node) ──→ [GATE: npm install + lint] ──→ Fase 2 (Mobile)   ┐
                                                       ──→ Fase 3 (Web/PWA)  ├─→ [GATE] → Fase 5
                                                       ──→ Fase 4 (Bot/API)  ┘
```

**Regra crítica de sequência:** A Fase 1 deve ser **comitada e validada** antes de iniciar Fases 2, 3 e 4. A mudança de scope npm é a mais estrutural: quebra resolução de módulos se as outras fases tentarem rodar com pacotes parcialmente renomeados.

---

## 3. Regras de Qualidade Global (todos os agentes)

### 3.1 Bootstrap Obrigatório
```
Todo agente executor DEVE, antes de qualquer edição:
1. Executar /devflow (carregar memória DEVFLOW)
2. Ler este Master Spec na íntegra
3. Ler o Exec Spec da fase designada na íntegra
4. Confirmar que está na branch correta (refactor/dosiq-migration-fase-N)
5. Rodar `npm run lint` para confirmar baseline limpo antes de qualquer alteração
```

### 3.2 Quality Gate entre Sub-tarefas
Após cada grupo de arquivos modificados dentro de uma fase:
```bash
npm run lint              # Zero novos erros de lint
```

### 3.3 Quality Gate Final de Fase
```bash
npm run lint              # Zero erros
npm run test:changed      # Todos os testes dos arquivos alterados passando
npm run validate:agent    # Suite crítica com timeout de 10 min
```

### 3.4 Verificação de Resíduos Legados
O agente deve executar ao final de cada fase para confirmar que o escopo foi 100% limpo:
```bash
grep -rn "meus.remedios\|meusremedios\|Meus Rem\|@meus-remedios" \
  --include="*.js" --include="*.jsx" --include="*.json" --include="*.html" \
  [diretório_do_escopo_da_fase] \
  | grep -v node_modules | grep -v dist/ | grep -v ios/Pods
# Resultado esperado: 0 linhas
```

---

## 4. Proibições Absolutas para Todos os Agentes

> [!CAUTION]
> Violações podem corromper builds nativos ou quebrar a integração com Firebase/Supabase.

- ❌ Renomear tabelas ou colunas do banco Supabase
- ❌ Alterar paleta de cores, tokens de design ou lógica de componentes visuais
- ❌ Executar `mv` ou qualquer rename físico do diretório raiz do projeto
- ❌ Alterar o `EAS Project ID` (`7169f55a-6de7-465f-b007-f5eb6034c8e6`)
- ❌ Editar arquivos `.plist` ou `google-services*.json` (vêm dos painéis externos, providenciados pelo usuário)
- ❌ Fazer merge de qualquer PR sem aprovação explícita do usuário (R-060)
- ❌ Editar arquivos fora do escopo da fase designada
- ❌ Usar `--no-verify` ou pular hooks de pre-commit

---

## 5. Tabela de Fases e Specs

| # | Fase | Spec | Branch | Pré-req |
|---|---|---|---|---|
| 1 | Monorepo, NPM Packages & Tooling (Concluída ✅) | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_1.md` | `refactor/dosiq-migration-fase-1` | Nenhum |
| 2 | App Híbrido Mobile & Expo (Concluída ✅ — PR #484) | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_2.md` | `refactor/dosiq-migration-fase-2` | Fase 1 merged |
| 3 | Web App, SEO & PWA (Concluída ✅ — PR #485) | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_3.md` | `refactor/dosiq-migration-fase-3` | Fase 1 merged |
| 4 | Bot, API Serverless & Notificações | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_4.md` | `refactor/dosiq-migration-fase-4` | Fase 1 merged |
| 5 | Documentação, Devflow & Specs | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_5.md` | `refactor/dosiq-migration-fase-5` | Fases 1–4 merged |

### 5.1 Status Atual da Sprint (2026-04-21)

- [x] Fase 1 concluída e merged — PR #483 (`2026-04-21`)
- [x] Fase 2 concluída e merged — PR #484 (`2026-04-21`)
- [x] Fase 3 concluída e merged — PR #485 (`2026-04-21`)
- [ ] Fase 4 pendente de execução/merge
- [ ] Fase 5 pendente de execução/merge

---

## 6. Checklist Manual do Usuário (Serviços Externos)

> [!IMPORTANT]
> Estas ações não podem ser feitas por agentes de código. Execute em paralelo às fases técnicas.

### Firebase / Google Cloud
- [ ] App Android `com.coelhotv.dosiq` e iOS `com.coelhotv.dosiq` criados no Firebase Console
- [ ] Baixar e substituir os arquivos: `google-services-development.json`, `google-services-preview.json`, `google-services.json`
- [ ] Baixar e substituir os arquivos: `GoogleService-Info-development.plist`, `GoogleService-Info-preview.plist`, `GoogleService-Info.plist`
- [ ] Atualizar nome "Dosiq" na tela de OAuth Consent
- [ ] Adicionar SHA-1/SHA-256 do novo App Signing no Firebase Console

### Supabase
- [ ] Auth → Email Templates: Substituir "Meus Remédios" → "Dosiq" em **todos** os templates (Confirmation, Magic Link, Reset Password, Invite)
- [ ] Auth → URL Configuration: Adicionar `dosiq.vercel.app` nas Redirect URLs
- [ ] Auth → URL Configuration: Adicionar `dosiq://` (custom scheme) como redirect URL válida

### Expo EAS
- [ ] Confirmar slugs `dosiq-dev`, `dosiq-preview` e `dosiq` criados no painel expo.dev
- [ ] Rodar `eas credentials` para Keystore Android e Provisioning Profile iOS vinculados a `com.coelhotv.dosiq`

### Vercel
- [ ] Confirmar projeto respondendo em `dosiq.vercel.app`
- [ ] Atualizar variável de ambiente `TELEGRAM_BOT_TOKEN` → token do `dosiq_bot`

### Telegram
- [ ] Confirmar `dosiq_bot` ativo com token válido no `.env` local

---

## 7. Procedimento Final: Rename do Repositório GitHub

**Executar somente após aprovação e merge de TODAS as 5 fases:**

1. GitHub → Settings do repositório → Rename para `dosiq`
2. `git clone git@github.com:coelhotv/dosiq.git /Users/coelhotv/git-icloud/dosiq`
3. Copiar manualmente da pasta antiga para a nova:
   - `.env` e `.env.local` (raiz)
   - `apps/mobile/google-services-*.json` (todos os 3 arquivos)
   - `apps/mobile/GoogleService-Info-*.plist` (todos os 3 arquivos)
   - `.agent/` (diretório completo — memória DEVFLOW)
4. `npm install` no diretório novo
5. Atualizar workspace do IDE para o novo caminho

---

## 8. Verificação Final de Sucesso Pós-Migração

```bash
# Executar na raiz do NOVO repositório dosiq/:
grep -rn "meus.remedios\|meusremedios\|Meus Rem\|@meus-remedios" \
  --include="*.js" --include="*.jsx" --include="*.json" --include="*.html" \
  . | grep -v node_modules | grep -v dist/ | grep -v ios/Pods | grep -v plans/archive
# Resultado esperado: 0 linhas
```
