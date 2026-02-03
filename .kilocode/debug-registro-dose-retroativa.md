# Debug: Erro ao Registrar Dose Retroativa

## Data
2026-02-03

## Problema
O usuário reportou erro ao tentar registrar uma dose de um protocolo tomado no passado (esquecido de registrar na hora). Após ajustar a data e hora no seletor de calendário do "registrar nova dose", escolher o protocolo e a quantidade tomada, a aplicação exibia o erro genérico: **"Erro ao registrar dose"**.

## Processo de Diagnóstico

### Passo 1: Análise do Fluxo de Dados
- **Arquivo investigado**: `src/components/log/LogForm.jsx`
- **Fluxo identificado**: 
  1. Usuário seleciona data/hora, protocolo e quantidade
  2. `handleSubmit` prepara os dados
  3. `onSave` é chamado (passado pelo componente pai)
  4. No Dashboard: `handleSaveLog` chama `logService.create()`
  5. `logService.create()` valida com Zod e envia ao Supabase

### Passo 2: Identificação do Erro Real
O código no Dashboard capturava o erro mas mostrava apenas um alert genérico:
```javascript
} catch (err) {
  console.error(err)
  alert('Erro ao registrar dose')
}
```

**Mensagem real do console (fornecida pelo usuário)**:
```json
{
    "code": "PGRST204",
    "details": null,
    "hint": null,
    "message": "Could not find the 'scheduled_time' column of 'medicine_logs' in the schema cache"
}
```

**Segundo erro identificado**:
```
Could not find the 'status' column of 'medicine_logs' in the schema cache
```

### Passo 3: Análise da Causa Raiz
O erro `PGRST204` do PostgREST indica que o código estava tentando inserir campos que **não existem** na tabela do banco de dados.

**Verificação no schema** (`src/schemas/logSchema.js`):
- Campo `scheduled_time`: definido no schema Zod com transform para `null` quando não informado
- Campo `status`: definido com default 'taken'

Quando o Zod validava o objeto, ele incluía esses campos no payload enviado ao Supabase, mas essas colunas não existem na tabela `medicine_logs` em produção.

**Nota importante**: A documentação do banco (`docs/database-schema.md`) mostrava esses campos como existentes, mas o banco de produção está diferente. A documentação foi desatualizada.

## Correção

### Arquivos Modificados
1. `src/schemas/logSchema.js` - Removidos campos `status` e `scheduled_time`
2. `docs/database-schema.md` - Atualizada documentação para refletir o schema real do banco

### Mudança em `src/schemas/logSchema.js`
```diff
- // Status possíveis para um registro de medicação
- const LOG_STATUSES = ['taken', 'skipped', 'late', 'missed']

- status: z
-   .enum(LOG_STATUSES, {
-     errorMap: () => ({ 
-       message: 'Status inválido. Opções: taken (tomado), skipped (pulado), late (atrasado), missed (perdido)' 
-     })
-   })
-   .default('taken'),

- scheduled_time: z
-   .string()
-   .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário agendado deve estar no formato HH:MM')
-   .optional()
-   .nullable()
-   .transform(val => val || null),
```

### Mudança em `docs/database-schema.md`
```diff
  ### `medicine_logs`
  Histórico de doses tomadas.
  - `id` (uuid, PK).
  - `protocol_id` (uuid, FK).
  - `medicine_id` (uuid, FK).
  - `taken_at` (timestamptz): Data e hora real da tomada.
  - `quantity_taken` (numeric).
- - `status` (text): 'taken', 'skipped', 'late', 'missed' (default: 'taken').
- - `scheduled_time` (text): Horário agendado no formato HH:MM.
  - `notes` (text).
```

## Commit
```
commit d24cc4a
fix(schema): remove campos inexistentes do schema de logs

Remove campos 'status' e 'scheduled_time' do logSchema que não existem
na tabela medicine_logs do banco de produção, causando erro PGRST204
ao tentar registrar doses.
```

## Validação
- ✅ Nenhuma referência aos campos removidos em outros arquivos do projeto
- ✅ Os campos eram opcionais e não eram utilizados na interface
- ✅ A remoção não afeta a funcionalidade existente
- ✅ Push para main realizado com sucesso

## Lições Aprendidas
1. **Sincronização Schema/Banco**: Sempre verificar se campos definidos nos schemas existem efetivamente no banco de dados
2. **Mensagens de Erro**: Alert genéricos dificultam o debugging. É importante propagar mensagens de erro detalhadas em ambientes de desenvolvimento
3. **Transformações Zod**: Campos `.transform(val => val || null)` ou `.default()` incluem explicitamente valores no objeto validado, o que pode causar erros se a coluna não existir no banco
4. **Documentação Sincronizada**: Manter a documentação do schema do banco atualizada com a realidade do banco de produção

## Próximos Passos Sugeridos
- [ ] Executar testes automatizados para garantir que a mudança não quebrou funcionalidades existentes
- [ ] Considerar adicionar validação de schema do banco de dados no pipeline de CI/CD
- [ ] Avaliar se os campos removidos (`status`, `scheduled_time`) devem ser adicionados ao banco (feature futura) ou se foram removidos intencionalmente
- [ ] Implementar tratamento de erro mais detalhado no Dashboard para facilitar debugging futuro
