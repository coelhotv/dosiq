import { useState } from 'react'
import { supabase } from '@shared/utils/supabase'
import Button from './ui/Button'
import Card from './ui/Card'

export default function TestConnection() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const testConnection = async () => {
    setStatus('loading')
    setMessage('Testando conexão...')
    
    try {
      // Tenta buscar medicamentos (deve retornar array vazio se não houver dados)
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .limit(1)
      
      if (error) throw error
      
      setStatus('success')
      setMessage(`✅ Conexão OK! ${data.length === 0 ? 'Banco vazio (normal)' : `${data.length} medicamento(s) encontrado(s)`}`)
    } catch (error) {
      setStatus('error')
      setMessage(`❌ Erro: ${error.message}`)
      console.error('Erro de conexão:', error)
    }
  }

  return (
    <Card>
      <h3>🔌 Teste de Conexão Supabase</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
        Clique para verificar se o banco de dados está conectado
      </p>
      
      <Button 
        variant="primary" 
        onClick={testConnection}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Testando...' : 'Testar Conexão'}
      </Button>
      
      {message && (
        <div style={{ 
          marginTop: 'var(--space-4)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: status === 'error' ? 'rgba(255, 0, 110, 0.1)' : 'rgba(0, 255, 136, 0.1)',
          border: `1px solid ${status === 'error' ? 'var(--accent-error)' : 'var(--accent-success)'}`,
          color: status === 'error' ? 'var(--accent-error)' : 'var(--accent-success)'
        }}>
          {message}
        </div>
      )}
    </Card>
  )
}
