/**
 * ConsentLegalHeader — faixa de contexto legal no topo das telas de consentimento (spec 046).
 *
 * Comunica duas coisas ANTES do corpo: (1) é uma ação necessária, não um convite (ícone de alerta
 * âmbar + "Autorização necessária"); (2) não é capricho do app — é exigência da LGPD. O
 * enquadramento é do TITULAR ("autorização necessária"), não do controlador ("adequação"): quem lê
 * é o usuário, e "adequação LGPD" é jargão de quem implementa compliance, não de quem usa o app.
 *
 * Âmbar (não vermelho): pede atenção sem soar punitivo — o titular não fez nada de errado.
 */
import { View, Text, StyleSheet } from 'react-native'
import { AlertTriangle } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

export default function ConsentLegalHeader() {
  return (
    <View style={styles.banner} accessibilityRole="header">
      <AlertTriangle size={20} color={colors.status.warning} strokeWidth={2.2} />
      <View style={styles.body}>
        <Text style={styles.title}>Autorização necessária</Text>
        <Text style={styles.subtitle}>Exigido pela LGPD (Lei nº 13.709/2018)</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.warningLight,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.status.warning,
  },
  subtitle: {
    fontSize: 12,
    color: colors.status.warning,
    marginTop: 1,
  },
})
