# Setup: Popular Classe Terapêutica dos Medicamentos

Guia rápido para usar os scripts de população de classe terapêutica.

## 📦 O que você tem

```
populate-therapeutic-class.mjs     # Script principal (Supabase em tempo real)
test-therapeutic-class.mjs         # Script de teste (com dados mock)
POPULATE_THERAPEUTIC_CLASS.md       # Documentação detalhada
```

## 🚀 Quick Start

### Configurar user_id

Você pode fornecer seu `user_id` de três formas:

**Opção 1: CLI (mais rápido)**
```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run
```

**Opção 2: Variável de Ambiente**
```bash
export SUPABASE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26
node populate-therapeutic-class.mjs --dry-run
```

**Opção 3: .env.local**
```bash
# Adicione ao .env.local
VITE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26

# Depois apenas execute
node populate-therapeutic-class.mjs --dry-run
```

### 1️⃣ Testar Primeiro (Recomendado)

```bash
# Ver como o script funciona com dados mock
node test-therapeutic-class.mjs

# Com detalhes de cada medicamento
node test-therapeutic-class.mjs --verbose
```

**Output esperado:**
- ✅ Carrega CSV da ANVISA (10.207 registros, 2.277 princípios ativos únicos)
- ✅ Processa medicamentos de teste
- ✅ Valida matching com ANVISA

### 2️⃣ Simular no Seu Banco (Dry Run)

```bash
# Ver quantos medicamentos seriam atualizados SEM fazer nada
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run

# Com detalhes
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run --verbose
```

**Output esperado:**
```
🚀 Iniciando população de classe terapêutica

📋 Modo: ⚠️  DRY RUN (sem alterações)
📊 Verbose: desativado

📥 Carregando dados da ANVISA...
✅ 10207 registros carregados

🗺️  Construindo mapa de princípios ativos...
✅ 2277 princípios ativos únicos

🔍 Buscando medicamentos no banco...
✅ X medicamentos encontrados

📊 Resumo do processamento:
  ✓ Já possuem classe correta: N
  📝 Precisam de atualização: M
  ⏭️  Sem match: K
  📦 Total: X
```

### 3️⃣ Executar de Verdade

```bash
# Aplicar atualizações no banco
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26

# Com log detalhado
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --verbose
```

## 📋 Como Funciona

### CSV da ANVISA
```
public/medicamentos-ativos-anvisa.csv
├── NOME_PRODUTO
├── CLASSE_TERAPEUTICA      ← Isso você quer copiar
├── PRINCIPIO_ATIVO         ← Isso é a chave para matching
└── EMPRESA_DETENTORA_REGISTRO
```

### Processo
1. **Lê CSV** → 10.207 medicamentos ANVISA
2. **Normaliza princípios ativos** → Remove acentos, minúsculas, espaços extras
3. **Cria mapa** → principio_ativo → classe_terapeutica
4. **Busca medicamentos no Supabase** → Tabela `medicines`
5. **Faz matching** → Compara `active_ingredient` do seu medicamento com ANVISA
6. **Atualiza** → Popula `therapeutic_class` com dados da ANVISA

### Exemplo de Matching
```
Seu banco:
├─ Dipirona (active_ingredient: "Dipirona")
└─ ÁCIDO ACETILSALICÍLICO (active_ingredient: "Ácido Acetilsalicílico")

↓ Normalização
├─ "dipirona"
└─ "acido acetilsalicilico"

↓ Busca em ANVISA (2.277 princípios ativos)
├─ DIPIRONA MONOIDRATADA → "dipirona monoidratada" → ANALGESICOS
└─ ACIDO ACETILSALICILICO → "acido acetilsalicilico" → ANALGESICOS NAO NARCOTICOS

↓ Match parcial (a normalização ajuda)
├─ ✅ "dipirona" encontra "dipirona monoidratada"
└─ ✅ "acido acetilsalicilico" encontra "acido acetilsalicilico"

↓ Resultado
├─ Dipirona → therapeutic_class = "ANALGESICOS"
└─ Ácido Acetilsalicílico → therapeutic_class = "ANALGESICOS NAO NARCOTICOS"
```

## ⚙️ Configuração

### Pré-requisitos
- Node.js >= 18
- `.env.local` com credenciais Supabase (já devem estar lá)
- Seu `user_id` UUID (fornecido via CLI, env var ou .env.local)
- Medicamentos cadastrados com `active_ingredient` preenchido

### Env Vars Necessárias
O script lê automaticamente de `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
```

### User ID
Forneça seu user_id de uma das formas:
```bash
# Opção 1: CLI
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26

# Opção 2: Env var
export SUPABASE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26

# Opção 3: .env.local
VITE_USER_ID=b0c9746c-c4d9-4954-a198-59856009be26
```

## 📊 Interpretando Output

### Medicamentos "Já com classe correta"
```
✓ Já possuem classe correta: 42
```
Seus medicamentos já têm a classe correta (matching com ANVISA). Não haverá updates.

### Medicamentos "Precisam de atualização"
```
📝 Precisam de atualização: 18
```
Seus medicamentos têm `active_ingredient` mas:
- Não têm `therapeutic_class` preenchido, OU
- Têm uma classe desatualizada/diferente da ANVISA

Esses serão atualizados.

### Medicamentos "Sem match"
```
⏭️ Sem match: 5
```
Esses medicamentos têm `active_ingredient` mas **não foram encontrados na ANVISA**. Motivos:
- Medicamento descontinuado
- Erro de digitação no princípio ativo
- Medicamento muito novo (ANVISA desatualizada)
- Medicamento de uso composto

**Ação:** Verificar manualmente e corrigir `active_ingredient` se necessário.

## 🎯 Checklist

- [ ] Executei `node test-therapeutic-class.mjs` com sucesso
- [ ] Medicamentos estão cadastrados com `active_ingredient` preenchido
- [ ] Executei `node populate-therapeutic-class.mjs --dry-run` e revisei
- [ ] Estou OK com o número de atualizações
- [ ] Executei `node populate-therapeutic-class.mjs` (sem dry-run)
- [ ] Verifiquei no dashboard que `therapeutic_class` foi preenchido

## 🔍 Possíveis Problemas

### "0 medicamentos encontrados"
Significa que não há medicamentos cadastrados na sua conta.
**Ação:** Cadastre medicamentos primeiro com `active_ingredient` preenchido.

### "5 Sem match"
Alguns medicamentos não foram encontrados na ANVISA.
**Ação:** Use `--verbose` para ver quais, revise e corrija o `active_ingredient`.

### Erro de conexão Supabase
Se o script não conseguir conectar:
1. Verifique `.env.local` tem as keys corretas
2. Verifique internet
3. Verifique se Supabase está up (https://status.supabase.com)

## 📝 Exemplo de Execução Real

```bash
$ node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run --verbose

🚀 Iniciando população de classe terapêutica

📋 Modo: ⚠️  DRY RUN (sem alterações)

📥 Carregando dados da ANVISA...
✅ 10207 registros carregados

🗺️  Construindo mapa de princípios ativos...
✅ 2277 princípios ativos únicos

🔍 Buscando medicamentos no banco...
✅ 65 medicamentos encontrados

🔄 Processando medicamentos...

  ✓ [Dipirona 500mg] Já possui classe correta
  📝 [Paracetamol 750mg]
     Antiga: vazio
     Nova:   ANALGESICOS NAO NARCOTICOS
  ✓ [Amoxicilina 500mg] Já possui classe correta
  ⏭️  [Medicamento Desconhecido] Princípio ativo não encontrado na ANVISA

📊 Resumo do processamento:
  ✓ Já possuem classe correta: 42
  📝 Precisam de atualização: 18
  ⏭️  Sem match: 5
  📦 Total: 65

⚠️ Modo DRY RUN: Nenhuma alteração foi feita.
Execute sem --dry-run para aplicar as mudanças.
```

Depois:

```bash
$ node populate-therapeutic-class.mjs --verbose

⚙️  Aplicando 18 atualizações...

  ✅ [Paracetamol 750mg] vazio → ANALGESICOS NAO NARCOTICOS
  ✅ [Ibuprofeno 400mg] vazio → ANALGESICOS NAO NARCOTICOS
  ✅ [Omeprazol 20mg] vazio → ANTIACIDOS E ANTIULCEROSOS
  ...

✅ Atualização concluída!
  ✅ Sucesso: 18
  ❌ Erros: 0

🎉 Todos os medicamentos foram atualizados com sucesso!
```

## 🚀 Próximos Passos

1. **Verificar no Dashboard** → Confirme que `therapeutic_class` foi preenchido
2. **Usar em Filtros** → Implemente filtro por classe terapêutica se quiser
3. **Rodar Periodicamente** → Considere rodar semanal/mensal quando novos medicamentos forem adicionados
4. **Documentar** → Registre no projeto que classe terapêutica é populada automaticamente

## 📚 Documentação Completa

Para mais detalhes, veja: `POPULATE_THERAPEUTIC_CLASS.md`

---

**Versão:** 1.0
**Criado:** 2026-03-20
**Status:** ✅ Pronto para uso
