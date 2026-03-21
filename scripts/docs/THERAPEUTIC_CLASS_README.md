# 🏥 Classe Terapêutica - Solução Completa

Solução para popular a `therapeutic_class` dos medicamentos usando dados oficiais da ANVISA.

## 📦 Arquivos

```
populate-therapeutic-class.mjs     # Script principal
populate-my-medicines.sh           # Atalho para macOS/Linux (seu user_id pré-configurado)
populate-my-medicines.bat          # Atalho para Windows (seu user_id pré-configurado)
test-therapeutic-class.mjs         # Testes com dados mock
THERAPEUTIC_CLASS_SETUP.md         # Guia completo de setup
POPULATE_THERAPEUTIC_CLASS.md      # Documentação detalhada
```

## 🚀 Uso Rápido

### macOS/Linux
```bash
# Simular (recomendado)
./populate-my-medicines.sh --dry-run --verbose

# Executar de verdade
./populate-my-medicines.sh --verbose
```

### Windows
```bash
# Simular (recomendado)
populate-my-medicines.bat --dry-run --verbose

# Executar de verdade
populate-my-medicines.bat --verbose
```

### Sem Usar o Atalho
```bash
# Simular
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run

# Executar
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26
```

## 🧪 Testar Antes (Altamente Recomendado)

```bash
# Com dados mock (sem acessar o banco)
node test-therapeutic-class.mjs --verbose
```

Isso simula o matching com dados reais da ANVISA, sem mexer no seu banco.

## ✨ Recurso Especial: User ID Pré-configurado

Seus scripts de atalho já têm seu user_id configurado:

```bash
USER_ID="b0c9746c-c4d9-4954-a198-59856009be26"
```

Então você pode apenas:
```bash
./populate-my-medicines.sh --dry-run
```

E não precisa digitar:
```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26 --dry-run
```

## 📊 O que Acontece

```
1. Carrega ANVISA CSV
   └─ 10.207 medicamentos
   └─ 2.277 princípios ativos únicos

2. Busca seus medicamentos (filtrado por seu user_id)
   └─ Seleciona com active_ingredient preenchido

3. Faz matching
   └─ Normaliza: Remove acentos, minúsculas, espaços
   └─ Compara com dados ANVISA

4. Atualiza therapeutic_class
   └─ Se encontrou match → popula campo
   └─ Se já tem classe correta → pula
   └─ Se não tem match → marca como "sem match"

5. Relata resultados
   └─ Quantos foram atualizados
   └─ Quantos já tinham classe correta
   └─ Quantos não tiveram match
```

## 📋 Checklist Antes de Usar

- [ ] Rode `node test-therapeutic-class.mjs` com sucesso
- [ ] Medicamentos cadastrados com `active_ingredient` preenchido
- [ ] Variáveis Supabase em `.env.local`
- [ ] Rode com `--dry-run` primeiro
- [ ] Revisar output e estar OK com as mudanças

## 🎯 Próximos Passos

1. **Teste mock** → `node test-therapeutic-class.mjs`
2. **Dry run** → `./populate-my-medicines.sh --dry-run --verbose`
3. **Review** → Verifique o output (quantos serão atualizados?)
4. **Execute** → `./populate-my-medicines.sh`
5. **Verifique** → Veja no dashboard que `therapeutic_class` foi preenchido

## ⚠️ Notas Importantes

- **Script é seguro:** `--dry-run` simula sem fazer nada
- **User ID é obrigatório:** Para filtrar medicamentos corretos
- **Normalização inteligente:** Remove acentos para melhor matching
- **Atualiza em lotes:** Não sobrecarrega a API Supabase
- **Sem dependências extras:** Usa apenas pacotes já instalados

## 🔧 Troubleshooting

### "ERRO: Configure SUPABASE_USER_ID"
Os scripts já têm seu user_id. Se rodou manualmente, use:
```bash
node populate-therapeutic-class.mjs --user-id=b0c9746c-c4d9-4954-a198-59856009be26
```

### "0 medicamentos encontrados"
Significa que não há medicamentos cadastrados ou sem `active_ingredient`.
**Ação:** Cadastre medicamentos com princípio ativo preenchido.

### "Muitos 'Sem match'"
Significa que seus medicamentos têm princípio ativo que não está na ANVISA.
**Ação:** Use `--verbose` para ver quais, revise manualmente.

## 📚 Documentação Completa

- **Setup detalhado:** `THERAPEUTIC_CLASS_SETUP.md`
- **Guia completo:** `POPULATE_THERAPEUTIC_CLASS.md`

## 🚀 Pronto para Usar

Todos os scripts estão prontos. Comece com:

```bash
./populate-my-medicines.sh --dry-run --verbose
```

---

**Criado:** 2026-03-20
**Versão:** 1.0
**Status:** ✅ Pronto para produção
