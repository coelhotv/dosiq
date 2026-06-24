// ChatEntryButton.jsx — entry-point do chat IA no header (spec 015 onda 2; PO-D1).
//
// Ícone discreto top-right plugável nos headers das abas Hoje/Tratamentos/Estoque
// (NÃO Perfil; NÃO é FAB — afordância de header, evita AP-W24 e colisão com o speed-dial).
// Self-contained via useNavigation.

import { TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { BotMessageSquare } from 'lucide-react-native'
import { colors } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '../../../navigation/routes'

export default function ChatEntryButton({ size = 26, color = colors.text.brand }) {
  const navigation = useNavigation()
  return (
    <TouchableOpacity
      onPress={() => {
        lightTap()
        navigation.navigate(ROUTES.CHAT)
      }}
      style={styles.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Abrir assistente IA"
    >
      <BotMessageSquare size={size} color={color} strokeWidth={1.75} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[200], // teal leve — círculo de fundo (não "flutuar")
  },
})
