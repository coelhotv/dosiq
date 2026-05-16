# Form Kit — Reference

> **Status**: Estável (Fase 0 — Pré-Requisitos completa)
> **Plataforma**: Mobile (`apps/mobile`)
> **Última atualização**: Sprint P.3 (fechamento Fase 0 CRUD Native)

Conjunto de hooks e componentes reutilizáveis para construção de formulários nativos. Pensado para os fluxos de CRUD da app (Medicamentos, Protocolos, Estoque) mas serve para qualquer formulário do produto.

---

## Visão geral

| Tipo | Item | Sprint |
|------|------|--------|
| Hook | [`useFormState`](#useformstate) | P.1 |
| Hook | [`useMutation`](#usemutation) | P.2 |
| Hook | [`useMedicineDatabase`](#usemedicinedatabase) | P.2 |
| Componente | [`FormInput`](#forminput) | P.1 |
| Componente | [`FormSelect`](#formselect) | P.1 |
| Componente | [`FormDatePicker` / `FormTimePicker`](#formdatepicker--formtimepicker) | P.1 |
| Componente | [`FormSection`](#formsection) | P.1 |
| Componente | [`FormActions`](#formactions) | P.1 |
| Componente | [`FormAutocomplete`](#formautocomplete) | P.2 |
| Componente | [`DeleteConfirmation`](#deleteconfirmation) | P.3 |
| Componente | [`ToastProvider` + `useToast`](#toast) | P.3 |
| Utils | [`haptics`](#haptics) | P.3 |
| Tela | [`AnvisaSearchScreen`](#anvisasearchscreen) | P.2 |

---

## Hooks

### `useFormState`

`apps/mobile/src/shared/hooks/useFormState.js`

Hook genérico Zod-aware para gerenciar estado de formulário.

```js
import { useFormState } from '@shared/hooks/useFormState'

const form = useFormState(schema, { initialValues })

// API:
form.values        // { name, dosage, ... }
form.errors        // { name: 'Nome muito curto' }
form.touched       // { name: true }
form.isDirty       // boolean
form.isValid       // boolean
form.handleChange(field, value)
form.handleBlur(field)
form.validate()    // → boolean (também seta errors + touched)
form.reset(nextInitial?)
form.setValues(partial)  // merge — útil para auto-fill
```

- Validação **on-blur** por campo via `schema.pick({[field]:true}).safeParse()` com fallback Hermes-safe.
- `setValues()` faz merge parcial e limpa erros dos campos sobrescritos (suporta auto-fill ANVISA via callback `onSelect` do `FormAutocomplete`).

### `useMutation`

`apps/mobile/src/shared/hooks/useMutation.js`

Hook para mutations C/U/D com guards e feedback.

```js
const { mutate, isLoading, error, reset } = useMutation({
  onSuccess: (data) => { /* … */ },
  onError: (err) => { /* … */ },
  invalidateKeys: ['@dosiq/treatments-snapshot'],
  timeoutMs: 15_000,
})

await mutate(() => medicineService.create(form.values))
```

- Guard double-submit via ref síncrono (antes do re-render).
- `Promise.race` com timeout (R-168, Hermes-safe; não exige cooperação do `fn` arbitrário).
- `AsyncStorage.multiRemove(invalidateKeys)` best-effort — falha em cache não derruba sucesso.
- Haptic Success/Error fire-and-forget via [`haptics`](#haptics).
- Pattern de erro: `throw raw` (component decide como exibir — sem central parser).

### `useMedicineDatabase`

`apps/mobile/src/shared/hooks/useMedicineDatabase.js`

Cache local + busca na base ANVISA (~6800 medicamentos) com sync background.

```js
const { search, getByName, isReady, isLoading, lastUpdated, error } = useMedicineDatabase()

const sugestoes = search('paracetamol', 10)  // até 10 resultados
const med = getByName('Aspirina')             // match exato preferido
```

- Cache instantâneo (`AsyncStorage`) no warm start.
- Background sync: re-download quando versão remota muda OU TTL 7d expira.
- Degradação graciosa: rede falha + cache existe → `error=null`, busca continua.
- Base **pré-normalizada via `useMemo`** uma única vez (evita `normalize('NFD') + regex` em milhares de registros por keystroke).
- `search()` usa **word-boundary prefix**:
  - "trime" casa `Maleato de Trimebutina` (após espaço) ✅
  - "trime" casa `Trimebutina` (início) ✅
  - "trip" NÃO casa `Sumatriptana` (mid-word) ❌
- Ranking: matches por `name` vêm antes de só-`activeIngredient`.

---

## Componentes — Form

Todos seguem o contrato base:

```js
{
  name,           // chave do campo (passada em onChange/onBlur)
  label,          // string visível
  value,          // controlled
  error,          // string | undefined
  onChange,       // (name, value) => void
  onBlur,         // (name) => void
  disabled, placeholder, helperText, required,
}
```

Todos usam `tokens` (sem cores literais) e `StyleSheet.create()`.

### `FormInput`

`@shared/components/form/FormInput.jsx`

`TextInput` controlled com:
- Animação spring na borda quando entra em estado de erro.
- Suporte `multiline` (expande verticalmente, `textAlignVertical='top'` no Android).
- A11y: `accessibilityLabel`, `accessibilityHint`, `accessibilityState`.
- Pass-through: `keyboardType`, `autoCapitalize`, `autoComplete`, `secureTextEntry`, `multiline`, `numberOfLines`, `maxLength`, `returnKeyType`, `onSubmitEditing`.

### `FormSelect`

`@shared/components/form/FormSelect.jsx`

Trigger igual `FormInput` + modal sheet com `FlatList` de opções. Opções `{ label, value }[]`. Estado selecionado destacado. Tap fora ou X fecha.

### `FormDatePicker` / `FormTimePicker`

`@shared/components/form/FormDatePicker.jsx` · `FormTimePicker.jsx`

- iOS: modal slide-from-bottom com `DateTimePicker` spinner (`textColor` + `themeVariant="light"` explícitos — previne texto invisível em devices com dark mode forçado).
- Android: `DateTimePickerAndroid.open` imperativo (dialog nativo).
- `getNow()` de `@dosiq/core` no initial value (R-020 timezone safety).
- Pass-through: `minimumDate`, `maximumDate`, `format` (custom formatter).

### `FormSection`

`@shared/components/form/FormSection.jsx`

Wrapper visual: title (uppercase eyebrow) + description + `gap` entre filhos.

### `FormActions`

`@shared/components/form/FormActions.jsx`

Row primary + secondary. `primaryLoading` mostra `ActivityIndicator`. `destructive=true` deixa o primary vermelho.

### `FormAutocomplete`

`@shared/components/form/FormAutocomplete.jsx`

Input com overlay de sugestões — para uso **inline em forms** onde overlay basta. Para tela dedicada de browse, ver `AnvisaSearchScreen`.

- Debounce 200ms via `useEffect`.
- Overlay `position: absolute; top: '100%'` do `inputBlock` (relativo) — sem magic number, robusto a mudanças de label.
- Estados: vazio (sem busca), buscando, sem resultados, com sugestões.
- Auto-fill via `onSelect(item)` callback — consumidor decide se chama `setValues` do `useFormState`.

```jsx
<FormAutocomplete
  name="anvisa"
  label="Medicamento"
  value={form.values.name}
  onChange={form.handleChange}
  search={useMedicineDatabase().search}
  getItemLabel={(m) => m.name}
  getItemSubtitle={(m) => m.activeIngredient}
  onSelect={(med) => form.setValues({ name: med.name, activeIngredient: med.activeIngredient })}
/>
```

---

## Componentes — Feedback

### `DeleteConfirmation`

`@shared/components/feedback/DeleteConfirmation.jsx`

Bottom sheet modal de confirmação destrutiva. Dispara `warningHaptic` ao abrir.

```jsx
<DeleteConfirmation
  visible={open}
  title="Excluir medicamento"
  description="Esta ação não pode ser desfeita."
  itemName="Paracetamol 500mg"
  confirmLabel="Excluir"  // default
  cancelLabel="Cancelar"  // default
  isLoading={mutation.isLoading}
  onCancel={() => setOpen(false)}
  onConfirm={() => mutation.mutate(() => service.delete(id))}
/>
```

Reusa `FormActions` com `destructive=true`.

### Toast

`@shared/components/feedback/Toast.jsx`

Provider montado em `AppRoot` (root). Hook `useToast()` retorna `{ show }`.

```jsx
// AppRoot.jsx (uma vez):
<SafeAreaProvider>
  <ToastProvider>
    <Navigation />
  </ToastProvider>
</SafeAreaProvider>

// Em qualquer tela:
const { show } = useToast()
show('Medicamento salvo')                          // info, 3s default
show('Erro ao salvar', { variant: 'error' })
show('Estoque atualizado', { variant: 'success', duration: 5000 })
```

- Variantes: `success` (verde) / `error` (vermelho) / `info` (escuro). Cada uma com ícone próprio (`CheckCircle`/`AlertCircle`/`Info`).
- Stack máx 3 simultâneos, FIFO.
- Animação slide-from-top via `Animated.Value`.
- Auto-dismiss `duration` default 3000ms. Tap para dispensar antes.
- Haptic automático: `success` → `successHaptic()`, `error` → `errorHaptic()`, `info` → nenhum.

---

## Utilitários

### Haptics

`@shared/utils/haptics`

Wrapper fire-and-forget sobre `expo-haptics`. Centraliza tipos usados e silencia erros (haptic é UX-only — falha não pode quebrar fluxo).

```js
import {
  successHaptic, errorHaptic, warningHaptic,
  lightTap, mediumTap, heavyTap, selectionTap,
} from '@shared/utils/haptics'
```

Todas são funções sem args, fire-and-forget. Não precisa `await` nem `try/catch`.

---

## Telas e patterns de seleção

### `MedicineAnvisaSheet` (Fase 1 — pattern canônico)

`apps/mobile/src/features/medications/components/MedicineAnvisaSheet.jsx`

Bottom sheet 85% altura sobreposto ao form de medicamento. Substitui a versão fullscreen anterior (`AnvisaSearchScreen` — **REMOVIDO** na Sprint M1.2).

**Razão da escolha bottom sheet**: preserva contexto do form aberto; após selecionar, o sheet fecha e o form recebe os campos preenchidos via `setValues`. Evita o anti-pattern "callback em route.params" (AP-158) e o dead-end UX quando usuário tap no resultado da busca standalone.

**Pattern de seleção via setValues**:
```js
const handleAnvisaSelect = useCallback((item) => {
  form.setValues({
    name: item.name ?? form.values.name,
    active_ingredient: item.activeIngredient ?? form.values.active_ingredient,
    therapeutic_class: item.therapeuticClass ?? form.values.therapeutic_class,
    regulatory_category: item.regulatoryCategory ?? form.values.regulatory_category,
    laboratory: isGeneric ? '' : (item.laboratory ?? form.values.laboratory ?? ''),
  })
  setSheetOpen(false)
}, [form])
```

### `MedicineSelectorSheet` (Fase 2 — pattern análogo)

`apps/mobile/src/features/treatments/components/MedicineSelectorSheet.jsx` (a criar em T2.4)

Mesmo pattern bottom sheet, mas dados vêm de `useMedicines()` (biblioteca do user, não ANVISA). Selecionar atualiza `medicine_id` no form de tratamento + autocompleta nome sugerido.

### `MedicineDeleteBlockedSheet` (Fase 1) vs `ProtocolDeleteSheet` (Fase 2)

Dois patterns distintos de delete UX, conforme natureza da entidade:

| Entidade | Pattern | Onde |
|----------|---------|------|
| Medicamento | **Hard block** se há tratamentos OU estoque > 0 (`AP-159`) | `MedicineDeleteBlockedSheet.jsx` |
| Tratamento | **Warning soft** com histórico de doses (não bloqueia) | `ProtocolDeleteSheet.jsx` (a criar em T2.11) |

Razão: medicamento órfão = inconsistência crítica de dados de saúde; tratamento delete não afeta doses já registradas no histórico.

---

## Padrões e regras

### Ordem dos hooks (R-010)
States → Memos → Effects → Handlers. Previne TDZ. Aplicado em todos os hooks/screens do Form Kit.

### Timezone (R-020)
Zero `new Date()` direto. Usa `getNow()` / `parseISO` de `@dosiq/core`.

### Cores literais
Nenhuma string literal de cor em `StyleSheet`. Tudo via `colors.*` de `@shared/styles/tokens`.

### Idiomas
Comentários em PT. Identifiers em EN. Strings de UI em PT.

### Testes
- Hooks: cobertura unitária no diretório `__tests__/` adjacente.
- Form Kit integrado: `apps/mobile/src/shared/components/form/__tests__/FormKit.integration.test.jsx` (Sprint P.3).

### Acessibilidade
Todos os inputs/buttons usam `accessibilityLabel`, `accessibilityHint`, `accessibilityRole` apropriados.

---

## Exemplos completos

### CRUD básico — cadastro de medicamento

```jsx
import { useFormState } from '@shared/hooks/useFormState'
import { useMutation } from '@shared/hooks/useMutation'
import {
  FormSection, FormInput, FormSelect, FormDatePicker, FormActions,
} from '@shared/components/form'
import { useToast } from '@shared/components/feedback/Toast'
import { medicineCreateSchema } from '@dosiq/core/schemas'

export default function MedicineCreateScreen({ navigation }) {
  const form = useFormState(medicineCreateSchema, {
    initialValues: { name: '', dosage_per_pill: 0, frequency: 'diario' },
  })
  const { show } = useToast()
  const mutation = useMutation({
    onSuccess: () => {
      show('Medicamento cadastrado', { variant: 'success' })
      navigation.goBack()
    },
    onError: (err) => show(err.message, { variant: 'error' }),
    invalidateKeys: ['@dosiq/medicines-snapshot'],
  })

  function handleSubmit() {
    if (!form.validate()) return
    mutation.mutate(() => medicineService.create(form.values))
  }

  return (
    <FormSection title="Medicamento" description="Dados básicos">
      <FormInput name="name" label="Nome" required {...formProps(form, 'name')} />
      <FormInput
        name="dosage_per_pill" label="mg/comprimido" keyboardType="numeric"
        {...formProps(form, 'dosage_per_pill')}
      />
      <FormSelect
        name="frequency" label="Frequência" options={FREQUENCIES}
        {...formProps(form, 'frequency')}
      />
      <FormActions
        primaryLabel="Salvar"
        onPrimary={handleSubmit}
        primaryLoading={mutation.isLoading}
        secondaryLabel="Cancelar"
        onSecondary={() => navigation.goBack()}
      />
    </FormSection>
  )
}

function formProps(form, name) {
  return {
    value: form.values[name],
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}
```

---

## Histórico de mudanças

### 2026-05-16 — Atualização pós-Fase 1 + Pré-Fase-2

- `AnvisaSearchScreen` REMOVIDA (M1.2): substituída pelo bottom sheet `MedicineAnvisaSheet`. Razão: contexto preservado + evita dead-end UX + remove anti-pattern AP-158 (callbacks em route.params).
- Adicionado pattern `MedicineDeleteBlockedSheet` (AP-159 hard block para medicamento) — protege dados de saúde de ficarem órfãos.
- Adicionado `Toast`/`useToast` para feedback transitório (já documentado em §Componentes — Feedback).
- Padrão **wrappers de mutation** estabelecido: `useMedicineMutation` (Fase 1) → `useProtocolMutation` (Fase 2): hooks que envolvem `useMutation` + Toast + cache invalidation centralizado.
- Padrão **Zod 4 locale global** via `@dosiq/core/zodSetup.js` (R-232): elimina necessidade de `errorMap` por schema. Mensagens "Dona Maria friendly" por código (`invalid_type`, `too_small`, `too_big`).
- Padrão **decimal vírgula → ponto** em tempo real para campos numéricos PT-BR (`replace(',', '.')` + filter chars + colapsa pontos).
- Helpers a criar em Fase 2 (`@dosiq/core/utils/`):
  - `formatDoseUnit(qty, dosage_unit)` / `pluralizeDoseUnit` — render correto de unidades
  - `formatDatePtBR(isoDate)` — "12 mar 2026"
  - `formatEndDate(isoDate)` — null → "Uso contínuo"
- Glossário canônico criado em `docs/reference/GLOSSARY.md` (convenções de string + termos UI↔código).



| Sprint | Mudanças |
|--------|----------|
| P.1 | Form Kit Core: `useFormState`, `FormInput/Select/DatePicker/TimePicker/Section/Actions` |
| P.2 | `useMutation`, `useMedicineDatabase`, `FormAutocomplete`, `AnvisaSearchScreen` |
| P.3 | `DeleteConfirmation`, `Toast`+`useToast`, `haptics` wrapper, integration test, perf refinements em `useMedicineDatabase`, padrão serializável de retorno entre telas |
