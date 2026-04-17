# Addendum: Input Validation em Serviços Mobile (H6+)

> **Status:** Active | **Data:** 2026-04-17 | **Aplicável:** H6 em diante
> **Baseado em:** Feedback Gemini Code Assist PR #477 (Sprint H6.3)

---

## 1. Contexto

Durante H6.3 (Integração de Push Notifications), o revisor de código sugeriu evolução na estratégia de validação de parâmetros em serviços mobile. Este addendum documenta a decisão.

---

## 2. Status Atual (H6)

**Padrão implementado em `apps/mobile/src/features/*/services/`:**

```javascript
// ✅ Validação manual — segura para MVP
export async function getUserSettings() {
  try {
    const { data: user, error: userError } = await getCurrentUser()
    
    // Guards descritivos (linhas 9-17)
    if (userError || !user) throw new Error(userError || 'User not found')
    
    // Validação Zod pontual quando disponível na workspace
    z.string().uuid().parse(user.id)

    const { data, error } = await supabase
      .from('user_settings')
      .select(...)
      
    return { data, error: null }
  } catch (err) {
    return { data: null, error: mapErrorToMessage(err) }
  }
}
```

**Benefícios:**
- ✅ Não adiciona dependências novas a `apps/mobile/package.json`
- ✅ Previne queries ao banco com dados inválidos
- ✅ Mensagens de erro descritivas em português
- ✅ Funciona para MVP

---

## 3. Próxima Evolução (H7+)

**Quando adicionar Zod a `apps/mobile`:**

Introduzir schema validation declarativa para:
- Tipos complexos (não apenas UUID)
- Ranges e formats (emails, datas, ranges numéricos)
- Validação de arrays e objetos aninhados
- Reutilização de schemas entre múltiplos serviços

**Exemplo futuro:**
```javascript
// H7+ — quando Zod viável em apps/mobile
const getUserSettingsParamsSchema = z.object({
  userId: z.string().uuid().describe('User ID from auth'),
  includeNotifications: z.boolean().optional()
})

export async function getUserSettings(params) {
  const { userId, includeNotifications } = getUserSettingsParamsSchema.parse(params)
  // ... resto da função
}
```

---

## 4. Princípios de Validação em Serviços

| Camada | Regra | Exemplo |
|--------|-------|---------|
| **Entrada** | Sempre validar parâmetros antes de lógica | `if (!userId) throw new Error(...)` |
| **Queries** | Validar IDs antes de queries ao banco | `z.string().uuid().parse(userId)` |
| **Response** | Validar dados retornados do banco (R-125) | `settingsSchema.parse(data)` |
| **Errors** | Mapear erros técnicos para mensagens amigáveis (R-170) | `mapErrorToMessage(err)` |

---

## 5. Timing de Implementação

- **H6 ✅ (atual):** Validação manual + guards descritivos
- **H7 (proposto):** Considerar adição de Zod se scope permitir nova dependência
- **H8+:** Refactoring de todos serviços mobile para schemas Zod

---

## 6. Referências

- **Feedback origin:** Gemini Code Assist, PR #477 (Sprint H6.3)
- **Motivação:** Integridade de dados, prevenção de bugs sutis, alinhamento com padrões web
- **User memory:** `.claude/projects/.../memory/feedback_mobile_service_validation.md`

---

**Próximo passo:** Registrar no backlog como tarefa H7 (baixa prioridade, viável) se workspace budget permitir.
