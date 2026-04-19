import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Bell } from 'lucide-react-native'
import Constants from 'expo-constants'
import { useProfile } from '../hooks/useProfile'
import { logoutUser } from '../services/profileService'
import TelegramLinkCard from '../components/TelegramLinkCard'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import { colors, spacing, borderRadius, shadows } from '../../../shared/styles/tokens'
import { ROUTES } from '../../../navigation/routes'

/**
 * Tela de Perfil do MVP mobile (H5.6)
 * Exibe dados da conta, integração Telegram e logout.
 */
export default function ProfileScreen() {
  const navigation = useNavigation()
  const { user, settings, loading, error, refresh, generateToken } = useProfile()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleLogout = async () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            const { success, error: logoutErr } = await logoutUser()
            if (!success && __DEV__) {
              console.error('Erro ao fazer logout:', logoutErr)
            }
          }
        }
      ]
    )
  }

  const handleGenerateToken = async () => {
    setIsGenerating(true)
    try {
      await generateToken()
    } catch (err) {
      if (__DEV__) console.error('Erro ao gerar token:', err)
      Alert.alert('Erro', 'Não foi possível gerar o código: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={refresh} 
            colors={[colors.primary[600]]} 
            tintColor={colors.primary[600]}
          />
        }
      >
        <Text style={styles.headerTitle}>Perfil</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minha Conta</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">
                {user?.email || '...'}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, { color: colors.status.success }]}>Ativo</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(ROUTES.NOTIFICATION_PREFERENCES)}
            activeOpacity={0.7}
          >
            <View style={styles.notificationRow}>
              <Bell size={20} color={colors.primary[600]} strokeWidth={1.5} />
              <Text style={styles.notificationLabel}>Preferências de Notificação</Text>
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TelegramLinkCard
          settings={settings}
        />

        <View style={styles.logoutSection}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionSection}>
          <Text style={styles.versionText}>
            Versão {Constants.expoConfig?.version || '0.0.0'} (Build {Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1'})
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Erro ao carregar dados: {error}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing[4],
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[6],
    marginTop: spacing[2],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  label: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  value: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    maxWidth: '70%',
  },
  logoutSection: {
    marginTop: spacing[4],
    marginBottom: spacing[8],
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.status.error + '50',
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    backgroundColor: colors.bg.card,
  },
  logoutText: {
    color: colors.status.error,
    fontWeight: '700',
    fontSize: 16,
  },
  errorContainer: {
    marginTop: spacing[2],
    padding: spacing[2],
    backgroundColor: colors.status.error + '10',
    borderRadius: borderRadius.sm,
  },
  errorText: {
    color: colors.status.error,
    fontSize: 12,
    textAlign: 'center',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  notificationLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 20,
    color: colors.text.secondary,
  },
  versionSection: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    opacity: 0.5,
  },
  versionText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: 'Courier', // Estilo técnico
  },
})
