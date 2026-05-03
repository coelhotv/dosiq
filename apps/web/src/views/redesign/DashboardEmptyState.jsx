export default function DashboardEmptyState({ onNavigate }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 1rem',
        color: 'var(--color-outline)',
      }}
      role="status"
    >
      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</p>
      <p
        style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-body-lg, 1rem)',
        }}
      >
        Nenhuma dose agendada para hoje.
      </p>
      <button
        onClick={() => onNavigate?.('medicines')}
        style={{
          marginTop: '1rem',
          padding: '0.625rem 1.125rem',
          minHeight: '3.5rem',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-button, 1.25rem)',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Adicionar Medicamento
      </button>
    </div>
  )
}
