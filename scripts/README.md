# 🏥 Scripts de Medicamentos

Ferramentas para gerenciar e sincronizar dados de medicamentos com base ANVISA.

## 📦 Scripts Disponíveis

### 1️⃣ **populate-therapeutic-class.mjs**
Principal script de população de classe terapêutica.

**Uso:**
```bash
# Simular (recomendado)
node scripts/populate-therapeutic-class.mjs --user-id=YOUR_UUID --dry-run --verbose

# Executar de verdade
node scripts/populate-therapeutic-class.mjs --user-id=YOUR_UUID --verbose
```

**O que faz:**
- Carrega dados ANVISA
- Busca medicamentos no Supabase
- Atualiza `therapeutic_class` com title case
- Usando SERVICE_KEY do .env.local

### 2️⃣ **compare-with-anvisa.mjs**
Compara medicamentos do DB com base ANVISA.

**Uso:**
```bash
node scripts/compare-with-anvisa.mjs
```

**Output:**
Tabela lado a lado mostrando:
- Nome medicamento
- Princípio ativo (DB vs ANVISA)
- Classe terapêutica (ANVISA)
- Status de match

### 3️⃣ **check-active-ingredients.mjs**
Verifica quais medicamentos têm `active_ingredient` preenchido.

**Uso:**
```bash
node scripts/check-active-ingredients.mjs
```

**Útil para:** Diagnosticar medicamentos sem princípio ativo.

### 4️⃣ **find-in-anvisa.mjs**
Busca medicamentos específicos no CSV da ANVISA.

**Uso:**
```bash
node scripts/find-in-anvisa.mjs
```

**Útil para:** Validar grafia exata e encontrar classe terapêutica.

### 5️⃣ **test-therapeutic-class.mjs**
Testa o script principal com dados mock (sem acessar banco).

**Uso:**
```bash
node scripts/test-therapeutic-class.mjs --verbose
```

**Útil para:** Validar funcionamento antes de executar em produção.

---

## 🚀 Workflow Recomendado

### 1. Diagnosticar Estado Atual
```bash
node scripts/compare-with-anvisa.mjs
```

### 2. Testar com Mock Data
```bash
node scripts/test-therapeutic-class.mjs --verbose
```

### 3. Simular no Seu Banco
```bash
node scripts/populate-therapeutic-class.mjs --user-id=YOUR_UUID --dry-run --verbose
```

### 4. Executar de Verdade
```bash
node scripts/populate-therapeutic-class.mjs --user-id=YOUR_UUID --verbose
```

### 5. Verificar Resultado
```bash
node scripts/compare-with-anvisa.mjs
```

---

## 📋 Parametros Comuns

### `--user-id=UUID`
User ID do Supabase (obrigatório para populate-therapeutic-class)

```bash
node scripts/populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26
```

### `--dry-run`
Simula alterações sem fazer nada no banco

```bash
node scripts/populate-therapeutic-class.mjs --user-id=... --dry-run
```

### `--verbose`
Mostra detalhes de cada operação

```bash
node scripts/populate-therapeutic-class.mjs --user-id=... --verbose
```

---

## 📚 Documentação

Leia a documentação completa em `scripts/docs/`:
- `THERAPEUTIC_CLASS_README.md` — Resumo rápido
- `THERAPEUTIC_CLASS_SETUP.md` — Guia completo de setup
- `POPULATE_THERAPEUTIC_CLASS.md` — Documentação detalhada do script

---

## 🔐 Credenciais Necessárias

Todos os scripts precisam de `.env.local` com:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_KEY=sbp_xxxxxx
```

---

## 🐛 Troubleshooting

### "ERRO: Configure SUPABASE_SERVICE_KEY"
Verifique `.env.local` tem a SERVICE_KEY do Supabase.

### "0 medicamentos encontrados"
Seu banco não tem medicamentos, ou nenhum tem `active_ingredient` preenchido.

### "Muitos 'Sem match'"
Use `find-in-anvisa.mjs` ou `compare-with-anvisa.mjs` para diagnosticar.

---

**Última atualização:** 2026-03-20
