// ErrorBoundary.jsx — captura erros React não-tratados e reporta ao Crashlytics.
// Wrappa toda a árvore em AppRoot. Em prod, mostra fallback simples;
// em dev, deixa o LogBox/RedBox padrão tomar conta (re-throw).

import { Component } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import crashlytics from '@react-native-firebase/crashlytics'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Sempre reporta ao Crashlytics (mesmo em dev — útil para validar pipeline)
    crashlytics().recordError(error, 'ErrorBoundary')
    crashlytics().log(`ErrorBoundary caught: ${info?.componentStack ?? 'no stack'}`)

    if (__DEV__) {
      // Em dev, re-throw para o LogBox/RedBox aparecer
      // (Crashlytics já gravou; queremos visibilidade local)
      console.error('[ErrorBoundary]', error, info)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError && !__DEV__) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo deu errado</Text>
          <Text style={styles.body}>
            O app encontrou um problema inesperado. Tente novamente.
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.screen,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
})
