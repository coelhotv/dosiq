export default function LogFormTimeSection({ formData, handleChange }) {
  return (
    <div className="form-group">
      <label htmlFor="taken_at">
        Data e Hora do Registro <span className="required">*</span>
      </label>
      <input
        type="datetime-local"
        id="taken_at"
        name="taken_at"
        value={formData.taken_at}
        onChange={handleChange}
        required
      />
    </div>
  )
}
