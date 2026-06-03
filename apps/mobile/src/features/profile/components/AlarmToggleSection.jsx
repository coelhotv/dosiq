// AlarmToggleSection.jsx — toggle do alarme nativo persistente (Spec 001, FR-007)
//
// Auto-contido: lê/grava a preferência via useAlarmEnabled (AsyncStorage + pub/sub),
// desacoplado da persistência user_settings do resto da tela. Default OFF (opt-in):
// o alarme invasivo só liga por ação consciente do usuário.
//
// R-137/138: peso ≥ 700 nos rótulos, ícone sempre com texto.

import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, Switch, Modal, TouchableOpacity } from 'react-native'
import { AlarmClock } from 'lucide-react-native'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'
import { useToast } from '@shared/components/feedback/Toast'
import { useAlarmEnabled } from '@platform/alarms/useAlarmEnabled'
import {
  requestAlarmPermission,
  needsFullScreenIntentAccess,
  openFullScreenIntentSettings,
  isXiaomiDevice,
} from '@platform/alarms/alarmService'
import { registerPushToken } from '@platform/notifications/registerPushToken'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

// Re-sincroniza o flag native_alarm_enabled do device no backend (gate de
// duplicata, Spec 001 A2): server pula o push de dose pra este device quando ON.
// Fire-and-forget — sem token de push (permissão negada) é no-op silencioso.
function syncAlarmDeviceFlag(enabled) {
  registerPushToken({ supabase, nativeAlarmEnabled: enabled }).catch(() => {})
}

const XIAOMI_MSG =
  'Você precisa de uma etapa extra para o alarme funcionar na tela bloqueada. Abra as configurações abaixo e:\n\n' +
  '1. Escolha "Outras permissões" e ative *Sempre permitir* em:\n' +
  '  a. "Mostrar na Tela de bloqueio"\n' +
  '  b. "Abrir novas janelas enquanto executa em segundo plano"\n' +
  '  c. "Exibir janelas pop-up"\n\n'+
  'Quando terminar, pode fechar essa janela.'

const GENERIC_MSG =
  'Para o alarme funcionar na tela bloqueada, toque em <Abrir configurações> abaixo e ligue "Notificações em tela cheia".'

export default function AlarmToggleSection() {
  const [enabled, setEnabled] = useAlarmEnabled()
  const { show } = useToast()
  const [guideVisible, setGuideVisible] = useState(false)
  const [guideMsg, setGuideMsg] = useState('')

  // Ligar = ponto de intenção (R-239): pede a permissão de notificação (mesma
  // do push). Negada no SO → não liga + toast. Desligar nunca pede nada.
  const onToggle = useCallback(
    async (next) => {
      if (next) {
        const granted = await requestAlarmPermission()
        if (!granted) {
          show('Permita as notificações para usar o alarme.', { variant: 'error' })
          return // não liga o toggle
        }
        await setEnabled(true)
        syncAlarmDeviceFlag(true) // gate: server para de mandar push de dose pra este device
        // Guia de permissão SEMPRE que liga (instruções Xiaomi são complexas;
        // o usuário pode precisar revisar). Dois modelos: Xiaomi vs. genérico A14+.
        if (needsFullScreenIntentAccess()) {
          setGuideMsg(isXiaomiDevice() ? XIAOMI_MSG : GENERIC_MSG)
          setGuideVisible(true)
        }
        return
      }
      await setEnabled(false)
      syncAlarmDeviceFlag(false) // volta a receber push de dose normal
    },
    [setEnabled, show]
  )

  return (
    <>
      <Text style={styles.sectionLabel}>ALARMES CRÍTICOS</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <AlarmClock size={20} color={colors.brand.primary} strokeWidth={2} />
            <View style={styles.flexShrink}>
              <Text style={styles.rowLabel}>Alarme de doses</Text>
              <Text style={styles.rowHint}>
                Abre em tela cheia e toca um som, mesmo no silencioso.
                Para doses que não podem ser esquecidas.
              </Text>
            </View>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.neutral[200], true: colors.brand.primary }}
            thumbColor={colors.bg.card}
            accessibilityRole="switch"
            accessibilityLabel="Ativar alarme de dose em tela cheia"
          />
        </View>
      </View>

      {/* Guia de permissão — Modal próprio (não Alert): PERSISTE após "Abrir
          configurações" para o usuário ir e voltar checando cada item. Só fecha
          no "Fechar". statusBarTranslucent p/ cobrir a status bar (R-233). */}
      <Modal
        visible={guideVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setGuideVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Falta um passo no seu celular</Text>
            <Text style={styles.dialogBody}>{guideMsg}</Text>
            <TouchableOpacity
              style={[styles.dialogBtn, styles.dialogBtnPrimary]}
              onPress={() => openFullScreenIntentSettings()}
              accessibilityRole="button"
              accessibilityLabel="Abrir configurações"
            >
              <Text style={styles.dialogBtnPrimaryText}>Abrir configurações</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dialogBtn}
              onPress={() => setGuideVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Fechar aviso"
            >
              <Text style={styles.dialogBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

// Estilos espelham NotificationPreferencesScreen (mesma largura/cor/peso dos
// outros cards da tela — sem marginHorizontal; o inset vem do scrollContent).
const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    marginTop: spacing[5],
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: 56,
    gap: spacing[3],
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  flexShrink: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  rowHint: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  dialog: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    gap: spacing[3],
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dialogBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  dialogBtn: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnPrimary: {
    backgroundColor: colors.brand.primary,
  },
  dialogBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg.card,
  },
  dialogBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
})
