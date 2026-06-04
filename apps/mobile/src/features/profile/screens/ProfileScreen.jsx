import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Bell, ChevronRight, Settings as SettingsIcon, UserCircle2, MapPin, Pencil } from 'lucide-react-native'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { useProfile } from '@profile/hooks/useProfile'
import { logoutUser } from '../services/profileService'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import LogoutSheet from '@profile/components/LogoutSheet'
import TzNudgeCard from '@profile/components/TzNudgeCard'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { useUnreadBadgeCount } from '@shared/hooks/useUnreadBadgeCount'
import { EXTERNAL_URLS } from '../../../shared/constants'

/**
 * Hub do Perfil (Fase 4) — evolui o MVP read-only (H5.6).
 * Topo: card de identidade (perfil preenchido) OU empty state "Complete seu
 * perfil". Engrenagem no header → Configurações. Preserva seções MINHA CONTA /
 * AVISOS & LEMBRETES / OUTROS + Sair + versão.
 */
// eslint-disable-next-line max-lines-per-function
export default function ProfileScreen() {
  const navigation = useNavigation()
  const { user, loading, error, refresh, hasProfile, displayName, initials, age, location } = useProfile()

  const { unreadCount, refreshBadge } = useUnreadBadgeCount(user?.id)
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const goToEdit = () => navigation.navigate(ROUTES.PROFILE_EDIT)
  const goToSettings = () => navigation.navigate(ROUTES.SETTINGS)

  // Refresca ao focar: reflete dados salvos em Editar Perfil (instância de
  // useProfile do Hub é separada da do form — sem isso o Hub fica stale).
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh]),
  )

  // Linha "49 anos · São Paulo, SP" — só os pedaços disponíveis.
  const identitySubtitle = [age != null ? `${age} anos` : null, location].filter(Boolean).join('  ·  ')

  const handlePrivacyPolicy = async () => {
    await WebBrowser.openBrowserAsync(EXTERNAL_URLS.PRIVACY_POLICY)
  }

  const handleConfirmLogout = async () => {
    setLoggingOut(true)
    const { success, error: logoutErr } = await logoutUser()
    // Em sucesso, o listener SIGNED_OUT (Navigation) reseta para a Landing e
    // este componente desmonta — não precisa fechar o sheet manualmente.
    if (!success) {
      setLoggingOut(false)
      setLogoutSheetOpen(false)
      if (__DEV__) console.error('Erro ao fazer logout:', logoutErr)
    }
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
            colors={[colors.brand.primary]} 
            tintColor={colors.brand.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
          <TouchableOpacity
            onPress={goToSettings}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Configurações"
          >
            <SettingsIcon size={24} color={colors.text.secondary} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        {/* Topo: identidade preenchida OU empty state (PO-1) */}
        {hasProfile ? (
          <TouchableOpacity
            style={styles.identityCard}
            onPress={goToEdit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            <View style={styles.identityRow}>
              <View style={styles.identityAvatar}>
                <Text style={styles.identityInitials}>{initials}</Text>
              </View>
              <View style={styles.identityInfo}>
                <Text style={styles.identityName} numberOfLines={1}>{displayName}</Text>
                {identitySubtitle ? (
                  <View style={styles.identitySubRow}>
                    {location ? <MapPin size={13} color={colors.text.secondary} strokeWidth={2} /> : null}
                    <Text style={styles.identitySub} numberOfLines={1}>{identitySubtitle}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.editButton}>
              <Pencil size={15} color={colors.primary[700]} strokeWidth={2} />
              <Text style={styles.editButtonText}>Editar Perfil</Text>
            </View>
          </TouchableOpacity>
        ) : (
          // Empty state: card teal soft. AP-163 — RN não suporta borderStyle
          // dashed; usa borda sólida soft (mesma intenção visual).
          <View style={styles.emptyCard}>
            <View style={styles.emptyRow}>
              <View style={styles.emptyIcon}>
                <UserCircle2 size={32} color={colors.primary[500]} strokeWidth={1.5} />
              </View>
              <View style={styles.emptyTextGroup}>
                <Text style={styles.emptyTitle}>Complete seu Perfil</Text>
                <Text style={styles.emptyBody}>
                  Personalize o Dosiq do seu jeito, com nome, idade e cidade.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={goToEdit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Adicionar meus dados"
            >
              <Text style={styles.emptyCtaText}>+ Adicionar meus dados</Text>
            </TouchableOpacity>
          </View>
        )}

        <TzNudgeCard />

        {/* Ordem (PO feedback #6): AVISOS → OUTROS → MINHA CONTA → Sair → versão */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AVISOS & LEMBRETES</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(ROUTES.NOTIFICATION_INBOX, { userId: user?.id })}
            activeOpacity={0.7}
          >
            <View style={styles.notificationRow}>
              <Bell size={20} color={colors.brand.primary} strokeWidth={1.5} />
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
              onPress={handlePrivacyPolicy}
              activeOpacity={0.7}
            >
              <View style={styles.otherLabelContainer}>
                <Text style={styles.otherLabel}>Privacidade e dados</Text>
              </View>
              <ChevronRight size={18} color={colors.text.secondary} strokeWidth={1.5} />
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

        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setLogoutSheetOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Sair da Conta"
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

      <LogoutSheet
        visible={logoutSheetOpen}
        loading={loggingOut}
        onCancel={() => setLogoutSheetOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // Card de identidade (perfil preenchido)
  identityCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginHorizontal: 16,
    marginBottom: spacing[6],
    ...shadows.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  identityAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary[700],
    letterSpacing: 0.5,
  },
  identityInfo: {
    flex: 1,
  },
  identityName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  identitySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  identitySub: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing[4],
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[200] || colors.primary[100],
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[700],
  },
  // Empty state (perfil sem dados)
  emptyCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[200] || colors.primary[100],
    padding: spacing[4],
    marginHorizontal: 16,
    marginBottom: spacing[6],
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextGroup: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  emptyCta: {
    marginTop: spacing[4],
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
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
