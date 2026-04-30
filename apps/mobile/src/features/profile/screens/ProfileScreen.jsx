import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Bell, ChevronRight } from 'lucide-react-native'
import Constants from 'expo-constants'
import { useProfile } from '../hooks/useProfile'
import { logoutUser } from '../services/profileService'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import { colors, spacing, borderRadius, shadows, typography } from '../../../shared/styles/tokens'
import { ROUTES } from '../../../navigation/routes'
import { useUnreadBadgeCount } from '../../../shared/hooks/useUnreadBadgeCount'

/**
 * Tela de Perfil do MVP mobile (H5.6)
 * Exibe dados da conta, integração Telegram e logout.
 */
export default function ProfileScreen() {
  const navigation = useNavigation()
  const { user, loading, error, refresh } = useProfile()

  const { unreadCount, refreshBadge } = useUnreadBadgeCount(user?.id)

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

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando perfil..." />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={() => {
              refresh()
              refreshBadge()
            }} 
            colors={[colors.primary[600]]} 
            tintColor={colors.primary[600]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MINHA CONTA</Text>
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
          <Text style={styles.sectionTitle}>AVISOS & LEMBRETES</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(ROUTES.NOTIFICATION_INBOX, { userId: user?.id })}
            activeOpacity={0.7}
          >
            <View style={styles.notificationRow}>
              <Bell size={20} color={colors.primary[600]} strokeWidth={1.5} />
              <View style={styles.notificationTextGroup}>
                <Text style={styles.notificationLabel}>Notificações</Text>
                <Text style={styles.notificationSubtitle}>Avisos, preferências e canais</Text>
              </View>
              {unreadCount > 0 && (
                <View style={styles.inboxBadge}>
                  <Text style={styles.inboxBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
              <ChevronRight size={18} color={colors.text.secondary} strokeWidth={1.5} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OUTROS</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.otherRow}
              onPress={() => {}}
              activeOpacity={1}
              disabled={true}
            >
              <View style={styles.otherLabelContainer}>
                <Text style={styles.otherLabelDisabled}>Privacidade e dados</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>em breve</Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.text.muted} strokeWidth={1.5} />
            </TouchableOpacity>
            <View style={styles.otherDivider} />
            <TouchableOpacity
              style={styles.otherRow}
              onPress={() => {}}
              activeOpacity={1}
              disabled={true}
            >
              <View style={styles.otherLabelContainer}>
                <Text style={styles.otherLabelDisabled}>Sobre o Dosiq</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>em breve</Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.text.muted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>

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
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: spacing[2],
    paddingHorizontal: 20,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginHorizontal: 16,
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
    lineHeight: 20,
  },
  value: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    maxWidth: '70%',
    lineHeight: 20,
  },
  logoutSection: {
    marginTop: spacing[4],
    marginBottom: spacing[8],
    marginHorizontal: 16,
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
  notificationTextGroup: {
    flex: 1,
    gap: 2,
  },
  notificationLabel: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  notificationSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
  },
  otherLabel: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  otherLabelDisabled: {
    fontSize: 16,
    color: colors.text.muted,
    fontWeight: '500',
    lineHeight: 22,
  },
  otherLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoonBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: spacing[2],
  },
  comingSoonText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  otherDivider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  inboxBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 100,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
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
