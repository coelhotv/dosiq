// ScreenContainer.jsx — wrapper padrão para telas mobile
// Aplica SafeAreaView + fundo + padding consistentes em todas as telas

import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../styles/tokens'

export default function ScreenContainer({ children, style }) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={['top']}>
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
})
