// App.js — DEBUG TEMPORÁRIO: isola qual camada causa o crash
// Para restaurar: import AppRoot from './src/navigation/AppRoot'
import { View, Text, StyleSheet } from 'react-native'

// LAYER 0: RN básico sem nenhuma dependência
export default function App() {
  return (
    <View style={s.container}>
      <Text style={s.text}>Layer 0: RN básico OK ✓</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, color: '#1e293b' },
})
