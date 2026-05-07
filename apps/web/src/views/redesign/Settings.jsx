import { useState } from 'react'
import { supabase } from '@shared/utils/supabase'
import SettingsHeader from '@settings/sections/SettingsHeader'
import NotificationSection from '@settings/sections/NotificationSection'
import IntegrationSection from '@settings/sections/IntegrationSection'
import PreferenceSection from '@settings/sections/PreferenceSection'
import AccountSection from '@settings/sections/AccountSection'
import AdminSection from '@settings/sections/AdminSection'
import { useSettingsState } from '@features/settings/hooks/useSettingsState'
import './settings/SettingsRedesign.css'

export default function SettingsRedesign({ onNavigate }) {
  const { loading, isAdmin, dlqCount, message, notification, integration, preference } = useSettingsState()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMsg({ type: 'success', text: 'Senha atualizada com sucesso!' })
      setShowPasswordForm(false); setNewPassword('')
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  const handleLogout = async () => {
    if (window.confirm('Deseja realmente sair?')) {
      await supabase.auth.signOut()
      onNavigate('login')
    }
  }

  const currentMessage = message.text ? message : msg

  return (
    <main className="sr-view">
      <SettingsHeader 
        onNavigate={onNavigate} 
        message={currentMessage.type === 'success' ? currentMessage.text : null} 
        error={currentMessage.type === 'error' ? currentMessage.text : null} 
      />
      {loading ? (
        <div className="sr-loading">Carregando configurações...</div>
      ) : (
        <>
          <NotificationSection {...notification} />
          <IntegrationSection {...integration} />
          <PreferenceSection {...preference} />
          <AccountSection
            showPasswordForm={showPasswordForm} setShowPasswordForm={setShowPasswordForm}
            handleUpdatePassword={handleUpdatePassword} newPassword={newPassword}
            setNewPassword={setNewPassword} handleLogout={handleLogout}
          />
          <AdminSection isAdmin={isAdmin} dlqCount={dlqCount} onNavigate={onNavigate} />
          <footer className="sr-footer">Dosiq v{import.meta.env.VITE_APP_VERSION ?? '3.3.0'} • Design Santuário</footer>
        </>
      )}
    </main>
  )
}
