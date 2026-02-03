# Auditoria Completa: Schemas Zod vs Banco de Dados (Supabase)

## Data da Auditoria
2026-02-03

## Schema do Banco Exportado
```sql
-- Estrutura real do banco Supabase (produção)
```

## Análise Detalhada por Tabela

### ✅ medicine_logs - CORRIGIDO
| Campo | No Banco | No Schema Zod | Status |
|-------|----------|---------------|--------|
| id | ✅ | ✅ (fullSchema) | OK |
| protocol_id | ✅ | ✅ | OK |
| medicine_id | ✅ | ✅ | OK |
| taken_at | ✅ | ✅ | OK |
| quantity_taken | ✅ | ✅ | OK |
| notes | ✅ | ✅ | OK |
| user_id | ✅ | ✅ (fullSchema) | OK |
| status | ❌ | ⚠️ REMOVIDO | **CORRIGIDO** |
| scheduled_time | ❌ | ⚠️ REMOVIDO | **CORRIGIDO** |

**Verificação**: ✅ Schema agora está sincronizado com o banco.

---

### ⚠️ medicines - INCONSISTÊNCIAS ENCONTRADAS
| Campo | No Banco | No Schema Zod | Status |
|-------|----------|---------------|--------|
| id | ✅ | ✅ (fullSchema) | OK |
| name | ✅ | ✅ | OK |
| laboratory | ✅ | ✅ | OK |
| active_ingredient | ✅ | ✅ | OK |
| dosage_per_pill | ✅ | ✅ | OK |
| price_paid | ✅ | ❌ **AUSENTE** | ⚠️ INCONSISTÊNCIA |
| type | ✅ | ✅ (default: 'medicine') | OK |
| dosage_unit | ✅ | ✅ (default: 'mg') | OK |
| user_id | ✅ | ✅ (fullSchema) | OK |
| created_at | ✅ | ✅ (fullSchema) | OK |

**Problema**: O campo `price_paid` existe no banco mas não está no schema Zod.

**Impacto**: Se o código tentar inserir/atualizar `price_paid`, pode haver erro.

**Recomendação**: Adicionar `price_paid` ao `medicineSchema` ou remover do banco se não é usado.

---

### ⚠️ protocols - INCONSISTÊNCIAS ENCONTRADAS
| Campo | No Banco | No Schema Zod | Status |
|-------|----------|---------------|--------|
| id | ✅ | ✅ (fullSchema) | OK |
| medicine_id | ✅ | ✅ | OK |
| name | ✅ | ✅ | OK |
| frequency | ✅ | ✅ | OK |
| time_schedule | ✅ | ✅ | OK |
| dosage_per_intake | ✅ | ✅ | OK |
| notes | ✅ | ✅ | OK |
| active | ✅ | ✅ (default: true) | OK |
| created_at | ✅ | ✅ (fullSchema) | OK |
| user_id | ✅ | ✅ (fullSchema) | OK |
| treatment_plan_id | ✅ | ✅ (opcional) | OK |
| target_dosage | ✅ | ❌ **AUSENTE** | ⚠️ INCONSISTÊNCIA |
| titration_status | ✅ | ✅ (default: 'estável') | OK |
| titration_schedule | ✅ | ✅ (default: []) | OK |
| current_stage_index | ✅ | ✅ (default: 0) | OK |
| stage_started_at | ✅ | ✅ (opcional) | OK |
| last_notified_at | ✅ | ❌ **AUSENTE** | ⚠️ INCONSISTÊNCIA |
| last_soft_reminder_at | ✅ | ❌ **AUSENTE** | ⚠️ INCONSISTÊNCIA |

**Problemas**: 
1. `target_dosage` existe no banco mas não no schema
2. `last_notified_at` existe no banco mas não no schema
3. `last_soft_reminder_at` existe no banco mas não no schema

**Impacto**: Esses campos podem ser usados pelo sistema de notificações. Se não estiverem no schema, validações podem falhar.

---

### ⚠️ stock - INCONSISTÊNCIAS ENCONTRADAS
| Campo | No Banco | No Schema Zod | Status |
|-------|----------|---------------|--------|
| id | ✅ | ✅ (fullSchema) | OK |
| medicine_id | ✅ | ✅ | OK |
| quantity | ✅ | ✅ | OK |
| purchase_date | ✅ | ✅ | OK |
| expiration_date | ✅ | ✅ (opcional) | OK |
| created_at | ✅ | ✅ (fullSchema) | OK |
| user_id | ✅ | ✅ (fullSchema) | OK |
| unit_price | ✅ | ✅ (default: 0) | OK |
| notes | ✅ | ✅ (opcional) | OK |

**Verificação**: ✅ Schema sincronizado com o banco.

---

### ⚠️ treatment_plans - INCONSISTÊNCIA ENCONTRADA
| Campo | No Banco | No Schema Zod | Status |
|-------|----------|---------------|--------|
| id | ✅ | ✅ (fullSchema) | OK |
| name | ✅ | ✅ | OK |
| description | ✅ | ✅ | OK |
| objective | ✅ | ❌ **AUSENTE** | ⚠️ INCONSISTÊNCIA |
| created_at | ✅ | ✅ (fullSchema) | OK |
| user_id | ✅ | ✅ (fullSchema) | OK |

**Problema**: O campo `objective` existe no banco mas não está no schema Zod.

---

### ✅ user_settings - NÃO POSSUI SCHEMA ZOD
| Campo | No Banco | No Schema Zod | Status |
|-------|----------|---------------|--------|
| id | ✅ | ❌ N/A | - |
| user_id | ✅ | ❌ N/A | - |
| telegram_chat_id | ✅ | ❌ N/A | - |
| timezone | ✅ | ❌ N/A | - |
| verification_token | ✅ | ❌ N/A | - |
| onboarding_completed | ✅ | ❌ N/A | - |
| created_at | ✅ | ❌ N/A | - |
| updated_at | ✅ | ❌ N/A | - |

**Observação**: Não há schema Zod definido para `user_settings`. Se houver formulários que manipulem esses dados, é recomendável criar um schema.

---

### ✅ bot_sessions - NÃO POSSUI SCHEMA ZOD
Tabela usada internamente pelo bot do Telegram. Não há necessidade de schema Zod se não há formulários de usuário que a manipulem.

---

### ✅ notification_log - NÃO POSSUI SCHEMA ZOD
Tabela de logs de notificações. Provavelmente é preenchida automaticamente pelo sistema, não necessitando de schema Zod para validação de formulários.

---

## Resumo de Inconsistências

| Tabela | Inconsistências | Severidade |
|--------|-----------------|------------|
| medicine_logs | ✅ Resolvido | - |
| medicines | `price_paid` ausente no schema | 🟡 Média |
| protocols | `target_dosage`, `last_notified_at`, `last_soft_reminder_at` ausentes | 🟡 Média |
| stock | ✅ OK | - |
| treatment_plans | `objective` ausente no schema | 🟢 Baixa |
| user_settings | Sem schema definido | 🟢 Baixa |

## Recomendações de Prioridade

### 🔴 Alta Prioridade (Imediata)
1. **Verificar uso de `price_paid`**: Se o campo é usado em formulários, adicionar ao schema imediatamente.

### 🟡 Média Prioridade (Próxima Sprint)
1. Adicionar campos faltantes ao `protocolSchema`:
   - `target_dosage` (number, opcional)
   - `last_notified_at` (datetime, opcional)
   - `last_soft_reminder_at` (datetime, opcional)
2. Adicionar `objective` ao schema de treatment_plans

### 🟢 Baixa Prioridade (Backlog)
1. Criar schema Zod para `user_settings` se necessário
2. Documentar quais campos são gerenciados automaticamente pelo sistema vs. formulários

## Próximos Passos Imediatos
- [ ] Decidir se `price_paid` deve ser adicionado ao schema ou removido do banco
- [ ] Testar operações de INSERT/UPDATE em todas as tabelas para validar consistência
- [ ] Implementar testes de integração que detectem discrepâncias schema/banco
