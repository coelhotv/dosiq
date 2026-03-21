# Script: Popula Classe Terapêutica dos Medicamentos

Este script atualiza o campo `therapeutic_class` dos medicamentos já cadastrados no Supabase, usando os dados oficiais da ANVISA (baseado em `public/medicamentos-ativos-anvisa.csv`).

## 📋 Como Funciona

1. **Lê o CSV da ANVISA** → Carrega `public/medicamentos-ativos-anvisa.csv`
2. **Cria mapa de princípios ativos** → Mapeia `PRINCIPIO_ATIVO` → `CLASSE_TERAPEUTICA`
3. **Busca medicamentos no banco** → Seleciona registros com `active_ingredient` preenchido
4. **Faz matching** → Normaliza e compara o princípio ativo cadastrado com os da ANVISA
5. **Atualiza** → Popula `therapeutic_class` para medicamentos sem classe ou com classe desatualizada

## 🚀 Uso

### Configurar user_id (obrigatório)

**Via CLI (mais fácil):**
```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run
```

**Via variável de ambiente:**
```bash
export SUPABASE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26
node populate-therapeutic-class.mjs --dry-run
```

**Via .env.local:**
```bash
# Adicione ao .env.local:
VITE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26

# Depois execute:
node populate-therapeutic-class.mjs --dry-run
```

### Simulação (recomendado antes de rodar de verdade)

```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run
```

Isso mostra quantos medicamentos seriam atualizados **sem fazer nenhuma alteração no banco**.

### Com Verbose (ver detalhes)

```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run --verbose
```

Exibe para cada medicamento:
- Se já possui a classe correta
- Se precisa atualização (antiga → nova)
- Se não teve match na ANVISA

### Executar de Verdade

```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26
```

⚠️ **Recomendação:** Sempre executar com `--dry-run` primeiro para verificar o impacto.

### Executar + Verbose

```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --verbose
```

Mostra cada atualização sendo aplicada em tempo real.

## 📊 O que o Script Faz

### Etapas de Execução

1. **Carrega ANVISA** → Lê CSV e normaliza princípios ativos
2. **Busca medicamentos** → Seleciona todos os medicamentos do banco
3. **Processa cada medicamento:**
   - ✓ Se já tem classe correta → pula
   - 📝 Se precisa atualizar → adiciona à fila
   - ⏭️ Se não tem princípio ativo ou não faz match → pula
4. **Aplica updates** → Atualiza em lotes de 10 para não sobrecarregar API

### Output

```
📊 Resumo do processamento:
  ✓ Já possuem classe correta: 42
  📝 Precisam de atualização: 18
  ⏭️ Sem match: 5
  📦 Total: 65
```

## 🔧 Normalização de Princípios Ativos

O script normaliza os princípios ativos para comparação:

```javascript
// Exemplo:
"Dipirona Monoidratada"  →  "dipirona monoidratada"
"ÁCIDO ACETILSALICÍLICO" →  "acido acetilsalicilico"
"Paracetamol  extra"      →  "paracetamol extra"
```

**Transformações:**
1. Minúsculas
2. Remove acentos
3. Trim
4. Normaliza espaços múltiplos

Isso maximiza o match rate entre medicamentos cadastrados e base ANVISA.

## 💾 Env Vars Necessárias

### Supabase (em .env.local)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### User ID (fornecer via CLI, env var ou .env.local)
```bash
# Opção 1: CLI (recomendado)
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26

# Opção 2: Env var
export SUPABASE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26

# Opção 3: .env.local
VITE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26
```

Se não estiver configurado, o script avisa e fecha.

## ⚡ Performance

- **Carregamento CSV:** < 500ms
- **Busca de medicamentos:** ~1s (depende da quantidade)
- **Processamento:** ~2s para 500 medicamentos
- **Atualizações:** ~100ms por lote (lotes de 10)

Total estimado: **< 30s para 500 medicamentos**

## ⚠️ Casos Especiais

### Medicamentos sem princípio ativo

Se um medicamento não tem `active_ingredient` preenchido, é pulado.

**Solução:** Preencher manualmente o campo `active_ingredient` antes de rodar o script.

### Princípio ativo não encontrado na ANVISA

Se o princípio ativo não existe na base ANVISA, o medicamento é pulado.

**Diagnóstico:** Use `--verbose` para ver quais medicamentos não fazem match.

**Possíveis razões:**
- Grafia diferente (ex: "Paracetamol" vs "Paracetamol monoidratado")
- Medicamento descontinuado ou não cadastrado na ANVISA
- Erro de digitação

### Múltiplas classes para mesmo princípio ativo

Se a ANVISA tem múltiplas produtos com mesmo princípio ativo mas classes diferentes, o script usa a primeira encontrada.

**Solução:** Revisar manualmente nesses casos (raro).

## 🔄 Executar Periodicamente

Você pode colocar isso em um cron job ou scheduler:

```bash
# Executar toda semana (via GitHub Actions, vercel.json, etc)
node populate-therapeutic-class.mjs
```

Medicamentos já com classe correta não serão re-processados.

## 📋 Checklist Pre-Execução

- [ ] Arquivo `.env.local` configurado com Supabase keys
- [ ] CSV `public/medicamentos-ativos-anvisa.csv` existe
- [ ] Node.js >= 18 (para `--verbose` e features modernas)
- [ ] Executei com `--dry-run` primeiro
- [ ] Revisei o output e estou OK com as mudanças

## 🐛 Troubleshooting

### "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY"

Crie/atualize `.env.local` com as credenciais do Supabase.

```bash
# No projeto root
cat > .env.local << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
EOF
```

### "Erro ao ler CSV"

Verifique se:
1. Arquivo existe em `public/medicamentos-ativos-anvisa.csv`
2. Não tem caracteres especiais ou encoding quebrado
3. Primeira linha é cabeçalho com: `NOME_PRODUTO;CLASSE_TERAPEUTICA;PRINCIPIO_ATIVO`

### "Nenhuma atualização necessária"

Significa que todos os medicamentos já têm `therapeutic_class` correta. Tudo OK! ✅

### Script trava ou é muito lento

Se está lento:
1. Use `--dry-run` (não faz updates)
2. Verifique internet (atualizações fazem chamadas à API)
3. Reduza `batchSize` no código se precisar

## 📝 Logs e Auditoria

O script não escreve logs em arquivo automaticamente, mas você pode redirecionar:

```bash
# Salvar output em arquivo
node populate-therapeutic-class.mjs --verbose > therapeutic-class-update.log 2>&1

# Ver arquivo depois
tail -100 therapeutic-class-update.log
```

## 🚀 Próximos Passos

Após executar com sucesso:

1. Revisar medicamentos atualizados no dashboard
2. Verificar se campos `therapeutic_class` foram preenchidos
3. Testar filtro/busca por classe terapêutica (se existente na UI)
4. Considerar rodar periodicamente (semanal ou mensal)

## 📞 Suporte

Se encontrar erros:

1. Rode com `--dry-run --verbose` para diagnóstico
2. Verifique credenciais Supabase
3. Confirme que medicamentos têm `active_ingredient` preenchido
4. Revise o arquivo CSV da ANVISA (pode ter caracteres especiais)

---

**Criado em:** 2026-03-20
**Versão:** 1.0
**Status:** Pronto para uso
