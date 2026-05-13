import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { colors } from '../../../shared/styles/tokens'

const CTA_MAP = {
  dose_reminder:         { label: 'Registrar dose',    action: 'dashboard' },
  dose_reminder_by_plan: { label: 'Registrar plano',   action: 'bulk-plan' },
  dose_reminder_misc:    { label: 'Registrar doses',   action: 'bulk-misc' },
  stock_alert:           { label: 'Ver estoque',        action: 'stock' },
  prescription_alert:    { label: 'Ver estoque',        action: 'stock' },
  missed_dose:           { label: 'Registrar atrasada', action: 'history' },
  adherence_report:      { label: 'Ver histórico',      action: 'history' },
  monthly_report:        { label: 'Ver histórico',      action: 'history' },
  titration_update:      { label: 'Ver tratamento',     action: 'treatment' },
  daily_digest:          null,
}

/**
 * NotificationActions — Componente unificado para CTAs de notificação (Mobile).
 * Renderiza o rodapé com label de ação ou status de dose.
 */
export default function NotificationActions({ 
  notification, 
  wasTaken, 
  onNavigate,
  isDoseReminder,
  groupedComplete
}) {
  const { notification_type } = notification
  const cta = CTA_MAP[notification_type]

  // Caso: Dose já tomada individualmente
  if (isDoseReminder && wasTaken === true) {
    return <Text style={styles.takenLabel}>✓ Tomada</Text>
  }

  // Caso: Grupo de doses completo
  if (groupedComplete) {
    return (
      <Text style={[styles.takenLabel, styles.takenFull]}>
        {wasTaken.taken}/{wasTaken.total} tomadas
      </Text>
    )
  }

  // Caso: Tem ação de navegação disponível
  const hasNavAction = cta && !!onNavigate
  if (hasNavAction) {
    return (
      <View style={styles.actionLabel}>
        {typeof wasTaken === 'object' && (
          <Text style={styles.takenLabel}>{wasTaken.taken}/{wasTaken.total} • </Text>
        )}
        <Text style={styles.actionText}>{cta.label}</Text>
        <ChevronRight size={13} color={colors.brand?.primary} strokeWidth={2.5} />
      </View>
    )
  }

  return null
}

// Expõe o mapa para que o componente pai saiba se deve ser clicável
NotificationActions.getCTA = (type) => CTA_MAP[type]

const styles = StyleSheet.create({
  takenLabel:  { fontSize: 12, fontWeight: '500', color: colors.text?.muted },
  takenFull:   { color: colors.brand?.primary },
  actionLabel: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText:  { fontSize: 13, fontWeight: '600', color: colors.brand?.primary },
})
