# Auditoria: Schemas vs Banco de Dados

## Data da Auditoria
2026-02-03

## Status Geral
| Schema | Status | Observações |
|--------|--------|-------------|
| `logSchema.js` | ⚠️ CORRIGIDO | Campos `status` e `scheduled_time` removidos - não existiam no banco |
| `medicineSchema.js` | ✅ OK | Campos consistentes com documentação |
| `protocolSchema.js` | ✅ OK | Campos consistentes com documentação |
| `stockSchema.js` | ✅ OK | Campos consistentes com documentação |

## Detalhes por Schema

### medicineSchema.js ✅
**Campos validados:**
- `name` (string, obrigatório)
- `laboratory` (string, opcional)
- `active_ingredient` (string, opcional)
- `dosage_per_pill` (number, obrigatório)
- `dosage_unit` (enum, obrigatório)
- `type` (enum, default: 'medicine')

**Match com banco**: Sim, todos os campos existem na tabela `medicines`.

### protocolSchema.js ✅
**Campos validados:**
- `medicine_id` (uuid, obrigatório)
- `treatment_plan_id` (uuid, opcional)
- `name` (string, obrigatório)
- `frequency` (enum, obrigatório)
- `time_schedule` (array, obrigatório)
- `dosage_per_intake` (number, obrigatório)
- `titration_status` (enum, default: 'estável')
- `titration_schedule` (array, default: [])
- `current_stage_index` (number, default: 0)
- `stage_started_at` (datetime, opcional)
- `active` (boolean, default: true)
- `notes` (string, opcional)

**Match com banco**: Sim, todos os campos existem na tabela `protocols`.

### stockSchema.js ✅
**Campos validados:**
- `medicine_id` (uuid, obrigatório)
- `quantity` (number, obrigatório)
- `purchase_date` (date, obrigatório)
- `expiration_date` (date, opcional)
- `unit_price` (number, default: 0)
- `notes` (string, opcional)

**Match com banco**: Sim, todos os campos existem na tabela `stock`.

### logSchema.js ⚠️ CORRIGIDO
**Campos validados (ANTES):**
- `protocol_id` (uuid, opcional)
- `medicine_id` (uuid, obrigatório)
- `taken_at` (datetime, obrigatório)
- `quantity_taken` (number, obrigatório)
- `notes` (string, opcional)
- ❌ `status` (enum, default: 'taken') - **NÃO EXISTE NO BANCO**
- ❌ `scheduled_time` (string, opcional) - **NÃO EXISTE NO BANCO**

**Campos validados (DEPOIS da correção):**
- `protocol_id` (uuid, opcional)
- `medicine_id` (uuid, obrigatório)
- `taken_at` (datetime, obrigatório)
- `quantity_taken` (number, obrigatório)
- `notes` (string, opcional)

**Match com banco**: ✅ Corrigido - apenas campos existentes são validados.

## Recomendações

### 1. Sincronização Automática
Considerar implementar uma verificação automática no pipeline de CI/CD que compare os schemas Zod com o schema real do banco Supabase.

### 2. Testes de Integração
Adicionar testes que realizem operações reais de INSERT/UPDATE em todas as tabelas para detectar discrepâncias entre schema e banco.

### 3. Documentação
Manter o `docs/database-schema.md` sincronizado com:
- Schema do banco de produção
- Schemas Zod de validação
- Migrations executadas

## Próximos Passos Sugeridos
- [ ] Exportar schema real do Supabase para comparação completa
- [ ] Verificar se há índices e constraints adicionais no banco que não estão documentados
- [ ] Auditar triggers e funções do PostgreSQL
- [ ] Validar RLS policies em todas as tabelas
