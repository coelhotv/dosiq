// HomeScreen.jsx — tela inicial pós-login
// Exibe email do usuário autenticado (prova que sessão persiste)
// Telas completas do produto entram na Fase 5

import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../platform/supabase/nativeSupabaseClient'
import { signOut } from '../platform/auth/authService'
import { ROUTES } from '../app/routes'

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  async function handleLogout() {
    const { success } = await signOut()
    if (success) {
      navigation.replace(ROUTES.LOGIN)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Olá 👋</Text>
      <Text style={styles.email}>{user?.email ?? 'Usuário desconhecido'}</Text>
      <Text style={styles.hint}>Sessão persistida com SecureStore ✓</Text>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#2563eb',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 40,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#64748b',
    fontSize: 15,
  },
})
