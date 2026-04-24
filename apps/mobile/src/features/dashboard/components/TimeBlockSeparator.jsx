import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Moon, Sun, CloudSun, ChevronRight, ChevronUp } from 'lucide-react-native'
import { colors, spacing, typography } from '../../../shared/styles/tokens'

/**
 * TimeBlockSeparator - Divisor de turnos para a Timeline (Epic 2)
 * @param {Object} props
 * @param {'Manhã'|'Tarde'|'Noite'|'Madrugada'} type - Turno do dia
 * @param {boolean} isExpanded - Estado de expansão do turno
 * @param {Function} onToggle - Callback para alternar expansão
 * @param {boolean} isDisabled - Se o turno deve ser renderizado em estado "desabilitado" (vazio)
 * @param {{taken: number, total: number}} counts - Contador de doses (tomadas/total)
 */
export default function TimeBlockSeparator({ 
  type = 'Manhã', 
  isExpanded = true, 
  onToggle, 
  isDisabled = false,
  counts = null
}) {
  const renderIcon = (t) => {
    const iconSize = 18
    const baseColor = isDisabled ? colors.text.secondary : null

    switch (t) {
      case 'Madrugada': 
        return <Moon size={iconSize} color={baseColor || '#74777f'} />
      case 'Manhã': 
        return <Sun size={iconSize} color={baseColor || '#f9a825'} />
      case 'Tarde': 
        return <CloudSun size={iconSize} color={baseColor || '#fb8c00'} />
      case 'Noite': 
        return <Moon size={iconSize} color={baseColor || '#3f51b5'} />
      default: 
        return <Sun size={iconSize} color={baseColor || '#74777f'} />
    }
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onToggle}
      activeOpacity={0.6}
      disabled={!onToggle}
    >
      <View style={styles.timelineRow}>
        <View style={styles.dotContainer}>
          {renderIcon(type)}
        </View>
        <Text style={[
          styles.text,
          isDisabled && styles.textDisabled
        ]}>
          {type}
        </Text>
        
        {onToggle && (
          <View style={styles.rightContent}>
            {counts && counts.total > 0 && (
              <Text style={[
                styles.countsText,
                isDisabled && styles.countsTextDisabled
              ]}>
                ({counts.taken}/{counts.total})
              </Text>
            )}
            <View style={styles.chevronContainer}>
              {isExpanded ? (
                <ChevronUp size={20} color={colors.text.secondary} />
              ) : (
                <ChevronRight size={20} color={colors.text.secondary} />
              )}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[1],
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing[2],
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  textDisabled: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  chevronContainer: {
    paddingRight: 4,
  },
  rightContent: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  countsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginRight: spacing[1],
    fontFamily: typography.fontFamily.medium || 'System',
  },
  countsTextDisabled: {
    opacity: 0.5,
  }
})
