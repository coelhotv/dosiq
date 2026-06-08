// apps/web/src/shared/components/ui/DateTimePickerInput.jsx
// Abstração para input datetime-local com conversão ISO

import { parseISO, getNow } from '@utils/dateUtils'

const toLocalISO = (dateStr) => {
  const date = dateStr ? parseISO(dateStr) : getNow()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const mins = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}

export default function DateTimePickerInput({ value, onChange, name, label, required = false }) {
  const displayValue = value ? toLocalISO(value) : ''

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={name}>
          {label}
          {required && <span className="required"> *</span>}
        </label>
      )}
      <input
        type="datetime-local"
        id={name}
        name={name}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  )
}
