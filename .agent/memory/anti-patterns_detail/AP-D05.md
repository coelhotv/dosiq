# AP-D05 — Slice no prop de doses do PriorityDoseCard

**Category:** Design
**Status:** active
**Related Rule:** None
**Applies To:** all

## Problem



## Prevention




**O que é:** Passar `doses={urgentDoses.slice(0, 3)}` para `PriorityDoseCard`.

**Consequência:** O CTA "Confirmar Agora" registra apenas 3 doses — as demais da faixa horária ficam sem registro, mesmo que o usuário pense que confirmou tudo.

**Prevenção:**
```jsx
// ❌ ERRADO — slice no prop
<PriorityDoseCard doses={urgentDoses.slice(0, 3)} />

// ✅ CORRETO — passa todos; componente faz slice interno só para display
<PriorityDoseCard doses={urgentDoses} onRegisterAll={handleRegisterDosesAll} />
```

**Relacionado:** R-155

---
