import { CheckCircle2, AlertCircle } from 'lucide-react'

export default function MedicineFeedbackBanners({ successMessage, error }) {
  return (
    <>
      {successMessage && (
        <div className="sr-medicines__success">
          <CheckCircle2 size={18} /> {successMessage}
        </div>
      )}
      {error && (
        <div className="sr-medicines__error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
    </>
  )
}
