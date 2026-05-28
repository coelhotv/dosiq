# Plano de Execução Detalhado — Evolução de Unidades e Dosagens (Dosiq)

Este documento atua como referência estática e guia técnico para agentes de IA e engenheiros sobre as modificações realizadas no Dosiq para sanar a perda de contexto das unidades de dosagem e aprimorar os cálculos de estoque e tratamentos em todo o monorepo (Mobile e Web/PWA).

---

## 🏗️ 1. Camada do Core (`packages/core`)

Centraliza as regras matemáticas de formatação de doses para evitar duplicações de código.

### 📁 `packages/core/src/utils/doseUnit.js`
Implementar e exportar as seguintes funções utilitárias:

```javascript
/**
 * Retorna um hint de equivalência ligando a quantidade física (un.) à carga de dosagem.
 * @example formatActiveIngredientHint(2, 100, 'ui') -> "2 un. = 200 UI"
 * @example formatActiveIngredientHint(30, 500, 'mg') -> "30 un. = 15000 mg"
 */
export function formatActiveIngredientHint(qty, dosagePerPill, unit) {
  if (qty == null || qty === '' || isNaN(Number(String(qty).replace(',', '.'))) || dosagePerPill == null || dosagePerPill <= 0) {
    return ''
  }
  const qtyNum = Number(String(qty).replace(',', '.'))
  const total = qtyNum * dosagePerPill
  const displayQty = String(qtyNum).replace('.', ',')
  const displayTotal = String(total).replace('.', ',')
  const displayUnit = (unit === 'ui' ? 'UI' : unit === 'cp' ? 'cp/cap' : unit) || 'un.'
  
  return `${displayQty} un. = ${displayTotal} ${displayUnit}`
}

/**
 * Retorna a fórmula matemática explicativa para helpers de inputs.
 * @example formatActiveIngredientFormula(1.5, 100, 'ui') -> "1,5 x 100 UI = 150 UI"
 */
export function formatActiveIngredientFormula(qty, dosagePerPill, unit) {
  if (qty == null || qty === '' || isNaN(Number(String(qty).replace(',', '.'))) || dosagePerPill == null || dosagePerPill <= 0) {
    return ''
  }
  const qtyNum = Number(String(qty).replace(',', '.'))
  const total = qtyNum * dosagePerPill
  const displayQty = String(qtyNum).replace('.', ',')
  const displayTotal = String(total).replace('.', ',')
  const displayUnit = (unit === 'ui' ? 'UI' : unit === 'cp' ? 'cp/cap' : unit) || 'un.'
  
  return `${displayQty} x ${dosagePerPill} ${displayUnit} = ${displayTotal} ${displayUnit}`
}
```

### 📁 `packages/core/src/utils/index.js`
* Adicionar os novos exports no bloco de apresentação de dose (Dose unit presentation):
  ```javascript
  export {
    pluralizeDoseUnit,
    formatDoseUnit,
    formatActiveIngredientHint,
    formatActiveIngredientFormula,
  } from './doseUnit.js'
  ```

---

## 📱 2. Aplicativo Móvel Nativo (`apps/mobile`)

### 📁 `apps/mobile/src/features/dose/components/DoseRegisterModal.jsx`
* Importar `formatActiveIngredientFormula` e `DOSAGE_UNIT_LABELS`.
* Mapear o label do input dinamicamente:
  ```javascript
  const displayUnitLabel = 
    protocol.medicine?.dosage_unit === 'cp' ? 'comprimidos' :
    protocol.medicine?.dosage_unit === 'gotas' ? 'gotas' :
    'unidades';
  ```
* Sob o campo `<TextInput>`, renderizar a fórmula em tempo real:
  ```jsx
  {protocol.medicine?.dosage_per_pill && (
    <Text style={styles.formulaHint}>
      ✨ {formatActiveIngredientFormula(quantity || defaultQty, protocol.medicine.dosage_per_pill, protocol.medicine.dosage_unit)}
    </Text>
  )}
  ```

### 📁 `apps/mobile/src/features/dose/components/BulkDoseRegisterModal.jsx`
* Na renderização de cada item do seletor em lote:
  * Substituir o texto estático de dosagem `{dosage_per_intake} cp` por:
    ```javascript
    const activeHint = item.protocol.medicine?.dosage_per_pill
      ? ` (${item.protocol.dosage_per_intake * item.protocol.medicine.dosage_per_pill} ${item.protocol.medicine.dosage_unit === 'ui' ? 'UI' : item.protocol.medicine.dosage_unit || 'mg'})`
      : '';
    const dose = `${item.protocol.dosage_per_intake ?? 1} un.${activeHint}`;
    ```

### 📁 `apps/mobile/src/features/dashboard/components/DoseTimelineCard.jsx`
* Atualizar a descrição textual da dose para incluir a equivalência de princípio ativo:
  ```jsx
  <Text style={[styles.dosage, isMuted && styles.mutedText]}>
    {protocol?.dosage_per_intake || 1} un.
    {medicine?.dosage_per_pill 
      ? ` (${protocol.dosage_per_intake * medicine.dosage_per_pill} ${medicine.dosage_unit === 'ui' ? 'UI' : medicine.dosage_unit || 'mg'})` 
      : ''
    }
  </Text>
  ```

### 📁 `apps/mobile/src/features/treatments/components/ProtocolFormBody.jsx`
* Sob o campo "Dose por tomada" (`dosage_per_intake`), se houver `medicine`, injetar o hint de fórmula matemática:
  ```jsx
  helperText={
    medicine?.dosage_per_pill
      ? `✨ ${formatActiveIngredientFormula(form.values.dosage_per_intake, medicine.dosage_per_pill, medicine.dosage_unit)}`
      : "Quantas unidades do medicamento por tomada (aceita decimais)"
  }
  ```

### 📁 `apps/mobile/src/features/stock/screens/PurchaseFormScreen.jsx`
* Salvar o medicamento carregado no state local `const [medicine, setMedicine] = useState(null)` dentro do `useEffect`.
* No campo de entrada de quantidade física:
  ```jsx
  helperText={
    medicine?.dosage_per_pill
      ? `✨ Equivale a ${formatActiveIngredientHint(form.values.quantity, medicine.dosage_per_pill, medicine.dosage_unit)} no total`
      : undefined
  }
  ```

### 📁 `apps/mobile/src/features/stock/components/StockIndicators.jsx` & `StockDetailScreen.jsx`
* Adicionar `medicine` como prop.
* Injetar o hint de equivalência nos cartões de **Saldo** e **Consumo / dia**:
  ```jsx
  hint={formatActiveIngredientHint(saldo, medicine?.dosage_per_pill, medicine?.dosage_unit)}
  ```

### 📁 `apps/mobile/src/features/stock/components/StockItem.jsx`
* Atualizar o texto de saldo para exibir a dica de princípio ativo:
  ```jsx
  <Text style={styles.quantity}>
    Saldo: <Text style={styles.bold}>{totalQuantity} un. {dosage_per_pill ? `(${totalQuantity * dosage_per_pill} ${dosage_unit === 'ui' ? 'UI' : dosage_unit || 'mg'})` : ''}</Text>
  </Text>
  ```

---

## 💻 3. Versão Web/PWA (`apps/web`)

### 📁 `apps/web/src/features/dashboard/components/SwipeRegisterItem.jsx`
* Mudar a dosagem exibida no card do gesto de deslizar:
  ```jsx
  <span className="swipe-item-card__dosage">
    {dosagePerIntake || 1} un.
    {medicine?.dosage_per_pill && (
      ` (${dosagePerIntake * medicine.dosage_per_pill} ${medicine.dosage_unit === 'ui' ? 'UI' : medicine.dosage_unit || 'mg'})`
    )}
  </span>
  ```

### 📁 `apps/web/src/features/dashboard/components/CronogramaDoseItem.jsx`
* Mudar a exibição de dosagem no item de timeline do PWA:
  ```jsx
  <span className="cronograma-dose-card__intake">
    {dose.dosagePerIntake} un.
    {dose.dosagePerPill && (
      ` (${dose.dosagePerIntake * dose.dosagePerPill} ${dose.dosageUnit === 'ui' ? 'UI' : dose.dosageUnit || 'mg'})`
    )}
  </span>
  ```

### 📁 `apps/web/src/features/dashboard/components/DoseListItem.jsx`
* Substituir a função `getQuantityLabel` para formatar a quantidade e unidade dinamicamente, suportando abreviações corretas:
  ```javascript
  const getQuantityLabel = (quantity, medicine) => {
    if (!medicine) return `${String(quantity).replace('.', ',')} un.`
    const unit = medicine.dosage_unit || 'un.'
    const displayQty = String(quantity).replace('.', ',')
    
    if (unit === 'cp') return `${displayQty} comp.`
    if (unit === 'gotas') return `${displayQty} ${quantity === 1 ? 'gota' : 'gotas'}`
    return `${displayQty} ${unit === 'ui' ? 'UI' : unit}`
  }
  ```

### 📁 `apps/web/src/features/protocols/components/ProtocolForm.jsx` & `ProtocolFormDosesSection.jsx`
* Passar o medicamento selecionado para o Doses Section e adicionar a fórmula dinâmica em tempo real sob o input `dosage_per_intake`:
  ```jsx
  {medicine && medicine.dosage_per_pill && (
    <small className="active-ingredient-formula">
      ✨ {formatActiveIngredientFormula(formData.dosage_per_intake, medicine.dosage_per_pill, medicine.dosage_unit)}
    </small>
  )}
  ```

### 📁 `apps/web/src/features/stock/components/sections/StockFormMedicineDetails.jsx`
* Sob o input de quantidade de estoque comprado, injetar a fórmula de totalização de princípio ativo:
  ```jsx
  {selectedMedicine && selectedMedicine.dosage_per_pill && (
    <small className="active-ingredient-formula">
      ✨ Equivale a {formatActiveIngredientHint(formData.quantity, selectedMedicine.dosage_per_pill, selectedMedicine.dosage_unit)} no total
    </small>
  )}
  ```

### 📁 `apps/web/src/features/stock/components/StockIndicator.jsx` & `StockCard.jsx`
* Passar o `medicine` para o `<StockIndicator />` e exibir o hint de totalização no cabeçalho do indicador de estoque:
  ```jsx
  <span className="stock-quantity">
    {quantity} un.
    {medicine && medicine.dosage_per_pill && (
      <small className="stock-quantity-hint">
        &nbsp;(= {quantity * medicine.dosage_per_pill} {medicine.dosage_unit === 'ui' ? 'UI' : medicine.dosage_unit || 'mg'})
      </small>
    )}
  </span>
  ```

### 📁 `apps/web/src/features/stock/components/redesign/StockCardRedesign.jsx`
* Atualizar a visualização complexa de quantidade para exibir o hint de total de princípio ativo:
  ```jsx
  {isComplex && (
    <p className="stock-card-r__quantity">
      {totalQuantity} un.
      {medicine.dosage_per_pill && (
        <span className="stock-card-r__quantity-hint">
          &nbsp;(= {totalQuantity * medicine.dosage_per_pill} {medicine.dosage_unit === 'ui' ? 'UI' : medicine.dosage_unit || 'mg'})
        </span>
      )}
    </p>
  )}
  ```
