import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { colors } from '../../../shared/styles/tokens'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/**
 * AdherenceRing - Mostrador circular de adesão (Dona Maria style)
 * @param {Object} props
 * @param {number} props.score - 0 a 100
 * @param {number} props.size - Tamanho do componente
 * @param {number} props.strokeWidth - Grossura do anel
 */
export default function AdherenceRing({ score = 0, size = 120, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const animatedValue = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: score,
      duration: 1000,
      useNativeDriver: false, // Color interpolation doesn't work with native driver for SVG props
    }).start()
  }, [score])

  // Cálculo do offset para o SVG (inverso do progresso)
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  })

  // Interpolação de cor baseada no score (5 escalas pastéis)
  const strokeColor = animatedValue.interpolate({
    inputRange: [0, 1, 49, 50, 69, 70, 89, 90, 100],
    outputRange: [
      colors.neutral[300], // 0% (Cinza)
      '#ef9a9a',           // 1-49% (Vermelho Pastel)
      '#ef9a9a',
      '#ffd54f',           // 50-69% (Amarelo Pastel)
      '#ffd54f',
      '#64b5f6',           // 70-89% (Azul Pastel)
      '#64b5f6',
      colors.status.success, // > 90% (Verde Suave)
      colors.status.success,
    ],
  })

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Track (Fundo) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.neutral[200]}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeOpacity={0.4}
          />
          {/* Progress (Adesão) */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      
      {/* Texto Centralizado */}
      <View style={styles.textContainer}>
        <Text style={styles.scoreText}>{Math.round(score)}%</Text>
        <Text style={styles.label}>Adesão</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: 'System',
  },
  label: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: -2,
  },
})
