// ProfileScreen.jsx — tela "Perfil" do MVP mobile
// Inclui: email do utilizador, logout, estado Telegram
// Sprint H5.6 irá completar com todos os detalhes

import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getCurrentUser, logoutUser } from '../services/profileService'

export default function ProfileScreen() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    getCurrentUser().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar perfil:', error)
      }
      setUser(data)
      setLoading(false)
    })
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    const { success, error } = await logoutUser()
    // Com renderização condicional em Navigation.jsx, onAuthStateChange
    // vai disparar e session vai passar a null, React Navigation renderiza LOGIN
    if (!success) {
      console.error('Erro ao fazer logout:', error)
      setLoggingOut(false) // restabelecer botão se falhar
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Perfil</Text>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Conta</Text>
          <Text style={styles.email}>{user?.email ?? '—'}</Text>
        </View>

        <Pressable style={[styles.logoutButton, loggingOut && styles.logoutDisabled]} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut
            ? <ActivityIndicator size="small" color="#ef4444" />
            : <Text style={styles.logoutText}>Sair da conta</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  logoutDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
})
