import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight, ChevronUp } from 'lucide-react-native'
import { colors, spacing, typography } from '../../../shared/styles/tokens'

/**
 * TreatmentPlanHeader - Cabeçalho de acordeão para Planos de Tratamento
 * @param {Object} props
 * @param {string} title - Nome do plano/classe
 * @param {string} emoji - Emoji do plano/classe
 * @param {string} color - Cor destaque do plano
 * @param {boolean} isExpanded - Estado de expansão
 * @param {Function} onToggle - Callback de alternância
 * @param {number} count - Quantidade de protocolos no plano
 */
export default function TreatmentPlanHeader({ 
  title, 
  emoji = '💊', 
  color = colors.status.success, 
  isExpanded = true, 
  onToggle,
  count = 0
}) {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onToggle}
      activeOpacity={0.6}
    >
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle}>{count} {count === 1 ? 'protocolo' : 'protocolos'}</Text>
        </View>
        
        <View style={styles.chevronContainer}>
          {isExpanded ? (
            <ChevronUp size={20} color={colors.text.secondary} />
          ) : (
            <ChevronRight size={20} color={colors.text.secondary} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[1],
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing[3],
    // Sombras leves padrão Dosiq
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  emoji: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium || 'System',
    marginTop: 1,
  },
  chevronContainer: {
    marginLeft: spacing[2],
  }
})
