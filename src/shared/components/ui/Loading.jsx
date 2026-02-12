import './Loading.css'

export default function Loading({ size = 'md', text = 'Carregando...' }) {
  return (
    <div className="loading-container">
      <div className={`loading-spinner loading-${size}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  )
}
