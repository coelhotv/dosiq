import React from 'react'
import { View, Text, Switch, Pressable, Linking, Platform, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { BellRing, BellOff, CheckCircle2, AlertTriangle, ChevronRight } = LucideIcons as any
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { useCriticalAlarmDeviceStatus } from '@platform/alarms/useCriticalAlarmDeviceStatus'
import { requestPushOrOpenSettings } from '@platform/notifications/pushPermission'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import type { CriticalAlarmDeviceStatus } from '@platform/alarms/alarmService'

/**
 * CriticalAlarmCard — o alarme crítico como card próprio (spec 054 FR-009).
 *
 * Form: logo após Horários, com toggle. Detalhe do tratamento: `readOnly` (sem toggle), mesma faixa.
 * O toggle é a INTENÇÃO da pessoa e fica sempre na cor da marca; o que o aparelho permite vai na
 * FAIXA de baixo, por gravidade (emenda 2026-10-14, mock 2 do designer com o texto corrigido):
 * no iOS, crítico negado ainda TOCA, só que mudo no silencioso (PO-3) — dizer "não vai tocar" seria falso.
 *
 * `scope="global"` (Preferências, C-24): sem toggle (o alarme crítico liga por tratamento), faixa sempre
 * visível e texto no plural. Push desligado não ganha botão próprio: aponta para o "Ativar" que a tela
 * já tem acima — duas ações para o mesmo problema confundem.
 */
interface CriticalAlarmCardProps {
  criticalAlarm: boolean
  onToggle?: (value: boolean) => void
  /** Detalhe do tratamento: sem toggle, com "Ligado"/"Desligado". */
  readOnly?: boolean
  /** Faixa "ainda não permitido" (iOS): abre o sheet explicativo antes do diálogo do SO. */
  onRequestPermission?: () => void
  /** `treatment` (form/detalhe) ou `global` (Preferências de notificação). */
  scope?: 'treatment' | 'global'
  style?: any
}

interface BandCopy {
  tone: 'blocked' | 'degraded' | 'active'
  title: string
  body?: string
  action?: 'settings' | 'request' | 'request_push'
}

/** Texto e tom da faixa por estado. `null` = sem faixa (leitura falhou: não afirmar nada). */
function bandFor(status: CriticalAlarmDeviceStatus, scope: 'treatment' | 'global' = 'treatment'): BandCopy | null {
  const global = scope === 'global'
  switch (status.kind) {
    case 'active':
      return { tone: 'active', title: Platform.OS === 'ios' ? 'Ativo neste iPhone' : 'Ativo neste aparelho' }
    case 'blocked':
      // Push desligado nas Preferências: a ação é o "Ativar" de cima, não um 2º botão.
      if (global && status.reason === 'push') {
        return { tone: 'blocked', title: 'Notificações desligadas', body: 'Nenhum alarme vai tocar. Ative as notificações acima.' }
      }
      // C-33: nunca perguntado ⇒ o diálogo do SO resolve com 1 toque; Ajustes só se já negou.
      if (status.canRequest) {
        return {
          tone: 'blocked',
          title: 'Notificações desligadas',
          body: global ? 'Nenhum alarme vai tocar. Toque para ativar.' : 'O alarme não vai tocar. Toque para ativar.',
          action: 'request_push',
        }
      }
      return {
        tone: 'blocked',
        title: 'Notificações desligadas',
        body: global ? 'Nenhum alarme vai tocar. Ative em Ajustes.' : 'O alarme não vai tocar. Ative em Ajustes.',
        action: 'settings',
      }
    case 'degraded': {
      // Sem o crítico o alarme sai como notificação sensível ao tempo: fura o Foco, mas fica mudo
      // com a chave de silencioso. "Toca como alarme comum" prometia som que não vem (PO, 2026-10-14).
      // C-25 (Android): o canal do alarme foi posto em "Silencioso" em Ajustes. Desestruturado: com
      // strictNullChecks off, `reason?` estreitaria o resto do ramo para `never`.
      const { fix, reason } = status
      if (reason === 'channel_silenced') {
        return {
          tone: 'degraded',
          title: 'Alarme silenciado em Ajustes',
          body: global ? 'Os alarmes chegam sem som. Ative o som em Ajustes.' : 'O alarme chega sem som. Ative o som em Ajustes.',
          action: 'settings',
        }
      }
      if (reason === 'channel_no_popup') {
        return {
          tone: 'degraded',
          title: 'Alarme sem aviso na tela',
          body: global
            ? 'Os alarmes tocam, mas não aparecem na tela. Ligue "Exibir na tela" em Ajustes.'
            : 'Toca, mas não aparece na tela. Ligue "Exibir na tela" em Ajustes.',
          action: 'settings',
        }
      }
      // C-28: o modo normal também não furou o Foco no smoke (depende de ajuste do usuário no iOS).
      const mute = global ? 'Os alarmes ficam mudos no silencioso e no Foco.' : 'Fica mudo no silencioso e no Foco.'
      return fix === 'request'
        ? { tone: 'degraded', title: 'Alarme crítico ainda não permitido', body: `${mute} Toque para permitir.`, action: 'request' }
        : { tone: 'degraded', title: 'Alarme crítico desligado em Ajustes', body: `${mute} Permita em Ajustes.`, action: 'settings' }
    }
    default:
      return null
  }
}

const TONE = {
  active: { Icon: CheckCircle2, color: colors.status.successDark },
  blocked: { Icon: BellOff, color: colors.status.warning },
  degraded: { Icon: AlertTriangle, color: colors.status.warning },
}

function StatusBand({ band, onRequestPermission, onRequestPush }: { band: BandCopy; onRequestPermission?: () => void; onRequestPush?: () => void }) {
  let onPress: (() => void) | undefined
  if (band.action === 'settings') onPress = () => Linking.openSettings()
  else if (band.action === 'request') onPress = onRequestPermission
  else if (band.action === 'request_push') onPress = onRequestPush
  const { Icon, color } = TONE[band.tone]
  const toneStyle = styles[`band_${band.tone}`]
  const content = (
    <>
      <Icon size={18} color={color} strokeWidth={2} />
      <View style={styles.bandText}>
        <Text style={[styles.bandTitle, { color }]}>{band.title}</Text>
        {band.body ? <Text style={[styles.bandBody, { color }]}>{band.body}</Text> : null}
      </View>
      {onPress ? <ChevronRight size={18} color={color} strokeWidth={2} /> : null}
    </>
  )
  if (!onPress) {
    return (
      <View style={[styles.band, toneStyle]} accessibilityLabel={band.title}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.band, toneStyle, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[band.title, band.body].filter(Boolean).join('. ')}
    >
      {content}
    </Pressable>
  )
}

export default function CriticalAlarmCard({
  criticalAlarm,
  onToggle,
  readOnly = false,
  onRequestPermission,
  scope = 'treatment',
  style,
}: CriticalAlarmCardProps) {
  const global = scope === 'global'
  const { status, refresh } = useCriticalAlarmDeviceStatus(global || criticalAlarm)
  const band = global || criticalAlarm ? bandFor(status, scope) : null
  // C-33: pede o push no ponto de intenção (diálogo do SO); sem diálogo possível ⇒ Ajustes.
  const requestPush = async () => {
    await requestPushOrOpenSettings({ supabase }).catch(() => Linking.openSettings())
    refresh()
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <BellRing size={20} color={colors.brand.primary} strokeWidth={2} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Alarme crítico</Text>
          <Text style={styles.hint}>
            {global
              ? 'Toca alto mesmo no silencioso e no Foco. Ligue em cada tratamento.'
              : 'Toca alto mesmo no silencioso e no Foco. Use para doses que não podem ser esquecidas.'}
          </Text>
        </View>
        {global ? null : readOnly ? (
          <Text style={[styles.readOnlyState, criticalAlarm && styles.readOnlyStateOn]}>
            {criticalAlarm ? 'Ligado' : 'Desligado'}
          </Text>
        ) : (
          <Switch
            value={criticalAlarm}
            onValueChange={onToggle}
            // Desligado precisa ser legível sobre o card branco: neutral[300] (padrão Settings/Detalhe);
            // no iOS o track desligado vem de `ios_backgroundColor`, não só do trackColor.false.
            trackColor={{ false: colors.neutral[300], true: colors.brand.primary }}
            ios_backgroundColor={colors.neutral[300]}
            thumbColor={colors.bg.card}
            accessibilityLabel="Alarme crítico"
          />
        )}
      </View>
      {band ? <StatusBand band={band} onRequestPermission={onRequestPermission} onRequestPush={requestPush} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border?.default,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing[1] },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  hint: {
    fontSize: 13,
    color: colors.text?.secondary,
    lineHeight: 18,
  },
  readOnlyState: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  readOnlyStateOn: { color: colors.brand.primary },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    minHeight: 48,
  },
  band_blocked: { backgroundColor: colors.status.warningLight, borderTopColor: colors.status.warningLight },
  band_degraded: { backgroundColor: colors.neutral[50], borderTopColor: colors.border.default },
  band_active: { backgroundColor: colors.primary[50], borderTopColor: colors.border.default },
  bandText: { flex: 1, gap: 2 },
  bandTitle: { fontSize: 14, fontWeight: '700' },
  bandBody: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
})
