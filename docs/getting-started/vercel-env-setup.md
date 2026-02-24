# Configuração de Ambiente Vercel para GitHub Actions

> Documentação de setup da infraestrutura segura: GitHub Actions ↔ Vercel ↔ Supabase

---

## Visão Geral

Esta documentação descreve como configurar os secrets e variáveis de ambiente necessários para a nova arquitetura segura onde GitHub Actions se comunica com endpoints Vercel em vez de acessar Supabase diretamente.

## Secrets Necessários

### 1. `VERCEL_GITHUB_ACTIONS_SECRET`

Token JWT compartilhado entre GitHub Actions e Vercel para autenticação segura.

#### Gerar o Secret

```bash
# Gerar 256 bits seguros em base64
openssl rand -base64 32

# Exemplo de output:
# kgCDEs3qYjgysYt5uYc7mYkt8/i8x4t2+RqNGhI0aE0=
```

**⚠️ IMPORTANTE:** Guarde este valor em um local seguro. Ele deve ser idêntico em ambos GitHub e Vercel.

#### Configurar no GitHub

**Via UI (Recomendado para primeira vez):**

1. Acesse: `https://github.com/SEU_USUARIO/meus-remedios/settings/secrets/actions`
2. Clique em "New repository secret"
3. Name: `VERCEL_GITHUB_ACTIONS_SECRET`
4. Value: Cole o valor gerado acima
5. Clique "Add secret"

**Via CLI (gh):**

```bash
# Verificar secrets existentes
gh secret list

# Adicionar novo secret
gh secret set VERCEL_GITHUB_ACTIONS_SECRET --body "kgCDEs3qYjgysYt5uYc7mYkt8/i8x4t2+RqNGhI0aE0="

# Ou via arquivo
gh secret set VERCEL_GITHUB_ACTIONS_SECRET < secret.txt
```

#### Configurar no Vercel

**Via Dashboard:**

1. Acesse: `https://vercel.com/dashboard`
2. Selecione o projeto `meus-remedios`
3. Vá em "Settings" → "Environment Variables"
4. Adicione:
   - Name: `VERCEL_GITHUB_ACTIONS_SECRET`
   - Value: **Mesmo valor do GitHub**
   - Environment: Production, Preview, Development
5. Clique "Save"

**Via CLI:**

```bash
# Verificar env vars existentes
vercel env ls

# Adicionar em todos os environments
vercel env add VERCEL_GITHUB_ACTIONS_SECRET production
# Cole o valor quando solicitado

vercel env add VERCEL_GITHUB_ACTIONS_SECRET preview
vercel env add VERCEL_GITHUB_ACTIONS_SECRET development
```

### 2. `VERCEL_BLOB_TOKEN` / `BLOB_READ_WRITE_TOKEN`

Token para upload/download de arquivos no Vercel Blob.

#### Obter no Dashboard Vercel

1. Acesse: `https://vercel.com/dashboard`
2. Clique na sua equipe/projeto
3. Vá em "Settings" → "Blob"
4. Se não tiver um store, crie um clicando "Create Store"
5. Copie o "Blob Read/Write Token"

#### Configurar no GitHub (para upload)

```bash
gh secret set VERCEL_BLOB_TOKEN --body "vercel_blob_rw_SEU_TOKEN_AQUI"
```

#### Configurar no Vercel (para download pelos endpoints)

**⚠️ IMPORTANTE:** Este token TAMBÉM deve ser configurado no Vercel para que os endpoints da API (`/api/gemini-reviews/persist` e `/api/gemini-reviews/create-issues`) possam baixar arquivos de blobs privados.

```bash
# Adicionar no Vercel (todos os environments)
vercel env add BLOB_READ_WRITE_TOKEN production
# Cole o valor quando solicitado

vercel env add BLOB_READ_WRITE_TOKEN preview
vercel env add BLOB_READ_WRITE_TOKEN development
```

O código verifica tanto `BLOB_READ_WRITE_TOKEN` quanto `VERCEL_BLOB_TOKEN`.

---

## Variáveis Existentes

Estas variáveis já devem estar configuradas:

| Variável | Local | Status |
|----------|-------|--------|
| `SUPABASE_URL` | GitHub + Vercel | ✅ Verificar |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub + Vercel | ✅ Verificar |
| `SUPABASE_ANON_KEY` | Vercel (frontend) | ✅ Verificar |

### Verificação

```bash
# No GitHub
gh secret list

# No Vercel
vercel env ls
```

---

## Testando a Configuração

### 1. Testar Secret no GitHub

```bash
# Criar workflow de teste temporário
mkdir -p .github/workflows
cat > .github/workflows/test-secrets.yml << 'EOF'
name: Test Secrets
on: workflow_dispatch
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Check Secrets
        run: |
          if [ -n "${{ secrets.VERCEL_GITHUB_ACTIONS_SECRET }}" ]; then
            echo "✅ VERCEL_GITHUB_ACTIONS_SECRET configurado"
          else
            echo "❌ VERCEL_GITHUB_ACTIONS_SECRET não configurado"
          fi
          
          if [ -n "${{ secrets.VERCEL_BLOB_TOKEN }}" ]; then
            echo "✅ VERCEL_BLOB_TOKEN configurado"
          else
            echo "❌ VERCEL_BLOB_TOKEN não configurado"
          fi
EOF
```

Execute via GitHub UI: Actions → Test Secrets → Run workflow

### 2. Testar Upload para Vercel Blob

```bash
# Localmente (com token configurado)
export VERCEL_BLOB_TOKEN="seu-token-aqui"
echo '{"test": true}' > /tmp/test.json
node .github/scripts/upload-to-vercel-blob.cjs /tmp/test.json test-upload.json
```

### 3. Testar Endpoint Vercel (quando implementado)

```bash
# Testar autenticação
export ACTIONS_SECRET="seu-secret-aqui"
curl -X POST https://seu-projeto.vercel.app/api/gemini-reviews/batch-update \
  -H "Authorization: Bearer $ACTIONS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## Troubleshooting

### "VERCEL_BLOB_TOKEN não configurado"

Verifique se o secret foi adicionado corretamente:

```bash
gh secret list | grep VERCEL_BLOB_TOKEN
```

### "Token inválido" no upload

1. Verifique se o token foi copiado corretamente do dashboard
2. Certifique-se de que a store Blob existe e está ativa
3. Tente regenerar o token no dashboard

### Valores diferentes entre GitHub e Vercel

Os valores de `VERCEL_GITHUB_ACTIONS_SECRET` **DEVEM** ser idênticos:

```bash
# Teste com echo (não mostra o valor real, apenas verifica se existe)
echo "GitHub: ${{ secrets.VERCEL_GITHUB_ACTIONS_SECRET }}" | wc -c
echo "Vercel: ${VERCEL_GITHUB_ACTIONS_SECRET}" | wc -c

# Se os tamanhos forem diferentes, os valores são diferentes
```

---

## Checklist Final

- [X] `VERCEL_GITHUB_ACTIONS_SECRET` gerado (256 bits)
- [X] `VERCEL_GITHUB_ACTIONS_SECRET` configurado no GitHub
- [X] `VERCEL_GITHUB_ACTIONS_SECRET` configurado no Vercel (mesmo valor)
- [X] `VERCEL_BLOB_TOKEN` obtido no dashboard Vercel
- [X] `VERCEL_BLOB_TOKEN` configurado no GitHub
- [ ] Teste de workflow executado com sucesso
- [ ] Teste de upload para Blob executado com sucesso

---

## Referências

- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [GitHub Actions Secrets](https://docs.github.com/pt/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

*Última atualização: 2026-02-23*
*Versão: 1.0*
